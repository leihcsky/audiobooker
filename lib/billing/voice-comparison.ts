/**
 * Shared Standard vs Premium positioning for Pricing and Studio.
 * Listening hours stay derived from PLANS; this file is copy and sample wiring only.
 */

export type VoiceComparisonRow = {
  label: string;
  standard: string;
  premium: string;
};

/** Same-script clips for the Pricing comparison players. Omit until both files exist. */
export type VoiceComparisonSample = {
  /** Shared English script both clips narrate. */
  scriptLabel: string;
  standard: { src: string; voiceLabel: string };
  premium: { src: string; voiceLabel: string };
};

export const VOICE_COMPARISON_ROWS: readonly VoiceComparisonRow[] = [
  {
    label: "Best for",
    standard: "Everyday listening",
    premium: "High-quality audiobook narration",
  },
  {
    label: "Sound",
    standard: "Clear and practical",
    premium: "More natural and expressive",
  },
  {
    label: "Delivery",
    standard: "Straightforward narration",
    premium: "Richer tone and emotion",
  },
  {
    label: "Dialogue",
    standard: "Fine for ordinary conversation",
    premium: "Better for character dialogue",
  },
  {
    label: "Content",
    standard: "Articles, documents, and novels",
    premium: "Stories and long-form fiction",
  },
  {
    label: "How you use it",
    standard: "Included with Free and Creator",
    premium: "Premium Minutes or Pay-per-Book",
  },
];

/**
 * Paired clips must use the same English text. Leave null until both real
 * MP3s are in public/ — never show broken play controls.
 */
export const VOICE_COMPARISON_SAMPLE: VoiceComparisonSample | null = {
  scriptLabel: "Pride and Prejudice, Ch. 1 (public domain)",
  standard: {
    src: "/samples/voice-compare-standard.mp3",
    voiceLabel: "Ava · English (US) · Standard",
  },
  premium: {
    src: "/samples/voice-compare-premium.mp3",
    voiceLabel: "Lily Wolff - Expressive and kind · English (US) · Premium",
  },
};

export function voiceComparisonBlurb(): { title: string; subtitle: string; standard: string; premium: string } {
  return {
    title: "Choose the Right Voice for Your Audiobook",
    subtitle:
      "Whether you're creating audiobooks for everyday listening or looking for more expressive narration, Audiobooker has a voice option for you.",
    standard:
      "Perfect for everyday listening. A practical choice for converting ebooks into audio for personal listening.",
    premium:
      "For more natural and expressive narration. Ideal when storytelling, character dialogue, and narration quality matter.",
  };
}
