import type { PlanDefinition } from "@/lib/billing/plans";
import { FILE_LIMITS } from "@/lib/config/limits";
import { SPOKEN_WORDS_PER_MINUTE } from "@/lib/tts/narration-length";

/** Average English word plus its space and punctuation. */
export const CHARACTERS_PER_SPOKEN_WORD = 6;

/** Listening time a character budget buys, rounded down so the copy never overpromises. */
export function approxListeningHours(characters: number): number {
  const hours = characters / CHARACTERS_PER_SPOKEN_WORD / SPOKEN_WORDS_PER_MINUTE / 60;
  if (hours >= 10) {
    return Math.floor(hours / 5) * 5;
  }
  return Math.floor(hours * 2) / 2;
}

export function formatApproxListening(characters: number): string {
  const hours = approxListeningHours(characters);
  if (hours < 1) {
    const minutes = Math.floor((characters / CHARACTERS_PER_SPOKEN_WORD / SPOKEN_WORDS_PER_MINUTE) / 10) * 10;
    return `about ${Math.max(minutes, 10)} minutes`;
  }
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** What one free-tool session can narrate without an account. */
export function freeTrialListening(): string {
  return formatApproxListening(FILE_LIMITS.ANONYMOUS_TTS_SESSION_CHARS);
}

/** Monthly standard-voice narration up to the plan's fair-use line. */
export function planStandardListening(plan: PlanDefinition): string {
  return formatApproxListening(plan.standardMonthlySoftCharacters);
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
