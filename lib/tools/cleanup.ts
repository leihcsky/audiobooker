import { prisma } from "@/lib/db/prisma";
import { softDeleteProjects } from "@/lib/projects/project-deletion";

/**
 * Soft-deletes expired anonymous projects. Their records, stored files and
 * anonymous sessions are kept: deleting a session would cascade to its
 * projects.
 */
export async function cleanupExpiredAnonymousProjects(now = new Date()): Promise<number> {
  const expired = await prisma.project.findMany({
    where: {
      userId: null,
      anonymousSessionId: { not: null },
      expiresAt: { lte: now },
      deletedAt: null,
    },
    select: { id: true },
  });
  return softDeleteProjects(
    expired.map((project) => project.id),
    now,
  );
}
