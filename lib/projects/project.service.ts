import type { Prisma, Project } from "@/generated/prisma";
import { forbidden, projectNotFound } from "@/lib/api/errors";
import { toProjectDto, type ProjectDto } from "@/lib/projects/project.dto";
import { JOBS_CANCELLED_ON_DELETE } from "@/lib/projects/project-deletion";
import { DEFAULT_PROJECT_TITLE } from "@/lib/projects/project-title";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "@/lib/validation/project";
import { prisma } from "@/lib/db/prisma";

export type ProjectStore = {
  project: {
    create: (args: { data: Prisma.ProjectUncheckedCreateInput }) => Promise<Project>;
    findMany: (args: {
      where?: Prisma.ProjectWhereInput;
      orderBy?: Prisma.ProjectOrderByWithRelationInput;
      skip?: number;
      take?: number;
    }) => Promise<Project[]>;
    findUnique: (args: { where: { id: string } }) => Promise<Project | null>;
    update: (args: {
      where: { id: string };
      data: Prisma.ProjectUpdateInput;
    }) => Promise<Project>;
    count: (args: { where?: Prisma.ProjectWhereInput }) => Promise<number>;
  };
  generationJob: {
    updateMany: (args: {
      where: Prisma.GenerationJobWhereInput;
      data: Prisma.GenerationJobUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
  };
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
};

export type ProjectListResult = {
  projects: ProjectDto[];
  pagination: Pagination;
};

function normalizeLanguage(language?: string): string {
  const trimmed = language?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : "en";
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function getOwnedProjectOrThrow(
  db: ProjectStore,
  projectId: string,
  userId: string,
): Promise<Project> {
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.deletedAt) {
    throw projectNotFound();
  }

  if (project.userId !== userId) {
    throw forbidden("You do not have access to this project.");
  }

  return project;
}

export function createProjectService(db: ProjectStore) {
  return {
    async createProject(
      userId: string,
      input: CreateProjectInput,
      options: { automaticTitle?: boolean } = {},
    ): Promise<ProjectDto> {
      const title = input.title?.trim() ?? "";
      const project = await db.project.create({
        data: {
          userId,
          title: title || DEFAULT_PROJECT_TITLE,
          titleSetByUser: title.length > 0 && !options.automaticTitle,
          author: normalizeOptionalText(input.author) ?? null,
          description: normalizeOptionalText(input.description) ?? null,
          language: normalizeLanguage(input.language),
          status: "DRAFT",
        },
      });

      return toProjectDto(project);
    },

    async listProjectsForUser(
      userId: string,
      query: ListProjectsQuery,
    ): Promise<ProjectListResult> {
      const where: Prisma.ProjectWhereInput = {
        userId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      };

      const skip = (query.page - 1) * query.limit;

      const [projects, total] = await Promise.all([
        db.project.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: query.limit,
        }),
        db.project.count({ where }),
      ]);

      return {
        projects: projects.map(toProjectDto),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
        },
      };
    },

    async getProjectForUser(projectId: string, userId: string): Promise<ProjectDto> {
      const project = await getOwnedProjectOrThrow(db, projectId, userId);
      return toProjectDto(project);
    },

    async updateProjectForUser(
      projectId: string,
      userId: string,
      input: UpdateProjectInput,
    ): Promise<ProjectDto> {
      await getOwnedProjectOrThrow(db, projectId, userId);

      const data: Prisma.ProjectUpdateInput = {};

      if (input.title !== undefined) {
        data.title = input.title.trim();
        data.titleSetByUser = true;
      }

      if (input.author !== undefined) {
        data.author = normalizeOptionalText(input.author) ?? null;
      }

      if (input.description !== undefined) {
        data.description = normalizeOptionalText(input.description) ?? null;
      }

      if (input.language !== undefined) {
        data.language = normalizeLanguage(input.language);
      }

      if (input.narrator !== undefined) {
        data.narrator = normalizeOptionalText(input.narrator) ?? null;
      }

      if (input.publisher !== undefined) {
        data.publisher = normalizeOptionalText(input.publisher) ?? null;
      }

      if (input.copyright !== undefined) {
        data.copyright = normalizeOptionalText(input.copyright) ?? null;
      }

      if (input.aiDisclosure !== undefined) {
        data.aiDisclosure = normalizeOptionalText(input.aiDisclosure) ?? null;
      }

      const project = await db.project.update({
        where: { id: projectId },
        data,
      });

      return toProjectDto(project);
    },

    async deleteProjectForUser(projectId: string, userId: string): Promise<void> {
      await getOwnedProjectOrThrow(db, projectId, userId);
      const now = new Date();
      await db.project.update({
        where: { id: projectId },
        data: { deletedAt: now },
      });
      await db.generationJob.updateMany({
        where: { projectId, ...JOBS_CANCELLED_ON_DELETE },
        data: { status: "CANCELLED", completedAt: now },
      });
    },
  };
}

const projectService = createProjectService(prisma as unknown as ProjectStore);

export const createProject = projectService.createProject.bind(projectService);
export const listProjectsForUser = projectService.listProjectsForUser.bind(projectService);
export const getProjectForUser = projectService.getProjectForUser.bind(projectService);
export const updateProjectForUser = projectService.updateProjectForUser.bind(projectService);
export const deleteProjectForUser = projectService.deleteProjectForUser.bind(projectService);
