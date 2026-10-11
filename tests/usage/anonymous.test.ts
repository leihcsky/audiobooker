import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregate = vi.hoisted(() => vi.fn());
const count = vi.hoisted(() => vi.fn());
const exportCount = vi.hoisted(() => vi.fn());
const jobCount = vi.hoisted(() => vi.fn());
const jobAggregate = vi.hoisted(() => vi.fn());
const sessionFind = vi.hoisted(() => vi.fn());
const usageGroupBy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    usageRecord: { aggregate, count, groupBy: usageGroupBy },
    export: { count: exportCount },
    generationJob: { count: jobCount, aggregate: jobAggregate },
    anonymousSession: { findUnique: sessionFind },
  },
}));

vi.mock("@/lib/billing/entitlements", async () => {
  const { PLANS } = await import("@/lib/billing/plans");
  return { getUserPlan: vi.fn(async () => PLANS.free) };
});

import { PLANS } from "@/lib/billing/plans";
import { FILE_LIMITS, TTS_SETTINGS } from "@/lib/config/limits";
import {
  assertAnonymousExportLimit,
  assertAnonymousJobConcurrency,
  assertAnonymousPreviewLimit,
  assertEdgeDailyCapacity,
  assertPremiumCostGuard,
  assertPremiumPreviewBudget,
  assertStandardCapacityForActor,
  getStandardTtsAllowance,
} from "@/lib/usage/usage.service";

const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const anonymous = { type: "anonymous" as const, sessionId };
const ipHash = "a".repeat(64);

function usageBy(session: number, network: number) {
  aggregate.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ({
    _sum: { quantity: "anonymousSession" in where ? network : session },
  }));
}

describe("anonymous usage limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionFind.mockResolvedValue({ ipHash });
    usageGroupBy.mockResolvedValue([]);
  });

  it("blocks TTS once the session's lifetime allowance would be exceeded", async () => {
    usageBy(FILE_LIMITS.ANONYMOUS_TTS_SESSION_CHARS - 100, 0);
    await expect(assertStandardCapacityForActor(anonymous, 200)).rejects.toMatchObject({
      code: "GENERATION_LIMIT_REACHED",
    });
  });

  it("blocks a fresh session once its network has used the shared daily allowance", async () => {
    usageBy(0, FILE_LIMITS.ANONYMOUS_IP_DAILY_CHARS - 100);
    await expect(assertStandardCapacityForActor(anonymous, 200)).rejects.toMatchObject({
      code: "GENERATION_LIMIT_REACHED",
    });
  });

  it("skips the network check for sessions without a network hash", async () => {
    sessionFind.mockResolvedValue({ ipHash: null });
    usageBy(0, FILE_LIMITS.ANONYMOUS_IP_DAILY_CHARS);
    await expect(assertStandardCapacityForActor(anonymous, 200)).resolves.toBeUndefined();
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it("counts the session's total usage but only today's network usage (UTC)", async () => {
    usageBy(1000, 1000);
    const now = new Date("2026-09-29T15:30:00.000Z");
    await assertStandardCapacityForActor(anonymous, 200, now);
    const wheres = aggregate.mock.calls.map(
      (call) => (call[0] as { where: Record<string, unknown> }).where,
    );
    const sessionWhere = wheres.find((where) => "anonymousSessionId" in where);
    expect(sessionWhere).toBeDefined();
    expect(sessionWhere).not.toHaveProperty("createdAt");
    expect(aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        anonymousSession: { ipHash },
        createdAt: { gte: new Date("2026-09-29T00:00:00.000Z") },
      }),
      _sum: { quantity: true },
    });
  });

  it("reports the lower of the session and network allowances", async () => {
    usageBy(1000, FILE_LIMITS.ANONYMOUS_IP_DAILY_CHARS - 500);
    await expect(getStandardTtsAllowance(anonymous)).resolves.toEqual({
      maxCharacters: FILE_LIMITS.ANONYMOUS_TTS_SESSION_CHARS,
      remainingCharacters: 500,
      period: "session",
    });
  });

  it("reports the plan's hard cap as the signed-in monthly budget", async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 1000 } });
    const hardCap = PLANS.free.standardMonthlyHardCharacters;
    await expect(getStandardTtsAllowance({ type: "user", userId: "user-1" })).resolves.toEqual({
      maxCharacters: hardCap,
      remainingCharacters: hardCap - 1000,
      period: "month",
    });
  });

  it("blocks new Edge jobs once site-wide daily capacity is used, counting in-flight jobs", async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: TTS_SETTINGS.EDGE_GLOBAL_DAILY_CHARS - 1000 } });
    jobAggregate.mockResolvedValue({ _sum: { inputCharacters: 900 } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(assertEdgeDailyCapacity(200)).rejects.toMatchObject({ code: "TTS_CAPACITY_REACHED" });
    await expect(assertEdgeDailyCapacity(50)).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("blocks premium jobs above the per-job cost limit", async () => {
    await expect(assertPremiumCostGuard(TTS_SETTINGS.MAX_TTS_JOB_COST_USD + 1)).rejects.toMatchObject({
      code: "TTS_COST_LIMIT_EXCEEDED",
    });
  });

  it("blocks premium jobs once the global daily budget is reached", async () => {
    jobAggregate
      .mockResolvedValueOnce({ _sum: { actualCost: TTS_SETTINGS.DAILY_PREMIUM_COST_LIMIT_USD - 1 } })
      .mockResolvedValueOnce({ _sum: { estimatedCost: 0.5 } });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(assertPremiumCostGuard(1)).rejects.toMatchObject({ code: "TTS_COST_LIMIT_EXCEEDED" });
    spy.mockRestore();
  });

  it("counts uncached premium previews against the daily budget", async () => {
    const limit = TTS_SETTINGS.DAILY_PREMIUM_COST_LIMIT_USD;
    jobAggregate
      .mockResolvedValueOnce({ _sum: { actualCost: limit - 1 } })
      .mockResolvedValueOnce({ _sum: { estimatedCost: 0 } });
    // 10,000 premium preview characters at the highest Replicate rate ($0.10 / 1K) = $1.
    usageGroupBy.mockResolvedValueOnce([{ provider: "replicate", _sum: { quantity: 10_000 } }]);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(assertPremiumPreviewBudget(0.01)).rejects.toMatchObject({
      code: "TTS_COST_LIMIT_EXCEEDED",
    });
    expect(usageGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ unit: "preview", provider: { not: "edge" } }),
      }),
    );
    spy.mockRestore();
  });

  it("enforces the hourly preview limit", async () => {
    count.mockResolvedValue(5);
    await expect(assertAnonymousPreviewLimit(sessionId)).rejects.toMatchObject({
      code: "GENERATION_LIMIT_REACHED",
    });
  });

  it("enforces one anonymous export per format", async () => {
    exportCount.mockResolvedValue(1);
    await expect(assertAnonymousExportLimit(sessionId, "M4B")).rejects.toMatchObject({
      code: "GENERATION_LIMIT_REACHED",
      message: expect.stringContaining("M4B"),
    });
    expect(exportCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ type: "M4B" }),
    });
    exportCount.mockResolvedValue(0);
    await expect(assertAnonymousExportLimit(sessionId, "ZIP")).resolves.toBeUndefined();
  });

  it("enforces one concurrent anonymous job", async () => {
    jobCount.mockResolvedValue(1);
    await expect(assertAnonymousJobConcurrency(sessionId)).rejects.toMatchObject({
      code: "GENERATION_LIMIT_REACHED",
    });
  });
});
