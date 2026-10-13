import type { Export, ExportType, JobType } from "@/generated/prisma";
import {
  exportAudioIncomplete,
  exportBusy,
  exportExpired,
  exportInvalidProject,
  exportMetadataInvalid,
  exportNotFound,
  exportNotReady,
  forbidden,
} from "@/lib/api/errors";
import { PUBLISH_MASTERING_PRESET } from "@/lib/audio/mastering-preset";
import { assertCanUsePublishMastering } from "@/lib/billing/entitlements";
import { FILE_LIMITS } from "@/lib/config/limits";
import { prisma } from "@/lib/db/prisma";
import { evaluateExportReadiness, type ExportReadinessResult } from "@/lib/export/eligibility";
import { toExportDto, type ExportDto } from "@/lib/export/export.dto";
import { exportM4bFilename, exportZipFilename } from "@/lib/export/filenames";
import { toJobSummary, type JobSummary } from "@/lib/projects/project.detail";
import type { Actor } from "@/lib/auth/actor";
import { assertProjectAccess } from "@/lib/tools/access";
import { assertAnonymousExportLimit } from "@/lib/usage/usage.service";
import { getStorage } from "@/lib/storage";

export type ExportReadinessDto = ExportReadinessResult & {
  hasCover: boolean;
  title: string;
};

export type StartedExport = {
  job: JobSummary;
  export: ExportDto;
};

async function expireIfNeeded(record: Export): Promise<Export> {
  if (
    record.status === "COMPLETED" &&
    record.expiresAt &&
    record.expiresAt.getTime() <= Date.now()
  ) {
    return prisma.export.update({
      where: { id: record.id },
      data: { status: "EXPIRED" },
    });
  }
  return record;
}

async function getOwnedExport(exportId: string, actor: Actor): Promise<Export> {
  const record = await prisma.export.findUnique({
    where: { id: exportId },
  });
  if (!record) {
    throw exportNotFound();
  }
  await assertProjectAccess(actor, record.projectId);
  return expireIfNeeded(record);
}

export async function getExportReadinessForUser(
  projectId: string,
  userId: string,
): Promise<ExportReadinessDto> {
  return getExportReadinessForActor(projectId, { type: "user", userId });
}

export async function getExportReadinessForActor(
  projectId: string,
  actor: Actor,
): Promise<ExportReadinessDto> {
  const project = await assertProjectAccess(actor, projectId);
  const chapters = await prisma.chapter.findMany({
    where: { projectId: project.id },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      status: true,
      currentAudioFileId: true,
      included: true,
    },
  });

  return {
    ...evaluateExportReadiness(chapters),
    hasCover: Boolean(project.coverObjectKey),
    title: project.title,
  };
}

async function findActiveExport(input: {
  projectId: string;
  type: ExportType;
  jobType: JobType;
  masteringPreset?: string | null;
}): Promise<StartedExport | null> {
  const active = await prisma.export.findFirst({
    where: {
      projectId: input.projectId,
      type: input.type,
      masteringPreset: input.masteringPreset ?? null,
      status: { in: ["QUEUED", "PROCESSING"] },
    },
    orderBy: { createdAt: "desc" },
    include: { generationJob: true },
  });
  if (!active?.generationJob || active.generationJob.type !== input.jobType) {
    return null;
  }
  return {
    job: toJobSummary(active.generationJob),
    export: toExportDto(active),
  };
}

async function assertExportCapacity(userId: string): Promise<void> {
  const activeCount = await prisma.generationJob.count({
    where: {
      type: { in: ["EXPORT_MP3", "EXPORT_M4B"] },
      status: { in: ["QUEUED", "PROCESSING"] },
      project: { userId },
    },
  });
  if (activeCount >= FILE_LIMITS.MAX_CONCURRENT_EXPORT_JOBS_PER_USER) {
    throw exportBusy();
  }
}

async function assertExportableProject(projectId: string, actor: Actor) {
  const project = await assertProjectAccess(actor, projectId);
  if (!project.title.trim()) {
    throw exportMetadataInvalid("Title is required.");
  }

  const chapters = await prisma.chapter.findMany({
    where: { projectId: project.id },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      status: true,
      currentAudioFileId: true,
      included: true,
      currentAudioFile: {
        select: { id: true, objectKey: true },
      },
    },
  });

  if (chapters.length === 0) {
    throw exportInvalidProject("This project has no chapters to export.");
  }

  const readiness = evaluateExportReadiness(chapters);
  const anonymousPartial =
    actor.type === "anonymous" && readiness.readyChapterCount > 0;
  if (!readiness.ready && !anonymousPartial) {
    throw exportAudioIncomplete(
      `${readiness.readyChapterCount} of ${readiness.chapterCount} chapters have audio.`,
    );
  }

  return { project, chapters };
}

async function createExportJob(input: {
  projectId: string;
  type: ExportType;
  jobType: JobType;
  format: string;
  masteringPreset?: string | null;
}): Promise<StartedExport> {
  const [job, record] = await prisma.$transaction(async (tx) => {
    const createdJob = await tx.generationJob.create({
      data: {
        projectId: input.projectId,
        type: input.jobType,
        status: "QUEUED",
      },
    });
    const createdExport = await tx.export.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        format: input.format,
        status: "QUEUED",
        generationJobId: createdJob.id,
        masteringPreset: input.masteringPreset ?? null,
      },
    });
    return [createdJob, createdExport] as const;
  });

  return {
    job: toJobSummary(job),
    export: toExportDto(record),
  };
}

function resolveActor(input: { userId?: string; actor?: Actor }): Actor {
  if (input.actor) {
    return input.actor;
  }
  if (input.userId) {
    return { type: "user", userId: input.userId };
  }
  throw forbidden("You do not have access to this export.");
}

export async function startMp3Export(input: {
  projectId: string;
  userId?: string;
  actor?: Actor;
  mastering?: "publish" | null;
}): Promise<StartedExport> {
  const actor = resolveActor(input);
  const masteringPreset = input.mastering === "publish" ? PUBLISH_MASTERING_PRESET.id : null;
  if (masteringPreset) {
    await assertCanUsePublishMastering(actor);
  }
  await assertExportableProject(input.projectId, actor);
  const existing = await findActiveExport({
    projectId: input.projectId,
    type: "ZIP",
    jobType: "EXPORT_MP3",
    masteringPreset,
  });
  if (existing) {
    return existing;
  }
  if (actor.type === "anonymous") {
    await assertAnonymousExportLimit(actor.sessionId, "ZIP");
  } else {
    await assertExportCapacity(actor.userId);
  }
  return createExportJob({
    projectId: input.projectId,
    type: "ZIP",
    jobType: "EXPORT_MP3",
    format: "zip",
    masteringPreset,
  });
}

export async function startM4bExport(input: {
  projectId: string;
  userId?: string;
  actor?: Actor;
}): Promise<StartedExport> {
  const actor = resolveActor(input);
  await assertExportableProject(input.projectId, actor);
  const existing = await findActiveExport({
    projectId: input.projectId,
    type: "M4B",
    jobType: "EXPORT_M4B",
  });
  if (existing) {
    return existing;
  }
  if (actor.type === "anonymous") {
    await assertAnonymousExportLimit(actor.sessionId, "M4B");
  } else {
    await assertExportCapacity(actor.userId);
  }
  return createExportJob({
    projectId: input.projectId,
    type: "M4B",
    jobType: "EXPORT_M4B",
    format: "m4b",
  });
}

export async function listExportsForUser(
  projectId: string,
  userId: string,
): Promise<ExportDto[]> {
  return listExportsForActor(projectId, { type: "user", userId });
}

export async function listExportsForActor(
  projectId: string,
  actor: Actor,
): Promise<ExportDto[]> {
  await assertProjectAccess(actor, projectId);
  const records = await prisma.export.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const current = await Promise.all(records.map((record) => expireIfNeeded(record)));
  return current.map(toExportDto);
}

export async function getExportForUser(exportId: string, userId: string): Promise<ExportDto> {
  return getExportForActor(exportId, { type: "user", userId });
}

export async function getExportForActor(exportId: string, actor: Actor): Promise<ExportDto> {
  const record = await getOwnedExport(exportId, actor);
  return toExportDto(record);
}

export async function createExportDownload(input: {
  exportId: string;
  userId?: string;
  actor?: Actor;
}): Promise<{ downloadUrl: string; expiresAt: string; filename: string }> {
  const record = await getOwnedExport(input.exportId, resolveActor(input));
  if (record.status === "EXPIRED") {
    throw exportExpired();
  }
  if (record.status !== "COMPLETED" || !record.objectKey) {
    throw exportNotReady();
  }

  const project = await prisma.project.findUnique({
    where: { id: record.projectId },
    select: { title: true },
  });
  const title = project?.title ?? "audiobook";
  const filename =
    record.type === "M4B"
      ? exportM4bFilename(title)
      : exportZipFilename(title, { publishReady: record.masteringPreset !== null });
  const signed = await getStorage().createDownloadUrl({
    objectKey: record.objectKey,
    expiresInSeconds: FILE_LIMITS.EXPORT_SIGNED_URL_SECONDS,
    downloadFilename: filename,
  });

  return {
    downloadUrl: signed.downloadUrl,
    expiresAt: signed.expiresAt.toISOString(),
    filename,
  };
}

export type ExportableChapter = {
  id: string;
  title: string;
  orderIndex: number;
  objectKey: string;
  durationSeconds: number | null;
  voiceId: string | null;
  speed: number;
};

export async function loadExportableChapters(projectId: string): Promise<ExportableChapter[]> {
  const chapters = await prisma.chapter.findMany({
    where: { projectId, included: true },
    orderBy: { orderIndex: "asc" },
    include: { currentAudioFile: true },
  });

  return chapters.flatMap((chapter) => {
    if (!chapter.currentAudioFile) {
      return [];
    }
    return [
      {
        id: chapter.id,
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        objectKey: chapter.currentAudioFile.objectKey,
        durationSeconds:
          chapter.currentAudioFile.durationSeconds == null
            ? null
            : Number(chapter.currentAudioFile.durationSeconds.toString()),
        voiceId: chapter.selectedVoiceId,
        speed: Number(chapter.selectedSpeed.toString()),
      },
    ];
  });
}
