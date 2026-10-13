import { prisma } from "@/lib/db/prisma";
import { FILE_LIMITS, TTS_SETTINGS } from "@/lib/config/limits";
import {
  generationLimitReached,
  ttsCapacityReached,
  ttsCostLimitExceeded,
  usageLimitExceeded,
} from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { getUserPlan } from "@/lib/billing/entitlements";
import { worstCaseCostFor } from "@/lib/tts/pricing";
import type { TtsTier } from "@/lib/tts/types";

export const TTS_USAGE_UNIT = "characters";
export const TTS_PREVIEW_UNIT = "preview";

type TtsUsageType = "TTS_CHARACTERS" | "PREMIUM_TTS_CHARACTERS";

export function usageTypeForTier(tier: TtsTier): TtsUsageType {
  return tier === "premium" ? "PREMIUM_TTS_CHARACTERS" : "TTS_CHARACTERS";
}

export function currentUtcMonthRange(now = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart, periodEnd };
}

export function currentUtcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getMonthlyTtsCharacters(
  userId: string,
  now = new Date(),
  tier: TtsTier = "standard",
): Promise<number> {
  const { periodStart } = currentUtcMonthRange(now);
  const result = await prisma.usageRecord.aggregate({
    where: {
      userId,
      type: usageTypeForTier(tier),
      unit: TTS_USAGE_UNIT,
      periodStart,
    },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity ?? 0);
}

/**
 * The plan's monthly standard allowance is a soft fair-use line: jobs past
 * it still run but are logged for review. Only the plan's hard cap blocks.
 */
export async function assertTtsCapacity(
  userId: string,
  additionalCharacters: number,
  now = new Date(),
): Promise<void> {
  const [used, plan] = await Promise.all([
    getMonthlyTtsCharacters(userId, now),
    getUserPlan(userId, now),
  ]);
  const projected = used + additionalCharacters;
  if (projected > plan.standardMonthlyHardCharacters) {
    throw usageLimitExceeded();
  }
  if (projected > plan.standardMonthlySoftCharacters) {
    console.warn("tts_soft_quota_exceeded", { userId, planId: plan.id, used, additionalCharacters });
  }
}

/** Free-tool sessions have one lifetime budget; it does not reset daily. */
export async function getAnonymousSessionTtsCharacters(sessionId: string): Promise<number> {
  const result = await prisma.usageRecord.aggregate({
    where: {
      anonymousSessionId: sessionId,
      type: "TTS_CHARACTERS",
      unit: TTS_USAGE_UNIT,
    },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity ?? 0);
}

export async function getNetworkDailyTtsCharacters(
  ipHash: string,
  now = new Date(),
): Promise<number> {
  const result = await prisma.usageRecord.aggregate({
    where: {
      anonymousSession: { ipHash },
      type: "TTS_CHARACTERS",
      unit: TTS_USAGE_UNIT,
      createdAt: { gte: currentUtcDayStart(now) },
    },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity ?? 0);
}

async function getAnonymousRemaining(sessionId: string, now: Date): Promise<number> {
  const session = await prisma.anonymousSession.findUnique({
    where: { id: sessionId },
    select: { ipHash: true },
  });
  const [sessionUsed, networkUsed] = await Promise.all([
    getAnonymousSessionTtsCharacters(sessionId),
    session?.ipHash ? getNetworkDailyTtsCharacters(session.ipHash, now) : Promise.resolve(0),
  ]);
  return Math.max(
    0,
    Math.min(
      FILE_LIMITS.ANONYMOUS_TTS_SESSION_CHARS - sessionUsed,
      FILE_LIMITS.ANONYMOUS_IP_DAILY_CHARS - networkUsed,
    ),
  );
}

export async function getStandardTtsAllowance(
  actor: Actor,
  now = new Date(),
): Promise<{ maxCharacters: number; remainingCharacters: number; period: "session" | "month" }> {
  if (actor.type === "user") {
    const [used, plan] = await Promise.all([
      getMonthlyTtsCharacters(actor.userId, now),
      getUserPlan(actor.userId, now),
    ]);
    const max = plan.standardMonthlyHardCharacters;
    return { maxCharacters: max, remainingCharacters: Math.max(0, max - used), period: "month" };
  }
  return {
    maxCharacters: FILE_LIMITS.ANONYMOUS_TTS_SESSION_CHARS,
    remainingCharacters: await getAnonymousRemaining(actor.sessionId, now),
    period: "session",
  };
}

/** Site-wide guard for the shared Edge endpoint: completed plus in-flight characters today. */
export async function assertEdgeDailyCapacity(
  additionalCharacters: number,
  now = new Date(),
): Promise<void> {
  const limit = TTS_SETTINGS.EDGE_GLOBAL_DAILY_CHARS;
  if (limit <= 0) {
    return;
  }
  const [completed, inFlight] = await Promise.all([
    prisma.usageRecord.aggregate({
      where: {
        provider: "edge",
        type: "TTS_CHARACTERS",
        unit: TTS_USAGE_UNIT,
        createdAt: { gte: currentUtcDayStart(now) },
      },
      _sum: { quantity: true },
    }),
    prisma.generationJob.aggregate({
      where: { type: "GENERATE_TTS", provider: "edge", status: { in: ["QUEUED", "PROCESSING"] } },
      _sum: { inputCharacters: true },
    }),
  ]);
  const usedToday =
    Number(completed._sum.quantity ?? 0) + Number(inFlight._sum.inputCharacters ?? 0);
  if (usedToday + additionalCharacters > limit) {
    console.warn("tts_edge_daily_capacity_reached", { usedToday, additionalCharacters, limit });
    throw ttsCapacityReached();
  }
}

/** Standard-voice fair use. Premium usage is metered by the credit ledger instead. */
export async function assertStandardCapacityForActor(
  actor: Actor,
  additionalCharacters: number,
  now = new Date(),
): Promise<void> {
  if (actor.type === "user") {
    await assertTtsCapacity(actor.userId, additionalCharacters, now);
    return;
  }
  const remaining = await getAnonymousRemaining(actor.sessionId, now);
  if (additionalCharacters > remaining) {
    throw generationLimitReached(
      "You've reached the end of the free preview. Create a free account to narrate the rest of the book.",
    );
  }
}

export async function assertPremiumCostGuard(estimatedCost: number, now = new Date()): Promise<void> {
  await assertPremiumBatchCostGuard([estimatedCost], now);
}

/** Each chapter job is capped individually; the batch total counts against the daily budget. */
export async function assertPremiumBatchCostGuard(
  chapterEstimates: number[],
  now = new Date(),
): Promise<void> {
  if (chapterEstimates.some((cost) => cost > TTS_SETTINGS.MAX_TTS_JOB_COST_USD)) {
    throw ttsCostLimitExceeded();
  }
  const estimatedCost = chapterEstimates.reduce((sum, cost) => sum + cost, 0);
  const spentToday = await getPremiumSpendToday(now);
  if (spentToday + estimatedCost > TTS_SETTINGS.DAILY_PREMIUM_COST_LIMIT_USD) {
    console.warn("tts_daily_premium_budget_reached", { spentToday, estimatedCost });
    throw ttsCostLimitExceeded();
  }
}

/** Uncached premium previews draw on the same daily budget as narration. */
export async function assertPremiumPreviewBudget(
  estimatedCost: number,
  now = new Date(),
): Promise<void> {
  const spentToday = await getPremiumSpendToday(now);
  if (spentToday + estimatedCost > TTS_SETTINGS.DAILY_PREMIUM_COST_LIMIT_USD) {
    console.warn("tts_daily_premium_budget_reached", { spentToday, estimatedCost, preview: true });
    throw ttsCostLimitExceeded(
      "Premium voice previews are paused for today. Try a standard voice or check back tomorrow.",
    );
  }
}

/** Settled and in-flight premium narration plus uncached premium previews, today (UTC). */
async function getPremiumSpendToday(now: Date): Promise<number> {
  const since = currentUtcDayStart(now);
  const [settled, pending, previews] = await Promise.all([
    prisma.generationJob.aggregate({
      where: { tier: "PREMIUM", status: "COMPLETED", createdAt: { gte: since } },
      _sum: { actualCost: true },
    }),
    prisma.generationJob.aggregate({
      where: { tier: "PREMIUM", status: { in: ["QUEUED", "PROCESSING"] }, createdAt: { gte: since } },
      _sum: { estimatedCost: true },
    }),
    prisma.usageRecord.groupBy({
      by: ["provider"],
      where: { unit: TTS_PREVIEW_UNIT, provider: { not: "edge" }, createdAt: { gte: since } },
      _sum: { quantity: true },
    }),
  ]);
  const previewCost = previews.reduce(
    (sum, row) =>
      sum + (row.provider ? worstCaseCostFor(row.provider, Number(row._sum.quantity ?? 0)) : 0),
    0,
  );
  return (
    Number(settled._sum.actualCost ?? 0) + Number(pending._sum.estimatedCost ?? 0) + previewCost
  );
}

export async function recordTtsCharacters(input: {
  userId?: string | null;
  anonymousSessionId?: string | null;
  projectId: string;
  jobId: string;
  characters: number;
  provider: string;
  tier?: TtsTier;
  providerModel?: string;
  cachedCharacters?: number;
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  now?: Date;
}): Promise<void> {
  const { periodStart, periodEnd } = currentUtcMonthRange(input.now);
  await prisma.usageRecord.create({
    data: {
      userId: input.userId ?? null,
      anonymousSessionId: input.anonymousSessionId ?? null,
      projectId: input.projectId,
      jobId: input.jobId,
      type: usageTypeForTier(input.tier ?? "standard"),
      quantity: input.characters,
      unit: TTS_USAGE_UNIT,
      provider: input.provider,
      periodStart,
      periodEnd,
      metadata: {
        providerModel: input.providerModel ?? null,
        cachedCharacters: input.cachedCharacters ?? 0,
        estimatedCost: input.estimatedCost ?? 0,
        actualCost: input.actualCost ?? 0,
        currency: input.currency ?? "USD",
      },
    },
  });
}

export async function countRecentVoicePreviews(input: {
  userId?: string | null;
  anonymousSessionId?: string | null;
  since: Date;
}): Promise<number> {
  return prisma.usageRecord.count({
    where: {
      ...(input.userId ? { userId: input.userId } : { anonymousSessionId: input.anonymousSessionId }),
      type: "TTS_CHARACTERS",
      unit: TTS_PREVIEW_UNIT,
      createdAt: { gte: input.since },
    },
  });
}

/**
 * Preview rows are counted for rate limits. `quantity` holds the characters
 * the provider billed (0 on a cache hit) so previews count toward the daily
 * premium budget; previews never touch narration quotas.
 */
export async function recordVoicePreview(input: {
  userId?: string | null;
  anonymousSessionId?: string | null;
  voiceId: string;
  characters: number;
  billedCharacters: number;
  provider: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const { periodStart, periodEnd } = currentUtcMonthRange(now);
  await prisma.usageRecord.create({
    data: {
      userId: input.userId ?? null,
      anonymousSessionId: input.anonymousSessionId ?? null,
      type: "TTS_CHARACTERS",
      quantity: input.billedCharacters,
      unit: TTS_PREVIEW_UNIT,
      provider: input.provider,
      periodStart,
      periodEnd,
      metadata: {
        voiceId: input.voiceId,
        characters: input.characters,
      },
    },
  });
}

export async function assertAnonymousPreviewLimit(sessionId: string): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await countRecentVoicePreviews({ anonymousSessionId: sessionId, since });
  if (recent >= FILE_LIMITS.MAX_ANONYMOUS_PREVIEW_HOURLY) {
    throw generationLimitReached("Voice preview limit reached. Try again later or save the project.");
  }
}

export async function assertAnonymousExportLimit(
  sessionId: string,
  type: "ZIP" | "M4B",
): Promise<void> {
  const count = await prisma.export.count({
    where: {
      project: { anonymousSessionId: sessionId, userId: null, deletedAt: null },
      type,
      status: { in: ["QUEUED", "PROCESSING", "COMPLETED"] },
    },
  });
  if (count >= FILE_LIMITS.MAX_ANONYMOUS_EXPORTS) {
    const format = type === "M4B" ? "M4B" : "MP3";
    throw generationLimitReached(
      `You've already exported this audiobook as ${format}. Download it again below, or save the project to export a new version.`,
    );
  }
}

export async function assertAnonymousJobConcurrency(sessionId: string): Promise<void> {
  const count = await prisma.generationJob.count({
    where: {
      project: { anonymousSessionId: sessionId, userId: null, deletedAt: null },
      type: { in: ["GENERATE_TTS", "GENERATE_PROJECT"] },
      parentJobId: null,
      status: { in: ["QUEUED", "PROCESSING"] },
    },
  });
  if (count >= FILE_LIMITS.MAX_ANONYMOUS_CONCURRENT_JOBS) {
    throw generationLimitReached("A free-tool job is already running.");
  }
}
