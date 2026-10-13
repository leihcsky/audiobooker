import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { DEFAULT_AI_DISCLOSURE, DEFAULT_NARRATOR_CREDIT } from "@/lib/publish/disclosure";
import { PUBLISH_PLATFORM_IDS, PUBLISH_PLATFORMS, type PublishPlatform } from "@/lib/publish/platforms";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "How to Publish an AI-Narrated Audiobook on Spotify and Google Play";
const DESCRIPTION =
  "Where AI-narrated audiobooks are accepted, how to disclose digital narration, and the audio, cover, and metadata each store requires.";

export function generateMetadata(): Metadata {
  const canonical = `${getSiteUrl()}/publish-audiobook`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: { title: TITLE, description: DESCRIPTION, url: canonical, siteName: "Audiobooker", locale: "en_US", type: "article" },
    twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  };
}

function audioRequirements(platform: PublishPlatform): string[] {
  const { audio } = platform;
  const format = [`MP3, at least ${audio.minBitrateKbps} kbps`];
  if (audio.constantBitrate) {
    format.push("constant bitrate");
  }
  if (audio.sampleRateHz) {
    format.push(`${audio.sampleRateHz / 1000} kHz`);
  }
  const list = [format.join(", ")];
  if (audio.maxFileMinutes) {
    list.push(`Each file ${audio.maxFileMinutes} minutes or shorter`);
  }
  if (audio.minTotalMinutes) {
    list.push(`At least ${audio.minTotalMinutes} minutes of audio in total`);
  }
  if (audio.headSilenceSeconds) {
    list.push(`${audio.headSilenceSeconds[0]}–${audio.headSilenceSeconds[1]} s of silence at the start of each file`);
  }
  if (audio.tailSilenceSeconds) {
    list.push(`${audio.tailSilenceSeconds[0]}–${audio.tailSilenceSeconds[1]} s of silence at the end of each file`);
  }
  if (platform.openingCreditsRequired) {
    list.push("An opening-credits track with the title, author, and narrator");
  }
  return list;
}

function coverRequirement(platform: PublishPlatform): string {
  const { cover } = platform;
  const shape = cover.squareRequired ? "Square (1:1)" : "Square recommended";
  const size = cover.minPixels
    ? `at least ${cover.minPixels}×${cover.minPixels}, ${cover.recommendedPixels}×${cover.recommendedPixels} recommended`
    : `${cover.recommendedPixels}×${cover.recommendedPixels} recommended`;
  return `${shape}, ${size}`;
}

function metadataRequirements(platform: PublishPlatform): string {
  const fields = ["Title", "Author"];
  if (platform.narratorRequired) {
    fields.push(`Narrator credit (for example “${DEFAULT_NARRATOR_CREDIT}”)`);
  }
  if (platform.descriptionRequired) {
    fields.push("Description");
  }
  return fields.join(", ");
}

export default async function PublishAudiobookPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="font-serif text-4xl tracking-tight">{TITLE}</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Several stores accept audiobooks narrated with a synthetic voice, as long as you label them
        honestly and the files meet their technical rules. This guide covers the two we recommend
        starting with.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="font-serif text-2xl">The one rule everywhere: disclose AI narration</h2>
        <p>
          Mark the narration as digital or synthesized when you upload, and say so in the
          description. A plain sentence is enough:
        </p>
        <blockquote className="rounded-md border-l-4 border-border bg-muted/50 px-4 py-3 text-sm">
          {DEFAULT_AI_DISCLOSURE}
        </blockquote>
        <p className="text-sm text-muted-foreground">
          Audible/ACX requires human narration unless Audible has authorized otherwise, so check
          its terms before submitting there.
        </p>
      </section>

      {PUBLISH_PLATFORM_IDS.map((id) => {
        const platform = PUBLISH_PLATFORMS[id];
        return (
          <section key={id} id={id} className="mt-12 scroll-mt-8 space-y-4">
            <h2 className="font-serif text-2xl">{platform.name}</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-medium">AI narration</dt>
                <dd className="mt-1 text-muted-foreground">
                  {platform.disclosureStep}
                  {platform.distributionNote ? ` ${platform.distributionNote}` : null}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Audio files</dt>
                <dd className="mt-1">
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {audioRequirements(platform).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-medium">Cover</dt>
                <dd className="mt-1 text-muted-foreground">{coverRequirement(platform)}</dd>
              </div>
              <div>
                <dt className="font-medium">Required details</dt>
                <dd className="mt-1 text-muted-foreground">{metadataRequirements(platform)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Checked {platform.lastChecked}. Sources:{" "}
              {platform.sources.map((source, index) => (
                <span key={source.url}>
                  {index > 0 ? ", " : null}
                  <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                    {source.label}
                  </a>
                </span>
              ))}
              .
            </p>
          </section>
        );
      })}

      <section className="mt-14 rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-2xl">Check your book before you upload</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every Audiobooker project has a publish checklist for each store: metadata, cover size,
          chapter length, and the disclosure text, with a link to fix each item.
        </p>
        <Link
          href={signedIn ? "/studio" : "/signup"}
          className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {signedIn ? "Open Studio" : "Create a free account"}
        </Link>
      </section>
    </main>
  );
}
