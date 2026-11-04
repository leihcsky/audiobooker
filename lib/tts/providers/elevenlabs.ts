import { ttsInvalidRequest, ttsProviderUnavailable, ttsVoiceNotFound } from "@/lib/api/errors";
import { isFeatureEnabled } from "@/lib/config/limits";
import { mapElevenLabsError } from "@/lib/tts/elevenlabs-errors";
import { estimateCostFor } from "@/lib/tts/pricing";
import { ELEVENLABS_VOICES, findElevenLabsVoice } from "@/lib/tts/voices";
import type {
  TTSGenerateInput,
  TTSGenerateResult,
  TTSPreviewInput,
  TTSProvider,
  VoiceDefinition,
} from "@/lib/tts/types";

export const ELEVENLABS_PROVIDER_ID = "elevenlabs";
/**
 * Official per-request cap for `eleven_v4` (≈10 min of audio).
 * @see https://elevenlabs.io/docs/overview/models
 */
export const ELEVENLABS_V4_MAX_CHARACTERS = 10_000;
/** @deprecated Prefer resolveMaxCharacters() / ELEVENLABS_V4_MAX_CHARACTERS. */
export const ELEVENLABS_MAX_CHARACTERS = ELEVENLABS_V4_MAX_CHARACTERS;
export const ELEVENLABS_DEFAULT_MODEL = "eleven_v4";
export const ELEVENLABS_DEFAULT_PREVIEW_MODEL = "eleven_v4_turbo";
export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

const API_BASE = "https://api.elevenlabs.io/v1";

export type ElevenLabsConvert = (
  voiceId: string,
  input: {
    text: string;
    modelId: string;
    outputFormat: string;
    voiceSettings: { stability: number; similarityBoost: number };
  },
) => Promise<Buffer>;

export function createElevenLabsProvider(deps?: { convert?: ElevenLabsConvert }): TTSProvider {
  const convert = deps?.convert ?? defaultConvert;

  return {
    id: ELEVENLABS_PROVIDER_ID,
    name: "ElevenLabs",
    tier: "premium",
    get limits() {
      const max = resolveMaxCharacters();
      // Chunk a little under the hard API cap so pronunciation expansion still fits.
      const target = Math.max(500, Math.min(max, max - 200));
      return { targetCharacters: target, hardLimitCharacters: max };
    },
    isEnabled(): boolean {
      return (
        isFeatureEnabled("FEATURE_PREMIUM_TTS", false) &&
        isFeatureEnabled("FEATURE_ELEVENLABS_TTS", true) &&
        Boolean(process.env.ELEVENLABS_API_KEY?.trim())
      );
    },
    modelFor(purpose): string {
      return purpose === "preview" ? resolvePreviewModel() : resolveGenerateModel();
    },
    billableCharacters: (text) => text.length,
    estimateCost({ characters, purpose }) {
      return estimateCostFor({
        providerId: ELEVENLABS_PROVIDER_ID,
        model: purpose === "preview" ? resolvePreviewModel() : resolveGenerateModel(),
        characters,
        purpose,
      });
    },
    listVoices(): VoiceDefinition[] {
      return ELEVENLABS_VOICES;
    },
    getVoice(id: string): VoiceDefinition | null {
      return findElevenLabsVoice(id);
    },
    preview(input: TTSPreviewInput): Promise<TTSGenerateResult> {
      return synthesize(input, resolvePreviewModel(), convert);
    },
    generate(input: TTSGenerateInput): Promise<TTSGenerateResult> {
      return synthesize(input, resolveGenerateModel(), convert);
    },
  };
}

async function synthesize(
  input: TTSGenerateInput,
  model: string,
  convert: ElevenLabsConvert,
): Promise<TTSGenerateResult> {
  const voice = findElevenLabsVoice(input.voiceId);
  if (!voice) {
    throw ttsVoiceNotFound();
  }
  if (!input.text.trim()) {
    throw ttsInvalidRequest("Text is required.");
  }
  const maxCharacters = resolveMaxCharacters(model);
  if (input.text.length > maxCharacters) {
    throw ttsInvalidRequest("Text exceeds the provider request limit.");
  }

  console.info("tts_elevenlabs_request", {
    model,
    voiceId: voice.id,
    characters: input.text.length,
  });

  try {
    const audio = await convert(voice.providerVoiceId, {
      text: input.text,
      modelId: model,
      outputFormat: ELEVENLABS_OUTPUT_FORMAT,
      // Eleven v4 only uses stability + similarity (no style/speed).
      voiceSettings: {
        stability: readSetting("ELEVENLABS_STABILITY", 0.5),
        similarityBoost: readSetting("ELEVENLABS_SIMILARITY_BOOST", 0.75),
      },
    });
    return {
      audio,
      mimeType: "audio/mpeg",
      format: "MP3",
      characterCount: input.text.length,
    };
  } catch (error) {
    console.info("tts_elevenlabs_error", {
      model,
      characters: input.text.length,
      message: error instanceof Error ? error.message : String(error),
    });
    throw mapElevenLabsError(error);
  }
}

async function defaultConvert(
  voiceId: string,
  input: {
    text: string;
    modelId: string;
    outputFormat: string;
    voiceSettings: { stability: number; similarityBoost: number };
  },
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw ttsProviderUnavailable();
  }

  const url = new URL(`${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`);
  url.searchParams.set("output_format", input.outputFormat);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.text,
      model_id: input.modelId,
      voice_settings: {
        stability: input.voiceSettings.stability,
        similarity_boost: input.voiceSettings.similarityBoost,
      },
    }),
  });

  if (!response.ok) {
    let detail: unknown = await response.text().catch(() => "");
    try {
      detail = typeof detail === "string" && detail ? JSON.parse(detail) : detail;
    } catch {
      // keep raw text
    }
    throw mapElevenLabsError({
      status: response.status,
      ...(detail && typeof detail === "object" ? detail : { message: String(detail) }),
    });
  }

  return Buffer.from(await response.arrayBuffer());
}

export function resolveGenerateModel(): string {
  return process.env.ELEVENLABS_TTS_MODEL?.trim() || ELEVENLABS_DEFAULT_MODEL;
}

export function resolvePreviewModel(): string {
  return (
    process.env.ELEVENLABS_TTS_PREVIEW_MODEL?.trim() ||
    process.env.ELEVENLABS_TTS_MODEL?.trim() ||
    ELEVENLABS_DEFAULT_PREVIEW_MODEL
  );
}

/** Per-request character cap for the active (or given) ElevenLabs model. */
export function resolveMaxCharacters(model = resolveGenerateModel()): number {
  const configured = process.env.ELEVENLABS_MAX_CHARS_PER_REQUEST?.trim();
  if (configured) {
    const value = Number.parseInt(configured, 10);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  const id = model.trim().toLowerCase();
  // Docs table: eleven_v4 = 10_000. Turbo is not listed separately; keep the same cap.
  if (id.includes("flash_v2_5")) {
    return 40_000;
  }
  if (id.includes("flash_v2")) {
    return 30_000;
  }
  if (id.includes("eleven_v3")) {
    return 5_000;
  }
  return ELEVENLABS_V4_MAX_CHARACTERS;
}

function readSetting(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}
