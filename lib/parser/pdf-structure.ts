import { FOOTNOTE_MARK, structureUnits, type TextSection } from "@/lib/parser/text-structure";

const EDGE_LINES = 3;
const PAGE_NUMBER = /^(page\s+)?\d{1,4}(\s*(\/|of)\s*\d{1,4})?$/i;
const SENTENCE_END = /[.!?:;"”’)\]]$/;
const NUMBERED_PARAGRAPH = /^\d{1,3}\.\s/;

function runningKey(line: string): string {
  return line.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

function isEdge(index: number, length: number): boolean {
  return index < EDGE_LINES || index >= length - EDGE_LINES;
}

/** Drops page numbers and headers/footers repeated at the top or bottom of many pages. */
export function stripRunningLines(pages: string[][]): string[][] {
  if (pages.length < 3) {
    return pages.map((lines) => lines.filter((line, index) => !(isEdge(index, lines.length) && PAGE_NUMBER.test(line))));
  }
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const keys = new Set(lines.filter((_, index) => isEdge(index, lines.length)).map(runningKey));
    for (const key of keys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.3));
  return pages.map((lines) =>
    lines.filter((line, index) => {
      if (!isEdge(index, lines.length)) {
        return true;
      }
      return !PAGE_NUMBER.test(line) && (counts.get(runningKey(line)) ?? 0) < threshold;
    }),
  );
}

/** Joins wrapped lines into paragraphs and rejoins words hyphenated across lines. */
export function joinPdfLines(lines: string[]): string {
  const widths = lines.map((line) => line.length).filter((length) => length >= 20);
  const typical = widths.length ? [...widths].sort((a, b) => a - b)[Math.floor(widths.length * 0.6)] : 60;
  const paragraphs: string[] = [];
  let current = "";
  let previous = "";

  for (const raw of lines) {
    const line = raw.replace(FOOTNOTE_MARK, "$1");
    if (!current) {
      current = line;
    } else if (
      (SENTENCE_END.test(previous) && previous.length < typical * 0.85) ||
      (!SENTENCE_END.test(previous) && previous.length < typical * 0.6 && /^[A-Z“"]/.test(line)) ||
      NUMBERED_PARAGRAPH.test(line)
    ) {
      paragraphs.push(current);
      current = line;
    } else if (/[a-z]-$/.test(current) && /^[a-z]/.test(line)) {
      current = current.slice(0, -1) + line;
    } else {
      current = `${current} ${line}`;
    }
    previous = line;
  }
  if (current) {
    paragraphs.push(current);
  }
  return paragraphs.join("\n\n");
}

/** Turns the cleaned lines of a PDF into chapters. */
export function structurePdfLines(
  lines: string[],
  limits: { maxSections: number; maxSectionChars: number },
): TextSection[] {
  return structureUnits(lines, {
    ...limits,
    join: (indexes) => joinPdfLines(indexes.map((index) => lines[index])),
  });
}
