import { describe, expect, it } from "vitest";
import { txtParser } from "@/lib/parser/txt";

describe("txt parser", () => {
  it("creates a single chapter when no structure exists", async () => {
    const parsed = await txtParser.parse({
      filename: "simple.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Once upon a time there was a quiet forest and a long story."),
    });

    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0]?.title).toBe("Chapter 1");
    expect(parsed.chapters[0]?.content).toContain("quiet forest");
  });

  it("detects conservative chapter headings", async () => {
    const parsed = await txtParser.parse({
      filename: "chaptered.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        [
          "Chapter 1",
          "This is the first section of the book with enough words to keep it as a chapter.",
          "Chapter 2",
          "This is the second section of the book with enough words to keep it as a chapter.",
        ].join("\n"),
      ),
    });

    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(parsed.chapters[0]?.order).toBe(1);
    expect(parsed.chapters[1]?.order).toBe(2);
  });

  it("rejects empty documents", async () => {
    await expect(
      txtParser.parse({
        filename: "empty.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("   \n\n"),
      }),
    ).rejects.toMatchObject({ code: "NO_CONTENT_EXTRACTED" });
  });
});
