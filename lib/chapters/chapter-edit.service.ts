import type { Prisma } from "@/generated/prisma";
import { chapterNotFound, conflict, validationError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import {
  getChapterForActor,
  listChaptersForActor,
  type ChapterDetail,
} from "@/lib/chapters/chapter.service";
import { prisma } from "@/lib/db/prisma";
import type { ChapterSummary } from "@/lib/projects/project.detail";
import { getStorage } from "@/lib/storage";
import { assertProjectAccess } from "@/lib/tools/access";
import type { UpdateChapterInput } from "@/lib/validation/chapter";

const GENERATING_MESSAGE = "This chapter is being narrated. Try again when it finishes.";
const ORDER_TRANSACTION_TIMEOUT_MS = 20_000;

async function findChapterForActor(chapterId: string, actor: Actor) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      projectId: true,
      sourceText: true,
      status: true,
      currentAudioFileId: true,
    },
  });
  if (!chapter) {
    throw chapterNotFound();
  }
  await assertProjectAccess(actor, chapter.projectId);
  return chapter;
}

export async function updateChapterForActor(
  chapterId: string,
  actor: Actor,
  input: UpdateChapterInput,
): Promise<ChapterDetail> {
  const chapter = await findChapterForActor(chapterId, actor);
  if (chapter.status === "GENERATING") {
    throw conflict(GENERATING_MESSAGE);
  }

  const data: Prisma.ChapterUpdateManyMutationInput = {};
  if (input.title !== undefined) {
    data.title = input.title;
  }
  if (input.sourceText !== undefined && input.sourceText !== chapter.sourceText) {
    data.sourceText = input.sourceText;
    data.characterCount = input.sourceText.length;
    if (chapter.currentAudioFileId) {
      data.audioOutdated = true;
    }
  }

  if (Object.keys(data).length > 0) {
    const result = await prisma.chapter.updateMany({
      where: { id: chapter.id, status: { not: "GENERATING" } },
      data,
    });
    if (result.count === 0) {
      throw conflict(GENERATING_MESSAGE);
    }
  }

  return getChapterForActor(chapter.id, actor);
}

/**
 * Rewrites orderIndex to 1..n in the given order. Runs in two passes
 * through negative indexes so the (projectId, orderIndex) unique key
 * never collides mid-update.
 */
async function writeChapterOrder(
  tx: Prisma.TransactionClient,
  orderedIds: string[],
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await tx.chapter.update({ where: { id }, data: { orderIndex: -(index + 1) } });
  }
  for (const [index, id] of orderedIds.entries()) {
    await tx.chapter.update({ where: { id }, data: { orderIndex: index + 1 } });
  }
}

export async function deleteChapterForActor(
  chapterId: string,
  actor: Actor,
): Promise<ChapterSummary[]> {
  const chapter = await findChapterForActor(chapterId, actor);
  if (chapter.status === "GENERATING") {
    throw conflict(GENERATING_MESSAGE);
  }

  const siblings = await prisma.chapter.findMany({
    where: { projectId: chapter.projectId },
    orderBy: { orderIndex: "asc" },
    select: { id: true },
  });
  if (siblings.length <= 1) {
    throw validationError("A project needs at least one chapter.");
  }

  const audioFiles = await prisma.audioFile.findMany({
    where: { chapterId: chapter.id },
    select: { objectKey: true },
  });

  await prisma.$transaction(
    async (tx) => {
      const deleted = await tx.chapter.deleteMany({
        where: { id: chapter.id, status: { not: "GENERATING" } },
      });
      if (deleted.count === 0) {
        throw conflict(GENERATING_MESSAGE);
      }
      await writeChapterOrder(
        tx,
        siblings.map((sibling) => sibling.id).filter((id) => id !== chapter.id),
      );
    },
    { timeout: ORDER_TRANSACTION_TIMEOUT_MS },
  );

  const storage = getStorage();
  await Promise.all(
    audioFiles.map((file) => storage.deleteObject(file.objectKey).catch(() => undefined)),
  );

  return listChaptersForActor(chapter.projectId, actor);
}

export async function reorderChaptersForActor(
  projectId: string,
  actor: Actor,
  chapterIds: string[],
): Promise<ChapterSummary[]> {
  await assertProjectAccess(actor, projectId);

  const chapters = await prisma.chapter.findMany({
    where: { projectId },
    select: { id: true, status: true },
  });
  const owned = new Set(chapters.map((chapter) => chapter.id));
  const requested = new Set(chapterIds);
  if (
    requested.size !== chapterIds.length ||
    requested.size !== owned.size ||
    chapterIds.some((id) => !owned.has(id))
  ) {
    throw validationError("The new order must list every chapter of this project exactly once.");
  }
  if (chapters.some((chapter) => chapter.status === "GENERATING")) {
    throw conflict("Chapters can't be reordered while narration is running.");
  }

  await prisma.$transaction((tx) => writeChapterOrder(tx, chapterIds), {
    timeout: ORDER_TRANSACTION_TIMEOUT_MS,
  });

  return listChaptersForActor(projectId, actor);
}
