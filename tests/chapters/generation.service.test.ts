import { beforeEach, describe, expect, it, vi } from "vitest";

const getChapterForActor = vi.hoisted(() => vi.fn());
const assertStandardCapacityForActor = vi.hoisted(() => vi.fn());
const assertAnonymousJobConcurrency = vi.hoisted(() => vi.fn());
const assertPremiumCostGuard = vi.hoisted(() => vi.fn());
const assertEdgeDailyCapacity = vi.hoisted(() => vi.fn());
const resolveVoice = vi.hoisted(() => vi.fn());
const getVoiceAccess = vi.hoisted(() => vi.fn());
const assertProjectWithinPlan = vi.hoisted(() => vi.fn());
const assertPremiumBalance = vi.hoisted(() => vi.fn());
const reserveCredits = vi.hoisted(() => vi.fn());
const chapterFindUnique = vi.hoisted(() => vi.fn());
const chapterUpdate = vi.hoisted(() => vi.fn());
const jobFindFirst = vi.hoisted(() => vi.fn());
const jobCreate = vi.hoisted(() => vi.fn());
const jobUpdateMany = vi.hoisted(() => vi.fn());
const jobCount = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const transaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/chapters/chapter.service", () => ({
  getChapterForActor,
}));

vi.mock("@/lib/usage/usage.service", () => ({
  assertStandardCapacityForActor,
  assertAnonymousJobConcurrency,
  assertPremiumCostGuard,
  assertEdgeDailyCapacity,
}));

vi.mock("@/lib/tts", () => ({
  resolveVoice,
}));

vi.mock("@/lib/billing/entitlements", () => ({
  getVoiceAccess,
  assertProjectWithinPlan,
}));

vi.mock("@/lib/billing/credits.service", () => ({
  assertPremiumBalance,
  reserveCredits,
}));

function resolved(tier: "standard" | "premium", pricePer1K = 0) {
  return {
    voice: {
      id: tier === "standard" ? "edge-en-us-ava" : "replicate-wise-woman",
      tier,
      languageCode: "en-US",
    },
    provider: {
      id: tier === "standard" ? "edge" : "replicate",
      billableCharacters:
        tier === "standard" ? (text: string) => text.length : countMiniMaxBillableCharacters,
      estimateCost: ({ characters }: { characters: number }) => ({
        providerId: tier === "standard" ? "edge" : "replicate",
        model: tier === "standard" ? "edge-neural" : "minimax/speech-2.8-hd",
        characters,
        estimatedCost: (characters / 1000) * pricePer1K,
        currency: "USD",
      }),
    },
  };
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    chapter: { findUnique: chapterFindUnique, update: chapterUpdate },
    generationJob: {
      findFirst: jobFindFirst,
      create: jobCreate,
      updateMany: jobUpdateMany,
      count: jobCount,
    },
    $transaction: transaction,
  },
}));

import { startChapterGeneration } from "@/lib/chapters/generation.service";
import { AppError } from "@/lib/api/errors";
import { countMiniMaxBillableCharacters } from "@/lib/tts/pricing";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const chapterId = "33333333-3333-4333-8333-333333333333";
const projectId = "11111111-1111-4111-8111-111111111111";
const text = "Once upon a time.";

function chapterDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: chapterId,
    projectId,
    title: "Chapter 1",
    orderIndex: 1,
    sourceText: text,
    characterCount: 18,
    wordCount: 4,
    status: "PENDING",
    selectedVoiceId: null,
    selectedSpeed: 1,
    hasAudio: false,
    currentAudio: null,
    latestTtsJob: null,
    ...overrides,
  };
}

function queuedJob(id: string) {
  return {
    id,
    type: "GENERATE_TTS",
    status: "QUEUED",
    errorCode: null,
    createdAt: new Date("2026-09-25T12:00:00.000Z"),
    completedAt: null,
  };
}

describe("startChapterGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveVoice.mockReturnValue(resolved("standard"));
    getVoiceAccess.mockResolvedValue({ premium: false });
    assertProjectWithinPlan.mockResolvedValue(undefined);
    assertStandardCapacityForActor.mockResolvedValue(undefined);
    assertPremiumCostGuard.mockResolvedValue(undefined);
    assertPremiumBalance.mockResolvedValue(undefined);
    reserveCredits.mockResolvedValue(undefined);
    assertEdgeDailyCapacity.mockResolvedValue(undefined);
    assertAnonymousJobConcurrency.mockResolvedValue(undefined);
    chapterFindUnique.mockResolvedValue({ status: "PENDING", projectId, included: true });
    jobUpdateMany.mockResolvedValue({ count: 0 });
    transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) =>
      run({ generationJob: { create: jobCreate }, chapter: { update: chapterUpdate } }),
    );
  });

  it("rejects another user's chapter", async () => {
    getChapterForActor.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this chapter.", 403),
    );

    await expect(
      startChapterGeneration({ userId: ownerId, chapterId, voiceId: "edge-en-us-ava" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reuses an in-flight generation job", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail({ status: "GENERATING" }));
    chapterFindUnique.mockResolvedValue({ status: "GENERATING", projectId, included: true });
    jobFindFirst.mockResolvedValue({ ...queuedJob("job-1"), status: "PROCESSING" });

    const job = await startChapterGeneration({ userId: ownerId, chapterId, voiceId: "edge-en-us-ava" });

    expect(job.id).toBe("job-1");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects generation when usage is exhausted", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail());
    assertStandardCapacityForActor.mockRejectedValue(new AppError("USAGE_LIMIT_EXCEEDED", "limit", 429));

    await expect(
      startChapterGeneration({ userId: ownerId, chapterId, voiceId: "edge-en-us-ava" }),
    ).rejects.toMatchObject({ code: "USAGE_LIMIT_EXCEEDED" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("blocks projects beyond the plan's project limit", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail());
    assertProjectWithinPlan.mockRejectedValue(new AppError("PLAN_REQUIRED", "upgrade", 403));

    await expect(
      startChapterGeneration({ userId: ownerId, chapterId, voiceId: "edge-en-us-ava" }),
    ).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates a queued standard job without touching premium credits", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail());
    jobCreate.mockResolvedValue(queuedJob("job-2"));

    const job = await startChapterGeneration({ userId: ownerId, chapterId, voiceId: "edge-en-us-ava" });

    expect(assertStandardCapacityForActor).toHaveBeenCalledWith({ type: "user", userId: ownerId }, text.length);
    expect(assertPremiumCostGuard).not.toHaveBeenCalled();
    expect(assertPremiumBalance).not.toHaveBeenCalled();
    expect(reserveCredits).not.toHaveBeenCalled();
    expect(assertEdgeDailyCapacity).toHaveBeenCalledWith(text.length);
    expect(jobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "edge",
        providerModel: "edge-neural",
        tier: "STANDARD",
        estimatedCost: 0,
        currency: "USD",
      }),
    });
    expect(job.status).toBe("QUEUED");
    expect(jobUpdateMany).toHaveBeenCalled();
  });

  it("checks the balance and reserves premium seconds in the job transaction", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail());
    getVoiceAccess.mockResolvedValue({ premium: true });
    resolveVoice.mockReturnValue(resolved("premium", 0.1));
    jobCreate.mockResolvedValue(queuedJob("job-3"));

    await startChapterGeneration({ userId: ownerId, chapterId, voiceId: "replicate-wise-woman" });

    expect(resolveVoice).toHaveBeenCalledWith({ premium: true }, "replicate-wise-woman", {
      quality: undefined,
    });
    expect(assertStandardCapacityForActor).not.toHaveBeenCalled();
    expect(assertPremiumCostGuard).toHaveBeenCalledWith((text.length / 1000) * 0.1);
    expect(assertEdgeDailyCapacity).not.toHaveBeenCalled();
    const seconds = Math.ceil(text.length / 12.5);
    expect(assertPremiumBalance).toHaveBeenCalledWith(ownerId, seconds);
    expect(reserveCredits).toHaveBeenCalledWith(expect.anything(), {
      userId: ownerId,
      jobId: "job-3",
      seconds,
    });
    expect(jobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tier: "PREMIUM", provider: "replicate" }),
    });
  });

  it("reserves only the characters to synthesize and records retried paragraphs", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail());
    getVoiceAccess.mockResolvedValue({ premium: true });
    resolveVoice.mockReturnValue(resolved("premium", 0.1));
    jobCreate.mockResolvedValue(queuedJob("job-4"));

    await startChapterGeneration({
      userId: ownerId,
      chapterId,
      voiceId: "replicate-wise-woman",
      synthesisCharacters: 5,
      retryParagraphs: [0],
    });

    expect(assertPremiumCostGuard).toHaveBeenCalledWith((5 / 1000) * 0.1);
    expect(reserveCredits).toHaveBeenCalledWith(expect.anything(), {
      userId: ownerId,
      jobId: "job-4",
      seconds: Math.ceil(5 / 12.5),
    });
    expect(jobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ inputCharacters: text.length, retryParagraphs: [0] }),
    });
  });

  it("does not create a job when premium minutes are short", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail());
    resolveVoice.mockReturnValue(resolved("premium", 0.1));
    assertPremiumBalance.mockRejectedValue(new AppError("TTS_PREMIUM_QUOTA_EXCEEDED", "short", 402));

    await expect(
      startChapterGeneration({ userId: ownerId, chapterId, voiceId: "replicate-wise-woman" }),
    ).rejects.toMatchObject({ code: "TTS_PREMIUM_QUOTA_EXCEEDED" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("blocks a premium job when the cost guard rejects it", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail());
    resolveVoice.mockReturnValue(resolved("premium", 0.1));
    assertPremiumCostGuard.mockRejectedValue(new AppError("TTS_COST_LIMIT_EXCEEDED", "too costly", 422));

    await expect(
      startChapterGeneration({ userId: ownerId, chapterId, voiceId: "replicate-wise-woman" }),
    ).rejects.toMatchObject({ code: "TTS_COST_LIMIT_EXCEEDED" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects chapters that are not selected for narration", async () => {
    getChapterForActor.mockResolvedValue(chapterDetail({ included: false }));
    chapterFindUnique.mockResolvedValue({ status: "PENDING", projectId, included: false });

    await expect(
      startChapterGeneration({ userId: ownerId, chapterId, voiceId: "edge-en-us-ava" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(transaction).not.toHaveBeenCalled();
  });
});
