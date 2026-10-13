import { prisma } from "@/lib/db/prisma";
import type { Actor } from "@/lib/auth/actor";
import { softDeleteProjects } from "@/lib/projects/project-deletion";

export async function resetAnonymousToolWorkspace(actor: Actor): Promise<{ projectId: null }> {
  if (actor.type !== "anonymous") {
    return { projectId: null };
  }

  const projects = await prisma.project.findMany({
    where: {
      anonymousSessionId: actor.sessionId,
      userId: null,
      deletedAt: null,
    },
    select: { id: true },
  });
  await softDeleteProjects(projects.map((project) => project.id));

  return { projectId: null };
}
