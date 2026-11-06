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

type ElevenLabsVoiceSeed = [
  idSuffix: string,
  providerVoiceId: string,
  name: string,
  gender: "female" | "male" | "neutral",
  blurb: string,
];

/**
 * Curated ElevenLabs v4 English voices for audiobook-style narration.
 * Grouped by accent; short blurbs stay in `name` so narrators are easy to tell apart.
 */
const ELEVENLABS_US_VOICE_SEEDS: ElevenLabsVoiceSeed[] = [
  // Male
  ["adam", "bfGb7JTLUnZebZRiFYyq", "Adam", "male", "Distinct, deep and engaging"],
  ["sully", "wAGzRVkxKEs8La0lmdrE", "Sully", "male", "Mature, deep and intriguing"],
  ["henry", "pVnrL6sighQX7hVz89cp", "Henry", "male", "Deep, professional, and soothing"],
  ["michael-c-vincent", "uju3wxzG5OhpWcoi3SMy", "Michael C. Vincent", "male", "Confident, expressive"],
  ["wyatt", "YXpFCvM1S3JbWEJhoskW", "Wyatt", "male", "Wise rustic cowboy"],
  ["josh", "nzFihrBIvB34imQBuxub", "Josh", "male", "Teacher for kids"],
  ["bill-oxley", "T5cu6IU92Krx4mh43osx", "Bill Oxley", "male", "Mature American male"],
  ["flint", "qAZH0aMXY8tw1QufPN0D", "Flint", "male", "Deep, raspy, and warm"],
  ["spuds-oxley", "NOpBlnGInO9m6vDvFkFC", "Spuds Oxley", "male", "Grandpa"],
  // Female
  ["jessica-anne-bogart", "lxYfHSkYm1EzQzGhdbfc", "Jessica Anne Bogart", "female", "VO professional"],
  ["jessa", "yj30vwTGJxSHezdAGsv9", "Jessa", "female", "Easygoing and effortless"],
  ["arabella", "Z3R5wn05IrDiVCyEkUrK", "Arabella", "female", "Mysterious and emotive"],
  ["lily-wolff", "qBDvhofpxp92JgXJxDjB", "Lily Wolff", "female", "Expressive and kind"],
  ["maria-moody", "wGcFBfKz5yUQqhqr0mVy", "Maria Moody", "female", "Grandmotherly storykeeper"],
  ["empress", "MHPwHxLx0nmGIb5Jnbly", "Empress", "female", "Smoky, breathy, and neutral"],
  ["eve", "G4Wh6MqJNTzYtuAeMqv5", "Eve", "female", "Narrative and audiobooks"],
  ["mia", "rCuVrCHOUMY3OwyJBJym", "Mia", "female", "Clear, smooth, professional"],
];

const ELEVENLABS_AU_VOICE_SEEDS: ElevenLabsVoiceSeed[] = [
  // Female
  ["charlotte", "aRlmTYIQo6Tlg5SlulGC", "Charlotte", "female", "Soft, gentle, calming narration"],
  ["charlotte-meditation", "uhYnkYTBc711oAY590Ea", "Charlotte", "female", "Meditation & relaxation"],
  ["freya", "u8ADrbquiJqufR9XMtb8", "Freya", "female", "Confident, relatable narration"],
  ["aussie-margot", "uvxDZyxRISyWYoLZ1r0W", "Aussie Margot", "female", "Warm and sweet"],
  ["sammy", "QhzTYkz7VbKNwVeK3URf", "Sammy", "female", "Calm young narrator"],
  ["keira", "XuvMi7mpVgif9dcUzS0s", "Keira", "female", "Calm and natural"],
  // Male
  ["royce", "omRordDZNt4Gy45cetUa", "Royce", "male", "Suspense & mystery narration"],
  ["neil", "iIg0uI51lssRFauz7W21", "Neil", "male", "Soft Australian accent"],
  ["bailey", "mWNaiDAPDAx080ro4nL5", "Bailey", "male", "Natural conversational"],
  ["liam", "bVxvWZpqo0NXHobrj0ri", "Liam", "male", "Conversational POV narrator"],
  ["david", "CFN1FeTIoSu4xm6mDCkI", "David", "male", "Tech & storytelling"],
  ["neil-sammons", "ZpB89BxicW4UZeXaEdWo", "Neil Sammons", "male", "Deep & melodious"],
  ["australian-man", "oUbjcKlrUrhnYf9kwdmI", "Australian Man", "male", "Professional narration"],
];

const ELEVENLABS_GB_VOICE_SEEDS: ElevenLabsVoiceSeed[] = [
  // Male
  ["richard-basston", "i6icHCFicH3kzHTat04x", "Richard Basston", "male", "Deep"],
  ["nathaniel", "AeRdCCKzvd23BpJoofzx", "Nathaniel", "male", "Engaging, British and calm"],
  ["frederick-surrey", "j9jfwdrw7BRfcR43Qohk", "Frederick Surrey", "male", "Smooth and velvety"],
  ["owen", "giAoKpl5weRTCJK7uB9b", "Owen", "male", "Engaging and clear storyteller"],
  ["archer", "oQV06a7Gn8pbCJh5DXcO", "Archer", "male", "Clean, balanced and engaging"],
  ["johnny-kid", "8JVbfL6oEdmuxKn5DK2C", "Johnny Kid", "male", "Serious and calm narrator"],
  ["josh-midlands", "JxfH70f7jvYhi0DKD8Xs", "Josh", "male", "Mid twenties Midlands accent"],
  // Female
  ["verity-x", "1hlpeD1ydbI2ow0Tt3EW", "Verity X", "female", "Calm British narration"],
  ["rachel", "TYKLc7ViOIGE13dSZYlK", "Rachel", "female", "Friendly, energetic & authentic"],
  ["priyanka", "BpjGufoPiobT79j2vtj4", "Priyanka", "female", "Calm, neutral and relaxed"],
  ["ana", "rCmVtv8cYU60uhlsOo1M", "Ana", "female", "Emotional, warm and expressive"],
  ["amara", "GEcKlrQ1MWkJKoc7UTJd", "Amara", "female", "Calm, elegant and refined"],
  ["holly", "B9PDs7mcHTMxHUw5U8Cf", "Holly", "female", "Relaxing, velvety and silky"],
  ["sally-ford", "kBag1HOZlaVBH7ICPE8x", "Sally Ford", "female", "Warm, friendly and British"],
];

function mapElevenLabsSeeds(
  seeds: ElevenLabsVoiceSeed[],
  languageCode: string,
  languageName: string,
): VoiceDefinition[] {
  return seeds.map(([idSuffix, providerVoiceId, name, gender, blurb]) => ({
    id: `elevenlabs-${idSuffix}`,
    provider: "elevenlabs",
    providerVoiceId,
    name: `${name} — ${blurb}`,
    languageCode,
    languageName,
    gender,
    tier: "premium",
    supportsPreview: true,
    supportsSpeed: false,
  }));
}

/** ElevenLabs v4 voices (speed not supported by the model). */
export const ELEVENLABS_VOICES: VoiceDefinition[] = [
  ...mapElevenLabsSeeds(ELEVENLABS_US_VOICE_SEEDS, "en-US", "English (US)"),
  ...mapElevenLabsSeeds(ELEVENLABS_GB_VOICE_SEEDS, "en-GB", "English (UK)"),
  ...mapElevenLabsSeeds(ELEVENLABS_AU_VOICE_SEEDS, "en-AU", "English (Australia)"),
];

/** MiniMax Speech voices on Replicate (active when generate model is MiniMax). */
export const REPLICATE_MINIMAX_VOICES: VoiceDefinition[] = [
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

/** @deprecated Prefer REPLICATE_MINIMAX_VOICES or activeReplicateVoices(). */
export const REPLICATE_VOICES = REPLICATE_MINIMAX_VOICES;

type GeminiVoiceSeed = [name: string, gender: "female" | "male" | "neutral"];

/** Gemini 3.8 Flash TTS studio voices (https://replicate.com/google/gemini-3.8-flash-tts). */
const GEMINI_VOICE_SEEDS: GeminiVoiceSeed[] = [
  ["Zephyr", "female"],
  ["Puck", "male"],
  ["Charon", "male"],
  ["Kore", "female"],
  ["Fenrir", "male"],
  ["Leda", "female"],
  ["Orus", "male"],
  ["Aoede", "female"],
  ["Callirrhoe", "female"],
  ["Autonoe", "female"],
  ["Enceladus", "male"],
  ["Iapetus", "male"],
  ["Umbriel", "male"],
  ["Algieba", "male"],
  ["Despina", "female"],
  ["Erinome", "female"],
  ["Algenib", "male"],
  ["Rasalgethi", "male"],
  ["Laomedeia", "female"],
  ["Achernar", "female"],
  ["Alnilam", "male"],
  ["Schedar", "male"],
  ["Gacrux", "female"],
  ["Pulcherrima", "female"],
  ["Achird", "male"],
  ["Zubenelgenubi", "male"],
  ["Vindemiatrix", "female"],
  ["Sadachbia", "female"],
  ["Sadaltager", "male"],
  ["Sulafat", "female"],
];

export const REPLICATE_GEMINI_VOICES: VoiceDefinition[] = GEMINI_VOICE_SEEDS.map(
  ([name, gender]) => ({
    id: `replicate-gemini-${name.toLowerCase()}`,
    provider: "replicate",
    providerVoiceId: name,
    name,
    languageCode: "en",
    languageName: "Multilingual",
    gender,
    tier: "premium",
    supportsPreview: true,
    supportsSpeed: false,
  }),
);

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

export const ALL_VOICES: VoiceDefinition[] = [
  ...EDGE_VOICES,
  ...REPLICATE_MINIMAX_VOICES,
  ...REPLICATE_GEMINI_VOICES,
  ...ELEVENLABS_VOICES,
  ...OPENAI_VOICES,
];

export function findEdgeVoice(id: string): VoiceDefinition | null {
  return EDGE_VOICES.find((voice) => voice.id === id) ?? null;
}

export function findOpenAIVoice(id: string): VoiceDefinition | null {
  return OPENAI_VOICES.find((voice) => voice.id === id) ?? null;
}

export function findElevenLabsVoice(id: string): VoiceDefinition | null {
  return ELEVENLABS_VOICES.find((voice) => voice.id === id) ?? null;
}

export function findReplicateVoice(id: string): VoiceDefinition | null {
  return (
    REPLICATE_MINIMAX_VOICES.find((voice) => voice.id === id) ??
    REPLICATE_GEMINI_VOICES.find((voice) => voice.id === id) ??
    null
  );
}

export function findVoice(id: string): VoiceDefinition | null {
  return ALL_VOICES.find((voice) => voice.id === id) ?? null;
}
