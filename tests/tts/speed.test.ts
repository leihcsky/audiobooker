import { describe, expect, it } from "vitest";
import { DEFAULT_SPEECH_SPEED, normalizeSpeechSpeed } from "@/lib/tts/speed";

describe("normalizeSpeechSpeed", () => {
  it("defaults, clamps, and rounds to two decimals", () => {
    expect(normalizeSpeechSpeed(undefined)).toBe(DEFAULT_SPEECH_SPEED);
    expect(normalizeSpeechSpeed(Number.NaN)).toBe(1);
    expect(normalizeSpeechSpeed(0.2)).toBe(0.5);
    expect(normalizeSpeechSpeed(3)).toBe(2);
    expect(normalizeSpeechSpeed(1.234)).toBe(1.23);
  });
});
