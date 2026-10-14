import type { JobType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { runExportJob } from "@/lib/jobs/export.runner";
import { runParseJob } from "@/lib/jobs/parse.runner";
import { runProjectGeneration } from "@/lib/jobs/project-generation.runner";
import { runTtsJob } from "@/lib/jobs/tts.runner";

const RUNNERS: Partial<Record<JobType, (jobId: string) => Promise<void>>> = {
  PARSE_SOURCE: runParseJob,
  GENERATE_TTS: runTtsJob,
  GENERATE_PROJECT: runProjectGeneration,
  EXPORT_MP3: runExportJob,
  EXPORT_M4B: runExportJob,
};

const RECOVERABLE_TYPES = Object.keys(RUNNERS) as JobType[];

/**
 * Jobs run inside the single app process, so at startup every QUEUED or
 * PROCESSING job was cut off by the previous shutdown. Requeues and
 * restarts them; chapter jobs of a project generation are driven by their
 * parent. Assumes exactly one app process (docs/DEPLOYMENT.md).
 */
export async function recoverInterruptedJobs(): Promise<number> {
  const recoverable = { type: { in: RECOVERABLE_TYPES }, project: { deletedAt: null } };
  await prisma.generationJob.updateMany({
    where: { ...recoverable, status: "PROCESSING" },
    data: { status: "QUEUED" },
  });
  const jobs = await prisma.generationJob.findMany({
    where: { ...recoverable, status: "QUEUED", parentJobId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true },
  });

  for (const job of jobs) {
    RUNNERS[job.type]?.(job.id).catch((error: unknown) => {
      console.error("job_recovery_failed", {
        jobId: job.id,
        type: job.type,
        errorMessage: error instanceof Error ? error.message.slice(0, 400) : "unknown",
      });
    });
  }
  if (jobs.length > 0) {
    console.info("jobs_recovered", { count: jobs.length });
  }
  return jobs.length;
}
