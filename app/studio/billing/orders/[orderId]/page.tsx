import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyableOrderId } from "@/components/billing/copyable-order-id";
import { StudioPageNav } from "@/components/studio/page-nav";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getBillingOrderDetail, type BillingOrderDetail } from "@/lib/billing/order-detail";
import { remainingMinutes } from "@/lib/billing/premium-usage";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Order — Audiobooker",
};

type PageProps = {
  params: Promise<{ orderId: string }>;
};

function money(amountUsd: number): string {
  return `$${amountUsd.toFixed(2)}`;
}

function billingStatusLabel(status: BillingOrderDetail["status"]): string {
  return status === "REFUNDED" ? "Refunded" : "Paid";
}

function ppbStatusLabel(status: NonNullable<BillingOrderDetail["payPerBook"]>["status"]): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Awaiting payment";
    case "PAID":
      return "Paid — starting narration";
    case "GENERATING":
      return "Generating audio";
    case "COMPLETED":
      return "Completed";
    case "PARTIALLY_COMPLETED":
      return "Partially completed";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
    default:
      return status;
  }
}

function chapterStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "QUEUED":
      return "Queued";
    case "GENERATING":
      return "Generating";
    case "COMPLETED":
      return "Ready";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function BillingOrderPage({ params }: PageProps) {
  const user = await requireSession();
  const { orderId } = await params;
  const order = await getBillingOrderDetail(user.id, orderId);
  if (!order) {
    notFound();
  }

  const ppb = order.payPerBook;

  return (
    <main className="space-y-8">
      <StudioPageNav
        back={{ href: "/studio/billing#subscription-payments", label: "Back to Billing" }}
        trail={[
          { label: "Billing", href: "/studio/billing" },
          { label: order.label },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">{order.label}</h1>
          <p className="mt-2 text-muted-foreground">
            {billingStatusLabel(order.status)}
            {" · "}
            {formatDate(order.paidAt ?? order.createdAt)}
          </p>
        </div>
        <p
          className={cn(
            "font-serif text-3xl tabular-nums",
            order.status === "REFUNDED" && "text-muted-foreground",
          )}
        >
          {order.status === "REFUNDED" ? "−" : ""}
          {money(order.amountUsd)}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Payment
            </p>
            <dl className="mt-3 divide-y divide-border">
              <Row label="Status" value={billingStatusLabel(order.status)} />
              <Row label="Amount" value={money(order.amountUsd)} />
              <Row label="Date" value={formatDate(order.paidAt ?? order.createdAt)} />
              <Row label="Order ID" value={<CopyableOrderId orderId={order.id} />} />
            </dl>
          </CardContent>
        </Card>

        {order.kind === "MINUTE_PACK" && order.pack ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Minute pack
              </p>
              <dl className="mt-3 divide-y divide-border">
                <Row label="Pack" value={order.pack.name} />
                <Row label="Minutes added" value={`${order.pack.minutes.toLocaleString("en-US")} min`} />
                {order.creatorPrice ? <Row label="Price" value="Creator rate" /> : null}
              </dl>
              <p className="mt-4 text-sm text-muted-foreground">Purchased minutes never expire.</p>
            </CardContent>
          </Card>
        ) : null}

        {order.kind === "SUBSCRIPTION" ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Subscription
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                This charge covers one Creator billing period
                {order.premiumSeconds > 0
                  ? ` and ${remainingMinutes(order.premiumSeconds)} monthly premium minutes`
                  : ""}
                . Manage renewal on the{" "}
                <Link href="/studio/billing#subscription-payments" className="underline">
                  Billing
                </Link>{" "}
                page.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {ppb ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pay-per-book
              </p>
              <dl className="mt-3 divide-y divide-border">
                <Row
                  label="Project"
                  value={
                    <Link href={`/studio/projects/${ppb.projectId}`} className="underline">
                      {ppb.projectTitle}
                    </Link>
                  }
                />
                <Row label="Fulfilment" value={ppbStatusLabel(ppb.status)} />
                <Row label="Voice" value={ppb.voiceName} />
                <Row label="Billable" value={`${ppb.billableMinutes} min`} />
                <Row label="Estimated" value={`${ppb.estimatedMinutes.toFixed(1)} min`} />
                <Row label="Words" value={ppb.selectedWordCount.toLocaleString("en-US")} />
                {ppb.speed !== 1 ? <Row label="Speed" value={`${ppb.speed}×`} /> : null}
              </dl>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {ppb && ppb.chapters.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Chapters in this order
          </h2>
          <Card className="mt-3">
            <ul className="divide-y divide-border text-sm">
              {ppb.chapters.map((chapter) => (
                <li key={chapter.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    {chapter.chapterId ? (
                      <Link
                        href={`/studio/projects/${ppb.projectId}/chapters/${chapter.chapterId}`}
                        className="font-medium hover:underline"
                      >
                        {chapter.title}
                      </Link>
                    ) : (
                      <p className="font-medium">{chapter.title}</p>
                    )}
                    <p className="mt-0.5 text-muted-foreground">
                      {chapter.wordCount.toLocaleString("en-US")} words
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-muted-foreground",
                      chapter.status === "FAILED" && "text-destructive",
                      chapter.status === "COMPLETED" && "text-foreground",
                    )}
                  >
                    {chapterStatusLabel(chapter.status)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="mt-4">
            <Link
              href={`/studio/projects/${ppb.projectId}`}
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open project
            </Link>
          </div>
        </section>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Need a refund? See our{" "}
        <Link href="/refunds" className="underline">
          refund policy
        </Link>{" "}
        or email{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
          {LEGAL_CONTACT_EMAIL}
        </a>{" "}
        with this order ID.
      </p>
    </main>
  );
}
