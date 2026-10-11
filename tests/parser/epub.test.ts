import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { epubParser } from "@/lib/parser/epub";
import { createEpubFixture, createTinyPng } from "../helpers/epub-fixture";

const ALICE_EPUB = "D:/work_new/出海/audiobooker/epub/Alice's Adventures in Wonderland.epub";

describe("epub parser", () => {
  it("extracts metadata and chapter order", async () => {
    const buffer = await createEpubFixture({
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      language: "en",
      chapters: [
        {
          id: "c1",
          title: "Chapter One",
          html: "<p>In my younger and more vulnerable years my father gave me some advice.</p>",
        },
        {
          id: "c2",
          title: "Chapter Two",
          html: "<p>About half way between West Egg and New York the motor road hastily joins the railroad.</p>",
        },
      ],
    });

    const parsed = await epubParser.parse({
      filename: "gatsby.epub",
      mimeType: "application/epub+zip",
      buffer,
    });

    expect(parsed.metadata.title).toBe("The Great Gatsby");
    expect(parsed.metadata.author).toBe("F. Scott Fitzgerald");
    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual([
      "Chapter One",
      "Chapter Two",
    ]);
    expect(parsed.chapters[0]?.content).toContain("younger and more vulnerable");
  });

  it("follows the navigation document and skips contents and license entries", async () => {
    const buffer = await createEpubFixture({
      title: "Alice's Adventures in Wonderland",
      author: "Lewis Carroll",
      coverPng: createTinyPng(),
      chapters: [
        {
          id: "title",
          title: "Alice's Adventures in Wonderland",
          html: "<p>Alice's Adventures in Wonderland, by Lewis Carroll. This title page has enough text.</p>",
        },
        {
          id: "edition",
          title: "THE MILLENNIUM FULCRUM EDITION 3.0",
          html: "<p>THE MILLENNIUM FULCRUM EDITION 3.0 is the source text used for this ebook.</p>",
        },
        {
          id: "contents",
          title: "Contents",
          html: "<p>Chapter I. Down the Rabbit-Hole. Chapter II. The Pool of Tears.</p>",
        },
        {
          id: "c1",
          title: "CHAPTER I. Down the Rabbit-Hole",
          html: "<p>Alice was beginning to get very tired of sitting by her sister on the bank.</p>",
        },
        {
          id: "license",
          title: "The Full Project Gutenberg License",
          html: "<p>The full Project Gutenberg License appears at the end of this ebook for readers.</p>",
        },
      ],
      toc: [
        { title: "Alice's Adventures in Wonderland", href: "title.xhtml" },
        { title: "THE MILLENNIUM FULCRUM EDITION 3.0", href: "edition.xhtml" },
        { title: "Contents", href: "contents.xhtml" },
        { title: "CHAPTER I. Down the Rabbit-Hole", href: "c1.xhtml" },
        { title: "The Full Project Gutenberg License", href: "license.xhtml" },
      ],
    });

    const parsed = await epubParser.parse({
      filename: "alice.epub",
      mimeType: "application/epub+zip",
      buffer,
    });

    expect(parsed.cover?.buffer.length).toBeGreaterThan(0);
    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual([
      "Alice's Adventures in Wonderland",
      "THE MILLENNIUM FULCRUM EDITION 3.0",
      "CHAPTER I. Down the Rabbit-Hole",
    ]);
  });

  it("does not split a spine file into fake Chapter 1 headings", async () => {
    const buffer = await createEpubFixture({
      title: "Wrapped",
      chapters: [
        {
          id: "wrap",
          title: "The Project Gutenberg eBook of Alice",
          html: `<h2>Alice's Adventures in Wonderland</h2>
            <h3>THE MILLENNIUM FULCRUM EDITION 3.0</h3>
            <p>This wrapper file includes enough text that a heading split would invent extra chapters.</p>
            <h2>Chapter 1</h2>
            <p>More wrapper copy that used to become a duplicate Chapter 1.</p>
            <h2>Chapter 1</h2>
            <p>Still more wrapper copy kept as a single spine chapter.</p>`,
        },
      ],
    });

    const parsed = await epubParser.parse({
      filename: "wrap.epub",
      mimeType: "application/epub+zip",
      buffer,
    });

    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0]?.title).toBe("The Project Gutenberg eBook of Alice");
  });

  it("rejects malformed archives", async () => {
    await expect(
      epubParser.parse({
        filename: "bad.epub",
        mimeType: "application/epub+zip",
        buffer: Buffer.from("not-an-epub"),
      }),
    ).rejects.toMatchObject({ code: "FILE_INVALID" });
  });

  it("rejects path traversal entries", async () => {
    const buffer = await createEpubFixture({
      title: "Unsafe",
      chapters: [
        {
          id: "c1",
          title: "Safe",
          html: "<p>This chapter has enough characters to be treated as real content.</p>",
        },
      ],
      extraFiles: {
        "../../secret.txt": "nope",
      },
    });

    await expect(
      epubParser.parse({
        filename: "unsafe.epub",
        mimeType: "application/epub+zip",
        buffer,
      }),
    ).rejects.toMatchObject({ code: "FILE_INVALID" });
  });
});

describe.skipIf(!existsSync(ALICE_EPUB))("Gutenberg Alice EPUB", () => {
  it("matches the competitor chapter list and extracts a cover", async () => {
    const parsed = await epubParser.parse({
      filename: "alice.epub",
      mimeType: "application/epub+zip",
      buffer: readFileSync(ALICE_EPUB),
    });

    expect(parsed.cover?.buffer.length).toBeGreaterThan(1000);
    expect(parsed.metadata.title).toMatch(/Alice.s Adventures in Wonderland/i);
    expect(parsed.chapters).toHaveLength(14);
    expect(parsed.chapters[0]?.title).toMatch(/Alice.s Adventures in Wonderland/i);
    expect(parsed.chapters[1]?.title).toMatch(/MILLENNIUM FULCRUM EDITION 3\.0/i);
    expect(parsed.chapters.some((chapter) => /^Chapter 1$/i.test(chapter.title))).toBe(false);
    expect(parsed.chapters.filter((chapter) => /chapter/i.test(chapter.title))).toHaveLength(12);
  });
});
