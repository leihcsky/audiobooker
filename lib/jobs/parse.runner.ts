import {
  AppError,
  conflict,
  sourceFileAlreadyProcessing,
  sourceFileNotFound,
  unauthenticated,
} from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import type { Actor } from "@/lib/auth/actor";
import { assertProjectWithinPlan } from "@/lib/billing/entitlements";
import { assertProjectAccess } from "@/lib/tools/access";
import { ingestSourceFile } from "@/lib/ingestion/ingestion.service";
import { toJobSummary, type JobSummary } from "@/lib/projects/project.detail";

export async function startParseJob(input: {
  userId?: string;
  actor?: Actor;
  projectId: string;
  sourceFileId: string;
}): Promise<JobSummary> {
  const actor =
    input.actor ?? (input.userId ? { type: "user" as const, userId: input.userId } : null);
  if (!actor) {
    throw unauthenticated();
  }
  await assertProjectAccess(actor, input.projectId);
  await assertProjectWithinPlan(actor, input.projectId);

  const narrating = await prisma.generationJob.count({
    where: {
      projectId: input.projectId,
      type: { in: ["GENERATE_TTS", "GENERATE_PROJECT"] },
      status: { in: ["QUEUED", "PROCESSING"] },
    },
  });
  if (narrating > 0) {
    throw conflict("Chapters are being narrated. Wait for narration to finish or stop it before parsing again.");
  }

  const source = await prisma.sourceFile.findUnique({
    where: { id: input.sourceFileId },
  });
  if (!source || source.projectId !== input.projectId) {
    throw sourceFileNotFound();
  }

  if (source.status === "PARSING") {
    const active = await prisma.generationJob.findFirst({
      where: {
        projectId: input.projectId,
        type: "PARSE_SOURCE",
        status: { in: ["QUEUED", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (active) {
      return toJobSummary(active);
    }
    throw sourceFileAlreadyProcessing();
  }

  const [job] = await prisma.$transaction([
    prisma.generationJob.create({
      data: {
        projectId: input.projectId,
        type: "PARSE_SOURCE",
        status: "QUEUED",
      },
    }),
    prisma.sourceFile.update({
      where: { id: source.id },
      data: { status: "PARSING" },
    }),
    prisma.project.update({
      where: { id: input.projectId },
      data: { status: "PROCESSING" },
    }),
  ]);

  return toJobSummary(job);
}

export async function runParseJob(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
  });
  if (!job || job.type !== "PARSE_SOURCE") {
    return;
  }

  const source = await prisma.sourceFile.findFirst({
    where: { projectId: job.projectId, status: "PARSING" },
    orderBy: { createdAt: "desc" },
  });
  if (!source) {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorCode: "SOURCE_FILE_NOT_FOUND",
        errorMessage: "Source file not found.",
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  try {
    await ingestSourceFile({
      projectId: job.projectId,
      sourceFileId: source.id,
      jobId,
    });
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
  } catch (error) {
    const code = error instanceof AppError ? error.code : "PARSE_FAILED";
    const message =
      error instanceof AppError ? error.message : "We couldn't process this file.";

    console.info("parse_failed", {
      projectId: job.projectId,
      sourceFileId: source.id,
      jobId,
      errorCode: code,
      ...(error instanceof AppError
        ? {}
        : {
            errorName: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message.slice(0, 300) : undefined,
          }),
    });

    await prisma.$transaction([
      prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorCode: code,
          errorMessage: message,
          completedAt: new Date(),
        },
      }),
      prisma.sourceFile.update({
        where: { id: source.id },
        data: { status: "FAILED" },
      }),
      prisma.project.update({
        where: { id: job.projectId },
        data: { status: "FAILED" },
      }),
    ]);
  }
}
