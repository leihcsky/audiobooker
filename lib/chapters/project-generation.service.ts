import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { validationError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { isJobStale } from "@/lib/jobs/tts-claim";
import {
  findLatestProjectGenerationJob,
  toProjectGenerationSummary,
  type ProjectGenerationSummary,
} from "@/lib/projects/project.detail";
import { assertPremiumBalance, reserveCredits } from "@/lib/billing/credits.service";
import { assertProjectWithinPlan, getVoiceAccess } from "@/lib/billing/entitlements";
import { estimatePremiumSeconds } from "@/lib/billing/premium-usage";
import { assertProjectAccess } from "@/lib/tools/access";
import { resolveVoice } from "@/lib/tts";
import { EDGE_PROVIDER_ID } from "@/lib/tts/providers/edge";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";
import type { TTSProvider, TtsTier } from "@/lib/tts/types";
import {
  assertAnonymousJobConcurrency,
  assertEdgeDailyCapacity,
  assertPremiumBatchCostGuard,
  assertStandardCapacityForActor,
} from "@/lib/usage/usage.service";

const ACTIVE_STATUSES = ["QUEUED", "PROCESSING"] as const;

export type StartProjectGenerationInput = {
  actor: Actor;
  projectId: string;
  voiceId: string;
  speed?: number;
  quality?: TtsTier;
  chapterIds?: string[];
};

export type StartProjectGenerationResult = {
  generation: ProjectGenerationSummary;
  /** False when an already-active generation was returned instead. */
  created: boolean;
};

type CandidateChapter = {
  id: string;
  included: boolean;
  status: string;
  characterCount: number;
  currentAudioFileId: string | null;
  audioOutdated: boolean;
};

export function selectChaptersToNarrate(
  chapters: CandidateChapter[],
  requestedIds?: string[],
): CandidateChapter[] {
  if (requestedIds) {
    const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    if (requestedIds.some((id) => !byId.get(id)?.included)) {
      throw validationError("One or more chapters are not selected in this project.");
    }
    const requested = new Set(requestedIds);
    return chapters.filter(
      (chapter) =>
        requested.has(chapter.id) && chapter.status !== "GENERATING" && chapter.characterCount > 0,
    );
  }
  return chapters.filter(
    (chapter) =>
      chapter.included &&
      chapter.status !== "GENERATING" &&
      chapter.characterCount > 0 &&
      (!chapter.currentAudioFileId || chapter.audioOutdated),
  );
}

export async function findActiveProjectGenerationJob(projectId: string) {
  return prisma.generationJob.findFirst({
    where: { projectId, type: "GENERATE_PROJECT", status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function startProjectGeneration(
  input: StartProjectGenerationInput,
): Promise<StartProjectGenerationResult> {
  const { actor, projectId } = input;
  await assertProjectAccess(actor, projectId);

  const active = await findActiveProjectGenerationJob(projectId);
  if (active) {
    return { generation: await toProjectGenerationSummary(active), created: false };
  }

  const { voice, provider } = resolveVoice(await getVoiceAccess(actor), input.voiceId, {
    quality: input.quality,
  });
  await assertProjectWithinPlan(actor, projectId);

  const chapters = await prisma.chapter.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      included: true,
      status: true,
      characterCount: true,
      currentAudioFileId: true,
      audioOutdated: true,
    },
  });
  const targets = selectChaptersToNarrate(chapters, input.chapterIds);
  if (targets.length === 0) {
    throw validationError("Every selected chapter already has up-to-date audio.");
  }

  const totalCharacters = targets.reduce((sum, chapter) => sum + chapter.characterCount, 0);
  const premium = voice.tier === "premium";
  const premiumUserId = premium && actor.type === "user" ? actor.userId : null;
  const speed = normalizeSpeechSpeed(input.speed);
  const premiumSeconds = targets.map((chapter) =>
    premium
      ? estimatePremiumSeconds({
          characters: chapter.characterCount,
          languageCode: voice.languageCode,
        })
      : 0,
  );

  if (actor.type === "anonymous") {
    await assertAnonymousJobConcurrency(actor.sessionId);
  }
  if (!premium) {
    await assertStandardCapacityForActor(actor, totalCharacters);
  }
  if (provider.id === EDGE_PROVIDER_ID) {
    await assertEdgeDailyCapacity(totalCharacters);
  }
  const billedCharacters = await countProviderBilledCharacters(provider, targets, premium);
  const estimates = targets.map((_, index) =>
    provider.estimateCost({ characters: billedCharacters[index], purpose: "generate" }),
  );
  if (premium) {
    await assertPremiumBatchCostGuard(estimates.map((estimate) => estimate.estimatedCost));
  }
  if (premiumUserId) {
    await assertPremiumBalance(
      premiumUserId,
      premiumSeconds.reduce((sum, seconds) => sum + seconds, 0),
    );
  }

  const tier = premium ? "PREMIUM" : "STANDARD";
  const parentId = randomUUID();
  const childIds = targets.map(() => randomUUID());
  const targetIds = targets.map((chapter) => chapter.id);

  const parent = await prisma.$transaction(
    async (tx) => {
      const created = await tx.generationJob.create({
        data: {
          id: parentId,
          projectId,
          type: "GENERATE_PROJECT",
          status: "QUEUED",
          provider: provider.id,
          providerModel: estimates[0]?.model,
          voiceId: voice.id,
          inputCharacters: totalCharacters,
          totalChunks: targets.length,
        },
      });
      await tx.generationJob.createMany({
        data: targets.map((chapter, index) => ({
          id: childIds[index],
          projectId,
          chapterId: chapter.id,
          parentJobId: parentId,
          type: "GENERATE_TTS" as const,
          status: "QUEUED" as const,
          provider: provider.id,
          providerModel: estimates[index].model,
          tier,
          voiceId: voice.id,
          inputCharacters: chapter.characterCount,
          estimatedCost: estimates[index].estimatedCost,
          currency: estimates[index].currency,
        })),
      });
      await tx.chapter.updateMany({
        where: { id: { in: targetIds } },
        data: { selectedVoiceId: voice.id, selectedSpeed: speed },
      });
      if (premiumUserId) {
        for (const [index, jobId] of childIds.entries()) {
          await reserveCredits(tx, { userId: premiumUserId, jobId, seconds: premiumSeconds[index] });
        }
      }
      return created;
    },
    { timeout: 20_000 },
  );

  return { generation: await toProjectGenerationSummary(parent), created: true };
}

/** Standard voices cost nothing, so chapter text is only loaded for premium runs. */
async function countProviderBilledCharacters(
  provider: TTSProvider,
  targets: { id: string; characterCount: number }[],
  premium: boolean,
): Promise<number[]> {
  if (!premium) {
    return targets.map((chapter) => chapter.characterCount);
  }
  const rows = await prisma.chapter.findMany({
    where: { id: { in: targets.map((chapter) => chapter.id) } },
    select: { id: true, sourceText: true },
  });
  const textById = new Map(rows.map((row) => [row.id, row.sourceText]));
  return targets.map((chapter) => {
    const text = textById.get(chapter.id);
    return text == null ? chapter.characterCount : provider.billableCharacters(text);
  });
}

export type ProjectGenerationState = {
  generation: ProjectGenerationSummary | null;
  /** Set when a stalled job should be picked up again by the runner. */
  resumeJobId: string | null;
};

export async function getProjectGenerationForActor(
  actor: Actor,
  projectId: string,
): Promise<ProjectGenerationState> {
  await assertProjectAccess(actor, projectId);
  const job = await findLatestProjectGenerationJob(projectId);
  if (!job) {
    return { generation: null, resumeJobId: null };
  }
  const resumable = job.status === "QUEUED" || isJobStale(job);
  return {
    generation: await toProjectGenerationSummary(job),
    resumeJobId: resumable ? job.id : null,
  };
}

export async function cancelProjectGenerationForActor(
  actor: Actor,
  projectId: string,
): Promise<ProjectGenerationSummary | null> {
  await assertProjectAccess(actor, projectId);
  const active = await findActiveProjectGenerationJob(projectId);
  if (active) {
    const now = new Date();
    await prisma.$transaction([
      prisma.generationJob.updateMany({
        where: { id: active.id, status: { in: [...ACTIVE_STATUSES] } },
        data: { status: "CANCELLED", completedAt: now },
      }),
      prisma.generationJob.updateMany({
        where: { parentJobId: active.id, status: "QUEUED" },
        data: { status: "CANCELLED", completedAt: now },
      }),
    ]);
  }
  const latest = await findLatestProjectGenerationJob(projectId);
  return latest ? toProjectGenerationSummary(latest) : null;
}
