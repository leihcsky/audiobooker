export type TtsTier = "standard" | "premium";

/** What the requester's plan allows; resolved by the billing entitlement service. */
export type VoiceAccess = { premium: boolean };

export type TtsPurpose = "preview" | "generate";

export type VoiceDefinition = {
  id: string;
  provider: string;
  providerVoiceId: string;
  name: string;
  languageCode: string;
  languageName: string;
  gender?: string;
  tier: TtsTier;
  supportsPreview: boolean;
};

export type TTSGenerateInput = {
  text: string;
  voiceId: string;
  languageCode?: string;
  speed?: number;
};

export type TTSPreviewInput = TTSGenerateInput;

export type TTSGenerateResult = {
  audio: Buffer;
  mimeType: string;
  format: "MP3";
  durationSeconds?: number;
  characterCount: number;
  providerRequestId?: string;
};

export type ProviderLimits = {
  /** Preferred chunk size; the chunker packs text up to this length. */
  targetCharacters: number;
  /** Requests longer than this are rejected by the provider adapter. */
  hardLimitCharacters: number;
  /** Optional UTF-8 byte cap per chunk (protects CJK text). */
  maxBytes?: number;
};

export type CostEstimate = {
  providerId: string;
  model: string;
  characters: number;
  estimatedCost: number;
  currency: "USD";
};

export interface TTSProvider {
  readonly id: string;
  readonly name: string;
  readonly tier: TtsTier;
  readonly limits: ProviderLimits;
  isEnabled(): boolean;
  modelFor(purpose: TtsPurpose): string;
  listVoices(): VoiceDefinition[];
  getVoice(id: string): VoiceDefinition | null;
  preview(input: TTSPreviewInput): Promise<TTSGenerateResult>;
  generate(input: TTSGenerateInput): Promise<TTSGenerateResult>;
  /** Characters as the provider bills them; may differ from `text.length`. */
  billableCharacters(text: string): number;
  /** `characters` must already be counted with `billableCharacters`. */
  estimateCost(input: { characters: number; purpose: TtsPurpose }): CostEstimate;
}

export type TextChunk = {
  index: number;
  text: string;
  characterCount: number;
};

export type ChunkOptions = {
  maxCharacters: number;
  maxBytes?: number;
};
