import type { VoiceDefinition } from "@/lib/tts/types";
import { REPLICATE_GEMINI_VOICES, REPLICATE_MINIMAX_VOICES } from "@/lib/tts/voices";

/** Which Replicate TTS backend the env models select. */
export type ReplicateTtsFamily = "minimax" | "gemini";

export const REPLICATE_MINIMAX_PREVIEW_MODEL = "minimax/speech-2.8-turbo";
export const REPLICATE_MINIMAX_GENERATE_MODEL = "minimax/speech-2.8-hd";
export const REPLICATE_GEMINI_MODEL = "google/gemini-3.8-flash-tts";
export const REPLICATE_GEMINI_31_MODEL = "google/gemini-3.1-flash-tts";

export const REPLICATE_MINIMAX_MAX_CHARACTERS = 8_000;
/** Conservative per-request cap; Gemini TTS rejects very long prompts. */
export const REPLICATE_GEMINI_MAX_CHARACTERS = 4_000;

/** Gemini 3.1 uses `prompt` + `language_code`; 3.8+ uses `style` + `output_format`. */
export function isGemini31Model(model: string): boolean {
  return normalizeReplicateModel(model).toLowerCase().includes("gemini-3.1");
}

/**
 * Normalize a short or full model id from env.
 * Examples: `gemini-3.8-flash-tts` → `google/gemini-3.8-flash-tts`,
 * `speech-2.8-hd` → `minimax/speech-2.8-hd`.
 */
export function normalizeReplicateModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes("/")) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("gemini")) {
    return `google/${trimmed}`;
  }
  if (lower.startsWith("speech-") || lower.startsWith("minimax")) {
    return lower.startsWith("minimax") ? trimmed : `minimax/${trimmed}`;
  }
  return trimmed;
}

export function detectReplicateFamily(model: string): ReplicateTtsFamily {
  return normalizeReplicateModel(model).toLowerCase().includes("gemini") ? "gemini" : "minimax";
}

export function resolvePreviewModel(): string {
  const configured = process.env.REPLICATE_TTS_PREVIEW_MODEL?.trim();
  if (configured) {
    return normalizeReplicateModel(configured);
  }
  return detectReplicateFamily(resolveGenerateModelRaw()) === "gemini"
    ? REPLICATE_GEMINI_MODEL
    : REPLICATE_MINIMAX_PREVIEW_MODEL;
}

export function resolveGenerateModel(): string {
  const configured = process.env.REPLICATE_TTS_GENERATE_MODEL?.trim();
  if (!configured) {
    return REPLICATE_MINIMAX_GENERATE_MODEL;
  }
  const model = normalizeReplicateModel(configured);
  if (detectReplicateFamily(model) === "minimax" && model.toLowerCase().includes("turbo")) {
    console.warn("tts_replicate_generate_model_ignored", {
      configured,
      using: REPLICATE_MINIMAX_GENERATE_MODEL,
    });
    return REPLICATE_MINIMAX_GENERATE_MODEL;
  }
  return model;
}

/** Active family for voice catalog and request shaping (from generate model). */
export function resolveReplicateFamily(): ReplicateTtsFamily {
  return detectReplicateFamily(resolveGenerateModel());
}

/** Voices exposed in Studio for the configured Replicate TTS family. */
export function activeReplicateVoices(): VoiceDefinition[] {
  return resolveReplicateFamily() === "gemini" ? REPLICATE_GEMINI_VOICES : REPLICATE_MINIMAX_VOICES;
}

export function findActiveReplicateVoice(id: string): VoiceDefinition | null {
  return activeReplicateVoices().find((voice) => voice.id === id) ?? null;
}

function resolveGenerateModelRaw(): string {
  const configured = process.env.REPLICATE_TTS_GENERATE_MODEL?.trim();
  return configured ? normalizeReplicateModel(configured) : REPLICATE_MINIMAX_GENERATE_MODEL;
}
