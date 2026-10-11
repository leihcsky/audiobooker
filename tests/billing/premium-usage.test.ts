import { describe, expect, it } from "vitest";

import {
  billablePremiumSeconds,
  estimatedMinutes,
  estimatePremiumSeconds,
  remainingMinutes,
} from "@/lib/billing/premium-usage";

describe("estimatePremiumSeconds", () => {
  it("reserves conservatively for Latin-script text", () => {
    expect(estimatePremiumSeconds({ characters: 12_500, languageCode: "en-US" })).toBe(1000);
  });

  it("uses a slower rate for Chinese, Japanese and Korean", () => {
    expect(estimatePremiumSeconds({ characters: 400, languageCode: "zh-CN" })).toBe(100);
    expect(estimatePremiumSeconds({ characters: 400, languageCode: "ja-JP" })).toBe(100);
  });

  it("returns zero for empty text and rounds partial seconds up", () => {
    expect(estimatePremiumSeconds({ characters: 0 })).toBe(0);
    expect(estimatePremiumSeconds({ characters: 1 })).toBe(1);
  });
});

describe("billablePremiumSeconds", () => {
  it("charges the full duration when nothing was cached", () => {
    expect(
      billablePremiumSeconds({ durationSeconds: 90.2, speed: 1, characters: 1000, billableCharacters: 1000 }),
    ).toBe(91);
  });

  it("counts minutes at normal speed", () => {
    expect(
      billablePremiumSeconds({ durationSeconds: 50, speed: 2, characters: 1000, billableCharacters: 1000 }),
    ).toBe(100);
    expect(
      billablePremiumSeconds({ durationSeconds: 200, speed: 0.5, characters: 1000, billableCharacters: 1000 }),
    ).toBe(100);
  });

  it("charges only the share sent to the provider", () => {
    expect(
      billablePremiumSeconds({ durationSeconds: 100, speed: 1, characters: 1000, billableCharacters: 250 }),
    ).toBe(25);
  });

  it("charges nothing for fully cached audio", () => {
    expect(
      billablePremiumSeconds({ durationSeconds: 100, speed: 1, characters: 1000, billableCharacters: 0 }),
    ).toBe(0);
  });
});

describe("minute display helpers", () => {
  it("never overstates what is left", () => {
    expect(remainingMinutes(119)).toBe(1);
    expect(remainingMinutes(-5)).toBe(0);
  });

  it("never understates what a job needs", () => {
    expect(estimatedMinutes(61)).toBe(2);
    expect(estimatedMinutes(1)).toBe(1);
    expect(estimatedMinutes(0)).toBe(0);
  });
});
