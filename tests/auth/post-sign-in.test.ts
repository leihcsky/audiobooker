import { beforeEach, describe, expect, it, vi } from "vitest";

const claimProjectForUser = vi.hoisted(() => vi.fn());
const claimSessionProjectsForUser = vi.hoisted(() => vi.fn());
const recordToolEvent = vi.hoisted(() => vi.fn());
const userFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tools/project", () => ({ claimProjectForUser, claimSessionProjectsForUser }));
vi.mock("@/lib/tools/events", () => ({ recordToolEvent }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: userFindUnique } } }));

import { AppError } from "@/lib/api/errors";
import { claimAfterSignIn, isNewOAuthAccount, safeRedirectPath } from "@/lib/auth/post-sign-in";

const PROJECT_ID = "6f1c2b9e-3d4a-4f5b-8c7d-1e2f3a4b5c6d";

describe("isNewOAuthAccount", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("is true for a password-less account created moments ago", async () => {
    userFindUnique.mockResolvedValue({ createdAt: new Date("2026-10-14T11:58:00Z"), passwordHash: null });
    await expect(isNewOAuthAccount("user-1", now)).resolves.toBe(true);
  });

  it("is false for an older account or one with a password", async () => {
    userFindUnique.mockResolvedValue({ createdAt: new Date("2026-10-14T11:50:00Z"), passwordHash: null });
    await expect(isNewOAuthAccount("user-1", now)).resolves.toBe(false);

    userFindUnique.mockResolvedValue({ createdAt: new Date("2026-10-14T11:59:00Z"), passwordHash: "hash" });
    await expect(isNewOAuthAccount("user-1", now)).resolves.toBe(false);

    userFindUnique.mockResolvedValue(null);
    await expect(isNewOAuthAccount("user-1", now)).resolves.toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/studio/projects/abc?tab=edit")).toBe("/studio/projects/abc?tab=edit");
  });

  it("falls back for missing, absolute, or protocol-relative targets", () => {
    expect(safeRedirectPath(null)).toBe("/studio");
    expect(safeRedirectPath("https://evil.example")).toBe("/studio");
    expect(safeRedirectPath("//evil.example")).toBe("/studio");
    expect(safeRedirectPath("/\\evil.example")).toBe("/studio");
  });
});

describe("claimAfterSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims the requested project and records the event", async () => {
    claimProjectForUser.mockResolvedValue({ id: PROJECT_ID });

    await expect(
      claimAfterSignIn({ userId: "user-1", sessionId: "session-1", claimId: PROJECT_ID }),
    ).resolves.toBe(PROJECT_ID);
    expect(claimProjectForUser).toHaveBeenCalledWith(PROJECT_ID, "user-1", "session-1");
    expect(recordToolEvent).toHaveBeenCalledWith({
      actor: { type: "user", userId: "user-1" },
      projectId: PROJECT_ID,
      name: "tool_project_claimed",
    });
  });

  it("ignores a malformed claim id", async () => {
    await expect(claimAfterSignIn({ userId: "user-1", sessionId: null, claimId: "not-a-uuid" })).resolves.toBeNull();
    expect(claimProjectForUser).not.toHaveBeenCalled();
  });

  it("claims the anonymous session's projects when no project is named", async () => {
    claimSessionProjectsForUser.mockResolvedValue([{ id: PROJECT_ID }]);

    await expect(claimAfterSignIn({ userId: "user-1", sessionId: "session-1", claimId: null })).resolves.toBe(
      PROJECT_ID,
    );
    expect(claimSessionProjectsForUser).toHaveBeenCalledWith("session-1", "user-1");
  });

  it("does nothing without a claim or anonymous session", async () => {
    await expect(claimAfterSignIn({ userId: "user-1", sessionId: null, claimId: null })).resolves.toBeNull();
    expect(recordToolEvent).not.toHaveBeenCalled();
  });

  it("skips a claim the user cannot make", async () => {
    claimProjectForUser.mockRejectedValue(new AppError("SESSION_EXPIRED", "Expired.", 410));

    await expect(
      claimAfterSignIn({ userId: "user-1", sessionId: "session-1", claimId: PROJECT_ID }),
    ).resolves.toBeNull();
    expect(recordToolEvent).not.toHaveBeenCalled();
  });
});
