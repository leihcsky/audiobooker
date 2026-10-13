import { planRequired } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { getPlan, PLANS, type PlanDefinition } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import type { VoiceAccess } from "@/lib/tts/types";

const PLAN_GRANTING_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"] as const;

export type BillingPeriod = { start: Date; end: Date };

export type UserPlanState = {
  plan: PlanDefinition;
  subscriptionId: string | null;
  period: BillingPeriod | null;
};

export async function getUserPlanState(userId: string, now = new Date()): Promise<UserPlanState> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [...PLAN_GRANTING_STATUSES] },
      currentPeriodEnd: { gt: now },
    },
    orderBy: { currentPeriodEnd: "desc" },
  });
  if (!subscription?.currentPeriodEnd) {
    return { plan: PLANS.free, subscriptionId: null, period: null };
  }
  return {
    plan: getPlan(subscription.planId),
    subscriptionId: subscription.id,
    period: {
      start: subscription.currentPeriodStart ?? subscription.createdAt,
      end: subscription.currentPeriodEnd,
    },
  };
}

export async function getUserPlan(userId: string, now = new Date()): Promise<PlanDefinition> {
  return (await getUserPlanState(userId, now)).plan;
}

/** Every signed-in account may pick premium voices; generation is paid with premium minutes. */
export async function getVoiceAccess(actor: Actor): Promise<VoiceAccess> {
  return { premium: actor.type === "user" };
}

export async function canUsePublishMastering(actor: Actor): Promise<boolean> {
  if (actor.type !== "user") {
    return false;
  }
  return (await getUserPlan(actor.userId)).publishMastering;
}

export async function assertCanUsePublishMastering(actor: Actor): Promise<void> {
  if (!(await canUsePublishMastering(actor))) {
    throw planRequired("Publish-ready exports are part of the Creator plan.");
  }
}

export async function canUsePronunciationDictionary(actor: Actor): Promise<boolean> {
  if (actor.type !== "user") {
    return false;
  }
  return (await getUserPlan(actor.userId)).pronunciationDictionary;
}

export async function assertCanUsePronunciationDictionary(actor: Actor): Promise<void> {
  if (!(await canUsePronunciationDictionary(actor))) {
    throw planRequired("The pronunciation dictionary is part of the Creator plan.");
  }
}

export async function canUseParagraphFix(actor: Actor): Promise<boolean> {
  if (actor.type !== "user") {
    return false;
  }
  return (await getUserPlan(actor.userId)).paragraphFix;
}

export async function assertCanUseParagraphFix(actor: Actor): Promise<void> {
  if (!(await canUseParagraphFix(actor))) {
    throw planRequired("Fixing a single paragraph is part of the Creator plan.");
  }
}

export async function countUserProjects(userId: string): Promise<number> {
  return prisma.project.count({ where: { userId, deletedAt: null } });
}

export async function assertCanCreateProject(userId: string): Promise<void> {
  const [plan, used] = await Promise.all([getUserPlan(userId), countUserProjects(userId)]);
  if (used >= plan.maxProjects) {
    throw planRequired(
      `Your ${plan.name} plan holds ${plan.maxProjects} projects. Delete a project or upgrade to add another.`,
    );
  }
}

/**
 * Users over their project limit keep every project, but only the oldest
 * projects up to the limit can be parsed or narrated.
 */
export async function assertProjectWithinPlan(actor: Actor, projectId: string): Promise<void> {
  if (actor.type !== "user") {
    return;
  }
  const [plan, used] = await Promise.all([
    getUserPlan(actor.userId),
    countUserProjects(actor.userId),
  ]);
  if (used <= plan.maxProjects) {
    return;
  }
  const usable = await prisma.project.findMany({
    where: { userId: actor.userId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: plan.maxProjects,
    select: { id: true },
  });
  if (!usable.some((project) => project.id === projectId)) {
    throw planRequired(
      `Your ${plan.name} plan includes ${plan.maxProjects} active projects. Delete a project or upgrade to keep working on this one.`,
    );
  }
}
