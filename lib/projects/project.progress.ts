import { prisma } from "@/lib/db/prisma";

export type ProjectProgress = {
  /** Chapters selected for narration. */
  chapterCount: number;
  /** Selected chapters with current, up-to-date audio. */
  readyCount: number;
  /** Selected chapters whose audio predates a text edit. */
  outdatedCount: number;
  percentage: number;
  audioSeconds: number;
};

export type ProgressChapter = {
  included: boolean;
  hasAudio: boolean;
  audioOutdated: boolean;
  audioDurationSeconds: number | null;
};

export function summarizeProjectProgress(chapters: ProgressChapter[]): ProjectProgress {
  const selected = chapters.filter((chapter) => chapter.included);
  const withAudio = selected.filter((chapter) => chapter.hasAudio);
  const outdatedCount = withAudio.filter((chapter) => chapter.audioOutdated).length;
  const readyCount = withAudio.length - outdatedCount;
  return {
    chapterCount: selected.length,
    readyCount,
    outdatedCount,
    percentage: selected.length === 0 ? 0 : Math.round((readyCount / selected.length) * 100),
    audioSeconds: Math.round(
      withAudio.reduce((sum, chapter) => sum + (chapter.audioDurationSeconds ?? 0), 0),
    ),
  };
}

export async function getProjectProgressMap(
  projectIds: string[],
): Promise<Map<string, ProjectProgress>> {
  if (projectIds.length === 0) {
    return new Map();
  }
  const chapters = await prisma.chapter.findMany({
    where: { projectId: { in: projectIds } },
    select: {
      projectId: true,
      included: true,
      audioOutdated: true,
      currentAudioFileId: true,
      currentAudioFile: { select: { durationSeconds: true } },
    },
  });
  const grouped = new Map<string, ProgressChapter[]>();
  for (const chapter of chapters) {
    const list = grouped.get(chapter.projectId) ?? [];
    list.push({
      included: chapter.included,
      hasAudio: Boolean(chapter.currentAudioFileId),
      audioOutdated: chapter.audioOutdated,
      audioDurationSeconds: chapter.currentAudioFile?.durationSeconds
        ? Number(chapter.currentAudioFile.durationSeconds)
        : null,
    });
    grouped.set(chapter.projectId, list);
  }
  return new Map(projectIds.map((id) => [id, summarizeProjectProgress(grouped.get(id) ?? [])]));
}
