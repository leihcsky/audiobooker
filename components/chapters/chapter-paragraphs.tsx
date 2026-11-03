"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PremiumEstimate } from "@/components/billing/premium-estimate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceOptions } from "@/components/tts/voice-select";
import { estimatedMinutes, estimatePremiumSeconds, remainingMinutes } from "@/lib/billing/premium-usage";
import type { ParagraphView, ParagraphViewItem } from "@/lib/chapters/paragraph.service";
import { userFacingTtsError } from "@/lib/tts/tts-error-copy";
import { cn } from "@/lib/utils";

type ChapterParagraphsProps = {
  chapterId: string;
  projectId: string;
  audioId: string | null;
  view: ParagraphView;
  /** True while this chapter or the whole book is being narrated. */
  locked: boolean;
  selectedVoiceId: string | null;
  premiumAvailableSeconds: number;
};

type ApiPayload = { error?: { code?: string; message?: string } };

function isPlaying(item: ParagraphViewItem, time: number): boolean {
  return item.start !== null && item.end !== null && time >= item.start && time < item.end;
}

export function ChapterParagraphs({
  chapterId,
  projectId,
  audioId,
  view,
  locked,
  selectedVoiceId,
  premiumAvailableSeconds,
}: ChapterParagraphsProps) {
  const router = useRouter();
  const voices = useVoiceOptions();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [time, setTime] = useState(-1);
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<{ index: number; message: string } | null>(null);
  const changedCount = view.paragraphs.filter((item) => item.changed).length;
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) ?? null,
    [voices, selectedVoiceId],
  );
  const premiumVoice = selectedVoice?.tier === "PREMIUM";
  const editingNeeded =
    premiumVoice && editing
      ? estimatePremiumSeconds({
          characters: editing.text.trim().length,
          languageCode: selectedVoice.language,
        })
      : 0;
  const editingShort = premiumVoice && editingNeeded > premiumAvailableSeconds;

  useEffect(() => {
    if (!audioId) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/chapters/${chapterId}/audio`)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { data?: { audioUrl?: string } };
        if (!cancelled && payload.data?.audioUrl) {
          setAudioUrl(payload.data.audioUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [audioId, chapterId]);

  function playFrom(item: ParagraphViewItem) {
    const audio = audioRef.current;
    if (!audio || item.start === null) {
      return;
    }
    audio.currentTime = item.start;
    void audio.play().catch(() => undefined);
  }

  async function submit(item: ParagraphViewItem, body: { text?: string; retry?: boolean }) {
    setPending(item.index);
    setError(null);
    try {
      const response = await fetch(`/api/chapters/${chapterId}/paragraphs/${item.index}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original: item.text, ...body }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError({ index: item.index, message: userFacingTtsError(payload?.error?.code, payload?.error?.message) });
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError({ index: item.index, message: userFacingTtsError() });
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listen and fix</CardTitle>
        <CardDescription>
          Click a paragraph to play from there. Fix one paragraph and only that paragraph is read again.
          {view.retryAvailable ? null : (
            <>
              {" "}This voice reads the same text the same way, so edit the words or{" "}
              <Link href={`/studio/projects/${projectId}/pronunciation`} className="underline">
                add a pronunciation rule
              </Link>
              .
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="sticky top-0 z-10 bg-card py-2">
          {audioUrl ? (
            <audio
              ref={audioRef}
              className="w-full"
              controls
              src={audioUrl}
              preload="metadata"
              onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            >
              Your browser does not support audio playback.
            </audio>
          ) : (
            <p className="text-sm text-muted-foreground">Loading audio...</p>
          )}
        </div>

        {locked ? (
          <p className="text-sm text-muted-foreground">
            Narration is running. This page updates when it finishes.
          </p>
        ) : changedCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            {changedCount} {changedCount === 1 ? "paragraph has" : "paragraphs have"} changed since this audio was
            made. Regenerate with the same voice and only those are read again.
          </p>
        ) : null}

        {premiumVoice && !locked ? (
          <PremiumEstimate neededSeconds={0} availableSeconds={premiumAvailableSeconds} />
        ) : null}

        <ol className="space-y-1">
          {view.paragraphs.map((item) => {
            const active = isPlaying(item, time);
            const isEditing = editing?.index === item.index;
            const busy = pending === item.index;
            return (
              <li
                key={item.index}
                className={cn(
                  "group rounded-md border-l-2 px-3 py-2 transition-colors",
                  active ? "border-primary bg-muted" : "border-transparent hover:bg-muted/60",
                )}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <Textarea
                      aria-label={`Paragraph ${item.index + 1}`}
                      className="min-h-32 font-serif text-base leading-7"
                      value={editing.text}
                      onChange={(event) => setEditing({ index: item.index, text: event.target.value })}
                      disabled={busy}
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void submit(item, { text: editing.text })}
                        disabled={
                          busy ||
                          locked ||
                          editingShort ||
                          editing.text.trim().length === 0 ||
                          editing.text.trim() === item.text
                        }
                      >
                        {busy ? "Starting..." : "Save and regenerate"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                        Cancel
                      </Button>
                    </div>
                    {premiumVoice && editing.text.trim().length > 0 && editing.text.trim() !== item.text ? (
                      <PremiumEstimate
                        neededSeconds={editingNeeded}
                        availableSeconds={premiumAvailableSeconds}
                        action="regenerate"
                        variant="compact"
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className={cn(
                        "min-w-0 flex-1 whitespace-pre-line text-left font-serif text-base leading-7",
                        item.start === null ? "cursor-default" : "cursor-pointer",
                        !item.speakable && "text-muted-foreground",
                      )}
                      onClick={() => playFrom(item)}
                      disabled={item.start === null}
                      title={item.start === null ? "Not in the current audio" : "Play from here"}
                    >
                      {item.text}
                    </button>
                    {item.changed ? (
                      <span className="mt-1 shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Changed
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "flex shrink-0 items-center gap-1",
                        !active && !busy && "md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
                      )}
                    >
                      {item.speakable ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing({ index: item.index, text: item.text });
                            setError(null);
                          }}
                          disabled={locked || pending !== null}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {view.retryAvailable && item.speakable && !item.changed ? (
                        <RetryParagraphButton
                          busy={busy}
                          locked={locked || pending !== null}
                          premiumVoice={premiumVoice}
                          text={item.text}
                          languageCode={selectedVoice?.language}
                          availableSeconds={premiumAvailableSeconds}
                          onRetry={() => void submit(item, { retry: true })}
                        />
                      ) : null}
                    </div>
                  </div>
                )}
                {error?.index === item.index ? <p className="mt-2 text-sm text-destructive">{error.message}</p> : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function RetryParagraphButton({
  busy,
  locked,
  premiumVoice,
  text,
  languageCode,
  availableSeconds,
  onRetry,
}: {
  busy: boolean;
  locked: boolean;
  premiumVoice: boolean;
  text: string;
  languageCode?: string;
  availableSeconds: number;
  onRetry: () => void;
}) {
  const needed = premiumVoice
    ? estimatePremiumSeconds({ characters: text.length, languageCode })
    : 0;
  const short = needed > availableSeconds;
  const labelMinutes = estimatedMinutes(needed);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={onRetry}
        disabled={locked || short}
        title={premiumVoice ? `Uses about ${labelMinutes} premium min · ${remainingMinutes(availableSeconds)} left` : undefined}
      >
        {busy ? "Starting..." : "Try again"}
      </Button>
      {premiumVoice && short ? (
        <PremiumEstimate
          neededSeconds={needed}
          availableSeconds={availableSeconds}
          action="regenerate"
          variant="compact"
        />
      ) : null}
    </div>
  );
}
