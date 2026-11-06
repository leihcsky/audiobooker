"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReturnedOrder } from "@/lib/billing/billing-overview";
import { remainingMinutes } from "@/lib/billing/premium-usage";
import { trackEvent } from "@/lib/analytics/track";

const POLL_MS = 3000;
const MAX_POLLS = 40;
const TRACKED_KEY_PREFIX = "ab_purchase_tracked:";
const RETURNED_KEY_PREFIX = "ab_checkout_returned:";

function onceKey(prefix: string, orderId: string): string {
  return `${prefix}${orderId}`;
}

function markOnce(key: string): boolean {
  try {
    if (window.localStorage.getItem(key)) {
      return false;
    }
    window.localStorage.setItem(key, "1");
    return true;
  } catch {
    // Storage blocked: still emit once per mount via caller discipline.
    return true;
  }
}

function trackPurchaseOnce(order: ReturnedOrder) {
  if (!markOnce(onceKey(TRACKED_KEY_PREFIX, order.id))) {
    return;
  }
  trackEvent(
    "purchase",
    { transaction_id: order.id, item: order.itemId, kind: order.kind.toLowerCase() },
    { amount: order.amountUsd, currency: "USD" },
  );
}

function recordCheckoutReturnedOnce(order: ReturnedOrder) {
  if (!markOnce(onceKey(RETURNED_KEY_PREFIX, order.id))) {
    return;
  }
  void fetch("/api/tools/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "checkout_returned",
      metadata: {
        billingOrderId: order.id,
        itemId: order.itemId,
        kind: order.kind,
        status: order.status,
      },
    }),
  }).catch(() => undefined);
}

export function CheckoutReturn({ order }: { order: ReturnedOrder }) {
  const router = useRouter();
  const [polls, setPolls] = useState(0);
  const pending = order.status === "PENDING";
  const gaveUp = pending && polls >= MAX_POLLS;

  useEffect(() => {
    recordCheckoutReturnedOnce(order);
  }, [order]);

  useEffect(() => {
    if (order.status === "PAID") {
      trackPurchaseOnce(order);
    }
  }, [order]);

  useEffect(() => {
    if (!pending || polls >= MAX_POLLS) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPolls((count) => count + 1);
      router.refresh();
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pending, polls, router]);

  if (order.status === "REFUNDED") {
    return null;
  }

  let message: string;
  if (!pending) {
    if (order.kind === "SUBSCRIPTION") {
      message = "Payment received. Creator is active.";
    } else if (order.kind === "PAY_PER_BOOK") {
      message = "Payment received. Narration for your selected chapters is starting.";
    } else {
      message = `Payment received. ${remainingMinutes(order.premiumSeconds).toLocaleString("en-US")} premium minutes added.`;
    }
  } else if (gaveUp) {
    message = "Still confirming your payment. It will appear here once it clears; you can safely leave this page.";
  } else {
    message = "Confirming your payment…";
  }

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        pending ? "border-border bg-muted/50" : "border-primary/30 bg-primary/5"
      }`}
    >
      <span>{message}</span>
      {!pending || gaveUp ? (
        <Link href="/studio/billing" className="text-muted-foreground hover:underline">
          Dismiss
        </Link>
      ) : null}
    </div>
  );
}
