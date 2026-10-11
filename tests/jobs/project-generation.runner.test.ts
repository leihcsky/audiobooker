import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeJob = {
  id: string;
  status: string;
  chapterId: string | null;
  included?: boolean;
  outcome?: "COMPLETED" | "FAILED";
};

const state = vi.hoisted(() => ({
  parentStatus: "PROCESSING",
  children: [] as FakeJob[],
  completed: 0,
  ran: [] as string[],
}));

const claimProjectGenerationJob = vi.hoisted(() => vi.fn());
const runTtsJob = vi.hoisted(() => vi.fn());
const chapterUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/jobs/tts-claim", () => ({ claimProjectGenerationJob }));
vi.mock("@/lib/jobs/tts.runner", () => ({ runTtsJob }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    chapter: { update: chapterUpdate },
    generationJob: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === "parent") {
          return { status: state.parentStatus };
        }
        const child = state.children.find((job) => job.id === where.id);
        return child
          ? { status: child.status, errorCode: child.status === "FAILED" ? "TTS_PROVIDER_UNAVAILABLE" : null, errorMessage: child.status === "FAILED" ? "Busy" : null }
          : null;
      }),
      findFirst: vi.fn(async () => {
        const next = state.children.find((job) => job.status === "QUEUED" || job.status === "PROCESSING");
        return next
          ? { id: next.id, chapterId: next.chapterId, chapter: next.chapterId ? { included: next.included ?? true } : null }
          : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (where.id === "parent" && data.completedChunks) {
          state.completed += 1;
        }
        const child = state.children.find((job) => job.id === where.id);
        if (child && typeof data.status === "string") {
          child.status = data.status;
        }
        return {};
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id?: string; parentJobId?: string; status?: unknown }; data: { status?: string } }) => {
        if (where.id === "parent" && data.status && state.parentStatus === "PROCESSING") {
          state.parentStatus = data.status;
        }
        if (where.parentJobId === "parent" && data.status) {
          for (const job of state.children) {
            if (job.status === "QUEUED") {
              job.status = data.status;
            }
          }
        }
        return { count: 1 };
      }),
    },
  },
}));

import { runProjectGeneration } from "@/lib/jobs/project-generation.runner";

beforeEach(() => {
  vi.clearAllMocks();
  state.parentStatus = "PROCESSING";
  state.completed = 0;
  state.ran = [];
  claimProjectGenerationJob.mockResolvedValue(true);
  runTtsJob.mockImplementation(async (jobId: string) => {
    state.ran.push(jobId);
    const child = state.children.find((job) => job.id === jobId)!;
    child.status = child.outcome ?? "COMPLETED";
  });
});

describe("runProjectGeneration", () => {
  it("narrates chapters in order and completes", async () => {
    state.children = [
      { id: "c1", status: "QUEUED", chapterId: "ch1" },
      { id: "c2", status: "QUEUED", chapterId: "ch2" },
    ];
    await runProjectGeneration("parent");
    expect(state.ran).toEqual(["c1", "c2"]);
    expect(chapterUpdate).toHaveBeenCalledWith({ where: { id: "ch1" }, data: { status: "GENERATING" } });
    expect(state.completed).toBe(2);
    expect(state.parentStatus).toBe("COMPLETED");
  });

  it("stops at the first failure and cancels the rest", async () => {
    state.children = [
      { id: "c1", status: "QUEUED", chapterId: "ch1" },
      { id: "c2", status: "QUEUED", chapterId: "ch2", outcome: "FAILED" },
      { id: "c3", status: "QUEUED", chapterId: "ch3" },
    ];
    await runProjectGeneration("parent");
    expect(state.ran).toEqual(["c1", "c2"]);
    expect(state.parentStatus).toBe("FAILED");
    expect(state.children[2].status).toBe("CANCELLED");
    expect(state.completed).toBe(1);
  });

  it("stops between chapters once cancelled", async () => {
    state.children = [
      { id: "c1", status: "QUEUED", chapterId: "ch1" },
      { id: "c2", status: "QUEUED", chapterId: "ch2" },
    ];
    runTtsJob.mockImplementationOnce(async (jobId: string) => {
      state.ran.push(jobId);
      state.children[0].status = "COMPLETED";
      state.parentStatus = "CANCELLED";
    });
    await runProjectGeneration("parent");
    expect(state.ran).toEqual(["c1"]);
    expect(state.parentStatus).toBe("CANCELLED");
  });

  it("skips chapters that were deleted or deselected", async () => {
    state.children = [
      { id: "c1", status: "QUEUED", chapterId: null },
      { id: "c2", status: "QUEUED", chapterId: "ch2", included: false },
      { id: "c3", status: "QUEUED", chapterId: "ch3" },
    ];
    await runProjectGeneration("parent");
    expect(state.ran).toEqual(["c3"]);
    expect(state.children.slice(0, 2).map((job) => job.status)).toEqual(["CANCELLED", "CANCELLED"]);
    expect(state.parentStatus).toBe("COMPLETED");
  });

  it("does nothing when another runner owns the job", async () => {
    claimProjectGenerationJob.mockResolvedValue(false);
    state.children = [{ id: "c1", status: "QUEUED", chapterId: "ch1" }];
    await runProjectGeneration("parent");
    expect(runTtsJob).not.toHaveBeenCalled();
  });
});
