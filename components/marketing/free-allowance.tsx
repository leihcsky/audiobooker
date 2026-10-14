import Link from "next/link";
import { freeAllowanceFacts } from "@/lib/billing/pricing-facts";

export function FreeAllowance() {
  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl">What&apos;s free</h2>
      <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-3">
        {freeAllowanceFacts().map((fact) => (
          <div key={fact.term}>
            <dt className="font-medium">{fact.term}</dt>
            <dd className="mt-1 text-muted-foreground">{fact.text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm text-muted-foreground">
        Listening times are estimates for English text at normal speed.{" "}
        <Link href="/pricing" className="underline">
          See pricing
        </Link>
      </p>
    </section>
  );
}
