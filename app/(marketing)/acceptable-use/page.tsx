import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalList, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "Acceptable Use Policy";
const DESCRIPTION =
  "What you may not upload or narrate with Audiobooker, how to report content, how we review it, and what happens when the rules are broken.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/acceptable-use`;
  return { title: `${TITLE} — Audiobooker`, description: DESCRIPTION, alternates: { canonical } };
}

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title={TITLE}
      intro={
        <p>
          Audiobooker narrates text you provide with synthetic (AI) voices. This policy applies to everything you
          upload, narrate, preview, or export, on the free tools and in Studio. It is part of our{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          .
        </p>
      }
    >
      <LegalSection title="Content standards and prohibited categories">
        <p>You may not upload text, or use Audiobooker to produce audio, that falls into any of these categories:</p>
        <LegalList
          items={[
            <>
              <strong>Sexual content (NSFW).</strong> Pornographic or sexually explicit material, including explicit
              erotica.
            </>,
            <>
              <strong>Violence and gore.</strong> Content that promotes or incites violence, glorifies real violent
              acts or terrorism, encourages self-harm, gives instructions for causing harm, or depicts gore in
              graphic detail for its own sake.
            </>,
            <>
              <strong>Hate speech.</strong> Content that attacks, threatens, or dehumanizes people because of race,
              ethnicity, national origin, religion, caste, sex, gender identity, sexual orientation, disability, or
              serious illness.
            </>,
            <>
              <strong>Child safety.</strong> Any content that sexualizes minors, including child sexual abuse
              material (CSAM), or that grooms, exploits, or endangers children. We have zero tolerance for this
              category.
            </>,
            <>
              <strong>Deepfakes and impersonation.</strong> Using narration to impersonate a real person, to present
              audio as a real person&apos;s voice, words, or endorsement, or to mislead listeners for fraud or scams.
              Audiobooker offers only preset synthetic voices and does not clone anyone&apos;s voice.
            </>,
            <>
              <strong>Copyright and trademark infringement.</strong> Books you do not own or hold the audio rights to,
              files with DRM removed, and content that uses someone else&apos;s trademarks in a way that misleads
              listeners about who made it.
            </>,
          ]}
        />
        <p>
          Content that is otherwise illegal, defamatory, harassing, or that exposes someone&apos;s private
          information is also not allowed.
        </p>
      </LegalSection>

      <LegalSection title="How to report content">
        <p>
          If you come across audio made with Audiobooker that breaks this policy, email <ContactEmail /> with the
          subject “Content report” and include:
        </p>
        <LegalList
          items={[
            "where the content appears (a link, store listing, or file name);",
            "which category above it falls into, and why;",
            "how we can reach you, if you would like to hear back.",
          ]}
        />
        <p>
          For copyright reports, also include proof that you own or represent the rights to the work and a
          statement that the information in your report is accurate. You can report other content anonymously.
        </p>
      </LegalSection>

      <LegalSection title="How we review content">
        <LegalList
          items={[
            "Projects are private, and we do not routinely read them. We review content when it is reported, and when our usage records show signs of abuse, such as unusually high volumes from one account or network.",
            "Every report is reviewed by a person. Reports involving child safety are handled first; we aim to review other reports within a few business days.",
            "During a review we look at the project's text, audio, and account details, only as far as needed to decide the report.",
            "Our voice providers may also apply their own safety filters and refuse to narrate some text.",
          ]}
        />
      </LegalSection>

      <LegalSection title="What happens when the rules are broken">
        <LegalList
          items={[
            "We remove or disable the content, its narration, and its exports.",
            "Depending on how serious the violation is, we warn you, suspend your account, or close it permanently. Severe violations, such as child sexual abuse material or credible threats of violence, lead to immediate closure without warning.",
            "We report child sexual abuse material to the National Center for Missing & Exploited Children (NCMEC) and report other illegal content to the authorities where required.",
            "Where the law allows, accounts closed for violations are not refunded for plans or unused premium minutes.",
          ]}
        />
        <p>
          If you think we made a mistake, reply to our notice or email <ContactEmail /> and a person will look at the
          decision again.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
