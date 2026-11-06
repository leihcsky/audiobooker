/** Split catalog language labels into language + accent for the voice picker. */

export type VoiceLocaleParts = {
  language: string;
  accent: string;
};

const REGION_ACCENT: Record<string, string> = {
  US: "American",
  GB: "British",
  UK: "British",
  AU: "Australian",
  AUSTRALIA: "Australian",
  MX: "Mexican",
  ES: "Spain",
  BR: "Brazilian",
  CN: "Mandarin",
  JP: "Japanese",
  KR: "Korean",
  FR: "French",
  DE: "German",
  IT: "Italian",
};

/**
 * Prefer parsing `languageName` like "English (US)" / "Chinese (Mandarin)".
 * Falls back to the BCP-47 region on `language` / `languageCode`.
 */
export function voiceLocaleParts(input: {
  languageName: string;
  language?: string;
  languageCode?: string;
}): VoiceLocaleParts {
  const name = input.languageName.trim();
  const match = name.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (match) {
    const language = match[1].trim();
    const rawAccent = match[2].trim();
    return {
      language,
      accent: REGION_ACCENT[rawAccent.toUpperCase()] ?? rawAccent,
    };
  }

  const code = (input.languageCode ?? input.language ?? "").trim();
  const [lang, region] = code.split("-");
  if (lang && region) {
    const language =
      lang.toLowerCase() === "en"
        ? "English"
        : lang.toLowerCase() === "zh"
          ? "Chinese"
          : lang.toUpperCase();
    return {
      language,
      accent: REGION_ACCENT[region.toUpperCase()] ?? region.toUpperCase(),
    };
  }

  return { language: name || "Other", accent: "Default" };
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
