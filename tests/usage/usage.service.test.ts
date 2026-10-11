import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregate = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const count = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    usageRecord: {
      aggregate,
      create,
      count,
    },
  },
}));

const getUserPlan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/billing/entitlements", () => ({ getUserPlan }));

import { AppError } from "@/lib/api/errors";
import { PLANS } from "@/lib/billing/plans";
import {
  assertTtsCapacity,
  currentUtcMonthRange,
  getMonthlyTtsCharacters,
  recordTtsCharacters,
} from "@/lib/usage/usage.service";

describe("usage.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserPlan.mockResolvedValue(PLANS.free);
  });

  it("uses the UTC month as the usage period", () => {
    const range = currentUtcMonthRange(new Date("2026-09-25T12:00:00.000Z"));
    expect(range.periodStart.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.periodEnd.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("sums server-side character usage for the current month", async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 1200 } });
    await expect(getMonthlyTtsCharacters("user-1")).resolves.toBe(1200);
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          type: "TTS_CHARACTERS",
          unit: "characters",
        }),
      }),
    );
  });

  it("lets jobs past the soft allowance run and logs them for review", async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: PLANS.free.standardMonthlySoftCharacters - 10 } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(assertTtsCapacity("user-1", 20)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "tts_soft_quota_exceeded",
      expect.objectContaining({ userId: "user-1", planId: "free" }),
    );
    warn.mockRestore();
  });

  it("rejects generation when the plan's monthly hard cap would be exceeded", async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: PLANS.free.standardMonthlyHardCharacters - 10 } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(assertTtsCapacity("user-1", 20)).rejects.toMatchObject({
      code: "USAGE_LIMIT_EXCEEDED",
    } satisfies Partial<AppError>);
    warn.mockRestore();
  });

  it("gives Creator a higher fair-use cap than Free", async () => {
    getUserPlan.mockResolvedValue(PLANS.creator);
    aggregate.mockResolvedValue({ _sum: { quantity: PLANS.free.standardMonthlyHardCharacters } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(assertTtsCapacity("user-1", 20)).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("records premium usage separately with cost metadata", async () => {
    create.mockResolvedValue({});
    await recordTtsCharacters({
      userId: "user-1",
      projectId: "project-1",
      jobId: "job-1",
      characters: 3600,
      cachedCharacters: 400,
      provider: "replicate",
      providerModel: "minimax/speech-2.8-hd",
      tier: "premium",
      estimatedCost: 0.4,
      actualCost: 0.36,
      currency: "USD",
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PREMIUM_TTS_CHARACTERS",
        quantity: 3600,
        metadata: expect.objectContaining({ cachedCharacters: 400, actualCost: 0.36 }),
      }),
    });
  });
});
