import { formatMegabytes, freeTrialListening, planStandardListening } from "@/lib/billing/allowance-copy";
import { MINUTE_PACKS } from "@/lib/billing/credit-packs";
import { PAY_PER_BOOK_CONFIG } from "@/lib/billing/pay-per-book-config";
import { PLANS } from "@/lib/billing/plans";
import { remainingMinutes } from "@/lib/billing/premium-usage";
import { FILE_LIMITS } from "@/lib/config/limits";
import { REFUND_WINDOW_DAYS } from "@/lib/legal";
import { STANDARD_VOICE_LANGUAGES } from "@/lib/tools/tool-config";

export type PricingFaqItem = { question: string; answer: string };
export type FreeAllowanceFact = { term: string; text: string };
export type BookCostRow = { option: string; cost: string; detail: string };

/** Commonly quoted per-finished-hour rates for professional human narration. */
export const HUMAN_NARRATION_USD_PER_FINISHED_HOUR = { low: 200, high: 400 } as const;

/** What one full-length book costs to narrate, sized to the Book minute pack. */
export function bookCostComparison(): { hours: number; rows: BookCostRow[] } {
  const pack = MINUTE_PACKS.find((item) => item.id === "book") ?? MINUTE_PACKS[0];
  const hours = pack.minutes / 60;
  const creator = PLANS.creator;
  const human = HUMAN_NARRATION_USD_PER_FINISHED_HOUR;
  return {
    hours,
    rows: [
      {
        option: "Professional human narrator",
        cost: `$${(human.low * hours).toLocaleString("en-US")}–$${(human.high * hours).toLocaleString("en-US")}`,
        detail: `Often $${human.low}–$${human.high} per finished hour, plus weeks of scheduling and studio time.`,
      },
      {
        option: `Audiobooker premium voice on ${creator.name}`,
        cost: `$${(pack.creatorPriceUsd + creator.monthlyPriceUsd).toFixed(2)}`,
        detail: `${pack.name} pack ($${pack.creatorPriceUsd}) plus one month of ${creator.name} ($${creator.monthlyPriceUsd}) for mastering, the quality report, and pronunciation fixes.`,
      },
      {
        option: "Audiobooker premium voice, pack only",
        cost: `$${pack.priceUsd}`,
        detail: `${pack.name} pack of ${pack.minutes} premium minutes on a free account. Minutes never expire.`,
      },
      {
        option: "Audiobooker Pay per book",
        cost: `from $${PAY_PER_BOOK_CONFIG.minimumOrderAmount.toFixed(2)}`,
        detail: `Pay once for the chapters you choose at $${PAY_PER_BOOK_CONFIG.pricePerMinute.toFixed(2)} per minute, with listening time rounded up to the next ${PAY_PER_BOOK_CONFIG.billingIncrementMinutes} minutes before billing. No subscription and no minute balance required.`,
      },
    ],
  };
}

/** Short facts reused on /pricing and /studio/billing. */
export function payPerBookFacts(): {
  title: string;
  summary: string;
  points: string[];
} {
  const cfg = PAY_PER_BOOK_CONFIG;
  const step = cfg.billingIncrementMinutes;
  return {
    title: "Pay per book",
    summary:
      "Prefer not to subscribe or buy a minute pack? Choose a Premium voice in a project and pay once for the chapters you select.",
    points: [
      `From $${cfg.minimumOrderAmount.toFixed(2)}, then $${cfg.pricePerMinute.toFixed(2)} per minute of listening time`,
      `Listening time is rounded up to the next ${step} minutes before billing (for example, 27 minutes bills as ${Math.ceil(27 / step) * step} minutes)`,
      "Works on Free and Creator accounts",
      "Does not use or grant Premium Minutes",
      "Price is calculated in Studio after you pick chapters and a Premium voice",
    ],
  };
}

function days(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

/** The free tiers, stated the same way on tool pages, the pricing page, and /llms.txt. */
export function freeAllowanceFacts(): FreeAllowanceFact[] {
  return [
    {
      term: "Without an account",
      text: `${capitalize(freeTrialListening())} of narration per session with standard voices, files up to ${formatMegabytes(FILE_LIMITS.MAX_ANONYMOUS_FILE_SIZE)}, MP3 and M4B download. The temporary project is kept for ${days(FILE_LIMITS.ANONYMOUS_PROJECT_TTL_DAYS)} unless you save it.`,
    },
    {
      term: "Free account",
      text: `${capitalize(planStandardListening(PLANS.free))} of standard-voice narration a month (fair use), ${PLANS.free.maxProjects} saved projects, chapter editing and regeneration in Studio.`,
    },
    {
      term: `${PLANS.creator.name}, $${PLANS.creator.monthlyPriceUsd}/month`,
      text: `${capitalize(planStandardListening(PLANS.creator))} of standard-voice narration a month (fair use), ${remainingMinutes(PLANS.creator.premiumSecondsPerPeriod)} premium-voice minutes, ${PLANS.creator.maxProjects} projects, and publish-ready mastering.`,
    },
  ];
}

export function pricingFaq(): PricingFaqItem[] {
  const packs = MINUTE_PACKS.map(
    (pack) => `${pack.name} ${pack.minutes} min $${pack.priceUsd} ($${pack.creatorPriceUsd} on ${PLANS.creator.name})`,
  ).join(", ");
  const ppb = PAY_PER_BOOK_CONFIG;
  const exampleListeningMinutes = 27;
  const exampleBillableMinutes =
    Math.ceil(exampleListeningMinutes / ppb.billingIncrementMinutes) * ppb.billingIncrementMinutes;
  const exampleAmount = (exampleBillableMinutes * ppb.pricePerMinute).toFixed(2);
  return [
    {
      question: "How much can I narrate for free?",
      answer: `Without an account, one session narrates ${freeTrialListening()} of audio with standard voices. A free account includes ${planStandardListening(PLANS.free)} of standard-voice narration a month under fair use. These are estimates for English text at normal speed.`,
    },
    {
      question: "What are premium minutes?",
      answer: `Premium voices are paid per minute of finished audio. ${PLANS.creator.name} includes ${remainingMinutes(PLANS.creator.premiumSecondsPerPeriod)} minutes each billing period, and unused minutes roll over one period. One-time packs: ${packs}. Purchased minutes never expire.`,
    },
    {
      question: "Can I pay for just one book instead of buying minutes?",
      answer: `Yes. Pay per book lets you choose chapters, pick a Premium voice, and pay a one-time price for that selection—starting at $${ppb.minimumOrderAmount.toFixed(2)}, then $${ppb.pricePerMinute.toFixed(2)} per minute. Listening time is rounded up to the next ${ppb.billingIncrementMinutes} minutes before billing (for example, about ${exampleListeningMinutes} minutes bills as ${exampleBillableMinutes} minutes × $${ppb.pricePerMinute.toFixed(2)} = $${exampleAmount}). It works without a subscription and does not use Premium Minutes. Open a project in Studio, choose a Premium voice, and follow the quote shown there.`,
    },
    {
      question: "What files can I upload, and how large?",
      answer: `DRM-free EPUB up to ${formatMegabytes(FILE_LIMITS.MAX_EPUB_SIZE)}, text-based PDF up to ${formatMegabytes(FILE_LIMITS.MAX_PDF_SIZE)}, and TXT up to ${formatMegabytes(FILE_LIMITS.MAX_TXT_SIZE)}. Without an account the limit is ${formatMegabytes(FILE_LIMITS.MAX_ANONYMOUS_FILE_SIZE)}. Scanned PDFs without a text layer can't be narrated.`,
    },
    {
      question: "Which languages and formats are supported?",
      answer: `Standard voices read ${STANDARD_VOICE_LANGUAGES.join(", ")}. You can download chapter MP3s or a single M4B audiobook with chapter markers and cover art.`,
    },
    {
      question: "How long are my files kept?",
      answer: `Projects in your account stay until you delete them. Each export download link works for ${days(FILE_LIMITS.EXPORT_RETENTION_DAYS)}, and you can export again at any time. Temporary projects made without an account are deleted after ${days(FILE_LIMITS.ANONYMOUS_PROJECT_TTL_DAYS)} unless you save them to an account.`,
    },
    {
      question: "Can I sell or publish the audiobooks I make?",
      answer: "You keep your rights to the text you upload and to the audio produced from it, on every plan. Only convert books you have the right to use, and follow each store's rules, including disclosure of AI narration where required.",
    },
    {
      question: "Can I cancel or get a refund?",
      answer: `You can cancel ${PLANS.creator.name} at any time and keep it until the end of the paid period. Unused minute packs can be refunded within ${days(REFUND_WINDOW_DAYS)} of purchase.`,
    },
  ];
}

export function pricingJsonLd(siteUrl: string): Record<string, unknown>[] {
  const url = `${siteUrl}/pricing`;
  const creator = PLANS.creator;
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Audiobooker",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: siteUrl,
      offers: [
        {
          "@type": "Offer",
          name: PLANS.free.name,
          price: "0",
          priceCurrency: "USD",
          url,
        },
        {
          "@type": "Offer",
          name: creator.name,
          price: creator.monthlyPriceUsd.toFixed(2),
          priceCurrency: "USD",
          url,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: creator.monthlyPriceUsd.toFixed(2),
            priceCurrency: "USD",
            billingDuration: "P1M",
            unitText: "month",
          },
        },
        ...MINUTE_PACKS.map((pack) => ({
          "@type": "Offer",
          name: `${pack.name} premium minute pack (${pack.minutes} minutes)`,
          price: pack.priceUsd.toFixed(2),
          priceCurrency: "USD",
          url,
        })),
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: pricingFaq().map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
