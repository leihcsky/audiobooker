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

type GroupableVoice = { gender?: string | null; tier: "STANDARD" | "PREMIUM" };

export type VoiceGroup<T> = { key: string; label: string; voices: T[] };

const TIER_ORDER = ["STANDARD", "PREMIUM"] as const;
const GENDER_ORDER = ["Female", "Male", "Neutral", null] as const;

/** Select optgroups by tier, then gender, e.g. "Standard · Female", in a stable order. */
export function groupVoices<T extends GroupableVoice>(voices: T[]): VoiceGroup<T>[] {
  const groups: VoiceGroup<T>[] = [];
  for (const tier of TIER_ORDER) {
    const tierName = tier === "STANDARD" ? "Standard" : "Premium";
    const suffix = tier === "PREMIUM" ? " (uses premium minutes)" : "";
    for (const gender of GENDER_ORDER) {
      const members = voices.filter(
        (voice) => voice.tier === tier && voiceGenderLabel(voice.gender) === gender,
      );
      if (members.length > 0) {
        groups.push({
          key: `${tier}:${gender ?? "other"}`,
          label: `${tierName} · ${gender ?? "Other"}${suffix}`,
          voices: members,
        });
      }
    }
  }
  return groups;
}

export function voiceLabel(voice: VoiceLabelInput): string {
  const gender = voiceGenderLabel(voice.gender);
  return gender
    ? `${voice.name} · ${gender} — ${voice.languageName}`
    : `${voice.name} — ${voice.languageName}`;
}
