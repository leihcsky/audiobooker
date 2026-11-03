"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { groupVoices, voiceLabel } from "@/lib/voices/voice-label";
import { cn } from "@/lib/utils";

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

function PremiumBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        "bg-amber-100 text-amber-950 ring-1 ring-amber-700/30",
        className,
      )}
    >
      Premium
    </span>
  );
}

export function VoiceSelect({ id, voices, value, onChange, disabled }: VoiceSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = voices.find((voice) => voice.id === value) ?? null;
  const premium = selected?.tier === "PREMIUM";

  useEffect(() => {
    if (!open || disabled || voices.length === 0) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, disabled, voices.length]);

  const menuOpen = open && !disabled && voices.length > 0;

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-controls={listId}
          disabled={disabled || voices.length === 0}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex h-auto min-h-11 w-full items-center gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            premium
              ? "border-amber-700/50 bg-amber-50/80 ring-1 ring-amber-700/20"
              : "border-input",
            menuOpen && "ring-2 ring-ring",
          )}
        >
          <span className="min-w-0 flex-1">
            {selected ? (
              <>
                <span className="block font-semibold text-foreground">{selected.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[voiceGenderLabelShort(selected), selected.languageName].filter(Boolean).join(" · ")}
                  {premium ? " · paid minutes" : ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {voices.length === 0 ? "Loading voices..." : "Select a voice"}
              </span>
            )}
          </span>
          {premium ? <PremiumBadge /> : null}
          <ChevronDownIcon
            className={cn("size-4 text-muted-foreground transition-transform", menuOpen && "rotate-180")}
          />
        </button>

        {menuOpen ? (
          <div
            id={listId}
            role="listbox"
            aria-labelledby={id}
            className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-lg"
          >
            {groupVoices(voices).map((group) => (
              <div key={group.key} role="group" aria-label={group.label}>
                <p className="sticky top-0 bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.voices.map((voice) => {
                  const isSelected = voice.id === value;
                  const isPremium = voice.tier === "PREMIUM";
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                        isSelected ? "bg-primary/10 font-semibold text-foreground" : "hover:bg-muted",
                        isPremium && !isSelected && "bg-amber-50/40",
                      )}
                      onClick={() => {
                        onChange(voice.id);
                        setOpen(false);
                      }}
                    >
                      <CheckIcon
                        className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">{voiceLabel(voice)}</span>
                      </span>
                      {isPremium ? <PremiumBadge /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {premium ? (
        <p className="text-sm text-amber-950">
          Premium voice selected — each generation uses premium minutes.
        </p>
      ) : null}
    </div>
  );
}

function voiceGenderLabelShort(voice: VoiceOption): string | null {
  const gender = voice.gender?.toLowerCase();
  if (gender === "female") {
    return "Female";
  }
  if (gender === "male") {
    return "Male";
  }
  if (gender === "neutral") {
    return "Neutral";
  }
  return null;
}
