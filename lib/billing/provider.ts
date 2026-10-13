import type { MinutePackId } from "@/lib/billing/credit-packs";

export type BillingItemId = "creator" | MinutePackId;

export type CheckoutRequest = {
  item: BillingItemId;
  productId: string;
  userId: string;
  email: string | null;
  /** Internal order id, echoed back on every webhook for the order. */
  reference: string;
  successUrl: string;
  expiresInSeconds: number;
};

export type CheckoutSession = {
  sessionId: string;
  checkoutUrl: string;
};

export type BillingEventKind =
  | "one_time.paid"
  | "subscription.activated"
  | "subscription.renewed"
  | "subscription.recovered"
  | "subscription.canceling"
  | "subscription.uncanceled"
  | "subscription.canceled"
  | "subscription.past_due"
  | "refund.succeeded"
  | "other";

export type BillingWebhookEvent = {
  /** Unique per delivery; retries of the same delivery reuse it. */
  deliveryId: string;
  /** Raw provider event type, kept for auditing. */
  type: string;
  kind: BillingEventKind;
  /** Payment, refund, or order id the event is about. */
  businessEventId: string | null;
  orderId: string | null;
  reference: string | null;
  buyerIdentity: string | null;
  period: { start: Date; end: Date } | null;
  /** Refunded share of the original payment, 0–1; null when unknown. */
  refundFraction: number | null;
  payloadHash: string;
  /** Set when the event must not be applied (another store or environment). */
  ignoreReason: string | null;
};

export interface BillingProvider {
  readonly id: string;
  isConfigured(): boolean;
  productIdFor(item: BillingItemId, creatorPrice: boolean): string | null;
  createCheckout(input: CheckoutRequest): Promise<CheckoutSession>;
  createCustomerPortal(input: { userId: string }): Promise<{ url: string }>;
  /** Verifies the signature over the raw body; throws `BillingSignatureError` when invalid. */
  parseWebhook(rawBody: string, signature: string | null): BillingWebhookEvent;
}

export class BillingSignatureError extends Error {
  constructor() {
    super("Invalid billing webhook signature.");
    this.name = "BillingSignatureError";
  }
}
