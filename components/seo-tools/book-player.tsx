"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAudioDuration } from "@/lib/audio/format-duration";

type PlayerChapter = {
  id: string;
  title: string;
  /**
   * Changes when this chapter's audio file is replaced (e.g. regenerate with a
   * new voice). When omitted, the player only refetches on chapter change.
   */
  audioKey?: string | null;
  /**
   * Known length from generation. Used when the browser misreads concatenated
   * MP3 duration (common on mobile, often showing ~1s).
   */
  durationSeconds?: number | null;
};

type LoadedSource = {
  chapterId: string;
  audioKey: string;
  url: string;
};

function revisionKey(chapter: PlayerChapter): string {
  return `${chapter.id}:${chapter.audioKey ?? ""}`;
}

/** True when the media element's reported duration looks usable. */
function mediaClockTrusted(known: number | null | undefined, mediaDuration: number): boolean {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    return false;
  }
  if (known == null || known <= 0) {
    return true;
  }
  // Mobile Safari often reports ~1s for concatenated chapter MP3s.
  return mediaDuration >= known * 0.5;
}

/** Plays finished chapters back to back. Refetches the signed URL when the audio file changes. */
export function BookPlayer({ chapters }: { chapters: PlayerChapter[] }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplay = useRef(false);
  const wallAnchorMs = useRef<number | null>(null);
  const wallAnchorTime = useRef(0);
  const rafRef = useRef<number | null>(null);
  const durationRef = useRef(0);

  const index = Math.max(
    0,
    chapters.findIndex((chapter) => chapter.id === chosenId),
  );
  const current = chapters[index] ?? null;
  const currentId = current?.id ?? null;
  const currentRevision = current ? revisionKey(current) : null;
  const knownDuration = current?.durationSeconds != null && current.durationSeconds > 0 ? current.durationSeconds : null;
  const trustMedia = mediaClockTrusted(knownDuration, mediaDuration);
  const duration = trustMedia ? mediaDuration : (knownDuration ?? (mediaDuration > 0 ? mediaDuration : 0));
  durationRef.current = duration;

  function stopWallClock() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    wallAnchorMs.current = null;
  }

  function startWallClock(fromSeconds: number) {
    stopWallClock();
    wallAnchorTime.current = fromSeconds;
    wallAnchorMs.current = performance.now();
    const tick = () => {
      if (wallAnchorMs.current == null) {
        return;
      }
      const elapsed = (performance.now() - wallAnchorMs.current) / 1000;
      const next = wallAnchorTime.current + elapsed;
      const limit = durationRef.current;
      setCurrentTime(limit > 0 ? Math.min(next, limit) : next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (!currentId || !current || !currentRevision) {
      return;
    }
    if (source?.chapterId === currentId && source.audioKey === currentRevision) {
      return;
    }
    let cancelled = false;
    setSource(null);
    setFailedId(null);
    setPlaying(false);
    setCurrentTime(0);
    setMediaDuration(0);
    stopWallClock();
    void fetch(`/api/chapters/${currentId}/audio`)
      .then((response) => response.json().catch(() => null))
      .then((payload: { data?: { audioUrl?: string } } | null) => {
        if (cancelled) {
          return;
        }
        const url = payload?.data?.audioUrl;
        if (url) {
          setSource({ chapterId: currentId, audioKey: currentRevision, url });
          setFailedId(null);
        } else {
          setFailedId(currentId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailedId(currentId);
        }
      });
    return () => {
      cancelled = true;
      stopWallClock();
    };
    // `current` is derived from currentId + chapters; revision captures audio replacement.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refetch on id/revision/attempt only
  }, [currentId, currentRevision, attempt]);

  useEffect(() => {
    if (source && autoplay.current) {
      autoplay.current = false;
      void audioRef.current?.play().catch(() => undefined);
    }
  }, [source]);

  useEffect(() => () => stopWallClock(), []);

  if (!current) {
    return null;
  }

  function goTo(nextIndex: number, play: boolean) {
    const next = chapters[nextIndex];
    if (!next) {
      return;
    }
    autoplay.current = play;
    setChosenId(next.id);
  }

  function retry() {
    setFailedId(null);
    setSource(null);
    setAttempt((value) => value + 1);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) {
      return;
    }
    const next = Math.min(Math.max(0, seconds), duration);
    if (trustMedia) {
      try {
        audio.currentTime = next;
      } catch {
        // ignore
      }
      setCurrentTime(next);
      return;
    }
    // Concatenated MP3s often ignore mid-file seeks on mobile; restart from the
    // beginning when the user drags near the start, otherwise keep playing.
    if (next <= 0.35) {
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      setCurrentTime(0);
      if (!audio.paused) {
        startWallClock(0);
      }
    }
  }

  const ready = source?.chapterId === current.id && source.audioKey === revisionKey(current);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 font-medium">Listen</span>
          <select
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
            value={current.id}
            onChange={(event) => goTo(chapters.findIndex((chapter) => chapter.id === event.target.value), true)}
          >
            {chapters.map((chapter, position) => (
              <option key={chapter.id} value={chapter.id}>
                {position + 1}. {chapter.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => goTo(index - 1, true)} disabled={index === 0}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo(index + 1, true)}
            disabled={index >= chapters.length - 1}
          >
            Next
          </Button>
        </div>
      </div>
      {failedId === current.id ? (
        <p className="text-sm text-destructive">
          This chapter couldn&apos;t load.{" "}
          <button type="button" className="underline" onClick={retry}>
            Try again
          </button>
        </p>
      ) : ready && source ? (
        <div className="space-y-2">
          <audio
            key={source.url}
            ref={audioRef}
            preload="metadata"
            src={source.url}
            onPlay={(event) => {
              setPlaying(true);
              if (trustMedia) {
                stopWallClock();
                setCurrentTime(event.currentTarget.currentTime);
              } else {
                startWallClock(currentTime > 0 && currentTime < duration ? currentTime : 0);
              }
            }}
            onPause={(event) => {
              setPlaying(false);
              if (trustMedia) {
                setCurrentTime(event.currentTarget.currentTime);
              } else if (wallAnchorMs.current != null) {
                const elapsed = (performance.now() - wallAnchorMs.current) / 1000;
                setCurrentTime(Math.min(wallAnchorTime.current + elapsed, duration || Infinity));
              }
              stopWallClock();
            }}
            onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration)}
            onDurationChange={(event) => setMediaDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => {
              if (trustMedia) {
                setCurrentTime(event.currentTarget.currentTime);
              }
            }}
            onEnded={() => {
              setPlaying(false);
              stopWallClock();
              setCurrentTime(duration);
              goTo(index + 1, true);
            }}
            onError={() => setFailedId(current.id)}
          />
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="w-16 shrink-0" onClick={togglePlay}>
              {playing ? "Pause" : "Play"}
            </Button>
            <div className="min-w-0 flex-1 space-y-1">
              <input
                type="range"
                className="w-full accent-foreground"
                min={0}
                max={duration > 0 ? duration : 1}
                step={0.1}
                value={duration > 0 ? Math.min(currentTime, duration) : 0}
                disabled={duration <= 0}
                aria-label="Playback position"
                onChange={(event) => seekTo(Number(event.target.value))}
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{formatAudioDuration(Math.min(currentTime, duration || currentTime))}</span>
                <span>{duration > 0 ? formatAudioDuration(duration) : "—"}</span>
              </div>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full bg-foreground/70 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading audio...</p>
      )}
    </div>
  );
}
