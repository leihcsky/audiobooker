import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({}) }));

import {
  assembleSegments,
  matchSegments,
  parseSegmentManifest,
  planChapterChunks,
  sliceSegments,
} from "@/lib/tts/segments";
import type { TTSProvider, VoiceDefinition } from "@/lib/tts/types";

const FRAME_SECONDS = 1152 / 44100;

function mp3Frames(count: number, fill = 0): Buffer {
  const frame = Buffer.alloc(417, fill);
  frame.writeUInt32BE(0xfffb9000, 0);
  return Buffer.concat(Array.from({ length: count }, () => frame));
}

function withId3(audio: Buffer): Buffer {
  const header = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 4]);
  return Buffer.concat([header, Buffer.alloc(4), audio]);
}

const provider = {
  id: "edge",
  limits: { targetCharacters: 30, hardLimitCharacters: 3000 },
  modelFor: () => "edge-neural",
} as unknown as TTSProvider;

const voice = {
  id: "edge-en-us-ava",
  providerVoiceId: "en-US-AvaNeural",
  languageCode: "en-US",
} as VoiceDefinition;

describe("assembleSegments / sliceSegments", () => {
  it("records time and byte ranges, stripping ID3 tags", () => {
    const first = mp3Frames(10, 1);
    const second = mp3Frames(20, 2);
    const { audio, manifest } = assembleSegments(
      [
        { paragraph: 0, cacheKey: "a", audio: withId3(first) },
        { paragraph: 1, cacheKey: "b", audio: second },
      ],
      { voiceId: "edge-en-us-ava", speed: 1 },
    );

    expect(audio.length).toBe(first.length + second.length);
    expect(manifest.segments).toEqual([
      { paragraph: 0, cacheKey: "a", start: 0, duration: Math.round(10 * FRAME_SECONDS * 1000) / 1000, offset: 0, length: first.length },
      {
        paragraph: 1,
        cacheKey: "b",
        start: Math.round(10 * FRAME_SECONDS * 1000) / 1000,
        duration: Math.round(20 * FRAME_SECONDS * 1000) / 1000,
        offset: first.length,
        length: second.length,
      },
    ]);

    const slices = sliceSegments(audio, manifest);
    expect(slices.get("a")?.equals(first)).toBe(true);
    expect(slices.get("b")?.equals(second)).toBe(true);
  });

  it("skips segments outside the stored audio", () => {
    const { audio, manifest } = assembleSegments([{ paragraph: 0, cacheKey: "a", audio: mp3Frames(2) }], {
      voiceId: "v",
      speed: 1,
    });
    const slices = sliceSegments(audio.subarray(0, 100), manifest);
    expect(slices.size).toBe(0);
  });
});

describe("parseSegmentManifest", () => {
  it("accepts a valid manifest and rejects anything else", () => {
    const manifest = {
      version: 1,
      voiceId: "v",
      speed: 1,
      segments: [{ paragraph: 0, cacheKey: "a", start: 0, duration: 1, offset: 0, length: 10 }],
    };
    expect(parseSegmentManifest(manifest)).toEqual(manifest);
    expect(parseSegmentManifest(null)).toBeNull();
    expect(parseSegmentManifest({ ...manifest, version: 2 })).toBeNull();
  });
});

describe("planChapterChunks / matchSegments", () => {
  const plan = (text: string) => planChapterChunks({ text, provider, voice, speed: 1, rules: [] });

  it("keeps cache keys of untouched paragraphs when one paragraph is edited", () => {
    const before = plan("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
    const after = plan("First paragraph.\n\nSecond, edited.\n\nThird paragraph.");
    expect(after[0].cacheKey).toBe(before[0].cacheKey);
    expect(after[1].cacheKey).not.toBe(before[1].cacheKey);
    expect(after[2].cacheKey).toBe(before[2].cacheKey);
  });

  it("changes the cache key when a pronunciation rule applies", () => {
    const plain = plan("Hermione waved.");
    const ruled = planChapterChunks({
      text: "Hermione waved.",
      provider,
      voice,
      speed: 1,
      rules: [{ term: "Hermione", replacement: "Her-MY-oh-nee", caseSensitive: false, wholeWord: true }],
    });
    expect(ruled[0].cacheKey).not.toBe(plain[0].cacheKey);
  });

  it("matches segments in order across an inserted paragraph", () => {
    const original = plan("One.\n\nTwo.\n\nThree.");
    const { manifest } = assembleSegments(
      original.map((chunk) => ({ paragraph: chunk.paragraph, cacheKey: chunk.cacheKey, audio: mp3Frames(5) })),
      { voiceId: "v", speed: 1 },
    );
    const edited = plan("One.\n\nNew.\n\nTwo.\n\nThree.");
    const matches = matchSegments(edited, manifest);
    expect(matches.map((segment) => segment?.paragraph ?? null)).toEqual([0, null, 1, 2]);
  });
});
