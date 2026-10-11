export const SPOKEN_WORDS_PER_MINUTE = 150;

export function formatSpokenMinutes(wordCount: number): string {
  if (wordCount <= 0) {
    return "0 min";
  }
  const minutes = wordCount / SPOKEN_WORDS_PER_MINUTE;
  if (minutes < 1) {
    return "< 1 min";
  }
  return `${Math.round(minutes)} min`;
}
