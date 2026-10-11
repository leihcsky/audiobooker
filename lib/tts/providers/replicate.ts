import Replicate from "replicate";
import { ttsInvalidRequest, ttsProviderUnavailable, ttsVoiceNotFound } from "@/lib/api/errors";
import { isFeatureEnabled } from "@/lib/config/limits";
import { countMiniMaxBillableCharacters, estimateCostFor } from "@/lib/tts/pricing";
import { mapReplicateError } from "@/lib/tts/replicate-errors";
import { findReplicateVoice, REPLICATE_VOICES } from "@/lib/tts/voices";
import type {
  TTSGenerateInput,
  TTSGenerateResult,
  TTSPreviewInput,
  TTSProvider,
  VoiceDefinition,
} from "@/lib/tts/types";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";

export const REPLICATE_PROVIDER_ID = "replicate";
export const REPLICATE_MAX_CHARACTERS = 8_000;
export const REPLICATE_PREVIEW_MODEL = "minimax/speech-2.8-turbo";
export const REPLICATE_GENERATE_MODEL = "minimax/speech-2.8-hd";

export type ReplicateRun = (
  model: `${string}/${string}` | `${string}/${string}:${string}`,
  options: { input: Record<string, unknown> },
) => Promise<unknown>;

export function createReplicateProvider(deps?: { run?: ReplicateRun }): TTSProvider {
  const run = deps?.run ?? defaultReplicateRun;

  return {
    id: REPLICATE_PROVIDER_ID,
    name: "MiniMax Speech 2.8",
    tier: "premium",
    limits: {
      targetCharacters: REPLICATE_MAX_CHARACTERS,
      hardLimitCharacters: REPLICATE_MAX_CHARACTERS,
    },
    isEnabled(): boolean {
      return (
        isFeatureEnabled("FEATURE_PREMIUM_TTS", false) &&
        isFeatureEnabled("FEATURE_MINIMAX_TTS", true) &&
        Boolean(process.env.REPLICATE_API_TOKEN?.trim())
      );
    },
    modelFor(purpose): string {
      return purpose === "preview" ? resolvePreviewModel() : resolveGenerateModel();
    },
    billableCharacters: countMiniMaxBillableCharacters,
    estimateCost({ characters, purpose }) {
      return estimateCostFor({
        providerId: REPLICATE_PROVIDER_ID,
        model: purpose === "preview" ? resolvePreviewModel() : resolveGenerateModel(),
        characters,
        purpose,
      });
    },
    listVoices(): VoiceDefinition[] {
      return REPLICATE_VOICES;
    },
    getVoice(id: string): VoiceDefinition | null {
      return findReplicateVoice(id);
    },
    preview(input: TTSPreviewInput): Promise<TTSGenerateResult> {
      return synthesize(input, resolvePreviewModel(), run);
    },
    generate(input: TTSGenerateInput): Promise<TTSGenerateResult> {
      return synthesize(input, resolveGenerateModel(), run);
    },
  };
}

async function synthesize(
  input: TTSGenerateInput,
  model: string,
  run: ReplicateRun,
): Promise<TTSGenerateResult> {
  const voice = findReplicateVoice(input.voiceId);
  if (!voice) {
    throw ttsVoiceNotFound();
  }
  if (!input.text.trim()) {
    throw ttsInvalidRequest("Text is required.");
  }
  if (input.text.length > REPLICATE_MAX_CHARACTERS) {
    throw ttsInvalidRequest("Text exceeds the provider request limit.");
  }

  console.info("tts_replicate_request", {
    model,
    voiceId: voice.id,
    characters: input.text.length,
  });

  const audio = await requestSpeech(
    run,
    model,
    input.text,
    voice.providerVoiceId,
    normalizeSpeechSpeed(input.speed),
  );
  return {
    audio,
    mimeType: "audio/mpeg",
    format: "MP3",
    characterCount: input.text.length,
  };
}

async function requestSpeech(
  run: ReplicateRun,
  model: string,
  text: string,
  providerVoiceId: string,
  speed?: number,
): Promise<Buffer> {
  try {
    const output = await run(model as `${string}/${string}`, {
      input: {
        text,
        voice_id: providerVoiceId,
        audio_format: "mp3",
        emotion: "auto",
        speed: speed && speed > 0 ? speed : 1,
        volume: 1,
        pitch: 0,
        sample_rate: model.includes("speech-2.8-hd") ? 44100 : 32000,
        bitrate: 128000,
        channel: "mono",
        english_normalization: model.includes("speech-2.8-hd"),
      },
    });
    return await outputToBuffer(output);
  } catch (error) {
    console.info("tts_replicate_error", {
      model,
      characters: text.length,
      message: error instanceof Error ? error.message : String(error),
    });
    throw mapReplicateError(error);
  }
}

async function defaultReplicateRun(
  model: `${string}/${string}` | `${string}/${string}:${string}`,
  options: { input: Record<string, unknown> },
): Promise<unknown> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    throw ttsProviderUnavailable();
  }
  const client = new Replicate({ auth: token });
  return client.run(model, options);
}

export async function outputToBuffer(output: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(output)) {
    return output;
  }
  if (output instanceof Uint8Array) {
    return Buffer.from(output);
  }
  if (typeof output === "string") {
    return fetchAudio(output);
  }
  if (Array.isArray(output) && output[0] !== undefined) {
    return outputToBuffer(output[0]);
  }
  if (output && typeof output === "object") {
    const maybe = output as { url?: string | (() => string); href?: string };
    const url = typeof maybe.url === "function" ? maybe.url() : maybe.url ?? maybe.href;
    if (url) {
      return outputToBuffer(url);
    }
  }
  throw ttsProviderUnavailable();
}

async function fetchAudio(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw ttsProviderUnavailable();
  }
  return Buffer.from(await response.arrayBuffer());
}

export function resolvePreviewModel(): string {
  const configured = process.env.REPLICATE_TTS_PREVIEW_MODEL?.trim();
  return configured || REPLICATE_PREVIEW_MODEL;
}

export function resolveGenerateModel(): string {
  const configured = process.env.REPLICATE_TTS_GENERATE_MODEL?.trim();
  if (configured?.includes("turbo")) {
    console.warn("tts_replicate_generate_model_ignored", {
      configured,
      using: REPLICATE_GENERATE_MODEL,
    });
    return REPLICATE_GENERATE_MODEL;
  }
  return configured || REPLICATE_GENERATE_MODEL;
}
