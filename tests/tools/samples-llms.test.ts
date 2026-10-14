import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  AUDIOBOOK_SAMPLES,
  isoDuration,
  sampleJsonLd,
  samplesForFormats,
  type AudiobookSample,
} from "@/lib/samples/samples";
import { buildLlmsTxt } from "@/lib/tools/llms-txt";

const SITE = "https://audiobooker.org";

const FIXTURE: AudiobookSample = {
  id: "pride-and-prejudice",
  title: "Pride and Prejudice",
  author: "Jane Austen",
  format: "EPUB",
  sourceName: "Project Gutenberg",
  sourceUrl: "https://www.gutenberg.org/ebooks/1342",
  license: "Public domain in the USA",
  language: "en",
  voice: "Ava",
  audioSrc: "/samples/pride-and-prejudice.mp3",
  clipLabel: "Chapter 1, opening",
  clipSeconds: 95,
  stats: { words: 122_000, chapters: 61, generationMinutes: 42, finishedSeconds: 49_000, exportMegabytes: 410 },
};

describe("audiobook samples", () => {
  it("only lists clips that exist under public/samples", () => {
    const ids = new Set<string>();
    for (const sample of AUDIOBOOK_SAMPLES) {
      expect(ids.has(sample.id)).toBe(false);
      ids.add(sample.id);
      expect(sample.audioSrc).toMatch(/^\/samples\/[a-z0-9-]+\.mp3$/);
      expect(existsSync(join(process.cwd(), "public", sample.audioSrc))).toBe(true);
      expect(sample.stats.words).toBeGreaterThan(0);
      expect(sample.stats.finishedSeconds).toBeGreaterThan(0);
    }
  });

  it("filters samples by the formats a tool page supports", () => {
    expect(samplesForFormats(["EPUB"], [FIXTURE])).toHaveLength(1);
    expect(samplesForFormats(["PDF"], [FIXTURE])).toHaveLength(0);
  });

  it("describes a sample as an AudioObject", () => {
    expect(isoDuration(95)).toBe("PT1M35S");
    expect(isoDuration(3600)).toBe("PT1H");
    const ld = sampleJsonLd(FIXTURE, SITE);
    expect(ld["@type"]).toBe("AudioObject");
    expect(ld.contentUrl).toBe(`${SITE}/samples/pride-and-prejudice.mp3`);
  });

  it("keeps the samples page out of the sitemap until samples exist", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/samples"))).toBe(AUDIOBOOK_SAMPLES.length > 0);
  });
});

describe("llms.txt", () => {
  it("summarises the product, prices, pages, and policies", () => {
    const text = buildLlmsTxt(SITE, []);
    expect(text.startsWith("# Audiobooker\n")).toBe(true);
    expect(text).toContain("$9.99/month");
    expect(text).toContain(`${SITE}/pricing`);
    expect(text).toContain(`${SITE}/epub-to-audiobook`);
    expect(text).toContain(`${SITE}/acceptable-use`);
    expect(text).not.toMatch(/unlimited/i);
    expect(text).not.toContain("## Samples");
  });

  it("lists samples with their measured numbers once they exist", () => {
    const text = buildLlmsTxt(SITE, [FIXTURE]);
    expect(text).toContain("## Samples");
    expect(text).toContain("122,000 words");
    expect(text).toContain(`${SITE}/samples/pride-and-prejudice.mp3`);
  });
});
