import { chunkText } from "@/lib/tts/chunking";
import type { ChunkOptions, TextChunk } from "@/lib/tts/types";

export type PronunciationRule = {
  term: string;
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
};

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** Private-use code points mark replaced spans; stripped from input so they cannot collide. */
const PRIVATE_USE = /[\uE000-\uF8FF]/g;
const PLACEHOLDER_BASE = 0xe000;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ruleRegex(rule: PronunciationRule, global = true): RegExp {
  const body = escapeRegex(rule.term);
  const whole = rule.wholeWord && !CJK.test(rule.term);
  const source = whole ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body;
  return new RegExp(source, `${global ? "g" : ""}u${rule.caseSensitive ? "" : "i"}`);
}

/** Replaces every rule's term, longest first; a replacement is never matched by a later rule. */
export function applyPronunciations(text: string, rules: PronunciationRule[]): string {
  if (rules.length === 0) {
    return text;
  }
  const order = rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => b.rule.term.length - a.rule.term.length);
  let marked = text.replace(PRIVATE_USE, "");
  for (const { rule, index } of order) {
    marked = marked.replace(ruleRegex(rule), String.fromCharCode(PLACEHOLDER_BASE + index));
  }
  return marked.replace(PRIVATE_USE, (char) => rules[char.charCodeAt(0) - PLACEHOLDER_BASE]?.replacement ?? "");
}

export function countOccurrences(text: string, rule: PronunciationRule): number {
  return text.match(ruleRegex(rule))?.length ?? 0;
}

export function containsTerm(text: string, rule: PronunciationRule): boolean {
  return ruleRegex(rule, false).test(text);
}

/**
 * Applies the rules to already-chunked text. Chunk boundaries come from the
 * original text so they do not move when rules change; a chunk that grows
 * past the limits is re-chunked on its own.
 */
export function applyPronunciationsToChunks(
  chunks: TextChunk[],
  rules: PronunciationRule[],
  options: ChunkOptions,
): TextChunk[] {
  if (rules.length === 0) {
    return chunks;
  }
  const fits = (value: string) =>
    value.length <= options.maxCharacters &&
    (options.maxBytes === undefined || Buffer.byteLength(value, "utf8") <= options.maxBytes);
  const spokenChunks = chunks.flatMap((chunk) => {
    const spoken = applyPronunciations(chunk.text, rules);
    const texts = fits(spoken) ? [spoken] : chunkText(spoken, options).map((piece) => piece.text);
    return texts.map((text) => ({ paragraph: chunk.paragraph, text }));
  });
  return spokenChunks.map((chunk, index) => ({ index, ...chunk, characterCount: chunk.text.length }));
}

const SENTENCE_END = /[.!?。！？\n]/;

/** The sentence around the first match, at most `maxChars` long, or null when the term is absent. */
export function findSampleSentence(texts: string[], rule: PronunciationRule, maxChars: number): string | null {
  const regex = ruleRegex(rule, false);
  for (const text of texts) {
    const match = regex.exec(text);
    if (!match) {
      continue;
    }
    let start = match.index;
    while (start > 0 && !SENTENCE_END.test(text[start - 1])) {
      start -= 1;
    }
    let end = match.index + match[0].length;
    while (end < text.length && !SENTENCE_END.test(text[end])) {
      end += 1;
    }
    if (end < text.length) {
      end += 1;
    }
    if (end - start > maxChars) {
      const half = Math.floor((maxChars - match[0].length) / 2);
      start = Math.max(start, match.index - half);
      end = Math.min(end, start + maxChars);
    }
    return text.slice(start, end).trim();
  }
  return null;
}
