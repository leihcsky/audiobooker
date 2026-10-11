import { AppError } from "@/lib/api/errors";
import { epubParser } from "@/lib/parser/epub";
import { pdfParser } from "@/lib/parser/pdf";
import { txtParser } from "@/lib/parser/txt";
import type { DocumentParser, ParseInput, ParsedDocument } from "@/lib/parser/types";

const parsers: DocumentParser[] = [epubParser, txtParser, pdfParser];

export function getParser(format: string): DocumentParser {
  const parser = parsers.find((candidate) => candidate.supports(format));
  if (!parser) {
    throw new AppError("PARSER_NOT_SUPPORTED", "This file type cannot be parsed yet.", 415);
  }
  return parser;
}

export async function parseDocument(format: string, input: ParseInput): Promise<ParsedDocument> {
  return getParser(format).parse(input);
}
