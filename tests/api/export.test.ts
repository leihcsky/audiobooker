import { beforeEach, describe, expect, it, vi } from "vitest";

const requireActor = vi.hoisted(() => vi.fn());
const startMp3Export = vi.hoisted(() => vi.fn());
const startM4bExport = vi.hoisted(() => vi.fn());
const scheduleExportJob = vi.hoisted(() => vi.fn());
const createExportDownload = vi.hoisted(() => vi.fn());
const getExportForActor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/actor", () => ({
  requireActor,
}));

vi.mock("@/lib/tools/rate-limit", () => ({
  assertAnonymousRateLimit: vi.fn(),
}));

vi.mock("@/lib/tools/events", () => ({
  recordToolEvent: vi.fn(),
}));

vi.mock("@/lib/export/export.service", () => ({
  startMp3Export,
  startM4bExport,
  createExportDownload,
  getExportForActor,
}));

vi.mock("@/lib/jobs/schedule-export", () => ({
  scheduleExportJob,
}));

import { POST as exportMp3 } from "@/app/api/projects/[projectId]/export/mp3/route";
import { GET as downloadExport } from "@/app/api/exports/[exportId]/download/route";
import { AppError, unauthenticated } from "@/lib/api/errors";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "11111111-1111-4111-8111-111111111111";
const exportId = "33333333-3333-4333-8333-333333333333";

describe("export API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActor.mockResolvedValue({ type: "user", userId: ownerId });
  });

  it("rejects export when no actor is present", async () => {
    requireActor.mockRejectedValue(unauthenticated());

    const response = await exportMp3(
      new Request(`http://localhost/api/projects/${projectId}/export/mp3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ projectId }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("returns 202 and schedules the export job", async () => {
    startMp3Export.mockResolvedValue({
      job: { id: "job-1", type: "EXPORT_MP3", status: "QUEUED" },
      export: { id: exportId, type: "ZIP", status: "QUEUED" },
    });

    const response = await exportMp3(
      new Request(`http://localhost/api/projects/${projectId}/export/mp3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeMetadata: true }),
      }),
      { params: Promise.resolve({ projectId }) },
    );

    expect(response.status).toBe(202);
    expect(scheduleExportJob).toHaveBeenCalledWith("job-1");
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        job: { id: "job-1" },
        export: { id: exportId },
      },
    });
  });

  it("does not return a signed URL for another actor's export", async () => {
    createExportDownload.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this export.", 403),
    );

    const response = await downloadExport(new Request(`http://localhost/api/exports/${exportId}/download`), {
      params: Promise.resolve({ exportId }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
  });
});
