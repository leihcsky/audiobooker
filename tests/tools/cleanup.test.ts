import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindMany = vi.hoisted(() => vi.fn());
const projectDelete = vi.hoisted(() => vi.fn());
const sessionDeleteMany = vi.hoisted(() => vi.fn());
const deleteObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findMany: projectFindMany, delete: projectDelete },
    anonymousSession: { deleteMany: sessionDeleteMany },
  },
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ deleteObject }),
}));

import { cleanupExpiredAnonymousProjects } from "@/lib/tools/cleanup";

describe("cleanupExpiredAnonymousProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteObject.mockResolvedValue(undefined);
    projectDelete.mockResolvedValue({});
    sessionDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("deletes expired anonymous projects and their objects", async () => {
    projectFindMany.mockResolvedValue([
      {
        id: "anon-1",
        userId: null,
        coverObjectKey: "anonymous/s/projects/anon-1/cover/cover.jpg",
        sourceFiles: [{ objectKey: "src" }],
        audioFiles: [{ objectKey: "audio" }],
        exports: [{ objectKey: "export" }],
      },
    ]);

    await expect(cleanupExpiredAnonymousProjects()).resolves.toBe(1);
    expect(deleteObject).toHaveBeenCalledTimes(4);
    expect(projectDelete).toHaveBeenCalledWith({ where: { id: "anon-1" } });
  });

  it("queries only anonymous expired projects, never user-owned rows", async () => {
    projectFindMany.mockResolvedValue([]);
    await cleanupExpiredAnonymousProjects(new Date("2026-09-27T00:00:00.000Z"));
    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: null,
          anonymousSessionId: { not: null },
          expiresAt: { lte: new Date("2026-09-27T00:00:00.000Z") },
        },
      }),
    );
    expect(projectDelete).not.toHaveBeenCalled();
  });
});
