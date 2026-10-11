import type { CostEstimate, TtsPurpose } from "@/lib/tts/types";

export type ProviderPricing = {
  providerId: string;
  model: string;
  inputPricePer1KCharacters: number;
  currency: "USD";
};

const DEFAULT_PRICING: ProviderPricing[] = [
  { providerId: "edge", model: "edge-neural", inputPricePer1KCharacters: 0, currency: "USD" },
  {
    providerId: "replicate",
    model: "minimax/speech-2.8-hd",
    inputPricePer1KCharacters: readPrice("REPLICATE_HD_PRICE_PER_1K_CHARS", 0.1),
    currency: "USD",
  },
  {
    providerId: "replicate",
    model: "minimax/speech-2.8-turbo",
    inputPricePer1KCharacters: readPrice("REPLICATE_TURBO_PRICE_PER_1K_CHARS", 0.06),
    currency: "USD",
  },
  {
    providerId: "openai",
    model: "tts-1",
    inputPricePer1KCharacters: readPrice("OPENAI_TTS_PRICE_PER_1K_CHARS", 0.015),
    currency: "USD",
  },
];

const HAN_CHARACTER = /\p{Script=Han}/gu;

/** MiniMax bills each Chinese (Han) character as 2 characters; everything else as 1. */
export function countMiniMaxBillableCharacters(text: string): number {
  return text.length + (text.match(HAN_CHARACTER)?.length ?? 0);
}

export function findPricing(providerId: string, model: string): ProviderPricing | null {
  return (
    DEFAULT_PRICING.find((item) => item.providerId === providerId && item.model === model) ?? null
  );
}

/**
 * Unknown premium models are priced with the most expensive known rate for the
 * provider so that cost guards fail safe instead of treating them as free.
 */
export function estimateCostFor(input: {
  providerId: string;
  model: string;
  characters: number;
  purpose?: TtsPurpose;
}): CostEstimate {
  const pricing = findPricing(input.providerId, input.model) ?? fallbackPricing(input.providerId);
  const rate = pricing?.inputPricePer1KCharacters ?? 0;
  return {
    providerId: input.providerId,
    model: input.model,
    characters: input.characters,
    estimatedCost: roundCost((input.characters / 1000) * rate),
    currency: "USD",
  };
}

/** Prices characters at the provider's most expensive known rate. */
export function worstCaseCostFor(providerId: string, characters: number): number {
  const rate = fallbackPricing(providerId)?.inputPricePer1KCharacters ?? 0;
  return roundCost((characters / 1000) * rate);
}

function fallbackPricing(providerId: string): ProviderPricing | null {
  const candidates = DEFAULT_PRICING.filter((item) => item.providerId === providerId);
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((max, item) =>
    item.inputPricePer1KCharacters > max.inputPricePer1KCharacters ? item : max,
  );
}

function roundCost(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function readPrice(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
