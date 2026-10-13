import { beforeEach, describe, expect, it, vi } from "vitest";

const orders = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  recent: 0,
}));

const db = vi.hoisted(() => ({
  billingOrder: {
    count: vi.fn(async () => orders.recent),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `order-${orders.rows.length + 1}`, ...data };
      orders.rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = orders.rows.find((o) => o.id === where.id);
      Object.assign(row ?? {}, data);
      return row;
    }),
  },
}));

const provider = vi.hoisted(() => ({
  id: "waffo",
  isConfigured: vi.fn(() => true),
  productIdFor: vi.fn((item: string, creatorPrice: boolean) => `PROD_${item}${creatorPrice ? "_creator" : ""}`),
  createCheckout: vi.fn(async () => ({ sessionId: "SES_1", checkoutUrl: "https://checkout.test/x#token=t" })),
  createCustomerPortal: vi.fn(),
  parseWebhook: vi.fn(),
}));

const getUserPlanState = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing/providers", () => ({ getBillingProvider: () => provider }));
vi.mock("@/lib/billing/entitlements", () => ({ getUserPlanState }));

import { createCheckout } from "@/lib/billing/checkout.service";
import { PLANS } from "@/lib/billing/plans";

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "reader@example.com" };

describe("createCheckout", () => {
  beforeEach(() => {
    orders.rows = [];
    orders.recent = 0;
    vi.clearAllMocks();
    getUserPlanState.mockResolvedValue({ plan: PLANS.free, subscriptionId: null, period: null });
  });

  it("sells packs at the regular price to Free accounts and records the order first", async () => {
    const result = await createCheckout(user, "book");

    expect(result).toEqual({ checkoutUrl: "https://checkout.test/x#token=t" });
    expect(orders.rows[0]).toMatchObject({
      userId: user.id,
      provider: "waffo",
      kind: "MINUTE_PACK",
      itemId: "book",
      creatorPrice: false,
      productId: "PROD_book",
      amountUsd: 99,
      premiumSeconds: 36_000,
      checkoutSessionId: "SES_1",
    });
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "PROD_book",
        userId: user.id,
        email: user.email,
        reference: "order-1",
        successUrl: expect.stringMatching(/\/studio\/billing\?order=order-1$/),
        expiresInSeconds: 3600,
      }),
    );
  });

  it("uses the Creator product and price for Creator members", async () => {
    getUserPlanState.mockResolvedValue({ plan: PLANS.creator, subscriptionId: "sub-1", period: null });
    await createCheckout(user, "series");
    expect(orders.rows[0]).toMatchObject({ creatorPrice: true, productId: "PROD_series_creator", amountUsd: 205 });
  });

  it("does not start a second Creator subscription", async () => {
    getUserPlanState.mockResolvedValue({ plan: PLANS.creator, subscriptionId: "sub-1", period: null });
    await expect(createCheckout(user, "creator")).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    expect(orders.rows).toHaveLength(0);
  });

  it("limits checkout attempts per hour", async () => {
    orders.recent = 10;
    await expect(createCheckout(user, "short")).rejects.toMatchObject({ code: "CHECKOUT_RATE_LIMITED" });
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("reports billing as unavailable when the provider fails or is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    provider.createCheckout.mockRejectedValueOnce(new Error("upstream down"));
    await expect(createCheckout(user, "short")).rejects.toMatchObject({ code: "BILLING_UNAVAILABLE", status: 503 });

    provider.isConfigured.mockReturnValueOnce(false);
    await expect(createCheckout(user, "short")).rejects.toMatchObject({ code: "BILLING_UNAVAILABLE" });
  });
});
