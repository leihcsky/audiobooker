import { resolveVoice } from "@/lib/tts";
import { buildTtsCacheKey, DEFAULT_PITCH, DEFAULT_VOLUME, readTtsCache, writeTtsCache } from "@/lib/tts/cache";
import { estimateMp3DurationSeconds } from "@/lib/tts/mp3";
import { withTtsRetry } from "@/lib/tts/retry";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";
import { DEFAULT_NARRATOR_CREDIT } from "@/lib/publish/disclosure";
import { assertPremiumPreviewBudget, recordVoicePreview } from "@/lib/usage/usage.service";

type CreditsTemplate = {
  writtenBy: (author: string) => string;
  narratedBy: (narrator: string) => string;
  digitalVoice: string;
  join: (parts: string[]) => string;
};

const sentence = (parts: string[]) => parts.map((part) => (/[.!?]$/.test(part) ? part : `${part}.`)).join(" ");
const cjk = (parts: string[]) => parts.map((part) => (/[。！？]$/.test(part) ? part : `${part}。`)).join("");

const TEMPLATES: Record<string, CreditsTemplate> = {
  en: { writtenBy: (a) => `Written by ${a}`, narratedBy: (n) => `Narrated by ${n}`, digitalVoice: "a digital voice", join: sentence },
  es: { writtenBy: (a) => `Escrito por ${a}`, narratedBy: (n) => `Narrado por ${n}`, digitalVoice: "una voz digital", join: sentence },
  fr: { writtenBy: (a) => `Écrit par ${a}`, narratedBy: (n) => `Lu par ${n}`, digitalVoice: "une voix numérique", join: sentence },
  de: { writtenBy: (a) => `Geschrieben von ${a}`, narratedBy: (n) => `Gelesen von ${n}`, digitalVoice: "einer digitalen Stimme", join: sentence },
  it: { writtenBy: (a) => `Scritto da ${a}`, narratedBy: (n) => `Letto da ${n}`, digitalVoice: "una voce digitale", join: sentence },
  pt: { writtenBy: (a) => `Escrito por ${a}`, narratedBy: (n) => `Narrado por ${n}`, digitalVoice: "uma voz digital", join: sentence },
  zh: { writtenBy: (a) => `作者：${a}`, narratedBy: (n) => `朗读：${n}`, digitalVoice: "数字语音", join: cjk },
  ja: { writtenBy: (a) => `著者、${a}`, narratedBy: (n) => `朗読、${n}`, digitalVoice: "デジタル音声", join: cjk },
};

/** "Title. Written by Author. Narrated by Narrator." in the book's language, English otherwise. */
export function buildOpeningCreditsText(input: {
  title: string;
  author: string | null;
  narrator: string | null;
  language: string;
}): string {
  const template = TEMPLATES[input.language.split("-")[0]?.toLowerCase() ?? "en"] ?? TEMPLATES.en;
  const narrator = input.narrator?.trim();
  const isDigital = !narrator || narrator.toLowerCase() === DEFAULT_NARRATOR_CREDIT.toLowerCase();
  const parts = [input.title.trim()];
  if (input.author?.trim()) {
    parts.push(template.writtenBy(input.author.trim()));
  }
  parts.push(template.narratedBy(isDigital ? template.digitalVoice : narrator));
  return template.join(parts);
}

/** Synthesizes the credits through the TTS cache; premium voices are budget-checked like previews. */
export async function synthesizeOpeningCredits(input: {
  userId: string;
  text: string;
  voiceId: string;
  speed: number;
}): Promise<Buffer> {
  const { voice, provider } = resolveVoice({ premium: true }, input.voiceId);
  const speed = normalizeSpeechSpeed(input.speed);
  const model = provider.modelFor("preview");
  const key = buildTtsCacheKey({
    provider: provider.id,
    providerModel: model,
    providerVoiceId: voice.providerVoiceId,
    language: voice.languageCode,
    speed,
    pitch: DEFAULT_PITCH,
    volume: DEFAULT_VOLUME,
    text: input.text,
  });
  const cached = await readTtsCache(key.cacheKey);
  if (cached) {
    return cached.audio;
  }

  const billedCharacters = provider.billableCharacters(input.text);
  if (voice.tier === "premium") {
    await assertPremiumPreviewBudget(
      provider.estimateCost({ characters: billedCharacters, purpose: "preview" }).estimatedCost,
    );
  }
  const result = await withTtsRetry(() => provider.preview({ text: input.text, voiceId: voice.id, speed }));
  await writeTtsCache({
    key,
    provider: provider.id,
    providerModel: model,
    providerVoiceId: voice.providerVoiceId,
    characters: input.text.length,
    audio: result.audio,
    durationSeconds: estimateMp3DurationSeconds(result.audio),
  });
  await recordVoicePreview({
    userId: input.userId,
    voiceId: voice.id,
    characters: input.text.length,
    billedCharacters,
    provider: provider.id,
  });
  return result.audio;
}
