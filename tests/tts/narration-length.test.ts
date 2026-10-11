import { describe, expect, it } from "vitest";
import { formatSpokenMinutes } from "@/lib/tts/narration-length";

describe("formatSpokenMinutes", () => {
  it("estimates narration length at 150 words per minute", () => {
    expect(formatSpokenMinutes(0)).toBe("0 min");
    expect(formatSpokenMinutes(80)).toBe("< 1 min");
    expect(formatSpokenMinutes(150)).toBe("1 min");
    expect(formatSpokenMinutes(1_200)).toBe("8 min");
  });
});
