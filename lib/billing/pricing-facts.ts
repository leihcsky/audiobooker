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
      "Pay once for the chapters you select with a Premium voice. Ideal when you want higher-quality narration for a single project without a subscription or minute balance.",
    points: [
      `From $${cfg.minimumOrderAmount.toFixed(2)}, then $${cfg.pricePerMinute.toFixed(2)} per minute of listening time`,
      `Listening time is rounded up to the next ${step} minutes before billing (for example, 27 minutes bills as ${Math.ceil(27 / step) * step} minutes)`,
      "One-time payment — no automatic renewal",
      "Works on Free and Creator accounts",
      "Does not use or grant Premium Minutes",
      "Already generated audio can be downloaded again for free",
      "Price is calculated in Studio after you pick chapters and a Premium voice",
    ],
  };
}

/** Plan feature rows for the full Free vs Creator comparison table. */
export function planFeatureComparison(): {
  label: string;
  free: string;
  creator: string;
}[] {
  const freeHours = planStandardListening(PLANS.free).replace(/^about /, "");
  const creatorHours = planStandardListening(PLANS.creator).replace(/^about /, "");
  const premium = remainingMinutes(PLANS.creator.premiumSecondsPerPeriod);
  return [
    { label: "Monthly price", free: "$0", creator: `$${PLANS.creator.monthlyPriceUsd}` },
    { label: "Saved projects", free: String(PLANS.free.maxProjects), creator: String(PLANS.creator.maxProjects) },
    {
      label: "Standard Voice",
      free: `${freeHours} / month (fair use)`,
      creator: `${creatorHours} / month (fair use)`,
    },
    { label: "Premium Minutes", free: "Buy as needed", creator: `${premium} included each billing period` },
    { label: "Premium Minutes rollover", free: "—", creator: "Unused minutes roll over one period" },
    { label: "Chapter editing & regeneration", free: "Yes", creator: "Yes" },
    { label: "MP3 / M4B export", free: "Yes", creator: "Yes" },
    { label: "Pronunciation dictionary", free: "—", creator: "Yes" },
    { label: "Paragraph-level regeneration", free: "—", creator: "Yes" },
    { label: "Publish-ready mastering & QC report", free: "—", creator: "Yes" },
    { label: "Minute pack pricing", free: "Standard", creator: "Creator discount" },
  ];
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
  const creatorPremium = remainingMinutes(PLANS.creator.premiumSecondsPerPeriod);
  return [
    {
      question: "What is the difference between Standard Voice and Premium Voice?",
      answer:
        "Standard Voice is designed for everyday audiobook creation and personal listening. Premium Voice provides more natural-sounding narration, richer expression, and a more engaging experience for storytelling and character dialogue.",
    },
    {
      question: "Can I create a complete audiobook with the Free plan?",
      answer: `Yes. The Free plan includes ${planStandardListening(PLANS.free)} of Standard Voice generation per month under fair use. You can convert supported ebooks, manage chapters, and export your completed audiobook. These are estimates for English text at normal speed.`,
    },
    {
      question: "How much can I narrate without an account?",
      answer: `Without an account, one session narrates ${freeTrialListening()} of audio with standard voices. Create a free account for monthly Standard Voice allowance, saved projects, and Premium Voice options.`,
    },
    {
      question: "Why should I upgrade to Creator?",
      answer: `Creator is for people who make audiobooks regularly. It includes ${PLANS.creator.maxProjects} projects, advanced editing, a pronunciation dictionary, paragraph-level fixes, publish-ready mastering with a quality report, and ${creatorPremium} Premium Minutes every billing period.`,
    },
    {
      question: "Are Premium Minutes included in Creator?",
      answer: `Yes. Creator includes ${creatorPremium} Premium Minutes per billing cycle. Eligible unused minutes can roll over for one additional billing cycle. Extra packs: ${packs}. Purchased minutes never expire.`,
    },
    {
      question: "Can Free users purchase Premium Voice?",
      answer:
        "Yes. Free users can buy Premium Minutes or use Pay-per-Book without subscribing to Creator. Premium Voices are paid separately from the Free plan's Standard Voice allowance.",
    },
    {
      question: "Do I need a subscription to use Premium Voice?",
      answer: `No. Pay-per-Book lets you choose chapters, pick a Premium voice, and pay once—starting at $${ppb.minimumOrderAmount.toFixed(2)}, then $${ppb.pricePerMinute.toFixed(2)} per minute. Listening time is rounded up to the next ${ppb.billingIncrementMinutes} minutes before billing (for example, about ${exampleListeningMinutes} minutes bills as ${exampleBillableMinutes} minutes × $${ppb.pricePerMinute.toFixed(2)} = $${exampleAmount}). It does not use Premium Minutes.`,
    },
    {
      question: "Do I have to pay again to download my audiobook?",
      answer: "No. Downloading audio that has already been generated is free. You can export again whenever you need a fresh link.",
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
      answer:
        "You keep your rights to the text you upload and to the audio produced from it, on every plan. Only convert books you have the right to use, and follow each store's rules, including disclosure of AI narration where required.",
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
