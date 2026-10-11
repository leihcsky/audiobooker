import type { VoiceDefinition } from "@/lib/tts/types";

export const OPENAI_VOICES: VoiceDefinition[] = [
  {
    id: "openai-alloy",
    provider: "openai",
    providerVoiceId: "alloy",
    name: "Alloy",
    languageCode: "en-US",
    languageName: "English (US)",
    gender: "neutral",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "openai-echo",
    provider: "openai",
    providerVoiceId: "echo",
    name: "Echo",
    languageCode: "en-US",
    languageName: "English (US)",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "openai-fable",
    provider: "openai",
    providerVoiceId: "fable",
    name: "Fable",
    languageCode: "en-US",
    languageName: "English (US)",
    gender: "neutral",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "openai-onyx",
    provider: "openai",
    providerVoiceId: "onyx",
    name: "Onyx",
    languageCode: "en-US",
    languageName: "English (US)",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "openai-nova",
    provider: "openai",
    providerVoiceId: "nova",
    name: "Nova",
    languageCode: "en-US",
    languageName: "English (US)",
    gender: "female",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "openai-shimmer",
    provider: "openai",
    providerVoiceId: "shimmer",
    name: "Shimmer",
    languageCode: "en-US",
    languageName: "English (US)",
    gender: "female",
    tier: "premium",
    supportsPreview: true,
  },
];

export const REPLICATE_VOICES: VoiceDefinition[] = [
  {
    id: "replicate-wise-woman",
    provider: "replicate",
    providerVoiceId: "Wise_Woman",
    name: "Wise Woman",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "female",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-deep-voice-man",
    provider: "replicate",
    providerVoiceId: "Deep_Voice_Man",
    name: "Deep Voice Man",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-imposing-manner",
    provider: "replicate",
    providerVoiceId: "Imposing_Manner",
    name: "Imposing Manner",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-elegant-man",
    provider: "replicate",
    providerVoiceId: "Elegant_Man",
    name: "Elegant Man",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-casual-guy",
    provider: "replicate",
    providerVoiceId: "Casual_Guy",
    name: "Casual Guy",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-friendly-person",
    provider: "replicate",
    providerVoiceId: "Friendly_Person",
    name: "Friendly Person",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "neutral",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-decent-boy",
    provider: "replicate",
    providerVoiceId: "Decent_Boy",
    name: "Decent Boy",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-lively-girl",
    provider: "replicate",
    providerVoiceId: "Lively_Girl",
    name: "Lively Girl",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "female",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-exuberant-girl",
    provider: "replicate",
    providerVoiceId: "Exuberant_Girl",
    name: "Exuberant Girl",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "female",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-inspirational-girl",
    provider: "replicate",
    providerVoiceId: "Inspirational_girl",
    name: "Inspirational Girl",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "female",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-young-knight",
    provider: "replicate",
    providerVoiceId: "Young_Knight",
    name: "Young Knight",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "male",
    tier: "premium",
    supportsPreview: true,
  },
  {
    id: "replicate-abbess",
    provider: "replicate",
    providerVoiceId: "Abbess",
    name: "Abbess",
    languageCode: "en",
    languageName: "Multilingual",
    gender: "female",
    tier: "premium",
    supportsPreview: true,
  },
];

type EdgeVoiceSeed = [shortName: string, name: string, gender: "female" | "male", languageName: string];

const EDGE_VOICE_SEEDS: EdgeVoiceSeed[] = [
  ["en-US-AvaNeural", "Ava", "female", "English (US)"],
  ["en-US-AndrewNeural", "Andrew", "male", "English (US)"],
  ["en-US-EmmaNeural", "Emma", "female", "English (US)"],
  ["en-US-BrianNeural", "Brian", "male", "English (US)"],
  ["en-US-AriaNeural", "Aria", "female", "English (US)"],
  ["en-US-JennyNeural", "Jenny", "female", "English (US)"],
  ["en-US-GuyNeural", "Guy", "male", "English (US)"],
  ["en-US-ChristopherNeural", "Christopher", "male", "English (US)"],
  ["en-GB-SoniaNeural", "Sonia", "female", "English (UK)"],
  ["en-GB-RyanNeural", "Ryan", "male", "English (UK)"],
  ["en-AU-NatashaNeural", "Natasha", "female", "English (Australia)"],
  ["zh-CN-XiaoxiaoNeural", "Xiaoxiao", "female", "Chinese (Mandarin)"],
  ["zh-CN-YunxiNeural", "Yunxi", "male", "Chinese (Mandarin)"],
  ["zh-CN-YunjianNeural", "Yunjian", "male", "Chinese (Mandarin)"],
  ["zh-CN-XiaoyiNeural", "Xiaoyi", "female", "Chinese (Mandarin)"],
  ["es-ES-ElviraNeural", "Elvira", "female", "Spanish (Spain)"],
  ["es-ES-AlvaroNeural", "Álvaro", "male", "Spanish (Spain)"],
  ["es-MX-DaliaNeural", "Dalia", "female", "Spanish (Mexico)"],
  ["es-MX-JorgeNeural", "Jorge", "male", "Spanish (Mexico)"],
  ["fr-FR-DeniseNeural", "Denise", "female", "French"],
  ["fr-FR-HenriNeural", "Henri", "male", "French"],
  ["de-DE-KatjaNeural", "Katja", "female", "German"],
  ["de-DE-ConradNeural", "Conrad", "male", "German"],
  ["it-IT-ElsaNeural", "Elsa", "female", "Italian"],
  ["it-IT-DiegoNeural", "Diego", "male", "Italian"],
  ["pt-BR-FranciscaNeural", "Francisca", "female", "Portuguese (Brazil)"],
  ["pt-BR-AntonioNeural", "Antônio", "male", "Portuguese (Brazil)"],
  ["ja-JP-NanamiNeural", "Nanami", "female", "Japanese"],
  ["ja-JP-KeitaNeural", "Keita", "male", "Japanese"],
  ["ko-KR-SunHiNeural", "SunHi", "female", "Korean"],
  ["ko-KR-InJoonNeural", "InJoon", "male", "Korean"],
];

export const EDGE_VOICES: VoiceDefinition[] = EDGE_VOICE_SEEDS.map(
  ([shortName, name, gender, languageName]) => {
    const languageCode = shortName.split("-").slice(0, 2).join("-");
    return {
      id: `edge-${languageCode.toLowerCase()}-${name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()}`,
      provider: "edge",
      providerVoiceId: shortName,
      name,
      languageCode,
      languageName,
      gender,
      tier: "standard",
      supportsPreview: true,
    };
  },
);

export const ALL_VOICES: VoiceDefinition[] = [...EDGE_VOICES, ...REPLICATE_VOICES, ...OPENAI_VOICES];

export function findEdgeVoice(id: string): VoiceDefinition | null {
  return EDGE_VOICES.find((voice) => voice.id === id) ?? null;
}

export function findOpenAIVoice(id: string): VoiceDefinition | null {
  return OPENAI_VOICES.find((voice) => voice.id === id) ?? null;
}

export function findReplicateVoice(id: string): VoiceDefinition | null {
  return REPLICATE_VOICES.find((voice) => voice.id === id) ?? null;
}

export function findVoice(id: string): VoiceDefinition | null {
  return ALL_VOICES.find((voice) => voice.id === id) ?? null;
}
