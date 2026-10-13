import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";

/** Work that stops when its project is deleted; a chapter or export already running finishes. */
export const JOBS_CANCELLED_ON_DELETE = {
  OR: [{ status: "QUEUED" }, { type: "GENERATE_PROJECT", status: "PROCESSING" }],
} satisfies Prisma.GenerationJobWhereInput;

/** Soft-deletes projects, keeping every record and stored file (DATABASE.md §15). */
export async function softDeleteProjects(projectIds: string[], now = new Date()): Promise<number> {
  if (projectIds.length === 0) {
    return 0;
  }
  const { count } = await prisma.project.updateMany({
    where: { id: { in: projectIds }, deletedAt: null },
    data: { deletedAt: now },
  });
  await prisma.generationJob.updateMany({
    where: { projectId: { in: projectIds }, ...JOBS_CANCELLED_ON_DELETE },
    data: { status: "CANCELLED", completedAt: now },
  });
  return count;
}
