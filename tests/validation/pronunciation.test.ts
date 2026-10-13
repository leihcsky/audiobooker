import { describe, expect, it } from "vitest";
import {
  createPronunciationSchema,
  previewPronunciationSchema,
  updatePronunciationSchema,
} from "@/lib/validation/pronunciation";

describe("createPronunciationSchema", () => {
  it("trims and applies defaults", () => {
    expect(createPronunciationSchema.parse({ term: " Hermione ", replacement: "Her-MY-oh-nee" })).toEqual({
      term: "Hermione",
      replacement: "Her-MY-oh-nee",
      caseSensitive: false,
      wholeWord: true,
    });
  });

  it("rejects multi-line, empty, too long, or unchanged values", () => {
    expect(createPronunciationSchema.safeParse({ term: "a\nb", replacement: "x" }).success).toBe(false);
    expect(createPronunciationSchema.safeParse({ term: " ", replacement: "x" }).success).toBe(false);
    expect(createPronunciationSchema.safeParse({ term: "a".repeat(101), replacement: "x" }).success).toBe(false);
    expect(createPronunciationSchema.safeParse({ term: "a", replacement: "x".repeat(201) }).success).toBe(false);
    expect(createPronunciationSchema.safeParse({ term: "Same", replacement: "Same" }).success).toBe(false);
  });
});

describe("updatePronunciationSchema", () => {
  it("accepts a partial update but not an empty one", () => {
    expect(updatePronunciationSchema.parse({ wholeWord: false })).toEqual({ wholeWord: false });
    expect(updatePronunciationSchema.safeParse({}).success).toBe(false);
  });
});

describe("previewPronunciationSchema", () => {
  it("requires a voice", () => {
    expect(previewPronunciationSchema.safeParse({ term: "a", replacement: "b" }).success).toBe(false);
    expect(previewPronunciationSchema.safeParse({ term: "a", replacement: "b", voiceId: "edge-x" }).success).toBe(true);
  });
});
