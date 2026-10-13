/** Paragraph helpers shared by chunking, the paragraph editor, and the paragraph fix service. */

const PARAGRAPH_BREAK = /\n\s*\n/;
const SPEAKABLE = /[\p{L}\p{N}]/u;

export function normalizeChapterText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

/** Non-empty paragraphs, separated by a blank line. Indexes match `TextChunk.paragraph`. */
export function splitParagraphs(text: string): string[] {
  const normalized = normalizeChapterText(text);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(PARAGRAPH_BREAK)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** False for separators such as `***` that a voice cannot read. */
export function hasSpeakableText(text: string): boolean {
  return SPEAKABLE.test(text);
}

export function replaceParagraph(text: string, index: number, replacement: string): string {
  const paragraphs = splitParagraphs(text);
  if (index < 0 || index >= paragraphs.length) {
    throw new RangeError("Paragraph index out of range.");
  }
  paragraphs[index] = normalizeChapterText(replacement);
  return paragraphs.join("\n\n");
}
