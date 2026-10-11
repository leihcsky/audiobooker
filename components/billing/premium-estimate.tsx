import Link from "next/link";
import { estimatedMinutes, remainingMinutes } from "@/lib/billing/premium-usage";
import { cn } from "@/lib/utils";

export function PremiumEstimate({
  neededSeconds,
  availableSeconds,
}: {
  neededSeconds: number;
  availableSeconds: number;
}) {
  const needed = estimatedMinutes(neededSeconds);
  const left = remainingMinutes(availableSeconds);
  const short = neededSeconds > availableSeconds;
  return (
    <span className={cn("text-sm", short ? "text-destructive" : "text-muted-foreground")}>
      {short ? (
        <>
          Needs about {needed} premium min · only {left} left.{" "}
          <Link href="/pricing#minute-packs" className="font-medium underline">
            Buy minutes
          </Link>{" "}
          or choose a standard voice.
        </>
      ) : (
        `Uses about ${needed} premium min · ${left} left`
      )}
    </span>
  );
}
