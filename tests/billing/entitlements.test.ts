import { beforeEach, describe, expect, it, vi } from "vitest";

const subscriptionFindFirst = vi.hoisted(() => vi.fn());
const projectCount = vi.hoisted(() => vi.fn());
const projectFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: { findFirst: subscriptionFindFirst },
    project: { count: projectCount, findMany: projectFindMany },
  },
}));

import {
  assertCanCreateProject,
  assertProjectWithinPlan,
  getUserPlanState,
  getVoiceAccess,
} from "@/lib/billing/entitlements";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = { type: "user", userId } as const;
const periodStart = new Date("2026-10-01T00:00:00.000Z");
const periodEnd = new Date("2026-11-01T00:00:00.000Z");

function creatorSubscription() {
  return {
    id: "sub-1",
    planId: "creator",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    createdAt: periodStart,
  };
}

describe("entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionFindFirst.mockResolvedValue(null);
  });

  it("falls back to Free without a granting subscription", async () => {
    const state = await getUserPlanState(userId);
    expect(state).toMatchObject({ plan: { id: "free" }, subscriptionId: null, period: null });
  });

  it("only counts active, trialing or past-due subscriptions that have not ended", async () => {
    const now = new Date("2026-10-09T00:00:00.000Z");
    subscriptionFindFirst.mockResolvedValue(creatorSubscription());

    const state = await getUserPlanState(userId, now);

    expect(subscriptionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
          currentPeriodEnd: { gt: now },
        },
      }),
    );
    expect(state).toMatchObject({
      plan: { id: "creator" },
      subscriptionId: "sub-1",
      period: { start: periodStart, end: periodEnd },
    });
  });

  it("offers premium voices to every signed-in account, never to anonymous visitors", async () => {
    await expect(getVoiceAccess(user)).resolves.toEqual({ premium: true });
    await expect(getVoiceAccess({ type: "anonymous", sessionId: "s" })).resolves.toEqual({ premium: false });
  });

  it("blocks a new project at the plan limit", async () => {
    projectCount.mockResolvedValue(2);
    await expect(assertCanCreateProject(userId)).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
    projectCount.mockResolvedValue(1);
    await expect(assertCanCreateProject(userId)).resolves.toBeUndefined();
  });

  it("keeps only the oldest projects workable when over the limit", async () => {
    projectCount.mockResolvedValue(3);
    projectFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    await expect(assertProjectWithinPlan(user, "p2")).resolves.toBeUndefined();
    await expect(assertProjectWithinPlan(user, "p3")).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
    expect(projectFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });

  it("skips the over-limit lookup when within the limit", async () => {
    projectCount.mockResolvedValue(2);
    await expect(assertProjectWithinPlan(user, "any")).resolves.toBeUndefined();
    expect(projectFindMany).not.toHaveBeenCalled();
  });
});
