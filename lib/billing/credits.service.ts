import { Prisma } from "@/generated/prisma";
import { ttsPremiumQuotaExceeded } from "@/lib/api/errors";
import {
  getUserPlanState,
  type BillingPeriod,
  type UserPlanState,
} from "@/lib/billing/entitlements";
import { estimatedMinutes, remainingMinutes } from "@/lib/billing/premium-usage";
import { prisma } from "@/lib/db/prisma";

type Db = Prisma.TransactionClient;

export type PremiumBalance = {
  availableSeconds: number;
  monthlySeconds: number;
  purchasedSeconds: number;
  reservedSeconds: number;
  /** Size of the newest monthly grant. */
  monthlyGrantSeconds: number;
  /** When the soonest-expiring monthly minutes lapse; null when none are left. */
  monthlyExpiresAt: Date | null;
};

type Reservation = {
  id: string;
  userId: string;
  status: "RESERVED" | "CAPTURED" | "RELEASED";
  reservedSeconds: number;
  monthlySeconds: number;
  purchasedSeconds: number;
  monthlyExpiresAt: Date | null;
};

/** Monthly entries sharing an expiry form one lot. */
type MonthlyLot = { expiresAt: Date; seconds: number };

function monthlyGrantKey(userId: string, periodStart: Date): string {
  return `monthly:${userId}:${periodStart.toISOString()}`;
}

/** Monthly minutes stay usable for one more billing period after their own. */
export function monthlyGrantExpiry(period: BillingPeriod): Date {
  const length = period.end.getTime() - period.start.getTime();
  return new Date(period.end.getTime() + Math.max(0, length));
}

/** Grants the current Creator period at most once; safe to call on every read. */
export async function ensureMonthlyGrant(
  userId: string,
  state: UserPlanState,
): Promise<void> {
  if (!state.period || state.plan.premiumSecondsPerPeriod <= 0) {
    return;
  }
  const idempotencyKey = monthlyGrantKey(userId, state.period.start);
  const existing = await prisma.creditLedger.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return;
  }
  try {
    await prisma.creditLedger.create({
      data: {
        userId,
        type: "MONTHLY_GRANT",
        bucket: "MONTHLY",
        amountSeconds: state.plan.premiumSecondsPerPeriod,
        expiresAt: monthlyGrantExpiry(state.period),
        referenceType: "subscription",
        referenceId: state.subscriptionId,
        idempotencyKey,
        metadata: {
          planId: state.plan.id,
          periodStart: state.period.start.toISOString(),
          periodEnd: state.period.end.toISOString(),
        },
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }
}

/** Live monthly lots with minutes left, soonest expiry first. */
async function readMonthlyLots(db: Db, userId: string, now: Date): Promise<MonthlyLot[]> {
  const groups = await db.creditLedger.groupBy({
    by: ["expiresAt"],
    where: { userId, bucket: "MONTHLY", expiresAt: { gt: now } },
    _sum: { amountSeconds: true },
    orderBy: { expiresAt: "asc" },
  });
  return groups.flatMap((group) => {
    const seconds = group._sum.amountSeconds ?? 0;
    return group.expiresAt && seconds > 0 ? [{ expiresAt: group.expiresAt, seconds }] : [];
  });
}

async function readPurchasedSeconds(db: Db, userId: string): Promise<number> {
  const purchased = await db.creditLedger.aggregate({
    where: { userId, bucket: "PURCHASED" },
    _sum: { amountSeconds: true },
  });
  return Math.max(0, purchased._sum.amountSeconds ?? 0);
}

async function readBalance(db: Db, userId: string, now: Date): Promise<PremiumBalance> {
  const [lots, purchasedSeconds, grant, reserved] = await Promise.all([
    readMonthlyLots(db, userId, now),
    readPurchasedSeconds(db, userId),
    db.creditLedger.findFirst({
      where: { userId, type: "MONTHLY_GRANT", expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
      select: { amountSeconds: true },
    }),
    db.creditReservation.aggregate({
      where: { userId, status: "RESERVED" },
      _sum: { reservedSeconds: true },
    }),
  ]);
  const monthlySeconds = lots.reduce((sum, lot) => sum + lot.seconds, 0);
  return {
    availableSeconds: monthlySeconds + purchasedSeconds,
    monthlySeconds,
    purchasedSeconds,
    reservedSeconds: reserved._sum.reservedSeconds ?? 0,
    monthlyGrantSeconds: grant?.amountSeconds ?? 0,
    monthlyExpiresAt: lots[0]?.expiresAt ?? null,
  };
}

/** Returns purchased minutes first, then monthly minutes to the lots they came from, latest first. */
async function writeRefund(
  db: Db,
  input: { reservation: Reservation; refundSeconds: number; reason: string },
): Promise<void> {
  const { reservation } = input;
  const base = {
    userId: reservation.userId,
    type: "GENERATION_REFUND" as const,
    referenceType: "reservation",
    referenceId: reservation.id,
    metadata: { reason: input.reason },
  };
  const fromPurchased = Math.min(input.refundSeconds, reservation.purchasedSeconds);
  if (fromPurchased > 0) {
    await db.creditLedger.create({
      data: {
        ...base,
        bucket: "PURCHASED",
        amountSeconds: fromPurchased,
        idempotencyKey: `refund:${reservation.id}:purchased`,
      },
    });
  }

  let remaining = input.refundSeconds - fromPurchased;
  if (remaining <= 0) {
    return;
  }
  const draws = await db.creditLedger.findMany({
    where: {
      userId: reservation.userId,
      type: "GENERATION_RESERVE",
      bucket: "MONTHLY",
      referenceType: "reservation",
      referenceId: reservation.id,
    },
    orderBy: { expiresAt: "desc" },
    select: { amountSeconds: true, expiresAt: true },
  });
  for (const draw of draws) {
    const amount = Math.min(remaining, -draw.amountSeconds);
    if (amount <= 0) {
      continue;
    }
    await db.creditLedger.create({
      data: {
        ...base,
        bucket: "MONTHLY",
        amountSeconds: amount,
        expiresAt: draw.expiresAt,
        idempotencyKey: `refund:${reservation.id}:monthly:${draw.expiresAt?.toISOString() ?? "none"}`,
      },
    });
    remaining -= amount;
    if (remaining <= 0) {
      return;
    }
  }
}

async function releaseReservation(db: Db, reservation: Reservation, reason: string): Promise<void> {
  const updated = await db.creditReservation.updateMany({
    where: { id: reservation.id, status: "RESERVED" },
    data: { status: "RELEASED", capturedSeconds: 0, settledAt: new Date() },
  });
  if (updated.count === 0) {
    return;
  }
  await writeRefund(db, { reservation, refundSeconds: reservation.reservedSeconds, reason });
}

/** Full refund for reservations whose job failed, was cancelled, or no longer exists. */
export async function releaseInactiveReservations(userId: string): Promise<void> {
  const stale = await prisma.creditReservation.findMany({
    where: {
      userId,
      status: "RESERVED",
      OR: [{ jobId: null }, { job: { status: { in: ["FAILED", "CANCELLED"] } } }],
    },
  });
  for (const reservation of stale) {
    await prisma.$transaction((tx) => releaseReservation(tx, reservation, "job_inactive"));
  }
}

/** Reads the balance after granting the current period and releasing dead reservations. */
export async function getPremiumBalance(
  userId: string,
  now = new Date(),
): Promise<{ state: UserPlanState; balance: PremiumBalance }> {
  const state = await getUserPlanState(userId, now);
  await ensureMonthlyGrant(userId, state);
  await releaseInactiveReservations(userId);
  return { state, balance: await readBalance(prisma, userId, now) };
}

function shortfallMessage(neededSeconds: number, availableSeconds: number): string {
  const needed = estimatedMinutes(neededSeconds);
  const left = remainingMinutes(availableSeconds);
  return `This needs about ${needed} premium minute${needed === 1 ? "" : "s"} and you have ${left} left. Buy more minutes, choose a standard voice, or narrate fewer chapters.`;
}

export async function assertPremiumBalance(userId: string, neededSeconds: number): Promise<void> {
  const { balance } = await getPremiumBalance(userId);
  if (neededSeconds > balance.availableSeconds) {
    throw ttsPremiumQuotaExceeded(shortfallMessage(neededSeconds, balance.availableSeconds));
  }
}

/**
 * Must run inside the transaction that creates the job. Locking the user
 * row serializes concurrent reservations for the same account.
 */
export async function reserveCredits(
  tx: Db,
  input: { userId: string; jobId: string; seconds: number; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();
  await lockUser(tx, input.userId);
  const [lots, purchasedAvailable] = await Promise.all([
    readMonthlyLots(tx, input.userId, now),
    readPurchasedSeconds(tx, input.userId),
  ]);
  const monthlyAvailable = lots.reduce((sum, lot) => sum + lot.seconds, 0);
  if (input.seconds > monthlyAvailable + purchasedAvailable) {
    throw ttsPremiumQuotaExceeded(shortfallMessage(input.seconds, monthlyAvailable + purchasedAvailable));
  }

  let remaining = input.seconds;
  const draws: MonthlyLot[] = [];
  for (const lot of lots) {
    const take = Math.min(remaining, lot.seconds);
    if (take > 0) {
      draws.push({ expiresAt: lot.expiresAt, seconds: take });
      remaining -= take;
    }
  }
  const purchasedSeconds = remaining;

  const reservation = await tx.creditReservation.create({
    data: {
      userId: input.userId,
      jobId: input.jobId,
      reservedSeconds: input.seconds,
      monthlySeconds: input.seconds - purchasedSeconds,
      purchasedSeconds,
      monthlyExpiresAt: draws.at(-1)?.expiresAt ?? null,
    },
  });
  const base = {
    userId: input.userId,
    type: "GENERATION_RESERVE" as const,
    referenceType: "reservation",
    referenceId: reservation.id,
    metadata: { jobId: input.jobId },
  };
  for (const draw of draws) {
    await tx.creditLedger.create({
      data: {
        ...base,
        bucket: "MONTHLY",
        amountSeconds: -draw.seconds,
        expiresAt: draw.expiresAt,
        idempotencyKey: `reserve:${reservation.id}:monthly:${draw.expiresAt.toISOString()}`,
      },
    });
  }
  if (purchasedSeconds > 0) {
    await tx.creditLedger.create({
      data: {
        ...base,
        bucket: "PURCHASED",
        amountSeconds: -purchasedSeconds,
        idempotencyKey: `reserve:${reservation.id}:purchased`,
      },
    });
  }
}

/** Charges the actual usage (capped at the reservation) and refunds the rest. */
export async function captureReservation(
  tx: Db,
  input: { jobId: string; billableSeconds: number },
): Promise<void> {
  const reservation = await tx.creditReservation.findUnique({ where: { jobId: input.jobId } });
  if (!reservation || reservation.status !== "RESERVED") {
    return;
  }
  const captured = Math.min(Math.max(0, input.billableSeconds), reservation.reservedSeconds);
  if (input.billableSeconds > reservation.reservedSeconds) {
    console.warn("premium_usage_exceeded_reservation", {
      jobId: input.jobId,
      reservedSeconds: reservation.reservedSeconds,
      billableSeconds: input.billableSeconds,
    });
  }
  const updated = await tx.creditReservation.updateMany({
    where: { id: reservation.id, status: "RESERVED" },
    data: { status: "CAPTURED", capturedSeconds: captured, settledAt: new Date() },
  });
  if (updated.count === 0) {
    return;
  }
  const refundSeconds = reservation.reservedSeconds - captured;
  if (refundSeconds > 0) {
    await writeRefund(tx, { reservation, refundSeconds, reason: "unused" });
  }
}

async function lockUser(tx: Db, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM \`User\` WHERE id = ${userId} FOR UPDATE`;
}

async function hasLedgerEntry(tx: Db, idempotencyKey: string): Promise<boolean> {
  return (await tx.creditLedger.findUnique({ where: { idempotencyKey }, select: { id: true } })) !== null;
}

/** Adds a paid minute pack; a repeated order is a no-op. */
export async function grantPurchasedSeconds(
  tx: Db,
  input: { userId: string; orderId: string; seconds: number; metadata: Prisma.InputJsonObject },
): Promise<void> {
  const idempotencyKey = `purchase:${input.orderId}`;
  if (input.seconds <= 0 || (await hasLedgerEntry(tx, idempotencyKey))) {
    return;
  }
  await tx.creditLedger.create({
    data: {
      userId: input.userId,
      type: "PURCHASE",
      bucket: "PURCHASED",
      amountSeconds: input.seconds,
      referenceType: "billing_order",
      referenceId: input.orderId,
      idempotencyKey,
      metadata: input.metadata,
    },
  });
}

type ReversalInput = {
  userId: string;
  orderId: string;
  /** Unique per refund, so a refund is reversed at most once. */
  idempotencyKey: string;
  seconds: number;
};

/** Takes back refunded pack minutes that have not been spent. Returns the seconds removed. */
export async function reversePurchasedSeconds(tx: Db, input: ReversalInput): Promise<number> {
  if (input.seconds <= 0 || (await hasLedgerEntry(tx, input.idempotencyKey))) {
    return 0;
  }
  await lockUser(tx, input.userId);
  const amount = Math.min(input.seconds, await readPurchasedSeconds(tx, input.userId));
  if (amount <= 0) {
    return 0;
  }
  await tx.creditLedger.create({
    data: {
      userId: input.userId,
      type: "PURCHASE_REVERSAL",
      bucket: "PURCHASED",
      amountSeconds: -amount,
      referenceType: "billing_order",
      referenceId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      metadata: { requestedSeconds: input.seconds },
    },
  });
  return amount;
}

/**
 * Takes back a share of the subscription's latest monthly grant, capped at
 * what is left in that grant's lot. Returns the seconds removed.
 */
export async function reverseMonthlyGrant(
  tx: Db,
  input: Omit<ReversalInput, "seconds"> & { subscriptionId: string; fraction: number; now?: Date },
): Promise<number> {
  if (await hasLedgerEntry(tx, input.idempotencyKey)) {
    return 0;
  }
  const grant = await tx.creditLedger.findFirst({
    where: {
      userId: input.userId,
      type: "MONTHLY_GRANT",
      referenceType: "subscription",
      referenceId: input.subscriptionId,
    },
    orderBy: { createdAt: "desc" },
    select: { amountSeconds: true, expiresAt: true },
  });
  if (!grant?.expiresAt || grant.expiresAt <= (input.now ?? new Date())) {
    return 0;
  }
  await lockUser(tx, input.userId);
  const lot = await tx.creditLedger.aggregate({
    where: { userId: input.userId, bucket: "MONTHLY", expiresAt: grant.expiresAt },
    _sum: { amountSeconds: true },
  });
  const wanted = Math.ceil(grant.amountSeconds * Math.min(1, Math.max(0, input.fraction)));
  const amount = Math.min(wanted, Math.max(0, lot._sum.amountSeconds ?? 0));
  if (amount <= 0) {
    return 0;
  }
  await tx.creditLedger.create({
    data: {
      userId: input.userId,
      type: "PURCHASE_REVERSAL",
      bucket: "MONTHLY",
      amountSeconds: -amount,
      expiresAt: grant.expiresAt,
      referenceType: "billing_order",
      referenceId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      metadata: { requestedSeconds: wanted, subscriptionId: input.subscriptionId },
    },
  });
  return amount;
}

export async function releaseReservationForJob(tx: Db, jobId: string, reason: string): Promise<void> {
  const reservation = await tx.creditReservation.findUnique({ where: { jobId } });
  if (reservation) {
    await releaseReservation(tx, reservation, reason);
  }
}
