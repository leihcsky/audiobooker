import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { CheckoutReturn } from "@/components/billing/checkout-return";
import { SubscriptionPayments } from "@/components/billing/subscription-payments";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getBillingOverview, type BillingOverview, type BillingPack } from "@/lib/billing/billing-overview";
import { PLANS } from "@/lib/billing/plans";
import { payPerBookFacts } from "@/lib/billing/pricing-facts";
import { remainingMinutes } from "@/lib/billing/premium-usage";
import { PRICE_TAX_NOTE } from "@/lib/legal";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Billing — Audiobooker",
};

const MANAGE_LINK_CLASS =
  "inline-flex h-10 w-full items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted";

type BillingPageProps = {
  searchParams: Promise<{ order?: string | string[]; portal?: string | string[] }>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const user = await requireSession();
  const { order, portal } = await searchParams;
  const overview = await getBillingOverview(user.id, typeof order === "string" ? order : undefined);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Billing</h1>
        <p className="mt-2 text-muted-foreground">
          Your plan, premium minutes, pay-per-book options, and payments.
        </p>
      </div>

      {overview.returnedOrder ? <CheckoutReturn order={overview.returnedOrder} /> : null}
      {portal === "unavailable" ? (
        <p role="alert" className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">
          Payment method settings couldn&apos;t be opened right now. Please try again in a few minutes.
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard overview={overview} />
        <MinutesCard overview={overview} />
      </div>

      <SubscriptionPayments overview={overview} />

      <PayPerBookCard />

      <section id="minute-packs" className="scroll-mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Buy premium minutes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time purchase. Purchased minutes never expire. For a single project, you can also{" "}
          <a href="#pay-per-book" className="underline">
            pay per book
          </a>{" "}
          in Studio.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {overview.packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} creator={overview.usage.plan.id === "creator"} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{PRICE_TAX_NOTE}</p>
      </section>

      <Activity overview={overview} />
    </main>
  );
}

function PlanCard({ overview }: { overview: BillingOverview }) {
  const { usage, subscription } = overview;
  const creator = usage.plan.id === "creator";
  const periodEnd = subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null;
  const pastDue = subscription?.status === "PAST_DUE";

  let status: string;
  if (!creator) {
    status = `${usage.projects.used} of ${usage.projects.limit} projects used`;
  } else if (pastDue) {
    status = "Your last payment didn't go through. Update your payment method to keep Creator.";
  } else if (subscription?.cancelAtPeriodEnd && periodEnd) {
    status = `Ends on ${periodEnd}. You won't be charged again.`;
  } else {
    status = periodEnd ? `Renews on ${periodEnd}` : "Active";
  }

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Plan</p>
          <p className="mt-1 font-serif text-3xl">
            {usage.plan.name}
            {creator ? (
              <span className="ml-2 font-sans text-base text-muted-foreground">
                ${PLANS.creator.monthlyPriceUsd} / month
              </span>
            ) : null}
          </p>
          <p className={cn("mt-2 text-sm", pastDue ? "text-destructive" : "text-muted-foreground")}>{status}</p>
        </div>
        <div className="mt-auto space-y-2">
          {!creator ? (
            <>
              <CheckoutButton item="creator">
                Upgrade to Creator · ${PLANS.creator.monthlyPriceUsd}/month
              </CheckoutButton>
              <p className="text-center text-xs text-muted-foreground">
                {remainingMinutes(PLANS.creator.premiumSecondsPerPeriod)} premium minutes every month,{" "}
                {PLANS.creator.maxProjects} projects, lower pack prices.{" "}
                <Link href="/pricing" className="underline">
                  Compare plans
                </Link>
              </p>
            </>
          ) : subscription?.managedByProvider ? (
            <a href="#subscription-payments" className={MANAGE_LINK_CLASS}>
              {pastDue ? "Fix payment & manage" : "Manage subscription"}
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MinutesCard({ overview }: { overview: BillingOverview }) {
  const { usage, subscription } = overview;
  const { premium, plan } = usage;
  const periodMinutes = remainingMinutes(plan.premiumSecondsPerPeriod);
  const showNextGrant =
    periodMinutes > 0 && premium.periodEnd && !subscription?.cancelAtPeriodEnd && subscription?.status !== "PAST_DUE";

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Premium minutes</p>
          <p className="mt-1 font-serif text-3xl">{remainingMinutes(premium.availableSeconds).toLocaleString("en-US")} left</p>
        </div>
        <dl className="space-y-2 text-sm">
          <Row
            label="Monthly"
            value={`${remainingMinutes(premium.monthlySeconds)} min`}
            hint={
              premium.monthlySeconds > 0 && premium.monthlyExpiresAt
                ? `use by ${formatDate(premium.monthlyExpiresAt)}`
                : undefined
            }
          />
          <Row
            label="Purchased"
            value={`${remainingMinutes(premium.purchasedSeconds).toLocaleString("en-US")} min`}
            hint="never expire"
          />
          {premium.reservedSeconds > 0 ? (
            <Row label="In use" value={`${remainingMinutes(premium.reservedSeconds)} min`} hint="held for narration in progress" />
          ) : null}
        </dl>
        {showNextGrant && premium.periodEnd ? (
          <p className="text-sm text-muted-foreground">
            +{periodMinutes} minutes on {formatDate(premium.periodEnd)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <span className="font-medium">{value}</span>
        {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}

function PayPerBookCard() {
  const facts = payPerBookFacts();
  return (
    <section id="pay-per-book" className="scroll-mt-8">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {facts.title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{facts.summary}</p>
          </div>
          <ul className="space-y-1.5 text-sm">
            {facts.points.map((point) => (
              <li key={point}>✓ {point}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/studio/projects"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open a project
            </Link>
            <Link
              href="/pricing#pay-per-book"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              See pricing details
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function PackCard({ pack, creator }: { pack: BillingPack; creator: boolean }) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col p-5">
        <h3 className="font-medium">{pack.name}</h3>
        <p className="mt-1 text-2xl font-semibold">{pack.minutes.toLocaleString("en-US")} min</p>
        <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>
        <p className="mt-4 flex-1 text-lg font-semibold">
          ${pack.priceUsd}
          {creator ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground line-through">${pack.regularPriceUsd}</span>
          ) : (
            <span className="ml-2 text-sm font-normal text-muted-foreground">Creator ${pack.creatorPriceUsd}</span>
          )}
        </p>
        <div className="mt-4">
          <CheckoutButton item={pack.id} variant="outline">
            Buy {pack.name}
          </CheckoutButton>
        </div>
      </CardContent>
    </Card>
  );
}

function Activity({ overview }: { overview: BillingOverview }) {
  if (overview.activity.length === 0) {
    return null;
  }
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Minute activity
        </h2>
        <a href="#subscription-payments" className="text-sm hover:underline">
          Payments
        </a>
      </div>
      <Card>
        <ul className="divide-y divide-border text-sm">
          {overview.activity.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <span>
                {entry.label}
                <span className="ml-3 text-muted-foreground">{formatDate(entry.createdAt)}</span>
              </span>
              <span className={cn("font-medium tabular-nums", entry.seconds < 0 && "text-muted-foreground")}>
                {entry.seconds < 0 ? "−" : "+"}
                {remainingMinutes(Math.abs(entry.seconds)).toLocaleString("en-US")} min
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
