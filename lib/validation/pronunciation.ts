import { z } from "zod";

export const PRONUNCIATION_TERM_MAX = 100;
export const PRONUNCIATION_REPLACEMENT_MAX = 200;

const oneLine = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`)
    .refine((value) => !/[\r\n]/.test(value), `${label} must be one line.`);

const ruleFields = {
  term: oneLine("Word", PRONUNCIATION_TERM_MAX),
  replacement: oneLine("Say it as", PRONUNCIATION_REPLACEMENT_MAX),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(true),
};

const differentReplacement = {
  message: "“Say it as” must be different from the word.",
  path: ["replacement"],
};

export const createPronunciationSchema = z
  .object(ruleFields)
  .refine((value) => value.term !== value.replacement, differentReplacement);

export const updatePronunciationSchema = z
  .object({
    term: ruleFields.term.optional(),
    replacement: ruleFields.replacement.optional(),
    caseSensitive: z.boolean().optional(),
    wholeWord: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required.",
  });

export const previewPronunciationSchema = z
  .object({
    ...ruleFields,
    voiceId: z.string().trim().min(1, "Choose a voice.").max(100),
    speed: z.number().optional(),
  })
  .refine((value) => value.term !== value.replacement, differentReplacement);

export const pronunciationIdSchema = z.string().uuid("Invalid pronunciation entry ID.");

export type CreatePronunciationInput = z.infer<typeof createPronunciationSchema>;
export type UpdatePronunciationInput = z.infer<typeof updatePronunciationSchema>;
export type PreviewPronunciationInput = z.infer<typeof previewPronunciationSchema>;
