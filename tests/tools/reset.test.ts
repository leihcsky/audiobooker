import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindMany = vi.hoisted(() => vi.fn());
const projectDelete = vi.hoisted(() => vi.fn());
const deleteObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findMany: projectFindMany, delete: projectDelete },
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
    deleteObject.mockResolvedValue(undefined);
    projectDelete.mockResolvedValue({});
  });

  it("deletes the anonymous session project and stored objects", async () => {
    projectFindMany.mockResolvedValue([
      {
        id: "anon-1",
        coverObjectKey: "anonymous/s/projects/anon-1/cover/cover.jpg",
        sourceFiles: [{ objectKey: "src" }],
        audioFiles: [{ objectKey: "audio" }],
        exports: [{ objectKey: "export" }],
      },
    ]);

    await expect(
      resetAnonymousToolWorkspace({ type: "anonymous", sessionId }),
    ).resolves.toEqual({ projectId: null });

    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { anonymousSessionId: sessionId, userId: null },
      }),
    );
    expect(deleteObject).toHaveBeenCalledTimes(4);
    expect(projectDelete).toHaveBeenCalledWith({ where: { id: "anon-1" } });
  });

  it("does not delete Studio projects for signed-in users", async () => {
    await expect(
      resetAnonymousToolWorkspace({ type: "user", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    ).resolves.toEqual({ projectId: null });
    expect(projectFindMany).not.toHaveBeenCalled();
    expect(projectDelete).not.toHaveBeenCalled();
  });
});
