import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { VoiceComparisonSection } from "@/components/billing/voice-comparison-section";
import { auth } from "@/lib/auth/auth";
import { planStandardListening } from "@/lib/billing/allowance-copy";
import { MINUTE_PACKS, type MinutePack } from "@/lib/billing/credit-packs";
import { getUserPlan } from "@/lib/billing/entitlements";
import { PLANS, type PlanDefinition, type PlanId } from "@/lib/billing/plans";
import { remainingMinutes } from "@/lib/billing/premium-usage";
import {
  bookCostComparison,
  payPerBookFacts,
  planFeatureComparison,
  pricingFaq,
  pricingJsonLd,
} from "@/lib/billing/pricing-facts";
import { PRICE_TAX_NOTE, REFUND_WINDOW_DAYS } from "@/lib/legal";
import { serializeJsonLd } from "@/lib/tools/seo-page";
import { getSiteUrl } from "@/lib/tools/site";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/pricing`;
  return {
    title: "Audiobooker Pricing – Free & Premium AI Audiobook Maker",
    description:
      "Create audiobooks for free with Standard Voice or upgrade to Creator for advanced editing tools and premium AI narration. Flexible pricing with no subscription required for Pay-per-Book.",
    alternates: { canonical },
  };
}

const BUTTON_CLASS =
  "inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium";

const PLAN_TAGLINES: Record<PlanId, string> = {
  free: "Start turning your ebooks into audiobooks.",
  creator: "Everything you need to create and manage audiobooks more efficiently.",
};

/** Creator leads with tools and Premium Minutes; Standard hours stay secondary. */
function features(plan: PlanDefinition): string[] {
  if (plan.id === "free") {
    return [
      `${plan.maxProjects} saved projects`,
      `${capitalize(planStandardListening(plan))} of Standard Voice generation every month`,
      "Convert supported ebook formats into audiobooks",
      "Edit chapters and manage your projects",
      "Export MP3 and M4B files",
      "Purchase Premium Voice whenever you need higher-quality narration",
    ];
  }

  const minutes = remainingMinutes(plan.premiumSecondsPerPeriod);
  return [
    `${plan.maxProjects} saved projects`,
    `${minutes} Premium Minutes included every month`,
    "Advanced chapter editing and regeneration",
    "Pronunciation dictionary for names and invented words",
    "Fix one paragraph without regenerating the chapter",
    "Publish-ready MP3 with a quality report",
    "Premium Minutes rollover for one additional billing cycle",
    "Lower prices on minute packs",
    `Standard Voice, ${planStandardListening(plan)} of narration a month (fair use)`,
  ];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function PricingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const currentPlanId: PlanId | null = userId ? (await getUserPlan(userId)).id : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      {pricingJsonLd(getSiteUrl()).map((item, index) => (
        <script
          key={`pricing-ld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
        />
      ))}
      <div className="text-center">
        <h1 className="font-serif text-4xl tracking-tight">Simple Pricing for Better Audiobooks</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Start creating audiobooks for free. Upgrade for advanced editing tools and more expressive AI
          narration when you need them. Premium Voice is available without a subscription via minute packs
          or Pay-per-Book.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {[PLANS.free, PLANS.creator].map((plan) => (
          <PlanCard key={plan.id} plan={plan} currentPlanId={currentPlanId} />
        ))}
      </div>

      <VoiceComparisonSection />

      <PremiumNarrationSection signedIn={currentPlanId !== null} creator={currentPlanId === "creator"} />

      <FeatureComparison />

      <BookCost />
      <p className="mt-10 text-center text-sm text-muted-foreground">{PRICE_TAX_NOTE}</p>
      <PricingFaq />
    </main>
  );
}

function PlanCard({ plan, currentPlanId }: { plan: PlanDefinition; currentPlanId: PlanId | null }) {
  const current = plan.id === currentPlanId;
  return (
    <section
      className={`flex flex-col rounded-xl border bg-card p-6 shadow-sm ${
        current ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">{plan.name}</h2>
        {current ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Current plan
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold">
        {plan.monthlyPriceUsd === 0 ? "$0" : `$${plan.monthlyPriceUsd}`}
        {plan.monthlyPriceUsd > 0 ? (
          <span className="text-base font-normal text-muted-foreground"> / month</span>
        ) : null}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{PLAN_TAGLINES[plan.id]}</p>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {features(plan).map((item) => (
          <li key={item}>✓ {item}</li>
        ))}
      </ul>
      <div className="mt-8">
        <PlanAction plan={plan} current={current} signedIn={currentPlanId !== null} />
      </div>
    </section>
  );
}

function PlanAction({
  plan,
  current,
  signedIn,
}: {
  plan: PlanDefinition;
  current: boolean;
  signedIn: boolean;
}) {
  if (current) {
    const paid = plan.monthlyPriceUsd > 0;
    return (
      <Link href={paid ? "/studio/billing" : "/studio"} className={`${BUTTON_CLASS} border border-border hover:bg-muted`}>
        {paid ? "Manage billing" : "Open Studio"}
      </Link>
    );
  }
  if (plan.monthlyPriceUsd === 0) {
    return signedIn ? null : (
      <Link href="/signup" className={`${BUTTON_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}>
        Get Started Free
      </Link>
    );
  }
  if (!signedIn) {
    return (
      <Link href="/signup" className={`${BUTTON_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}>
        Start Creating with Creator
      </Link>
    );
  }
  return <CheckoutButton item="creator">Start Creating with Creator</CheckoutButton>;
}

function PremiumNarrationSection({ signedIn, creator }: { signedIn: boolean; creator: boolean }) {
  const facts = payPerBookFacts();
  return (
    <section className="mt-16 space-y-10" aria-labelledby="premium-narration-heading">
      <div className="text-center">
        <h2 id="premium-narration-heading" className="font-serif text-3xl tracking-tight">
          Upgrade Your Audiobook with Premium Narration
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Give your audiobook a more natural and expressive voice. Premium Voice is ideal for storytelling,
          character dialogue, and projects where narration quality matters.
        </p>
      </div>

      <div id="minute-packs" className="scroll-mt-8">
        <div className="text-center">
          <h3 className="font-serif text-2xl tracking-tight">Premium Minutes</h3>
          <p className="mt-2 text-muted-foreground">
            Buy a balance of Premium Voice minutes for any account. Free and Creator can purchase; Creator
            pays less. Purchased minutes never expire.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Unused packs can be refunded within {REFUND_WINDOW_DAYS} days.{" "}
            <Link href="/refunds" className="underline">
              Refund policy
            </Link>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            1 premium minute = 1 minute of finished audio in a Premium voice. Standard Voice stays on your
            plan allowance.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {MINUTE_PACKS.map((pack) => (
            <PackCard key={pack.id} pack={pack} creator={creator} signedIn={signedIn} />
          ))}
        </div>
      </div>

      <div id="pay-per-book" className="scroll-mt-8 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h3 className="font-serif text-2xl tracking-tight">{facts.title}</h3>
        <p className="mt-3 max-w-2xl text-muted-foreground">{facts.summary}</p>
        <ul className="mt-6 space-y-2 text-sm">
          {facts.points.map((point) => (
            <li key={point}>✓ {point}</li>
          ))}
        </ul>
        <div className="mt-8">
          {signedIn ? (
            <Link
              href="/studio/projects"
              className={`${BUTTON_CLASS} max-w-xs bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              Open a project to get a quote
            </Link>
          ) : (
            <Link
              href="/signup"
              className={`${BUTTON_CLASS} max-w-xs bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              Create a free account
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function FeatureComparison() {
  const rows = planFeatureComparison();
  return (
    <section className="mt-16" aria-labelledby="feature-comparison-heading">
      <h2 id="feature-comparison-heading" className="text-center font-serif text-3xl tracking-tight">
        Compare plans
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
        Free covers the full Standard Voice workflow. Creator adds professional editing tools and monthly
        Premium Minutes.
      </p>
      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-4 py-3 font-medium">
                Feature
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Free
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Creator
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 align-top font-medium text-muted-foreground">
                  {row.label}
                </th>
                <td className="px-4 py-3 align-top">{row.free}</td>
                <td className="px-4 py-3 align-top">{row.creator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BookCost() {
  const { hours, rows } = bookCostComparison();
  return (
    <section className="mt-16">
      <h2 className="text-center font-serif text-3xl tracking-tight">What a {hours}-hour audiobook costs</h2>
      <dl className="mt-8 divide-y divide-border rounded-xl border border-border text-sm">
        {rows.map((row) => (
          <div
            key={row.option}
            className="grid gap-1 p-4 sm:grid-cols-[minmax(0,14rem)_8rem_minmax(0,1fr)] sm:items-baseline sm:gap-6"
          >
            <dt className="font-medium">{row.option}</dt>
            <dd className="text-lg font-semibold whitespace-nowrap">{row.cost}</dd>
            <dd className="text-muted-foreground">{row.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PricingFaq() {
  return (
    <section className="mt-16">
      <h2 className="font-serif text-3xl tracking-tight">Pricing questions</h2>
      <div className="mt-6 space-y-6">
        {pricingFaq().map((item) => (
          <div key={item.question}>
            <h3 className="font-medium">{item.question}</h3>
            <p className="mt-1 text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PackCard({ pack, creator, signedIn }: { pack: MinutePack; creator: boolean; signedIn: boolean }) {
  const price = creator ? pack.creatorPriceUsd : pack.priceUsd;
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-medium">{pack.name}</h3>
      <p className="mt-1 text-2xl font-semibold">{pack.minutes.toLocaleString("en-US")} min</p>
      <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>
      <p className="mt-4 flex-1 text-lg font-semibold">
        ${price}
        {creator ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground line-through">${pack.priceUsd}</span>
        ) : (
          <span className="ml-2 text-sm font-normal text-muted-foreground">Creator ${pack.creatorPriceUsd}</span>
        )}
      </p>
      <div className="mt-4">
        {signedIn ? (
          <CheckoutButton item={pack.id} variant="outline">
            Buy {pack.name}
          </CheckoutButton>
        ) : (
          <Link href="/signup" className={`${BUTTON_CLASS} border border-border hover:bg-muted`}>
            Create a free account
          </Link>
        )}
      </div>
    </div>
  );
}
