import { ttsInvalidRequest } from "@/lib/api/errors";
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

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const fits: Fits = (value) =>
    value.length <= maxCharacters &&
    (maxBytes === undefined || Buffer.byteLength(value, "utf8") <= maxBytes);

  const packed: string[] = [];
  for (const paragraph of splitParagraphs(normalized)) {
    splitToFit(paragraph, fits).forEach((piece, index) => {
      appendPacked(packed, piece, fits, index === 0 ? "\n\n" : " ");
    });
  }

  return packed.map((chunk, index) => ({
    index,
    text: chunk,
    characterCount: chunk.length,
  }));
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
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

function appendPacked(packed: string[], piece: string, fits: Fits, separator: string): void {
  const last = packed[packed.length - 1];
  if (!last) {
    packed.push(piece);
    return;
  }
  const joined = `${last}${separator}${piece}`;
  if (fits(joined)) {
    packed[packed.length - 1] = joined;
    return;
  }
  packed.push(piece);
}
