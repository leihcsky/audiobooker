import { beforeEach, describe, expect, it, vi } from "vitest";

const requireActor = vi.hoisted(() => vi.fn());
const createSourceUploadAuthorization = vi.hoisted(() => vi.fn());
const startParseJob = vi.hoisted(() => vi.fn());
const listChaptersForActor = vi.hoisted(() => vi.fn());
const getChapterForActor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/actor", () => ({
  requireActor,
}));

vi.mock("@/lib/tools/rate-limit", () => ({
  assertAnonymousRateLimit: vi.fn(),
}));

vi.mock("@/lib/tools/events", () => ({
  recordToolEvent: vi.fn(),
}));

vi.mock("@/lib/ingestion/source.service", () => ({
  createSourceUploadAuthorization,
}));

vi.mock("@/lib/jobs/parse.runner", () => ({
  startParseJob,
  runParseJob: vi.fn(),
}));

vi.mock("@/lib/jobs/schedule-parse", () => ({
  scheduleParseJob: vi.fn(),
}));

vi.mock("@/lib/chapters/chapter.service", () => ({
  listChaptersForActor,
  getChapterForActor,
}));

import { POST as presign } from "@/app/api/uploads/presign/route";
import { POST as parseProject } from "@/app/api/projects/[projectId]/parse/route";
import { GET as listChapters } from "@/app/api/projects/[projectId]/chapters/route";
import { GET as getChapter } from "@/app/api/chapters/[chapterId]/route";
import { AppError, unauthenticated } from "@/lib/api/errors";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "11111111-1111-4111-8111-111111111111";
const chapterId = "33333333-3333-4333-8333-333333333333";
const sourceFileId = "22222222-2222-4222-8222-222222222222";

describe("ingestion API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActor.mockResolvedValue({ type: "user", userId: ownerId });
  });

  it("rejects uploads when no actor is present", async () => {
    requireActor.mockRejectedValue(unauthenticated());

    const response = await presign(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: "book.epub",
          contentType: "application/epub+zip",
          sizeBytes: 1024,
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("rejects parse of another actor's project", async () => {
    startParseJob.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this project.", 403),
    );

    const response = await parseProject(
      new Request(`http://localhost/api/projects/${projectId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFileId }),
      }),
      { params: Promise.resolve({ projectId }) },
    );

    expect(response.status).toBe(403);
  });

  it("rejects chapter access for another actor", async () => {
    getChapterForActor.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this chapter.", 403),
    );

    const response = await getChapter(new Request(`http://localhost/api/chapters/${chapterId}`), {
      params: Promise.resolve({ chapterId }),
    });

    expect(response.status).toBe(403);
  });

  it("lists chapters without source text", async () => {
    listChaptersForActor.mockResolvedValue([
      {
        id: chapterId,
        title: "Chapter 1",
        orderIndex: 1,
        characterCount: 12,
        wordCount: 2,
        status: "PENDING",
        selectedVoiceId: null,
        hasAudio: false,
      },
    ]);

    const response = await listChapters(new Request(`http://localhost/api/projects/${projectId}/chapters`), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.chapters[0].sourceText).toBeUndefined();
  });
});
