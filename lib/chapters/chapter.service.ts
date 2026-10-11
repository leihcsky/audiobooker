import { prisma } from "@/lib/db/prisma";
import { chapterNotFound, validationError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { countWords } from "@/lib/parser/normalize";
import { assertProjectAccess } from "@/lib/tools/access";
import {
  chapterAudioInclude,
  toChapterSummary,
  toJobSummary,
  type ChapterAudioSummary,
  type ChapterSummary,
  type JobSummary,
} from "@/lib/projects/project.detail";

export type ChapterDetail = ChapterSummary & {
  projectId: string;
  projectTitle: string;
  sourceText: string;
  currentAudio: ChapterAudioSummary | null;
  latestTtsJob: JobSummary | null;
};

export async function listChaptersForUser(
  projectId: string,
  userId: string,
): Promise<ChapterSummary[]> {
  return listChaptersForActor(projectId, { type: "user", userId });
}

export async function listChaptersForActor(
  projectId: string,
  actor: Actor,
): Promise<ChapterSummary[]> {
  await assertProjectAccess(actor, projectId);
  const chapters = await prisma.chapter.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    include: chapterAudioInclude,
  });
  return chapters.map((chapter) => toChapterSummary(chapter));
}

export async function setIncludedChaptersForActor(
  projectId: string,
  actor: Actor,
  includedIds: string[],
): Promise<ChapterSummary[]> {
  await assertProjectAccess(actor, projectId);
  const uniqueIds = [...new Set(includedIds)];

  const chapters = await prisma.chapter.findMany({
    where: { projectId },
    select: { id: true },
  });
  const owned = new Set(chapters.map((chapter) => chapter.id));
  if (uniqueIds.some((id) => !owned.has(id))) {
    throw validationError("One or more chapters do not belong to this project.");
  }

  await prisma.$transaction(
    chapters.map((chapter) =>
      prisma.chapter.update({
        where: { id: chapter.id },
        data: { included: uniqueIds.includes(chapter.id) },
      }),
    ),
  );

  return listChaptersForActor(projectId, actor);
}

export async function getChapterForUser(
  chapterId: string,
  userId: string,
): Promise<ChapterDetail> {
  return getChapterForActor(chapterId, { type: "user", userId });
}

export async function getChapterForActor(
  chapterId: string,
  actor: Actor,
): Promise<ChapterDetail> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      project: true,
      currentAudioFile: true,
    },
  });

  if (!chapter) {
    throw chapterNotFound();
  }
  await assertProjectAccess(actor, chapter.projectId);

  const latestTtsJob = await prisma.generationJob.findFirst({
    where: { chapterId: chapter.id, type: "GENERATE_TTS" },
    orderBy: { createdAt: "desc" },
  });

  return {
    ...toChapterSummary(chapter, latestTtsJob),
    projectId: chapter.projectId,
    projectTitle: chapter.project.title,
    sourceText: chapter.sourceText,
    currentAudio: chapter.currentAudioFile
      ? {
          id: chapter.currentAudioFile.id,
          format: chapter.currentAudioFile.format,
          durationSeconds: chapter.currentAudioFile.durationSeconds
            ? Number(chapter.currentAudioFile.durationSeconds)
            : null,
          version: chapter.currentAudioFile.version,
          voiceId: chapter.selectedVoiceId,
          createdAt: chapter.currentAudioFile.createdAt.toISOString(),
        }
      : null,
    latestTtsJob: latestTtsJob ? toJobSummary(latestTtsJob) : null,
  };
}

export type ChapterNeighbor = { id: string; title: string; orderIndex: number };

/** Callers must have already authorized access to the project. */
export async function findChapterNeighbors(
  projectId: string,
  orderIndex: number,
): Promise<{ previous: ChapterNeighbor | null; next: ChapterNeighbor | null }> {
  const select = { id: true, title: true, orderIndex: true } as const;
  const [previous, next] = await Promise.all([
    prisma.chapter.findFirst({
      where: { projectId, orderIndex: { lt: orderIndex } },
      orderBy: { orderIndex: "desc" },
      select,
    }),
    prisma.chapter.findFirst({
      where: { projectId, orderIndex: { gt: orderIndex } },
      orderBy: { orderIndex: "asc" },
      select,
    }),
  ]);
  return { previous, next };
}

export { countWords };
