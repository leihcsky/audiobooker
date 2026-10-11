import { describe, expect, it } from "vitest";
import { countWords, htmlToText, normalizeText } from "@/lib/parser/normalize";

describe("text normalization", () => {
  it("strips tags and preserves paragraphs", () => {
    const text = htmlToText("<p>Hello&nbsp;world</p><p>Next line</p>");
    expect(text).toContain("Hello world");
    expect(text).toContain("Next line");
    expect(text).not.toContain("<p>");
  });

  it("collapses extra whitespace", () => {
    expect(normalizeText("A   B\n\n\nC")).toBe("A B\n\nC");
  });

  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  ")).toBe(0);
  });
});
