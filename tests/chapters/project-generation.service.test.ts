import { beforeEach, describe, expect, it, vi } from "vitest";

const jobFindFirst = vi.hoisted(() => vi.fn());
const jobCreate = vi.hoisted(() => vi.fn());
const jobCreateMany = vi.hoisted(() => vi.fn());
const jobUpdateMany = vi.hoisted(() => vi.fn());
const chapterFindMany = vi.hoisted(() => vi.fn());
const chapterUpdateMany = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const assertProjectAccess = vi.hoisted(() => vi.fn());
const resolveVoice = vi.hoisted(() => vi.fn());
const getVoiceAccess = vi.hoisted(() => vi.fn());
const assertProjectWithinPlan = vi.hoisted(() => vi.fn());
const assertPremiumBalance = vi.hoisted(() => vi.fn());
const reserveCredits = vi.hoisted(() => vi.fn());
const assertAnonymousJobConcurrency = vi.hoisted(() => vi.fn());
const assertStandardCapacityForActor = vi.hoisted(() => vi.fn());
const assertEdgeDailyCapacity = vi.hoisted(() => vi.fn());
const assertPremiumBatchCostGuard = vi.hoisted(() => vi.fn());
const findLatestProjectGenerationJob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generationJob: {
      findFirst: jobFindFirst,
      create: jobCreate,
      createMany: jobCreateMany,
      updateMany: jobUpdateMany,
    },
    chapter: { findMany: chapterFindMany, updateMany: chapterUpdateMany },
    $transaction: transaction,
  },
}));
vi.mock("@/lib/tools/access", () => ({ assertProjectAccess }));
vi.mock("@/lib/tts", () => ({ resolveVoice }));
vi.mock("@/lib/billing/entitlements", () => ({ getVoiceAccess, assertProjectWithinPlan }));
vi.mock("@/lib/billing/credits.service", () => ({ assertPremiumBalance, reserveCredits }));
vi.mock("@/lib/usage/usage.service", () => ({
  assertAnonymousJobConcurrency,
  assertStandardCapacityForActor,
  assertEdgeDailyCapacity,
  assertPremiumBatchCostGuard,
}));
vi.mock("@/lib/projects/project.detail", () => ({
  findLatestProjectGenerationJob,
  toProjectGenerationSummary: async (job: { id: string; status: string; totalChunks: number }) => ({
    job: { id: job.id, status: job.status },
    totalChapters: job.totalChunks,
    completedChapters: 0,
    currentChapterId: null,
  }),
}));

import {
  cancelProjectGenerationForActor,
  getProjectGenerationForActor,
  selectChaptersToNarrate,
  startProjectGeneration,
} from "@/lib/chapters/project-generation.service";
import { AppError } from "@/lib/api/errors";
import { countMiniMaxBillableCharacters } from "@/lib/tts/pricing";

const projectId = "11111111-1111-4111-8111-111111111111";
const user = { type: "user", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as const;
const anonymous = { type: "anonymous", sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } as const;

function chapter(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    included: true,
    status: "PENDING",
    characterCount: 1000,
    currentAudioFileId: null,
    audioOutdated: false,
    ...overrides,
  };
}

function resolved(tier: "standard" | "premium") {
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
        model: tier === "standard" ? "edge-neural" : "minimax/speech-2.8-hd",
        estimatedCost: tier === "standard" ? 0 : characters / 1000,
        currency: "USD",
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue({ id: projectId });
  resolveVoice.mockReturnValue(resolved("standard"));
  getVoiceAccess.mockResolvedValue({ premium: false });
  assertProjectWithinPlan.mockResolvedValue(undefined);
  assertPremiumBalance.mockResolvedValue(undefined);
  reserveCredits.mockResolvedValue(undefined);
  jobFindFirst.mockResolvedValue(null);
  jobCreate.mockImplementation(({ data }) => ({ ...data, status: "QUEUED" }));
  transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? arg({
          generationJob: { create: jobCreate, createMany: jobCreateMany },
          chapter: { updateMany: chapterUpdateMany },
        })
      : Promise.all(arg as unknown[]),
  );
});

describe("selectChaptersToNarrate", () => {
  const chapters = [
    chapter("a", { currentAudioFileId: "audio-a" }),
    chapter("b"),
    chapter("c", { currentAudioFileId: "audio-c", audioOutdated: true }),
    chapter("d", { included: false }),
    chapter("e", { status: "GENERATING" }),
    chapter("f", { characterCount: 0 }),
  ];

  it("defaults to included chapters with missing or outdated audio", () => {
    expect(selectChaptersToNarrate(chapters).map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("honours an explicit list, in chapter order", () => {
    expect(selectChaptersToNarrate(chapters, ["c", "a"]).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("rejects explicit ids that are excluded or unknown", () => {
    expect(() => selectChaptersToNarrate(chapters, ["d"])).toThrow(AppError);
    expect(() => selectChaptersToNarrate(chapters, ["zzz"])).toThrow(AppError);
  });
});

describe("startProjectGeneration", () => {
  it("creates one parent job and a queued child per chapter", async () => {
    chapterFindMany.mockResolvedValue([chapter("a", { characterCount: 400 }), chapter("b", { characterCount: 600 })]);

    const result = await startProjectGeneration({ actor: user, projectId, voiceId: "edge-en-us-ava", speed: 1.2 });

    expect(result.created).toBe(true);
    const parent = jobCreate.mock.calls[0][0].data;
    expect(parent).toMatchObject({
      type: "GENERATE_PROJECT",
      status: "QUEUED",
      inputCharacters: 1000,
      totalChunks: 2,
    });
    expect(parent).not.toHaveProperty("tier");
    expect(parent).not.toHaveProperty("estimatedCost");
    const children = jobCreateMany.mock.calls[0][0].data;
    expect(children.map((c: { chapterId: string }) => c.chapterId)).toEqual(["a", "b"]);
    expect(children.every((c: { parentJobId: string; type: string }) => c.parentJobId === parent.id && c.type === "GENERATE_TTS")).toBe(true);
    expect(chapterUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] } },
      data: { selectedVoiceId: "edge-en-us-ava", selectedSpeed: 1.2 },
    });
    expect(assertStandardCapacityForActor).toHaveBeenCalledWith(user, 1000);
    expect(assertEdgeDailyCapacity).toHaveBeenCalledWith(1000);
    expect(assertPremiumBatchCostGuard).not.toHaveBeenCalled();
    expect(reserveCredits).not.toHaveBeenCalled();
  });

  it("returns the active generation instead of starting another", async () => {
    jobFindFirst.mockResolvedValue({ id: "active-job", status: "PROCESSING", totalChunks: 3 });
    const result = await startProjectGeneration({ actor: user, projectId, voiceId: "edge-en-us-ava" });
    expect(result).toMatchObject({ created: false, generation: { job: { id: "active-job" } } });
    expect(jobCreate).not.toHaveBeenCalled();
  });

  it("guards premium cost and reserves seconds per chapter", async () => {
    resolveVoice.mockReturnValue(resolved("premium"));
    chapterFindMany
      .mockResolvedValueOnce([chapter("a", { characterCount: 2000 }), chapter("b", { characterCount: 3000 })])
      .mockResolvedValueOnce([
        { id: "a", sourceText: "中".repeat(1000) + "a".repeat(1000) },
        { id: "b", sourceText: "b".repeat(3000) },
      ]);
    await startProjectGeneration({ actor: user, projectId, voiceId: "replicate-wise-woman" });
    expect(chapterFindMany).toHaveBeenLastCalledWith({
      where: { id: { in: ["a", "b"] } },
      select: { id: true, sourceText: true },
    });
    expect(assertPremiumBatchCostGuard).toHaveBeenCalledWith([3, 3]);
    expect(assertEdgeDailyCapacity).not.toHaveBeenCalled();
    expect(assertStandardCapacityForActor).not.toHaveBeenCalled();
    expect(assertPremiumBalance).toHaveBeenCalledWith(user.userId, 160 + 240);
    const children = jobCreateMany.mock.calls[0][0].data as { id: string }[];
    expect(reserveCredits).toHaveBeenCalledTimes(2);
    expect(reserveCredits).toHaveBeenNthCalledWith(1, expect.anything(), {
      userId: user.userId,
      jobId: children[0].id,
      seconds: 160,
    });
    expect(reserveCredits).toHaveBeenNthCalledWith(2, expect.anything(), {
      userId: user.userId,
      jobId: children[1].id,
      seconds: 240,
    });
  });

  it("creates nothing when premium minutes cannot cover every chapter", async () => {
    resolveVoice.mockReturnValue(resolved("premium"));
    chapterFindMany.mockResolvedValue([chapter("a")]);
    assertPremiumBalance.mockRejectedValueOnce(new AppError("TTS_PREMIUM_QUOTA_EXCEEDED", "short", 402));
    await expect(
      startProjectGeneration({ actor: user, projectId, voiceId: "replicate-wise-woman" }),
    ).rejects.toMatchObject({ code: "TTS_PREMIUM_QUOTA_EXCEEDED" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("checks anonymous concurrency", async () => {
    chapterFindMany.mockResolvedValue([chapter("a")]);
    await startProjectGeneration({ actor: anonymous, projectId, voiceId: "edge-en-us-ava" });
    expect(assertAnonymousJobConcurrency).toHaveBeenCalledWith(anonymous.sessionId);
  });

  it("fails clearly when nothing needs narration", async () => {
    chapterFindMany.mockResolvedValue([chapter("a", { currentAudioFileId: "audio-a" })]);
    await expect(
      startProjectGeneration({ actor: user, projectId, voiceId: "edge-en-us-ava" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(jobCreate).not.toHaveBeenCalled();
  });

  it("does not create jobs when capacity is exhausted", async () => {
    chapterFindMany.mockResolvedValue([chapter("a")]);
    assertStandardCapacityForActor.mockRejectedValueOnce(new AppError("USAGE_LIMIT_EXCEEDED", "Limit", 429));
    await expect(
      startProjectGeneration({ actor: user, projectId, voiceId: "edge-en-us-ava" }),
    ).rejects.toMatchObject({ code: "USAGE_LIMIT_EXCEEDED" });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("getProjectGenerationForActor", () => {
  it("flags queued and stale jobs for resume", async () => {
    findLatestProjectGenerationJob.mockResolvedValue({
      id: "job-1",
      status: "PROCESSING",
      totalChunks: 2,
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    expect((await getProjectGenerationForActor(user, projectId)).resumeJobId).toBe("job-1");
  });

  it("does not resume a job that is still heartbeating", async () => {
    findLatestProjectGenerationJob.mockResolvedValue({
      id: "job-1",
      status: "PROCESSING",
      totalChunks: 2,
      updatedAt: new Date(),
    });
    expect((await getProjectGenerationForActor(user, projectId)).resumeJobId).toBeNull();
  });
});

describe("cancelProjectGenerationForActor", () => {
  it("cancels the parent and its queued children", async () => {
    jobFindFirst.mockResolvedValue({ id: "job-1", status: "PROCESSING", totalChunks: 2 });
    findLatestProjectGenerationJob.mockResolvedValue({ id: "job-1", status: "CANCELLED", totalChunks: 2 });

    const generation = await cancelProjectGenerationForActor(user, projectId);

    expect(jobUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentJobId: "job-1", status: "QUEUED" } }),
    );
    expect(generation?.job.status).toBe("CANCELLED");
  });
});
