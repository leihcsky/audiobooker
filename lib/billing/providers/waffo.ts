import { createHash } from "node:crypto";
import {
  verifyWebhook,
  WaffoPancake,
  type WebhookEvent,
  type WebhookEventData,
} from "@waffo/pancake-ts";
import {
  BillingSignatureError,
  type BillingEventKind,
  type BillingItemId,
  type BillingProvider,
  type BillingWebhookEvent,
  type CheckoutRequest,
} from "@/lib/billing/provider";

type WaffoEnvironment = "test" | "prod";

const EVENT_KINDS: Record<string, BillingEventKind> = {
  "order.completed": "one_time.paid",
  "subscription.activated": "subscription.activated",
  "subscription.renewed": "subscription.renewed",
  "subscription.recovered": "subscription.recovered",
  "subscription.canceling": "subscription.canceling",
  "subscription.uncanceled": "subscription.uncanceled",
  "subscription.canceled": "subscription.canceled",
  "subscription.past_due": "subscription.past_due",
  "refund.succeeded": "refund.succeeded",
};

const PRODUCT_ENV: Record<BillingItemId, { regular: string; creator: string | null }> = {
  creator: { regular: "WAFFO_PRODUCT_CREATOR", creator: null },
  short: { regular: "WAFFO_PRODUCT_SHORT", creator: "WAFFO_PRODUCT_SHORT_CREATOR" },
  book: { regular: "WAFFO_PRODUCT_BOOK", creator: "WAFFO_PRODUCT_BOOK_CREATOR" },
  series: { regular: "WAFFO_PRODUCT_SERIES", creator: "WAFFO_PRODUCT_SERIES_CREATOR" },
};

function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function environment(): WaffoEnvironment {
  return env("WAFFO_ENVIRONMENT") === "prod" ? "prod" : "test";
}

function productIdFor(item: BillingItemId, creatorPrice: boolean): string | null {
  const names = PRODUCT_ENV[item];
  return env(creatorPrice && names.creator ? names.creator : names.regular);
}

let client: WaffoPancake | null = null;

function getClient(): WaffoPancake {
  const merchantId = env("WAFFO_MERCHANT_ID");
  const privateKey = env("WAFFO_PRIVATE_KEY");
  if (!merchantId || !privateKey) {
    throw new Error("Waffo credentials are not configured.");
  }
  client ??= new WaffoPancake({ merchantId, privateKey });
  return client;
}

function storeId(): string {
  const id = env("WAFFO_STORE_ID");
  if (!id) {
    throw new Error("WAFFO_STORE_ID is not configured.");
  }
  return id;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAmount(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : null;
}

function refundFraction(data: WebhookEventData): number | null {
  const refunded = parseAmount(data.refundedAmount);
  const paid = parseAmount(data.originalChargedAmount) ?? parseAmount(data.originalPayment?.total);
  if (refunded === null || paid === null || paid <= 0) {
    return null;
  }
  return Math.min(1, Math.max(0, refunded / paid));
}

function normalize(event: WebhookEvent<WebhookEventData>, payloadHash: string): BillingWebhookEvent {
  const data = event.data ?? ({} as WebhookEventData);
  const start = parseDate(data.currentPeriodStart);
  const end = parseDate(data.currentPeriodEnd);
  let ignoreReason: string | null = null;
  if (event.storeId !== env("WAFFO_STORE_ID")) {
    ignoreReason = "other_store";
  } else if (event.mode !== environment()) {
    ignoreReason = "other_environment";
  }
  return {
    deliveryId: event.id,
    type: event.eventType,
    kind: EVENT_KINDS[event.eventType] ?? "other",
    businessEventId: event.eventId ?? null,
    orderId: data.orderId ?? null,
    reference: data.orderMerchantExternalId ?? data.orderMetadata?.billingOrderId ?? null,
    buyerIdentity: data.merchantProvidedBuyerIdentity ?? null,
    period: start && end && end > start ? { start, end } : null,
    refundFraction: event.eventType === "refund.succeeded" ? refundFraction(data) : null,
    payloadHash,
    ignoreReason,
  };
}

export const waffoBillingProvider: BillingProvider = {
  id: "waffo",

  isConfigured() {
    return Boolean(
      env("WAFFO_MERCHANT_ID") &&
        env("WAFFO_PRIVATE_KEY") &&
        env("WAFFO_STORE_ID") &&
        productIdFor("creator", false),
    );
  },

  productIdFor,

  async createCheckout(input: CheckoutRequest) {
    const result = await getClient().checkout.authenticated.create({
      productId: input.productId,
      currency: "USD",
      buyerIdentity: input.userId,
      buyerEmail: input.email ?? undefined,
      successUrl: input.successUrl,
      expiresInSeconds: input.expiresInSeconds,
      orderMerchantExternalId: input.reference,
      metadata: { billingOrderId: input.reference, userId: input.userId, item: input.item },
    });
    return { sessionId: result.sessionId, checkoutUrl: result.checkoutUrl };
  },

  async createCustomerPortal({ userId }) {
    const result = await getClient().auth.createCustomerPortalLink({
      storeId: storeId(),
      buyerIdentity: userId,
    });
    return { url: result.portalUrl };
  },

  parseWebhook(rawBody, signature) {
    let event: WebhookEvent<WebhookEventData>;
    try {
      event = verifyWebhook<WebhookEventData>(rawBody, signature, { environment: environment() });
    } catch {
      throw new BillingSignatureError();
    }
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    return normalize(event, payloadHash);
  },
};
