import { describe, expect, it } from "vitest";
import { FILE_LIMITS } from "@/lib/config/limits";
import { VOICE_PREVIEW_SAMPLE } from "@/lib/tts/preview-sample";

describe("voice preview sample", () => {
  it("is a fixed paragraph long enough for about fifteen seconds", () => {
    expect(VOICE_PREVIEW_SAMPLE.length).toBeGreaterThanOrEqual(250);
    expect(VOICE_PREVIEW_SAMPLE.length).toBeLessThanOrEqual(320);
    expect(VOICE_PREVIEW_SAMPLE.length).toBeLessThanOrEqual(FILE_LIMITS.TTS_PREVIEW_MAX_CHARS);
  });
});
