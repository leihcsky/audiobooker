import { describe, expect, it } from "vitest";
import { voiceLocaleParts } from "@/lib/voices/voice-locale";

describe("voiceLocaleParts", () => {
  it("parses English regional labels into language and accent", () => {
    expect(voiceLocaleParts({ languageName: "English (US)", language: "en-US" })).toEqual({
      language: "English",
      accent: "American",
    });
    expect(voiceLocaleParts({ languageName: "English (UK)", language: "en-GB" })).toEqual({
      language: "English",
      accent: "British",
    });
    expect(voiceLocaleParts({ languageName: "English (Australia)", language: "en-AU" })).toEqual({
      language: "English",
      accent: "Australian",
    });
  });

  it("keeps descriptive accents from the language name", () => {
    expect(voiceLocaleParts({ languageName: "Chinese (Mandarin)", language: "zh-CN" })).toEqual({
      language: "Chinese",
      accent: "Mandarin",
    });
  });

  it("falls back when there is no parenthetical accent", () => {
    expect(voiceLocaleParts({ languageName: "Multilingual", language: "en" })).toEqual({
      language: "Multilingual",
      accent: "Default",
    });
  });
});
