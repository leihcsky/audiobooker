import Link from "next/link";
import { SubscriptionActions } from "@/components/billing/subscription-actions";
import { Card, CardContent } from "@/components/ui/card";
import type { BillingOverview, BillingPayment } from "@/lib/billing/billing-overview";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";
import { cn, formatDate } from "@/lib/utils";

const PORTAL_LINK_CLASS =
  "inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted";

function money(amountUsd: number): string {
  return `$${amountUsd.toFixed(2)}`;
}

function statusLabel(status: BillingPayment["status"]): string {
  return status === "REFUNDED" ? "Refunded" : "Paid";
}

export function SubscriptionPayments({ overview }: { overview: BillingOverview }) {
  const { subscription, payments, hasPaidOrders } = overview;
  const creator = overview.usage.plan.id === "creator";
  const pastDue = subscription?.status === "PAST_DUE";
  const periodEnd = subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null;
  const showSection = creator || hasPaidOrders || payments.length > 0;

  if (!showSection) {
    return null;
  }

  let planDetail: string;
  if (!creator || !subscription) {
    planDetail = "You're on Free. Upgrade above when you need more projects and monthly premium minutes.";
  } else if (pastDue) {
    planDetail = "Your last payment didn't go through. Update your payment method to keep Creator.";
  } else if (subscription.cancelAtPeriodEnd && periodEnd) {
    planDetail = `Creator ends on ${periodEnd}. You won't be charged again unless you resume.`;
  } else if (periodEnd) {
    planDetail = `Creator renews on ${periodEnd}.`;
  } else {
    planDetail = "Creator is active.";
  }

  return (
    <section id="subscription-payments" className="scroll-mt-8 space-y-4">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Subscription & payments
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your plan, cancel or resume renewal, and see recent charges.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Subscription
              </p>
              <p className="mt-1 font-serif text-2xl">{overview.usage.plan.name}</p>
              <p className={cn("mt-2 text-sm", pastDue ? "text-destructive" : "text-muted-foreground")}>
                {planDetail}
              </p>
            </div>
            <div className="mt-auto space-y-2">
              {creator && subscription?.managedByProvider ? (
                <>
                  <SubscriptionActions
                    cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
                    pastDue={pastDue}
                  />
                  <a
                    href="/api/billing/portal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(PORTAL_LINK_CLASS, "w-full")}
                  >
                    {pastDue ? "Update payment method" : "Payment method & receipts"}
                  </a>
                </>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Need a refund? See our{" "}
                <Link href="/refunds" className="underline">
                  refund policy
                </Link>{" "}
                or email{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
                  {LEGAL_CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Payment history
              </p>
              {hasPaidOrders ? (
                <a
                  href="/api/billing/portal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline"
                >
                  Receipts
                </a>
              ) : null}
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {payments.map((payment) => (
                  <li key={payment.id} className="first:pt-0 last:pb-0">
                    <Link
                      href={`/studio/billing/orders/${payment.id}`}
                      className="flex items-start justify-between gap-4 py-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{payment.label}</p>
                        {payment.detail ? (
                          <p className="mt-0.5 truncate text-muted-foreground">{payment.detail}</p>
                        ) : null}
                        <p className="mt-0.5 text-muted-foreground">
                          {statusLabel(payment.status)}
                          {" · "}
                          {formatDate(payment.paidAt ?? payment.createdAt)}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 tabular-nums font-medium",
                          payment.status === "REFUNDED" && "text-muted-foreground",
                        )}
                      >
                        {payment.status === "REFUNDED" ? "−" : ""}
                        {money(payment.amountUsd)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
