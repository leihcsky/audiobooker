import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SampleShowcase } from "@/components/samples/sample-showcase";
import { AUDIOBOOK_SAMPLES, hasSamples } from "@/lib/samples/samples";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "Audiobook samples";
const DESCRIPTION =
  "Listen to audiobooks made with Audiobooker from real EPUB, PDF, and TXT files, with the word count, chapters, generation time, and file size of each.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/samples`;
  return { title: `${TITLE} — Audiobooker`, description: DESCRIPTION, alternates: { canonical } };
}

export default function SamplesPage() {
  if (!hasSamples()) {
    notFound();
  }
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <h1 className="font-serif text-4xl tracking-tight">{TITLE}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
        Each sample comes from a public-domain book converted end to end with Audiobooker. The numbers were measured
        when the book was made, so you can see what to expect for your own manuscript.
      </p>
      <SampleShowcase samples={AUDIOBOOK_SAMPLES} heading="Samples" />
      <p className="mt-12 text-muted-foreground">
        Ready to try your own book?{" "}
        <Link href="/audiobook-maker" className="underline">
          Open the free audiobook maker
        </Link>
        .
      </p>
    </main>
  );
}
