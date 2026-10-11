import { describe, expect, it, vi } from "vitest";
import {
  createReplicateProvider,
  resolveGenerateModel,
} from "@/lib/tts/providers/replicate";
import { mapReplicateError } from "@/lib/tts/replicate-errors";
import { AppError } from "@/lib/api/errors";

describe("replicate TTS adapter", () => {
  it("uses MiniMax turbo for preview and HD for chapter generation", async () => {
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
    const previous = process.env.REPLICATE_TTS_GENERATE_MODEL;
    process.env.REPLICATE_TTS_GENERATE_MODEL = "minimax/speech-2.8-turbo";
    expect(resolveGenerateModel()).toBe("minimax/speech-2.8-hd");
    if (previous === undefined) {
      delete process.env.REPLICATE_TTS_GENERATE_MODEL;
    } else {
      process.env.REPLICATE_TTS_GENERATE_MODEL = previous;
    }
  });

  it("rejects unknown voices", async () => {
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

  it("preserves AppError instances", () => {
    const original = new AppError("TTS_VOICE_NOT_FOUND", "missing", 404);
    expect(mapReplicateError(original)).toBe(original);
  });
});
