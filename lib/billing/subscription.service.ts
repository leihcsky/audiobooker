import type { SubscriptionStatus } from "@/generated/prisma";
import { billingUnavailable, conflict } from "@/lib/api/errors";
import { getBillingProvider } from "@/lib/billing/providers";
import { prisma } from "@/lib/db/prisma";

export type ManagedSubscriptionState = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  status: SubscriptionStatus;
};

const MANAGEABLE: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

async function findManagedSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      provider: { not: "manual" },
      status: { in: MANAGEABLE },
      subscriptionId: { not: null },
    },
    orderBy: { currentPeriodEnd: "desc" },
  });
}

function toState(row: {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}): ManagedSubscriptionState {
  return {
    status: row.status,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
  };
}

export async function cancelSubscriptionRenewal(userId: string): Promise<ManagedSubscriptionState> {
  const subscription = await findManagedSubscription(userId);
  if (!subscription?.subscriptionId) {
    throw conflict("No managed Creator subscription to cancel.");
  }
  if (subscription.cancelAtPeriodEnd) {
    return toState(subscription);
  }

  const provider = getBillingProvider();
  if (!provider.isConfigured() || provider.id !== subscription.provider) {
    throw billingUnavailable();
  }

  let result;
  try {
    result = await provider.cancelSubscription({ subscriptionId: subscription.subscriptionId });
  } catch (error) {
    console.error("billing_subscription_cancel_failed", {
      provider: provider.id,
      subscriptionId: subscription.subscriptionId,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw billingUnavailable();
  }

  const cancelAtPeriodEnd = result.status !== "canceled";
  const status: SubscriptionStatus = result.status === "canceled" ? "CANCELLED" : subscription.status;
  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      cancelAtPeriodEnd,
      status,
    },
  });
  return toState(updated);
}

export async function resumeSubscriptionRenewal(userId: string): Promise<ManagedSubscriptionState> {
  const subscription = await findManagedSubscription(userId);
  if (!subscription?.subscriptionId) {
    throw conflict("No managed Creator subscription to resume.");
  }
  if (!subscription.cancelAtPeriodEnd) {
    return toState(subscription);
  }

  const provider = getBillingProvider();
  if (!provider.isConfigured() || provider.id !== subscription.provider) {
    throw billingUnavailable();
  }

  try {
    await provider.reactivateSubscription({
      userId,
      subscriptionId: subscription.subscriptionId,
    });
  } catch (error) {
    console.error("billing_subscription_resume_failed", {
      provider: provider.id,
      subscriptionId: subscription.subscriptionId,
      message: error instanceof Error ? error.message : "unknown",
    });
    const message = error instanceof Error ? error.message : "";
    if (/unpaid|cannot be reactivated|not in `?canceling`?/i.test(message)) {
      throw conflict("This subscription can't be resumed automatically. Update your payment method or contact support.");
    }
    throw billingUnavailable();
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: false, status: "ACTIVE" },
  });
  return toState(updated);
}
