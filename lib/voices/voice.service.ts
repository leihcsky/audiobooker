import { FILE_LIMITS } from "@/lib/config/limits";
import { ttsPremiumQuotaExceeded, ttsRateLimited, validationError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { getPremiumBalance } from "@/lib/billing/credits.service";
import { getVoiceAccess } from "@/lib/billing/entitlements";
import { getStorage } from "@/lib/storage";
import { buildPreviewObjectKey } from "@/lib/storage/keys";
import { storageOwnerFromActor } from "@/lib/tools/storage-owner";
import { listAvailableVoices, resolveVoice } from "@/lib/tts";
import {
  buildTtsCacheKey,
  DEFAULT_PITCH,
  DEFAULT_VOLUME,
  readTtsCache,
  writeTtsCache,
} from "@/lib/tts/cache";
import { estimateMp3DurationSeconds } from "@/lib/tts/mp3";
import { VOICE_PREVIEW_SAMPLE } from "@/lib/tts/preview-sample";
import { withTtsRetry } from "@/lib/tts/retry";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";
import type { TtsTier, VoiceDefinition } from "@/lib/tts/types";
import {
  assertAnonymousPreviewLimit,
  assertPremiumPreviewBudget,
  countRecentVoicePreviews,
  recordVoicePreview,
} from "@/lib/usage/usage.service";

const DEFAULT_PREVIEW_TEXT = VOICE_PREVIEW_SAMPLE.trim();
const PREVIEW_RETRY_DELAYS_MS = [500] as const;

export type VoiceDto = {
  id: string;
  provider: string;
  name: string;
  language: string;
  languageName: string;
  gender?: string;
  tier: "STANDARD" | "PREMIUM";
};

export async function listVoiceDtos(
  actor: Actor,
  filters?: { language?: string; provider?: string; tier?: TtsTier },
): Promise<VoiceDto[]> {
  const access = await getVoiceAccess(actor);
  return listAvailableVoices(access, filters).map(toVoiceDto);
}

export async function previewVoiceForUser(input: {
  userId: string;
  voiceId: string;
  text?: string;
}): Promise<{ audioUrl: string; expiresAt: string }> {
  return previewVoiceForActor({
    actor: { type: "user", userId: input.userId },
    voiceId: input.voiceId,
    text: input.text,
  });
}

export async function previewVoiceForActor(input: {
  actor: Actor;
  voiceId: string;
  text?: string;
  speed?: number;
}): Promise<{ audioUrl: string; expiresAt: string }> {
  const text = (input.text ?? DEFAULT_PREVIEW_TEXT).trim();
  if (!text) {
    throw validationError("Preview text is required.");
  }
  if (text.length > FILE_LIMITS.TTS_PREVIEW_MAX_CHARS) {
    throw validationError(`Preview text must be ${FILE_LIMITS.TTS_PREVIEW_MAX_CHARS} characters or fewer.`);
  }

  const { voice, provider } = resolveVoice(await getVoiceAccess(input.actor), input.voiceId);
  const premium = voice.tier === "premium";
  if (premium && text !== DEFAULT_PREVIEW_TEXT && input.actor.type === "user") {
    await assertCanPreviewCustomPremiumText(input.actor.userId);
  }

  if (input.actor.type === "anonymous") {
    await assertAnonymousPreviewLimit(input.actor.sessionId);
  } else {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await countRecentVoicePreviews({ userId: input.actor.userId, since });
    if (recent >= FILE_LIMITS.TTS_PREVIEW_HOURLY_LIMIT) {
      throw ttsRateLimited();
    }
  }

  const speed = normalizeSpeechSpeed(input.speed);
  const model = provider.modelFor("preview");
  const key = buildTtsCacheKey({
    provider: provider.id,
    providerModel: model,
    providerVoiceId: voice.providerVoiceId,
    language: voice.languageCode,
    speed,
    pitch: DEFAULT_PITCH,
    volume: DEFAULT_VOLUME,
    text,
  });

  let audio: Buffer;
  let billedCharacters = 0;
  const cached = await readTtsCache(key.cacheKey);
  if (cached) {
    audio = cached.audio;
  } else {
    billedCharacters = provider.billableCharacters(text);
    if (premium) {
      await assertPremiumPreviewBudget(
        provider.estimateCost({ characters: billedCharacters, purpose: "preview" }).estimatedCost,
      );
    }
    const result = await withTtsRetry(
      () => provider.preview({ text, voiceId: voice.id, speed }),
      { delaysMs: PREVIEW_RETRY_DELAYS_MS },
    );
    audio = result.audio;
    await writeTtsCache({
      key,
      provider: provider.id,
      providerModel: model,
      providerVoiceId: voice.providerVoiceId,
      characters: text.length,
      audio,
      durationSeconds: estimateMp3DurationSeconds(audio),
    });
  }

  const objectKey = buildPreviewObjectKey({
    owner: storageOwnerFromActor(input.actor),
    voiceId: voice.id,
  });
  await getStorage().putObject({
    objectKey,
    body: audio,
    contentType: "audio/mpeg",
  });
  const signed = await getStorage().createDownloadUrl({
    objectKey,
    expiresInSeconds: FILE_LIMITS.AUDIO_SIGNED_URL_SECONDS,
  });
  await recordVoicePreview({
    userId: input.actor.type === "user" ? input.actor.userId : null,
    anonymousSessionId: input.actor.type === "anonymous" ? input.actor.sessionId : null,
    voiceId: voice.id,
    characters: cached ? 0 : text.length,
    billedCharacters,
    provider: provider.id,
  });

  return {
    audioUrl: signed.downloadUrl,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

/** Without premium minutes, premium voices can only preview the fixed (cached) sample. */
async function assertCanPreviewCustomPremiumText(userId: string): Promise<void> {
  const { balance } = await getPremiumBalance(userId);
  if (balance.availableSeconds <= 0) {
    throw ttsPremiumQuotaExceeded(
      "Previewing your own text with a premium voice needs premium minutes. Preview the sample instead.",
    );
  }
}

function toVoiceDto(voice: VoiceDefinition): VoiceDto {
  return {
    id: voice.id,
    provider: voice.provider,
    name: voice.name,
    language: voice.languageCode,
    languageName: voice.languageName,
    gender: voice.gender,
    tier: voice.tier === "premium" ? "PREMIUM" : "STANDARD",
  };
}
