export type VoiceLabelInput = {
  name: string;
  languageName: string;
  gender?: string | null;
};

const GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  neutral: "Neutral",
};

export function voiceGenderLabel(gender: string | null | undefined): string | null {
  return gender ? GENDER_LABELS[gender.toLowerCase()] ?? null : null;
}

export function voiceLabel(voice: VoiceLabelInput): string {
  const gender = voiceGenderLabel(voice.gender);
  return gender
    ? `${voice.name} · ${gender} — ${voice.languageName}`
    : `${voice.name} — ${voice.languageName}`;
}
