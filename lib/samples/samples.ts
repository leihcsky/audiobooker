import type { ToolFormat } from "@/lib/tools/tool-config";

/** Measured when the sample was produced, so pages can quote real numbers. */
export type SampleStats = {
  words: number;
  chapters: number;
  /** Wall-clock time from "Generate" to the last chapter finishing. */
  generationMinutes: number;
  /** Length of the whole finished audiobook. */
  finishedSeconds: number;
  /** Size of the exported M4B. */
  exportMegabytes: number;
};

export type AudiobookSample = {
  id: string;
  title: string;
  author: string;
  format: ToolFormat;
  sourceName: string;
  sourceUrl: string;
  license: string;
  /** BCP 47 tag, e.g. "en". */
  language: string;
  voice: string;
  /** Short clip served from public/samples/, e.g. "/samples/pride-and-prejudice.mp3". */
  audioSrc: string;
  clipLabel: string;
  clipSeconds: number;
  stats: SampleStats;
  note?: string;
};

/** Real books produced end to end with the free tool or Studio. Add entries as clips are recorded. */
export const AUDIOBOOK_SAMPLES: readonly AudiobookSample[] = [
  {
    id: "pride-and-prejudice",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    format: "EPUB",
    sourceName: "Standard Ebooks",
    sourceUrl: "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice",
    license: "Public domain, CC0 edition",
    language: "en",
    voice: "Ava, English (US), 1.0x",
    audioSrc: "/samples/pride-and-prejudice.mp3",
    clipLabel: "Chapter 1, from 0:30",
    clipSeconds: 90,
    stats: { words: 122_027, chapters: 61, generationMinutes: 38, finishedSeconds: 41_822, exportMegabytes: 256.6 },
    note: "Removed the colophon and other back matter before generating.",
  },
];

export function samplesForFormats(
  formats: readonly ToolFormat[],
  samples: readonly AudiobookSample[] = AUDIOBOOK_SAMPLES,
): AudiobookSample[] {
  return samples.filter((sample) => formats.includes(sample.format));
}

export function hasSamples(samples: readonly AudiobookSample[] = AUDIOBOOK_SAMPLES): boolean {
  return samples.length > 0;
}

export function isoDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${rest || total === 0 ? `${rest}S` : ""}`;
}

export function sampleJsonLd(sample: AudiobookSample, siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "AudioObject",
    name: `${sample.title} — ${sample.clipLabel}`,
    description: `Sample from an audiobook of ${sample.title} by ${sample.author}, made from an ${sample.format === "EPUB" ? "EPUB" : `${sample.format} file`} with Audiobooker. Voice: ${sample.voice}.`,
    contentUrl: `${siteUrl}${sample.audioSrc}`,
    encodingFormat: "audio/mpeg",
    duration: isoDuration(sample.clipSeconds),
    inLanguage: sample.language,
    isBasedOn: { "@type": "Book", name: sample.title, author: sample.author, url: sample.sourceUrl },
  };
}
