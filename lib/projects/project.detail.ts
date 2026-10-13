import type { AudioFile, Chapter, GenerationJob, SourceFile } from "@/generated/prisma";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { toProjectDto, type ProjectDto } from "@/lib/projects/project.dto";
import { countWords } from "@/lib/parser/normalize";
import { summarizeProjectProgress, type ProjectProgress } from "@/lib/projects/project.progress";
import { assertProjectAccess } from "@/lib/tools/access";
import { estimateNarrationSeconds } from "@/lib/tts/narration-length";

export type SourceFileSummary = {
  id: string;
  type: SourceFile["type"];
  originalFilename: string;
  status: SourceFile["status"];
  sizeBytes: string;
  createdAt: string;
};

export type ChapterAudioSummary = {
  id: string;
  format: string;
  durationSeconds: number | null;
  version: number;
  voiceId: string | null;
  createdAt: string;
};

export type ChapterSummary = {
  id: string;
  title: string;
  orderIndex: number;
  characterCount: number;
  wordCount: number;
  /** Rough listening time before audio exists; see `estimateNarrationSeconds`. */
  estimatedSeconds: number;
  status: Chapter["status"];
  selectedVoiceId: string | null;
  selectedSpeed: number;
  included: boolean;
  hasAudio: boolean;
  audioOutdated: boolean;
  audioDurationSeconds: number | null;
  latestTtsJobId: string | null;
  latestTtsJobStatus: GenerationJob["status"] | null;
  generationError: { code: string; message: string } | null;
  generationProgress: JobProgress | null;
};

export type JobProgress = {
  completedChunks: number;
  totalChunks: number;
  percentage: number;
};

export type JobSummary = {
  id: string;
  type: GenerationJob["type"];
  status: GenerationJob["status"];
  errorCode: string | null;
  errorMessage: string | null;
  progress: JobProgress | null;
  createdAt: string;
  completedAt: string | null;
};

type LatestTtsJob = Pick<
  GenerationJob,
  "id" | "status" | "errorCode" | "errorMessage" | "totalChunks" | "completedChunks"
>;

export function toJobProgress(
  job: Pick<GenerationJob, "totalChunks" | "completedChunks">,
): JobProgress | null {
  if (!job.totalChunks || job.totalChunks < 1) {
    return null;
  }
  const completedChunks = Math.min(job.completedChunks, job.totalChunks);
  return {
    completedChunks,
    totalChunks: job.totalChunks,
    percentage: Math.round((completedChunks / job.totalChunks) * 100),
  };
}

export type ProjectGenerationSummary = {
  job: JobSummary;
  totalChapters: number;
  completedChapters: number;
  currentChapterId: string | null;
};

export type ProjectDetailDto = {
  project: ProjectDto;
  sourceFiles: SourceFileSummary[];
  chapters: ChapterSummary[];
  progress: ProjectProgress;
  latestParseJob: JobSummary | null;
  generation: ProjectGenerationSummary | null;
};

export async function findLatestProjectGenerationJob(projectId: string): Promise<GenerationJob | null> {
  return prisma.generationJob.findFirst({
    where: { projectId, type: "GENERATE_PROJECT" },
    orderBy: { createdAt: "desc" },
  });
}

export async function toProjectGenerationSummary(
  job: GenerationJob,
): Promise<ProjectGenerationSummary> {
  const active = job.status === "QUEUED" || job.status === "PROCESSING";
  const current = active
    ? await prisma.generationJob.findFirst({
        where: { parentJobId: job.id, status: "PROCESSING" },
        select: { chapterId: true },
      })
    : null;
  return {
    job: toJobSummary(job),
    totalChapters: job.totalChunks ?? 0,
    completedChapters: job.completedChunks,
    currentChapterId: current?.chapterId ?? null,
  };
}

export function toSourceFileSummary(source: SourceFile): SourceFileSummary {
  return {
    id: source.id,
    type: source.type,
    originalFilename: source.originalFilename,
    status: source.status,
    sizeBytes: source.sizeBytes.toString(),
    createdAt: source.createdAt.toISOString(),
  };
}

export type ChapterWithAudio = Chapter & {
  currentAudioFile?: Pick<AudioFile, "durationSeconds"> | null;
};

export const chapterAudioInclude = {
  currentAudioFile: { select: { durationSeconds: true } },
} as const;

export function toChapterSummary(
  chapter: ChapterWithAudio,
  latestTtsJob?: LatestTtsJob | null,
): ChapterSummary {
  const duration = chapter.currentAudioFile?.durationSeconds;
  const active = latestTtsJob?.status === "QUEUED" || latestTtsJob?.status === "PROCESSING";
  return {
    id: chapter.id,
    title: chapter.title,
    orderIndex: chapter.orderIndex,
    characterCount: chapter.characterCount,
    wordCount: countWords(chapter.sourceText),
    estimatedSeconds: estimateNarrationSeconds(chapter.sourceText),
    status: chapter.status,
    selectedVoiceId: chapter.selectedVoiceId,
    selectedSpeed: Number(chapter.selectedSpeed),
    included: chapter.included,
    hasAudio: Boolean(chapter.currentAudioFileId),
    audioOutdated: Boolean(chapter.currentAudioFileId) && chapter.audioOutdated,
    audioDurationSeconds: chapter.currentAudioFileId && duration != null ? Number(duration) : null,
    latestTtsJobId: latestTtsJob?.id ?? null,
    latestTtsJobStatus: latestTtsJob?.status ?? null,
    generationError:
      latestTtsJob?.status === "FAILED"
        ? {
            code: latestTtsJob.errorCode ?? "TTS_GENERATION_FAILED",
            message: latestTtsJob.errorMessage ?? "We couldn't finish this chapter.",
          }
        : null,
    generationProgress: active && latestTtsJob ? toJobProgress(latestTtsJob) : null,
  };
}

export function toJobSummary(job: GenerationJob): JobSummary {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    progress:
      job.type === "GENERATE_TTS" || job.type === "GENERATE_PROJECT" ? toJobProgress(job) : null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

export async function getProjectDetailForUser(
  projectId: string,
  userId: string,
): Promise<ProjectDetailDto> {
  return getProjectDetailForActor(projectId, { type: "user", userId });
}

export async function getProjectDetailForActor(
  projectId: string,
  actor: Actor,
): Promise<ProjectDetailDto> {
  const owned = await assertProjectAccess(actor, projectId);
  const project = toProjectDto(owned);

  const [sourceFiles, chapters, latestParseJob, ttsJobs, generationJob] = await Promise.all([
    prisma.sourceFile.findMany({
      where: { projectId, status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.chapter.findMany({
      where: { projectId },
      orderBy: { orderIndex: "asc" },
      include: chapterAudioInclude,
    }),
    prisma.generationJob.findFirst({
      where: { projectId, type: "PARSE_SOURCE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.generationJob.findMany({
      where: { projectId, type: "GENERATE_TTS" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        chapterId: true,
        status: true,
        errorCode: true,
        errorMessage: true,
        totalChunks: true,
        completedChunks: true,
      },
    }),
    findLatestProjectGenerationJob(projectId),
  ]);

  const latestTtsByChapter = new Map<string, (typeof ttsJobs)[number]>();
  for (const job of ttsJobs) {
    if (job.chapterId && !latestTtsByChapter.has(job.chapterId)) {
      latestTtsByChapter.set(job.chapterId, job);
    }
  }

  const chapterSummaries = chapters.map((chapter) =>
    toChapterSummary(chapter, latestTtsByChapter.get(chapter.id) ?? null),
  );

  return {
    project,
    sourceFiles: sourceFiles.map(toSourceFileSummary),
    chapters: chapterSummaries,
    progress: summarizeProjectProgress(chapterSummaries),
    latestParseJob: latestParseJob ? toJobSummary(latestParseJob) : null,
    generation: generationJob ? await toProjectGenerationSummary(generationJob) : null,
  };
}

export { toProjectDto };
