import { prisma } from "@/lib/db/prisma";
import {
  chapterAlreadyGenerating,
  chapterNotFound,
  conflict,
  ttsInvalidRequest,
  validationError,
} from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { assertPremiumBalance, reserveCredits } from "@/lib/billing/credits.service";
import { assertProjectWithinPlan, getVoiceAccess } from "@/lib/billing/entitlements";
import { estimatePremiumSeconds } from "@/lib/billing/premium-usage";
import { getChapterForActor } from "@/lib/chapters/chapter.service";
import { toJobSummary, type JobSummary } from "@/lib/projects/project.detail";
import { resolveVoice } from "@/lib/tts";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";
import type { TtsTier } from "@/lib/tts/types";
import { EDGE_PROVIDER_ID } from "@/lib/tts/providers/edge";
import {
  assertAnonymousJobConcurrency,
  assertEdgeDailyCapacity,
  assertPremiumCostGuard,
  assertStandardCapacityForActor,
} from "@/lib/usage/usage.service";

export async function startChapterGeneration(input: {
  userId?: string;
  actor?: Actor;
  chapterId: string;
  voiceId: string;
  speed?: number;
  quality?: TtsTier;
  /** Characters expected to reach the provider when most segments are reused; defaults to the whole chapter. */
  synthesisCharacters?: number;
  /** Paragraph indexes to re-synthesize with reuse and the cache bypassed. */
  retryParagraphs?: number[];
}): Promise<JobSummary> {
  const actor = input.actor ?? (input.userId ? { type: "user" as const, userId: input.userId } : null);
  if (!actor) {
    throw ttsInvalidRequest("Authentication required.");
  }
  const chapter = await getChapterForActor(input.chapterId, actor);
  if (!chapter.sourceText.trim()) {
    throw validationError("Chapter text is empty.");
  }

  const { voice, provider } = resolveVoice(await getVoiceAccess(actor), input.voiceId, {
    quality: input.quality,
  });

  const latest = await prisma.chapter.findUnique({
    where: { id: chapter.id },
    select: { status: true, projectId: true, included: true },
  });
  if (!latest) {
    throw chapterNotFound();
  }
  if (!latest.included) {
    throw validationError("This chapter is not selected for narration.");
  }
  await assertProjectWithinPlan(actor, latest.projectId);

  const projectGenerations = await prisma.generationJob.count({
    where: {
      projectId: latest.projectId,
      type: "GENERATE_PROJECT",
      status: { in: ["QUEUED", "PROCESSING"] },
    },
  });
  if (projectGenerations > 0) {
    throw conflict("The audiobook is being narrated. Wait for it to finish or stop it first.");
  }

  if (latest.status === "GENERATING") {
    const active = await prisma.generationJob.findFirst({
      where: {
        chapterId: chapter.id,
        type: "GENERATE_TTS",
        status: { in: ["QUEUED", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (active) {
      return toJobSummary(active);
    }
    throw chapterAlreadyGenerating();
  }

  await prisma.generationJob.updateMany({
    where: {
      chapterId: chapter.id,
      type: "GENERATE_TTS",
      status: { in: ["QUEUED", "PROCESSING"] },
    },
    data: {
      status: "FAILED",
      errorCode: "TTS_GENERATION_FAILED",
      errorMessage: "This attempt was replaced by a new Generate audiobook request.",
      completedAt: new Date(),
    },
  });

  const characterCount = chapter.sourceText.length;
  if (characterCount < 1) {
    throw ttsInvalidRequest("Chapter text is empty.");
  }

  const speed = normalizeSpeechSpeed(input.speed ?? Number(chapter.selectedSpeed));
  const premium = voice.tier === "premium";
  const premiumUserId = premium && actor.type === "user" ? actor.userId : null;
  const synthesisCharacters = Math.max(1, Math.min(input.synthesisCharacters ?? characterCount, characterCount));
  const premiumSeconds = premium
    ? estimatePremiumSeconds({ characters: synthesisCharacters, languageCode: voice.languageCode })
    : 0;

  if (actor.type === "anonymous") {
    await assertAnonymousJobConcurrency(actor.sessionId);
  }
  if (!premium) {
    await assertStandardCapacityForActor(actor, synthesisCharacters);
  }
  if (provider.id === EDGE_PROVIDER_ID) {
    await assertEdgeDailyCapacity(synthesisCharacters);
  }

  const estimate = provider.estimateCost({
    characters:
      input.synthesisCharacters === undefined
        ? provider.billableCharacters(chapter.sourceText)
        : synthesisCharacters,
    purpose: "generate",
  });
  if (premium) {
    await assertPremiumCostGuard(estimate.estimatedCost);
  }
  if (premiumUserId) {
    await assertPremiumBalance(premiumUserId, premiumSeconds);
  }

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.generationJob.create({
      data: {
        projectId: latest.projectId,
        chapterId: chapter.id,
        type: "GENERATE_TTS",
        status: "QUEUED",
        provider: provider.id,
        providerModel: estimate.model,
        tier: premium ? "PREMIUM" : "STANDARD",
        voiceId: voice.id,
        inputCharacters: characterCount,
        estimatedCost: estimate.estimatedCost,
        currency: estimate.currency,
        ...(input.retryParagraphs?.length ? { retryParagraphs: input.retryParagraphs } : {}),
      },
    });
    await tx.chapter.update({
      where: { id: chapter.id },
      data: {
        status: "GENERATING",
        selectedVoiceId: voice.id,
        selectedSpeed: speed,
      },
    });
    if (premiumUserId) {
      await reserveCredits(tx, { userId: premiumUserId, jobId: created.id, seconds: premiumSeconds });
    }
    return created;
  });

  return toJobSummary(job);
}
