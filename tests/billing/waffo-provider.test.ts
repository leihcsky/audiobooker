import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyWebhook = vi.hoisted(() => vi.fn());

vi.mock("@waffo/pancake-ts", () => ({
  verifyWebhook,
  WaffoPancake: vi.fn(),
}));

import { BillingSignatureError } from "@/lib/billing/provider";
import { waffoBillingProvider } from "@/lib/billing/providers/waffo";

const ENV = {
  WAFFO_ENVIRONMENT: "test",
  WAFFO_STORE_ID: "STO_ours",
  WAFFO_PRODUCT_SHORT: "PROD_short",
  WAFFO_PRODUCT_SHORT_CREATOR: "PROD_short_creator",
};

function waffoEvent(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
  return {
    id: "delivery-uuid",
    timestamp: "2026-10-11T00:00:00.000Z",
    eventType: "order.completed",
    eventId: "PAY_1",
    storeId: "STO_ours",
    storeName: "Audiobooker",
    mode: "test",
    data: {
      orderId: "ORD_1",
      buyerEmail: "reader@example.com",
      merchantProvidedBuyerIdentity: "user-1",
      orderMerchantExternalId: "order-ref",
      currency: "USD",
      amount: "24.00",
      taxAmount: "0.00",
      productName: "Short Pack",
      ...data,
    },
    ...overrides,
  };
}

describe("waffoBillingProvider", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(ENV)) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    verifyWebhook.mockReset();
  });

  it("picks the regular or Creator product", () => {
    expect(waffoBillingProvider.productIdFor("short", false)).toBe("PROD_short");
    expect(waffoBillingProvider.productIdFor("short", true)).toBe("PROD_short_creator");
    expect(waffoBillingProvider.productIdFor("book", false)).toBeNull();
  });

  it("verifies against the configured environment and normalizes the event", () => {
    verifyWebhook.mockReturnValue(waffoEvent());
    const event = waffoBillingProvider.parseWebhook('{"raw":true}', "t=1,v1=sig");

    expect(verifyWebhook).toHaveBeenCalledWith('{"raw":true}', "t=1,v1=sig", { environment: "test" });
    expect(event).toMatchObject({
      deliveryId: "delivery-uuid",
      kind: "one_time.paid",
      businessEventId: "PAY_1",
      orderId: "ORD_1",
      reference: "order-ref",
      buyerIdentity: "user-1",
      ignoreReason: null,
    });
    expect(event.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws a signature error when verification fails", () => {
    verifyWebhook.mockImplementation(() => {
      throw new Error("bad signature");
    });
    expect(() => waffoBillingProvider.parseWebhook("{}", null)).toThrow(BillingSignatureError);
  });

  it("flags events from another store or environment", () => {
    verifyWebhook.mockReturnValueOnce(waffoEvent({ storeId: "STO_other" }));
    expect(waffoBillingProvider.parseWebhook("{}", "s").ignoreReason).toBe("other_store");

    verifyWebhook.mockReturnValueOnce(waffoEvent({ mode: "prod" }));
    expect(waffoBillingProvider.parseWebhook("{}", "s").ignoreReason).toBe("other_environment");
  });

  it("reads subscription periods and refund shares", () => {
    verifyWebhook.mockReturnValueOnce(
      waffoEvent(
        { eventType: "subscription.renewed" },
        { currentPeriodStart: "2026-11-01", currentPeriodEnd: "2026-12-01" },
      ),
    );
    const renewed = waffoBillingProvider.parseWebhook("{}", "s");
    expect(renewed.kind).toBe("subscription.renewed");
    expect(renewed.period).toEqual({
      start: new Date("2026-11-01T00:00:00.000Z"),
      end: new Date("2026-12-01T00:00:00.000Z"),
    });

    verifyWebhook.mockReturnValueOnce(
      waffoEvent({ eventType: "refund.succeeded", eventId: "REF_1" }, { refundedAmount: "12.00", originalChargedAmount: "24.00" }),
    );
    expect(waffoBillingProvider.parseWebhook("{}", "s")).toMatchObject({ kind: "refund.succeeded", refundFraction: 0.5 });

    verifyWebhook.mockReturnValueOnce(waffoEvent({ eventType: "subscription.plan_changed" }));
    expect(waffoBillingProvider.parseWebhook("{}", "s").kind).toBe("other");
  });
});
