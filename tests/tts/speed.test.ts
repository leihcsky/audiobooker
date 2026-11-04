import { describe, expect, it } from "vitest";
import { DEFAULT_SPEECH_SPEED, effectiveSpeechSpeed, normalizeSpeechSpeed } from "@/lib/tts/speed";

describe("normalizeSpeechSpeed", () => {
  it("defaults, clamps, and rounds to two decimals", () => {
    expect(normalizeSpeechSpeed(undefined)).toBe(DEFAULT_SPEECH_SPEED);
    expect(normalizeSpeechSpeed(Number.NaN)).toBe(1);
    expect(normalizeSpeechSpeed(0.2)).toBe(0.5);
    expect(normalizeSpeechSpeed(3)).toBe(2);
    expect(normalizeSpeechSpeed(1.234)).toBe(1.23);
  });
});

describe("effectiveSpeechSpeed", () => {
  it("forces 1.0 when the voice does not support speed", () => {
    expect(effectiveSpeechSpeed(1.5, false)).toBe(1);
    expect(effectiveSpeechSpeed(1.5, true)).toBe(1.5);
    expect(effectiveSpeechSpeed(1.5, undefined)).toBe(1.5);
  });
});
