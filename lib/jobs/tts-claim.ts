import type { JobType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";

export const TTS_STALE_PROCESSING_MS = 10 * 60 * 1000;

async function claimJob(jobId: string, type: JobType): Promise<boolean> {
  const queued = await prisma.generationJob.updateMany({
    where: { id: jobId, type, status: "QUEUED" },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  if (queued.count > 0) {
    return true;
  }

  const staleBefore = new Date(Date.now() - TTS_STALE_PROCESSING_MS);
  const stale = await prisma.generationJob.updateMany({
    where: {
      id: jobId,
      type,
      status: "PROCESSING",
      updatedAt: { lt: staleBefore },
    },
    data: {
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  return stale.count > 0;
}

export function claimTtsJob(jobId: string): Promise<boolean> {
  return claimJob(jobId, "GENERATE_TTS");
}

export function claimProjectGenerationJob(jobId: string): Promise<boolean> {
  return claimJob(jobId, "GENERATE_PROJECT");
}

export async function touchTtsJob(jobId: string): Promise<void> {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { errorMessage: null },
  });
}

export function isJobStale(job: { status: string; updatedAt: Date }, now = Date.now()): boolean {
  return job.status === "PROCESSING" && job.updatedAt.getTime() < now - TTS_STALE_PROCESSING_MS;
}
