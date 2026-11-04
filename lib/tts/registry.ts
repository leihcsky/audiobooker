import {
  ttsInvalidRequest,
  ttsPremiumNotAvailable,
  ttsProviderUnavailable,
  ttsVoiceNotFound,
} from "@/lib/api/errors";
import { createEdgeProvider } from "@/lib/tts/providers/edge";
import { createElevenLabsProvider } from "@/lib/tts/providers/elevenlabs";
import { createOpenAIProvider } from "@/lib/tts/providers/openai";
import { createReplicateProvider } from "@/lib/tts/providers/replicate";
import type { TTSProvider, TtsTier, VoiceAccess, VoiceDefinition } from "@/lib/tts/types";
import { findVoice } from "@/lib/tts/voices";

const FACTORIES: Record<string, () => TTSProvider> = {
  edge: createEdgeProvider,
  replicate: createReplicateProvider,
  elevenlabs: createElevenLabsProvider,
  openai: createOpenAIProvider,
};

const providers = new Map<string, TTSProvider>();

export function getTtsProvider(providerId: string): TTSProvider {
  const id = providerId.trim().toLowerCase();
  const cached = providers.get(id);
  if (cached) {
    return cached;
  }
  const factory = FACTORIES[id];
  if (!factory) {
    throw ttsVoiceNotFound();
  }
  const created = factory();
  providers.set(id, created);
  return created;
}

export function listAvailableVoices(
  access: VoiceAccess,
  filters?: { language?: string; provider?: string; tier?: TtsTier },
): VoiceDefinition[] {
  const language = filters?.language?.trim().toLowerCase();
  const providerFilter = filters?.provider?.trim().toLowerCase();
  const premiumAllowed = access.premium;
  const voices: VoiceDefinition[] = [];

  for (const providerId of Object.keys(FACTORIES)) {
    if (providerFilter && providerId !== providerFilter) {
      continue;
    }
    const provider = getTtsProvider(providerId);
    if (!provider.isEnabled()) {
      continue;
    }
    for (const voice of provider.listVoices()) {
      if (voice.tier === "premium" && !premiumAllowed) {
        continue;
      }
      if (filters?.tier && voice.tier !== filters.tier) {
        continue;
      }
      if (language && !voice.languageCode.toLowerCase().startsWith(language)) {
        continue;
      }
      voices.push(voice);
    }
  }

  return voices.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

export type ResolvedVoice = {
  voice: VoiceDefinition;
  provider: TTSProvider;
};

/**
 * Resolves a client-supplied voice ID to a provider the requester may use.
 * Standard requests never resolve to a premium provider: when the standard
 * provider is disabled the request fails instead of switching to paid TTS.
 */
export function resolveVoice(
  access: VoiceAccess,
  voiceId: string,
  options?: { quality?: TtsTier },
): ResolvedVoice {
  const voice = findVoice(voiceId);
  if (!voice) {
    throw ttsVoiceNotFound();
  }
  if (options?.quality && options.quality !== voice.tier) {
    throw ttsInvalidRequest("The selected voice does not match the requested quality.");
  }
  if (voice.tier === "premium" && !access.premium) {
    throw ttsPremiumNotAvailable(
      "Premium voices need a free account. Save the project to an account to use them.",
    );
  }
  const provider = getTtsProvider(voice.provider);
  if (provider.tier !== voice.tier) {
    throw ttsVoiceNotFound();
  }
  // Inactive Replicate family (e.g. MiniMax voice while Gemini is configured).
  if (!provider.getVoice(voice.id)) {
    throw ttsVoiceNotFound();
  }
  if (!provider.isEnabled()) {
    throw voice.tier === "premium" ? ttsPremiumNotAvailable() : ttsProviderUnavailable();
  }
  return { voice, provider };
}

function tierRank(tier: TtsTier): number {
  return tier === "standard" ? 0 : 1;
}
