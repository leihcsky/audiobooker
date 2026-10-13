import { z } from "zod";

export const PARAGRAPH_TEXT_MAX = 20_000;

export const paragraphIndexSchema = z.coerce
  .number({ error: "Invalid paragraph." })
  .int("Invalid paragraph.")
  .min(0, "Invalid paragraph.")
  .max(100_000, "Invalid paragraph.");

export const regenerateParagraphSchema = z.object({
  original: z.string().max(PARAGRAPH_TEXT_MAX, "Paragraph is too long."),
  text: z
    .string()
    .trim()
    .min(1, "Paragraph text can't be empty.")
    .max(PARAGRAPH_TEXT_MAX, `A paragraph can be at most ${PARAGRAPH_TEXT_MAX.toLocaleString("en-US")} characters.`)
    .optional(),
  retry: z.boolean().default(false),
});

export type RegenerateParagraphInput = z.infer<typeof regenerateParagraphSchema>;
