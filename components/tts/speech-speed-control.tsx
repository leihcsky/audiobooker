"use client";

import { Label } from "@/components/ui/label";
import {
  DEFAULT_SPEECH_SPEED,
  MAX_SPEECH_SPEED,
  MIN_SPEECH_SPEED,
} from "@/lib/tts/speed";

type SpeechSpeedControlProps = {
  id: string;
  value: number;
  onChange: (speed: number) => void;
  disabled?: boolean;
  /** When false, the control is locked at 1.0× (voice has no speed input). */
  supported?: boolean;
};

export function SpeechSpeedControl({
  id,
  value,
  onChange,
  disabled,
  supported = true,
}: SpeechSpeedControlProps) {
  const locked = supported === false;
  const shown = locked ? DEFAULT_SPEECH_SPEED : value;
  return (
    <div className={`space-y-2 ${locked ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>Narration speed</Label>
        <span className="text-sm tabular-nums text-muted-foreground">{shown.toFixed(2)}×</span>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_SPEECH_SPEED}
        max={MAX_SPEECH_SPEED}
        step={0.05}
        value={shown}
        disabled={disabled || locked}
        aria-disabled={disabled || locked}
        onChange={(event) => {
          if (locked) {
            return;
          }
          onChange(Number(event.target.value));
        }}
        className={`w-full accent-foreground ${locked ? "pointer-events-none cursor-not-allowed" : ""}`}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Slower</span>
        <span>Normal</span>
        <span>Faster</span>
      </div>
      {locked ? (
        <p className="text-xs text-muted-foreground">This voice plays at normal speed only.</p>
      ) : null}
    </div>
  );
}

export { DEFAULT_SPEECH_SPEED };
