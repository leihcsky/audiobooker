import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { SEO_TOOLS, STANDARD_VOICE_LANGUAGES, getSeoTool } from "@/lib/tools/tool-config";
import { seoToolJsonLd, seoToolMetadata, serializeJsonLd } from "@/lib/tools/seo-page";
import { EDGE_VOICES } from "@/lib/tts/voices";
import { SPOKEN_WORDS_PER_MINUTE } from "@/lib/tts/narration-length";

const REQUIRED_SLUGS = [
  "audiobook-maker",
  "epub-to-audiobook",
  "pdf-to-audiobook",
  "ebook-to-audiobook",
];

const REMOVED_SLUGS = ["audiobook-generator", "audiobook-creator", "audiobook-builder"];

describe("SEO tools", () => {
  it("defines unique H1s and copy for every public slug", () => {
    const slugs = SEO_TOOLS.map((tool) => tool.slug);
    const h1s = SEO_TOOLS.map((tool) => tool.h1);
    expect(slugs).toEqual(REQUIRED_SLUGS);
    expect(new Set(h1s).size).toBe(REQUIRED_SLUGS.length);
    expect(getSeoTool("audiobook-maker")?.supportedFormats).toEqual(["EPUB", "PDF", "TXT"]);
    expect(getSeoTool("epub-to-audiobook")?.supportedFormats).toEqual(["EPUB"]);
    expect(getSeoTool("pdf-to-audiobook")?.supportedFormats).toEqual(["PDF"]);
  });

  it("emits a canonical URL and sitemap entries for primary slugs", () => {
    const metadata = seoToolMetadata(getSeoTool("audiobook-maker")!);
    expect(metadata.alternates?.canonical).toMatch(/\/audiobook-maker$/);
    const urls = sitemap().map((entry) => entry.url);
    for (const slug of REQUIRED_SLUGS) {
      expect(urls.some((url) => url.endsWith(`/${slug}`))).toBe(true);
    }
    for (const slug of REMOVED_SLUGS) {
      expect(urls.some((url) => url.endsWith(`/${slug}`))).toBe(false);
    }
  });

  it.each([
    ["audiobook-maker", "Audiobook Maker"],
    ["epub-to-audiobook", "EPUB to Audiobook"],
    ["pdf-to-audiobook", "PDF to Audiobook"],
    ["ebook-to-audiobook", "Ebook to Audiobook"],
  ])("leads %s metadata with its core keyword", (slug, keyword) => {
    const tool = getSeoTool(slug)!;
    const metadata = seoToolMetadata(tool);
    expect(tool.title.startsWith(keyword)).toBe(true);
    expect(tool.title.length).toBeLessThanOrEqual(60);
    expect(tool.description.toLowerCase()).toContain(keyword.toLowerCase());
    expect(tool.description.length).toBeLessThanOrEqual(160);
    expect(tool.h1).toContain(keyword);
    expect(metadata.openGraph).toMatchObject({ siteName: "Audiobooker", type: "website" });
    expect(metadata.twitter).toMatchObject({ card: "summary", title: tool.title });
  });

  it.each([
    ["audiobook-maker", "Audiobook Maker"],
    ["epub-to-audiobook", "EPUB to Audiobook"],
    ["pdf-to-audiobook", "PDF to Audiobook"],
    ["ebook-to-audiobook", "Ebook to Audiobook"],
  ])("emits structured data that mirrors the visible %s page", (slug, name) => {
    const tool = getSeoTool(slug)!;
    const jsonLd = seoToolJsonLd(tool);
    expect(jsonLd.map((item) => item["@type"])).toEqual(["WebApplication", "FAQPage", "BreadcrumbList"]);
    const app = jsonLd[0];
    expect(app.name).toBe(name);
    expect(app.featureList).toEqual(tool.features);
    expect(app).not.toHaveProperty("aggregateRating");
    const faq = jsonLd[1].mainEntity as { name: string }[];
    expect(faq.map((item) => item.name)).toEqual(tool.faq.map((item) => item.question));
    const crumbs = jsonLd[2].itemListElement as { item: string }[];
    expect(crumbs.at(-1)?.item).toMatch(new RegExp(`/${slug}$`));
  });

  it("keeps page copy distinct across the tool cluster", () => {
    const headings = SEO_TOOLS.flatMap((tool) => [
      tool.howToTitle,
      ...(tool.sections ?? []).map((section) => section.heading),
    ]);
    const questions = SEO_TOOLS.flatMap((tool) => tool.faq.map((item) => item.question));
    expect(new Set(SEO_TOOLS.map((tool) => tool.title)).size).toBe(SEO_TOOLS.length);
    expect(new Set(SEO_TOOLS.map((tool) => tool.description)).size).toBe(SEO_TOOLS.length);
    expect(new Set(headings).size).toBe(headings.length);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("keeps the ebook listening-time table consistent with the narration estimate", () => {
    const section = getSeoTool("ebook-to-audiobook")!.sections!.find((item) =>
      item.heading.startsWith("How long"),
    )!;
    for (const [, length, time] of section.table!.rows) {
      const words = Number(length.replace(/\D/g, ""));
      const minutes = words / SPOKEN_WORDS_PER_MINUTE;
      const stated = Number(time.replace(/\D/g, "")) * (time.includes("hour") ? 60 : 1);
      expect(Math.abs(stated - minutes)).toBeLessThanOrEqual(30);
    }
  });

  it("escapes markup when serializing JSON-LD", () => {
    expect(serializeJsonLd({ text: "</script><b>" })).not.toContain("<");
  });

  it("backs the voice and language claims with the standard catalog", () => {
    expect(EDGE_VOICES.length).toBeGreaterThan(30);
    for (const language of STANDARD_VOICE_LANGUAGES) {
      expect(EDGE_VOICES.some((voice) => voice.languageName.startsWith(language))).toBe(true);
    }
  });

  it("lists pricing and company pages but not the auth pages in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const path of ["/pricing", "/about", "/contact"]) {
      expect(urls.some((url) => url.endsWith(path))).toBe(true);
    }
    expect(urls.some((url) => url.endsWith("/login") || url.endsWith("/signup"))).toBe(false);
  });

  it("keeps Studio out of robots indexing", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule?.disallow).toEqual(expect.arrayContaining(["/studio", "/api/"]));
  });
});
