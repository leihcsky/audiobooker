import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindUnique = vi.hoisted(() => vi.fn());
const chapterFindMany = vi.hoisted(() => vi.fn());
const exportFindFirst = vi.hoisted(() => vi.fn());
const exportFindMany = vi.hoisted(() => vi.fn());
const exportFindUnique = vi.hoisted(() => vi.fn());
const exportUpdate = vi.hoisted(() => vi.fn());
const exportCount = vi.hoisted(() => vi.fn());
const jobCount = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const createDownloadUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ createDownloadUrl }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    chapter: { findMany: chapterFindMany },
    export: {
      findFirst: exportFindFirst,
      findMany: exportFindMany,
      findUnique: exportFindUnique,
      update: exportUpdate,
      count: exportCount,
    },
    generationJob: { count: jobCount },
    $transaction: transaction,
  },
}));

import {
  createExportDownload,
  getExportReadinessForUser,
  startM4bExport,
  startMp3Export,
} from "@/lib/export/export.service";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const projectId = "11111111-1111-4111-8111-111111111111";

function readyChapters() {
  return [
    {
      id: "c1",
      title: "One",
      orderIndex: 1,
      status: "READY",
      currentAudioFileId: "a1",
      currentAudioFile: { id: "a1", objectKey: "audio-1" },
    },
  ];
}

describe("export service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUnique.mockResolvedValue({
      id: projectId,
      userId: ownerId,
      anonymousSessionId: null,
      expiresAt: null,
      title: "My Audiobook",
      coverObjectKey: null,
    });
    chapterFindMany.mockResolvedValue(readyChapters());
    exportFindFirst.mockResolvedValue(null);
    exportCount.mockResolvedValue(0);
    jobCount.mockResolvedValue(0);
  });

  it("reports incomplete audio instead of skipping chapters", async () => {
    chapterFindMany.mockResolvedValue([
      ...readyChapters(),
      {
        id: "c2",
        title: "Two",
        orderIndex: 2,
        status: "PENDING",
        currentAudioFileId: null,
        currentAudioFile: null,
      },
    ]);

    await expect(startMp3Export({ projectId, userId: ownerId })).rejects.toMatchObject({
      code: "EXPORT_AUDIO_INCOMPLETE",
      status: 422,
    });
  });

  it("reuses an active export instead of starting a duplicate", async () => {
    exportFindFirst.mockResolvedValue({
      id: "export-1",
      type: "ZIP",
      status: "PROCESSING",
      format: "zip",
      sizeBytes: null,
      durationSeconds: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
      completedAt: null,
      generationJobId: "job-1",
      generationJob: {
        id: "job-1",
        type: "EXPORT_MP3",
        status: "PROCESSING",
        errorCode: null,
        createdAt: new Date("2026-01-15T12:00:00.000Z"),
        completedAt: null,
      },
    });

    const started = await startMp3Export({ projectId, userId: ownerId });
    expect(started.job.id).toBe("job-1");
    expect(started.export.id).toBe("export-1");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("blocks a second concurrent export for the same user", async () => {
    jobCount.mockResolvedValue(1);

    await expect(startM4bExport({ projectId, userId: ownerId })).rejects.toMatchObject({
      code: "EXPORT_BUSY",
      status: 409,
    });
  });

  it("does not let another user download an export", async () => {
    exportFindUnique.mockResolvedValue({
      id: "export-1",
      status: "COMPLETED",
      objectKey: "private-key",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      project: { userId: ownerId },
    });

    await expect(createExportDownload({ exportId: "export-1", userId: otherUserId })).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    expect(createDownloadUrl).not.toHaveBeenCalled();
  });

  it("signs a forced download named after the project title", async () => {
    exportFindUnique.mockResolvedValue({
      id: "export-1",
      projectId,
      type: "M4B",
      status: "COMPLETED",
      objectKey: "private-key",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    createDownloadUrl.mockResolvedValue({
      downloadUrl: "https://signed.example/file",
      objectKey: "private-key",
      expiresAt: new Date("2099-01-01T00:10:00.000Z"),
    });

    const download = await createExportDownload({ exportId: "export-1", userId: ownerId });
    expect(download.filename).toBe("My Audiobook.m4b");
    expect(createDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ objectKey: "private-key", downloadFilename: "My Audiobook.m4b" }),
    );
  });

  it("marks expired exports and refuses download", async () => {
    const expired = {
      id: "export-1",
      status: "COMPLETED",
      objectKey: "private-key",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      project: { userId: ownerId },
    };
    exportFindUnique.mockResolvedValue(expired);
    exportUpdate.mockResolvedValue({ ...expired, status: "EXPIRED" });

    await expect(createExportDownload({ exportId: "export-1", userId: ownerId })).rejects.toMatchObject({
      code: "EXPORT_EXPIRED",
      status: 410,
    });
  });

  it("returns readiness for the project owner", async () => {
    const readiness = await getExportReadinessForUser(projectId, ownerId);
    expect(readiness.ready).toBe(true);
    expect(readiness.readyChapterCount).toBe(1);
  });

  it("lets an anonymous session export generated chapters when later chapters remain", async () => {
    projectFindUnique.mockResolvedValue({
      id: projectId,
      userId: null,
      anonymousSessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      title: "Free tool book",
      coverObjectKey: null,
    });
    chapterFindMany.mockResolvedValue([
      ...readyChapters(),
      {
        id: "c2",
        title: "Two",
        orderIndex: 2,
        status: "PENDING",
        currentAudioFileId: null,
        currentAudioFile: null,
      },
    ]);
    transaction.mockImplementation(async (fn: (tx: {
      generationJob: { create: (args: unknown) => Promise<unknown> };
      export: { create: (args: unknown) => Promise<unknown> };
    }) => Promise<unknown>) =>
      fn({
        generationJob: {
          create: async () => ({
            id: "job-9",
            type: "EXPORT_MP3",
            status: "QUEUED",
            errorCode: null,
            createdAt: new Date("2026-01-15T12:00:00.000Z"),
            completedAt: null,
          }),
        },
        export: {
          create: async () => ({
            id: "export-9",
            type: "ZIP",
            status: "QUEUED",
            format: "zip",
            sizeBytes: null,
            durationSeconds: null,
            errorMessage: null,
            expiresAt: null,
            createdAt: new Date("2026-01-15T12:00:00.000Z"),
            completedAt: null,
            generationJobId: "job-9",
          }),
        },
      }),
    );

    const started = await startMp3Export({
      projectId,
      actor: { type: "anonymous", sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    });
    expect(started.export.id).toBe("export-9");
  });
});
