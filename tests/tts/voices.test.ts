import { afterEach, describe, expect, it } from "vitest";

import { EDGE_VOICES } from "@/lib/tts/voices";
import { listAvailableVoices, resolveVoice } from "@/lib/tts/registry";

const ENV_KEYS = [
  "FEATURE_EDGE_TTS",
  "FEATURE_PREMIUM_TTS",
  "FEATURE_MINIMAX_TTS",
  "REPLICATE_API_TOKEN",
  "OPENAI_API_KEY",
] as const;
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const creator = { premium: true };
const standardOnly = { premium: false };

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

function enablePremium() {
  process.env.FEATURE_PREMIUM_TTS = "true";
  process.env.REPLICATE_API_TOKEN = "r8_test";
}

describe("voice catalog", () => {
  it("uses unique Edge voice IDs tagged as standard", () => {
    const ids = EDGE_VOICES.map((voice) => voice.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EDGE_VOICES.every((voice) => voice.tier === "standard" && voice.provider === "edge")).toBe(true);
    expect(ids).toContain("edge-en-us-ava");
  });

  it("lists only standard voices while the premium flag is off, even for Creator", () => {
    delete process.env.FEATURE_PREMIUM_TTS;
    process.env.REPLICATE_API_TOKEN = "r8_test";
    const voices = listAvailableVoices(creator);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices.every((voice) => voice.tier === "standard")).toBe(true);
  });

  it("lists premium voices after standard ones for Creator", () => {
    enablePremium();
    const voices = listAvailableVoices(creator);
    const firstPremium = voices.findIndex((voice) => voice.tier === "premium");
    expect(firstPremium).toBeGreaterThan(0);
    expect(voices.slice(firstPremium).every((voice) => voice.tier === "premium")).toBe(true);
  });

  it("never lists premium voices without premium access", () => {
    enablePremium();
    expect(listAvailableVoices(standardOnly).some((voice) => voice.tier === "premium")).toBe(false);
  });

  it("filters by language and tier", () => {
    const zh = listAvailableVoices(standardOnly, { language: "zh" });
    expect(zh.length).toBeGreaterThan(0);
    expect(zh.every((voice) => voice.languageCode.startsWith("zh"))).toBe(true);
    expect(listAvailableVoices(standardOnly, { tier: "premium" })).toEqual([]);
  });
});

describe("resolveVoice", () => {
  it("resolves a standard voice to the Edge provider", () => {
    const { provider, voice } = resolveVoice(standardOnly, "edge-en-us-ava");
    expect(provider.id).toBe("edge");
    expect(provider.tier).toBe("standard");
    expect(voice.providerVoiceId).toBe("en-US-AvaNeural");
  });

  it("rejects premium voices without premium access", () => {
    enablePremium();
    expect(() => resolveVoice(standardOnly, "replicate-wise-woman")).toThrow(
      expect.objectContaining({ code: "TTS_PREMIUM_NOT_AVAILABLE" }),
    );
  });

  it("rejects premium voices while the premium flag is off", () => {
    delete process.env.FEATURE_PREMIUM_TTS;
    process.env.REPLICATE_API_TOKEN = "r8_test";
    expect(() => resolveVoice(creator, "replicate-wise-woman")).toThrow(
      expect.objectContaining({ code: "TTS_PREMIUM_NOT_AVAILABLE" }),
    );
  });

  it("allows premium voices for Creator when enabled", () => {
    enablePremium();
    expect(resolveVoice(creator, "replicate-wise-woman").provider.id).toBe("replicate");
  });

  it("does not switch to a paid provider when Edge is disabled", () => {
    enablePremium();
    process.env.FEATURE_EDGE_TTS = "false";
    expect(() => resolveVoice(creator, "edge-en-us-ava")).toThrow(
      expect.objectContaining({ code: "TTS_PROVIDER_UNAVAILABLE" }),
    );
  });

  it("rejects a quality that does not match the voice tier", () => {
    expect(() => resolveVoice(creator, "edge-en-us-ava", { quality: "premium" })).toThrow(
      expect.objectContaining({ code: "TTS_INVALID_REQUEST" }),
    );
  });

  it("rejects unknown voices", () => {
    expect(() => resolveVoice(creator, "edge-xx-nobody")).toThrow(
      expect.objectContaining({ code: "TTS_VOICE_NOT_FOUND" }),
    );
  });
});
