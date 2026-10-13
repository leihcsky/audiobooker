import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma";

const entryFindMany = vi.hoisted(() => vi.fn());
const entryFindFirst = vi.hoisted(() => vi.fn());
const entryCount = vi.hoisted(() => vi.fn());
const entryCreate = vi.hoisted(() => vi.fn());
const entryUpdate = vi.hoisted(() => vi.fn());
const entryDelete = vi.hoisted(() => vi.fn());
const chapterFindMany = vi.hoisted(() => vi.fn());
const chapterUpdateMany = vi.hoisted(() => vi.fn());
const getProjectForUser = vi.hoisted(() => vi.fn());
const canUsePronunciationDictionary = vi.hoisted(() => vi.fn());
const assertCanUsePronunciationDictionary = vi.hoisted(() => vi.fn());
const previewVoiceForActor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    pronunciationEntry: {
      findMany: entryFindMany,
      findFirst: entryFindFirst,
      count: entryCount,
      create: entryCreate,
      update: entryUpdate,
      delete: entryDelete,
    },
    chapter: { findMany: chapterFindMany, updateMany: chapterUpdateMany },
  },
}));
vi.mock("@/lib/projects/project.service", () => ({ getProjectForUser }));
vi.mock("@/lib/billing/entitlements", () => ({
  canUsePronunciationDictionary,
  assertCanUsePronunciationDictionary,
}));
vi.mock("@/lib/voices/voice.service", () => ({ previewVoiceForActor }));

import { AppError } from "@/lib/api/errors";
import {
  createPronunciationForUser,
  deletePronunciationForUser,
  listPronunciationsForUser,
  loadActivePronunciationRules,
  previewPronunciationForUser,
  updatePronunciationForUser,
} from "@/lib/pronunciation/pronunciation.service";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "11111111-1111-4111-8111-111111111111";
const entryId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-13T08:00:00Z");

function storedEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: entryId,
    projectId,
    term: "Hermione",
    replacement: "Her-MY-oh-nee",
    caseSensitive: false,
    wholeWord: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const input = { term: "Hermione", replacement: "Her-MY-oh-nee", caseSensitive: false, wholeWord: true };

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((error: AppError) => expect(error.code).toBe(code));
}

beforeEach(() => {
  vi.clearAllMocks();
  getProjectForUser.mockResolvedValue({ id: projectId, title: "Book" });
  canUsePronunciationDictionary.mockResolvedValue(true);
  assertCanUsePronunciationDictionary.mockResolvedValue(undefined);
  entryCount.mockResolvedValue(0);
  entryFindFirst.mockResolvedValue(null);
  entryCreate.mockResolvedValue(storedEntry());
  chapterFindMany.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
    Promise.resolve(
      where.included
        ? [{ sourceText: "Hermione smiled. hermione!" }, { sourceText: "Ron only." }]
        : [
            { id: "c1", sourceText: "Hermione smiled." },
            { id: "c2", sourceText: "Ron only." },
          ],
    ),
  );
  chapterUpdateMany.mockResolvedValue({ count: 1 });
});

describe("listPronunciationsForUser", () => {
  it("counts matches in included chapters and reports the plan flag", async () => {
    entryFindMany.mockResolvedValue([storedEntry()]);
    canUsePronunciationDictionary.mockResolvedValue(false);

    const result = await listPronunciationsForUser(projectId, userId);

    expect(getProjectForUser).toHaveBeenCalledWith(projectId, userId);
    expect(result.enabled).toBe(false);
    expect(result.entries[0]).toMatchObject({ term: "Hermione", occurrences: 2, chapterCount: 1 });
  });
});

describe("createPronunciationForUser", () => {
  it("requires the plan", async () => {
    assertCanUsePronunciationDictionary.mockRejectedValue(new AppError("PLAN_REQUIRED", "Upgrade", 403));
    await expectAppError(createPronunciationForUser(projectId, userId, input), "PLAN_REQUIRED");
    expect(entryCreate).not.toHaveBeenCalled();
  });

  it("enforces the per-project limit", async () => {
    entryCount.mockResolvedValue(100);
    await expectAppError(createPronunciationForUser(projectId, userId, input), "PRONUNCIATION_LIMIT_REACHED");
  });

  it("rejects duplicates found before or during insert", async () => {
    entryFindFirst.mockResolvedValueOnce({ id: "other" });
    await expectAppError(createPronunciationForUser(projectId, userId, input), "PRONUNCIATION_DUPLICATE");

    entryCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }),
    );
    await expectAppError(createPronunciationForUser(projectId, userId, input), "PRONUNCIATION_DUPLICATE");
  });

  it("marks voiced chapters that contain the term as outdated", async () => {
    const result = await createPronunciationForUser(projectId, userId, input);

    expect(entryCreate).toHaveBeenCalledWith({ data: { projectId, ...input } });
    expect(chapterFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId, currentAudioFileId: { not: null }, audioOutdated: false },
      }),
    );
    expect(chapterUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1"] }, audioOutdated: false },
      data: { audioOutdated: true },
    });
    expect(result.outdatedChapters).toBe(1);
  });
});

describe("updatePronunciationForUser", () => {
  it("404s for an entry outside the project", async () => {
    await expectAppError(
      updatePronunciationForUser(projectId, entryId, userId, { replacement: "x" }),
      "PRONUNCIATION_NOT_FOUND",
    );
    expect(entryFindFirst).toHaveBeenCalledWith({ where: { id: entryId, projectId } });
  });

  it("rejects a replacement equal to the term", async () => {
    entryFindFirst.mockResolvedValueOnce(storedEntry());
    await expectAppError(
      updatePronunciationForUser(projectId, entryId, userId, { replacement: "Hermione" }),
      "VALIDATION_ERROR",
    );
  });

  it("marks chapters matching the old or the new term", async () => {
    entryFindFirst.mockResolvedValueOnce(storedEntry()).mockResolvedValueOnce(null);
    entryUpdate.mockResolvedValue(storedEntry({ term: "Ron", replacement: "Rawn" }));
    chapterUpdateMany.mockResolvedValue({ count: 2 });

    const result = await updatePronunciationForUser(projectId, entryId, userId, { term: "Ron", replacement: "Rawn" });

    expect(chapterUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["c1", "c2"] }, audioOutdated: false } }),
    );
    expect(result.outdatedChapters).toBe(2);
  });
});

describe("deletePronunciationForUser", () => {
  it("is allowed without the plan and leaves audio alone when rules were not applied", async () => {
    entryFindFirst.mockResolvedValueOnce(storedEntry());
    canUsePronunciationDictionary.mockResolvedValue(false);

    const result = await deletePronunciationForUser(projectId, entryId, userId);

    expect(assertCanUsePronunciationDictionary).not.toHaveBeenCalled();
    expect(entryDelete).toHaveBeenCalledWith({ where: { id: entryId } });
    expect(chapterUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: true, outdatedChapters: 0 });
  });
});

describe("previewPronunciationForUser", () => {
  it("speaks the book sentence with the rule applied", async () => {
    previewVoiceForActor.mockResolvedValue({ audioUrl: "https://signed", expiresAt: "2026-10-13T09:00:00Z" });

    const result = await previewPronunciationForUser(projectId, userId, { ...input, voiceId: "edge-x", speed: 1 });

    expect(previewVoiceForActor).toHaveBeenCalledWith({
      actor: { type: "user", userId },
      voiceId: "edge-x",
      text: "Her-MY-oh-nee smiled.",
      speed: 1,
    });
    expect(result.text).toBe("Her-MY-oh-nee smiled.");
  });

  it("falls back to the replacement when the term is not in the book", async () => {
    previewVoiceForActor.mockResolvedValue({ audioUrl: "https://signed", expiresAt: "2026-10-13T09:00:00Z" });

    const result = await previewPronunciationForUser(projectId, userId, {
      term: "Dumbledore",
      replacement: "DUM-bul-dor",
      caseSensitive: false,
      wholeWord: true,
      voiceId: "edge-x",
    });

    expect(result.text).toBe("DUM-bul-dor");
  });
});

describe("loadActivePronunciationRules", () => {
  it("returns no rules for anonymous projects or without the plan", async () => {
    expect(await loadActivePronunciationRules(projectId, null)).toEqual([]);
    canUsePronunciationDictionary.mockResolvedValue(false);
    expect(await loadActivePronunciationRules(projectId, userId)).toEqual([]);
    expect(entryFindMany).not.toHaveBeenCalled();
  });

  it("returns the stored rules when enabled", async () => {
    entryFindMany.mockResolvedValue([storedEntry()]);
    expect(await loadActivePronunciationRules(projectId, userId)).toEqual([input]);
  });
});
