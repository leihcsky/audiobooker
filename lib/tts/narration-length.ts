export const SPOKEN_WORDS_PER_MINUTE = 150;
/** Chinese, Japanese and Korean are read per character, roughly 270 per minute. */
export const SPOKEN_CJK_CHARACTERS_PER_SECOND = 4.5;

const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

/** Rough listening time of a text at normal speed, before any audio exists. */
export function estimateNarrationSeconds(text: string): number {
  const cjkCharacters = text.match(CJK_CHARACTER)?.length ?? 0;
  const rest = text.replace(CJK_CHARACTER, " ").trim();
  const words = rest ? rest.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length : 0;
  return Math.round((words / SPOKEN_WORDS_PER_MINUTE) * 60 + cjkCharacters / SPOKEN_CJK_CHARACTERS_PER_SECOND);
}

export function formatSpokenLength(seconds: number): string {
  if (seconds <= 0) {
    return "0 min";
  }
  if (seconds < 60) {
    return "< 1 min";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatSpokenMinutes(wordCount: number): string {
  return formatSpokenLength((wordCount / SPOKEN_WORDS_PER_MINUTE) * 60);
}
