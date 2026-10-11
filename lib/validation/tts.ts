import { z } from "zod";
import { MIN_SPEECH_SPEED, MAX_SPEECH_SPEED } from "@/lib/tts/speed";

export const voiceIdSchema = z
  .string()
  .trim()
  .min(1, "Voice is required.")
  .max(64)
  .regex(/^[a-z0-9-]+$/i, "Invalid voice ID.");

export const ttsQualitySchema = z.enum(["standard", "premium"]);

export const generateChapterSchema = z.object({
  voiceId: voiceIdSchema,
  speed: z.number().min(MIN_SPEECH_SPEED).max(MAX_SPEECH_SPEED).optional(),
  quality: ttsQualitySchema.optional(),
});

export const generateProjectSchema = generateChapterSchema.extend({
  chapterIds: z.array(z.string().uuid("Invalid chapter ID.")).min(1).max(1000).optional(),
});

export const previewVoiceSchema = z.object({
  text: z.string().trim().max(200, "Preview text must be 200 characters or fewer.").optional(),
  speed: z.number().min(MIN_SPEECH_SPEED).max(MAX_SPEECH_SPEED).optional(),
});

export const voicesQuerySchema = z.object({
  language: z.string().trim().min(1).max(20).optional(),
  provider: z.string().trim().min(1).max(40).optional(),
  tier: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(ttsQualitySchema)
    .optional(),
});
