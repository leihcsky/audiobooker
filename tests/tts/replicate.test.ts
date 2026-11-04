import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReplicateProvider,
  resolveGenerateModel,
} from "@/lib/tts/providers/replicate";
import { normalizeReplicateModel } from "@/lib/tts/replicate-config";
import { mapReplicateError } from "@/lib/tts/replicate-errors";
import { AppError } from "@/lib/api/errors";

const MODEL_ENV = ["REPLICATE_TTS_PREVIEW_MODEL", "REPLICATE_TTS_GENERATE_MODEL"] as const;
const originalModels = Object.fromEntries(MODEL_ENV.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of MODEL_ENV) {
    if (originalModels[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalModels[key];
    }
  }
});

describe("replicate TTS adapter", () => {
  it("uses MiniMax turbo for preview and HD for chapter generation", async () => {
    delete process.env.REPLICATE_TTS_PREVIEW_MODEL;
    delete process.env.REPLICATE_TTS_GENERATE_MODEL;
    const run = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const provider = createReplicateProvider({ run });

    await provider.preview({
      text: "Hello there.",
      voiceId: "replicate-wise-woman",
    });
    await provider.generate({
      text: "Once upon a time.",
      voiceId: "replicate-wise-woman",
    });

    expect(run.mock.calls[0]?.[0]).toBe("minimax/speech-2.8-turbo");
    expect(run.mock.calls[1]?.[0]).toBe("minimax/speech-2.8-hd");
    expect(resolveGenerateModel()).toBe("minimax/speech-2.8-hd");
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      input: {
        text: "Hello there.",
        voice_id: "Wise_Woman",
        audio_format: "mp3",
        speed: 1,
      },
    });
  });

  it("passes narration speed to MiniMax", async () => {
    delete process.env.REPLICATE_TTS_PREVIEW_MODEL;
    delete process.env.REPLICATE_TTS_GENERATE_MODEL;
    const run = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const provider = createReplicateProvider({ run });
    await provider.preview({
      text: "Hello there.",
      voiceId: "replicate-wise-woman",
      speed: 1.25,
    });
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      input: { speed: 1.25 },
    });
  });

  it("does not let generate fall back to turbo", () => {
    process.env.REPLICATE_TTS_GENERATE_MODEL = "minimax/speech-2.8-turbo";
    expect(resolveGenerateModel()).toBe("minimax/speech-2.8-hd");
  });

  it("calls Gemini 3.8 with style + output_format", async () => {
    process.env.REPLICATE_TTS_PREVIEW_MODEL = "gemini-3.8-flash-tts";
    process.env.REPLICATE_TTS_GENERATE_MODEL = "gemini-3.8-flash-tts";
    const run = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const provider = createReplicateProvider({ run });

    expect(provider.listVoices().some((voice) => voice.id === "replicate-gemini-kore")).toBe(true);
    expect(provider.listVoices().some((voice) => voice.id === "replicate-wise-woman")).toBe(false);

    await provider.generate({
      text: "Once upon a time.",
      voiceId: "replicate-gemini-kore",
    });

    expect(run.mock.calls[0]?.[0]).toBe("google/gemini-3.8-flash-tts");
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      input: {
        text: "Once upon a time.",
        voice: "Kore",
        output_format: "mp3",
        second_voice: "none",
      },
    });
  });

  it("calls Gemini 3.1 with prompt + language_code", async () => {
    process.env.REPLICATE_TTS_PREVIEW_MODEL = "gemini-3.1-flash-tts";
    process.env.REPLICATE_TTS_GENERATE_MODEL = "gemini-3.1-flash-tts";
    const run = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const provider = createReplicateProvider({ run });

    await provider.generate({
      text: "Once upon a time.",
      voiceId: "replicate-gemini-kore",
    });

    expect(run.mock.calls[0]?.[0]).toBe("google/gemini-3.1-flash-tts");
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      input: {
        text: "Once upon a time.",
        voice: "Kore",
        prompt: "Say the following.",
        language_code: "en-US",
      },
    });
    expect(run.mock.calls[0]?.[1].input).not.toHaveProperty("output_format");
  });

  it("normalizes short Gemini model ids", () => {
    expect(normalizeReplicateModel("gemini-3.8-flash-tts")).toBe("google/gemini-3.8-flash-tts");
    expect(normalizeReplicateModel("gemini-3.1-flash-tts")).toBe("google/gemini-3.1-flash-tts");
  });

  it("rejects unknown voices", async () => {
    delete process.env.REPLICATE_TTS_GENERATE_MODEL;
    const provider = createReplicateProvider({ run: vi.fn() });
    await expect(
      provider.generate({ text: "Hello", voiceId: "openai-alloy" }),
    ).rejects.toMatchObject({ code: "TTS_VOICE_NOT_FOUND" });
  });
});

describe("mapReplicateError", () => {
  it("maps rate limits and auth failures", () => {
    expect(mapReplicateError({ status: 429 }).code).toBe("TTS_RATE_LIMITED");
    expect(mapReplicateError({ status: 401 }).code).toBe("TTS_PROVIDER_UNAVAILABLE");
    expect(mapReplicateError({ status: 400, message: "invalid voice" }).code).toBe(
      "TTS_INVALID_REQUEST",
    );
  });

  it("maps MiniMax high-demand failures", () => {
    const mapped = mapReplicateError({
      message: "Prediction failed: ModelError: Service is currently unavailable due to high demand. Please try again later. (E003)",
    });
    expect(mapped.code).toBe("TTS_PROVIDER_BUSY");
    expect(mapped.message).toContain("busy");
    expect(mapped.message).toContain("retry from here");
  });

  it("maps Gemini content_blocked failures", () => {
    const mapped = mapReplicateError({
      message:
        'The input was invalid. (E006): Invalid request: {"error":{"message":"Request blocked for an unspecified policy reason.","code":"content_blocked"}}',
    });
    expect(mapped.code).toBe("TTS_CONTENT_REJECTED");
  });

  it("preserves AppError instances", () => {
    const original = new AppError("TTS_VOICE_NOT_FOUND", "missing", 404);
    expect(mapReplicateError(original)).toBe(original);
  });
});
