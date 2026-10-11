/**
 * Conservative narration rates used to reserve premium seconds before a
 * job runs. Real speech is faster (about 15 characters per second for
 * English), so reservations normally exceed the captured amount.
 */
const RESERVE_CHARACTERS_PER_SECOND = 12.5;
const RESERVE_CJK_CHARACTERS_PER_SECOND = 4;
const CJK_LANGUAGES = ["zh", "ja", "ko"];

/**
 * Premium minutes are counted at normal speed: provider cost follows the
 * text, so the chosen speech speed does not change the estimate.
 */
export function estimatePremiumSeconds(input: {
  characters: number;
  languageCode?: string | null;
}): number {
  if (input.characters <= 0) {
    return 0;
  }
  const language = input.languageCode?.toLowerCase().split("-")[0] ?? "";
  const rate = CJK_LANGUAGES.includes(language)
    ? RESERVE_CJK_CHARACTERS_PER_SECOND
    : RESERVE_CHARACTERS_PER_SECOND;
  return Math.ceil(input.characters / rate);
}

/**
 * Audio duration converted back to normal speed (a 2× read of 30 seconds
 * bills 60). Characters served from the TTS cache are not charged.
 */
export function billablePremiumSeconds(input: {
  durationSeconds: number;
  speed: number;
  characters: number;
  billableCharacters: number;
}): number {
  if (input.durationSeconds <= 0 || input.characters <= 0 || input.billableCharacters <= 0) {
    return 0;
  }
  const speed = input.speed > 0 ? input.speed : 1;
  const share = Math.min(1, input.billableCharacters / input.characters);
  return Math.ceil(input.durationSeconds * speed * share);
}

export function remainingMinutes(seconds: number): number {
  return Math.max(0, Math.floor(seconds / 60));
}

export function estimatedMinutes(seconds: number): number {
  return Math.max(seconds > 0 ? 1 : 0, Math.ceil(seconds / 60));
}
