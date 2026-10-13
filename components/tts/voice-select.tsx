"use client";

import { useEffect, useState } from "react";
import { groupVoices, voiceLabel } from "@/lib/voices/voice-label";

export type VoiceOption = {
  id: string;
  provider: string;
  name: string;
  language: string;
  languageName: string;
  gender?: string;
  tier: "STANDARD" | "PREMIUM";
};

export function useVoiceOptions(): VoiceOption[] {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/voices")
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { data?: { voices?: VoiceOption[] } };
        if (!cancelled && payload.data?.voices?.length) {
          setVoices(payload.data.voices);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return voices;
}

type VoiceSelectProps = {
  id: string;
  voices: VoiceOption[];
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
};

export function VoiceSelect({ id, voices, value, onChange, disabled }: VoiceSelectProps) {
  return (
    <select
      id={id}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {voices.length === 0 ? <option value="">Loading voices...</option> : null}
      {groupVoices(voices).map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voiceLabel(voice)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
