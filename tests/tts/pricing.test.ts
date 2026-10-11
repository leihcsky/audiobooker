import { describe, expect, it } from "vitest";
import { countMiniMaxBillableCharacters, estimateCostFor } from "@/lib/tts/pricing";
import { createReplicateProvider } from "@/lib/tts/providers/replicate";

describe("MiniMax billable characters", () => {
  it("counts each Chinese character as 2 and everything else as 1", () => {
    expect(countMiniMaxBillableCharacters("Hello, world.")).toBe(13);
    expect(countMiniMaxBillableCharacters("你好，世界。")).toBe(10);
    expect(countMiniMaxBillableCharacters("第1章 Chapter")).toBe(13);
    expect(countMiniMaxBillableCharacters("")).toBe(0);
  });

  it("is what the Replicate provider bills", () => {
    const provider = createReplicateProvider({ run: async () => null });
    const characters = provider.billableCharacters("中".repeat(1000));
    expect(characters).toBe(2000);
    expect(provider.estimateCost({ characters, purpose: "generate" }).estimatedCost).toBe(0.2);
  });
});

describe("TTS cost estimation", () => {
  it("prices MiniMax HD per 1K characters", () => {
    expect(
      estimateCostFor({ providerId: "replicate", model: "minimax/speech-2.8-hd", characters: 3600 }),
    ).toEqual({
      providerId: "replicate",
      model: "minimax/speech-2.8-hd",
      characters: 3600,
      estimatedCost: 0.36,
      currency: "USD",
    });
  });

  it("records Edge as zero direct provider cost", () => {
    expect(estimateCostFor({ providerId: "edge", model: "edge-neural", characters: 3600 }).estimatedCost).toBe(0);
  });

  it("prices unknown premium models at the provider's highest known rate", () => {
    expect(
      estimateCostFor({ providerId: "replicate", model: "minimax/speech-9", characters: 1000 }).estimatedCost,
    ).toBe(0.1);
  });
});
