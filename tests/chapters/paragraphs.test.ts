import { describe, expect, it } from "vitest";
import { hasSpeakableText, replaceParagraph, splitParagraphs } from "@/lib/chapters/paragraphs";

describe("splitParagraphs", () => {
  it("splits on blank lines, trims, and drops empty parts", () => {
    expect(splitParagraphs("  One\r\nline two\r\n\r\n\r\n  Two  \n \nThree ")).toEqual([
      "One\nline two",
      "Two",
      "Three",
    ]);
    expect(splitParagraphs("   ")).toEqual([]);
  });
});

describe("hasSpeakableText", () => {
  it("is false for separators", () => {
    expect(hasSpeakableText("* * *")).toBe(false);
    expect(hasSpeakableText("—")).toBe(false);
    expect(hasSpeakableText("第一章")).toBe(true);
    expect(hasSpeakableText("1.")).toBe(true);
  });
});

describe("replaceParagraph", () => {
  it("replaces one paragraph and normalizes the rest", () => {
    expect(replaceParagraph("A\n\n\nB\n\nC", 1, " New B\r\n")).toBe("A\n\nNew B\n\nC");
  });

  it("rejects an index out of range", () => {
    expect(() => replaceParagraph("A", 1, "x")).toThrow(RangeError);
  });
});
