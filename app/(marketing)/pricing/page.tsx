import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { auth } from "@/lib/auth/auth";
import { MINUTE_PACKS, type MinutePack } from "@/lib/billing/credit-packs";
import { getUserPlan } from "@/lib/billing/entitlements";
import { PLANS, type PlanDefinition, type PlanId } from "@/lib/billing/plans";
import { remainingMinutes } from "@/lib/billing/premium-usage";
import { REFUND_WINDOW_DAYS } from "@/lib/legal";
import { getSiteUrl } from "@/lib/tools/site";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/pricing`;
  return {
    title: "Pricing — Audiobooker",
    description: "Create audiobooks for free. Upgrade when you need more projects and premium voices.",
    alternates: { canonical },
  };
}

const BUTTON_CLASS =
  "inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium";

function features(plan: PlanDefinition): string[] {
  const list = [
    `${plan.maxProjects} saved projects`,
    "Standard voices",
    "Premium voices, paid with premium minutes",
    "Chapter editing and regeneration",
    "MP3 and M4B export",
  ];
  if (plan.publishMastering) {
    list.push("Publish-ready MP3 for Spotify and Google Play, with a quality report");
  }
  if (plan.pronunciationDictionary) {
    list.push("Pronunciation dictionary for names and invented words");
  }
  if (plan.paragraphFix) {
    list.push("Fix one paragraph without regenerating the chapter");
  }
  const minutes = remainingMinutes(plan.premiumSecondsPerPeriod);
  if (minutes > 0) {
    list.push(`${minutes} premium minutes each billing period, rolling over one period`);
  }
  if (plan.discountedMinutePacks) {
    list.push("Lower prices on minute packs");
  }
  return list;
}

export default async function PricingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const currentPlanId: PlanId | null = userId ? (await getUserPlan(userId)).id : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="text-center">
        <h1 className="font-serif text-4xl tracking-tight">Pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Create audiobooks for free. Upgrade when you need more projects and premium voices.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {[PLANS.free, PLANS.creator].map((plan) => (
          <PlanCard key={plan.id} plan={plan} currentPlanId={currentPlanId} />
        ))}
      </div>
      <MinutePacks creator={currentPlanId === "creator"} signedIn={currentPlanId !== null} />
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
        Get started
      </Link>
    );
  }
  if (!signedIn) {
    return (
      <Link href="/signup" className={`${BUTTON_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}>
        Create a free account to upgrade
      </Link>
    );
  }
  return <CheckoutButton item="creator">Upgrade to {plan.name}</CheckoutButton>;
}

function MinutePacks({ creator, signedIn }: { creator: boolean; signedIn: boolean }) {
  return (
    <section id="minute-packs" className="mt-16 scroll-mt-8">
      <div className="text-center">
        <h2 className="font-serif text-3xl tracking-tight">Premium minute packs</h2>
        <p className="mt-2 text-muted-foreground">
          One-time purchase for any account. Purchased minutes never expire.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Unused packs can be refunded within {REFUND_WINDOW_DAYS} days.{" "}
          <Link href="/refunds" className="underline">
            Refund policy
          </Link>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          1 premium minute = 1 minute of finished audio in a premium voice. Standard voices are included with fair use.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {MINUTE_PACKS.map((pack) => (
          <PackCard key={pack.id} pack={pack} creator={creator} signedIn={signedIn} />
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
        {!creator ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            Creator ${pack.creatorPriceUsd}
          </span>
        ) : null}
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
