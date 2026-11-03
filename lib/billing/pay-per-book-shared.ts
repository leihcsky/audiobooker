import { normalizeSpeechSpeed } from "@/lib/tts/speed";

export type PayPerBookQuoteDto = {
  id: string;
  projectId: string;
  selectedChapterIds: string[];
  selectedWordCount: number;
  /** Whole minutes for compact display; prefer `estimatedSeconds` + formatSpokenLength. */
  estimatedMinutes: number;
  /** Same seconds basis as bookStats / SelectionSummary for the quoted chapters. */
  estimatedSeconds: number;
  billableMinutes: number;
  pricePerMinute: number;
  totalAmount: number;
  currency: string;
  provider: string;
  voiceId: string;
  voiceName: string;
  speed: number;
  expiresAt: string;
  createdAt: string;
};

export type PayPerBookOrderDto = {
  id: string;
  billingOrderId: string;
  projectId: string;
  status: string;
  totalAmount: number;
  currency: string;
  billableMinutes: number;
  voiceId: string;
  voiceName: string;
  speed: number;
  paidAt: string | null;
  generationJobId: string | null;
  chapters: Array<{
    id: string;
    chapterId: string | null;
    title: string;
    wordCount: number;
    status: string;
  }>;
};

export function chaptersNeedingPayPerBookRegen(input: {
  chapters: Array<{
    id: string;
    included: boolean;
    hasAudio: boolean;
    audioOutdated: boolean;
    selectedVoiceId: string | null;
    selectedSpeed: number;
  }>;
  voiceId: string;
  speed: number;
}): string[] {
  const speed = normalizeSpeechSpeed(input.speed);
  return input.chapters
    .filter((chapter) => {
      if (!chapter.included || !chapter.hasAudio) {
        return false;
      }
      if (chapter.audioOutdated) {
        return true;
      }
      return (
        chapter.selectedVoiceId !== input.voiceId ||
        normalizeSpeechSpeed(chapter.selectedSpeed) !== speed
      );
    })
    .map((chapter) => chapter.id);
}
