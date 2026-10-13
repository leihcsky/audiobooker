import { describe, expect, it } from "vitest";
import {
  estimateNarrationSeconds,
  formatSpokenLength,
  formatSpokenMinutes,
} from "@/lib/tts/narration-length";

describe("formatSpokenMinutes", () => {
  it("estimates narration length at 150 words per minute", () => {
    expect(formatSpokenMinutes(0)).toBe("0 min");
    expect(formatSpokenMinutes(80)).toBe("< 1 min");
    expect(formatSpokenMinutes(150)).toBe("1 min");
    expect(formatSpokenMinutes(1_200)).toBe("8 min");
  });
});

describe("formatSpokenLength", () => {
  it("switches to hours for long books", () => {
    expect(formatSpokenLength(59 * 60)).toBe("59 min");
    expect(formatSpokenLength(60 * 60)).toBe("1 h");
    expect(formatSpokenLength(200 * 60)).toBe("3 h 20 min");
  });
});

describe("estimateNarrationSeconds", () => {
  it("counts words for space-separated languages", () => {
    expect(estimateNarrationSeconds("word ".repeat(150))).toBe(60);
    expect(estimateNarrationSeconds("Hello — world ***")).toBe(1);
  });

  it("counts characters for Chinese, which has no spaces between words", () => {
    expect(estimateNarrationSeconds("我".repeat(270))).toBe(60);
    expect(estimateNarrationSeconds("第一章。我在重庆。")).toBe(Math.round(7 / 4.5));
  });

  it("handles mixed text", () => {
    expect(estimateNarrationSeconds(`${"我".repeat(9)} ${"word ".repeat(5)}`)).toBe(Math.round(2 + 2));
  });
});
