import OpenAI from "openai";
import { ttsInvalidRequest, ttsVoiceNotFound } from "@/lib/api/errors";
import { isFeatureEnabled } from "@/lib/config/limits";
import { mapOpenAIError } from "@/lib/tts/openai-errors";
import { estimateCostFor } from "@/lib/tts/pricing";
import { findOpenAIVoice, OPENAI_VOICES } from "@/lib/tts/voices";
import type {
  TTSGenerateInput,
  TTSGenerateResult,
  TTSPreviewInput,
  TTSProvider,
  VoiceDefinition,
} from "@/lib/tts/types";

const OPENAI_PROVIDER_ID = "openai";
const OPENAI_MAX_CHARACTERS = 4096;

function resolveOpenAIModel(): string {
  return process.env.OPENAI_TTS_MODEL?.trim() || "tts-1";
}

export function createOpenAIProvider(): TTSProvider {
  return {
    id: OPENAI_PROVIDER_ID,
    name: "OpenAI",
    tier: "premium",
    limits: {
      targetCharacters: OPENAI_MAX_CHARACTERS,
      hardLimitCharacters: OPENAI_MAX_CHARACTERS,
    },
    isEnabled(): boolean {
      return isFeatureEnabled("FEATURE_PREMIUM_TTS", false) && Boolean(process.env.OPENAI_API_KEY?.trim());
    },
    modelFor: resolveOpenAIModel,
    billableCharacters: (text) => text.length,
    estimateCost({ characters, purpose }) {
      return estimateCostFor({
        providerId: OPENAI_PROVIDER_ID,
        model: resolveOpenAIModel(),
        characters,
        purpose,
      });
    },
    listVoices(): VoiceDefinition[] {
      return OPENAI_VOICES;
    },
    getVoice(id: string): VoiceDefinition | null {
      return findOpenAIVoice(id);
    },
    preview(input: TTSPreviewInput): Promise<TTSGenerateResult> {
      return synthesize(input);
    },
    generate(input: TTSGenerateInput): Promise<TTSGenerateResult> {
      return synthesize(input);
    },
  };
}

async function synthesize(input: TTSGenerateInput): Promise<TTSGenerateResult> {
  const voice = findOpenAIVoice(input.voiceId);
  if (!voice) {
    throw ttsVoiceNotFound();
  }
  if (!input.text.trim()) {
    throw ttsInvalidRequest("Preview text is required.");
  }
  if (input.text.length > OPENAI_MAX_CHARACTERS) {
    throw ttsInvalidRequest("Text exceeds the provider request limit.");
  }

  const audio = await requestSpeech(input.text, voice.providerVoiceId, input.speed);
  return {
    audio,
    mimeType: "audio/mpeg",
    format: "MP3",
    characterCount: input.text.length,
  };
}

async function requestSpeech(
  text: string,
  providerVoiceId: string,
  speed?: number,
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw mapOpenAIError({ status: 503, message: "OPENAI_API_KEY is not configured." });
  }

  const client = new OpenAI({ apiKey });
  const voice = OPENAI_VOICES.some((item) => item.providerVoiceId === providerVoiceId)
    ? (providerVoiceId as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer")
    : "alloy";

  try {
    const response = await client.audio.speech.create({
      model: resolveOpenAIModel(),
      voice,
      input: text,
      response_format: "mp3",
      speed: speed && speed > 0 ? Math.min(4, Math.max(0.25, speed)) : 1,
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw mapOpenAIError(error);
  }
}
