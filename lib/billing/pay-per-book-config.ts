function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readPositiveInt(name: string, fallback: number): number {
  return Math.max(1, Math.round(readPositiveNumber(name, fallback)));
}

/** Server-side Pay-per-Book pricing; override with env without code changes. */
export const PAY_PER_BOOK_CONFIG = {
  currency: "USD" as const,
  pricePerMinute: readPositiveNumber("PAY_PER_BOOK_PRICE_PER_MINUTE", 0.22),
  minimumOrderAmount: readPositiveNumber("PAY_PER_BOOK_MINIMUM_USD", 2.99),
  wordsPerMinute: readPositiveInt("PAY_PER_BOOK_WORDS_PER_MINUTE", 150),
  billingIncrementMinutes: readPositiveInt("PAY_PER_BOOK_BILLING_INCREMENT_MINUTES", 5),
  quoteTtlMinutes: readPositiveInt("PAY_PER_BOOK_QUOTE_TTL_MINUTES", 30),
  itemId: "pay_per_book" as const,
};

export type PayPerBookConfig = typeof PAY_PER_BOOK_CONFIG;
