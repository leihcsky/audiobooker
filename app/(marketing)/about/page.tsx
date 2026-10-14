import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "About Audiobooker";
const DESCRIPTION =
  "Audiobooker is an online audiobook production studio for independent authors: import a manuscript, narrate it with AI voices, refine it, and export a finished audiobook.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/about`;
  return { title: `${TITLE} — Audiobooker`, description: DESCRIPTION, alternates: { canonical } };
}

export default function AboutPage() {
  return (
    <LegalPage
      variant="info"
      title={TITLE}
      intro={
        <p>
          Audiobooker is an online audiobook production studio. It helps independent authors and publishers turn a
          finished manuscript into an audiobook they can be proud of, without booking a recording studio.
        </p>
      }
    >
      <LegalSection title="Why we built it">
        <p>
          Readers increasingly ask for the audio edition, but hiring a narrator and a studio is out of reach for
          most independent authors. Text-to-speech converters are cheap, but they produce one long file you cannot
          fix. Audiobooker sits in between: AI narration, with the production tools to get every chapter right.
        </p>
      </LegalSection>

      <LegalSection title="How it works">
        <LegalList
          items={[
            <>
              <strong>Create.</strong> Upload an EPUB, PDF, or TXT. The text, title, and cover are imported when
              the file has them.
            </>,
            <>
              <strong>Build.</strong> Chapters are detected for you. Choose which ones belong in the audiobook,
              pick a voice and reading speed, and narrate.
            </>,
            <>
              <strong>Edit.</strong> Listen back, regenerate a single paragraph or chapter, and teach the narrator
              how to say names and unusual words.
            </>,
            <>
              <strong>Master.</strong> Export an M4B with chapter markers, cover, and book details, or chapter
              MP3s with even loudness for distribution.
            </>,
            <>
              <strong>Publish.</strong> Check your audiobook against each platform&apos;s requirements before you
              upload it. See our{" "}
              <Link href="/publish-audiobook" className="underline">
                publishing guide
              </Link>
              .
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="What we believe">
        <LegalList
          items={[
            "Your book is yours. We never use your manuscripts or audio to train AI models.",
            "AI narration should be honest. Audiobooker voices are synthetic, and we encourage you to disclose AI narration wherever a platform asks for it.",
            "Only produce audiobooks of books you wrote or hold the audio rights to.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Who we are">
        <p>
          Audiobooker is built and run by an independent developer. Standard voices are produced with
          Microsoft&apos;s speech service and premium voices with MiniMax models. Payments are handled by Waffo,
          our merchant of record.
        </p>
      </LegalSection>

      <LegalSection title="Get started">
        <p>
          You can try Audiobooker free, without an account, from the{" "}
          <Link href="/audiobook-maker" className="underline">
            Audiobook Maker
          </Link>
          . See{" "}
          <Link href="/pricing" className="underline">
            Pricing
          </Link>{" "}
          for Studio plans, or{" "}
          <Link href="/contact" className="underline">
            contact us
          </Link>{" "}
          with any question.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
