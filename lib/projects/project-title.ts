export const DEFAULT_PROJECT_TITLE = "Untitled audiobook";
export const MAX_PROJECT_TITLE_LENGTH = 255;

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base.slice(0, MAX_PROJECT_TITLE_LENGTH) || DEFAULT_PROJECT_TITLE;
}

export interface ParsedTitleInput {
  current: string;
  titleSetByUser: boolean;
  bookTitle: string | null | undefined;
  filename: string;
}

export function titleAfterParse(input: ParsedTitleInput): string {
  if (input.titleSetByUser) {
    return input.current;
  }
  const bookTitle = input.bookTitle?.trim().slice(0, MAX_PROJECT_TITLE_LENGTH);
  return bookTitle || titleFromFilename(input.filename);
}
