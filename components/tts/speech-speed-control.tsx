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
};

export function SpeechSpeedControl({ id, value, onChange, disabled }: SpeechSpeedControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>Narration speed</Label>
        <span className="text-sm tabular-nums text-muted-foreground">{value.toFixed(2)}×</span>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_SPEECH_SPEED}
        max={MAX_SPEECH_SPEED}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-foreground"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Slower</span>
        <span>Normal</span>
        <span>Faster</span>
      </div>
    </div>
  );
}

export { DEFAULT_SPEECH_SPEED };
