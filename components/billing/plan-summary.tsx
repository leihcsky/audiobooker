import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { remainingMinutes } from "@/lib/billing/premium-usage";
import type { UsageSummary } from "@/lib/billing/usage-summary";
import { formatDate } from "@/lib/utils";

export function PlanSummary({ usage }: { usage: UsageSummary }) {
  const { plan, projects, premium } = usage;
  const periodMinutes = remainingMinutes(plan.premiumSecondsPerPeriod);
  const nextGrant =
    periodMinutes > 0 && premium.periodEnd
      ? `+${periodMinutes} on ${formatDate(premium.periodEnd)}`
      : undefined;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-5">
        <div className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <Stat label="Plan" value={plan.name} />
          <Stat label="Projects" value={`${projects.used} of ${projects.limit}`} />
          <Stat
            label="Premium minutes"
            value={`${remainingMinutes(premium.availableSeconds)} left`}
            hint={nextGrant}
          />
        </div>
        <Link
          href={premium.availableSeconds < 60 ? "/studio/billing#minute-packs" : "/studio/billing"}
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          {premium.availableSeconds < 60 ? "Buy minutes" : "Billing"}
        </Link>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-medium">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
