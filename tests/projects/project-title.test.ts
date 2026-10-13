import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_TITLE,
  titleAfterParse,
  titleFromFilename,
} from "@/lib/projects/project-title";

describe("titleFromFilename", () => {
  it("drops the extension", () => {
    expect(titleFromFilename("The Hobbit.epub")).toBe("The Hobbit");
  });

  it("falls back to the placeholder for an empty name", () => {
    expect(titleFromFilename(".pdf")).toBe(DEFAULT_PROJECT_TITLE);
  });

  it("caps the length", () => {
    expect(titleFromFilename(`${"a".repeat(300)}.txt`)).toHaveLength(255);
  });
});

describe("titleAfterParse", () => {
  const base = { current: "My Project", filename: "book-file.epub" };

  it("keeps a title the user typed", () => {
    expect(titleAfterParse({ ...base, titleSetByUser: true, bookTitle: "Moby-Dick" })).toBe(
      "My Project",
    );
  });

  it("uses the book's title when the title was automatic", () => {
    expect(titleAfterParse({ ...base, titleSetByUser: false, bookTitle: " Moby-Dick " })).toBe(
      "Moby-Dick",
    );
  });

  it("falls back to the file name when the book has no title", () => {
    expect(titleAfterParse({ ...base, titleSetByUser: false, bookTitle: null })).toBe("book-file");
    expect(titleAfterParse({ ...base, titleSetByUser: false, bookTitle: "  " })).toBe("book-file");
  });
});
