import { z } from "zod";
import { voiceIdSchema } from "@/lib/validation/tts";

export const payPerBookQuoteSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  chapterIds: z.array(z.string().uuid("Invalid chapter ID.")).min(1).max(1000),
  voiceId: voiceIdSchema,
  speed: z.number().min(0.5).max(2).optional(),
});

export const payPerBookCheckoutSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID."),
});

export type PayPerBookQuoteInput = z.infer<typeof payPerBookQuoteSchema>;
export type PayPerBookCheckoutInput = z.infer<typeof payPerBookCheckoutSchema>;
