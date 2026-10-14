import { beforeEach, describe, expect, it, vi } from "vitest";

const jobUpdateMany = vi.hoisted(() => vi.fn());
const jobFindMany = vi.hoisted(() => vi.fn());
const runParseJob = vi.hoisted(() => vi.fn());
const runExportJob = vi.hoisted(() => vi.fn());
const runTtsJob = vi.hoisted(() => vi.fn());
const runProjectGeneration = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: { generationJob: { updateMany: jobUpdateMany, findMany: jobFindMany } },
}));
vi.mock("@/lib/jobs/parse.runner", () => ({ runParseJob }));
vi.mock("@/lib/jobs/export.runner", () => ({ runExportJob }));
vi.mock("@/lib/jobs/tts.runner", () => ({ runTtsJob }));
vi.mock("@/lib/jobs/project-generation.runner", () => ({ runProjectGeneration }));

import { recoverInterruptedJobs } from "@/lib/jobs/recovery";

describe("recoverInterruptedJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobUpdateMany.mockResolvedValue({ count: 0 });
    for (const runner of [runParseJob, runExportJob, runTtsJob, runProjectGeneration]) {
      runner.mockResolvedValue(undefined);
    }
  });

  it("requeues interrupted work on live projects", async () => {
    jobFindMany.mockResolvedValue([]);

    await recoverInterruptedJobs();

    expect(jobUpdateMany).toHaveBeenCalledWith({
      where: {
        type: { in: ["PARSE_SOURCE", "GENERATE_TTS", "GENERATE_PROJECT", "EXPORT_MP3", "EXPORT_M4B"] },
        project: { deletedAt: null },
        status: "PROCESSING",
      },
      data: { status: "QUEUED" },
    });
    expect(jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "QUEUED", parentJobId: null }),
      }),
    );
  });

  it("restarts each top-level job with its runner", async () => {
    jobFindMany.mockResolvedValue([
      { id: "parse-1", type: "PARSE_SOURCE" },
      { id: "export-1", type: "EXPORT_M4B" },
      { id: "tts-1", type: "GENERATE_TTS" },
      { id: "book-1", type: "GENERATE_PROJECT" },
    ]);

    await expect(recoverInterruptedJobs()).resolves.toBe(4);

    expect(runParseJob).toHaveBeenCalledWith("parse-1");
    expect(runExportJob).toHaveBeenCalledWith("export-1");
    expect(runTtsJob).toHaveBeenCalledWith("tts-1");
    expect(runProjectGeneration).toHaveBeenCalledWith("book-1");
  });

  it("keeps going when one restarted job fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    runParseJob.mockRejectedValue(new Error("db down"));
    jobFindMany.mockResolvedValue([
      { id: "parse-1", type: "PARSE_SOURCE" },
      { id: "export-1", type: "EXPORT_MP3" },
    ]);

    await expect(recoverInterruptedJobs()).resolves.toBe(2);
    await Promise.resolve();

    expect(runExportJob).toHaveBeenCalledWith("export-1");
    expect(errorLog).toHaveBeenCalledWith("job_recovery_failed", expect.objectContaining({ jobId: "parse-1" }));
    errorLog.mockRestore();
  });
});
