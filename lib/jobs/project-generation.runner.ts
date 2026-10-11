import { prisma } from "@/lib/db/prisma";
import { claimProjectGenerationJob } from "@/lib/jobs/tts-claim";
import { runTtsJob } from "@/lib/jobs/tts.runner";
import { NARRATION_GENERIC_FAILURE } from "@/lib/tts/narration-failure";

const HEARTBEAT_MS = 60_000;

async function touchParent(jobId: string): Promise<void> {
  await prisma.generationJob.update({ where: { id: jobId }, data: { updatedAt: new Date() } });
}

async function cancelQueuedChildren(parentId: string): Promise<void> {
  await prisma.generationJob.updateMany({
    where: { parentJobId: parentId, status: "QUEUED" },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
}

async function failParent(parentId: string, errorCode: string, errorMessage: string): Promise<void> {
  await prisma.generationJob.updateMany({
    where: { id: parentId, status: "PROCESSING" },
    data: { status: "FAILED", errorCode, errorMessage, completedAt: new Date() },
  });
  await cancelQueuedChildren(parentId);
}

async function nextChild(parentId: string) {
  return prisma.generationJob.findFirst({
    where: { parentJobId: parentId, status: { in: ["QUEUED", "PROCESSING"] } },
    orderBy: [{ chapter: { orderIndex: "asc" } }, { createdAt: "asc" }],
    select: { id: true, chapterId: true, chapter: { select: { included: true } } },
  });
}

/**
 * Narrates a project's queued chapter jobs one at a time. Stops at the
 * first failure (finished chapters keep their audio) and checks for
 * cancellation between chapters.
 */
export async function runProjectGeneration(parentId: string): Promise<void> {
  if (!(await claimProjectGenerationJob(parentId))) {
    return;
  }
  const heartbeat = setInterval(() => {
    void touchParent(parentId).catch(() => undefined);
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  try {
    for (;;) {
      const parent = await prisma.generationJob.findUnique({
        where: { id: parentId },
        select: { status: true },
      });
      if (parent?.status !== "PROCESSING") {
        return;
      }

      const child = await nextChild(parentId);
      if (!child) {
        await prisma.generationJob.updateMany({
          where: { id: parentId, status: "PROCESSING" },
          data: { status: "COMPLETED", completedAt: new Date(), errorCode: null, errorMessage: null },
        });
        return;
      }

      if (!child.chapterId || !child.chapter?.included) {
        await prisma.generationJob.update({
          where: { id: child.id },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        continue;
      }

      await prisma.chapter.update({
        where: { id: child.chapterId },
        data: { status: "GENERATING" },
      });
      await runTtsJob(child.id);

      const finished = await prisma.generationJob.findUnique({
        where: { id: child.id },
        select: { status: true, errorCode: true, errorMessage: true },
      });
      if (finished?.status === "COMPLETED") {
        await prisma.generationJob.update({
          where: { id: parentId },
          data: { completedChunks: { increment: 1 } },
        });
        continue;
      }
      if (finished?.status === "FAILED") {
        await failParent(
          parentId,
          finished.errorCode ?? "TTS_GENERATION_FAILED",
          finished.errorMessage ?? NARRATION_GENERIC_FAILURE,
        );
        return;
      }
      // The chapter job is still owned by another runner; a later status poll resumes.
      return;
    }
  } catch (error) {
    console.error("project_generation_failed", {
      jobId: parentId,
      errorMessage: error instanceof Error ? error.message.slice(0, 400) : "unknown",
    });
    await failParent(parentId, "TTS_GENERATION_FAILED", NARRATION_GENERIC_FAILURE).catch(
      () => undefined,
    );
  } finally {
    clearInterval(heartbeat);
  }
}
