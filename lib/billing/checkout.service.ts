import { billingUnavailable, checkoutRateLimited, conflict } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { MINUTE_PACKS, minutePackPrice } from "@/lib/billing/credit-packs";
import { getUserPlanState } from "@/lib/billing/entitlements";
import { PLANS } from "@/lib/billing/plans";
import type { BillingItemId } from "@/lib/billing/provider";
import { getBillingProvider } from "@/lib/billing/providers";
import { prisma } from "@/lib/db/prisma";
import { getSiteUrl } from "@/lib/tools/site";

const CHECKOUT_EXPIRY_SECONDS = 60 * 60;
const MAX_CHECKOUTS_PER_HOUR = 10;

type OrderPlan = {
  kind: "SUBSCRIPTION" | "MINUTE_PACK";
  creatorPrice: boolean;
  amountUsd: number;
  premiumSeconds: number;
};

async function planOrder(userId: string, item: BillingItemId): Promise<OrderPlan> {
  const { plan } = await getUserPlanState(userId);
  if (item === "creator") {
    if (plan.id === "creator") {
      throw conflict("You're already on Creator. Manage your plan from Billing.");
    }
    return {
      kind: "SUBSCRIPTION",
      creatorPrice: false,
      amountUsd: PLANS.creator.monthlyPriceUsd,
      premiumSeconds: 0,
    };
  }
  const pack = MINUTE_PACKS.find((candidate) => candidate.id === item);
  if (!pack) {
    throw billingUnavailable();
  }
  return {
    kind: "MINUTE_PACK",
    creatorPrice: plan.discountedMinutePacks,
    amountUsd: minutePackPrice(pack, plan),
    premiumSeconds: pack.minutes * 60,
  };
}

export async function createCheckout(
  user: SessionUser,
  item: BillingItemId,
): Promise<{ checkoutUrl: string }> {
  const provider = getBillingProvider();
  if (!provider.isConfigured()) {
    throw billingUnavailable();
  }
  const recent = await prisma.billingOrder.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_CHECKOUTS_PER_HOUR) {
    throw checkoutRateLimited();
  }
  const planned = await planOrder(user.id, item);
  const productId = provider.productIdFor(item, planned.creatorPrice);
  if (!productId) {
    console.error("billing_product_missing", { provider: provider.id, item, creatorPrice: planned.creatorPrice });
    throw billingUnavailable();
  }
  const order = await prisma.billingOrder.create({
    data: {
      userId: user.id,
      provider: provider.id,
      kind: planned.kind,
      itemId: item,
      creatorPrice: planned.creatorPrice,
      productId,
      amountUsd: planned.amountUsd,
      premiumSeconds: planned.premiumSeconds,
    },
  });
  try {
    const session = await provider.createCheckout({
      item,
      productId,
      userId: user.id,
      email: user.email ?? null,
      reference: order.id,
      successUrl: `${getSiteUrl()}/studio/billing?order=${order.id}`,
      expiresInSeconds: CHECKOUT_EXPIRY_SECONDS,
    });
    await prisma.billingOrder.update({
      where: { id: order.id },
      data: { checkoutSessionId: session.sessionId },
    });
    return { checkoutUrl: session.checkoutUrl };
  } catch (error) {
    console.error("billing_checkout_failed", {
      provider: provider.id,
      item,
      orderId: order.id,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw billingUnavailable();
  }
}

export async function createCustomerPortalUrl(userId: string): Promise<string> {
  const provider = getBillingProvider();
  if (!provider.isConfigured()) {
    throw billingUnavailable();
  }
  return (await provider.createCustomerPortal({ userId })).url;
}
