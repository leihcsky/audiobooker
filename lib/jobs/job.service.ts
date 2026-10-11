import { prisma } from "@/lib/db/prisma";
import { projectNotFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { toJobSummary, type JobSummary } from "@/lib/projects/project.detail";
import { assertProjectAccess } from "@/lib/tools/access";

export async function getJobForUser(jobId: string, userId: string): Promise<JobSummary> {
  return getJobForActor(jobId, { type: "user", userId });
}

export async function getJobForActor(jobId: string, actor: Actor): Promise<JobSummary> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw projectNotFound();
  }
  await assertProjectAccess(actor, job.projectId);
  return toJobSummary(job);
}
