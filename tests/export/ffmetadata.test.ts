import { describe, expect, it } from "vitest";
import { buildConcatList, buildFfmetadata, escapeFfmetadata } from "@/lib/export/ffmetadata";

describe("ffmetadata", () => {
  it("escapes metadata control characters", () => {
    expect(escapeFfmetadata("A=B;C#D\\E\nF")).toBe("A\\=B\\;C\\#D\\\\E\\\nF");
  });

  it("writes chapter markers from ordered durations", () => {
    const text = buildFfmetadata({
      metadata: {
        title: "My Book",
        author: "Jane",
        narrator: "Alex",
        language: "en",
        description: null,
        publisher: null,
        copyright: "2026",
      },
      chapters: [
        { title: "Intro", startMs: 0, endMs: 1000 },
        { title: "Chapter 1", startMs: 1000, endMs: 2500 },
      ],
    });

    expect(text).toContain("title=My Book");
    expect(text).toContain("artist=Jane");
    expect(text).toContain("[CHAPTER]");
    expect(text).toContain("START=0");
    expect(text).toContain("END=1000");
    expect(text).toContain("title=Intro");
    expect(text).toContain("START=1000");
    expect(text).toContain("END=2500");
  });

  it("quotes concat filenames without using a shell", () => {
    expect(buildConcatList(["chapter-01.mp3", "o'reilly.mp3"])).toBe(
      "file 'chapter-01.mp3'\nfile 'o'\\''reilly.mp3'",
    );
  });
});
