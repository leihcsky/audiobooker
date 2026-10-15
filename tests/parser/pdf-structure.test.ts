import { describe, expect, it } from "vitest";
import { joinPdfLines, stripRunningLines, structurePdfLines } from "@/lib/parser/pdf-structure";

const LIMITS = { maxSections: 400, maxSectionChars: 150_000 };

const WORDS = ["river", "stone", "garden", "lantern", "harbor", "meadow", "thunder", "willow", "candle"];

/** A wrapped paragraph of roughly `words` words, 60-character lines, ending with a short last line. */
function paragraph(words: number, seed: string): string[] {
  const text = Array.from({ length: words }, (_, index) => `${seed}${WORDS[index % WORDS.length]}`).join(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    if (current && current.length + word.length + 1 > 60) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  lines.push(`${current} end.`);
  return lines;
}

describe("stripRunningLines", () => {
  it("removes headers, footers, and page numbers repeated across pages", () => {
    const pages = Array.from({ length: 5 }, (_, page) => [
      `2026/10/15 00:05 My Book`,
      ...paragraph(60, WORDS[page]),
      `https://example.com/book ${page + 1}/5`,
      String(page + 1),
    ]);
    const lines = stripRunningLines(pages).flat();
    expect(lines.some((line) => line.includes("My Book"))).toBe(false);
    expect(lines.some((line) => line.includes("example.com"))).toBe(false);
    expect(lines.some((line) => /^\d+$/.test(line))).toBe(false);
    expect(lines).toHaveLength(pages.reduce((total, page) => total + page.length - 3, 0));
  });
});

describe("joinPdfLines", () => {
  it("rebuilds paragraphs, rejoins hyphenated words, and drops footnote marks", () => {
    const text = joinPdfLines([
      "This is the first line of a paragraph that wraps onto the",
      "next line and keeps going until it reaches a copy-",
      "righted word and a footnote mark.12",
      "A new paragraph starts here after the short line above it.",
      "We met at 10:30 and paid $1,000 for it.",
    ]);
    const paragraphs = text.split("\n\n");
    expect(paragraphs[0]).toContain("onto the next line");
    expect(paragraphs[0]).toContain("copyrighted word");
    expect(paragraphs[0].endsWith("footnote mark.")).toBe(true);
    expect(text).toContain("10:30");
    expect(text).toContain("$1,000");
  });

  it("starts a paragraph at each numbered verse", () => {
    const text = joinPdfLines([
      "1. Sun Tzu said: The art of war is of vital importance to the",
      "State.",
      "2. It is a matter of life and death, a road either to safety or",
      "to ruin.",
    ]);
    expect(text.split("\n\n")).toHaveLength(2);
  });
});

describe("structurePdfLines", () => {
  it("finds chapters from the table of contents, including two-line headings", () => {
    const lines = [
      "Table of Contents",
      "Preface",
      "I: Laying Plans",
      "II: Waging War",
      "Back to ebook",
      "Preface",
      ...paragraph(120, "pre"),
      "I",
      "Laying Plans12",
      "1. Sun Tzu said: The art of war is of vital importance to the",
      "State.",
      ...paragraph(120, "one"),
      "II",
      "Waging War",
      ...paragraph(120, "two"),
    ];
    const sections = structurePdfLines(lines, LIMITS);
    expect(sections.map((section) => section.title)).toEqual(["Preface", "I: Laying Plans", "II: Waging War"]);
    expect(sections[1].content.startsWith("1. Sun Tzu said")).toBe(true);
    expect(sections.some((section) => section.content.includes("Table of Contents"))).toBe(false);
  });

  it("stops reading the table of contents where the body begins, even if body lines repeat", () => {
    const repeated = paragraph(120, "echo");
    const lines = [
      "Contents",
      "Preface",
      "Chapter One",
      "Preface",
      ...repeated,
      "Chapter One",
      ...repeated,
    ];
    const sections = structurePdfLines(lines, LIMITS);
    expect(sections.map((section) => section.title)).toEqual(["Preface", "Chapter One"]);
  });

  it("falls back to chapter headings when there is no table of contents", () => {
    const lines = [
      "Chapter 1",
      ...paragraph(400, "a"),
      "Chapter 2: The Road",
      ...paragraph(400, "b"),
      "Chapter 3",
      ...paragraph(400, "c"),
    ];
    const sections = structurePdfLines(lines, LIMITS);
    expect(sections.map((section) => section.title)).toEqual(["Chapter 1", "Chapter 2: The Road", "Chapter 3"]);
  });

  it("does not treat short numbered paragraphs as chapters", () => {
    const lines = Array.from({ length: 300 }, (_, index) => [
      `${index + 1}. A short numbered saying that fits on one line.`,
    ]).flat();
    const sections = structurePdfLines(lines, LIMITS);
    expect(sections).toHaveLength(1);
  });

  it("splits a section that is too long at paragraph boundaries", () => {
    const lines = Array.from({ length: 40 }, (_, index) => paragraph(80, `p${index}x`)).flat();
    const sections = structurePdfLines(lines, { maxSections: 400, maxSectionChars: 5_000 });
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every((section) => section.content.length <= 5_000)).toBe(true);
    expect(sections[0].title).toBe("Chapter 1 (part 1)");
  });
});
