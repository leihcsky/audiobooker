import { ttsInvalidRequest } from "@/lib/api/errors";
import { hasSpeakableText, splitParagraphs } from "@/lib/chapters/paragraphs";
import type { ChunkOptions, TextChunk } from "@/lib/tts/types";

const SENTENCE_SPLIT = /(?<=[.!?…。！？；;])(?:\s+|$)|(?<=[。！？；])/;
const WORD_SPLIT = /(\s+)/;

type Fits = (text: string) => boolean;

export function chunkText(text: string, options: ChunkOptions): TextChunk[] {
  const { maxCharacters, maxBytes } = options;
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw ttsInvalidRequest("Chunk size must be a positive integer.");
  }
  if (maxBytes !== undefined && (!Number.isInteger(maxBytes) || maxBytes < 4)) {
    throw ttsInvalidRequest("Chunk byte limit must be a positive integer.");
  }

  const fits: Fits = (value) =>
    value.length <= maxCharacters &&
    (maxBytes === undefined || Buffer.byteLength(value, "utf8") <= maxBytes);

  const chunks: TextChunk[] = [];
  splitParagraphs(text).forEach((paragraph, paragraphIndex) => {
    if (!hasSpeakableText(paragraph)) {
      return;
    }
    for (const piece of packPieces(splitToFit(paragraph, fits), fits)) {
      chunks.push({
        index: chunks.length,
        paragraph: paragraphIndex,
        text: piece,
        characterCount: piece.length,
      });
    }
  });
  return chunks;
}

/**
 * Packs the pieces of one paragraph. Paragraphs are never packed together,
 * so editing one paragraph leaves every other chunk (and its cache key) as is.
 */
function packPieces(pieces: string[], fits: Fits): string[] {
  const packed: string[] = [];
  for (const piece of pieces) {
    const last = packed[packed.length - 1];
    const joined = last === undefined ? piece : `${last} ${piece}`;
    if (last !== undefined && fits(joined)) {
      packed[packed.length - 1] = joined;
    } else {
      packed.push(piece);
    }
  }
  return packed;
}

function splitToFit(text: string, fits: Fits): string[] {
  if (fits(text)) {
    return [text];
  }

  const pieces: string[] = [];
  for (const sentence of splitSentences(text)) {
    if (fits(sentence)) {
      pieces.push(sentence);
      continue;
    }
    pieces.push(...splitWords(sentence, fits));
  }
  return pieces;
}

function splitSentences(text: string): string[] {
  const parts = text.split(SENTENCE_SPLIT).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

function splitWords(text: string, fits: Fits): string[] {
  const tokens = text.split(WORD_SPLIT).filter((token) => token.length > 0);
  const pieces: string[] = [];
  let current = "";

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (current) {
        current += token;
      }
      continue;
    }
    if (!fits(token)) {
      if (current.trim()) {
        pieces.push(current.trim());
      }
      current = "";
      pieces.push(...splitHard(token, fits));
      continue;
    }
    const candidate = current ? current + token : token;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    pieces.push(current.trim());
    current = token;
  }

  if (current.trim()) {
    pieces.push(current.trim());
  }
  return pieces.filter(Boolean);
}

function splitHard(token: string, fits: Fits): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const char of token) {
    if (fits(current + char)) {
      current += char;
      continue;
    }
    if (current) {
      pieces.push(current);
    }
    current = char;
  }
  if (current) {
    pieces.push(current);
  }
  return pieces;
}
