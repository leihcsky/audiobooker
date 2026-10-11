import { describe, expect, it } from "vitest";

import { MINUTE_PACKS, minutePackPrice } from "@/lib/billing/credit-packs";
import { PLANS } from "@/lib/billing/plans";

/** About $0.09 per minute of English HD narration, plus payment fees and a ~25% margin. */
const MIN_PRICE_PER_MINUTE_USD = 0.13;

describe("minute packs", () => {
  it("charges Creator the discounted price", () => {
    const book = MINUTE_PACKS.find((pack) => pack.id === "book");
    expect(book).toBeDefined();
    expect(minutePackPrice(book!, PLANS.free)).toBe(99);
    expect(minutePackPrice(book!, PLANS.creator)).toBe(84);
  });

  it("never prices a minute below provider cost plus fees", () => {
    for (const pack of MINUTE_PACKS) {
      expect(pack.creatorPriceUsd).toBeLessThan(pack.priceUsd);
      expect(pack.creatorPriceUsd / pack.minutes).toBeGreaterThanOrEqual(MIN_PRICE_PER_MINUTE_USD);
    }
  });

  it("gets cheaper per minute as packs get bigger", () => {
    const perMinute = MINUTE_PACKS.map((pack) => pack.priceUsd / pack.minutes);
    expect([...perMinute].sort((a, b) => b - a)).toEqual(perMinute);
  });
});
