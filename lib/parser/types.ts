export type ParsedChapter = {
  title: string;
  content: string;
  order: number;
};

export type ParsedMetadata = {
  title?: string;
  author?: string;
  language?: string;
};

export type ParsedCover = {
  buffer: Buffer;
  mediaType: string;
};

export type ParsedDocument = {
  metadata: ParsedMetadata;
  chapters: ParsedChapter[];
  cover?: ParsedCover;
};

export type ParseInput = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export interface DocumentParser {
  supports(format: string): boolean;
  parse(input: ParseInput): Promise<ParsedDocument>;
}
