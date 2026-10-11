"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type PlayerChapter = {
  id: string;
  title: string;
};

type LoadedSource = {
  chapterId: string;
  url: string;
};

/** Plays finished chapters back to back. Each chapter fetches a fresh signed URL when it becomes current. */
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

  useEffect(() => {
    if (!currentId || source?.chapterId === currentId) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/chapters/${currentId}/audio`)
      .then((response) => response.json().catch(() => null))
      .then((payload: { data?: { audioUrl?: string } } | null) => {
        if (cancelled) {
          return;
        }
        const url = payload?.data?.audioUrl;
        if (url) {
          setSource({ chapterId: currentId, url });
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
  }, [currentId, source?.chapterId, attempt]);

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

  const ready = source?.chapterId === current.id;

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
      ) : ready ? (
        <audio
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
