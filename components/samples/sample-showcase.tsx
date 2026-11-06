import Link from "next/link";
import { serializeJsonLd } from "@/lib/tools/seo-page";
import { getSiteUrl } from "@/lib/tools/site";
import { sampleJsonLd, type AudiobookSample } from "@/lib/samples/samples";
import { formatSpokenLength } from "@/lib/tts/narration-length";

type SampleShowcaseProps = {
  samples: readonly AudiobookSample[];
  heading?: string;
  showAllLink?: boolean;
};

export function SampleShowcase({ samples, heading = "Hear a sample", showAllLink = false }: SampleShowcaseProps) {
  if (samples.length === 0) {
    return null;
  }
  const siteUrl = getSiteUrl();
  return (
    <section className="mt-12">
      {samples.map((sample) => (
        <script
          key={`ld-${sample.id}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(sampleJsonLd(sample, siteUrl)) }}
        />
      ))}
      <h2 className="font-serif text-2xl">{heading}</h2>
      <div className="mt-4 grid gap-6">
        {samples.map((sample) => (
          <SampleCard key={sample.id} sample={sample} />
        ))}
      </div>
      {showAllLink ? (
        <p className="mt-4 text-sm">
          <Link href="/samples" className="underline">
            All audiobook samples
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function SampleCard({ sample }: { sample: AudiobookSample }) {
  const facts: { term: string; value: string }[] = [
    { term: "Source", value: `${sample.format}, ${sample.stats.words.toLocaleString("en-US")} words` },
    { term: "Chapters", value: String(sample.stats.chapters) },
    { term: "Audiobook length", value: formatSpokenLength(sample.stats.finishedSeconds) },
    { term: "Generation time", value: `${sample.stats.generationMinutes} min` },
    { term: "M4B size", value: `${sample.stats.exportMegabytes} MB` },
    { term: "Voice", value: sample.voice },
  ];
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- static sample asset */}
        <img
          src={sample.coverSrc}
          alt={`Cover of ${sample.title}`}
          width={128}
          height={192}
          className="mx-auto h-44 w-28 shrink-0 rounded-md border border-border object-cover shadow-sm sm:mx-0"
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h3 className="font-serif text-xl leading-tight tracking-tight">
              {sample.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">by {sample.author}</p>
            <p className="mt-2 text-sm">{sample.clipLabel}</p>
          </div>
          <audio
            controls
            controlsList="nodownload"
            preload="none"
            src={sample.audioSrc}
            className="w-full"
          >
            Your browser does not support audio playback.
          </audio>
          <ul className="flex flex-wrap gap-2">
            <FactPill label={`${sample.format} source`} />
            <FactPill label={`${sample.stats.chapters} chapters`} />
            <FactPill label={formatSpokenLength(sample.stats.finishedSeconds)} />
            <FactPill label={sample.voice.split(",")[0] ?? sample.voice} />
          </ul>
        </div>
      </div>
      <div className="border-t border-border bg-muted/30 px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.term}>
              <dt className="text-muted-foreground">{fact.term}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        {sample.note ? <p className="mt-3 text-sm text-muted-foreground">{sample.note}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Source text:{" "}
          <a href={sample.sourceUrl} className="underline" rel="noopener" target="_blank">
            {sample.sourceName}
          </a>{" "}
          ({sample.license})
        </p>
      </div>
    </article>
  );
}

function FactPill({ label }: { label: string }) {
  return (
    <li className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
      {label}
    </li>
  );
}
