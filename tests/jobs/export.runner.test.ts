import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const jobFindUnique = vi.hoisted(() => vi.fn());
const chapterFindMany = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const jobUpdate = vi.hoisted(() => vi.fn());
const exportUpdate = vi.hoisted(() => vi.fn());
const getObject = vi.hoisted(() => vi.fn());
const putObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generationJob: { findUnique: jobFindUnique, update: jobUpdate },
    export: { update: exportUpdate },
    chapter: { findMany: chapterFindMany },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ getObject, putObject }),
}));

import { runExportJob } from "@/lib/jobs/export.runner";

const projectId = "11111111-1111-4111-8111-111111111111";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const exportId = "33333333-3333-4333-8333-333333333333";
const jobId = "44444444-4444-4444-8444-444444444444";

describe("export runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops);
      }
      return undefined;
    });
    jobUpdate.mockResolvedValue({});
    exportUpdate.mockResolvedValue({});
  });

  it("zips current chapter audio and stores a private object", async () => {
    jobFindUnique.mockResolvedValue({
      id: jobId,
      type: "EXPORT_MP3",
      projectId,
      project: {
        userId,
        title: "My Audiobook",
        author: "Jane",
        narrator: null,
        language: "en",
        description: null,
        publisher: null,
        copyright: null,
        coverObjectKey: null,
      },
      exports: [{ id: exportId }],
    });
    chapterFindMany.mockResolvedValue([
      {
        id: "c1",
        title: "Intro",
        orderIndex: 1,
        selectedVoiceId: "edge-en-us-aria",
        selectedSpeed: 1,
        currentAudioFile: {
          objectKey: "audio-1",
          durationSeconds: 1.2,
        },
      },
    ]);
    getObject.mockResolvedValue(Buffer.from("ID3fake-mp3"));

    await runExportJob(jobId);

    expect(putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: `users/${userId}/projects/${projectId}/exports/${exportId}/chapters.zip`,
        contentType: "application/zip",
      }),
    );
    const uploaded = putObject.mock.calls[0]?.[0]?.body as Buffer;
    const zip = await JSZip.loadAsync(uploaded);
    expect(await zip.file("01 - Intro.mp3")?.async("string")).toBe("ID3fake-mp3");
  });

  it("marks the export failed without leaving a downloadable object", async () => {
    jobFindUnique.mockResolvedValue({
      id: jobId,
      type: "EXPORT_MP3",
      projectId,
      project: {
        userId,
        title: "My Audiobook",
        author: null,
        narrator: null,
        language: "en",
        description: null,
        publisher: null,
        copyright: null,
        coverObjectKey: null,
      },
      exports: [{ id: exportId }],
    });
    chapterFindMany.mockResolvedValue([]);

    await runExportJob(jobId);

    expect(putObject).not.toHaveBeenCalled();
    expect(exportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: exportId },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
