import { beforeEach, describe, expect, it, vi } from "vitest";

const getVoiceAccess = vi.hoisted(() => vi.fn());
const getPremiumBalance = vi.hoisted(() => vi.fn());
const resolveVoice = vi.hoisted(() => vi.fn());
const readTtsCache = vi.hoisted(() => vi.fn());
const writeTtsCache = vi.hoisted(() => vi.fn());
const assertPremiumPreviewBudget = vi.hoisted(() => vi.fn());
const countRecentVoicePreviews = vi.hoisted(() => vi.fn());
const recordVoicePreview = vi.hoisted(() => vi.fn());
const preview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/billing/entitlements", () => ({ getVoiceAccess }));
vi.mock("@/lib/billing/credits.service", () => ({ getPremiumBalance }));
vi.mock("@/lib/tts", () => ({ resolveVoice, listAvailableVoices: vi.fn() }));
vi.mock("@/lib/tts/cache", () => ({
  buildTtsCacheKey: () => ({ cacheKey: "key", textHash: "hash" }),
  DEFAULT_PITCH: 0,
  DEFAULT_VOLUME: 1,
  readTtsCache,
  writeTtsCache,
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    putObject: vi.fn(),
    createDownloadUrl: async () => ({
      downloadUrl: "https://signed.example/preview.mp3",
      expiresAt: new Date("2026-10-11T00:00:00Z"),
    }),
  }),
}));
vi.mock("@/lib/usage/usage.service", () => ({
  assertAnonymousPreviewLimit: vi.fn(),
  assertPremiumPreviewBudget,
  countRecentVoicePreviews,
  recordVoicePreview,
}));

import { countMiniMaxBillableCharacters } from "@/lib/tts/pricing";
import { VOICE_PREVIEW_SAMPLE } from "@/lib/tts/preview-sample";
import { previewVoiceForActor } from "@/lib/voices/voice.service";

const user = { type: "user", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as const;

function premiumVoice() {
  return {
    voice: {
      id: "replicate-wise-woman",
      providerVoiceId: "Wise_Woman",
      languageCode: "en-US",
      tier: "premium",
    },
    provider: {
      id: "replicate",
      modelFor: () => "minimax/speech-2.8-turbo",
      billableCharacters: countMiniMaxBillableCharacters,
      estimateCost: ({ characters }: { characters: number }) => ({
        estimatedCost: (characters / 1000) * 0.06,
      }),
      preview,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getVoiceAccess.mockResolvedValue({ premium: true });
  resolveVoice.mockReturnValue(premiumVoice());
  countRecentVoicePreviews.mockResolvedValue(0);
  readTtsCache.mockResolvedValue(null);
  preview.mockResolvedValue({ audio: Buffer.from("mp3") });
  getPremiumBalance.mockResolvedValue({ balance: { availableSeconds: 0 } });
});

describe("premium voice previews", () => {
  it("only allows the fixed sample without premium minutes", async () => {
    await expect(
      previewVoiceForActor({ actor: user, voiceId: "replicate-wise-woman", text: "My own text" }),
    ).rejects.toMatchObject({ code: "TTS_PREMIUM_QUOTA_EXCEEDED" });
    expect(preview).not.toHaveBeenCalled();
  });

  it("allows custom text once the account has premium minutes", async () => {
    getPremiumBalance.mockResolvedValue({ balance: { availableSeconds: 600 } });
    await previewVoiceForActor({ actor: user, voiceId: "replicate-wise-woman", text: "My own text" });
    expect(preview).toHaveBeenCalled();
  });

  it("does not check the balance for the sample", async () => {
    await previewVoiceForActor({ actor: user, voiceId: "replicate-wise-woman" });
    expect(getPremiumBalance).not.toHaveBeenCalled();
  });

  it("checks the daily budget and records billed characters on a cache miss", async () => {
    await previewVoiceForActor({ actor: user, voiceId: "replicate-wise-woman" });
    const billed = VOICE_PREVIEW_SAMPLE.trim().length;
    expect(assertPremiumPreviewBudget).toHaveBeenCalledWith((billed / 1000) * 0.06);
    expect(recordVoicePreview).toHaveBeenCalledWith(
      expect.objectContaining({ billedCharacters: billed, provider: "replicate" }),
    );
  });

  it("costs nothing when the sample is cached", async () => {
    readTtsCache.mockResolvedValue({ audio: Buffer.from("mp3") });
    await previewVoiceForActor({ actor: user, voiceId: "replicate-wise-woman" });
    expect(assertPremiumPreviewBudget).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    expect(recordVoicePreview).toHaveBeenCalledWith(expect.objectContaining({ billedCharacters: 0 }));
  });
});
