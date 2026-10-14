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
  pricingFaq,
  pricingJsonLd,
} from "@/lib/billing/pricing-facts";

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
    expect(rows.map((row) => row.cost)).toEqual(["$2,000–$4,000", "$93.99", "$99"]);
  });
});

describe("pricing facts", () => {
  const copy = [
    ...freeAllowanceFacts().map((fact) => `${fact.term} ${fact.text}`),
    ...pricingFaq().map((item) => `${item.question} ${item.answer}`),
  ].join("\n");

  it("never promises unlimited use or shows character counts", () => {
    expect(copy).not.toMatch(/unlimited/i);
    expect(copy).not.toMatch(/character/i);
  });

  it("states retention, file limits, and refunds", () => {
    expect(copy).toContain("Each export download link works for 7 days");
    expect(copy).toContain("deleted after 3 days");
    expect(copy).toContain("EPUB up to 50 MB");
    expect(copy).toContain("refunded within 7 days");
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
});
