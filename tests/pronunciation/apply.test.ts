import { describe, expect, it } from "vitest";
import {
  applyPronunciations,
  applyPronunciationsToChunks,
  containsTerm,
  countOccurrences,
  findSampleSentence,
  type PronunciationRule,
} from "@/lib/pronunciation/apply";
import { chunkText } from "@/lib/tts/chunking";

function rule(term: string, replacement: string, overrides: Partial<PronunciationRule> = {}): PronunciationRule {
  return { term, replacement, caseSensitive: false, wholeWord: true, ...overrides };
}

describe("applyPronunciations", () => {
  it("replaces whole words case-insensitively by default", () => {
    expect(applyPronunciations("Hermione met HERMIONE. Hermiones?", [rule("Hermione", "Her-MY-oh-nee")])).toBe(
      "Her-MY-oh-nee met Her-MY-oh-nee. Hermiones?",
    );
  });

  it("respects match case", () => {
    expect(applyPronunciations("Read the read me.", [rule("Read", "Reed", { caseSensitive: true })])).toBe(
      "Reed the read me.",
    );
  });

  it("matches inside words when whole word is off", () => {
    expect(applyPronunciations("Gandalfian Gandalf", [rule("Gandalf", "GAN-dalf", { wholeWord: false })])).toBe(
      "GAN-dalfian GAN-dalf",
    );
  });

  it("treats accented letters as part of a word", () => {
    expect(applyPronunciations("Zoë and Zoëy", [rule("Zoë", "ZO-ee")])).toBe("ZO-ee and Zoëy");
  });

  it("matches CJK terms without word boundaries", () => {
    expect(applyPronunciations("我在重庆吃火锅。", [rule("重庆", "崇庆")])).toBe("我在崇庆吃火锅。");
  });

  it("escapes regex characters in terms", () => {
    expect(applyPronunciations("Use C++ (not C).", [rule("C++", "C plus plus", { wholeWord: false })])).toBe(
      "Use C plus plus (not C).",
    );
  });

  it("prefers the longest term and never re-replaces a replacement", () => {
    const rules = [rule("New", "Noo"), rule("New York", "Noo Yawk"), rule("Noo", "Nope")];
    expect(applyPronunciations("New York is new.", rules)).toBe("Noo Yawk is Noo.");
  });

  it("strips private-use characters so they cannot collide with placeholders", () => {
    expect(applyPronunciations("A\uE000B Hermione", [rule("Hermione", "H")])).toBe("AB H");
  });

  it("returns the text untouched without rules", () => {
    expect(applyPronunciations("A\uE000B", [])).toBe("A\uE000B");
  });
});

describe("countOccurrences / containsTerm", () => {
  it("counts whole-word matches", () => {
    const hermione = rule("Hermione", "x");
    expect(countOccurrences("Hermione, hermione, Hermiones", hermione)).toBe(2);
    expect(containsTerm("Hermiones", hermione)).toBe(false);
    expect(containsTerm("Oh hermione!", hermione)).toBe(true);
  });
});

describe("applyPronunciationsToChunks", () => {
  it("keeps original chunk boundaries and counts spoken characters", () => {
    const text = "Hermione ran.\n\nHarry walked.";
    const options = { maxCharacters: 20 };
    const chunks = applyPronunciationsToChunks(chunkText(text, options), [rule("Hermione", "Her-MY")], options);
    expect(chunks).toEqual([
      { index: 0, paragraph: 0, text: "Her-MY ran.", characterCount: 11 },
      { index: 1, paragraph: 1, text: "Harry walked.", characterCount: 13 },
    ]);
  });

  it("re-chunks a chunk that grows past the limit", () => {
    const options = { maxCharacters: 20 };
    const original = chunkText("Al met Al.", options);
    const chunks = applyPronunciationsToChunks(original, [rule("Al", "Albus Percival")], options);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 20)).toBe(true);
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index));
    expect(chunks.every((chunk) => chunk.paragraph === 0)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join(" ")).toContain("Albus");
  });
});

describe("findSampleSentence", () => {
  it("returns the sentence containing the first match", () => {
    const texts = ["No names here.", "It was late. Hermione opened the door! Then silence."];
    expect(findSampleSentence(texts, rule("hermione", "x"), 180)).toBe("Hermione opened the door!");
  });

  it("windows long sentences around the match", () => {
    const long = `${"word ".repeat(100)}Hermione ${"word ".repeat(100)}`;
    const sample = findSampleSentence([long], rule("Hermione", "x"), 60);
    expect(sample).not.toBeNull();
    expect(sample!.length).toBeLessThanOrEqual(60);
    expect(sample).toContain("Hermione");
  });

  it("returns null when the term is absent", () => {
    expect(findSampleSentence(["Nothing."], rule("Hermione", "x"), 180)).toBeNull();
  });
});
