import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingWebhookEvent } from "@/lib/billing/provider";

type Order = {
  id: string;
  userId: string;
  provider: string;
  kind: "SUBSCRIPTION" | "MINUTE_PACK";
  itemId: string;
  premiumSeconds: number;
  providerOrderId: string | null;
  status: "PENDING" | "PAID" | "REFUNDED";
};

type Subscription = {
  id: string;
  userId: string;
  provider: string;
  subscriptionId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

const store = vi.hoisted(() => ({
  events: [] as Array<{ id: string; providerEventId: string; outcome: string; note: string | null }>,
  orders: [] as Order[],
  subscriptions: [] as Subscription[],
}));

const db = vi.hoisted(() => {
  const client = {
    billingEvent: {
      findUnique: async ({ where }: { where: { provider_providerEventId: { providerEventId: string } } }) =>
        store.events.find((e) => e.providerEventId === where.provider_providerEventId.providerEventId) ?? null,
      create: async ({ data }: { data: { providerEventId: string; outcome: string } }) => {
        const row = { id: `evt-${store.events.length + 1}`, note: null, ...data };
        store.events.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: { outcome: string; note: string } }) => {
        const row = store.events.find((e) => e.id === where.id);
        Object.assign(row ?? {}, data);
        return row;
      },
    },
    billingOrder: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; provider_providerOrderId?: { providerOrderId: string } };
      }) =>
        store.orders.find((o) =>
          where.id ? o.id === where.id : o.providerOrderId === where.provider_providerOrderId?.providerOrderId,
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Order> }) => {
        const order = store.orders.find((o) => o.id === where.id);
        Object.assign(order ?? {}, data);
        return order;
      },
    },
    subscription: {
      findUnique: async ({ where }: { where: { provider_subscriptionId: { subscriptionId: string } } }) =>
        store.subscriptions.find((s) => s.subscriptionId === where.provider_subscriptionId.subscriptionId) ?? null,
      create: async ({ data }: { data: Omit<Subscription, "id"> }) => {
        const row = { id: `sub-${store.subscriptions.length + 1}`, ...data };
        store.subscriptions.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Subscription> }) => {
        const row = store.subscriptions.find((s) => s.id === where.id);
        Object.assign(row ?? {}, data);
        return row;
      },
    },
  };
  return { ...client, $transaction: async (run: (tx: typeof client) => Promise<unknown>) => run(client) };
});

const credits = vi.hoisted(() => ({
  grantPurchasedSeconds: vi.fn(async () => undefined),
  reversePurchasedSeconds: vi.fn(async () => 0),
  reverseMonthlyGrant: vi.fn(async () => 0),
}));

const parseWebhook = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing/credits.service", () => credits);
vi.mock("@/lib/billing/providers", () => ({
  getBillingProvider: () => ({ id: "waffo", parseWebhook }),
}));

import { BillingSignatureError } from "@/lib/billing/provider";
import { handleBillingWebhook } from "@/lib/billing/webhook.service";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const packOrderId = "11111111-1111-4111-8111-111111111111";
const subOrderId = "22222222-2222-4222-8222-222222222222";
const periodStart = new Date("2099-10-01T00:00:00.000Z");
const periodEnd = new Date("2099-11-01T00:00:00.000Z");

function event(overrides: Partial<BillingWebhookEvent>): BillingWebhookEvent {
  return {
    deliveryId: "delivery-1",
    type: "order.completed",
    kind: "one_time.paid",
    businessEventId: "PAY_1",
    orderId: "ORD_PACK",
    reference: packOrderId,
    buyerIdentity: userId,
    period: null,
    refundFraction: null,
    payloadHash: "0".repeat(64),
    ignoreReason: null,
    ...overrides,
  };
}

async function deliver(value: BillingWebhookEvent) {
  parseWebhook.mockReturnValueOnce(value);
  return handleBillingWebhook("{}", "sig");
}

describe("handleBillingWebhook", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    store.events = [];
    store.subscriptions = [];
    store.orders = [
      {
        id: packOrderId,
        userId,
        provider: "waffo",
        kind: "MINUTE_PACK",
        itemId: "book",
        premiumSeconds: 36_000,
        providerOrderId: null,
        status: "PENDING",
      },
      {
        id: subOrderId,
        userId,
        provider: "waffo",
        kind: "SUBSCRIPTION",
        itemId: "creator",
        premiumSeconds: 0,
        providerOrderId: null,
        status: "PENDING",
      },
    ];
    credits.grantPurchasedSeconds.mockClear();
    credits.reversePurchasedSeconds.mockClear();
    credits.reverseMonthlyGrant.mockClear();
  });

  it("rejects an invalid signature", async () => {
    parseWebhook.mockImplementationOnce(() => {
      throw new BillingSignatureError();
    });
    await expect(handleBillingWebhook("{}", null)).rejects.toMatchObject({ code: "INVALID_SIGNATURE", status: 401 });
    expect(store.events).toHaveLength(0);
  });

  it("grants a paid pack once, even when the delivery repeats", async () => {
    const paid = event({});
    expect(await deliver(paid)).toEqual({ duplicate: false });
    expect(await deliver(paid)).toEqual({ duplicate: true });

    expect(credits.grantPurchasedSeconds).toHaveBeenCalledTimes(1);
    expect(credits.grantPurchasedSeconds).toHaveBeenCalledWith(expect.anything(), {
      userId,
      orderId: packOrderId,
      seconds: 36_000,
      metadata: { itemId: "book", providerOrderId: "ORD_PACK" },
    });
    expect(store.orders[0]).toMatchObject({ status: "PAID", providerOrderId: "ORD_PACK" });
    expect(store.events).toHaveLength(1);
  });

  it("ignores payments for orders the server did not create", async () => {
    await deliver(event({ reference: null, orderId: "ORD_UNKNOWN" }));
    expect(credits.grantPurchasedSeconds).not.toHaveBeenCalled();
    expect(store.events[0]).toMatchObject({ outcome: "IGNORED", note: "unknown_order" });
  });

  it("ignores a payment whose buyer is not the order's user", async () => {
    await deliver(event({ buyerIdentity: "someone-else" }));
    expect(credits.grantPurchasedSeconds).not.toHaveBeenCalled();
    expect(store.events[0]).toMatchObject({ outcome: "IGNORED", note: "buyer_mismatch" });
  });

  it("ignores events from another store or environment", async () => {
    await deliver(event({ ignoreReason: "other_environment" }));
    expect(credits.grantPurchasedSeconds).not.toHaveBeenCalled();
    expect(store.events[0]).toMatchObject({ outcome: "IGNORED", note: "other_environment" });
  });

  it("activates Creator with the provider's period and follows its lifecycle", async () => {
    await deliver(
      event({
        deliveryId: "d-activate",
        type: "subscription.activated",
        kind: "subscription.activated",
        orderId: "ORD_SUB",
        reference: subOrderId,
        period: { start: periodStart, end: periodEnd },
      }),
    );
    expect(store.subscriptions[0]).toMatchObject({
      userId,
      provider: "waffo",
      subscriptionId: "ORD_SUB",
      planId: "creator",
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
    expect(store.orders[1].status).toBe("PAID");

    await deliver(event({ deliveryId: "d-canceling", kind: "subscription.canceling", orderId: "ORD_SUB", reference: null }));
    expect(store.subscriptions[0].cancelAtPeriodEnd).toBe(true);

    await deliver(event({ deliveryId: "d-uncanceled", kind: "subscription.uncanceled", orderId: "ORD_SUB", reference: null }));
    expect(store.subscriptions[0].cancelAtPeriodEnd).toBe(false);

    const nextStart = periodEnd;
    const nextEnd = new Date("2099-12-01T00:00:00.000Z");
    await deliver(
      event({
        deliveryId: "d-renewed",
        kind: "subscription.renewed",
        orderId: "ORD_SUB",
        reference: null,
        period: { start: nextStart, end: nextEnd },
      }),
    );
    expect(store.subscriptions[0]).toMatchObject({ currentPeriodStart: nextStart, currentPeriodEnd: nextEnd });

    await deliver(event({ deliveryId: "d-canceled", kind: "subscription.canceled", orderId: "ORD_SUB", reference: null }));
    expect(store.subscriptions[0].status).toBe("CANCELLED");
  });

  it("marks a failed renewal past due without advancing the period", async () => {
    store.subscriptions.push({
      id: "sub-1",
      userId,
      provider: "waffo",
      subscriptionId: "ORD_SUB",
      planId: "creator",
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
    await deliver(
      event({
        kind: "subscription.past_due",
        orderId: "ORD_SUB",
        reference: null,
        period: { start: periodEnd, end: new Date("2099-12-01T00:00:00.000Z") },
      }),
    );
    expect(store.subscriptions[0]).toMatchObject({ status: "PAST_DUE", currentPeriodStart: periodStart });
  });

  it("does not move a period backwards when an older event arrives late", async () => {
    store.orders[1].providerOrderId = "ORD_SUB";
    store.subscriptions.push({
      id: "sub-1",
      userId,
      provider: "waffo",
      subscriptionId: "ORD_SUB",
      planId: "creator",
      status: "ACTIVE",
      currentPeriodStart: periodEnd,
      currentPeriodEnd: new Date("2099-12-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    });
    await deliver(
      event({
        kind: "subscription.activated",
        orderId: "ORD_SUB",
        reference: subOrderId,
        period: { start: periodStart, end: periodEnd },
      }),
    );
    expect(store.subscriptions[0].currentPeriodStart).toEqual(periodEnd);
  });

  it("takes back the refunded share of a pack and marks it refunded", async () => {
    store.orders[0] = { ...store.orders[0], status: "PAID", providerOrderId: "ORD_PACK" };
    await deliver(
      event({ kind: "refund.succeeded", type: "refund.succeeded", businessEventId: "REF_1", refundFraction: 0.5 }),
    );
    expect(credits.reversePurchasedSeconds).toHaveBeenCalledWith(expect.anything(), {
      userId,
      orderId: packOrderId,
      idempotencyKey: "reversal:waffo:REF_1",
      seconds: 18_000,
    });
    expect(store.orders[0].status).toBe("REFUNDED");
  });

  it("reverses the monthly grant when a subscription payment is refunded", async () => {
    store.orders[1] = { ...store.orders[1], status: "PAID", providerOrderId: "ORD_SUB" };
    store.subscriptions.push({
      id: "sub-1",
      userId,
      provider: "waffo",
      subscriptionId: "ORD_SUB",
      planId: "creator",
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
    await deliver(
      event({ kind: "refund.succeeded", orderId: "ORD_SUB", reference: subOrderId, businessEventId: "REF_2" }),
    );
    expect(credits.reverseMonthlyGrant).toHaveBeenCalledWith(expect.anything(), {
      userId,
      orderId: subOrderId,
      idempotencyKey: "reversal:waffo:REF_2",
      subscriptionId: "sub-1",
      fraction: 1,
    });
  });

  it("does not grant a pack that was refunded before its payment event arrived", async () => {
    store.orders[0] = { ...store.orders[0], status: "REFUNDED", providerOrderId: "ORD_PACK" };
    await deliver(event({}));
    expect(credits.grantPurchasedSeconds).not.toHaveBeenCalled();
    expect(store.events[0]).toMatchObject({ outcome: "IGNORED", note: "order_refunded" });
  });
});
