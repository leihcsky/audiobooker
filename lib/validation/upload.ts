import { z } from "zod";

export const presignUploadSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().trim().min(1).max(255).optional(),
  sizeBytes: z.number().int().positive(),
}).transform((value) => ({
  projectId: value.projectId,
  filename: value.filename,
  mimeType: value.contentType ?? value.mimeType ?? "",
  sizeBytes: value.sizeBytes,
}));

export const confirmSourceFileSchema = z.object({
  objectKey: z.string().trim().min(1).max(1024),
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().trim().min(1).max(255).optional(),
  sizeBytes: z.number().int().positive(),
}).transform((value) => ({
  objectKey: value.objectKey,
  originalFilename: value.originalFilename,
  mimeType: value.contentType ?? value.mimeType ?? "",
  sizeBytes: value.sizeBytes,
}));

export const parseSourceSchema = z.object({
  sourceFileId: z.string().uuid("Invalid source file ID."),
});

export const jobIdSchema = z.string().uuid("Invalid job ID.");
export const chapterIdSchema = z.string().uuid("Invalid chapter ID.");

export const selectChaptersSchema = z.object({
  includedIds: z.array(z.string().uuid("Invalid chapter ID.")),
});
