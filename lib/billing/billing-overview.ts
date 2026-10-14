import type { CreditEntryType, SubscriptionStatus } from "@/generated/prisma";
import { MINUTE_PACKS, minutePackPrice, type MinutePackId } from "@/lib/billing/credit-packs";
import { getPlan } from "@/lib/billing/plans";
import { getUsageSummary, type UsageSummary } from "@/lib/billing/usage-summary";
import { prisma } from "@/lib/db/prisma";

const ACTIVITY_TYPES: CreditEntryType[] = [
  "MONTHLY_GRANT",
  "PURCHASE",
  "PURCHASE_REVERSAL",
  "PROMOTION",
  "ADMIN_ADJUSTMENT",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BillingPack = {
  id: MinutePackId;
  name: string;
  minutes: number;
  description: string;
  priceUsd: number;
  regularPriceUsd: number;
  creatorPriceUsd: number;
};

export type BillingActivity = {
  id: string;
  label: string;
  seconds: number;
  createdAt: string;
};

export type ReturnedOrder = {
  id: string;
  status: "PENDING" | "PAID" | "REFUNDED";
  kind: "SUBSCRIPTION" | "MINUTE_PACK";
  itemId: string;
  amountUsd: number;
  premiumSeconds: number;
};

export type BillingOverview = {
  usage: UsageSummary;
  subscription: {
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    /** Managed in the payment provider's portal (not a manual/test grant). */
    managedByProvider: boolean;
  } | null;
  hasPaidOrders: boolean;
  packs: BillingPack[];
  activity: BillingActivity[];
  returnedOrder: ReturnedOrder | null;
};

function activityLabel(type: CreditEntryType, metadata: unknown): string {
  const itemId =
    metadata && typeof metadata === "object" && "itemId" in metadata
      ? String((metadata as { itemId: unknown }).itemId)
      : null;
  switch (type) {
    case "MONTHLY_GRANT":
      return "Creator monthly minutes";
    case "PURCHASE": {
      const pack = MINUTE_PACKS.find((candidate) => candidate.id === itemId);
      return pack ? `${pack.name} pack` : "Minutes added";
    }
    case "PURCHASE_REVERSAL":
      return "Refund";
    case "PROMOTION":
      return "Bonus minutes";
    default:
      return "Adjustment";
  }
}

async function findReturnedOrder(userId: string, orderId?: string): Promise<ReturnedOrder | null> {
  if (!orderId || !UUID.test(orderId)) {
    return null;
  }
  const order = await prisma.billingOrder.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true, kind: true, itemId: true, amountUsd: true, premiumSeconds: true },
  });
  return order ? { ...order, amountUsd: Number(order.amountUsd) } : null;
}

export async function getBillingOverview(userId: string, orderId?: string): Promise<BillingOverview> {
  const usage = await getUsageSummary(userId);
  const [subscription, paidOrders, entries, returnedOrder] = await Promise.all([
    usage.plan.id === "free"
      ? null
      : prisma.subscription.findFirst({
          where: { userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } },
          orderBy: { currentPeriodEnd: "desc" },
        }),
    prisma.billingOrder.count({ where: { userId, status: { in: ["PAID", "REFUNDED"] } } }),
    prisma.creditLedger.findMany({
      where: { userId, type: { in: ACTIVITY_TYPES } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, amountSeconds: true, metadata: true, createdAt: true },
    }),
    findReturnedOrder(userId, orderId),
  ]);
  const plan = getPlan(usage.plan.id);
  return {
    usage,
    subscription: subscription
      ? {
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          managedByProvider: subscription.provider !== "manual",
        }
      : null,
    hasPaidOrders: paidOrders > 0,
    packs: MINUTE_PACKS.map((pack) => ({
      id: pack.id,
      name: pack.name,
      minutes: pack.minutes,
      description: pack.description,
      priceUsd: minutePackPrice(pack, plan),
      regularPriceUsd: pack.priceUsd,
      creatorPriceUsd: pack.creatorPriceUsd,
    })),
    activity: entries.map((entry) => ({
      id: entry.id,
      label: activityLabel(entry.type, entry.metadata),
      seconds: entry.amountSeconds,
      createdAt: entry.createdAt.toISOString(),
    })),
    returnedOrder,
  };
}
