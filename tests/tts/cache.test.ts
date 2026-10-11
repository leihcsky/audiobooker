import { describe, expect, it } from "vitest";
import { buildTtsCacheKey, hashText, ttsCacheObjectKey, type TtsCacheKeyInput } from "@/lib/tts/cache";

const base: TtsCacheKeyInput = {
  provider: "edge",
  providerModel: "edge-neural",
  providerVoiceId: "en-US-AvaNeural",
  language: "en-US",
  speed: 1,
  pitch: "+0Hz",
  volume: "+0%",
  text: "Once upon a time.",
};

describe("TTS cache key", () => {
  it("is stable for identical requests", () => {
    expect(buildTtsCacheKey(base)).toEqual(buildTtsCacheKey({ ...base }));
    expect(buildTtsCacheKey(base).cacheKey).toMatch(/^[0-9a-f]{64}$/);
    expect(buildTtsCacheKey(base).textHash).toBe(hashText(base.text));
  });

  it("changes when any synthesis setting or the text changes", () => {
    const key = buildTtsCacheKey(base).cacheKey;
    const variants: Partial<TtsCacheKeyInput>[] = [
      { provider: "replicate" },
      { providerModel: "minimax/speech-2.8-hd" },
      { providerVoiceId: "en-US-AndrewNeural" },
      { language: "en-GB" },
      { speed: 1.25 },
      { pitch: "+2Hz" },
      { volume: "+10%" },
      { text: "Once upon a time!" },
    ];
    for (const variant of variants) {
      expect(buildTtsCacheKey({ ...base, ...variant }).cacheKey).not.toBe(key);
    }
  });

  it("stores cache objects in a separate namespace", () => {
    const { cacheKey } = buildTtsCacheKey(base);
    expect(ttsCacheObjectKey(cacheKey)).toBe(`tts-cache/${cacheKey}.mp3`);
  });
});
