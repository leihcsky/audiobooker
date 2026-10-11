import { describe, expect, it } from "vitest";
import { ALL_VOICES } from "@/lib/tts/voices";
import { voiceGenderLabel, voiceLabel } from "@/lib/voices/voice-label";

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
