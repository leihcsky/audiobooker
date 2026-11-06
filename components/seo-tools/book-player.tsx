"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type PlayerChapter = {
  id: string;
  title: string;
  /**
   * Changes when this chapter's audio file is replaced (e.g. regenerate with a
   * new voice). When omitted, the player only refetches on chapter change.
   */
  audioKey?: string | null;
};

type LoadedSource = {
  chapterId: string;
  audioKey: string;
  url: string;
};

function revisionKey(chapter: PlayerChapter): string {
  return `${chapter.id}:${chapter.audioKey ?? ""}`;
}

/** Plays finished chapters back to back. Refetches the signed URL when the audio file changes. */
export function BookPlayer({ chapters }: { chapters: PlayerChapter[] }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplay = useRef(false);

  const index = Math.max(
    0,
    chapters.findIndex((chapter) => chapter.id === chosenId),
  );
  const current = chapters[index] ?? null;
  const currentId = current?.id ?? null;
  const currentRevision = current ? revisionKey(current) : null;

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

  const ready = source?.chapterId === current.id && source.audioKey === revisionKey(current);

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
        <audio
          key={source.url}
          ref={audioRef}
          className="w-full"
          controls
          preload="metadata"
          src={source.url}
          onEnded={() => goTo(index + 1, true)}
          onError={() => setFailedId(current.id)}
        >
          Your browser does not support audio playback.
        </audio>
      ) : (
        <p className="text-sm text-muted-foreground">Loading audio...</p>
      )}
    </div>
  );
}
