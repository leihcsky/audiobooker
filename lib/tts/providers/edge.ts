import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  AppError,
  ttsAudioInvalid,
  ttsInvalidRequest,
  ttsProviderTimeout,
  ttsProviderUnavailable,
  ttsRateLimited,
  ttsVoiceNotFound,
} from "@/lib/api/errors";
import { isFeatureEnabled, TTS_SETTINGS } from "@/lib/config/limits";
import { estimateCostFor } from "@/lib/tts/pricing";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";
import type { TTSGenerateInput, TTSGenerateResult, TTSProvider } from "@/lib/tts/types";
import { EDGE_VOICES, findEdgeVoice } from "@/lib/tts/voices";

export const EDGE_PROVIDER_ID = "edge";
export const EDGE_MODEL = "edge-neural";
export const EDGE_HARD_LIMIT_CHARACTERS = 5_000;
export const EDGE_MAX_BYTES = 9_000;
export const EDGE_SYNTH_ENDPOINT = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
const EDGE_SEC_MS_GEC_VERSION = "1-143.0.3650.75";

type MsEdgeTTSInternals = {
  TRUSTED_CLIENT_TOKEN: string;
  generateSecMsGec: (token: string) => Promise<string>;
  generateUUID: () => string;
  getSynthUrl: () => Promise<string>;
};

/**
 * Microsoft retired synthesis on speech.platform.bing.com (403 since 2026-10-12); the
 * api.msedgeservices.com host accepts the same token under a different query parameter.
 * msedge-tts hardcodes the old host, so its private URL builder is replaced here.
 */
function overrideEdgeEndpoint(): void {
  const internals = MsEdgeTTS as unknown as MsEdgeTTSInternals;
  if (typeof internals.generateSecMsGec !== "function" || typeof internals.generateUUID !== "function") {
    throw new Error("msedge-tts internals changed; update the Edge synthesis endpoint override.");
  }
  internals.getSynthUrl = async () => {
    const token = internals.TRUSTED_CLIENT_TOKEN;
    const secMsGec = await internals.generateSecMsGec(token);
    return `${EDGE_SYNTH_ENDPOINT}?Ocp-Apim-Subscription-Key=${token}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${EDGE_SEC_MS_GEC_VERSION}&ConnectionId=${internals.generateUUID()}`;
  };
}

overrideEdgeEndpoint();

export function edgeSynthUrl(): Promise<string> {
  return (MsEdgeTTS as unknown as MsEdgeTTSInternals).getSynthUrl();
}

export type EdgeSynthesisRequest = {
  voice: string;
  ssmlText: string;
  rate: string;
  pitch: string;
  volume: string;
  timeoutMs: number;
};

export type EdgeSynthesizeRaw = (request: EdgeSynthesisRequest) => Promise<Buffer>;

export function createEdgeProvider(deps?: { synthesizeRaw?: EdgeSynthesizeRaw }): TTSProvider {
  const synthesizeRaw = deps?.synthesizeRaw ?? defaultSynthesizeRaw;
  const targetCharacters = Math.min(TTS_SETTINGS.EDGE_MAX_CHARS_PER_REQUEST, EDGE_HARD_LIMIT_CHARACTERS);

  const synthesize = async (input: TTSGenerateInput): Promise<TTSGenerateResult> => {
    const voice = findEdgeVoice(input.voiceId);
    if (!voice) {
      throw ttsVoiceNotFound();
    }
    const text = input.text.trim();
    if (!text) {
      throw ttsInvalidRequest("Text is required.");
    }
    if (text.length > EDGE_HARD_LIMIT_CHARACTERS) {
      throw ttsInvalidRequest("Text exceeds the provider request limit.");
    }

    try {
      const audio = await synthesizeRaw({
        voice: voice.providerVoiceId,
        ssmlText: escapeXml(text),
        rate: speedToEdgeRate(input.speed),
        pitch: "+0Hz",
        volume: "+0%",
        timeoutMs: 30_000 + text.length * 20,
      });
      if (audio.length === 0) {
        throw ttsAudioInvalid();
      }
      return {
        audio,
        mimeType: "audio/mpeg",
        format: "MP3",
        characterCount: text.length,
      };
    } catch (error) {
      throw mapEdgeError(error);
    }
  };

  return {
    id: EDGE_PROVIDER_ID,
    name: "Standard",
    tier: "standard",
    limits: {
      targetCharacters,
      hardLimitCharacters: EDGE_HARD_LIMIT_CHARACTERS,
      maxBytes: EDGE_MAX_BYTES,
    },
    isEnabled: () => isFeatureEnabled("FEATURE_EDGE_TTS", true),
    modelFor: () => EDGE_MODEL,
    listVoices: () => EDGE_VOICES,
    getVoice: findEdgeVoice,
    preview: synthesize,
    generate: synthesize,
    billableCharacters: (text) => text.length,
    estimateCost: ({ characters, purpose }) =>
      estimateCostFor({ providerId: EDGE_PROVIDER_ID, model: EDGE_MODEL, characters, purpose }),
  };
}

export function speedToEdgeRate(speed?: number): string {
  const percent = Math.round((normalizeSpeechSpeed(speed) - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function mapEdgeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  console.info("tts_edge_error", { message: message.slice(0, 300) });
  const lower = message.toLowerCase();
  if (lower.includes("timed out")) {
    return ttsProviderTimeout();
  }
  if (lower.includes("429")) {
    return ttsRateLimited();
  }
  if (lower.includes("no audio")) {
    return ttsAudioInvalid();
  }
  return ttsProviderUnavailable();
}

async function defaultSynthesizeRaw(request: EdgeSynthesisRequest): Promise<Buffer> {
  const client = new MsEdgeTTS();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Edge TTS request timed out.")), request.timeoutMs);
  });

  const run = async (): Promise<Buffer> => {
    await client.setMetadata(request.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = client.toStream(request.ssmlText, {
      rate: request.rate,
      pitch: request.pitch,
      volume: request.volume,
    });
    return new Promise<Buffer>((resolve, reject) => {
      const parts: Buffer[] = [];
      audioStream.on("data", (data: Buffer) => parts.push(data));
      audioStream.once("end", () => {
        const audio = Buffer.concat(parts);
        if (audio.length === 0) {
          reject(new Error("No audio data received."));
          return;
        }
        resolve(audio);
      });
      audioStream.once("error", reject);
    });
  };

  try {
    return await Promise.race([run(), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    client.close();
  }
}
