import { prisma } from "@/lib/db/prisma";
import { deleteProjectWithStoredObjects } from "@/lib/tools/project-assets";

export async function cleanupExpiredAnonymousProjects(now = new Date()): Promise<number> {
  const expired = await prisma.project.findMany({
    where: {
      userId: null,
      anonymousSessionId: { not: null },
      expiresAt: { lte: now },
    },
    include: {
      sourceFiles: { select: { objectKey: true } },
      audioFiles: { select: { objectKey: true } },
      exports: { select: { objectKey: true } },
    },
  });

  for (const project of expired) {
    await deleteProjectWithStoredObjects(project);
  }

  await prisma.anonymousSession.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  return expired.length;
}
