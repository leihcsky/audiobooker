import { describe, expect, it } from "vitest";
import { mapOpenAIError } from "@/lib/tts/openai-errors";
import { AppError } from "@/lib/api/errors";

describe("mapOpenAIError", () => {
  it("maps rate limits", () => {
    const error = mapOpenAIError({ status: 429, code: "rate_limit_exceeded" });
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("TTS_RATE_LIMITED");
  });

  it("maps provider outages", () => {
    expect(mapOpenAIError({ status: 503 }).code).toBe("TTS_PROVIDER_UNAVAILABLE");
    expect(mapOpenAIError({ status: 401 }).code).toBe("TTS_PROVIDER_UNAVAILABLE");
  });

  it("maps invalid requests", () => {
    expect(mapOpenAIError({ status: 400, code: "invalid_request" }).code).toBe("TTS_INVALID_REQUEST");
  });

  it("maps content policy rejections", () => {
    expect(
      mapOpenAIError({ status: 400, error: { code: "content_policy_violation" } }).code,
    ).toBe("TTS_CONTENT_REJECTED");
  });

  it("maps unknown failures", () => {
    expect(mapOpenAIError(new Error("boom")).code).toBe("TTS_GENERATION_FAILED");
  });

  it("preserves AppError instances", () => {
    const original = new AppError("TTS_VOICE_NOT_FOUND", "missing", 404);
    expect(mapOpenAIError(original)).toBe(original);
  });
});
