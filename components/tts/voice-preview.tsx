"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { userFacingTtsError } from "@/lib/tts/tts-error-copy";

type VoicePreviewState = {
  previewing: boolean;
  error: string | null;
  /** Preview audio for the current voice and speed; null once either changes. */
  audioUrl: string | null;
  play: () => Promise<void>;
};

export function useVoicePreview(voiceId: string, speed: number): VoicePreviewState {
  const [result, setResult] = useState<{ key: string; url: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${voiceId}:${speed}`;

  async function play() {
    if (!voiceId) {
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const response = await fetch(`/api/voices/${voiceId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { audioUrl?: string };
        error?: { code?: string; message?: string };
      } | null;
      if (!response.ok || !payload?.data?.audioUrl) {
        setError(userFacingTtsError(payload?.error?.code, payload?.error?.message));
        return;
      }
      setResult({ key, url: payload.data.audioUrl });
    } catch {
      setError(userFacingTtsError());
    } finally {
      setPreviewing(false);
    }
  }

  return {
    previewing,
    error,
    audioUrl: result?.key === key ? result.url : null,
    play,
  };
}

type VoicePreviewButtonProps = {
  preview: VoicePreviewState;
  disabled?: boolean;
};

export function VoicePreviewButton({ preview, disabled }: VoicePreviewButtonProps) {
  return (
    <Button variant="outline" onClick={() => void preview.play()} disabled={disabled || preview.previewing}>
      {preview.previewing ? "Previewing..." : "Preview voice"}
    </Button>
  );
}

export function VoicePreviewPlayer({ audioUrl }: { audioUrl: string | null }) {
  if (!audioUrl) {
    return null;
  }
  return (
    <audio key={audioUrl} className="w-full" controls autoPlay src={audioUrl} preload="metadata">
      Your browser does not support audio playback.
    </audio>
  );
}
