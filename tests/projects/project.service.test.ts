import { describe, expect, it } from "vitest";
import { createProjectService } from "@/lib/projects/project.service";
import { createMemoryProjectStore, makeProject } from "../helpers/project-store";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("project service", () => {
  it("lets an authenticated user create a project", async () => {
    const store = createMemoryProjectStore();
    const service = createProjectService(store);

    const project = await service.createProject(ownerId, {
      title: "  The Great Gatsby  ",
      description: "A novel",
    });

    expect(project.title).toBe("The Great Gatsby");
    expect(project.description).toBe("A novel");
    expect(project.language).toBe("en");
    expect(project.status).toBe("DRAFT");
    expect(store.records).toHaveLength(1);
    expect(store.records[0]?.userId).toBe(ownerId);
    expect(store.records[0]?.titleSetByUser).toBe(true);
  });

  it("uses a placeholder title the first parse may replace when none is given", async () => {
    const store = createMemoryProjectStore();
    const service = createProjectService(store);

    const project = await service.createProject(ownerId, { title: "   " });

    expect(project.title).toBe("Untitled audiobook");
    expect(store.records[0]?.titleSetByUser).toBe(false);
  });

  it("marks titles derived from a file name as automatic", async () => {
    const store = createMemoryProjectStore();
    const service = createProjectService(store);

    await service.createProject(ownerId, { title: "my-book" }, { automaticTitle: true });

    expect(store.records[0]?.title).toBe("my-book");
    expect(store.records[0]?.titleSetByUser).toBe(false);
  });

  it("keeps a title the user edits after parsing", async () => {
    const store = createMemoryProjectStore([makeProject({ userId: ownerId, titleSetByUser: false })]);
    const service = createProjectService(store);

    await service.updateProjectForUser("11111111-1111-4111-8111-111111111111", ownerId, {
      title: "My Edit",
    });

    expect(store.records[0]?.titleSetByUser).toBe(true);
  });

  it("lists only the current user's projects", async () => {
    const store = createMemoryProjectStore([
      makeProject({ id: "11111111-1111-4111-8111-111111111111", userId: ownerId, title: "Mine" }),
      makeProject({
        id: "22222222-2222-4222-8222-222222222222",
        userId: otherUserId,
        title: "Theirs",
      }),
    ]);
    const service = createProjectService(store);

    const result = await service.listProjectsForUser(ownerId, { page: 1, limit: 20 });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.title).toBe("Mine");
    expect(result.pagination.total).toBe(1);
  });

  it("does not let a user access another user's project", async () => {
    const store = createMemoryProjectStore([
      makeProject({ userId: ownerId }),
    ]);
    const service = createProjectService(store);

    await expect(
      service.getProjectForUser("11111111-1111-4111-8111-111111111111", otherUserId),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("lets a user update their own project", async () => {
    const store = createMemoryProjectStore([makeProject({ userId: ownerId })]);
    const service = createProjectService(store);

    const updated = await service.updateProjectForUser(
      "11111111-1111-4111-8111-111111111111",
      ownerId,
      { title: "Updated Title", author: "Updated Author" },
    );

    expect(updated.title).toBe("Updated Title");
    expect(updated.author).toBe("Updated Author");
  });

  it("lets a user update audiobook metadata on their project", async () => {
    const store = createMemoryProjectStore([makeProject({ userId: ownerId })]);
    const service = createProjectService(store);

    const updated = await service.updateProjectForUser(
      "11111111-1111-4111-8111-111111111111",
      ownerId,
      { narrator: "Alex", publisher: "Studio", copyright: "2026" },
    );

    expect(updated.narrator).toBe("Alex");
    expect(updated.publisher).toBe("Studio");
    expect(updated.copyright).toBe("2026");
  });

  it("does not let a user update another user's project", async () => {
    const store = createMemoryProjectStore([makeProject({ userId: ownerId })]);
    const service = createProjectService(store);

    await expect(
      service.updateProjectForUser(
        "11111111-1111-4111-8111-111111111111",
        otherUserId,
        { title: "Hacked" },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("soft-deletes a user's own project and cancels its pending work", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const store = createMemoryProjectStore([makeProject({ userId: ownerId })]);
    const service = createProjectService(store);

    await service.deleteProjectForUser(projectId, ownerId);

    expect(store.records).toHaveLength(1);
    expect(store.records[0]?.deletedAt).toBeInstanceOf(Date);
    expect(store.cancelledJobs).toEqual([
      {
        projectId,
        OR: [{ status: "QUEUED" }, { type: "GENERATE_PROJECT", status: "PROCESSING" }],
      },
    ]);
  });

  it("hides a deleted project from its owner", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const store = createMemoryProjectStore([
      makeProject({ userId: ownerId, deletedAt: new Date("2026-01-20T00:00:00.000Z") }),
    ]);
    const service = createProjectService(store);

    await expect(service.getProjectForUser(projectId, ownerId)).rejects.toMatchObject({
      code: "PROJECT_NOT_FOUND",
    });
    await expect(service.deleteProjectForUser(projectId, ownerId)).rejects.toMatchObject({
      code: "PROJECT_NOT_FOUND",
    });
    const list = await service.listProjectsForUser(ownerId, { page: 1, limit: 20 });
    expect(list.projects).toHaveLength(0);
    expect(list.pagination.total).toBe(0);
  });

  it("does not let a user delete another user's project", async () => {
    const store = createMemoryProjectStore([makeProject({ userId: ownerId })]);
    const service = createProjectService(store);

    await expect(
      service.deleteProjectForUser(
        "11111111-1111-4111-8111-111111111111",
        otherUserId,
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    expect(store.records).toHaveLength(1);
  });

  it("returns PROJECT_NOT_FOUND for a missing project", async () => {
    const store = createMemoryProjectStore();
    const service = createProjectService(store);

    await expect(
      service.getProjectForUser("99999999-9999-4999-8999-999999999999", ownerId),
    ).rejects.toMatchObject({
      code: "PROJECT_NOT_FOUND",
      status: 404,
    });
  });
});
