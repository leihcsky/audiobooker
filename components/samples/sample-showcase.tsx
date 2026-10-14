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
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-medium">
        {sample.title} <span className="font-normal text-muted-foreground">by {sample.author}</span>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{sample.clipLabel}</p>
      <audio controls preload="none" src={sample.audioSrc} className="mt-4 w-full">
        <a href={sample.audioSrc}>Download the sample</a>
      </audio>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.term}>
            <dt className="text-muted-foreground">{fact.term}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {sample.note ? <p className="mt-4 text-sm text-muted-foreground">{sample.note}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Source text:{" "}
        <a href={sample.sourceUrl} className="underline" rel="noopener" target="_blank">
          {sample.sourceName}
        </a>{" "}
        ({sample.license})
      </p>
    </article>
  );
}
