import { PAY_PER_BOOK_CONFIG } from "@/lib/billing/pay-per-book-config";

export type PayPerBookPriceInput = {
  selectedWordCount: number;
  /**
   * Prefer the same listening-time estimate as chapter list UI
   * (`estimateNarrationSeconds`). Falls back to words / wordsPerMinute.
   */
  estimatedSeconds?: number;
  pricePerMinute?: number;
  minimumOrderAmount?: number;
  wordsPerMinute?: number;
  billingIncrementMinutes?: number;
};

export type PayPerBookPriceResult = {
  selectedWordCount: number;
  /** Whole minutes, rounded the same way chapter “about X min” is shown. */
  estimatedMinutes: number;
  /** Internal billing units (ceil to increment); do not show to customers. */
  billableMinutes: number;
  pricePerMinute: number;
  totalAmount: number;
  currency: "USD";
};

export function calculatePayPerBookPrice(input: PayPerBookPriceInput): PayPerBookPriceResult {
  const selectedWordCount = Math.max(0, Math.floor(input.selectedWordCount));
  const pricePerMinute = input.pricePerMinute ?? PAY_PER_BOOK_CONFIG.pricePerMinute;
  const minimumOrderAmount = input.minimumOrderAmount ?? PAY_PER_BOOK_CONFIG.minimumOrderAmount;
  const wordsPerMinute = input.wordsPerMinute ?? PAY_PER_BOOK_CONFIG.wordsPerMinute;
  const billingIncrementMinutes =
    input.billingIncrementMinutes ?? PAY_PER_BOOK_CONFIG.billingIncrementMinutes;

  if (selectedWordCount < 1 && !(input.estimatedSeconds && input.estimatedSeconds > 0)) {
    return {
      selectedWordCount: 0,
      estimatedMinutes: 0,
      billableMinutes: 0,
      pricePerMinute,
      totalAmount: 0,
      currency: "USD",
    };
  }

  const rawMinutes =
    input.estimatedSeconds != null && input.estimatedSeconds > 0
      ? input.estimatedSeconds / 60
      : selectedWordCount / wordsPerMinute;
  // Match formatSpokenLength: under 1 minute stays 0 for display; otherwise round to whole minutes.
  const estimatedMinutes =
    rawMinutes <= 0 ? 0 : rawMinutes < 1 ? 1 : Math.round(rawMinutes);
  const billableMinutes =
    Math.ceil(rawMinutes / billingIncrementMinutes) * billingIncrementMinutes;
  const calculated = roundMoney(billableMinutes * pricePerMinute);
  const totalAmount = Math.max(minimumOrderAmount, calculated);

  return {
    selectedWordCount,
    estimatedMinutes,
    billableMinutes,
    pricePerMinute,
    totalAmount: roundMoney(totalAmount),
    currency: "USD",
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
