"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { SpeechSpeedControl, DEFAULT_SPEECH_SPEED } from "@/components/tts/speech-speed-control";
import { PayPerBookPanel } from "@/components/billing/pay-per-book-panel";
import { PremiumEstimate } from "@/components/billing/premium-estimate";
import { PremiumVoiceNudge } from "@/components/billing/premium-voice-nudge";
import { BookSummary, SelectionSummary } from "@/components/projects/book-summary";
import { useProjectCover } from "@/components/projects/use-project-cover";
import { BookPlayer } from "@/components/seo-tools/book-player";
import { bookStats } from "@/lib/projects/book-stats";
import { useVoiceOptions, VoiceSelect, voiceOptionSupportsSpeed } from "@/components/tts/voice-select";
import { useVoicePreview, VoicePreviewButton, VoicePreviewPlayer } from "@/components/tts/voice-preview";
import { formatAudioDuration } from "@/lib/audio/format-duration";
import { chaptersNeedingPayPerBookRegen } from "@/lib/billing/pay-per-book-shared";
import { estimatePremiumSeconds } from "@/lib/billing/premium-usage";
import { planProjectNarration } from "@/lib/chapters/project-narration";
import type { ChapterSummary, ProjectGenerationSummary } from "@/lib/projects/project.detail";
import type { ProjectProgress } from "@/lib/projects/project.progress";
import { formatSpokenLength } from "@/lib/tts/narration-length";
import { userFacingTtsError } from "@/lib/tts/tts-error-copy";
import { cn } from "@/lib/utils";

type ApiErrorPayload = { error?: { code?: string; message?: string } };

type ProjectWorkspaceProps = {
  projectId: string;
  book: { title: string; author: string | null; hasCover: boolean; updatedAt: string };
  chapters: ChapterSummary[];
  progress: ProjectProgress;
  generation: ProjectGenerationSummary | null;
  premiumAvailableSeconds: number;
  planId: "free" | "creator";
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

export function ProjectWorkspace({
  projectId,
  book,
  chapters,
  progress,
  generation,
  premiumAvailableSeconds,
  planId,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const voices = useVoiceOptions();
  const [chosenVoiceId, setVoiceId] = useState(
    chapters.find((chapter) => chapter.selectedVoiceId)?.selectedVoiceId ?? "",
  );
  const [speed, setSpeed] = useState(chapters[0]?.selectedSpeed || DEFAULT_SPEECH_SPEED);
  const [pending, setPending] = useState<string | null>(null);
  /** Keeps the generate button busy across the gap between request end and server narrating state. */
  const [holdNarrating, setHoldNarrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRematch, setConfirmRematch] = useState(false);
  const [premiumPayMode, setPremiumPayMode] = useState<"minutes" | "pay_per_book">(
    planId === "creator" ? "minutes" : "pay_per_book",
  );
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
  const selectedVoice = voices.find((voice) => voice.id === voiceId);
  const speedSupported = voiceOptionSupportsSpeed(selectedVoice);
  const effectiveSpeed = speedSupported ? speed : DEFAULT_SPEECH_SPEED;
  const generationActive =
    generation?.job.status === "QUEUED" || generation?.job.status === "PROCESSING";
  const chapterGenerating = chapters.some((chapter) => chapter.status === "GENERATING");
  const serverNarrating = generationActive || chapterGenerating;
  const narrating = serverNarrating || holdNarrating;
  const busy = pending !== null || narrating;
  const preview = useVoicePreview(voiceId, effectiveSpeed);
  const narration = planProjectNarration(displayChapters, voiceId, effectiveSpeed);
  const toNarrate = narration.targets;
  const currentChapter = generation?.currentChapterId
    ? chapters.find((chapter) => chapter.id === generation.currentChapterId) ?? null
    : null;
  const stats = bookStats(displayChapters);
  const listenChapters = displayChapters
    .filter((chapter) => chapter.included && chapter.hasAudio)
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      audioKey: chapter.currentAudioFileId,
    }));
  const coverUrl = useProjectCover(projectId, book.hasCover, book.updatedAt);
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
  const usePayPerBook = premiumSelected && (planId !== "creator" || premiumPayMode === "pay_per_book");
  const useMinutes = premiumSelected && planId === "creator" && premiumPayMode === "minutes";
  const premiumShort = useMinutes && premiumNeeded > premiumAvailableSeconds;
  const ppbChapterIds =
    toNarrate.length > 0
      ? toNarrate.map((chapter) => chapter.id)
      : chaptersNeedingPayPerBookRegen({ chapters: displayChapters, voiceId, speed: effectiveSpeed });
  const showPayPerBook = usePayPerBook && ppbChapterIds.length > 0;
  const generateDisabled =
    !voiceId ||
    busy ||
    savingSelection ||
    toNarrate.length === 0 ||
    usePayPerBook ||
    premiumShort;

  useEffect(() => {
    if (serverNarrating) {
      setHoldNarrating(false);
    }
  }, [serverNarrating]);

  useEffect(() => {
    if (!holdNarrating) {
      return;
    }
    const timer = window.setTimeout(() => setHoldNarrating(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [holdNarrating]);

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
      await router.refresh();
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function startGeneration() {
    const body: { voiceId: string; speed: number; chapterIds?: string[] } = {
      voiceId,
      speed: effectiveSpeed,
    };
    if (narration.overwritesAudio) {
      body.chapterIds = toNarrate.map((chapter) => chapter.id);
    }
    setHoldNarrating(true);
    const ok = await send("generate", `/api/projects/${projectId}/generate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (ok) {
      setConfirmRematch(false);
    } else {
      setHoldNarrating(false);
    }
  }

  function onGenerate() {
    if (toNarrate.length === 0) {
      return;
    }
    if (narration.overwritesAudio) {
      setConfirmRematch(true);
      return;
    }
    void startGeneration();
  }

  function onStop() {
    void send("stop", `/api/projects/${projectId}/generate`, { method: "DELETE" }).then((ok) => {
      if (ok) {
        setHoldNarrating(false);
      }
    });
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
          <BookSummary title={book.title} author={book.author} coverUrl={coverUrl} stats={stats.book} />
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
            <SpeechSpeedControl
              id="project-speed"
              value={effectiveSpeed}
              onChange={setSpeed}
              disabled={busy}
              supported={speedSupported}
            />
          </div>

          {!premiumSelected && toNarrate.length > 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Want more expressive narration for storytelling and dialogue? Choose a{" "}
              <span className="font-medium text-foreground">Premium</span> voice above — use Premium
              Minutes or a one-time Pay-per-Book price for these chapters. Standard Voice stays on
              your plan allowance.
            </p>
          ) : null}

          {premiumSelected && planId === "creator" ? (
            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium">Premium payment</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="premium-pay-mode"
                  checked={premiumPayMode === "minutes"}
                  onChange={() => setPremiumPayMode("minutes")}
                  disabled={busy}
                />
                Use Premium Minutes ({Math.floor(premiumAvailableSeconds / 60)} min left)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="premium-pay-mode"
                  checked={premiumPayMode === "pay_per_book"}
                  onChange={() => setPremiumPayMode("pay_per_book")}
                  disabled={busy}
                />
                Pay once for these chapters (Pay-per-Book)
              </label>
            </fieldset>
          ) : null}

          {showPayPerBook ? (
            <PayPerBookPanel
              projectId={projectId}
              chapterIds={ppbChapterIds}
              voiceId={voiceId}
              speed={effectiveSpeed}
              selectedChapterCount={stats.selected.chapters}
              regenerateChapterIds={
                toNarrate.every((chapter) => chapter.hasAudio && !chapter.audioOutdated)
                  ? ppbChapterIds
                  : undefined
              }
              disabled={busy || savingSelection}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <VoicePreviewButton preview={preview} disabled={!voiceId || pending !== null} />
            <Button onClick={onGenerate} disabled={generateDisabled}>
              {pending === "generate" || narrating
                ? "Generating..."
                : toNarrate.length === 0
                  ? "Generate audiobook"
                  : narration.overwritesAudio
                    ? `Regenerate ${toNarrate.length} chapter${toNarrate.length === 1 ? "" : "s"}`
                    : `Generate ${toNarrate.length} chapter${toNarrate.length === 1 ? "" : "s"}`}
            </Button>
            {narrating ? (
              <Button variant="outline" onClick={onStop} disabled={pending !== null}>
                {pending === "stop" ? "Stopping..." : "Stop"}
              </Button>
            ) : null}
            {!generationActive && toNarrate.length === 0 && progress.chapterCount > 0 ? (
              <span className="text-sm text-muted-foreground">Every selected chapter has up-to-date audio.</span>
            ) : null}
            {!generationActive && useMinutes ? (
              <PremiumEstimate
                neededSeconds={toNarrate.length > 0 ? premiumNeeded : 0}
                availableSeconds={premiumAvailableSeconds}
                action={narration.overwritesAudio ? "regenerate" : "generate"}
              />
            ) : null}
          </div>

          <Dialog
            open={confirmRematch}
            title="Replace existing audio?"
            description={
              narration.rematchCount === toNarrate.length
                ? `${toNarrate.length} selected chapter${toNarrate.length === 1 ? "" : "s"} already have audio. Regenerating will overwrite ${toNarrate.length === 1 ? "it" : "them"} with the current voice and speed.`
                : `This will narrate ${toNarrate.length} selected chapter${toNarrate.length === 1 ? "" : "s"} with the current voice and speed. ${narration.rematchCount} already have audio and will be overwritten.`
            }
            onClose={() => {
              if (pending === null) {
                setConfirmRematch(false);
              }
            }}
          >
            {premiumSelected ? (
              <div className="mb-4">
                <PremiumEstimate
                  neededSeconds={premiumNeeded}
                  availableSeconds={premiumAvailableSeconds}
                  action="regenerate"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmRematch(false)}
                disabled={pending !== null}
              >
                Cancel
              </Button>
              <Button onClick={() => void startGeneration()} disabled={pending !== null || premiumShort}>
                {pending === "generate" ? "Starting..." : "Regenerate"}
              </Button>
            </div>
          </Dialog>

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

      {listenChapters.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Listen</CardTitle>
            <CardDescription>
              Play finished chapters in order. When one ends, the next starts automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BookPlayer chapters={listenChapters} />
            {!premiumSelected ? <PremiumVoiceNudge projectId={projectId} /> : null}
          </CardContent>
        </Card>
      ) : null}

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
