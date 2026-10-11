import { z } from "zod";

export const projectStatusSchema = z.enum([
  "DRAFT",
  "PROCESSING",
  "READY",
  "ARCHIVED",
  "FAILED",
]);

const optionalNullableText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= max, {
      message: `Must be at most ${max} characters.`,
    });

export const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(255, "Title must be at most 255 characters."),
  author: optionalNullableText(255).optional(),
  description: optionalNullableText(5000).optional(),
  language: z
    .string()
    .trim()
    .max(20, "Language must be at most 20 characters.")
    .optional(),
});

export const updateProjectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(255, "Title must be at most 255 characters.")
      .optional(),
    author: optionalNullableText(255).optional(),
    description: optionalNullableText(5000).optional(),
    language: z
      .string()
      .trim()
      .max(20, "Language must be at most 20 characters.")
      .optional(),
    narrator: optionalNullableText(255).optional(),
    publisher: optionalNullableText(255).optional(),
    copyright: optionalNullableText(255).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.author !== undefined ||
      value.description !== undefined ||
      value.language !== undefined ||
      value.narrator !== undefined ||
      value.publisher !== undefined ||
      value.copyright !== undefined,
    { message: "At least one field is required." },
  );

export const updateMetadataSchema = updateProjectSchema;

export const projectIdSchema = z
  .string()
  .uuid("Invalid project ID.");

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: projectStatusSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
