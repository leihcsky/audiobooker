import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { captureReservation, releaseReservationForJob } from "@/lib/billing/credits.service";
import { billablePremiumSeconds } from "@/lib/billing/premium-usage";
import { TTS_SETTINGS } from "@/lib/config/limits";
import { prisma } from "@/lib/db/prisma";
import { claimTtsJob, touchTtsJob } from "@/lib/jobs/tts-claim";
import { getStorage } from "@/lib/storage";
import { buildChapterAudioObjectKey } from "@/lib/storage/keys";
import { resolveVoice } from "@/lib/tts";
import { validateSynthesizedAudio } from "@/lib/tts/audio-validation";
import {
  buildTtsCacheKey,
  DEFAULT_PITCH,
  DEFAULT_VOLUME,
  readTtsCache,
  writeTtsCache,
} from "@/lib/tts/cache";
import { chunkText } from "@/lib/tts/chunking";
import { withProviderSlot } from "@/lib/tts/concurrency";
import { concatMp3Buffers, estimateDurationFromCharacters, estimateMp3DurationSeconds } from "@/lib/tts/mp3";
import { NARRATION_GENERIC_FAILURE } from "@/lib/tts/narration-failure";
import { withTtsRetry } from "@/lib/tts/retry";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";
import type { TextChunk, TTSProvider, VoiceDefinition } from "@/lib/tts/types";
import { recordTtsCharacters } from "@/lib/usage/usage.service";

const USER_SAFE_FAILURE = NARRATION_GENERIC_FAILURE;

type ChunkContext = {
  jobId: string;
  provider: TTSProvider;
  model: string;
  voice: VoiceDefinition;
  speed: number;
};

type ChunkAudio = { audio: Buffer; cached: boolean };

export async function runTtsJob(jobId: string): Promise<void> {
  const claimed = await claimTtsJob(jobId);
  if (!claimed) {
    return;
  }

  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: {
      chapter: true,
      project: { select: { userId: true, anonymousSessionId: true } },
    },
  });
  if (!job || job.type !== "GENERATE_TTS" || !job.chapter) {
    return;
  }
  const chapter = job.chapter;

  try {
    const voiceId = job.voiceId ?? chapter.selectedVoiceId;
    if (!voiceId) {
      throw new AppError("TTS_VOICE_NOT_FOUND", USER_SAFE_FAILURE, 404);
    }
    const { voice, provider } = resolveVoice({ premium: job.tier === "PREMIUM" }, voiceId);
    const model = provider.modelFor("generate");
    const speed = normalizeSpeechSpeed(
      chapter.selectedSpeed == null ? undefined : Number(chapter.selectedSpeed),
    );

    const chunks = chunkText(chapter.sourceText, {
      maxCharacters: provider.limits.targetCharacters,
      maxBytes: provider.limits.maxBytes,
    });
    if (chunks.length === 0) {
      throw new AppError("TTS_INVALID_REQUEST", USER_SAFE_FAILURE, 400);
    }

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        provider: provider.id,
        providerModel: model,
        totalChunks: chunks.length,
        completedChunks: 0,
        cachedChunks: 0,
      },
    });
    console.info("tts_generate_started", {
      jobId: job.id,
      provider: provider.id,
      model,
      tier: provider.tier,
      voiceId: voice.id,
      chunks: chunks.length,
      characters: chapter.sourceText.length,
    });

    const context: ChunkContext = { jobId: job.id, provider, model, voice, speed };
    const audioParts: Buffer[] = [];
    let characters = 0;
    let billableCharacters = 0;
    let providerBilledCharacters = 0;
    for (const chunk of chunks) {
      await touchTtsJob(job.id);
      const result = await produceChunkAudio(context, chunk);
      audioParts.push(result.audio);
      characters += chunk.characterCount;
      if (!result.cached) {
        billableCharacters += chunk.characterCount;
        providerBilledCharacters += provider.billableCharacters(chunk.text);
      }
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          completedChunks: { increment: 1 },
          ...(result.cached ? { cachedChunks: { increment: 1 } } : {}),
        },
      });
    }

    const audio = concatMp3Buffers(audioParts);
    const durationSeconds =
      estimateMp3DurationSeconds(audio) ?? estimateDurationFromCharacters(characters);
    const audioFileId = randomUUID();
    const objectKey = buildChapterAudioObjectKey({
      owner: job.project.userId
        ? { kind: "user", id: job.project.userId }
        : { kind: "anonymous", id: job.project.anonymousSessionId ?? job.projectId },
      projectId: job.projectId,
      chapterId: chapter.id,
      audioFileId,
    });

    await getStorage().putObject({
      objectKey,
      body: audio,
      contentType: "audio/mpeg",
    });

    const previous = await prisma.audioFile.aggregate({
      where: { chapterId: chapter.id, type: "CHAPTER_AUDIO" },
      _max: { version: true },
    });
    const version = (previous._max.version ?? 0) + 1;
    const actual = provider.estimateCost({
      characters: providerBilledCharacters,
      purpose: "generate",
    });

    await prisma.$transaction(async (tx) => {
      await tx.audioFile.create({
        data: {
          id: audioFileId,
          projectId: job.projectId,
          chapterId: job.chapterId,
          type: "CHAPTER_AUDIO",
          objectKey,
          format: "MP3",
          mimeType: "audio/mpeg",
          durationSeconds,
          sizeBytes: audio.length,
          provider: provider.id,
          providerVoiceId: voice.providerVoiceId,
          generationJobId: job.id,
          version,
        },
      });
      await tx.chapter.update({
        where: { id: chapter.id },
        data: {
          status: "READY",
          currentAudioFileId: audioFileId,
          audioOutdated: false,
          selectedVoiceId: voice.id,
        },
      });
      await tx.generationJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          inputCharacters: characters,
          actualCost: actual.estimatedCost,
          currency: actual.currency,
          errorCode: null,
          errorMessage: null,
        },
      });
      if (job.tier === "PREMIUM") {
        await captureReservation(tx, {
          jobId: job.id,
          billableSeconds: billablePremiumSeconds({
            durationSeconds,
            speed,
            characters,
            billableCharacters,
          }),
        });
      }
    });

    await recordTtsCharacters({
      userId: job.project.userId,
      anonymousSessionId: job.project.anonymousSessionId,
      projectId: job.projectId,
      jobId: job.id,
      characters: billableCharacters,
      cachedCharacters: characters - billableCharacters,
      provider: provider.id,
      providerModel: model,
      tier: provider.tier,
      estimatedCost: job.estimatedCost == null ? undefined : Number(job.estimatedCost),
      actualCost: actual.estimatedCost,
      currency: actual.currency,
    });
    console.info("tts_generate_completed", {
      jobId: job.id,
      provider: provider.id,
      chunks: chunks.length,
      characters,
      billableCharacters,
      actualCost: actual.estimatedCost,
    });
  } catch (error) {
    const code = error instanceof AppError ? error.code : "TTS_GENERATION_FAILED";
    console.info("tts_failed", {
      projectId: job.projectId,
      chapterId: job.chapterId,
      jobId: job.id,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
    });

    const latest = await prisma.chapter.findUnique({
      where: { id: chapter.id },
      select: { currentAudioFileId: true },
    });
    const keepReady = Boolean(latest?.currentAudioFileId);

    await prisma.$transaction(async (tx) => {
      await tx.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorCode: code,
          errorMessage: error instanceof AppError ? error.message : USER_SAFE_FAILURE,
          completedAt: new Date(),
        },
      });
      await tx.chapter.update({
        where: { id: chapter.id },
        data: {
          status: keepReady ? "READY" : "FAILED",
        },
      });
      if (job.tier === "PREMIUM") {
        await releaseReservationForJob(tx, job.id, "job_failed");
      }
    });
  }
}

async function produceChunkAudio(context: ChunkContext, chunk: TextChunk): Promise<ChunkAudio> {
  const { provider, model, voice, speed } = context;
  const key = buildTtsCacheKey({
    provider: provider.id,
    providerModel: model,
    providerVoiceId: voice.providerVoiceId,
    language: voice.languageCode,
    speed,
    pitch: DEFAULT_PITCH,
    volume: DEFAULT_VOLUME,
    text: chunk.text,
  });

  const cached = await readTtsCache(key.cacheKey);
  if (cached) {
    return { audio: cached.audio, cached: true };
  }

  const startedAt = Date.now();
  const { audio, durationSeconds } = await withTtsRetry(
    async () => {
      const result = await withProviderSlot(provider.id, maxConcurrencyFor(provider.id), () =>
        provider.generate({ text: chunk.text, voiceId: voice.id, speed }),
      );
      const validated = validateSynthesizedAudio(result.audio, {
        characters: chunk.characterCount,
        speed,
      });
      return { audio: result.audio, durationSeconds: validated.durationSeconds };
    },
    {
      onRetry: ({ attempt, delayMs, error }) => {
        console.info("tts_chunk_retry", {
          jobId: context.jobId,
          provider: provider.id,
          chunkIndex: chunk.index,
          attempt,
          delayMs,
          errorCode: error instanceof AppError ? error.code : "UNKNOWN",
        });
      },
    },
  );
  console.info("tts_chunk_generated", {
    jobId: context.jobId,
    provider: provider.id,
    chunkIndex: chunk.index,
    characters: chunk.characterCount,
    textHash: key.textHash,
    durationMs: Date.now() - startedAt,
  });

  await writeTtsCache({
    key,
    provider: provider.id,
    providerModel: model,
    providerVoiceId: voice.providerVoiceId,
    characters: chunk.characterCount,
    audio,
    durationSeconds,
  });
  return { audio, cached: false };
}

function maxConcurrencyFor(providerId: string): number {
  if (providerId === "edge") {
    return TTS_SETTINGS.EDGE_MAX_CONCURRENCY;
  }
  if (providerId === "replicate") {
    return TTS_SETTINGS.MINIMAX_MAX_CONCURRENCY;
  }
  return TTS_SETTINGS.OPENAI_MAX_CONCURRENCY;
}
