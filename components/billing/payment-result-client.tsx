"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PayPerBookOrderDto } from "@/lib/billing/pay-per-book-shared";

type PaymentResultClientProps = {
  billingOrderId: string;
  initial: PayPerBookOrderDto | null;
};

export function PaymentResultClient({ billingOrderId, initial }: PaymentResultClientProps) {
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState<string | null>(initial ? null : "Order not found.");

  useEffect(() => {
    if (!order || order.status === "COMPLETED" || order.status === "FAILED" || order.status === "REFUNDED") {
      return;
    }
    const timer = window.setInterval(() => {
      void fetch(`/api/pay-per-book/orders/${billingOrderId}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            return;
          }
          const payload = (await response.json()) as { data?: { order?: PayPerBookOrderDto } };
          if (payload.data?.order) {
            setOrder(payload.data.order);
            setError(null);
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [billingOrderId, order]);

  if (error && !order) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/studio/projects" className="underline">
          Back to projects
        </Link>
      </div>
    );
  }
  if (!order) {
    return <p className="text-muted-foreground">Loading order…</p>;
  }

  const statusCopy = statusMessage(order.status);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <p className="text-sm uppercase tracking-wide text-muted-foreground">{statusCopy.label}</p>
      <p className="text-lg font-medium">{statusCopy.detail}</p>
      <p className="text-sm text-muted-foreground">
        {order.voiceName} · {order.billableMinutes} billable min · ${order.totalAmount.toFixed(2)}{" "}
        {order.currency}
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {order.chapters.map((chapter) => (
          <li key={chapter.id}>
            {chapter.title}: {chapter.status.toLowerCase().replaceAll("_", " ")}
          </li>
        ))}
      </ul>
      <Link href={`/studio/projects/${order.projectId}`} className="inline-flex underline">
        Open project
      </Link>
    </div>
  );
}

function statusMessage(status: string): { label: string; detail: string } {
  switch (status) {
    case "PENDING_PAYMENT":
      return {
        label: "Pending",
        detail: "Waiting for payment confirmation. You can leave this page.",
      };
    case "PAID":
    case "GENERATING":
      return {
        label: "Paid · Generating",
        detail: "Payment received. Premium narration is running in the background.",
      };
    case "COMPLETED":
      return { label: "Completed", detail: "All paid chapters finished narrating." };
    case "PARTIALLY_COMPLETED":
      return {
        label: "Partially completed",
        detail: "Some chapters finished; others failed. Open the project to retry failures.",
      };
    case "FAILED":
      return {
        label: "Failed",
        detail: "Generation failed after payment. Open the project — you will not be charged again to retry.",
      };
    case "REFUNDED":
      return { label: "Refunded", detail: "This order was refunded." };
    case "CANCELLED":
      return { label: "Cancelled", detail: "Checkout was cancelled." };
    default:
      return { label: status, detail: "Order status updated." };
  }
}
