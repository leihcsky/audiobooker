import { getPremiumBalance } from "@/lib/billing/credits.service";
import { countUserProjects } from "@/lib/billing/entitlements";
import type { PlanId } from "@/lib/billing/plans";

export type UsageSummary = {
  plan: { id: PlanId; name: string; premiumSecondsPerPeriod: number };
  projects: { used: number; limit: number };
  premium: {
    availableSeconds: number;
    monthlySeconds: number;
    monthlyGrantSeconds: number;
    monthlyExpiresAt: string | null;
    purchasedSeconds: number;
    reservedSeconds: number;
    periodEnd: string | null;
  };
};

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const [{ state, balance }, projectCount] = await Promise.all([
    getPremiumBalance(userId),
    countUserProjects(userId),
  ]);
  return {
    plan: {
      id: state.plan.id,
      name: state.plan.name,
      premiumSecondsPerPeriod: state.plan.premiumSecondsPerPeriod,
    },
    projects: { used: projectCount, limit: state.plan.maxProjects },
    premium: {
      availableSeconds: balance.availableSeconds,
      monthlySeconds: balance.monthlySeconds,
      monthlyGrantSeconds: balance.monthlyGrantSeconds,
      monthlyExpiresAt: balance.monthlyExpiresAt?.toISOString() ?? null,
      purchasedSeconds: balance.purchasedSeconds,
      reservedSeconds: balance.reservedSeconds,
      periodEnd: state.period?.end.toISOString() ?? null,
    },
  };
}
