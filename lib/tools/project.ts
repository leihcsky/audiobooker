import { FILE_LIMITS } from "@/lib/config/limits";
import { conflict, forbidden, projectNotFound, sessionExpired } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { assertCanCreateProject } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db/prisma";
import { assertProjectAccess } from "@/lib/tools/access";
import { toProjectDto, type ProjectDto } from "@/lib/projects/project.dto";
import { DEFAULT_PROJECT_TITLE } from "@/lib/projects/project-title";
import { createProject } from "@/lib/projects/project.service";
import type { CreateProjectInput } from "@/lib/validation/project";

export async function createProjectForActor(
  actor: Actor,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  if (actor.type === "user") {
    await assertCanCreateProject(actor.userId);
    return createProject(actor.userId, input, { automaticTitle: true });
  }

  const existing = await prisma.project.count({
    where: {
      anonymousSessionId: actor.sessionId,
      userId: null,
      deletedAt: null,
    },
  });
  if (existing >= FILE_LIMITS.MAX_ANONYMOUS_PROJECTS) {
    throw conflict("This free session already has a project. Save it to continue in Studio.");
  }

  const expiresAt = new Date(
    Date.now() + FILE_LIMITS.ANONYMOUS_PROJECT_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const project = await prisma.project.create({
    data: {
      userId: null,
      anonymousSessionId: actor.sessionId,
      expiresAt,
      title: input.title?.trim() || DEFAULT_PROJECT_TITLE,
      author: input.author?.trim() || null,
      description: input.description?.trim() || null,
      language: input.language?.trim().toLowerCase() || "en",
      status: "DRAFT",
    },
  });
  return toProjectDto(project);
}

export async function getProjectDtoForActor(
  projectId: string,
  actor: Actor,
): Promise<ProjectDto> {
  const project = await assertProjectAccess(actor, projectId);
  return toProjectDto(project);
}

export async function getCurrentAnonymousProjectId(sessionId: string): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: {
      anonymousSessionId: sessionId,
      userId: null,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, expiresAt: true },
  });
  if (!project) {
    return null;
  }
  if (project.expiresAt && project.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  return project.id;
}

export async function claimProjectForUser(
  projectId: string,
  userId: string,
  sessionId: string | null,
): Promise<ProjectDto> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project || project.deletedAt) {
    throw projectNotFound();
  }
  if (project.userId === userId) {
    return toProjectDto(project);
  }
  if (project.userId) {
    throw forbidden("This project already belongs to another account.");
  }
  if (!sessionId || project.anonymousSessionId !== sessionId) {
    throw forbidden("This project cannot be saved.");
  }
  if (project.expiresAt && project.expiresAt.getTime() <= Date.now()) {
    throw sessionExpired();
  }
  await assertCanCreateProject(userId);

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      userId,
      anonymousSessionId: null,
      expiresAt: null,
    },
  });
  return toProjectDto(updated);
}

export async function claimSessionProjectsForUser(
  sessionId: string,
  userId: string,
): Promise<ProjectDto[]> {
  const projects = await prisma.project.findMany({
    where: {
      anonymousSessionId: sessionId,
      userId: null,
      deletedAt: null,
    },
  });
  const claimed: ProjectDto[] = [];
  for (const project of projects) {
    if (project.expiresAt && project.expiresAt.getTime() <= Date.now()) {
      continue;
    }
    claimed.push(await claimProjectForUser(project.id, userId, sessionId));
  }
  return claimed;
}
