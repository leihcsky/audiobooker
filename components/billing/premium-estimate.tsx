import Link from "next/link";
import {
  estimatedMinutes,
  premiumNoticeLevel,
  remainingMinutes,
} from "@/lib/billing/premium-usage";
import { cn } from "@/lib/utils";

const PACKS_HREF = "/studio/billing#minute-packs";

export function PremiumEstimate({
  neededSeconds,
  availableSeconds,
  action = "generate",
  /** `compact` is for inline actions (e.g. one paragraph) without repeating balance banners. */
  variant = "full",
}: {
  neededSeconds: number;
  availableSeconds: number;
  /** Wording for the cost of this click. */
  action?: "generate" | "regenerate";
  variant?: "full" | "compact";
}) {
  const needed = estimatedMinutes(neededSeconds);
  const left = remainingMinutes(availableSeconds);
  const level = premiumNoticeLevel(neededSeconds, availableSeconds);
  const short = level === "short";
  const verb = action === "regenerate" ? "This regenerate uses" : "Uses";
  const tone =
    short || level === "critical"
      ? "text-destructive"
      : level === "low"
        ? "text-amber-800 dark:text-amber-200"
        : "text-muted-foreground";

  if (variant === "compact") {
    if (neededSeconds <= 0) {
      return null;
    }
    return (
      <p className={cn("text-xs", tone)} role={short ? "status" : undefined}>
        {short ? (
          <>
            Needs ~{needed} min · {left} left.{" "}
            <Link href={PACKS_HREF} className="font-medium underline">
              Buy minutes
            </Link>
          </>
        ) : (
          <>Uses about {needed} min · {left} left</>
        )}
      </p>
    );
  }

  if (neededSeconds <= 0 && level === "ok") {
    return null;
  }

  return (
    <div
      className={cn("space-y-1 text-sm", tone)}
      role={short || level === "critical" || level === "low" ? "status" : undefined}
    >
      {neededSeconds > 0 ? (
        <p>
          {short ? (
            <>
              Needs about {needed} premium min · only {left} left.
            </>
          ) : (
            <>
              {verb} about {needed} premium min · {left} left
            </>
          )}
        </p>
      ) : null}
      {level === "low" && !short ? (
        <p>
          Running low: {left} premium minute{left === 1 ? "" : "s"} left on this account.
        </p>
      ) : null}
      {level === "critical" && !short ? (
        <p>
          Only {left} premium minute{left === 1 ? "" : "s"} left.{" "}
          <Link href={PACKS_HREF} className="font-medium underline">
            Buy a minute pack
          </Link>{" "}
          before you run out.
        </p>
      ) : null}
      {short ? (
        <p>
          <Link href={PACKS_HREF} className="font-medium underline">
            Buy minutes
          </Link>{" "}
          or choose a standard voice before generating.
        </p>
      ) : null}
    </div>
  );
}
