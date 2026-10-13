import type { Prisma, Project, ProjectStatus } from "@/generated/prisma";
import type { ProjectStore } from "@/lib/projects/project.service";

export function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date("2026-01-15T12:00:00.000Z");

  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "My Audiobook",
    titleSetByUser: true,
    author: "Jane Doe",
    description: "Optional description",
    language: "en",
    narrator: null,
    publisher: null,
    copyright: null,
    anonymousSessionId: null,
    expiresAt: null,
    status: "DRAFT",
    coverObjectKey: null,
    coverWidth: null,
    coverHeight: null,
    aiDisclosure: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMemoryProjectStore(initial: Project[] = []): ProjectStore & {
  records: Project[];
  cancelledJobs: Prisma.GenerationJobWhereInput[];
} {
  const records = [...initial];
  const cancelledJobs: Prisma.GenerationJobWhereInput[] = [];

  function matches(project: Project, where?: Prisma.ProjectWhereInput): boolean {
    if (where?.userId && project.userId !== where.userId) {
      return false;
    }
    if (where?.status && project.status !== where.status) {
      return false;
    }
    if (where?.deletedAt === null && project.deletedAt !== null) {
      return false;
    }
    return true;
  }

  const store: ProjectStore = {
    project: {
      async create({ data }) {
        const now = new Date("2026-01-15T12:00:00.000Z");
        const project = makeProject({
          id: data.id ?? crypto.randomUUID(),
          userId: data.userId ?? null,
          anonymousSessionId: data.anonymousSessionId ?? null,
          expiresAt:
            data.expiresAt instanceof Date
              ? data.expiresAt
              : data.expiresAt
                ? new Date(data.expiresAt)
                : null,
          title: data.title,
          titleSetByUser: data.titleSetByUser ?? false,
          author: data.author ?? null,
          description: data.description ?? null,
          language: data.language ?? "en",
          narrator: data.narrator ?? null,
          publisher: data.publisher ?? null,
          copyright: data.copyright ?? null,
          status: (data.status as ProjectStatus | undefined) ?? "DRAFT",
          coverObjectKey: data.coverObjectKey ?? null,
          createdAt: now,
          updatedAt: now,
        });
        records.push(project);
        return project;
      },
      async findMany({ where, skip = 0, take }) {
        let items = records.filter((project) => matches(project, where));
        items = items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return items.slice(skip, take == null ? undefined : skip + take);
      },
      async findUnique({ where }) {
        return records.find((project) => project.id === where.id) ?? null;
      },
      async update({ where, data }) {
        const index = records.findIndex((project) => project.id === where.id);
        if (index === -1) {
          throw new Error("Project missing");
        }
        const current = records[index];
        const updated: Project = {
          ...current,
          title: typeof data.title === "string" ? data.title : current.title,
          titleSetByUser:
            typeof data.titleSetByUser === "boolean" ? data.titleSetByUser : current.titleSetByUser,
          author:
            data.author === undefined
              ? current.author
              : (data.author as string | null),
          description:
            data.description === undefined
              ? current.description
              : (data.description as string | null),
          language: typeof data.language === "string" ? data.language : current.language,
          narrator:
            data.narrator === undefined ? current.narrator : (data.narrator as string | null),
          publisher:
            data.publisher === undefined
              ? current.publisher
              : (data.publisher as string | null),
          copyright:
            data.copyright === undefined
              ? current.copyright
              : (data.copyright as string | null),
          deletedAt: data.deletedAt instanceof Date ? data.deletedAt : current.deletedAt,
          updatedAt: new Date("2026-01-16T12:00:00.000Z"),
        };
        records[index] = updated;
        return updated;
      },
      async count({ where }) {
        return records.filter((project) => matches(project, where)).length;
      },
    },
    generationJob: {
      async updateMany({ where }) {
        cancelledJobs.push(where);
        return { count: 0 };
      },
    },
  };

  return { ...store, records, cancelledJobs };
}
