import { FILE_LIMITS } from "@/lib/config/limits";

export type TextSection = { title: string; content: string };

/** Builds a section's text from the indexes of the units it covers, in order. */
export type JoinUnits = (indexes: number[]) => string;

export type StructureOptions = {
  maxSections: number;
  maxSectionChars: number;
  join: JoinUnits;
};

/** Leaves headroom under the per-chapter limit checked after parsing. */
export const SECTION_LIMITS = {
  maxSections: FILE_LIMITS.MAX_CHAPTERS,
  maxSectionChars: Math.floor(FILE_LIMITS.MAX_CHAPTER_TEXT_LENGTH * 0.75),
};

/** `span` is 2 when the heading's number and title sit in separate units. */
type Heading = { index: number; span: number; title: string };

const MAX_HEADING_LENGTH = 80;
const MIN_SECTION_CHARS = 200;
const MIN_MEDIAN_SECTION_CHARS = 1500;
const QUOTES = /[“”"]/;

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty";

/**
 * Heading styles tried in order when there is no usable table of contents.
 * Bare roman numerals and numbers are common inside text, so their sections must be book-sized.
 */
const HEADING_PATTERNS: { pattern: RegExp; minMedianChars: number }[] = [
  {
    pattern: new RegExp(
      `^(chapter|part|book|stave|section)\\s+(\\d{1,3}|[ivxlcdm]{1,7}|${NUMBER_WORDS})\\b(\\s*[.:—–-]?\\s*.{0,60})?$`,
      "i",
    ),
    minMedianChars: MIN_SECTION_CHARS,
  },
  { pattern: /^[IVXLCDM]{1,7}[.:]\s+\S.{0,60}$/, minMedianChars: MIN_MEDIAN_SECTION_CHARS },
  { pattern: /^\d{1,3}\.\s+\S.{0,60}$/, minMedianChars: MIN_MEDIAN_SECTION_CHARS },
];

const TOC_LEADER = /(\s*[.·…]{2,}\s*|\s{2,})\d+$/;
/** A footnote number glued to the end of a word, e.g. "Plans12" or "war.3"; spares "10:30" and "$1,000". */
export const FOOTNOTE_MARK = /(\p{Ll}|(?<!\d)[.,;:!?’”)])\d{1,3}(?=\s|$)/gu;
const BARE_MARKER = /^((chapter|part|book|stave|section)\s+\S+|[IVXLCDM]{1,7}|\d{1,3})\.?$/i;
const MARKER_PREFIX = new RegExp(
  `^((chapter|part|book|stave|section)\\s+(\\d{1,3}|[ivxlcdm]{1,7}|${NUMBER_WORDS})\\b|[IVXLCDM]{1,7}(?=[.:]))`,
  "i",
);

/** "Chapter VII" from "Chapter VII. Manœuvring", for contents entries whose title is spelled differently in the text. */
function markerKey(unit: string): string | null {
  const match = MARKER_PREFIX.exec(unit);
  return match ? match[0].toLowerCase().replace(/\s+/g, " ") : null;
}

/** Compares titles ignoring punctuation, case, leaders, and footnote numbers glued to words. */
function headingKey(unit: string): string {
  return unit
    .replace(TOC_LEADER, "")
    .replace(FOOTNOTE_MARK, "$1")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function cleanTitle(unit: string): string {
  return unit
    .replace(TOC_LEADER, "")
    .replace(FOOTNOTE_MARK, "$1")
    .trim()
    .replace(/(?<!\.)\.$/, "");
}

function canBeHeading(unit: string): boolean {
  return unit.length > 0 && unit.length <= MAX_HEADING_LENGTH && !QUOTES.test(unit);
}

/** One- and two-unit heading candidates, keyed for title matching. */
function headingCandidates(units: string[]): Map<string, { index: number; span: number }[]> {
  const positions = new Map<string, { index: number; span: number }[]>();
  const add = (key: string, index: number, span: number) => {
    if (!key) {
      return;
    }
    const list = positions.get(key);
    if (list) {
      list.push({ index, span });
    } else {
      positions.set(key, [{ index, span }]);
    }
  };
  units.forEach((unit, index) => {
    if (!canBeHeading(unit)) {
      return;
    }
    add(headingKey(unit), index, 1);
    const next = units[index + 1];
    if (next && canBeHeading(next) && unit.length + next.length <= MAX_HEADING_LENGTH) {
      add(headingKey(`${unit} ${next}`), index, 2);
    }
  });
  return positions;
}

/** Uses a "Contents" list near the start to find the same titles later in the text. */
function headingsFromContents(units: string[]): { headings: Heading[]; skip: [number, number] } | null {
  const searchEnd = Math.min(units.length, Math.max(200, Math.floor(units.length * 0.15)));
  const start = units.slice(0, searchEnd).findIndex((unit) => /^(table of )?contents[.:]?$/i.test(unit));
  if (start === -1) {
    return null;
  }

  const positions = headingCandidates(units);
  const markers = new Map<string, number[]>();
  units.forEach((unit, index) => {
    const marker = canBeHeading(unit) ? markerKey(unit) : null;
    if (marker) {
      const list = markers.get(marker);
      if (list) {
        list.push(index);
      } else {
        markers.set(marker, [index]);
      }
    }
  });
  const nextAt = (key: string, marker: string | null, from: number) => {
    const exact = positions.get(key)?.find((item) => item.index >= from);
    if (exact || !marker) {
      return exact;
    }
    const index = markers.get(marker)?.find((item) => item >= from);
    return index === undefined ? undefined : { index, span: 1 };
  };

  const entries: { key: string; marker: string | null; title: string }[] = [];
  let tocEnd = start + 1;
  let bodyStart = units.length;
  let misses = 0;
  for (let index = start + 1; index < bodyStart && misses <= 6; index += 1) {
    const unit = units[index];
    if (unit.length > MAX_HEADING_LENGTH) {
      break;
    }
    const key = headingKey(unit);
    const marker = markerKey(unit);
    const later = canBeHeading(unit) ? nextAt(key, marker, index + 1) : undefined;
    if (later) {
      if (entries.length === 0) {
        bodyStart = later.index;
      }
      entries.push({ key, marker, title: cleanTitle(unit) });
      tocEnd = index + 1;
      misses = 0;
    } else {
      misses += 1;
    }
  }

  const headings: Heading[] = [];
  let from = tocEnd;
  for (const entry of entries) {
    const found = nextAt(entry.key, entry.marker, from);
    if (found) {
      headings.push({ index: found.index, span: found.span, title: entry.title });
      from = found.index + found.span;
    }
  }
  return headings.length >= 2 ? { headings, skip: [start, tocEnd] } : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, offset) => from + offset);
}

function buildSections(
  unitCount: number,
  headings: Heading[],
  skip: [number, number] | null,
  join: JoinUnits,
): TextSection[] {
  const keep = (index: number) => !skip || index < skip[0] || index >= skip[1];
  const body = (from: number, to: number) => range(from, to).filter(keep);

  const sections: { title: string; indexes: number[] }[] = [];
  const preamble = body(0, headings[0].index);
  let carry: number[] = [];
  if (join(preamble).length >= MIN_SECTION_CHARS) {
    sections.push({ title: "Front matter", indexes: preamble });
  } else {
    carry = preamble;
  }

  headings.forEach((heading, position) => {
    const end = headings[position + 1]?.index ?? unitCount;
    const indexes = [...carry, ...body(heading.index + heading.span, end)];
    if (join(indexes).length < MIN_SECTION_CHARS && position < headings.length - 1) {
      carry = indexes;
      return;
    }
    carry = [];
    sections.push({ title: heading.title, indexes });
  });

  return sections
    .map((section) => ({ title: section.title, content: join(section.indexes) }))
    .filter((section) => section.content.length > 0);
}

function headingsFromPatterns(units: string[], maxSections: number, join: JoinUnits): TextSection[] | null {
  const candidates = units.flatMap((unit, index): Heading[] => {
    if (!canBeHeading(unit)) {
      return [];
    }
    const next = units[index + 1];
    if (BARE_MARKER.test(unit) && next && canBeHeading(next) && /^\p{Lu}/u.test(next)) {
      return [{ index, span: 2, title: `${unit.replace(/\.$/, "")}: ${cleanTitle(next)}` }];
    }
    return [{ index, span: 1, title: cleanTitle(unit) }];
  });
  for (const { pattern, minMedianChars } of HEADING_PATTERNS) {
    const headings = candidates.filter((candidate) => pattern.test(candidate.title));
    if (headings.length < 2 || headings.length > maxSections) {
      continue;
    }
    const sections = buildSections(units.length, headings, null, join);
    const sizes = sections.map((section) => section.content.length);
    if (sections.length >= 2 && sections.length <= maxSections && median(sizes) >= minMedianChars) {
      return sections;
    }
  }
  return null;
}

/** Splits sections that are too long for one chapter at paragraph boundaries. */
function splitLongSections(sections: TextSection[], maxChars: number): TextSection[] {
  return sections.flatMap((section) => {
    if (section.content.length <= maxChars) {
      return [section];
    }
    const parts: string[] = [];
    let current = "";
    for (const paragraph of section.content.split("\n\n")) {
      if (current && current.length + paragraph.length + 2 > maxChars) {
        parts.push(current);
        current = "";
      }
      current = current ? `${current}\n\n${paragraph}` : paragraph.slice(0, maxChars);
    }
    if (current) {
      parts.push(current);
    }
    return parts.map((content, index) => ({ title: `${section.title} (part ${index + 1})`, content }));
  });
}

/**
 * Turns a document's text units (lines or paragraphs, each on one line) into chapters:
 * headings from a table of contents first, then common heading styles, else one chapter.
 */
export function structureUnits(units: string[], options: StructureOptions): TextSection[] {
  const { maxSections, maxSectionChars, join } = options;
  const contents = headingsFromContents(units);
  const sections =
    (contents && contents.headings.length <= maxSections
      ? buildSections(units.length, contents.headings, contents.skip, join)
      : null) ??
    headingsFromPatterns(units, maxSections, join) ?? [{ title: "Chapter 1", content: join(range(0, units.length)) }];
  return splitLongSections(sections, maxSectionChars);
}
