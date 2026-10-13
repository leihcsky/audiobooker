export const DEFAULT_AI_DISCLOSURE =
  "This audiobook is narrated by a synthetic (AI-generated) voice.";

export const DEFAULT_NARRATOR_CREDIT = "Digital voice";

export const MAX_AI_DISCLOSURE_LENGTH = 1000;

export function effectiveAiDisclosure(stored: string | null | undefined): string {
  const trimmed = stored?.trim();
  return trimmed ? trimmed : DEFAULT_AI_DISCLOSURE;
}

/** Description text for exported metadata: the book description followed by the disclosure. */
export function describeWithDisclosure(description: string | null, disclosure: string): string {
  const trimmed = description?.trim();
  return trimmed ? `${trimmed}\n\n${disclosure}` : disclosure;
}
