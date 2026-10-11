import { prisma } from "@/lib/db/prisma";
import type { Actor } from "@/lib/auth/actor";
import { deleteProjectWithStoredObjects } from "@/lib/tools/project-assets";

export async function resetAnonymousToolWorkspace(actor: Actor): Promise<{ projectId: null }> {
  if (actor.type !== "anonymous") {
    return { projectId: null };
  }

  const projects = await prisma.project.findMany({
    where: {
      anonymousSessionId: actor.sessionId,
      userId: null,
    },
    include: {
      sourceFiles: { select: { objectKey: true } },
      audioFiles: { select: { objectKey: true } },
      exports: { select: { objectKey: true } },
    },
  });

  for (const project of projects) {
    await deleteProjectWithStoredObjects(project);
  }

  return { projectId: null };
}
