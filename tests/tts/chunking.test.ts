import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/tts/chunking";
import { AppError } from "@/lib/api/errors";

describe("chunkText", () => {
  it("keeps a short chapter as one chunk", () => {
    const chunks = chunkText("Hello world.", { maxCharacters: 100 });
    expect(chunks).toEqual([
      { index: 0, text: "Hello world.", characterCount: 12 },
    ]);
  });

  it("splits oversized paragraphs at sentence boundaries and preserves order", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const chunks = chunkText(text, { maxCharacters: 20 });
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "First sentence.",
      "Second sentence.",
      "Third sentence.",
    ]);
    expect(chunks.every((chunk) => chunk.characterCount <= 20)).toBe(true);
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
  });

  it("packs small paragraphs into one chunk when they fit", () => {
    const chunks = chunkText("One.\n\nTwo.", { maxCharacters: 20 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("One.\n\nTwo.");
  });

  it("splits a long sentence by words without breaking a word", () => {
    const chunks = chunkText("alpha beta gamma delta", { maxCharacters: 11 });
    expect(chunks.every((chunk) => chunk.characterCount <= 11)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join(" ")).toContain("alpha");
    expect(chunks.some((chunk) => chunk.text.includes("beta"))).toBe(true);
  });

  it("hard-splits a single token longer than the provider limit", () => {
    const chunks = chunkText("supercalifragilistic", { maxCharacters: 5 });
    expect(chunks.map((chunk) => chunk.text).join("")).toBe("supercalifragilistic");
    expect(chunks.every((chunk) => chunk.characterCount <= 5)).toBe(true);
  });

  it("rejects an invalid chunk size", () => {
    expect(() => chunkText("Hello", { maxCharacters: 0 })).toThrow(AppError);
  });

  it("respects a UTF-8 byte limit for CJK text", () => {
    const sentence = "老灯塔看守人每天傍晚都会爬上楼梯。";
    const text = sentence.repeat(20);
    const chunks = chunkText(text, { maxCharacters: 1000, maxBytes: 120 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => Buffer.byteLength(chunk.text, "utf8") <= 120)).toBe(true);
    expect(chunks.map((chunk) => chunk.text.replace(/\s+/g, "")).join("")).toBe(text);
  });

  it("joins sentences of one paragraph with a space, not a paragraph break", () => {
    const chunks = chunkText("One. Two. Three.", { maxCharacters: 10 });
    expect(chunks.map((chunk) => chunk.text)).toEqual(["One. Two.", "Three."]);
  });

  it("splits CJK sentences without whitespace after punctuation", () => {
    const chunks = chunkText("第一句话。第二句话。第三句话。", { maxCharacters: 6 });
    expect(chunks.map((chunk) => chunk.text)).toEqual(["第一句话。", "第二句话。", "第三句话。"]);
  });
});
