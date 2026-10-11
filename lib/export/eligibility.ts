import type { ChapterStatus } from "@/generated/prisma";

export type EligibleChapterInput = {
  id: string;
  title: string;
  orderIndex: number;
  status: ChapterStatus;
  currentAudioFileId: string | null;
  included?: boolean;
};

export type ChapterReadiness = {
  id: string;
  title: string;
  orderIndex: number;
  status: ChapterStatus;
  hasAudio: boolean;
};

export type ExportReadinessResult = {
  ready: boolean;
  chapterCount: number;
  readyChapterCount: number;
  chapters: ChapterReadiness[];
  missingChapters: ChapterReadiness[];
};

export function chapterHasExportableAudio(chapter: EligibleChapterInput): boolean {
  return Boolean(chapter.currentAudioFileId);
}

export function evaluateExportReadiness(chapters: EligibleChapterInput[]): ExportReadinessResult {
  const ordered = [...chapters]
    .filter((chapter) => chapter.included !== false)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const summaries = ordered.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    orderIndex: chapter.orderIndex,
    status: chapter.status,
    hasAudio: chapterHasExportableAudio(chapter),
  }));
  const missingChapters = summaries.filter((chapter) => !chapter.hasAudio);

  return {
    ready: summaries.length > 0 && missingChapters.length === 0,
    chapterCount: summaries.length,
    readyChapterCount: summaries.length - missingChapters.length,
    chapters: summaries,
    missingChapters,
  };
}
