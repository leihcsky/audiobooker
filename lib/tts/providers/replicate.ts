import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Replicate from "replicate";
import { runFfmpeg } from "@/lib/audio/ffmpeg";
import { ttsInvalidRequest, ttsProviderUnavailable, ttsVoiceNotFound } from "@/lib/api/errors";
import { isFeatureEnabled } from "@/lib/config/limits";
import { countMiniMaxBillableCharacters, estimateCostFor } from "@/lib/tts/pricing";
import {
  activeReplicateVoices,
  detectReplicateFamily,
  findActiveReplicateVoice,
  isGemini31Model,
  REPLICATE_GEMINI_MAX_CHARACTERS,
  REPLICATE_MINIMAX_MAX_CHARACTERS,
  resolveGenerateModel,
  resolvePreviewModel,
  resolveReplicateFamily,
  type ReplicateTtsFamily,
} from "@/lib/tts/replicate-config";
import { mapReplicateError } from "@/lib/tts/replicate-errors";
import type {
  TTSGenerateInput,
  TTSGenerateResult,
  TTSPreviewInput,
  TTSProvider,
  VoiceDefinition,
} from "@/lib/tts/types";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";

export const REPLICATE_PROVIDER_ID = "replicate";
/** @deprecated Use REPLICATE_MINIMAX_* / resolve*Model from replicate-config. */
export const REPLICATE_PREVIEW_MODEL = "minimax/speech-2.8-turbo";
/** @deprecated Use REPLICATE_MINIMAX_* / resolve*Model from replicate-config. */
export const REPLICATE_GENERATE_MODEL = "minimax/speech-2.8-hd";
/** @deprecated Prefer family-specific limits via the provider instance. */
export const REPLICATE_MAX_CHARACTERS = REPLICATE_MINIMAX_MAX_CHARACTERS;

export type ReplicateRun = (
  model: `${string}/${string}` | `${string}/${string}:${string}`,
  options: { input: Record<string, unknown> },
) => Promise<unknown>;

export function createReplicateProvider(deps?: { run?: ReplicateRun }): TTSProvider {
  const run = deps?.run ?? defaultReplicateRun;

  return {
    id: REPLICATE_PROVIDER_ID,
    get name() {
      if (resolveReplicateFamily() !== "gemini") {
        return "MiniMax Speech 2.8";
      }
      return isGemini31Model(resolveGenerateModel())
        ? "Gemini 3.1 Flash TTS"
        : "Gemini 3.8 Flash TTS";
    },
    tier: "premium",
    get limits() {
      const max =
        resolveReplicateFamily() === "gemini"
          ? REPLICATE_GEMINI_MAX_CHARACTERS
          : REPLICATE_MINIMAX_MAX_CHARACTERS;
      return { targetCharacters: max, hardLimitCharacters: max };
    },
    isEnabled(): boolean {
      const family = resolveReplicateFamily();
      const familyEnabled =
        family === "gemini"
          ? isFeatureEnabled("FEATURE_GEMINI_TTS", true)
          : isFeatureEnabled("FEATURE_MINIMAX_TTS", true);
      return (
        isFeatureEnabled("FEATURE_PREMIUM_TTS", false) &&
        familyEnabled &&
        Boolean(process.env.REPLICATE_API_TOKEN?.trim())
      );
    },
    modelFor(purpose): string {
      return purpose === "preview" ? resolvePreviewModel() : resolveGenerateModel();
    },
    billableCharacters(text: string): number {
      return resolveReplicateFamily() === "gemini" ? text.length : countMiniMaxBillableCharacters(text);
    },
    estimateCost({ characters, purpose }) {
      return estimateCostFor({
        providerId: REPLICATE_PROVIDER_ID,
        model: purpose === "preview" ? resolvePreviewModel() : resolveGenerateModel(),
        characters,
        purpose,
      });
    },
    listVoices(): VoiceDefinition[] {
      return activeReplicateVoices();
    },
    getVoice(id: string): VoiceDefinition | null {
      return findActiveReplicateVoice(id);
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
  const family = detectReplicateFamily(model);
  const voice = findActiveReplicateVoice(input.voiceId);
  if (!voice || family !== resolveReplicateFamily()) {
    throw ttsVoiceNotFound();
  }
  if (!input.text.trim()) {
    throw ttsInvalidRequest("Text is required.");
  }
  const maxChars =
    family === "gemini" ? REPLICATE_GEMINI_MAX_CHARACTERS : REPLICATE_MINIMAX_MAX_CHARACTERS;
  if (input.text.length > maxChars) {
    throw ttsInvalidRequest("Text exceeds the provider request limit.");
  }

  console.info("tts_replicate_request", {
    model,
    family,
    voiceId: voice.id,
    characters: input.text.length,
  });

  const audio = await requestSpeech(
    run,
    model,
    family,
    input.text,
    voice.providerVoiceId,
    voice.languageCode,
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
  family: ReplicateTtsFamily,
  text: string,
  providerVoiceId: string,
  languageCode: string,
  speed?: number,
): Promise<Buffer> {
  try {
    const input =
      family === "gemini"
        ? geminiInput(model, text, providerVoiceId, languageCode)
        : minimaxInput(model, text, providerVoiceId, speed);
    const output = await run(model as `${string}/${string}`, { input });
    const raw = await outputToBuffer(output);
    // Gemini 3.1 often returns WAV; chapter pipeline expects MP3.
    return family === "gemini" ? ensureMp3Buffer(raw) : raw;
  } catch (error) {
    console.info("tts_replicate_error", {
      model,
      family,
      characters: text.length,
      message: error instanceof Error ? error.message : String(error),
    });
    throw mapReplicateError(error);
  }
}

function minimaxInput(
  model: string,
  text: string,
  providerVoiceId: string,
  speed?: number,
): Record<string, unknown> {
  return {
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
  };
}

function geminiInput(
  model: string,
  text: string,
  providerVoiceId: string,
  languageCode: string,
): Record<string, unknown> {
  // Gemini 3.1: prompt + language_code. Gemini 3.8+: style + output_format.
  if (isGemini31Model(model)) {
    return {
      text,
      voice: providerVoiceId,
      prompt: "Say the following.",
      language_code: toBcp47Language(languageCode),
    };
  }
  return {
    text,
    voice: providerVoiceId,
    style: "",
    second_voice: "none",
    output_format: "mp3",
  };
}

function toBcp47Language(languageCode: string): string {
  const trimmed = languageCode.trim();
  if (!trimmed) {
    return "en-US";
  }
  if (trimmed.includes("-")) {
    return trimmed;
  }
  if (trimmed.toLowerCase() === "en") {
    return "en-US";
  }
  return trimmed;
}

function isWavBuffer(audio: Buffer): boolean {
  return (
    audio.length >= 12 &&
    audio.toString("ascii", 0, 4) === "RIFF" &&
    audio.toString("ascii", 8, 12) === "WAVE"
  );
}

async function ensureMp3Buffer(audio: Buffer): Promise<Buffer> {
  if (!isWavBuffer(audio)) {
    return audio;
  }
  const dir = await mkdtemp(join(tmpdir(), "ab-gemini-tts-"));
  const inputPath = join(dir, "in.wav");
  const outputPath = join(dir, "out.mp3");
  try {
    await writeFile(inputPath, audio);
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
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

export { resolveGenerateModel, resolvePreviewModel } from "@/lib/tts/replicate-config";
