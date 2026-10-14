import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalList, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "Privacy Policy";
const DESCRIPTION = "What Audiobooker collects, why, who processes it, and how to access or delete your data.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/privacy`;
  return { title: `${TITLE} — Audiobooker`, description: DESCRIPTION, alternates: { canonical } };
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title={TITLE}
      intro={
        <p>
          Audiobooker (audiobooker.org) is an online audiobook production studio run by an independent
          developer. This policy explains what we collect when you use the site, why, and what you can do
          about it.
        </p>
      }
    >
      <LegalSection title="What we collect">
        <LegalList
          items={[
            <>
              <strong>Account details.</strong> Your email address and your password, which we store only as a
              one-way hash. If you sign in with Google, we receive your name, email address, profile picture,
              and Google account ID from Google, and no password is stored.
            </>,
            <>
              <strong>Your content.</strong> The ebooks and text you upload, covers, book details you enter,
              pronunciation rules, and the audio and exports we produce from them.
            </>,
            <>
              <strong>Free tool without an account.</strong> An anonymous session cookie and a salted one-way hash
              of your network address, used only to apply fair-use limits. We do not store the raw address in our
              database.
            </>,
            <>
              <strong>Usage.</strong> Narration minutes, jobs, and simple first-party events such as “upload
              started” or “export downloaded”. We also use Google Analytics and Plausible to understand how visitors
              find and use the site, such as pages viewed, referring sites, device type, and approximate location.
              We do not use advertising trackers.
            </>,
            <>
              <strong>Payments.</strong> Payments are handled by Waffo, our merchant of record. We receive the
              order, plan, amount, and subscription status, never your card details.
            </>,
            <>
              <strong>Server logs.</strong> Our web server records IP addresses and requests for security and
              troubleshooting, and rotates these logs after a short period.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          To run the service: parse your books, narrate and export them, keep your projects, apply plan limits,
          process payments, prevent abuse, answer support requests, and improve the product. We do not sell your
          data, show ads based on it, or use your books to train AI models. We do not routinely read your projects;
          we look at a project&apos;s content only when investigating a report or a suspected breach of our{" "}
          <Link href="/acceptable-use" className="underline">
            Acceptable Use Policy
          </Link>
          , or when you ask us for help with it.
        </p>
      </LegalSection>

      <LegalSection title="Who else processes your data">
        <p>We share data only with the services needed to run Audiobooker:</p>
        <LegalList
          items={[
            <>
              <strong>Microsoft</strong> — the text of each passage is sent to Microsoft&apos;s speech service to
              produce standard voices.
            </>,
            <>
              <strong>Replicate</strong> — when you choose a premium voice, the text is sent to Replicate, which
              runs the MiniMax speech models.
            </>,
            <>
              <strong>Cloudflare</strong> — stores uploaded files, audio, and exports (Cloudflare R2).
            </>,
            <>
              <strong>Waffo</strong> — processes payments and subscriptions as merchant of record.
            </>,
            <>
              <strong>Google</strong> — confirms your identity when you choose to sign in with Google, and
              provides site analytics (Google Analytics).
            </>,
            <>
              <strong>Plausible</strong> — privacy-friendly site analytics that uses no cookies and stores no
              personal data.
            </>,
            <>
              <strong>Our hosting provider</strong> — runs the servers and database.
            </>,
          ]}
        />
        <p>These providers may process data outside your country.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use a sign-in cookie to keep you logged in and, on the free tools, an anonymous session cookie that
          remembers your temporary project. Google Analytics sets its own cookies to count visits and tell new
          visitors from returning ones. You can block them with your browser settings or Google&apos;s{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" className="underline" rel="noopener noreferrer">
            opt-out add-on
          </a>
          . We do not use advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <LegalList
          items={[
            "Account and project data are kept while your account exists.",
            "When you delete a project, it disappears from your account immediately, but we currently keep a copy of its data and files so it can be recovered if deleted by mistake. Ask us and we will erase it permanently within 30 days.",
            "Free-tool projects expire after a few days and are hidden the same way.",
            "Download links for exports expire after a few days.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          You can ask us for a copy of your data, to correct it, or to delete your account and everything in it,
          including deleted projects. Email <ContactEmail /> from the address on your account and we will respond
          within 30 days. If you are in the EU or UK you may also complain to your local data protection
          authority.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          The site is served over HTTPS. Uploaded files and audio are stored privately and are only reachable
          through short-lived signed links issued to their owner.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Audiobooker is not intended for anyone under 16, and we do not knowingly collect their data.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy we will update the date above, and tell signed-in users about significant
          changes. See also our <Link href="/terms" className="underline">Terms</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
