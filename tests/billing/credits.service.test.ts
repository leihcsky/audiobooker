import { beforeEach, describe, expect, it, vi } from "vitest";

type Entry = {
  userId: string;
  type: string;
  bucket: "MONTHLY" | "PURCHASED";
  amountSeconds: number;
  expiresAt: Date | null;
  referenceType: string | null;
  referenceId: string | null;
  idempotencyKey: string | null;
};

type Reservation = {
  id: string;
  userId: string;
  jobId: string | null;
  status: "RESERVED" | "CAPTURED" | "RELEASED";
  reservedSeconds: number;
  capturedSeconds: number;
  monthlySeconds: number;
  purchasedSeconds: number;
  monthlyExpiresAt: Date | null;
};

const store = vi.hoisted(() => ({
  ledger: [] as Entry[],
  reservations: [] as Reservation[],
  jobStatus: new Map<string, string>(),
  locks: 0,
}));

const db = vi.hoisted(() => {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  type LedgerWhere = {
    userId: string;
    bucket?: string;
    type?: string;
    expiresAt?: { gt: Date };
    referenceType?: string;
    referenceId?: string;
  };
  const matches = (entry: Entry, where: LedgerWhere) =>
    entry.userId === where.userId &&
    (!where.bucket || entry.bucket === where.bucket) &&
    (!where.type || entry.type === where.type) &&
    (!where.referenceType || entry.referenceType === where.referenceType) &&
    (!where.referenceId || entry.referenceId === where.referenceId) &&
    (!where.expiresAt || (entry.expiresAt !== null && entry.expiresAt > where.expiresAt.gt));
  const byExpiryDesc = (a: Entry, b: Entry) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0);

  const client = {
    $queryRaw: async () => {
      store.locks += 1;
      return [];
    },
    creditLedger: {
      aggregate: async ({ where }: { where: LedgerWhere }) => ({
        _sum: { amountSeconds: sum(store.ledger.filter((e) => matches(e, where)).map((e) => e.amountSeconds)) },
      }),
      groupBy: async ({ where }: { where: LedgerWhere }) => {
        const groups = new Map<number, { expiresAt: Date; total: number }>();
        for (const entry of store.ledger.filter((e) => matches(e, where))) {
          const key = entry.expiresAt?.getTime() ?? 0;
          const group = groups.get(key) ?? { expiresAt: entry.expiresAt as Date, total: 0 };
          group.total += entry.amountSeconds;
          groups.set(key, group);
        }
        return [...groups.values()]
          .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
          .map((group) => ({ expiresAt: group.expiresAt, _sum: { amountSeconds: group.total } }));
      },
      findFirst: async ({ where }: { where: LedgerWhere }) =>
        store.ledger.filter((e) => matches(e, where)).sort(byExpiryDesc)[0] ?? null,
      findMany: async ({ where }: { where: LedgerWhere }) =>
        store.ledger.filter((e) => matches(e, where)).sort(byExpiryDesc),
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        store.ledger.find((e) => e.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data }: { data: Partial<Entry> & { userId: string } }) => {
        if (data.idempotencyKey && store.ledger.some((e) => e.idempotencyKey === data.idempotencyKey)) {
          throw new Error("duplicate idempotency key");
        }
        const entry = {
          expiresAt: null,
          referenceType: null,
          referenceId: null,
          idempotencyKey: null,
          ...data,
        } as Entry;
        store.ledger.push(entry);
        return entry;
      },
    },
    creditReservation: {
      aggregate: async ({ where }: { where: { userId: string; status: string } }) => ({
        _sum: {
          reservedSeconds: sum(
            store.reservations
              .filter((r) => r.userId === where.userId && r.status === where.status)
              .map((r) => r.reservedSeconds),
          ),
        },
      }),
      create: async ({ data }: { data: Omit<Reservation, "id" | "status" | "capturedSeconds"> }) => {
        const reservation: Reservation = {
          ...data,
          id: `res-${store.reservations.length + 1}`,
          status: "RESERVED",
          capturedSeconds: 0,
        };
        store.reservations.push(reservation);
        return reservation;
      },
      findUnique: async ({ where }: { where: { jobId: string } }) =>
        store.reservations.find((r) => r.jobId === where.jobId) ?? null,
      findMany: async ({ where }: { where: { userId: string } }) =>
        store.reservations.filter(
          (r) =>
            r.userId === where.userId &&
            r.status === "RESERVED" &&
            (r.jobId === null || ["FAILED", "CANCELLED"].includes(store.jobStatus.get(r.jobId) ?? "")),
        ),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: Partial<Reservation>;
      }) => {
        const target = store.reservations.find((r) => r.id === where.id && r.status === where.status);
        if (!target) {
          return { count: 0 };
        }
        Object.assign(target, data);
        return { count: 1 };
      },
    },
  };
  return {
    ...client,
    $transaction: async (run: (tx: typeof client) => Promise<unknown>) => run(client),
  };
});

const getUserPlanState = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing/entitlements", () => ({ getUserPlanState }));

import type { Prisma } from "@/generated/prisma";
import { PLANS } from "@/lib/billing/plans";
import {
  assertPremiumBalance,
  captureReservation,
  ensureMonthlyGrant,
  getPremiumBalance,
  monthlyGrantExpiry,
  releaseReservationForJob,
  reserveCredits,
} from "@/lib/billing/credits.service";

const tx = db as unknown as Prisma.TransactionClient;
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY = 24 * 60 * 60 * 1000;
const periodStart = new Date("2099-10-01T00:00:00.000Z");
const periodEnd = new Date("2099-10-31T00:00:00.000Z");
const rolloverEnd = new Date(periodEnd.getTime() + 30 * DAY);
const creatorState = {
  plan: PLANS.creator,
  subscriptionId: "sub-1",
  period: { start: periodStart, end: periodEnd },
};
const freeState = { plan: PLANS.free, subscriptionId: null, period: null };

function purchase(seconds: number) {
  store.ledger.push({
    userId,
    type: "PURCHASE",
    bucket: "PURCHASED",
    amountSeconds: seconds,
    expiresAt: null,
    referenceType: "purchase",
    referenceId: `p-${seconds}`,
    idempotencyKey: `purchase:${seconds}`,
  });
}

function monthlyGrant(seconds: number, expiresAt: Date, key: string) {
  store.ledger.push({
    userId,
    type: "MONTHLY_GRANT",
    bucket: "MONTHLY",
    amountSeconds: seconds,
    expiresAt,
    referenceType: "subscription",
    referenceId: "sub-1",
    idempotencyKey: key,
  });
}

async function balance() {
  return (await getPremiumBalance(userId)).balance;
}

describe("credits.service", () => {
  beforeEach(() => {
    store.ledger = [];
    store.reservations = [];
    store.jobStatus = new Map();
    store.locks = 0;
    getUserPlanState.mockResolvedValue(creatorState);
  });

  it("rolls monthly minutes over for one extra billing period", () => {
    expect(monthlyGrantExpiry({ start: periodStart, end: periodEnd })).toEqual(rolloverEnd);
  });

  it("grants the Creator period once, however often the balance is read", async () => {
    await ensureMonthlyGrant(userId, creatorState);
    await ensureMonthlyGrant(userId, creatorState);
    const current = await balance();

    const grants = store.ledger.filter((e) => e.type === "MONTHLY_GRANT");
    expect(grants).toHaveLength(1);
    expect(grants[0].expiresAt).toEqual(rolloverEnd);
    expect(current).toMatchObject({
      availableSeconds: PLANS.creator.premiumSecondsPerPeriod,
      monthlySeconds: PLANS.creator.premiumSecondsPerPeriod,
      monthlyGrantSeconds: PLANS.creator.premiumSecondsPerPeriod,
      monthlyExpiresAt: rolloverEnd,
    });
  });

  it("lets Free accounts spend purchased minutes", async () => {
    getUserPlanState.mockResolvedValue(freeState);
    purchase(600);
    expect(await balance()).toMatchObject({ availableSeconds: 600, monthlySeconds: 0, purchasedSeconds: 600 });

    await reserveCredits(tx, { userId, jobId: "job-1", seconds: 200 });
    expect(store.reservations[0]).toMatchObject({ monthlySeconds: 0, purchasedSeconds: 200 });
  });

  it("keeps rolled-over minutes after the subscription ends, until they expire", async () => {
    getUserPlanState.mockResolvedValue(freeState);
    monthlyGrant(3600, new Date("2099-12-01T00:00:00.000Z"), "monthly:live");
    monthlyGrant(3600, new Date("2020-01-01T00:00:00.000Z"), "monthly:old");
    expect((await balance()).availableSeconds).toBe(3600);
  });

  it("spends the soonest-expiring monthly lot first, then later lots, then purchased", async () => {
    const soon = new Date("2099-11-01T00:00:00.000Z");
    const later = new Date("2099-12-01T00:00:00.000Z");
    monthlyGrant(600, soon, "monthly:a");
    monthlyGrant(3600, later, "monthly:b");
    purchase(1000);

    await reserveCredits(tx, { userId, jobId: "job-1", seconds: 4500 });

    expect(store.locks).toBe(1);
    expect(store.reservations[0]).toMatchObject({
      reservedSeconds: 4500,
      monthlySeconds: 4200,
      purchasedSeconds: 300,
      monthlyExpiresAt: later,
    });
    const reserves = store.ledger.filter((e) => e.type === "GENERATION_RESERVE");
    expect(reserves.map((e) => [e.bucket, e.amountSeconds, e.expiresAt])).toEqual([
      ["MONTHLY", -600, soon],
      ["MONTHLY", -3600, later],
      ["PURCHASED", -300, null],
    ]);
    getUserPlanState.mockResolvedValue(freeState);
    expect(await balance()).toMatchObject({ monthlySeconds: 0, purchasedSeconds: 700, reservedSeconds: 4500 });
  });

  it("refuses a reservation larger than the balance", async () => {
    await ensureMonthlyGrant(userId, creatorState);
    await expect(reserveCredits(tx, { userId, jobId: "job-1", seconds: 3601 })).rejects.toMatchObject({
      code: "TTS_PREMIUM_QUOTA_EXCEEDED",
    });
    expect(store.reservations).toHaveLength(0);
  });

  it("refunds unused minutes to purchased first, then to the latest monthly lot drawn from", async () => {
    const soon = new Date("2099-11-01T00:00:00.000Z");
    const later = new Date("2099-12-01T00:00:00.000Z");
    monthlyGrant(600, soon, "monthly:a");
    monthlyGrant(3600, later, "monthly:b");
    purchase(1000);
    await reserveCredits(tx, { userId, jobId: "job-1", seconds: 4500 });

    await captureReservation(tx, { jobId: "job-1", billableSeconds: 3000 });

    expect(store.reservations[0]).toMatchObject({ status: "CAPTURED", capturedSeconds: 3000 });
    const refunds = store.ledger.filter((e) => e.type === "GENERATION_REFUND");
    expect(refunds.map((e) => [e.bucket, e.amountSeconds, e.expiresAt])).toEqual([
      ["PURCHASED", 300, null],
      ["MONTHLY", 1200, later],
    ]);
    getUserPlanState.mockResolvedValue(freeState);
    expect(await balance()).toMatchObject({ monthlySeconds: 1200, purchasedSeconds: 1000, reservedSeconds: 0 });
  });

  it("returns a full refund to every lot it came from, never more than was drawn", async () => {
    const soon = new Date("2099-11-01T00:00:00.000Z");
    const later = new Date("2099-12-01T00:00:00.000Z");
    monthlyGrant(600, soon, "monthly:a");
    monthlyGrant(3600, later, "monthly:b");
    await reserveCredits(tx, { userId, jobId: "job-1", seconds: 1000 });

    await releaseReservationForJob(tx, "job-1", "job_failed");

    const refunds = store.ledger.filter((e) => e.type === "GENERATION_REFUND");
    expect(refunds.map((e) => [e.amountSeconds, e.expiresAt])).toEqual([
      [400, later],
      [600, soon],
    ]);
  });

  it("never captures more than was reserved", async () => {
    await ensureMonthlyGrant(userId, creatorState);
    await reserveCredits(tx, { userId, jobId: "job-1", seconds: 100 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await captureReservation(tx, { jobId: "job-1", billableSeconds: 150 });

    warn.mockRestore();
    expect(store.reservations[0].capturedSeconds).toBe(100);
    expect((await balance()).availableSeconds).toBe(3500);
  });

  it("refunds everything when the job fails, and only once", async () => {
    await ensureMonthlyGrant(userId, creatorState);
    await reserveCredits(tx, { userId, jobId: "job-1", seconds: 500 });

    await releaseReservationForJob(tx, "job-1", "job_failed");
    await releaseReservationForJob(tx, "job-1", "job_failed");
    await captureReservation(tx, { jobId: "job-1", billableSeconds: 500 });

    expect(store.reservations[0].status).toBe("RELEASED");
    expect((await balance()).availableSeconds).toBe(3600);
  });

  it("releases reservations of cancelled or deleted jobs when the balance is read", async () => {
    await ensureMonthlyGrant(userId, creatorState);
    await reserveCredits(tx, { userId, jobId: "job-1", seconds: 300 });
    await reserveCredits(tx, { userId, jobId: "job-2", seconds: 200 });
    await reserveCredits(tx, { userId, jobId: "job-3", seconds: 100 });
    store.jobStatus.set("job-1", "CANCELLED");
    store.jobStatus.set("job-2", "PROCESSING");
    store.reservations[2].jobId = null;

    expect(await balance()).toMatchObject({ availableSeconds: 3400, reservedSeconds: 200 });
  });

  it("explains a shortfall in minutes and points to buying more", async () => {
    await ensureMonthlyGrant(userId, creatorState);
    await expect(assertPremiumBalance(userId, 3700)).rejects.toMatchObject({
      code: "TTS_PREMIUM_QUOTA_EXCEEDED",
      message: expect.stringMatching(/about 62 premium minutes and you have 60 left\. Buy more minutes/),
    });
  });
});
