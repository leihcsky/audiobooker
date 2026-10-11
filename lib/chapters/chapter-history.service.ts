import type { GenerationJob } from "@/generated/prisma";
import { chapterNotFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { assertProjectAccess } from "@/lib/tools/access";
import { findVoice } from "@/lib/tts/voices";

const HISTORY_LIMIT = 20;

export type ChapterHistoryEntry = {
  jobId: string;
  status: GenerationJob["status"];
  voiceName: string | null;
  tier: GenerationJob["tier"];
  version: number | null;
  durationSeconds: number | null;
  isCurrent: boolean;
  errorMessage: string | null;
  createdAt: string;
};

export async function listChapterHistoryForActor(
  chapterId: string,
  actor: Actor,
): Promise<ChapterHistoryEntry[]> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { projectId: true, currentAudioFileId: true },
  });
  if (!chapter) {
    throw chapterNotFound();
  }
  await assertProjectAccess(actor, chapter.projectId);

  const jobs = await prisma.generationJob.findMany({
    where: { chapterId, type: "GENERATE_TTS", status: { in: ["PROCESSING", "COMPLETED", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: {
      audioFiles: {
        where: { type: "CHAPTER_AUDIO" },
        select: { id: true, version: true, durationSeconds: true },
        take: 1,
      },
    },
  });

  return jobs.map((job) => {
    const audio = job.audioFiles[0] ?? null;
    return {
      jobId: job.id,
      status: job.status,
      voiceName: job.voiceId ? findVoice(job.voiceId)?.name ?? job.voiceId : null,
      tier: job.tier,
      version: audio?.version ?? null,
      durationSeconds: audio?.durationSeconds != null ? Number(audio.durationSeconds) : null,
      isCurrent: Boolean(audio && audio.id === chapter.currentAudioFileId),
      errorMessage: job.status === "FAILED" ? job.errorMessage : null,
      createdAt: job.createdAt.toISOString(),
    };
  });
}
