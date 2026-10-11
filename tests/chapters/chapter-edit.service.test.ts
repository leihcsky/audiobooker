import { beforeEach, describe, expect, it, vi } from "vitest";

const chapterFindUnique = vi.hoisted(() => vi.fn());
const chapterFindMany = vi.hoisted(() => vi.fn());
const chapterUpdateMany = vi.hoisted(() => vi.fn());
const audioFindMany = vi.hoisted(() => vi.fn());
const txChapterUpdate = vi.hoisted(() => vi.fn());
const txChapterDeleteMany = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const assertProjectAccess = vi.hoisted(() => vi.fn());
const getChapterForActor = vi.hoisted(() => vi.fn());
const listChaptersForActor = vi.hoisted(() => vi.fn());
const deleteObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    chapter: { findUnique: chapterFindUnique, findMany: chapterFindMany, updateMany: chapterUpdateMany },
    audioFile: { findMany: audioFindMany },
    $transaction: transaction,
  },
}));
vi.mock("@/lib/tools/access", () => ({ assertProjectAccess }));
vi.mock("@/lib/chapters/chapter.service", () => ({ getChapterForActor, listChaptersForActor }));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ deleteObject }) }));

import {
  deleteChapterForActor,
  reorderChaptersForActor,
  updateChapterForActor,
} from "@/lib/chapters/chapter-edit.service";
import { updateChapterSchema } from "@/lib/validation/chapter";
import { AppError } from "@/lib/api/errors";

const actor = { type: "user", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as const;
const projectId = "11111111-1111-4111-8111-111111111111";
const chapterA = "33333333-3333-4333-8333-333333333331";
const chapterB = "33333333-3333-4333-8333-333333333332";
const chapterC = "33333333-3333-4333-8333-333333333333";

function storedChapter(overrides: Record<string, unknown> = {}) {
  return {
    id: chapterA,
    projectId,
    sourceText: "Old text.",
    status: "READY",
    currentAudioFileId: "44444444-4444-4444-8444-444444444444",
    ...overrides,
  };
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((error: AppError) => expect(error.code).toBe(code));
}

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue({ id: projectId });
  getChapterForActor.mockResolvedValue({ id: chapterA });
  listChaptersForActor.mockResolvedValue([]);
  chapterUpdateMany.mockResolvedValue({ count: 1 });
  txChapterDeleteMany.mockResolvedValue({ count: 1 });
  deleteObject.mockResolvedValue(undefined);
  transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn({ chapter: { update: txChapterUpdate, deleteMany: txChapterDeleteMany } }),
  );
});

describe("updateChapterForActor", () => {
  it("marks existing audio outdated when the text changes", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter());
    await updateChapterForActor(chapterA, actor, { sourceText: "New text here." });
    expect(chapterUpdateMany).toHaveBeenCalledWith({
      where: { id: chapterA, status: { not: "GENERATING" } },
      data: { sourceText: "New text here.", characterCount: 14, audioOutdated: true },
    });
  });

  it("does not flag audio when the chapter has none", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter({ currentAudioFileId: null }));
    await updateChapterForActor(chapterA, actor, { sourceText: "New text." });
    expect(chapterUpdateMany.mock.calls[0][0].data).not.toHaveProperty("audioOutdated");
  });

  it("renames without touching audio", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter());
    await updateChapterForActor(chapterA, actor, { title: "Prologue", sourceText: "Old text." });
    expect(chapterUpdateMany.mock.calls[0][0].data).toEqual({ title: "Prologue" });
  });

  it("rejects edits while the chapter is generating", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter({ status: "GENERATING" }));
    await expectAppError(updateChapterForActor(chapterA, actor, { title: "X" }), "CONFLICT");
    expect(chapterUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects when generation starts between read and write", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter());
    chapterUpdateMany.mockResolvedValue({ count: 0 });
    await expectAppError(updateChapterForActor(chapterA, actor, { title: "X" }), "CONFLICT");
  });

  it("checks project ownership", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter());
    assertProjectAccess.mockRejectedValue(new AppError("FORBIDDEN", "No", 403));
    await expectAppError(updateChapterForActor(chapterA, actor, { title: "X" }), "FORBIDDEN");
    expect(chapterUpdateMany).not.toHaveBeenCalled();
  });
});

describe("deleteChapterForActor", () => {
  it("deletes the chapter, renumbers the rest and removes its audio objects", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter({ id: chapterB }));
    chapterFindMany.mockResolvedValue([{ id: chapterA }, { id: chapterB }, { id: chapterC }]);
    audioFindMany.mockResolvedValue([{ objectKey: "audio/v1.mp3" }, { objectKey: "audio/v2.mp3" }]);

    await deleteChapterForActor(chapterB, actor);

    expect(txChapterDeleteMany).toHaveBeenCalledWith({
      where: { id: chapterB, status: { not: "GENERATING" } },
    });
    expect(txChapterUpdate.mock.calls.map(([args]) => [args.where.id, args.data.orderIndex])).toEqual([
      [chapterA, -1],
      [chapterC, -2],
      [chapterA, 1],
      [chapterC, 2],
    ]);
    expect(deleteObject).toHaveBeenCalledWith("audio/v1.mp3");
    expect(deleteObject).toHaveBeenCalledWith("audio/v2.mp3");
    expect(listChaptersForActor).toHaveBeenCalledWith(projectId, actor);
  });

  it("refuses to delete the last chapter", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter());
    chapterFindMany.mockResolvedValue([{ id: chapterA }]);
    await expectAppError(deleteChapterForActor(chapterA, actor), "VALIDATION_ERROR");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuses while the chapter is generating", async () => {
    chapterFindUnique.mockResolvedValue(storedChapter({ status: "GENERATING" }));
    await expectAppError(deleteChapterForActor(chapterA, actor), "CONFLICT");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns not found for unknown chapters", async () => {
    chapterFindUnique.mockResolvedValue(null);
    await expectAppError(deleteChapterForActor(chapterA, actor), "CHAPTER_NOT_FOUND");
  });
});

describe("reorderChaptersForActor", () => {
  const chapters = [
    { id: chapterA, status: "READY" },
    { id: chapterB, status: "PENDING" },
    { id: chapterC, status: "READY" },
  ];

  it("writes the new order in two passes", async () => {
    chapterFindMany.mockResolvedValue(chapters);
    await reorderChaptersForActor(projectId, actor, [chapterC, chapterA, chapterB]);
    expect(txChapterUpdate.mock.calls.slice(3).map(([args]) => [args.where.id, args.data.orderIndex])).toEqual([
      [chapterC, 1],
      [chapterA, 2],
      [chapterB, 3],
    ]);
  });

  it.each([
    ["a missing chapter", [chapterA, chapterB]],
    ["a duplicate", [chapterA, chapterA, chapterB]],
    ["a foreign chapter", [chapterA, chapterB, "55555555-5555-4555-8555-555555555555"]],
  ])("rejects %s", async (_label, ids) => {
    chapterFindMany.mockResolvedValue(chapters);
    await expectAppError(reorderChaptersForActor(projectId, actor, ids), "VALIDATION_ERROR");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects while a chapter is generating", async () => {
    chapterFindMany.mockResolvedValue([...chapters.slice(0, 2), { id: chapterC, status: "GENERATING" }]);
    await expectAppError(
      reorderChaptersForActor(projectId, actor, [chapterC, chapterA, chapterB]),
      "CONFLICT",
    );
  });
});

describe("updateChapterSchema", () => {
  it("requires at least one field", () => {
    expect(updateChapterSchema.safeParse({}).success).toBe(false);
  });

  it("rejects blank text", () => {
    expect(updateChapterSchema.safeParse({ sourceText: "   " }).success).toBe(false);
  });

  it("trims the title", () => {
    expect(updateChapterSchema.parse({ title: "  Prologue  " })).toEqual({ title: "Prologue" });
  });
});
