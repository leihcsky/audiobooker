import { describe, expect, it } from "vitest";
import { bookStats } from "@/lib/projects/book-stats";

describe("bookStats", () => {
  it("totals the whole book and the selected chapters", () => {
    const stats = bookStats([
      { included: true, wordCount: 1000, estimatedSeconds: 400, audioDurationSeconds: null },
      { included: false, wordCount: 500, estimatedSeconds: 200, audioDurationSeconds: null },
      { included: true, wordCount: 300, estimatedSeconds: 120, audioDurationSeconds: 130.5 },
    ]);
    expect(stats.book).toEqual({ chapters: 3, words: 1800, seconds: 730.5 });
    expect(stats.selected).toEqual({ chapters: 2, words: 1300, seconds: 530.5 });
  });

  it("returns zeros for an empty book", () => {
    expect(bookStats([]).selected).toEqual({ chapters: 0, words: 0, seconds: 0 });
  });
});
