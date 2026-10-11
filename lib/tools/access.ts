import type { Project } from "@/generated/prisma";
import { forbidden, projectNotFound, sessionExpired } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";

export type ProjectOwnerFields = Pick<
  Project,
  "id" | "userId" | "anonymousSessionId" | "expiresAt"
>;

export function actorOwnsProject(project: ProjectOwnerFields, actor: Actor): boolean {
  if (actor.type === "user") {
    return project.userId === actor.userId;
  }
  return project.anonymousSessionId === actor.sessionId && !project.userId;
}

export async function assertProjectAccess(actor: Actor, projectId: string): Promise<Project> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    throw projectNotFound();
  }
  if (
    actor.type === "anonymous" &&
    project.expiresAt &&
    project.expiresAt.getTime() <= Date.now()
  ) {
    throw sessionExpired();
  }
  if (!actorOwnsProject(project, actor)) {
    throw forbidden("You do not have access to this project.");
  }
  return project;
}
