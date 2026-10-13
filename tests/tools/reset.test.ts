import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindMany = vi.hoisted(() => vi.fn());
const projectUpdateMany = vi.hoisted(() => vi.fn());
const jobUpdateMany = vi.hoisted(() => vi.fn());
const deleteObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findMany: projectFindMany, updateMany: projectUpdateMany },
    generationJob: { updateMany: jobUpdateMany },
  },
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ deleteObject }),
}));

import { resetAnonymousToolWorkspace } from "@/lib/tools/reset";

const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resetAnonymousToolWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectUpdateMany.mockResolvedValue({ count: 1 });
    jobUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("soft-deletes the session's project, cancels its pending work and keeps its files", async () => {
    projectFindMany.mockResolvedValue([{ id: "anon-1" }]);

    await expect(
      resetAnonymousToolWorkspace({ type: "anonymous", sessionId }),
    ).resolves.toEqual({ projectId: null });

    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { anonymousSessionId: sessionId, userId: null, deletedAt: null },
      }),
    );
    expect(projectUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["anon-1"] }, deletedAt: null } }),
    );
    expect(jobUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: { in: ["anon-1"] } }),
      }),
    );
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("does not touch Studio projects for signed-in users", async () => {
    await expect(
      resetAnonymousToolWorkspace({ type: "user", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    ).resolves.toEqual({ projectId: null });
    expect(projectFindMany).not.toHaveBeenCalled();
    expect(projectUpdateMany).not.toHaveBeenCalled();
  });
});
