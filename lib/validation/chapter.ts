import { z } from "zod";
import { FILE_LIMITS } from "@/lib/config/limits";

export const updateChapterSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Chapter title can't be empty.")
      .max(500, "Chapter title is too long.")
      .optional(),
    sourceText: z
      .string()
      .trim()
      .min(1, "Chapter text can't be empty.")
      .max(
        FILE_LIMITS.MAX_CHAPTER_TEXT_LENGTH,
        `Chapter text can be at most ${FILE_LIMITS.MAX_CHAPTER_TEXT_LENGTH.toLocaleString("en-US")} characters.`,
      )
      .optional(),
  })
  .refine((value) => value.title !== undefined || value.sourceText !== undefined, {
    message: "Nothing to update.",
  });

export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;

export const reorderChaptersSchema = z.object({
  chapterIds: z.array(z.string().uuid("Invalid chapter ID.")).min(1),
});
