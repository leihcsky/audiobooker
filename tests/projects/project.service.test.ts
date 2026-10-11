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

  it("lets a user delete their own project", async () => {
    const store = createMemoryProjectStore([makeProject({ userId: ownerId })]);
    const service = createProjectService(store);

    await service.deleteProjectForUser(
      "11111111-1111-4111-8111-111111111111",
      ownerId,
    );

    expect(store.records).toHaveLength(0);
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
