import { prisma } from "@/lib/db/prisma";
import { audioNotFound, chapterNotFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { FILE_LIMITS } from "@/lib/config/limits";
import { getStorage } from "@/lib/storage";
import { assertProjectAccess } from "@/lib/tools/access";
import type { ChapterAudioSummary } from "@/lib/projects/project.detail";

export type ChapterAudioPlayback = {
  audioUrl: string;
  expiresAt: string;
  audio: ChapterAudioSummary;
};

export async function getChapterAudioForUser(
  chapterId: string,
  userId: string,
): Promise<ChapterAudioPlayback> {
  return getChapterAudioForActor(chapterId, { type: "user", userId });
}

export async function getChapterAudioForActor(
  chapterId: string,
  actor: Actor,
): Promise<ChapterAudioPlayback> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { currentAudioFile: true },
  });

  if (!chapter) {
    throw chapterNotFound();
  }
  await assertProjectAccess(actor, chapter.projectId);
  if (!chapter.currentAudioFile) {
    throw audioNotFound();
  }

  const signed = await getStorage().createDownloadUrl({
    objectKey: chapter.currentAudioFile.objectKey,
    expiresInSeconds: FILE_LIMITS.AUDIO_SIGNED_URL_SECONDS,
  });

  return {
    audioUrl: signed.downloadUrl,
    expiresAt: signed.expiresAt.toISOString(),
    audio: {
      id: chapter.currentAudioFile.id,
      format: chapter.currentAudioFile.format,
      durationSeconds: chapter.currentAudioFile.durationSeconds
        ? Number(chapter.currentAudioFile.durationSeconds)
        : null,
      version: chapter.currentAudioFile.version,
      voiceId: chapter.selectedVoiceId,
      createdAt: chapter.currentAudioFile.createdAt.toISOString(),
    },
  };
}
