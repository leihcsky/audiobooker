import { bookCostComparison, freeAllowanceFacts, pricingFaq } from "@/lib/billing/pricing-facts";
import { MINUTE_PACKS } from "@/lib/billing/credit-packs";
import { PLANS } from "@/lib/billing/plans";
import { LEGAL_CONTACT_EMAIL, LEGAL_LINKS, PRICE_TAX_NOTE } from "@/lib/legal";
import { AUDIOBOOK_SAMPLES, type AudiobookSample } from "@/lib/samples/samples";
import { SEO_TOOLS, STANDARD_VOICE_LANGUAGES, seoToolName } from "@/lib/tools/tool-config";
import { formatSpokenLength } from "@/lib/tts/narration-length";

/** Plain-language site summary for AI assistants, following the llms.txt convention. */
export function buildLlmsTxt(siteUrl: string, samples: readonly AudiobookSample[] = AUDIOBOOK_SAMPLES): string {
  const bookCost = bookCostComparison();
  const lines: string[] = [
    "# Audiobooker",
    "",
    "> Audiobooker is an online audiobook production studio for independent authors and publishers. Upload an EPUB, PDF, or TXT manuscript, narrate it chapter by chapter with AI voices, fix and regenerate chapters, and export chapter MP3s or a single M4B audiobook ready for listening or publishing.",
    "",
    "Workflow: Create (import a manuscript) → Build (chapters and voice) → Edit (review and regenerate chapters) → Master (publish-ready audio with a quality report) → Publish (exports and store guidance).",
    "",
    "## Key facts",
    "",
    "- Inputs: DRM-free EPUB, text-based PDF, and TXT. Scanned PDFs and DRM-protected ebooks are not supported.",
    `- Voices: more than 30 standard AI voices in ${STANDARD_VOICE_LANGUAGES.join(", ")}, plus premium voices paid per minute.`,
    "- Output: chapter MP3 files or one M4B audiobook with chapter markers and cover art.",
    "- No voice cloning: only preset voices are offered.",
    "- Listening times below are estimates for English text at normal speed.",
    "",
    "## Free and paid plans",
    "",
    ...freeAllowanceFacts().map((fact) => `- ${fact.term}: ${fact.text}`),
    ...MINUTE_PACKS.map(
      (pack) =>
        `- ${pack.name} premium minute pack: ${pack.minutes} minutes for $${pack.priceUsd} ($${pack.creatorPriceUsd} on ${PLANS.creator.name}), one-time, never expires.`,
    ),
    `- ${PRICE_TAX_NOTE}`,
    "",
    `## What a ${bookCost.hours}-hour audiobook costs`,
    "",
    ...bookCost.rows.map((row) => `- ${row.option}: ${row.cost}. ${row.detail}`),
    "",
    "## Pricing questions",
    "",
    ...pricingFaq().map((item) => `- ${item.question} ${item.answer}`),
    "",
    "## Tools",
    "",
    ...SEO_TOOLS.map((tool) => `- [${seoToolName(tool)}](${siteUrl}/${tool.slug}): ${tool.description}`),
    `- [Publishing guide](${siteUrl}/publish-audiobook): Where AI-narrated audiobooks are accepted, how to disclose digital narration, and the audio, cover, and metadata each store requires.`,
    `- [Pricing](${siteUrl}/pricing): Plans, premium minute packs, and limits.`,
  ];

  if (samples.length > 0) {
    lines.push("", "## Samples", "", `- [All samples](${siteUrl}/samples)`);
    for (const sample of samples) {
      lines.push(
        `- ${sample.title} by ${sample.author} (${sample.format}, ${sample.stats.words.toLocaleString("en-US")} words, ${sample.stats.chapters} chapters): ${formatSpokenLength(sample.stats.finishedSeconds)} audiobook generated in ${sample.stats.generationMinutes} min, M4B ${sample.stats.exportMegabytes} MB. Clip: ${siteUrl}${sample.audioSrc}`,
      );
    }
  }

  lines.push(
    "",
    "## Company and policies",
    "",
    ...LEGAL_LINKS.map((link) => `- [${link.label}](${siteUrl}${link.href})`),
    `- Support: ${LEGAL_CONTACT_EMAIL}`,
    "",
  );
  return lines.join("\n");
}
