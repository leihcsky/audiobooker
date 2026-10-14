"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { SpeechSpeedControl, DEFAULT_SPEECH_SPEED } from "@/components/tts/speech-speed-control";
import { PremiumEstimate } from "@/components/billing/premium-estimate";
import { BookSummary, SelectionSummary } from "@/components/projects/book-summary";
import { useProjectCover } from "@/components/projects/use-project-cover";
import { bookStats } from "@/lib/projects/book-stats";
import { useVoiceOptions, VoiceSelect } from "@/components/tts/voice-select";
import { useVoicePreview, VoicePreviewButton, VoicePreviewPlayer } from "@/components/tts/voice-preview";
import { formatAudioDuration } from "@/lib/audio/format-duration";
import { estimatePremiumSeconds } from "@/lib/billing/premium-usage";
import type { ChapterSummary, ProjectGenerationSummary } from "@/lib/projects/project.detail";
import type { ProjectProgress } from "@/lib/projects/project.progress";
import { formatSpokenLength } from "@/lib/tts/narration-length";
import { userFacingTtsError } from "@/lib/tts/tts-error-copy";
import { cn } from "@/lib/utils";

type ApiErrorPayload = { error?: { code?: string; message?: string } };

type ProjectWorkspaceProps = {
  projectId: string;
  book: { title: string; hasCover: boolean; updatedAt: string };
  chapters: ChapterSummary[];
  progress: ProjectProgress;
  generation: ProjectGenerationSummary | null;
  premiumAvailableSeconds: number;
};

type ChapterState = "ready" | "outdated" | "generating" | "queued" | "failed" | "pending";

function chapterState(chapter: ChapterSummary): ChapterState {
  if (chapter.status === "GENERATING") {
    return "generating";
  }
  if (chapter.latestTtsJobStatus === "QUEUED") {
    return "queued";
  }
  if (chapter.hasAudio) {
    return chapter.audioOutdated ? "outdated" : "ready";
  }
  return chapter.status === "FAILED" ? "failed" : "pending";
}

const STATE_LABEL: Record<ChapterState, string> = {
  ready: "Ready",
  outdated: "Text changed",
  generating: "Generating",
  queued: "Queued",
  failed: "Failed",
  pending: "Pending",
};

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function needsNarration(chapter: ChapterSummary): boolean {
  return (
    chapter.included &&
    chapter.status !== "GENERATING" &&
    chapter.characterCount > 0 &&
    (!chapter.hasAudio || chapter.audioOutdated)
  );
}

export function ProjectWorkspace({
  projectId,
  book,
  chapters,
  progress,
  generation,
  premiumAvailableSeconds,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const voices = useVoiceOptions();
  const [chosenVoiceId, setVoiceId] = useState(
    chapters.find((chapter) => chapter.selectedVoiceId)?.selectedVoiceId ?? "",
  );
  const [speed, setSpeed] = useState(chapters[0]?.selectedSpeed || DEFAULT_SPEECH_SPEED);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [includedDraft, setIncludedDraft] = useState<string[] | null>(null);
  const [savingSelection, setSavingSelection] = useState(false);
  const selectionQueue = useRef<Promise<void>>(Promise.resolve());
  const latestSelection = useRef(0);

  const serverIncluded = chapters.filter((chapter) => chapter.included).map((chapter) => chapter.id);
  if (includedDraft && !savingSelection && sameIds(includedDraft, serverIncluded)) {
    setIncludedDraft(null);
  }
  const includedIds = new Set(includedDraft ?? serverIncluded);
  const displayChapters = chapters.map((chapter) =>
    includedIds.has(chapter.id) === chapter.included
      ? chapter
      : { ...chapter, included: includedIds.has(chapter.id) },
  );

  const voiceId = voices.some((voice) => voice.id === chosenVoiceId)
    ? chosenVoiceId
    : (voices[0]?.id ?? "");
  const generationActive =
    generation?.job.status === "QUEUED" || generation?.job.status === "PROCESSING";
  const chapterGenerating = chapters.some((chapter) => chapter.status === "GENERATING");
  const narrating = generationActive || chapterGenerating;
  const busy = pending !== null || narrating;
  const preview = useVoicePreview(voiceId, speed);
  const toNarrate = displayChapters.filter(needsNarration);
  const currentChapter = generation?.currentChapterId
    ? chapters.find((chapter) => chapter.id === generation.currentChapterId) ?? null
    : null;
  const stats = bookStats(displayChapters);
  const coverUrl = useProjectCover(projectId, book.hasCover, book.updatedAt);
  const selectedVoice = voices.find((voice) => voice.id === voiceId);
  const premiumSelected = selectedVoice?.tier === "PREMIUM";
  const premiumNeeded = premiumSelected
    ? toNarrate.reduce(
        (sum, chapter) =>
          sum +
          estimatePremiumSeconds({
            characters: chapter.characterCount,
            languageCode: selectedVoice.language,
          }),
        0,
      )
    : 0;
  const premiumShort = premiumSelected && premiumNeeded > premiumAvailableSeconds;

  useEffect(() => {
    if (!generationActive && !chapterGenerating) {
      return;
    }
    const timer = window.setInterval(async () => {
      if (generationActive) {
        // Polling the generation endpoint also resumes a job stalled by a server restart.
        await fetch(`/api/projects/${projectId}/generate`, { cache: "no-store" }).catch(() => undefined);
      }
      router.refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [chapterGenerating, generationActive, projectId, router]);

  async function send(action: string, path: string, init: RequestInit): Promise<boolean> {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(path, {
        ...init,
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
        setError(userFacingTtsError(payload?.error?.code, payload?.error?.message));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setPending(null);
    }
  }

  function onGenerate() {
    void send("generate", `/api/projects/${projectId}/generate`, {
      method: "POST",
      body: JSON.stringify({ voiceId, speed }),
    });
  }

  function onStop() {
    void send("stop", `/api/projects/${projectId}/generate`, { method: "DELETE" });
  }

  function persistIncluded(nextIds: string[]) {
    setIncludedDraft(nextIds);
    setSavingSelection(true);
    setError(null);
    const requestId = ++latestSelection.current;
    selectionQueue.current = selectionQueue.current.then(async () => {
      const failure = await fetch(`/api/projects/${projectId}/chapters`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includedIds: nextIds }),
      })
        .then(async (response) => {
          if (response.ok) {
            return null;
          }
          const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
          return payload?.error?.message ?? "We couldn't save the chapter selection.";
        })
        .catch(() => "We couldn't save the chapter selection.");
      if (requestId !== latestSelection.current) {
        return;
      }
      if (failure) {
        setIncludedDraft(null);
        setError(failure);
      } else {
        router.refresh();
      }
      setSavingSelection(false);
    });
  }

  function toggleIncluded(chapterId: string, checked: boolean) {
    persistIncluded(
      chapters
        .filter((chapter) => (chapter.id === chapterId ? checked : includedIds.has(chapter.id)))
        .map((chapter) => chapter.id),
    );
  }

  function move(index: number, offset: -1 | 1) {
    const ids = chapters.map((chapter) => chapter.id);
    const target = index + offset;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void send("reorder", `/api/projects/${projectId}/chapters/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ chapterIds: ids }),
    });
  }

  async function onDelete(chapterId: string) {
    const deleted = await send("delete", `/api/chapters/${chapterId}`, { method: "DELETE" });
    if (deleted) {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <BookSummary title={book.title} author={null} coverUrl={coverUrl} stats={stats.book} showTitle={false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Narration</CardTitle>
          <CardDescription>
            {progress.chapterCount === 0
              ? "Select the chapters to include in the audiobook."
              : `${progress.percentage}% complete · ${progress.readyCount} of ${progress.chapterCount} chapters ready${
                  progress.audioSeconds > 0 ? ` · ${formatAudioDuration(progress.audioSeconds)} of audio` : ""
                }`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percentage}
            aria-label="Audiobook progress"
          >
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.percentage}%` }} />
          </div>

          {generationActive && generation ? (
            <div className="rounded-md bg-muted px-4 py-3 text-sm">
              <p className="font-medium">
                Generating your audiobook · chapter{" "}
                {Math.min(generation.completedChapters + 1, generation.totalChapters)} of {generation.totalChapters}
              </p>
              <p className="mt-1 text-muted-foreground">
                {currentChapter ? currentChapter.title : "Preparing the next chapter..."}
                {currentChapter?.generationProgress && currentChapter.generationProgress.totalChunks > 1
                  ? ` · ${currentChapter.generationProgress.percentage}%`
                  : ""}
                {" · "}You can leave this page; narration continues.
              </p>
            </div>
          ) : null}

          {!generationActive && generation?.job.status === "FAILED" ? (
            <p className="text-sm text-destructive">
              {userFacingTtsError(generation.job.errorCode ?? undefined, generation.job.errorMessage ?? undefined)}{" "}
              Finished chapters are kept; generate again to continue.
            </p>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-voice">Narration voice</Label>
              <VoiceSelect
                id="project-voice"
                voices={voices}
                value={voiceId}
                onChange={setVoiceId}
                disabled={busy}
              />
            </div>
            <SpeechSpeedControl id="project-speed" value={speed} onChange={setSpeed} disabled={busy} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <VoicePreviewButton preview={preview} disabled={!voiceId || pending !== null} />
            <Button
              onClick={onGenerate}
              disabled={!voiceId || busy || savingSelection || premiumShort || toNarrate.length === 0}
            >
              {pending === "generate" || generationActive
                ? "Generating..."
                : toNarrate.length > 0
                  ? `Generate ${toNarrate.length} chapter${toNarrate.length === 1 ? "" : "s"}`
                  : "Generate audiobook"}
            </Button>
            {generationActive ? (
              <Button variant="outline" onClick={onStop} disabled={pending !== null}>
                {pending === "stop" ? "Stopping..." : "Stop"}
              </Button>
            ) : null}
            {!generationActive && toNarrate.length === 0 && progress.chapterCount > 0 ? (
              <span className="text-sm text-muted-foreground">Every selected chapter has up-to-date audio.</span>
            ) : null}
            {!generationActive && premiumSelected && toNarrate.length > 0 ? (
              <PremiumEstimate neededSeconds={premiumNeeded} availableSeconds={premiumAvailableSeconds} />
            ) : null}
          </div>

          <VoicePreviewPlayer audioUrl={preview.audioUrl} />

          {error ?? preview.error ? <p className="text-sm text-destructive">{error ?? preview.error}</p> : null}

          <p className="text-sm text-muted-foreground">
            A name or word read wrong?{" "}
            <Link href={`/studio/projects/${projectId}/pronunciation`} className="underline">
              Fix it in the pronunciation dictionary
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chapters</CardTitle>
          <CardDescription>
            Open a chapter to edit its text, listen to it, or regenerate it. Checked chapters go into the audiobook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectionSummary
            selected={stats.selected}
            totalChapters={chapters.length}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => persistIncluded(chapters.map((chapter) => chapter.id))}
                  disabled={narrating}
                >
                  Select all
                </Button>
                <Button variant="outline" size="sm" onClick={() => persistIncluded([])} disabled={narrating}>
                  Select none
                </Button>
              </>
            }
          />
          <ol className="space-y-2">
            {displayChapters.map((chapter, index) => {
              const state = chapterState(chapter);
              const href = `/studio/projects/${projectId}/chapters/${chapter.id}`;
              const confirming = confirmDeleteId === chapter.id;
              return (
                <li
                  key={chapter.id}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 hover:bg-muted/40",
                    !chapter.included && "opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
                    aria-label={`Include ${chapter.title}`}
                    checked={chapter.included}
                    disabled={narrating}
                    onChange={(event) => toggleIncluded(chapter.id, event.target.checked)}
                  />
                  <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-1">
                    <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                      {String(chapter.orderIndex).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">{chapter.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        <span
                          className={cn(
                            state === "ready" && "text-primary",
                            state === "failed" && "text-destructive",
                            state === "outdated" && "text-amber-700 dark:text-amber-400",
                            state === "generating" && "text-foreground",
                          )}
                        >
                          {STATE_LABEL[state]}
                        </span>
                        {" · "}
                        {chapter.wordCount.toLocaleString()} words
                        {" · "}
                        {chapter.audioDurationSeconds != null
                          ? formatAudioDuration(chapter.audioDurationSeconds)
                          : `about ${formatSpokenLength(chapter.estimatedSeconds)}`}
                      </span>
                    </span>
                  </Link>
                  {confirming ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">Delete this chapter?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void onDelete(chapter.id)}
                        disabled={pending !== null}
                      >
                        {pending === "delete" ? "Deleting..." : "Delete"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={href}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                      >
                        <PencilIcon className="size-3.5 shrink-0" />
                        Edit
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        title="Move up"
                        aria-label={`Move ${chapter.title} up`}
                        onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        title="Move down"
                        aria-label={`Move ${chapter.title} down`}
                        onClick={() => move(index, 1)}
                        disabled={busy || index === chapters.length - 1}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 text-muted-foreground hover:text-destructive"
                        title="Delete chapter"
                        aria-label={`Delete ${chapter.title}`}
                        onClick={() => setConfirmDeleteId(chapter.id)}
                        disabled={busy || chapters.length <= 1}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
