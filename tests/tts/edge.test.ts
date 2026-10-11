import { describe, expect, it, vi } from "vitest";
import {
  createEdgeProvider,
  EDGE_HARD_LIMIT_CHARACTERS,
  escapeXml,
  mapEdgeError,
  speedToEdgeRate,
} from "@/lib/tts/providers/edge";

describe("Edge TTS adapter", () => {
  it("sends escaped text, the Edge voice name, and the speaking rate", async () => {
    const synthesizeRaw = vi.fn().mockResolvedValue(Buffer.from("mp3"));
    const provider = createEdgeProvider({ synthesizeRaw });

    const result = await provider.generate({
      text: "Tom & Jerry <said> \"hi\"",
      voiceId: "edge-en-us-ava",
      speed: 1.25,
    });

    expect(result.audio.toString()).toBe("mp3");
    expect(synthesizeRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: "en-US-AvaNeural",
        ssmlText: "Tom &amp; Jerry &lt;said&gt; &quot;hi&quot;",
        rate: "+25%",
        pitch: "+0Hz",
        volume: "+0%",
      }),
    );
  });

  it("is a standard provider with zero direct cost", () => {
    const provider = createEdgeProvider({ synthesizeRaw: vi.fn() });
    expect(provider.tier).toBe("standard");
    expect(provider.estimateCost({ characters: 3600, purpose: "generate" })).toMatchObject({
      estimatedCost: 0,
      model: "edge-neural",
    });
    expect(provider.limits.maxBytes).toBeGreaterThan(0);
  });

  it("rejects voices from other providers", async () => {
    const provider = createEdgeProvider({ synthesizeRaw: vi.fn() });
    await expect(provider.generate({ text: "Hi", voiceId: "replicate-wise-woman" })).rejects.toMatchObject({
      code: "TTS_VOICE_NOT_FOUND",
    });
  });

  it("rejects text above the hard limit", async () => {
    const provider = createEdgeProvider({ synthesizeRaw: vi.fn() });
    await expect(
      provider.generate({ text: "a".repeat(EDGE_HARD_LIMIT_CHARACTERS + 1), voiceId: "edge-en-us-ava" }),
    ).rejects.toMatchObject({ code: "TTS_INVALID_REQUEST" });
  });

  it("maps empty audio and transport failures to stable codes", async () => {
    const empty = createEdgeProvider({ synthesizeRaw: vi.fn().mockResolvedValue(Buffer.alloc(0)) });
    await expect(empty.generate({ text: "Hi", voiceId: "edge-en-us-ava" })).rejects.toMatchObject({
      code: "TTS_AUDIO_INVALID",
    });

    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(mapEdgeError(new Error("Edge TTS request timed out.")).code).toBe("TTS_PROVIDER_TIMEOUT");
    expect(mapEdgeError(new Error("Unexpected server response: 429")).code).toBe("TTS_RATE_LIMITED");
    expect(mapEdgeError(new Error("Unexpected server response: 403")).code).toBe("TTS_PROVIDER_UNAVAILABLE");
    info.mockRestore();
  });

  it("formats rates and escapes XML", () => {
    expect(speedToEdgeRate(1)).toBe("+0%");
    expect(speedToEdgeRate(0.75)).toBe("-25%");
    expect(escapeXml("a'b")).toBe("a&apos;b");
  });
});
