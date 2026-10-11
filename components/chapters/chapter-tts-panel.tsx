"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ChapterDetail } from "@/lib/chapters/chapter.service";
import type { JobSummary } from "@/lib/projects/project.detail";
import { formatAudioDuration } from "@/lib/audio/format-duration";
import { estimatePremiumSeconds } from "@/lib/billing/premium-usage";
import { userFacingTtsError } from "@/lib/tts/tts-error-copy";
import { PremiumEstimate } from "@/components/billing/premium-estimate";
import { SpeechSpeedControl, DEFAULT_SPEECH_SPEED } from "@/components/tts/speech-speed-control";
import { useVoiceOptions, VoiceSelect } from "@/components/tts/voice-select";
import { formatDate } from "@/lib/utils";

type ChapterTtsPanelProps = {
  chapter: ChapterDetail;
  /** True while a whole-book generation is queued or running for this project. */
  projectGenerating?: boolean;
  premiumAvailableSeconds: number;
};

export function ChapterTtsPanel({
  chapter,
  projectGenerating = false,
  premiumAvailableSeconds,
}: ChapterTtsPanelProps) {
  const router = useRouter();
  const voices = useVoiceOptions();
  const [chosenVoiceId, setVoiceId] = useState(chapter.selectedVoiceId ?? "");
  const [jobProgress, setJobProgress] = useState<JobSummary["progress"]>(null);
  const [speed, setSpeed] = useState(chapter.selectedSpeed || DEFAULT_SPEECH_SPEED);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadedAudio, setLoadedAudio] = useState<{ id: string; url: string } | null>(null);
  const [pending, setPending] = useState<"preview" | "generate" | null>(null);
  const latestJob = chapter.latestTtsJob;
  const polling = latestJob?.status === "QUEUED" || latestJob?.status === "PROCESSING";
  const hasAudio = Boolean(chapter.currentAudio);
  const busy = pending !== null || polling || projectGenerating;
  const voiceId = voices.some((voice) => voice.id === chosenVoiceId)
    ? chosenVoiceId
    : (voices[0]?.id ?? "");
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === voiceId) ?? null,
    [voiceId, voices],
  );
  const premiumNeeded =
    selectedVoice?.tier === "PREMIUM"
      ? estimatePremiumSeconds({
          characters: chapter.characterCount,
          languageCode: selectedVoice.language,
        })
      : 0;
  const premiumShort = premiumNeeded > premiumAvailableSeconds;

  useEffect(() => {
    const audioId = chapter.currentAudio?.id;
    if (!audioId) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/chapters/${chapter.id}/audio`)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { data?: { audioUrl?: string } };
        if (!cancelled && payload.data?.audioUrl) {
          setLoadedAudio({ id: audioId, url: payload.data.audioUrl });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [chapter.currentAudio?.id, chapter.id]);

  const playbackUrl =
    chapter.currentAudio && loadedAudio?.id === chapter.currentAudio.id
      ? loadedAudio.url
      : null;

  useEffect(() => {
    if (!polling || !latestJob) {
      return;
    }
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${latestJob.id}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { data?: { job?: JobSummary } };
      if (payload.data?.job) {
        setJobProgress(payload.data.job.progress);
      }
      if (payload.data?.job && payload.data.job.status !== latestJob.status) {
        router.refresh();
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [latestJob, polling, router]);

  async function onPreview() {
    if (!voiceId) {
      return;
    }
    setPending("preview");
    setError(null);
    try {
      const response = await fetch(`/api/voices/${voiceId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed }),
      });
      const payload = (await response.json()) as {
        data?: { audioUrl?: string };
        error?: { code?: string; message?: string };
      };
      if (!response.ok || !payload.data?.audioUrl) {
        setError(userFacingTtsError(payload.error?.code, payload.error?.message));
        return;
      }
      setPreviewUrl(payload.data.audioUrl);
    } catch {
      setError(userFacingTtsError());
    } finally {
      setPending(null);
    }
  }

  async function onGenerate() {
    if (!voiceId) {
      return;
    }
    setPending("generate");
    setError(null);
    try {
      const path = hasAudio
        ? `/api/chapters/${chapter.id}/regenerate`
        : `/api/chapters/${chapter.id}/generate`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, speed }),
      });
      const payload = (await response.json()) as { error?: { code?: string; message?: string } };
      if (!response.ok) {
        setError(userFacingTtsError(payload.error?.code, payload.error?.message));
        return;
      }
      router.refresh();
    } catch {
      setError(userFacingTtsError());
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="chapter-voice">Narration voice</Label>
          <VoiceSelect
            id="chapter-voice"
            voices={voices}
            value={voiceId}
            onChange={setVoiceId}
            disabled={busy}
          />
        </div>

        <SpeechSpeedControl
          id="chapter-speed"
          value={speed}
          onChange={setSpeed}
          disabled={busy}
        />

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={onPreview} disabled={!voiceId || busy}>
            {pending === "preview" ? "Previewing..." : "Preview Voice"}
          </Button>
          <Button onClick={onGenerate} disabled={!voiceId || busy || premiumShort}>
            {pending === "generate"
              ? "Starting..."
              : hasAudio
                ? "Regenerate"
                : "Generate Audio"}
          </Button>
        </div>
        {premiumNeeded > 0 && !busy ? (
          <PremiumEstimate neededSeconds={premiumNeeded} availableSeconds={premiumAvailableSeconds} />
        ) : null}
        {projectGenerating ? (
          <p className="text-sm text-muted-foreground">
            The audiobook is being narrated. This chapter can be regenerated when it finishes.
          </p>
        ) : null}

        {previewUrl ? (
          <audio className="w-full" controls src={previewUrl} preload="metadata">
            Your browser does not support audio playback.
          </audio>
        ) : null}

        <div className="space-y-3 border-t border-border pt-6">
          <h3 className="font-medium">Audio</h3>
          {polling ? (
            <p className="text-sm text-muted-foreground">
              {jobProgress && jobProgress.totalChunks > 1
                ? `Generating... part ${jobProgress.completedChunks} of ${jobProgress.totalChunks} (${jobProgress.percentage}%)`
                : "Generating..."}
            </p>
          ) : null}
          {latestJob?.status === "FAILED" ? (
            <p className="text-sm text-destructive">
              {latestJob.errorMessage?.trim() || userFacingTtsError(latestJob.errorCode ?? undefined)}
            </p>
          ) : null}
          {chapter.audioOutdated && !polling ? (
            <p className="text-sm text-muted-foreground">
              The text changed after this audio was made. Regenerate to update it.
            </p>
          ) : null}
          {chapter.currentAudio && playbackUrl ? (
            <div className="space-y-3">
              <audio className="w-full" controls src={playbackUrl} preload="metadata">
                Your browser does not support audio playback.
              </audio>
              <p className="text-sm text-muted-foreground">
                Voice: {selectedVoice?.name ?? chapter.selectedVoiceId ?? "Selected voice"} ·{" "}
                {formatAudioDuration(chapter.currentAudio.durationSeconds ?? 0)} · Generated{" "}
                {formatDate(chapter.currentAudio.createdAt)}
              </p>
            </div>
          ) : !polling ? (
            <p className="text-sm text-muted-foreground">No chapter audio yet.</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
