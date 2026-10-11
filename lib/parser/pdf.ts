import { AppError } from "@/lib/api/errors";
import { normalizeText } from "@/lib/parser/normalize";
import type { DocumentParser, ParseInput, ParsedChapter, ParsedDocument } from "@/lib/parser/types";

const HEADING = /^(chapter\s+\d+\b|\d+\.\s+\S.{0,80})$/i;

export const pdfParser: DocumentParser = {
  supports(format: string) {
    return format === "PDF" || format === "application/pdf" || format === "pdf";
  },

  async parse(input: ParseInput): Promise<ParsedDocument> {
    if (input.buffer.subarray(0, 4).toString() !== "%PDF") {
      throw new AppError("FILE_INVALID", "The file is not a valid PDF.", 400);
    }

    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(input.buffer));
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    const text = normalizeText(pages.filter(Boolean).join("\n\n"));

    if (!text) {
      throw new AppError("NO_CONTENT_EXTRACTED", "No readable text was found in the PDF.", 422);
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
      if (HEADING.test(trimmed) && currentLines.join(" ").trim().length > 80) {
        flush();
        currentTitle = trimmed.slice(0, 500);
        currentLines = [];
        continue;
      }
      currentLines.push(line);
    }
    flush();

    return {
      metadata: {},
      chapters: chapters.length > 0 ? chapters : [{ title: "Chapter 1", content: text, order: 1 }],
    };
  },
};
