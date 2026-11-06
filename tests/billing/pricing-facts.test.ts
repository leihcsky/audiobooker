import { describe, expect, it } from "vitest";
import {
  approxListeningHours,
  formatApproxListening,
  freeTrialListening,
  planStandardListening,
} from "@/lib/billing/allowance-copy";
import { MINUTE_PACKS } from "@/lib/billing/credit-packs";
import { PLANS } from "@/lib/billing/plans";
import {
  bookCostComparison,
  freeAllowanceFacts,
  planFeatureComparison,
  pricingFaq,
  pricingJsonLd,
} from "@/lib/billing/pricing-facts";
import { VOICE_COMPARISON_SAMPLE } from "@/lib/billing/voice-comparison";

describe("allowance copy", () => {
  it("rounds listening time down so the copy never overpromises", () => {
    expect(approxListeningHours(100_000)).toBe(1.5);
    expect(approxListeningHours(2_000_000)).toBe(35);
    expect(approxListeningHours(10_000_000)).toBe(185);
  });

  it("formats short budgets in minutes and long ones in hours", () => {
    expect(formatApproxListening(20_000)).toBe("about 20 minutes");
    expect(formatApproxListening(60_000)).toBe("about 1 hour");
    expect(formatApproxListening(100_000)).toBe("about 1.5 hours");
  });

  it("derives the published numbers from configuration", () => {
    expect(freeTrialListening()).toBe("about 1.5 hours");
    expect(planStandardListening(PLANS.free)).toBe("about 15 hours");
  });

  it("lets a free account finish one full-length book a month", () => {
    expect(approxListeningHours(PLANS.free.standardMonthlySoftCharacters)).toBeGreaterThanOrEqual(10);
    expect(approxListeningHours(PLANS.free.standardMonthlyHardCharacters)).toBeLessThan(
      approxListeningHours(PLANS.creator.standardMonthlySoftCharacters),
    );
  });
});

describe("book cost comparison", () => {
  it("prices a book sized to the Book pack against human narration", () => {
    const { hours, rows } = bookCostComparison();
    expect(hours).toBe(10);
    expect(rows.map((row) => row.cost)).toEqual(["$2,000–$4,000", "$93.99", "$99", "from $2.99"]);
  });
});

describe("pricing facts", () => {
  const copy = [
    ...freeAllowanceFacts().map((fact) => `${fact.term} ${fact.text}`),
    ...pricingFaq().map((item) => `${item.question} ${item.answer}`),
  ].join("\n");

  it("never promises unlimited use or shows character quotas", () => {
    expect(copy).not.toMatch(/unlimited/i);
    // "character dialogue" is allowed; billing must not quote raw character caps.
    expect(copy).not.toMatch(/\d[\d,]*\s*characters?\b/i);
  });

  it("states retention, file limits, and refunds", () => {
    expect(copy).toContain("Each export download link works for 7 days");
    expect(copy).toContain("deleted after 3 days");
    expect(copy).toContain("EPUB up to 50 MB");
    expect(copy).toContain("refunded within 7 days");
  });

  it("explains Standard vs Premium and pay per book", () => {
    expect(copy).toMatch(/difference between Standard Voice and Premium Voice/i);
    expect(copy).toMatch(/complete audiobook with the Free plan/i);
    expect(copy).toMatch(/subscription to use Premium Voice/i);
    expect(copy).toContain("Pay-per-Book");
    expect(copy).toMatch(/rounded up to the next \d+ minutes/i);
  });

  it("keeps Creator Standard allowance above Free (no 30-hour cut)", () => {
    expect(approxListeningHours(PLANS.creator.standardMonthlySoftCharacters)).toBe(185);
    expect(planStandardListening(PLANS.creator)).toBe("about 185 hours");
  });

  it("lists every plan and pack price in structured data", () => {
    const [app, faq] = pricingJsonLd("https://audiobooker.org");
    const offers = app.offers as { name: string; price: string }[];
    expect(offers.map((offer) => offer.price)).toEqual([
      "0",
      PLANS.creator.monthlyPriceUsd.toFixed(2),
      ...MINUTE_PACKS.map((pack) => pack.priceUsd.toFixed(2)),
    ]);
    expect((faq.mainEntity as unknown[]).length).toBe(pricingFaq().length);
  });

  it("builds a Free vs Creator feature table from live plan numbers", () => {
    const rows = planFeatureComparison();
    expect(rows.find((row) => row.label === "Saved projects")).toEqual({
      label: "Saved projects",
      free: String(PLANS.free.maxProjects),
      creator: String(PLANS.creator.maxProjects),
    });
    expect(rows.find((row) => row.label === "Premium Minutes")?.creator).toContain("60");
  });

  it("wires matching Standard and Premium comparison clips", () => {
    expect(VOICE_COMPARISON_SAMPLE).not.toBeNull();
    expect(VOICE_COMPARISON_SAMPLE?.standard.src).toBe("/samples/voice-compare-standard.mp3");
    expect(VOICE_COMPARISON_SAMPLE?.premium.src).toBe("/samples/voice-compare-premium.mp3");
    expect(VOICE_COMPARISON_SAMPLE?.scriptLabel).toMatch(/Pride and Prejudice/i);
  });
});
