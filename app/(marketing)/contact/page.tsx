import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalList, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "Contact";
const DESCRIPTION = "How to reach Audiobooker for support, billing, privacy requests, and copyright reports.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/contact`;
  return { title: `${TITLE} — Audiobooker`, description: DESCRIPTION, alternates: { canonical } };
}

export default function ContactPage() {
  return (
    <LegalPage
      variant="info"
      title={TITLE}
      intro={
        <p>
          The best way to reach us is by email at <ContactEmail />. We read every message and reply within a few
          business days.
        </p>
      }
    >
      <LegalSection title="Help with a project">
        <p>
          Tell us the project title, what you were doing, and what happened. A screenshot of any error message
          helps. Please don&apos;t attach your manuscript unless we ask for it.
        </p>
      </LegalSection>

      <LegalSection title="Billing and refunds">
        <p>
          Write from the email address on your account and include the order number from your receipt. See our{" "}
          <Link href="/refunds" className="underline">
            Refund Policy
          </Link>{" "}
          for what can be refunded. Payments are processed by Waffo, our merchant of record.
        </p>
      </LegalSection>

      <LegalSection title="Privacy and account deletion">
        <p>
          To get a copy of your data, correct it, or delete your account, email us from the address on your
          account. Our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          explains what we keep and for how long.
        </p>
      </LegalSection>

      <LegalSection title="Copyright and abuse reports">
        <p>If you believe someone has used Audiobooker to produce audio of your work without permission, send us:</p>
        <LegalList
          items={[
            "your name and how to contact you;",
            "the work concerned and proof that you own or represent the rights to it;",
            "where the audio appears, if you have found it published;",
            "a statement that the information in your report is accurate.",
          ]}
        />
        <p>
          We review every report and act on it, including removing content and closing accounts that break our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
