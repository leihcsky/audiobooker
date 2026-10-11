import { describe, expect, it } from "vitest";
import { validateSynthesizedAudio } from "@/lib/tts/audio-validation";

function mp3Frames(count: number): Buffer {
  const frame = Buffer.alloc(417);
  frame.writeUInt32BE(0xfffb9000, 0);
  return Buffer.concat(Array.from({ length: count }, () => frame));
}

const FRAME_SECONDS = 1152 / 44100;

describe("validateSynthesizedAudio", () => {
  it("accepts readable MP3 of plausible length", () => {
    const frames = Math.ceil(20 / FRAME_SECONDS);
    const result = validateSynthesizedAudio(mp3Frames(frames), { characters: 300, speed: 1 });
    expect(result.durationSeconds).toBeGreaterThan(19);
  });

  it("rejects empty or unreadable output", () => {
    expect(() => validateSynthesizedAudio(Buffer.alloc(0), { characters: 10, speed: 1 })).toThrow(
      expect.objectContaining({ code: "TTS_AUDIO_INVALID" }),
    );
    expect(() => validateSynthesizedAudio(Buffer.from("not audio"), { characters: 10, speed: 1 })).toThrow(
      expect.objectContaining({ code: "TTS_AUDIO_INVALID" }),
    );
  });

  it("flags audio that is far too short for the text", () => {
    const oneSecond = mp3Frames(Math.ceil(1 / FRAME_SECONDS));
    expect(() =>
      validateSynthesizedAudio(oneSecond, { characters: 3000, speed: 1, maxCharsPerSecond: 45 }),
    ).toThrow(expect.objectContaining({ code: "TTS_AUDIO_TRUNCATED" }));
  });

  it("skips the truncation check for short text such as titles", () => {
    const tiny = mp3Frames(5);
    expect(() => validateSynthesizedAudio(tiny, { characters: 40, speed: 1 })).not.toThrow();
  });
});
