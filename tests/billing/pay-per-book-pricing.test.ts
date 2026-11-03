import { describe, expect, it } from "vitest";
import { calculatePayPerBookPrice } from "@/lib/billing/pay-per-book-pricing";

describe("calculatePayPerBookPrice", () => {
  it("rejects empty selection with zero amount", () => {
    expect(calculatePayPerBookPrice({ selectedWordCount: 0 }).totalAmount).toBe(0);
  });

  it("applies the minimum order amount for short books", () => {
    // 2 minutes of speech → 5 billable minutes → $1.10 → floors to $2.99
    const price = calculatePayPerBookPrice({ selectedWordCount: 300 });
    expect(price.estimatedMinutes).toBe(2);
    expect(price.billableMinutes).toBe(5);
    expect(price.totalAmount).toBe(2.99);
  });

  it("rounds displayed estimate to whole minutes and bills in 5-minute steps", () => {
    const price = calculatePayPerBookPrice({
      selectedWordCount: 2000,
      estimatedSeconds: 12 * 60 + 20,
    });
    expect(price.estimatedMinutes).toBe(12);
    expect(price.billableMinutes).toBe(15);
    expect(price.totalAmount).toBe(3.3);
  });

  it("prices a full hour without the minimum bump", () => {
    const price = calculatePayPerBookPrice({
      selectedWordCount: 150 * 60,
      estimatedSeconds: 60 * 60,
    });
    expect(price.estimatedMinutes).toBe(60);
    expect(price.billableMinutes).toBe(60);
    expect(price.totalAmount).toBe(13.2);
  });
});
