import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindUnique = vi.hoisted(() => vi.fn());
const sourceFindUnique = vi.hoisted(() => vi.fn());
const jobFindFirst = vi.hoisted(() => vi.fn());
const jobCount = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const assertProjectWithinPlan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    sourceFile: { findUnique: sourceFindUnique },
    generationJob: { findFirst: jobFindFirst, create: vi.fn(), count: jobCount },
    project: { findUnique: projectFindUnique, update: vi.fn() },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/billing/entitlements", () => ({ assertProjectWithinPlan }));

import { startParseJob } from "@/lib/jobs/parse.runner";
import { AppError } from "@/lib/api/errors";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "11111111-1111-4111-8111-111111111111";
const sourceFileId = "22222222-2222-4222-8222-222222222222";

describe("startParseJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUnique.mockResolvedValue({
      id: projectId,
      userId: ownerId,
      anonymousSessionId: null,
      expiresAt: null,
    });
    jobCount.mockResolvedValue(0);
    assertProjectWithinPlan.mockResolvedValue(undefined);
  });

  it("refuses to re-parse while chapters are being narrated", async () => {
    jobCount.mockResolvedValue(1);

    await expect(startParseJob({ userId: ownerId, projectId, sourceFileId })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(sourceFindUnique).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("blocks parsing for projects beyond the plan limit", async () => {
    assertProjectWithinPlan.mockRejectedValue(new AppError("PLAN_REQUIRED", "upgrade", 403));

    await expect(startParseJob({ userId: ownerId, projectId, sourceFileId })).rejects.toMatchObject({
      code: "PLAN_REQUIRED",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("reuses an active parse job instead of creating duplicate work", async () => {
    sourceFindUnique.mockResolvedValue({
      id: sourceFileId,
      projectId,
      status: "PARSING",
    });
    jobFindFirst.mockResolvedValue({
      id: "job-1",
      type: "PARSE_SOURCE",
      status: "PROCESSING",
      errorCode: null,
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
      completedAt: null,
    });

    const job = await startParseJob({
      userId: ownerId,
      projectId,
      sourceFileId,
    });

    expect(job.id).toBe("job-1");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a source file from another project", async () => {
    sourceFindUnique.mockResolvedValue({
      id: sourceFileId,
      projectId: "99999999-9999-4999-8999-999999999999",
      status: "UPLOADED",
    });

    await expect(
      startParseJob({
        userId: ownerId,
        projectId,
        sourceFileId,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
