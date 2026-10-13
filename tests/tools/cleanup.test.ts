import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindMany = vi.hoisted(() => vi.fn());
const projectUpdateMany = vi.hoisted(() => vi.fn());
const jobUpdateMany = vi.hoisted(() => vi.fn());
const sessionDeleteMany = vi.hoisted(() => vi.fn());
const deleteObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findMany: projectFindMany, updateMany: projectUpdateMany },
    generationJob: { updateMany: jobUpdateMany },
    anonymousSession: { deleteMany: sessionDeleteMany },
  },
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ deleteObject }),
}));

import { cleanupExpiredAnonymousProjects } from "@/lib/tools/cleanup";

const now = new Date("2026-09-27T00:00:00.000Z");

describe("cleanupExpiredAnonymousProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectUpdateMany.mockResolvedValue({ count: 1 });
    jobUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("soft-deletes expired anonymous projects and keeps their files and sessions", async () => {
    projectFindMany.mockResolvedValue([{ id: "anon-1" }]);

    await expect(cleanupExpiredAnonymousProjects(now)).resolves.toBe(1);

    expect(projectUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["anon-1"] }, deletedAt: null },
      data: { deletedAt: now },
    });
    expect(jobUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED", completedAt: now } }),
    );
    expect(deleteObject).not.toHaveBeenCalled();
    expect(sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("queries only live anonymous expired projects, never user-owned rows", async () => {
    projectFindMany.mockResolvedValue([]);

    await expect(cleanupExpiredAnonymousProjects(now)).resolves.toBe(0);

    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: null,
          anonymousSessionId: { not: null },
          expiresAt: { lte: now },
          deletedAt: null,
        },
      }),
    );
    expect(projectUpdateMany).not.toHaveBeenCalled();
  });
});
