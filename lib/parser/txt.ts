import { AppError } from "@/lib/api/errors";
import { normalizeText } from "@/lib/parser/normalize";
import { SECTION_LIMITS, structureUnits } from "@/lib/parser/text-structure";
import type { DocumentParser, ParseInput, ParsedDocument, ParsedMetadata } from "@/lib/parser/types";

const GUTENBERG_START = /^\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG.*$/im;
const GUTENBERG_END = /^\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG.*$/im;
const ILLUSTRATION = /\[Illustration(?::([^\]]*))?\]/gi;
const CAPTION_HEADING = /^(chapter|part|book|stave)\s+\S+$/i;
/** Wrapped prose lines fill most of the width; shorter lines are headings, list entries, or verse. */
const WRAPPED_LINE_RATIO = 0.75;
const NUMBERED_ITEM = /^(\p{L}+)\s+(\d{1,3}|[IVXLCDM]{1,7})\b/u;
const ITEM_WORDS = new Set(["chapter", "part", "book", "stave", "section", "letter"]);

/** Contents entries and headings such as "Stave IV: ..." always start a new unit. */
function startsNumberedItem(line: string): boolean {
  const match = NUMBERED_ITEM.exec(line);
  return match !== null && ITEM_WORDS.has(match[1].toLowerCase());
}

/** A paragraph or a short standalone line; `block` groups units that sat between the same blank lines. */
type TxtUnit = { text: string; block: number };

/** Keeps only the book between Project Gutenberg's start and end markers, reading title and author from the header. */
function stripGutenberg(text: string): { body: string; metadata: ParsedMetadata } {
  const start = GUTENBERG_START.exec(text);
  if (!start) {
    return { body: text, metadata: {} };
  }
  const header = text.slice(0, start.index);
  const rest = text.slice(start.index + start[0].length);
  const end = GUTENBERG_END.exec(rest);
  const field = (name: string) => new RegExp(`^${name}:\\s*(.+)$`, "im").exec(header)?.[1].trim();
  return {
    body: end ? rest.slice(0, end.index) : rest,
    metadata: { title: field("Title"), author: field("Author") },
  };
}

/** Drops illustration markers, which a narrator would not read, keeping any chapter heading inside a caption. */
function stripIllustrations(text: string): string {
  return text.replace(ILLUSTRATION, (_, caption: string | undefined) =>
    (caption ?? "")
      .split("\n")
      .map((line) => line.trim().replace(/\.$/, ""))
      .filter((line) => CAPTION_HEADING.test(line))
      .join("\n"),
  );
}

/**
 * Rebuilds paragraphs from hard-wrapped lines. Short lines (headings, verse) stay separate units
 * so headings can be matched on their own.
 */
function txtUnits(text: string): TxtUnit[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);
  const lines = blocks.flat();
  const widths = lines.map((line) => line.length).filter((length) => length >= 20).sort((a, b) => a - b);
  const typical = widths.length ? widths[Math.floor(widths.length * 0.6)] : 0;
  const hardWrapped = typical > 0 && typical <= 100;
  const blankLineParagraphs = blocks.length >= lines.length * 0.05;

  const units: TxtUnit[] = [];
  blocks.forEach((blockLines, blockIndex) => {
    let previous = "";
    for (const line of blockLines) {
      if (hardWrapped && previous.length >= typical * WRAPPED_LINE_RATIO && !startsNumberedItem(line)) {
        units[units.length - 1].text += ` ${line}`;
      } else {
        units.push({ text: line, block: blankLineParagraphs ? blockIndex : units.length });
      }
      previous = line;
    }
  });
  return units;
}

function joinTxtUnits(units: TxtUnit[], indexes: number[]): string {
  return indexes
    .map((index, position) => {
      const previous = position > 0 ? units[indexes[position - 1]] : undefined;
      const separator = !previous ? "" : previous.block === units[index].block ? "\n" : "\n\n";
      return separator + units[index].text;
    })
    .join("");
}

export const txtParser: DocumentParser = {
  supports(format: string) {
    return format === "TXT" || format === "text/plain" || format === "txt";
  },

  async parse(input: ParseInput): Promise<ParsedDocument> {
    if (input.buffer.includes(0)) {
      throw new AppError("FILE_INVALID", "The text file contains binary data.", 400);
    }

    const { body, metadata } = stripGutenberg(normalizeText(input.buffer.toString("utf8").replace(/^\uFEFF/, "")));
    const units = txtUnits(stripIllustrations(body));
    if (units.length === 0) {
      throw new AppError("NO_CONTENT_EXTRACTED", "The text file is empty.", 422);
    }

    const sections = structureUnits(
      units.map((unit) => unit.text),
      { ...SECTION_LIMITS, join: (indexes) => joinTxtUnits(units, indexes) },
    );

    return {
      metadata,
      chapters: sections.map((section, index) => ({
        title: section.title.slice(0, 500),
        content: section.content,
        order: index + 1,
      })),
    };
  },
};
