import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalList, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "Terms of Service";
const DESCRIPTION = "The rules for using Audiobooker, including your content, AI narration, plans, and payments.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/terms`;
  return { title: `${TITLE} — Audiobooker`, description: DESCRIPTION, alternates: { canonical } };
}

export default function TermsPage() {
  return (
    <LegalPage
      title={TITLE}
      intro={
        <p>
          These terms apply when you use Audiobooker (audiobooker.org), an online audiobook production studio run
          by an independent developer (“we”). By using the site or creating an account you agree to them.
        </p>
      }
    >
      <LegalSection title="The service">
        <p>
          Audiobooker turns books you provide into audiobooks: it splits them into chapters, narrates them with
          synthetic (AI) voices from third-party providers, and exports audio files. You must be at least 16 to use
          it, and old enough to enter a contract where you live to buy a plan.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          Keep your password safe; you are responsible for activity on your account. One account per person, and
          do not share it to get around plan limits.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <LegalList
          items={[
            "Only upload books you own or have the rights to turn into audio. Do not upload DRM-protected files or content you are not allowed to adapt.",
            "You keep all rights to your text and to the audio produced from it. You let us store and process your content only to provide the service to you.",
            "You are responsible for what you upload and for how you use the audio, including any distribution or sale.",
          ]}
        />
      </LegalSection>

      <LegalSection title="AI narration and publishing">
        <p>
          All narration is synthetic. Pronunciation and delivery can contain mistakes, so listen before you
          publish. If you distribute an audiobook, follow each store&apos;s rules, including disclosing AI
          narration. We cannot guarantee that any store will accept your audiobook.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Do not use Audiobooker to:</p>
        <LegalList
          items={[
            "infringe copyright or other rights, or produce illegal, hateful, or harassing content;",
            "get around usage limits, for example with multiple accounts, scripts, or automated requests;",
            "interfere with the service, probe it for vulnerabilities, or resell access to it.",
          ]}
        />
        <p>We may remove content or suspend accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="Free use and limits">
        <p>
          Free accounts and the free tools have usage limits that may change. Free-tool projects without an account
          are temporary and expire after a few days unless you save them to an account.
        </p>
      </LegalSection>

      <LegalSection title="Plans and payments">
        <LegalList
          items={[
            "Payments are processed by Waffo, our merchant of record. Prices are shown before you pay; taxes may be added at checkout.",
            "The Creator plan renews automatically each billing period until you cancel. You can cancel at any time from the Billing page; the plan stays active until the end of the period you paid for.",
            <>
              Premium minutes included with a plan and purchased minute packs work as described on the{" "}
              <Link href="/pricing" className="underline">
                Pricing
              </Link>{" "}
              page. Minutes for a narration that fails are returned automatically.
            </>,
            <>
              Refunds follow our{" "}
              <Link href="/refunds" className="underline">
                Refund Policy
              </Link>
              .
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Changes and availability">
        <p>
          We may change, add, or remove features, voices, and limits. Voices depend on third-party providers that
          can change or stop their service. We aim to keep Audiobooker available but do not guarantee uninterrupted
          service, so keep your own copies of your books and finished audio.
        </p>
      </LegalSection>

      <LegalSection title="Ending your use">
        <p>
          You can stop using Audiobooker at any time and ask us to delete your account. We may suspend or close
          accounts that break these terms or put the service or other users at risk.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>
          The service is provided “as is”. To the extent the law allows, we are not liable for indirect or
          consequential losses, and our total liability is limited to the amount you paid us in the 12 months before
          the claim. Nothing in these terms limits rights you have under consumer law that cannot be waived.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. We will change the date above and tell signed-in users about significant
          changes; continuing to use Audiobooker means you accept the new terms. Questions: <ContactEmail />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
