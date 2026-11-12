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

function isPlaying(item: ParagraphViewItem, time: number, isLastTimed: boolean): boolean {
  if (item.start === null || item.end === null || time < 0) {
    return false;
  }
  // Last timed paragraph keeps the highlight through trailing silence / duration drift.
  if (isLastTimed) {
    return time >= item.start;
  }
  return time >= item.start && time < item.end;
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
  const audioBytesRef = useRef<ArrayBuffer | null>(null);
  const fullUrlRef = useRef<string | null>(null);
  const sliceUrlRef = useRef<string | null>(null);
  /** Manifest seconds corresponding to currentTime === 0 on the active audio element. */
  const playbackOriginRef = useRef(0);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
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
  const lastTimedIndex = useMemo(() => {
    let last = -1;
    for (const item of view.paragraphs) {
      if (item.start !== null && item.end !== null) {
        last = item.index;
      }
    }
    return last;
  }, [view.paragraphs]);

  useEffect(() => {
    if (!audioId) {
      return;
    }
    let cancelled = false;
    setAudioReady(false);
    setAudioError(null);
    setTime(-1);
    audioBytesRef.current = null;
    playbackOriginRef.current = 0;
    void fetch(`/api/chapters/${chapterId}/audio/file`)
      .then(async (response) => {
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setAudioError("Could not load chapter audio.");
          return;
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) {
          return;
        }
        if (fullUrlRef.current) {
          URL.revokeObjectURL(fullUrlRef.current);
        }
        if (sliceUrlRef.current) {
          URL.revokeObjectURL(sliceUrlRef.current);
          sliceUrlRef.current = null;
        }
        audioBytesRef.current = buffer;
        fullUrlRef.current = URL.createObjectURL(new Blob([buffer], { type: "audio/mpeg" }));
        setAudioReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setAudioError("Could not load chapter audio.");
        }
      });
    return () => {
      cancelled = true;
      if (fullUrlRef.current) {
        URL.revokeObjectURL(fullUrlRef.current);
        fullUrlRef.current = null;
      }
      if (sliceUrlRef.current) {
        URL.revokeObjectURL(sliceUrlRef.current);
        sliceUrlRef.current = null;
      }
    };
  }, [audioId, chapterId]);

  // Bind the full chapter blob imperatively so later paragraph slices are not
  // overwritten by a React-controlled src on re-render.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audioReady || !audio || !fullUrlRef.current) {
      return;
    }
    playbackOriginRef.current = 0;
    audio.src = fullUrlRef.current;
  }, [audioReady, audioId]);

  function reportTime(audio: HTMLAudioElement) {
    setTime(playbackOriginRef.current + audio.currentTime);
  }

  /**
   * Concatenated chapter MP3s often ignore mid-file currentTime seeks in the
   * browser. Play from the paragraph's byte offset instead so the spoken audio
   * matches the clicked text.
   */
  function playFrom(item: ParagraphViewItem) {
    const audio = audioRef.current;
    const bytes = audioBytesRef.current;
    if (!audio || !bytes || item.byteOffset === null || item.start === null) {
      return;
    }
    if (sliceUrlRef.current) {
      URL.revokeObjectURL(sliceUrlRef.current);
      sliceUrlRef.current = null;
    }
    const slice = bytes.slice(item.byteOffset);
    const url = URL.createObjectURL(new Blob([slice], { type: "audio/mpeg" }));
    sliceUrlRef.current = url;
    playbackOriginRef.current = item.start;
    setTime(item.start);
    audio.src = url;
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
          {audioReady ? (
            <audio
              key={audioId ?? "chapter-audio"}
              ref={audioRef}
              className="w-full"
              controls
              preload="auto"
              onTimeUpdate={(event) => reportTime(event.currentTarget)}
              onSeeked={(event) => reportTime(event.currentTarget)}
              onPlay={(event) => reportTime(event.currentTarget)}
            >
              Your browser does not support audio playback.
            </audio>
          ) : (
            <p className="text-sm text-muted-foreground">
              {audioError ?? "Loading audio..."}
            </p>
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

        <ol className="space-y-3">
          {view.paragraphs.map((item) => {
            const active = isPlaying(item, time, item.index === lastTimedIndex);
            const isEditing = editing?.index === item.index;
            const busy = pending === item.index;
            const canRetry = view.retryAvailable && item.speakable && !item.changed;
            const showActions = item.speakable || item.changed;
            return (
              <li
                key={item.index}
                className={cn(
                  "rounded-md border-l-2 px-3 py-3 transition-colors",
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
                  <div className="space-y-2">
                    <button
                      type="button"
                      className={cn(
                        "w-full whitespace-pre-line text-left font-serif text-[15px] leading-7 sm:text-base",
                        item.start === null ? "cursor-default" : "cursor-pointer",
                        !item.speakable && "text-muted-foreground",
                      )}
                      onClick={() => playFrom(item)}
                      disabled={item.start === null || item.byteOffset === null || !audioReady}
                      title={item.start === null ? "Not in the current audio" : "Play from here"}
                    >
                      {item.text}
                    </button>
                    {showActions ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {item.changed ? (
                          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Changed
                          </span>
                        ) : null}
                        {item.speakable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2.5"
                            onClick={() => {
                              setEditing({ index: item.index, text: item.text });
                              setError(null);
                            }}
                            disabled={locked || pending !== null}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canRetry ? (
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
                    ) : null}
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
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="h-8 px-2.5"
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
