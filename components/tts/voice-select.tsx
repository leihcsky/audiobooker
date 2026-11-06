"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { uniqueSorted, voiceLocaleParts } from "@/lib/voices/voice-locale";
import { voiceGenderLabel } from "@/lib/voices/voice-label";
import { cn } from "@/lib/utils";

export type VoiceOption = {
  id: string;
  provider: string;
  name: string;
  language: string;
  languageName: string;
  gender?: string;
  tier: "STANDARD" | "PREMIUM";
  /** Absent or true means speed is adjustable; false locks narration at 1.0×. */
  supportsSpeed?: boolean;
};

/** Gemini (and any voice that opts out) cannot vary narration rate. */
export function voiceOptionSupportsSpeed(voice: VoiceOption | null | undefined): boolean {
  if (!voice) {
    return true;
  }
  if (voice.supportsSpeed === false) {
    return false;
  }
  // Fallback if an older API payload omitted supportsSpeed.
  if (voice.id.startsWith("replicate-gemini-") || voice.id.startsWith("elevenlabs-")) {
    return false;
  }
  return true;
}

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

type TierTab = "STANDARD" | "PREMIUM";

const GENDER_SECTIONS = ["Female", "Male", "Neutral"] as const;

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

function localeOf(voice: VoiceOption) {
  return voiceLocaleParts({
    languageName: voice.languageName,
    language: voice.language,
  });
}

export function VoiceSelect({ id, voices, value, onChange, disabled }: VoiceSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = voices.find((voice) => voice.id === value) ?? null;
  const premium = selected?.tier === "PREMIUM";

  const hasPremium = voices.some((voice) => voice.tier === "PREMIUM");
  const hasStandard = voices.some((voice) => voice.tier === "STANDARD");

  const [tier, setTier] = useState<TierTab>(selected?.tier ?? (hasStandard ? "STANDARD" : "PREMIUM"));
  const [language, setLanguage] = useState(() => (selected ? localeOf(selected).language : ""));
  const [accent, setAccent] = useState(() => (selected ? localeOf(selected).accent : ""));

  function syncFiltersFromVoice(voice: VoiceOption) {
    const locale = localeOf(voice);
    setTier(voice.tier);
    setLanguage(locale.language);
    setAccent(locale.accent);
  }

  function openMenu() {
    if (selected) {
      syncFiltersFromVoice(selected);
    } else if (hasStandard) {
      setTier("STANDARD");
    } else if (hasPremium) {
      setTier("PREMIUM");
    }
    setOpen(true);
  }

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

  const tierVoices = useMemo(
    () => voices.filter((voice) => voice.tier === tier),
    [voices, tier],
  );

  const languages = useMemo(
    () => uniqueSorted(tierVoices.map((voice) => localeOf(voice).language)),
    [tierVoices],
  );

  const activeLanguage = languages.includes(language) ? language : (languages[0] ?? "");

  const languageVoices = useMemo(
    () => tierVoices.filter((voice) => localeOf(voice).language === activeLanguage),
    [tierVoices, activeLanguage],
  );

  const accents = useMemo(
    () => uniqueSorted(languageVoices.map((voice) => localeOf(voice).accent)),
    [languageVoices],
  );

  const activeAccent = accents.includes(accent) ? accent : (accents[0] ?? "");

  const filteredVoices = useMemo(
    () =>
      languageVoices.filter((voice) => localeOf(voice).accent === activeAccent),
    [languageVoices, activeAccent],
  );

  const genderSections = useMemo(() => {
    return GENDER_SECTIONS.map((label) => ({
      label,
      voices: filteredVoices.filter((voice) => voiceGenderLabel(voice.gender) === label),
    })).filter((section) => section.voices.length > 0);
  }, [filteredVoices]);

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
          onClick={() => (menuOpen ? setOpen(false) : openMenu())}
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
                  {premium ? " · paid minutes" : " · free"}
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
            className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg"
          >
            <div className="flex border-b border-border p-1">
              {hasStandard ? (
                <TierTabButton
                  active={tier === "STANDARD"}
                  onClick={() => setTier("STANDARD")}
                  label="Standard"
                  hint="Everyday"
                />
              ) : null}
              {hasPremium ? (
                <TierTabButton
                  active={tier === "PREMIUM"}
                  onClick={() => setTier("PREMIUM")}
                  label="Premium"
                  hint="Expressive"
                />
              ) : null}
            </div>
            {tier === "PREMIUM" ? (
              <p className="border-b border-border bg-amber-50/50 px-3 py-2 text-xs text-amber-950">
                High-quality narration for storytelling and character dialogue. Uses Premium Minutes or
                Pay-per-Book — not your Standard Voice allowance.
              </p>
            ) : hasStandard ? (
              <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                Clear, practical voices for everyday audiobook creation. Included with your plan.
              </p>
            ) : null}

            <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="font-medium text-muted-foreground">Language</span>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={activeLanguage}
                  onChange={(event) => setLanguage(event.target.value)}
                  disabled={languages.length === 0}
                >
                  {languages.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-medium text-muted-foreground">Accent</span>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={activeAccent}
                  onChange={(event) => setAccent(event.target.value)}
                  disabled={accents.length === 0}
                >
                  {accents.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div role="listbox" aria-labelledby={id} className="max-h-72 overflow-auto py-1">
              {genderSections.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No voices for this language and accent.
                </p>
              ) : (
                genderSections.map((section) => (
                  <div key={section.label} role="group" aria-label={section.label}>
                    <p className="sticky top-0 bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                    {section.voices.map((voice) => {
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
                            <span className="block">{voice.name}</span>
                          </span>
                          {isPremium ? <PremiumBadge /> : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {premium ? (
        <p className="text-sm text-amber-950">
          Premium voice selected — more natural, expressive narration. Each generation uses Premium Minutes
          or a Pay-per-Book quote, not your Standard Voice hours.
        </p>
      ) : selected ? (
        <p className="text-sm text-muted-foreground">
          Standard voice selected — suited to everyday listening. Switch to Premium when you want richer
          delivery for stories and dialogue.
        </p>
      ) : null}
    </div>
  );
}

function TierTabButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className={cn("text-[11px]", active ? "text-primary-foreground/80" : "")}>{hint}</span>
    </button>
  );
}

function voiceGenderLabelShort(voice: VoiceOption): string | null {
  return voiceGenderLabel(voice.gender);
}
