import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalList, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { REFUND_WINDOW_DAYS } from "@/lib/legal";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "Refund Policy";
const DESCRIPTION = "When Audiobooker purchases can be refunded, how cancellation works, and how to ask for a refund.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/refunds`;
  return { title: `${TITLE} — Audiobooker`, description: DESCRIPTION, alternates: { canonical } };
}

export default function RefundsPage() {
  return (
    <LegalPage
      title={TITLE}
      intro={
        <p>
          Payments are processed by Waffo, our merchant of record. Approved refunds go back to the original payment
          method through Waffo.
        </p>
      }
    >
      <LegalSection title="Premium minute packs">
        <p>
          You can get a full refund within {REFUND_WINDOW_DAYS} days of purchase if none of the pack&apos;s
          minutes have been used. After that, or once you have used any of them, packs are not refundable.
        </p>
      </LegalSection>

      <LegalSection title="Creator plan">
        <LegalList
          items={[
            "You can cancel at any time from the Billing page. You keep Creator features and the period's premium minutes until the end of the period you paid for, and you will not be charged again.",
            "Billing periods that have already been charged are not refunded.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Failed narration">
        <p>
          If a narration fails, the minutes reserved for it are returned to your balance automatically. You do not
          need to ask.
        </p>
      </LegalSection>

      <LegalSection title="What happens after a refund">
        <p>The minutes from the refunded purchase are removed from your balance.</p>
      </LegalSection>

      <LegalSection title="How to ask">
        <p>
          Email <ContactEmail /> from the address on your account, with the order number from your receipt. We
          reply within a few business days.
        </p>
        <p className="text-sm text-muted-foreground">
          This policy does not affect any rights you have under the consumer laws of your country. See also our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
