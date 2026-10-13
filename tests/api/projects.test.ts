import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const requireActor = vi.hoisted(() => vi.fn());
const createProjectForActor = vi.hoisted(() => vi.fn());
const listProjectsForUser = vi.hoisted(() => vi.fn());
const getProjectForUser = vi.hoisted(() => vi.fn());
const getProjectDetailForActor = vi.hoisted(() => vi.fn());
const updateProjectForUser = vi.hoisted(() => vi.fn());
const deleteProjectForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireSession,
}));

vi.mock("@/lib/auth/actor", () => ({
  requireActor,
}));

vi.mock("@/lib/projects/project.service", () => ({
  listProjectsForUser,
  getProjectForUser,
  updateProjectForUser,
  deleteProjectForUser,
}));

vi.mock("@/lib/tools/project", () => ({
  createProjectForActor,
}));

vi.mock("@/lib/projects/project.detail", () => ({
  getProjectDetailForActor,
}));

import { GET as listOrGetProjects, POST } from "@/app/api/projects/route";
import { GET as getProject, PATCH } from "@/app/api/projects/[projectId]/route";
import { AppError, unauthenticated } from "@/lib/api/errors";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "11111111-1111-4111-8111-111111111111";

describe("project API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a temporary project for an anonymous actor", async () => {
    requireActor.mockResolvedValue({ type: "anonymous", sessionId: "session-1" });
    createProjectForActor.mockResolvedValue({
      id: projectId,
      title: "My Audiobook",
      author: null,
      description: null,
      language: "en",
      status: "DRAFT",
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Audiobook" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createProjectForActor).toHaveBeenCalledWith(
      { type: "anonymous", sessionId: "session-1" },
      expect.objectContaining({ title: "My Audiobook" }),
    );
  });

  it("rejects unauthenticated project listing", async () => {
    requireSession.mockRejectedValue(unauthenticated());

    const response = await listOrGetProjects(
      new Request("http://localhost/api/projects"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("returns PROJECT_NOT_FOUND for a missing project", async () => {
    requireActor.mockResolvedValue({ type: "user", userId: ownerId });
    getProjectDetailForActor.mockRejectedValue(
      new AppError("PROJECT_NOT_FOUND", "Project not found.", 404),
    );

    const response = await getProject(new Request(`http://localhost/api/projects/${projectId}`), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
  });

  it("returns FORBIDDEN when another user owns the project", async () => {
    requireActor.mockResolvedValue({ type: "user", userId: ownerId });
    getProjectDetailForActor.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this project.", 403),
    );

    const response = await getProject(new Request(`http://localhost/api/projects/${projectId}`), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("creates a project for an authenticated user", async () => {
    requireActor.mockResolvedValue({ type: "user", userId: ownerId });
    createProjectForActor.mockResolvedValue({
      id: projectId,
      title: "My Audiobook",
      author: null,
      description: null,
      language: "en",
      status: "DRAFT",
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Audiobook" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createProjectForActor).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { project: { title: "My Audiobook" } },
    });
  });

  it("rejects an overlong title with VALIDATION_ERROR", async () => {
    requireSession.mockResolvedValue({ id: ownerId });

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "a".repeat(256) }),
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("does not call update when the requester is forbidden", async () => {
    requireSession.mockResolvedValue({ id: ownerId });
    updateProjectForUser.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this project.", 403),
    );

    const response = await PATCH(
      new Request(`http://localhost/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hacked" }),
      }),
      { params: Promise.resolve({ projectId }) },
    );

    expect(response.status).toBe(403);
    expect(deleteProjectForUser).not.toHaveBeenCalled();
  });
});
