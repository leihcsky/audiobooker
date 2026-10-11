import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppError } from "@/lib/api/errors";
import { FILE_LIMITS } from "@/lib/config/limits";
import { prisma } from "@/lib/db/prisma";
import { FfmpegError } from "@/lib/audio/ffmpeg";
import { buildMetadataText, type AudiobookMetadata } from "@/lib/export/ffmetadata";
import { chapterZipEntryName } from "@/lib/export/filenames";
import { loadExportableChapters } from "@/lib/export/export.service";
import { buildM4b } from "@/lib/export/m4b";
import { buildChapterZip } from "@/lib/export/zip";
import { getStorage } from "@/lib/storage";
import { buildExportObjectKey } from "@/lib/storage/keys";

const USER_SAFE_FAILURE = "We couldn't export this audiobook. Please try again.";

function toMetadata(project: {
  title: string;
  author: string | null;
  narrator: string | null;
  language: string;
  description: string | null;
  publisher: string | null;
  copyright: string | null;
}): AudiobookMetadata {
  return {
    title: project.title,
    author: project.author,
    narrator: project.narrator,
    language: project.language,
    description: project.description,
    publisher: project.publisher,
    copyright: project.copyright,
  };
}

async function failExport(input: {
  jobId: string;
  exportId: string;
  code: string;
  message: string;
}): Promise<void> {
  const completedAt = new Date();
  await prisma.$transaction([
    prisma.generationJob.update({
      where: { id: input.jobId },
      data: {
        status: "FAILED",
        errorCode: input.code,
        errorMessage: input.message,
        completedAt,
      },
    }),
    prisma.export.update({
      where: { id: input.exportId },
      data: {
        status: "FAILED",
        errorMessage: input.message,
        completedAt,
      },
    }),
  ]);
}

export async function runExportJob(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: {
      project: true,
      exports: true,
    },
  });
  if (!job || (job.type !== "EXPORT_MP3" && job.type !== "EXPORT_M4B")) {
    return;
  }

  const exportRecord = job.exports[0];
  if (!exportRecord) {
    return;
  }

  await prisma.$transaction([
    prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    }),
    prisma.export.update({
      where: { id: exportRecord.id },
      data: { status: "PROCESSING" },
    }),
  ]);

  const workDir = join(tmpdir(), "audiobooker", "exports", exportRecord.id);
  console.info("export_started", {
    jobId: job.id,
    exportId: exportRecord.id,
    type: job.type,
    projectId: job.projectId,
  });

  try {
    await mkdir(workDir, { recursive: true });
    const chapters = await loadExportableChapters(job.projectId);
    if (chapters.length === 0) {
      throw new AppError("EXPORT_AUDIO_INCOMPLETE", USER_SAFE_FAILURE, 422);
    }

    const storage = getStorage();
    const downloaded: { filename: string; title: string; durationSeconds: number | null; audio: Buffer }[] =
      [];

    for (const chapter of chapters) {
      const audio = await storage.getObject(chapter.objectKey);
      if (audio.length === 0) {
        throw new AppError("EXPORT_AUDIO_INVALID", USER_SAFE_FAILURE, 422);
      }
      const filename = `chapter-${String(chapter.orderIndex).padStart(2, "0")}.mp3`;
      await writeFile(join(workDir, filename), audio);
      downloaded.push({
        filename,
        title: chapter.title,
        durationSeconds: chapter.durationSeconds,
        audio,
      });
    }

    const metadata = toMetadata(job.project);
    let output: Buffer;
    let objectFilename: "chapters.zip" | "audiobook.m4b";
    let durationSeconds: number | null = null;
    let contentType: string;

    if (job.type === "EXPORT_MP3") {
      output = await buildChapterZip({
        entries: downloaded.map((chapter, index) => ({
          filename: chapterZipEntryName(chapters[index]?.orderIndex ?? index + 1, chapter.title),
          audio: chapter.audio,
        })),
        metadataText: buildMetadataText(metadata),
      });
      objectFilename = "chapters.zip";
      contentType = "application/zip";
    } else {
      const outputPath = join(workDir, "audiobook.m4b");
      let coverPath: string | undefined;
      if (job.project.coverObjectKey) {
        const cover = await storage.getObject(job.project.coverObjectKey);
        coverPath = join(workDir, "cover.bin");
        await writeFile(coverPath, cover);
      }
      const result = await buildM4b({
        workDir,
        chapters: downloaded,
        metadata,
        coverPath,
        outputPath,
      });
      output = await readFile(outputPath);
      objectFilename = "audiobook.m4b";
      contentType = "audio/mp4";
      durationSeconds = result.durationSeconds;
    }

    const objectKey = buildExportObjectKey({
      owner: job.project.userId
        ? { kind: "user", id: job.project.userId }
        : { kind: "anonymous", id: job.project.anonymousSessionId ?? job.projectId },
      projectId: job.projectId,
      exportId: exportRecord.id,
      filename: objectFilename,
    });

    await storage.putObject({
      objectKey,
      body: output,
      contentType,
    });

    const completedAt = new Date();
    const expiresAt = new Date(
      completedAt.getTime() + FILE_LIMITS.EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    await prisma.$transaction([
      prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          completedAt,
          errorCode: null,
          errorMessage: null,
        },
      }),
      prisma.export.update({
        where: { id: exportRecord.id },
        data: {
          status: "COMPLETED",
          objectKey,
          sizeBytes: BigInt(output.length),
          durationSeconds: durationSeconds == null ? null : durationSeconds.toFixed(3),
          expiresAt,
          completedAt,
          errorMessage: null,
        },
      }),
    ]);

    console.info("export_completed", {
      jobId: job.id,
      exportId: exportRecord.id,
      type: job.type,
      sizeBytes: output.length,
    });
  } catch (error) {
    const code =
      error instanceof AppError || error instanceof FfmpegError
        ? error.code
        : "EXPORT_PROCESSING_FAILED";
    console.error("export_failed", {
      jobId: job.id,
      exportId: exportRecord.id,
      code,
    });
    await failExport({
      jobId,
      exportId: exportRecord.id,
      code,
      message: USER_SAFE_FAILURE,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
