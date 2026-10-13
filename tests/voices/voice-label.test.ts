import { describe, expect, it } from "vitest";
import { ALL_VOICES } from "@/lib/tts/voices";
import { groupVoices, voiceGenderLabel, voiceLabel } from "@/lib/voices/voice-label";

describe("voiceLabel", () => {
  it("shows the voice gender between the name and language", () => {
    expect(voiceLabel({ name: "Ava", languageName: "English (US)", gender: "female" })).toBe(
      "Ava · Female — English (US)",
    );
    expect(voiceLabel({ name: "Andrew", languageName: "English (US)", gender: "male" })).toBe(
      "Andrew · Male — English (US)",
    );
  });

  it("omits unknown or missing genders", () => {
    expect(voiceLabel({ name: "Custom", languageName: "English" })).toBe("Custom — English");
    expect(voiceLabel({ name: "Custom", languageName: "English", gender: "other" })).toBe(
      "Custom — English",
    );
  });

  it("labels every voice in the catalog", () => {
    for (const voice of ALL_VOICES) {
      expect(voiceGenderLabel(voice.gender)).not.toBeNull();
    }
  });
});

describe("groupVoices", () => {
  it("groups by tier then gender, standard first and female before male", () => {
    const groups = groupVoices([
      { id: "p-male", tier: "PREMIUM" as const, gender: "male" },
      { id: "s-male", tier: "STANDARD" as const, gender: "male" },
      { id: "p-neutral", tier: "PREMIUM" as const, gender: "neutral" },
      { id: "s-female", tier: "STANDARD" as const, gender: "female" },
      { id: "s-unknown", tier: "STANDARD" as const },
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Standard · Female",
      "Standard · Male",
      "Standard · Other",
      "Premium · Male (uses premium minutes)",
      "Premium · Neutral (uses premium minutes)",
    ]);
    expect(groups.flatMap((group) => group.voices.map((voice) => voice.id))).toEqual([
      "s-female",
      "s-male",
      "s-unknown",
      "p-male",
      "p-neutral",
    ]);
  });
});
