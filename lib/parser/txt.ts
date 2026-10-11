import { AppError } from "@/lib/api/errors";
import { normalizeText } from "@/lib/parser/normalize";
import type { DocumentParser, ParseInput, ParsedChapter, ParsedDocument } from "@/lib/parser/types";

const CHAPTER_HEADING =
  /^(chapter\s+\d+\b|chapter\s+[a-z]+\b|\d+\.\s+\S.{0,80})$/i;

export const txtParser: DocumentParser = {
  supports(format: string) {
    return format === "TXT" || format === "text/plain" || format === "txt";
  },

  async parse(input: ParseInput): Promise<ParsedDocument> {
    if (input.buffer.includes(0)) {
      throw new AppError("FILE_INVALID", "The text file contains binary data.", 400);
    }

    const text = normalizeText(input.buffer.toString("utf8"));
    if (!text) {
      throw new AppError("NO_CONTENT_EXTRACTED", "The text file is empty.", 422);
    }

    const lines = text.split("\n");
    const chapters: ParsedChapter[] = [];
    let currentTitle = "Chapter 1";
    let currentLines: string[] = [];

    const flush = () => {
      const content = normalizeText(currentLines.join("\n"));
      if (!content) {
        return;
      }
      chapters.push({
        title: currentTitle.slice(0, 500),
        content,
        order: chapters.length + 1,
      });
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (CHAPTER_HEADING.test(trimmed) && currentLines.join(" ").trim().length > 80) {
        flush();
        currentTitle = trimmed.slice(0, 500);
        currentLines = [];
        continue;
      }
      currentLines.push(line);
    }
    flush();

    if (chapters.length === 0) {
      throw new AppError("NO_CONTENT_EXTRACTED", "The text file is empty.", 422);
    }

    return {
      metadata: {},
      chapters,
    };
  },
};
