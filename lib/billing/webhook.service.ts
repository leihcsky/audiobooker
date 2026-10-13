import { Prisma, type BillingOrder } from "@/generated/prisma";
import { invalidWebhookSignature } from "@/lib/api/errors";
import {
  grantPurchasedSeconds,
  reverseMonthlyGrant,
  reversePurchasedSeconds,
} from "@/lib/billing/credits.service";
import { BillingSignatureError, type BillingWebhookEvent } from "@/lib/billing/provider";
import { getBillingProvider } from "@/lib/billing/providers";
import { prisma } from "@/lib/db/prisma";

type Db = Prisma.TransactionClient;

type Outcome = { outcome: "PROCESSED" | "IGNORED"; note: string | null };

const PROCESSED: Outcome = { outcome: "PROCESSED", note: null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ignored(note: string): Outcome {
  return { outcome: "IGNORED", note };
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

async function findOrder(
  tx: Db,
  provider: string,
  event: BillingWebhookEvent,
): Promise<BillingOrder | null> {
  if (event.reference && UUID.test(event.reference)) {
    const order = await tx.billingOrder.findUnique({ where: { id: event.reference } });
    if (order && order.provider === provider) {
      return order;
    }
  }
  if (!event.orderId) {
    return null;
  }
  return tx.billingOrder.findUnique({
    where: { provider_providerOrderId: { provider, providerOrderId: event.orderId } },
  });
}

async function markPaid(tx: Db, order: BillingOrder, providerOrderId: string | null): Promise<void> {
  await tx.billingOrder.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      providerOrderId: order.providerOrderId ?? providerOrderId,
    },
  });
}

async function findSubscription(tx: Db, provider: string, subscriptionId: string | null) {
  if (!subscriptionId) {
    return null;
  }
  return tx.subscription.findUnique({
    where: { provider_subscriptionId: { provider, subscriptionId } },
  });
}

async function applyPackPaid(tx: Db, order: BillingOrder, event: BillingWebhookEvent): Promise<Outcome> {
  if (order.kind !== "MINUTE_PACK") {
    return ignored("not_a_minute_pack");
  }
  if (order.status !== "PENDING") {
    return ignored(`order_${order.status.toLowerCase()}`);
  }
  await markPaid(tx, order, event.orderId);
  await grantPurchasedSeconds(tx, {
    userId: order.userId,
    orderId: order.id,
    seconds: order.premiumSeconds,
    metadata: { itemId: order.itemId, providerOrderId: event.orderId },
  });
  return PROCESSED;
}

async function applySubscriptionActive(
  tx: Db,
  provider: string,
  order: BillingOrder,
  event: BillingWebhookEvent,
): Promise<Outcome> {
  if (order.kind !== "SUBSCRIPTION" || !event.orderId) {
    return ignored("not_a_subscription");
  }
  if (order.status === "PENDING") {
    await markPaid(tx, order, event.orderId);
  }
  const existing = await findSubscription(tx, provider, event.orderId);
  if (!existing) {
    const start = event.period?.start ?? new Date();
    await tx.subscription.create({
      data: {
        userId: order.userId,
        provider,
        subscriptionId: event.orderId,
        planId: order.itemId,
        status: "ACTIVE",
        currentPeriodStart: start,
        currentPeriodEnd: event.period?.end ?? addMonths(start, 1),
        cancelAtPeriodEnd: false,
      },
    });
    return PROCESSED;
  }
  const newerPeriod =
    event.period &&
    (!existing.currentPeriodStart || event.period.start >= existing.currentPeriodStart);
  await tx.subscription.update({
    where: { id: existing.id },
    data: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      ...(newerPeriod && event.period
        ? { currentPeriodStart: event.period.start, currentPeriodEnd: event.period.end }
        : {}),
    },
  });
  return PROCESSED;
}

async function applySubscriptionStatus(
  tx: Db,
  provider: string,
  event: BillingWebhookEvent,
): Promise<Outcome> {
  const subscription = await findSubscription(tx, provider, event.orderId);
  if (!subscription) {
    return ignored("unknown_subscription");
  }
  if (subscription.status === "CANCELLED" && event.kind !== "subscription.canceled") {
    return ignored("subscription_cancelled");
  }
  const data: Prisma.SubscriptionUpdateInput =
    event.kind === "subscription.canceling"
      ? { cancelAtPeriodEnd: true }
      : event.kind === "subscription.uncanceled"
        ? { cancelAtPeriodEnd: false }
        : event.kind === "subscription.canceled"
          ? { status: "CANCELLED", cancelAtPeriodEnd: false }
          : { status: "PAST_DUE" };
  await tx.subscription.update({ where: { id: subscription.id }, data });
  return PROCESSED;
}

async function applyRefund(
  tx: Db,
  provider: string,
  order: BillingOrder,
  event: BillingWebhookEvent,
): Promise<Outcome> {
  const idempotencyKey = `reversal:${provider}:${event.businessEventId ?? event.deliveryId}`;
  const fraction = event.refundFraction ?? 1;
  if (order.kind === "MINUTE_PACK") {
    await reversePurchasedSeconds(tx, {
      userId: order.userId,
      orderId: order.id,
      idempotencyKey,
      seconds: Math.ceil(order.premiumSeconds * fraction),
    });
    await tx.billingOrder.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
    return PROCESSED;
  }
  const subscription = await findSubscription(tx, provider, order.providerOrderId ?? event.orderId);
  if (!subscription) {
    return ignored("unknown_subscription");
  }
  await reverseMonthlyGrant(tx, {
    userId: order.userId,
    orderId: order.id,
    idempotencyKey,
    subscriptionId: subscription.id,
    fraction,
  });
  return PROCESSED;
}

async function applyEvent(tx: Db, provider: string, event: BillingWebhookEvent): Promise<Outcome> {
  if (event.ignoreReason) {
    return ignored(event.ignoreReason);
  }
  if (event.kind === "other") {
    return ignored("unhandled_event");
  }
  if (
    event.kind === "subscription.canceling" ||
    event.kind === "subscription.uncanceled" ||
    event.kind === "subscription.canceled" ||
    event.kind === "subscription.past_due"
  ) {
    return applySubscriptionStatus(tx, provider, event);
  }
  const order = await findOrder(tx, provider, event);
  if (!order) {
    return ignored("unknown_order");
  }
  if (event.buyerIdentity && event.buyerIdentity !== order.userId) {
    return ignored("buyer_mismatch");
  }
  if (order.providerOrderId && event.orderId && order.providerOrderId !== event.orderId) {
    return ignored("order_mismatch");
  }
  switch (event.kind) {
    case "one_time.paid":
      return applyPackPaid(tx, order, event);
    case "subscription.activated":
    case "subscription.renewed":
    case "subscription.recovered":
      return applySubscriptionActive(tx, provider, order, event);
    case "refund.succeeded":
      return applyRefund(tx, provider, order, event);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Verifies, de-duplicates, and applies one webhook delivery. The event row
 * is inserted first so a concurrent copy of the same delivery waits on the
 * unique key and then resolves as a duplicate.
 */
export async function handleBillingWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ duplicate: boolean }> {
  const provider = getBillingProvider();
  let event: BillingWebhookEvent;
  try {
    event = provider.parseWebhook(rawBody, signature);
  } catch (error) {
    if (error instanceof BillingSignatureError) {
      throw invalidWebhookSignature();
    }
    throw error;
  }

  const seen = await prisma.billingEvent.findUnique({
    where: { provider_providerEventId: { provider: provider.id, providerEventId: event.deliveryId } },
    select: { id: true },
  });
  if (seen) {
    return { duplicate: true };
  }

  let result: Outcome;
  try {
    result = await prisma.$transaction(async (tx) => {
      const record = await tx.billingEvent.create({
        data: {
          provider: provider.id,
          providerEventId: event.deliveryId,
          eventType: event.type.slice(0, 100),
          businessEventId: event.businessEventId,
          providerOrderId: event.orderId,
          outcome: "PROCESSED",
          payloadHash: event.payloadHash,
        },
      });
      const outcome = await applyEvent(tx, provider.id, event);
      if (outcome.outcome !== "PROCESSED") {
        await tx.billingEvent.update({
          where: { id: record.id },
          data: { outcome: outcome.outcome, note: outcome.note },
        });
      }
      return outcome;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { duplicate: true };
    }
    throw error;
  }

  console.info("billing_webhook", {
    provider: provider.id,
    type: event.type,
    orderId: event.orderId,
    outcome: result.outcome,
    note: result.note,
  });
  return { duplicate: false };
}
