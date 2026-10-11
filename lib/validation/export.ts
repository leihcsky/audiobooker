import { z } from "zod";

export const exportMp3Schema = z
  .object({
    includeMetadata: z.boolean().optional(),
  })
  .optional()
  .transform((value) => ({
    includeMetadata: value?.includeMetadata ?? true,
  }));

export const exportM4bSchema = z
  .object({
    includeCover: z.boolean().optional(),
  })
  .optional()
  .transform((value) => ({
    includeCover: value?.includeCover ?? true,
  }));

export const exportIdSchema = z.string().uuid("Invalid export ID.");

export type ExportMp3Input = z.infer<typeof exportMp3Schema>;
export type ExportM4bInput = z.infer<typeof exportM4bSchema>;
