import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
const findUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    toolEvent: { create },
    project: { findUnique },
  },
}));

import {
  CLIENT_TOOL_EVENTS,
  recordToolEvent,
  recordToolEventForProject,
} from "@/lib/tools/events";

describe("tool events", () => {
  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
    create.mockResolvedValue({ id: "evt-1" });
  });

  it("rejects unknown event names", async () => {
    await recordToolEvent({ name: "not_a_real_event", actor: { type: "user", userId: "u1" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("persists conversion events with user + anonymous link", async () => {
    await recordToolEvent({
      name: "sign_up_completed",
      actor: { type: "user", userId: "u1" },
      anonymousSessionId: "anon-1",
      metadata: { method: "email" },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "sign_up_completed",
        userId: "u1",
        anonymousSessionId: "anon-1",
      }),
    });
  });

  it("exposes only safe client events", () => {
    expect(CLIENT_TOOL_EVENTS.has("seo_tool_view")).toBe(true);
    expect(CLIENT_TOOL_EVENTS.has("checkout_returned")).toBe(true);
    expect(CLIENT_TOOL_EVENTS.has("tool_generate_completed")).toBe(false);
    expect(CLIENT_TOOL_EVENTS.has("checkout_paid")).toBe(false);
  });

  it("records project-scoped events from owners", async () => {
    findUnique.mockResolvedValueOnce({ userId: null, anonymousSessionId: "anon-9" });
    await recordToolEventForProject({
      projectId: "11111111-1111-1111-1111-111111111111",
      name: "tool_parse_completed",
      metadata: { jobId: "job-1" },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "tool_parse_completed",
        projectId: "11111111-1111-1111-1111-111111111111",
        anonymousSessionId: "anon-9",
        userId: null,
      }),
    });
  });

  it("swallows persistence errors", async () => {
    create.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordToolEvent({ name: "checkout_started", actor: { type: "user", userId: "u1" } }),
    ).resolves.toBeUndefined();
  });
});
