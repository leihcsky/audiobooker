import { beforeEach, describe, expect, it, vi } from "vitest";

const subscription = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}));

const db = vi.hoisted(() => ({
  subscription: {
    findFirst: vi.fn(async () => subscription.row),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(subscription.row ?? {}, data);
      return subscription.row;
    }),
  },
}));

const provider = vi.hoisted(() => ({
  id: "waffo",
  isConfigured: vi.fn(() => true),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing/providers", () => ({ getBillingProvider: () => provider }));

import { AppError } from "@/lib/api/errors";
import {
  cancelSubscriptionRenewal,
  resumeSubscriptionRenewal,
} from "@/lib/billing/subscription.service";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function activeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    userId,
    provider: "waffo",
    subscriptionId: "ORD_sub",
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("subscription.service", () => {
  beforeEach(() => {
    subscription.row = null;
    vi.clearAllMocks();
    provider.isConfigured.mockReturnValue(true);
  });

  it("cancels renewal at period end and updates the local row", async () => {
    subscription.row = activeSub();
    provider.cancelSubscription.mockResolvedValue({
      subscriptionId: "ORD_sub",
      status: "canceling",
    });

    const result = await cancelSubscriptionRenewal(userId);

    expect(provider.cancelSubscription).toHaveBeenCalledWith({ subscriptionId: "ORD_sub" });
    expect(result).toEqual({
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    });
  });

  it("is idempotent when renewal is already canceled", async () => {
    subscription.row = activeSub({ cancelAtPeriodEnd: true });

    const result = await cancelSubscriptionRenewal(userId);

    expect(provider.cancelSubscription).not.toHaveBeenCalled();
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  it("resumes renewal when canceling", async () => {
    subscription.row = activeSub({ cancelAtPeriodEnd: true });
    provider.reactivateSubscription.mockResolvedValue({
      subscriptionId: "ORD_sub",
      status: "active",
    });

    const result = await resumeSubscriptionRenewal(userId);

    expect(provider.reactivateSubscription).toHaveBeenCalledWith({
      userId,
      subscriptionId: "ORD_sub",
    });
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.status).toBe("ACTIVE");
  });

  it("rejects cancel when there is no managed subscription", async () => {
    await expect(cancelSubscriptionRenewal(userId)).rejects.toMatchObject({
      code: "CONFLICT",
    } satisfies Partial<AppError>);
  });
});
