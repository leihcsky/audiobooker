import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createElevenLabsProvider,
  resolveGenerateModel,
  resolveMaxCharacters,
} from "@/lib/tts/providers/elevenlabs";
import { mapElevenLabsError } from "@/lib/tts/elevenlabs-errors";
import { listAvailableVoices, resolveVoice } from "@/lib/tts/registry";
import { planChapterChunks } from "@/lib/tts/segments";

const ENV_KEYS = [
  "FEATURE_PREMIUM_TTS",
  "FEATURE_ELEVENLABS_TTS",
  "FEATURE_MINIMAX_TTS",
  "FEATURE_GEMINI_TTS",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_TTS_MODEL",
  "ELEVENLABS_TTS_PREVIEW_MODEL",
  "ELEVENLABS_MAX_CHARS_PER_REQUEST",
  "REPLICATE_API_TOKEN",
  "OPENAI_API_KEY",
] as const;
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

describe("elevenlabs TTS adapter", () => {
  it("calls ElevenLabs convert with eleven_v4 and studio voice id", async () => {
    process.env.ELEVENLABS_TTS_MODEL = "eleven_v4";
    process.env.ELEVENLABS_TTS_PREVIEW_MODEL = "eleven_v4_turbo";
    const convert = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const provider = createElevenLabsProvider({ convert });

    await provider.preview({ text: "Hello there.", voiceId: "elevenlabs-adam" });
    await provider.generate({ text: "Once upon a time.", voiceId: "elevenlabs-adam" });

    expect(convert.mock.calls[0]?.[0]).toBe("bfGb7JTLUnZebZRiFYyq");
    expect(convert.mock.calls[0]?.[1]).toMatchObject({
      text: "Hello there.",
      modelId: "eleven_v4_turbo",
      outputFormat: "mp3_44100_128",
    });
    expect(convert.mock.calls[1]?.[1]).toMatchObject({
      modelId: "eleven_v4",
    });
    expect(resolveGenerateModel()).toBe("eleven_v4");
  });

  it("lists ElevenLabs voices when enabled", () => {
    process.env.FEATURE_PREMIUM_TTS = "true";
    process.env.FEATURE_ELEVENLABS_TTS = "true";
    process.env.ELEVENLABS_API_KEY = "el_test";
    process.env.FEATURE_MINIMAX_TTS = "false";
    process.env.FEATURE_GEMINI_TTS = "false";
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.OPENAI_API_KEY;

    const voices = listAvailableVoices({ premium: true });
    expect(voices.some((voice) => voice.id === "elevenlabs-adam")).toBe(true);
    expect(resolveVoice({ premium: true }, "elevenlabs-adam").provider.id).toBe("elevenlabs");
    expect(voices.find((voice) => voice.id === "elevenlabs-adam")?.supportsSpeed).toBe(false);
    const charlotte = voices.find((voice) => voice.id === "elevenlabs-charlotte");
    expect(charlotte?.languageCode).toBe("en-AU");
    expect(charlotte?.providerVoiceId).toBe("aRlmTYIQo6Tlg5SlulGC");
    expect(voices.some((voice) => voice.id === "elevenlabs-royce")).toBe(true);
    const nathaniel = voices.find((voice) => voice.id === "elevenlabs-nathaniel");
    expect(nathaniel?.languageCode).toBe("en-GB");
    expect(nathaniel?.providerVoiceId).toBe("AeRdCCKzvd23BpJoofzx");
    expect(voices.some((voice) => voice.id === "elevenlabs-verity-x")).toBe(true);
  });

  it("rejects unknown voices", async () => {
    const provider = createElevenLabsProvider({ convert: vi.fn() });
    await expect(
      provider.generate({ text: "Hello", voiceId: "replicate-wise-woman" }),
    ).rejects.toMatchObject({ code: "TTS_VOICE_NOT_FOUND" });
  });

  it("chunks long chapters under the eleven_v4 10000-character API cap", () => {
    delete process.env.ELEVENLABS_MAX_CHARS_PER_REQUEST;
    process.env.ELEVENLABS_TTS_MODEL = "eleven_v4";
    expect(resolveMaxCharacters("eleven_v4")).toBe(10_000);

    const provider = createElevenLabsProvider({ convert: vi.fn() });
    const voice = provider.getVoice("elevenlabs-adam");
    expect(voice).not.toBeNull();
    const longChapter = Array.from({ length: 250 }, (_, index) =>
      `Sentence number ${index + 1} keeps the narration moving with enough words to fill the buffer.`,
    ).join(" ");
    expect(longChapter.length).toBeGreaterThan(10_000);

    const chunks = planChapterChunks({
      text: longChapter,
      provider,
      voice: voice!,
      speed: 1,
      rules: [],
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= provider.limits.targetCharacters)).toBe(true);
    expect(chunks.every((chunk) => chunk.text.length <= 10_000)).toBe(true);
  });
});

describe("mapElevenLabsError", () => {
  it("maps rate limits and auth failures", () => {
    expect(mapElevenLabsError({ status: 429 }).code).toBe("TTS_RATE_LIMITED");
    expect(mapElevenLabsError({ status: 401 }).code).toBe("TTS_PROVIDER_UNAVAILABLE");
    expect(mapElevenLabsError({ status: 400, message: "invalid voice" }).code).toBe(
      "TTS_INVALID_REQUEST",
    );
  });
});
