import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindUnique = vi.hoisted(() => vi.fn());
const projectUpdate = vi.hoisted(() => vi.fn());
const projectFindMany = vi.hoisted(() => vi.fn());
const assertCanCreateProject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findUnique: projectFindUnique,
      update: projectUpdate,
      findMany: projectFindMany,
    },
  },
}));

vi.mock("@/lib/billing/entitlements", () => ({ assertCanCreateProject }));

import { claimProjectForUser } from "@/lib/tools/project";
import { makeProject } from "../helpers/project-store";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherSessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("claimProjectForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertCanCreateProject.mockResolvedValue(undefined);
  });

  it("refuses the claim when the account is at its project limit", async () => {
    projectFindUnique.mockResolvedValue(
      makeProject({
        userId: null,
        anonymousSessionId: sessionId,
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      }),
    );
    assertCanCreateProject.mockRejectedValue(
      Object.assign(new Error("limit"), { code: "PLAN_REQUIRED" }),
    );

    await expect(
      claimProjectForUser("11111111-1111-4111-8111-111111111111", userId, sessionId),
    ).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("transfers an anonymous project owned by the current session", async () => {
    const project = makeProject({
      userId: null,
      anonymousSessionId: sessionId,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    projectFindUnique.mockResolvedValue(project);
    projectUpdate.mockResolvedValue({
      ...project,
      userId,
      anonymousSessionId: null,
      expiresAt: null,
    });

    const claimed = await claimProjectForUser(project.id, userId, sessionId);
    expect(claimed.id).toBe(project.id);
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: project.id },
      data: {
        userId,
        anonymousSessionId: null,
        expiresAt: null,
      },
    });
  });

  it("does not let a different session claim the project", async () => {
    projectFindUnique.mockResolvedValue(
      makeProject({
        userId: null,
        anonymousSessionId: sessionId,
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      }),
    );

    await expect(
      claimProjectForUser("11111111-1111-4111-8111-111111111111", userId, otherSessionId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("does not claim an expired anonymous project", async () => {
    projectFindUnique.mockResolvedValue(
      makeProject({
        userId: null,
        anonymousSessionId: sessionId,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      }),
    );

    await expect(
      claimProjectForUser("11111111-1111-4111-8111-111111111111", userId, sessionId),
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });
});
