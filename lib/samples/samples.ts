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
  {
    id: "the-art-of-war",
    title: "The Art of War",
    author: "Sun Tzu",
    format: "PDF",
    sourceName: "Standard Ebooks",
    sourceUrl: "https://standardebooks.org/ebooks/sun-tzu/the-art-of-war/lionel-giles",
    license: "Public domain (Lionel Giles translation), CC0 edition",
    language: "en",
    voice: "Ava, English (US), 1.0x",
    audioSrc: "/samples/the-art-of-war.mp3",
    clipLabel: "Chapter I, Laying Plans, from 0:30",
    clipSeconds: 90,
    stats: { words: 10_445, chapters: 13, generationMinutes: 3.8, finishedSeconds: 3_681, exportMegabytes: 22.6 },
    note: "Printed the web edition to PDF in a browser, then generated only the 13 chapters, leaving out the translator's introduction and the endnotes.",
  },
  {
    id: "the-adventures-of-sherlock-holmes",
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    format: "TXT",
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/1661",
    license: "Public domain",
    language: "en",
    voice: "Andrew, English (US), 1.0x",
    audioSrc: "/samples/the-adventures-of-sherlock-holmes.mp3",
    clipLabel: "Chapter I, A Scandal in Bohemia, from 0:30",
    clipSeconds: 90,
    stats: { words: 104_318, chapters: 12, generationMinutes: 52.1, finishedSeconds: 33_156, exportMegabytes: 207.7 },
  },
];

const SOURCE_PHRASE: Record<ToolFormat, string> = {
  EPUB: "an EPUB",
  PDF: "a PDF file",
  TXT: "a TXT file",
};

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
    description: `Sample from an audiobook of ${sample.title} by ${sample.author}, made from ${SOURCE_PHRASE[sample.format]} with Audiobooker. Voice: ${sample.voice}.`,
    contentUrl: `${siteUrl}${sample.audioSrc}`,
    encodingFormat: "audio/mpeg",
    duration: isoDuration(sample.clipSeconds),
    inLanguage: sample.language,
    isBasedOn: { "@type": "Book", name: sample.title, author: sample.author, url: sample.sourceUrl },
  };
}
