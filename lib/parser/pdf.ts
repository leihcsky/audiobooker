import { AppError } from "@/lib/api/errors";
import { normalizeText } from "@/lib/parser/normalize";
import { stripRunningLines, structurePdfLines } from "@/lib/parser/pdf-structure";
import { SECTION_LIMITS } from "@/lib/parser/text-structure";
import type { DocumentParser, ParseInput, ParsedDocument } from "@/lib/parser/types";

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
    const pageLines = pages.map((page) =>
      normalizeText(page ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );
    const lines = stripRunningLines(pageLines).flat();

    if (lines.length === 0) {
      throw new AppError("NO_CONTENT_EXTRACTED", "No readable text was found in the PDF.", 422);
    }

    const sections = structurePdfLines(lines, SECTION_LIMITS);

    return {
      metadata: {},
      chapters: sections.map((section, index) => ({
        title: section.title.slice(0, 500),
        content: section.content,
        order: index + 1,
      })),
    };
  },
};
