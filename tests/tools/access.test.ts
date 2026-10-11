import { beforeEach, describe, expect, it, vi } from "vitest";

const projectFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
  },
}));

import { actorOwnsProject, assertProjectAccess } from "@/lib/tools/access";
import { makeProject } from "../helpers/project-store";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherSessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("project access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let session A read session B's project", async () => {
    const project = makeProject({
      userId: null,
      anonymousSessionId: sessionId,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    projectFindUnique.mockResolvedValue(project);

    await expect(
      assertProjectAccess({ type: "anonymous", sessionId: otherSessionId }, project.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns SESSION_EXPIRED for an expired anonymous project", async () => {
    const project = makeProject({
      userId: null,
      anonymousSessionId: sessionId,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    projectFindUnique.mockResolvedValue(project);

    await expect(
      assertProjectAccess({ type: "anonymous", sessionId }, project.id),
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("lets the owning anonymous session access a live project", async () => {
    const project = makeProject({
      userId: null,
      anonymousSessionId: sessionId,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    projectFindUnique.mockResolvedValue(project);

    await expect(
      assertProjectAccess({ type: "anonymous", sessionId }, project.id),
    ).resolves.toEqual(project);
  });

  it("does not treat a user project as anonymous-owned", () => {
    const project = makeProject({ userId, anonymousSessionId: null });
    expect(actorOwnsProject(project, { type: "anonymous", sessionId })).toBe(false);
    expect(actorOwnsProject(project, { type: "user", userId })).toBe(true);
  });
});
