import { describe, expect, it } from "vitest";
import { txtParser } from "@/lib/parser/txt";

const WORDS = ["river", "stone", "garden", "lantern", "harbor", "meadow", "thunder", "willow", "candle"];

/** A paragraph of `words` words, hard-wrapped at 70 characters like a Project Gutenberg file. */
function wrapped(words: number, seed = ""): string {
  const text = `${Array.from({ length: words }, (_, index) => `${seed}${WORDS[index % WORDS.length]}`).join(" ")}.`;
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    if (current && current.length + word.length + 1 > 70) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  lines.push(current);
  return lines.join("\n");
}

function parse(text: string) {
  return txtParser.parse({ filename: "book.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
}

describe("txt parser", () => {
  it("creates a single chapter when no structure exists", async () => {
    const parsed = await parse("Once upon a time there was a quiet forest and a long story.");

    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0]?.title).toBe("Chapter 1");
    expect(parsed.chapters[0]?.content).toContain("quiet forest");
  });

  it("detects chapter headings and rejoins hard-wrapped paragraphs", async () => {
    const parsed = await parse(
      ["Chapter 1", wrapped(60, "a"), wrapped(40, "b"), "Chapter 2", wrapped(60, "c")].join("\n\n"),
    );

    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(parsed.chapters[1]?.order).toBe(2);
    const paragraphs = parsed.chapters[0].content.split("\n\n");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).not.toContain("\n");
  });

  it("keeps only the book between Project Gutenberg markers and reads its metadata", async () => {
    const parsed = await parse(
      [
        "\uFEFFThe Project Gutenberg eBook of A Christmas Carol",
        "Title: A Christmas Carol\nAuthor: Charles Dickens",
        "*** START OF THE PROJECT GUTENBERG EBOOK A CHRISTMAS CAROL ***",
        wrapped(80),
        "*** END OF THE PROJECT GUTENBERG EBOOK A CHRISTMAS CAROL ***",
        "Section 1. General Terms of Use and Redistributing Project Gutenberg works",
      ].join("\n\n"),
    );

    expect(parsed.metadata).toEqual({ title: "A Christmas Carol", author: "Charles Dickens" });
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0].content).not.toMatch(/gutenberg/i);
  });

  it("uses the table of contents, even when titles sit on their own line", async () => {
    const parsed = await parse(
      [
        "CONTENTS",
        "Stave   I: Marley's Ghost\nStave  II: The First of the Three Spirits\nStave III: The Second of the Three Spirits",
        "STAVE I:  MARLEY'S GHOST",
        wrapped(120, "a"),
        "STAVE II.",
        "THE FIRST OF THE THREE SPIRITS.",
        wrapped(120, "b"),
        "STAVE III.",
        "THE SECOND OF THE THREE SPIRITS.",
        wrapped(120, "c"),
      ].join("\n\n"),
    );

    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual([
      "Stave I: Marley's Ghost",
      "Stave II: The First of the Three Spirits",
      "Stave III: The Second of the Three Spirits",
    ]);
    expect(parsed.chapters[0].content.startsWith("ariver")).toBe(true);
  });

  it("does not treat numbered paragraphs as chapters", async () => {
    const lines = Array.from({ length: 500 }, (_, index) => `${index + 1}. A short numbered saying.`);
    const parsed = await parse(lines.join("\n\n"));

    expect(parsed.chapters).toHaveLength(1);
  });

  it("drops illustration markers but keeps a chapter heading inside a caption", async () => {
    const parsed = await parse(
      [
        "[Illustration: PRIDE AND PREJUDICE\n\nChapter I.]",
        wrapped(60, "a"),
        "[Illustration]",
        "CHAPTER II.",
        wrapped(60, "b"),
      ].join("\n\n"),
    );

    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(["Chapter I", "CHAPTER II"]);
    expect(parsed.chapters.some((chapter) => chapter.content.includes("Illustration"))).toBe(false);
  });

  it("treats each line as a paragraph when the file has one paragraph per line", async () => {
    const paragraphs = Array.from({ length: 30 }, (_, index) => `${wrapped(30, `p${"x".repeat(index % 3)}`).replace(/\n/g, " ")}`);
    const parsed = await parse(paragraphs.join("\n"));

    expect(parsed.chapters[0].content.split("\n\n")).toHaveLength(30);
  });

  it("rejects empty documents", async () => {
    await expect(parse("   \n\n")).rejects.toMatchObject({ code: "NO_CONTENT_EXTRACTED" });
  });
});
