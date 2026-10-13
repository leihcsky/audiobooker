"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BookPlayer } from "@/components/seo-tools/book-player";
import { SaveProjectCta } from "@/components/seo-tools/save-project-cta";
import { SpeechSpeedControl, DEFAULT_SPEECH_SPEED } from "@/components/tts/speech-speed-control";
import { planNarrationWithinBudget } from "@/lib/tools/narration-plan";
import { acceptAttribute, type SeoToolConfig, type ToolFormat } from "@/lib/tools/tool-config";
import {
  bindProjectToTool,
  clearToolProjectBinding,
  isProjectBoundToTool,
} from "@/lib/tools/tool-workspace";
import type { ChapterSummary, JobSummary, ProjectDetailDto } from "@/lib/projects/project.detail";
import type { ExportDto } from "@/lib/export/export.dto";
import { titleFromFilename } from "@/lib/projects/project-title";
import { formatSpokenLength } from "@/lib/tts/narration-length";
import { groupVoices, voiceLabel } from "@/lib/voices/voice-label";
import { narrationFailureCopy } from "@/lib/tts/narration-failure";

type ApiError = {
  success: false;
  error: { code: string; message: string };
};

type VoiceOption = {
  id: string;
  provider: string;
  name: string;
  language: string;
  languageName: string;
  gender?: string;
  tier: "STANDARD" | "PREMIUM";
};

type ToolLimits = {
  maxFileBytes: number;
  maxCharacters: number;
  remainingCharacters: number;
};

type AudiobookToolProps = {
  config: SeoToolConfig;
  signedIn: boolean;
};

function extensionForFile(file: File): ToolFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".epub")) {
    return "EPUB";
  }
  if (name.endsWith(".pdf")) {
    return "PDF";
  }
  if (name.endsWith(".txt")) {
    return "TXT";
  }
  return null;
}

function userFacingError(code?: string, fallback = "Something went wrong. Please try again.") {
  if (code === "FILE_TOO_LARGE") {
    return "That file is too large for this free tool.";
  }
  if (code === "FILE_TYPE_NOT_SUPPORTED") {
    return "This page does not accept that file type.";
  }
  if (code === "GENERATION_LIMIT_REACHED") {
    if (/already running|job is already/i.test(fallback)) {
      return "A narration job is still running. Wait until it finishes or stops, then click Generate audiobook again. Finished chapters are kept.";
    }
    return fallback;
  }
  if (
    code === "TTS_PREMIUM_NOT_AVAILABLE" ||
    code === "TTS_PREMIUM_QUOTA_EXCEEDED" ||
    code === "TTS_COST_LIMIT_EXCEEDED" ||
    code === "TTS_CAPACITY_REACHED"
  ) {
    return fallback;
  }
  if (code === "USAGE_LIMIT_EXCEEDED") {
    return "This month's narration limit has been reached.";
  }
  if (code === "SESSION_EXPIRED") {
    return "This free session has expired. Refresh the page to start again.";
  }
  if (code === "CONFLICT") {
    return "This session already has a project. Save it to Studio to start another.";
  }
  if (code === "VALIDATION_ERROR") {
    return "Select at least one chapter to narrate.";
  }
  if (code?.startsWith("TTS_")) {
    return narrationFailureCopy({ title: "this chapter", code });
  }
  return fallback;
}

/** Limit errors carry an action-specific server message (narration, preview, export), so prefer it over the generic fallback. */
function apiErrorCopy(payload: unknown, fallback?: string): string {
  if (!isApiError(payload)) {
    return userFacingError(undefined, fallback);
  }
  const { code, message } = payload.error;
  return userFacingError(code, code === "GENERATION_LIMIT_REACHED" && message ? message : fallback);
}

function chapterCountLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function triggerDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

type CompletedExports = Partial<Record<ExportDto["type"], ExportDto>>;

function exportLabel(type: ExportDto["type"]): string {
  return type === "M4B" ? "M4B" : "MP3 ZIP";
}

function chunkProgressLabel(chapter: ChapterSummary): string {
  const progress = chapter.generationProgress;
  if (!progress || progress.totalChunks < 2) {
    return "";
  }
  return ` · ${progress.percentage}%`;
}

function preferredVoiceId(voices: VoiceOption[], language?: string | null): string {
  const primary = language?.trim().toLowerCase().split(/[-_]/)[0];
  const match = primary
    ? voices.find((voice) => voice.language.toLowerCase().split("-")[0] === primary)
    : undefined;
  return (match ?? voices[0])?.id ?? "";
}

async function readJson<T>(response: Response): Promise<T | ApiError> {
  return (await response.json().catch(() => null)) as T | ApiError;
}

function isApiError(payload: unknown): payload is ApiError {
  return Boolean(payload && typeof payload === "object" && "success" in payload && payload.success === false);
}

function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : Math.round(megabytes * 10) / 10} MB`;
}

function isChapterInFlight(chapter: ChapterSummary): boolean {
  return chapter.latestTtsJobStatus === "QUEUED" || chapter.latestTtsJobStatus === "PROCESSING";
}

export function AudiobookTool({ config, signedIn }: AudiobookToolProps) {
  const [limits, setLimits] = useState<ToolLimits | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [chosenVoiceId, setVoiceId] = useState("");
  const [speed, setSpeed] = useState(DEFAULT_SPEECH_SPEED);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [exportFormat, setExportFormat] = useState<"mp3" | "m4b">("mp3");
  const [activeExport, setActiveExport] = useState<ExportDto | null>(null);
  const [completedExports, setCompletedExports] = useState<CompletedExports>({});
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [bootFailed, setBootFailed] = useState(false);
  const [otherPageProjectId, setOtherPageProjectId] = useState<string | null>(null);
  const selectionRequest = useRef(0);
  const chaptersRef = useRef<ChapterSummary[]>([]);
  const audioUrlsRef = useRef<Record<string, string>>({});
  const audioPending = useRef(new Set<string>());

  const chapters = useMemo(() => detail?.chapters ?? [], [detail]);
  const voiceId = voices.some((voice) => voice.id === chosenVoiceId)
    ? chosenVoiceId
    : preferredVoiceId(voices, detail?.project.language);
  const latestSource = detail?.sourceFiles[0] ?? null;
  const parseJob = detail?.latestParseJob ?? null;
  const parsing = parseJob?.status === "QUEUED" || parseJob?.status === "PROCESSING";
  const generating = chapters.some((chapter) => chapter.status === "GENERATING");
  const generation = detail?.generation ?? null;
  const batchRunning =
    generation?.job.status === "QUEUED" || generation?.job.status === "PROCESSING";
  const busyGenerating = generating || batchRunning;
  const selectedChapters = useMemo(
    () => chapters.filter((chapter) => chapter.included),
    [chapters],
  );
  const readyChapters = useMemo(
    () => selectedChapters.filter((chapter) => chapter.hasAudio),
    [selectedChapters],
  );
  const leftoverChapters = useMemo(
    () => selectedChapters.filter((chapter) => !chapter.hasAudio),
    [selectedChapters],
  );
  const remaining = limits?.remainingCharacters ?? 0;
  const totalWords = useMemo(
    () => chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    [chapters],
  );
  const totalSeconds = useMemo(
    () => chapters.reduce((sum, chapter) => sum + chapter.estimatedSeconds, 0),
    [chapters],
  );
  const narrationPlan = useMemo(
    () => planNarrationWithinBudget(chapters, remaining),
    [chapters, remaining],
  );
  const generatingChapter = chapters.find((chapter) => chapter.status === "GENERATING") ?? null;
  const batchChapter = batchRunning && generation?.currentChapterId
    ? chapters.find((chapter) => chapter.id === generation.currentChapterId) ?? null
    : null;
  const progressChapter = batchChapter ?? generatingChapter;
  const remainingBatchSeconds = batchRunning
    ? chapters
        .filter((chapter) => isChapterInFlight(chapter))
        .reduce((sum, chapter) => sum + chapter.estimatedSeconds, 0)
    : 0;

  const recordEvent = useCallback(async (name: string, extra?: Record<string, string>) => {
    await fetch("/api/tools/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        path: `/${config.slug}`,
        projectId,
        ...extra,
      }),
    }).catch(() => undefined);
  }, [config.slug, projectId]);

  const fetchProject = useCallback(async (id: string) => {
    const response = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    const payload = await readJson<{ success: true; data: ProjectDetailDto }>(response);
    if (!response.ok || isApiError(payload) || !("data" in payload)) {
      throw new Error(apiErrorCopy(payload));
    }
    return payload.data;
  }, []);

  const loadProject = useCallback(async (id: string) => {
    const data = await fetchProject(id);
    setDetail(data);
    return data;
  }, [fetchProject]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [sessionResponse, voicesResponse] = await Promise.all([
          fetch("/api/tools/session", { method: "POST" }),
          fetch("/api/voices"),
        ]);
        const sessionPayload = await readJson<{
          success: true;
          data: { projectId: string | null; limits: ToolLimits };
        }>(sessionResponse);
        const voicesPayload = await readJson<{
          success: true;
          data: { voices: VoiceOption[] };
        }>(voicesResponse);
        if (!sessionResponse.ok || isApiError(sessionPayload) || !("data" in sessionPayload)) {
          throw new Error("Unable to start a free-tool session.");
        }
        if (cancelled) {
          return;
        }
        setLimits(sessionPayload.data.limits);
        const sessionProjectId = sessionPayload.data.projectId;
        if (sessionProjectId && isProjectBoundToTool(sessionProjectId, config.slug)) {
          setProjectId(sessionProjectId);
          await loadProject(sessionProjectId);
        } else if (sessionProjectId) {
          setOtherPageProjectId(sessionProjectId);
        }
        if (!isApiError(voicesPayload) && "data" in voicesPayload && voicesPayload.data.voices[0]) {
          setVoices(voicesPayload.data.voices);
        }
        await fetch("/api/tools/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "seo_tool_view", path: `/${config.slug}` }),
        });
      } catch {
        if (!cancelled) {
          setBootFailed(true);
          setUploadError("We couldn't start the tool. Refresh the page and try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.slug, loadProject]);

  useEffect(() => {
    if (!parseJob || !projectId || !parsing) {
      return;
    }
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${parseJob.id}`);
      const payload = await readJson<{ success: true; data: { job: JobSummary } }>(response);
      if (!response.ok || isApiError(payload) || !("data" in payload)) {
        return;
      }
      if (payload.data.job.status === "COMPLETED") {
        await recordEvent("tool_parse_completed");
        await loadProject(projectId);
      }
      if (payload.data.job.status === "FAILED") {
        await loadProject(projectId);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadProject, parseJob, parsing, projectId, recordEvent]);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  const generatingChapterId = generatingChapter?.id;
  useEffect(() => {
    if (batchRunning || !generatingChapterId || !projectId) {
      return;
    }
    const timer = window.setInterval(async () => {
      const refreshed = await loadProject(projectId);
      const current = refreshed.chapters.find((chapter) => chapter.id === generatingChapterId);
      if (current?.status === "READY") {
        await recordEvent("tool_generate_completed");
      }
      if (current?.status === "FAILED") {
        await recordEvent("tool_generate_failed");
        setError(
          narrationFailureCopy({
            title: current.title,
            code: current.generationError?.code,
            message: current.generationError?.message,
          }),
        );
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [batchRunning, generatingChapterId, loadProject, projectId, recordEvent]);

  const generationJobId = batchRunning ? generation?.job.id ?? null : null;
  useEffect(() => {
    if (!generationJobId || !projectId) {
      return;
    }
    const timer = window.setInterval(async () => {
      // Polling the generation endpoint also resumes a job stalled by a server restart.
      await fetch(`/api/projects/${projectId}/generate`, { cache: "no-store" }).catch(() => undefined);
      const before = new Set(
        chaptersRef.current.filter((chapter) => chapter.hasAudio).map((chapter) => chapter.id),
      );
      const refreshed = await loadProject(projectId).catch(() => null);
      if (!refreshed) {
        return;
      }
      const narrated = refreshed.chapters
        .filter((chapter) => chapter.hasAudio && !before.has(chapter.id))
        .reduce((sum, chapter) => sum + chapter.characterCount, 0);
      if (narrated > 0) {
        setLimits((current) =>
          current
            ? { ...current, remainingCharacters: Math.max(0, current.remainingCharacters - narrated) }
            : current,
        );
      }
      const finished = refreshed.generation;
      if (!finished || finished.job.id !== generationJobId) {
        return;
      }
      if (finished.job.status === "COMPLETED") {
        await recordEvent("tool_generate_completed");
      }
      if (finished.job.status === "FAILED") {
        await recordEvent("tool_generate_failed");
        const failed = refreshed.chapters.find((chapter) => chapter.generationError);
        setError(
          narrationFailureCopy({
            title: failed?.title ?? "This chapter",
            code: failed?.generationError?.code ?? finished.job.errorCode ?? undefined,
            message: failed?.generationError?.message ?? finished.job.errorMessage ?? undefined,
          }),
        );
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [generationJobId, loadProject, projectId, recordEvent]);

  useEffect(() => {
    if (!busyGenerating) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busyGenerating]);

  useEffect(() => {
    const missing = readyChapters.filter(
      (chapter) => !audioUrlsRef.current[chapter.id] && !audioPending.current.has(chapter.id),
    );
    if (missing.length === 0) {
      return;
    }
    let cancelled = false;
    for (const chapter of missing) {
      audioPending.current.add(chapter.id);
    }
    void Promise.all(
      missing.map(async (chapter) => {
        const response = await fetch(`/api/chapters/${chapter.id}/audio`);
        const payload = await readJson<{ success: true; data: { audioUrl?: string } }>(response);
        if (!response.ok || isApiError(payload) || !("data" in payload) || !payload.data.audioUrl) {
          return null;
        }
        return [chapter.id, payload.data.audioUrl] as const;
      }),
    )
      .then((entries) => {
        for (const chapter of missing) {
          audioPending.current.delete(chapter.id);
        }
        if (cancelled) {
          return;
        }
        const next: Record<string, string> = {};
        for (const entry of entries) {
          if (entry) {
            next[entry[0]] = entry[1];
          }
        }
        if (Object.keys(next).length === 0) {
          return;
        }
        audioUrlsRef.current = { ...audioUrlsRef.current, ...next };
        setAudioUrls(audioUrlsRef.current);
      })
      .catch(() => {
        for (const chapter of missing) {
          audioPending.current.delete(chapter.id);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [readyChapters]);

  const downloadExport = useCallback(async (exportId: string) => {
    const response = await fetch(`/api/exports/${exportId}/download`);
    const payload = await readJson<{
      success: true;
      data: { download: { downloadUrl: string } };
    }>(response);
    if (!response.ok || isApiError(payload) || !("data" in payload)) {
      setExportError(apiErrorCopy(payload, "This download is no longer available. Export the audiobook again."));
      return;
    }
    triggerDownload(payload.data.download.downloadUrl);
    setDownloadStarted(true);
  }, []);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/projects/${projectId}/exports`, { cache: "no-store" });
      const payload = await readJson<{ success: true; data: { exports: ExportDto[] } }>(response);
      if (cancelled || !response.ok || isApiError(payload) || !("data" in payload)) {
        return;
      }
      const latest: CompletedExports = {};
      for (const item of payload.data.exports) {
        if (item.status === "COMPLETED" && !latest[item.type]) {
          latest[item.type] = item;
        }
      }
      setCompletedExports(latest);
      const running = payload.data.exports.find(
        (item) => item.status === "QUEUED" || item.status === "PROCESSING",
      );
      if (running) {
        setActiveExport(running);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!activeExport?.id || !projectId) {
      return;
    }
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/exports/${activeExport.id}`);
      const payload = await readJson<{ success: true; data: { export: ExportDto } }>(response);
      if (!response.ok || isApiError(payload) || !("data" in payload)) {
        return;
      }
      const finished = payload.data.export;
      if (finished.status === "COMPLETED") {
        setCompletedExports((current) => ({ ...current, [finished.type]: finished }));
        setActiveExport(null);
        await downloadExport(finished.id);
        await recordEvent("tool_export_completed");
      }
      if (finished.status === "FAILED") {
        setActiveExport(null);
        setExportError(finished.errorMessage ?? "We couldn't export this audiobook. Try again in a moment.");
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeExport?.id, downloadExport, projectId, recordEvent]);

  useEffect(() => {
    if (!projectId || !detail?.project.hasCover) {
      return;
    }
    const id = projectId;
    let cancelled = false;
    void fetch(`/api/projects/${id}/cover`)
      .then(async (response) => {
        const payload = await readJson<{ success: true; data: { cover?: { coverUrl?: string } } }>(response);
        if (!cancelled && !isApiError(payload) && "data" in payload && payload.data.cover?.coverUrl) {
          setCoverUrl(payload.data.cover.coverUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [detail?.project.hasCover, detail?.project.updatedAt, projectId]);

  async function ensureProject(title: string): Promise<string> {
    if (projectId) {
      return projectId;
    }
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const payload = await readJson<{ success: true; data: { project: { id: string } } }>(response);
    if (!response.ok || isApiError(payload) || !("data" in payload)) {
      throw new Error(apiErrorCopy(payload));
    }
    bindProjectToTool(payload.data.project.id, config.slug);
    setProjectId(payload.data.project.id);
    return payload.data.project.id;
  }

  async function startParse(id: string, sourceFileId: string) {
    const response = await fetch(`/api/projects/${id}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceFileId }),
    });
    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setUploadError(apiErrorCopy(payload, "We couldn't process this file."));
      return;
    }
    await loadProject(id);
  }

  function clearLocalBookState() {
    setProjectId(null);
    setDetail(null);
    setCoverUrl(null);
    setPreviewUrl(null);
    audioUrlsRef.current = {};
    audioPending.current.clear();
    setAudioUrls({});
    setActiveExport(null);
    setCompletedExports({});
    setExportError(null);
    setDownloadStarted(false);
    setError(null);
    setUploadError(null);
  }

  async function onStartOver() {
    setUploadError(null);
    setPending("reset");
    const response = await fetch("/api/tools/reset", { method: "POST" });
    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setPending(null);
      setUploadError(apiErrorCopy(payload, "We couldn't start over."));
      return;
    }
    clearToolProjectBinding();
    setOtherPageProjectId(null);
    clearLocalBookState();
    const sessionResponse = await fetch("/api/tools/session", { method: "POST" });
    const sessionPayload = await readJson<{
      success: true;
      data: { projectId: string | null; limits: ToolLimits };
    }>(sessionResponse);
    if (!sessionResponse.ok || isApiError(sessionPayload) || !("data" in sessionPayload)) {
      setPending(null);
      return;
    }
    setLimits(sessionPayload.data.limits);
    setPending(null);
  }

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const format = extensionForFile(file);
    if (!format || !config.supportedFormats.includes(format)) {
      setUploadError(`Upload a ${config.supportedFormats.join(", ")} file on this page.`);
      return;
    }
    if (limits && file.size > limits.maxFileBytes) {
      setUploadError(
        `This file is ${formatMegabytes(file.size)}. The free tool accepts files up to ${formatMegabytes(limits.maxFileBytes)}.`,
      );
      return;
    }

    setUploadError(null);
    if (otherPageProjectId && !projectId) {
      setPending("upload");
      const response = await fetch("/api/tools/reset", { method: "POST" });
      if (!response.ok) {
        const payload = await readJson<ApiError>(response);
        setPending(null);
        setUploadError(apiErrorCopy(payload, "We couldn't upload this file."));
        return;
      }
      clearToolProjectBinding();
      setOtherPageProjectId(null);
    }
    await uploadFile(file);
  }

  async function uploadFile(file: File) {
    setPending("upload");
    await recordEvent("tool_file_selected");
    try {
      const id = await ensureProject(titleFromFilename(file.name));
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const presignPayload = await readJson<{
        success: true;
        data: { uploadUrl: string; objectKey: string };
      }>(presignResponse);
      if (!presignResponse.ok || isApiError(presignPayload) || !("data" in presignPayload)) {
        setUploadError(apiErrorCopy(presignPayload));
        return;
      }

      const uploadBody = new FormData();
      uploadBody.set("objectKey", presignPayload.data.objectKey);
      uploadBody.set("file", file);
      const uploadResponse = await fetch("/api/uploads/object", { method: "POST", body: uploadBody });
      if (!uploadResponse.ok) {
        const payload = await readJson<ApiError>(uploadResponse);
        setUploadError(apiErrorCopy(payload, "We couldn't upload this file."));
        return;
      }

      const confirmResponse = await fetch(`/api/projects/${id}/source-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: presignPayload.data.objectKey,
          originalFilename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      if (!confirmResponse.ok) {
        const payload = await readJson<ApiError>(confirmResponse);
        setUploadError(apiErrorCopy(payload));
        return;
      }
      setPreviewUrl(null);
      audioUrlsRef.current = {};
      audioPending.current.clear();
      setAudioUrls({});
      setActiveExport(null);
      setCompletedExports({});
      setExportError(null);
      setDownloadStarted(false);
      const uploaded = await loadProject(id);
      const source = uploaded.sourceFiles[0];
      if (source) {
        await startParse(id, source.id);
      }
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "We couldn't upload this file.");
    } finally {
      setPending(null);
    }
  }

  async function onParse() {
    if (!projectId || !latestSource) {
      return;
    }
    setUploadError(null);
    setPending("parse");
    await startParse(projectId, latestSource.id);
    setPending(null);
  }

  async function persistIncluded(includedIds: string[]) {
    if (!projectId || !detail) {
      return;
    }
    const requestId = selectionRequest.current + 1;
    selectionRequest.current = requestId;
    const previous = chaptersRef.current.map((chapter) => ({
      id: chapter.id,
      included: chapter.included,
    }));
    const selected = new Set(includedIds);
    const nextChapters = chaptersRef.current.map((chapter) => ({
      ...chapter,
      included: selected.has(chapter.id),
    }));
    chaptersRef.current = nextChapters;
    setError(null);
    setDetail((current) => (current ? { ...current, chapters: nextChapters } : current));
    const response = await fetch(`/api/projects/${projectId}/chapters`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includedIds }),
    });
    if (requestId !== selectionRequest.current) {
      return;
    }
    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      const includedById = new Map(previous.map((chapter) => [chapter.id, chapter.included]));
      setDetail((current) => {
        if (!current) {
          return current;
        }
        const chapters = current.chapters.map((chapter) => ({
          ...chapter,
          included: includedById.get(chapter.id) ?? chapter.included,
        }));
        chaptersRef.current = chapters;
        return { ...current, chapters };
      });
      setError(apiErrorCopy(payload));
    }
  }

  async function onToggleChapter(chapter: ChapterSummary, checked: boolean) {
    const includedIds = chaptersRef.current
      .filter((item) => (item.id === chapter.id ? checked : item.included))
      .map((item) => item.id);
    await persistIncluded(includedIds);
  }

  async function onPreview() {
    if (!voiceId) {
      return;
    }
    setPending("preview");
    setError(null);
    const response = await fetch(`/api/voices/${voiceId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed }),
    });
    const payload = await readJson<{ success: true; data: { audioUrl?: string } }>(response);
    setPending(null);
    if (!response.ok || isApiError(payload) || !("data" in payload) || !payload.data.audioUrl) {
      setError(apiErrorCopy(payload, "We couldn't preview this voice."));
      return;
    }
    setPreviewUrl(payload.data.audioUrl);
  }

  async function generateAudiobook() {
    if (!voiceId || !projectId) {
      return;
    }
    const queue = narrationPlan.toGenerate;
    if (queue.length === 0) {
      if (leftoverChapters.length === 0) {
        setError("Select at least one chapter that still needs audio.");
      } else {
        setError(
          signedIn
            ? `“${leftoverChapters[0].title}” is larger than your remaining narration allowance. Unselect later chapters, or save the project to continue in Studio.`
            : "You've reached the end of the free preview. Create a free account below to narrate the rest of the book.",
        );
      }
      return;
    }

    setPending("generate");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, speed, chapterIds: queue.map((chapter) => chapter.id) }),
      });
      const payload = await readJson<{ success: true; data: { generation: unknown } }>(response);
      if (!response.ok || isApiError(payload) || !("data" in payload)) {
        const apiMessage = isApiError(payload) ? payload.error.message : undefined;
        setError(
          userFacingError(
            isApiError(payload) ? payload.error.code : undefined,
            apiMessage ?? "We couldn't start narration. The chapters already finished stay ready to play or export.",
          ),
        );
        return;
      }
      await loadProject(projectId).catch(() => undefined);
    } finally {
      setPending(null);
    }
  }

  async function stopGeneration() {
    if (!projectId) {
      return;
    }
    setPending("stop");
    try {
      await fetch(`/api/projects/${projectId}/generate`, { method: "DELETE" }).catch(() => undefined);
      await loadProject(projectId).catch(() => undefined);
    } finally {
      setPending(null);
    }
  }

  async function onExport() {
    if (!projectId || readyChapters.length === 0) {
      return;
    }
    setPending("export");
    setExportError(null);
    setDownloadStarted(false);
    const response = await fetch(`/api/projects/${projectId}/export/${exportFormat}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportFormat === "m4b" ? { includeCover: Boolean(detail?.project.hasCover) } : { includeMetadata: true }),
    });
    const payload = await readJson<{ success: true; data: { export: ExportDto } }>(response);
    setPending(null);
    if (!response.ok || isApiError(payload) || !("data" in payload)) {
      setExportError(apiErrorCopy(payload, "We couldn't export this audiobook."));
      return;
    }
    setActiveExport(payload.data.export);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload {config.supportedFormats.join(", ")}</CardTitle>
          <CardDescription>
            {!limits
              ? "Starting a free session..."
              : signedIn
                ? `Files up to ${formatMegabytes(limits.maxFileBytes)} · Standard voices are free`
                : `Files up to ${formatMegabytes(limits.maxFileBytes)} · Try the first chapters free, finish the book with a free account`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">
              {pending === "upload"
                ? "Uploading..."
                : latestSource
                  ? "Replace file"
                  : "Choose file"}
              <input
                type="file"
                accept={acceptAttribute(config.supportedFormats)}
                className="sr-only"
                disabled={pending !== null || parsing || busyGenerating || bootFailed}
                onChange={(event) => void onUpload(event)}
              />
            </label>
            {projectId ? (
              <Button
                variant="outline"
                onClick={() => void onStartOver()}
                disabled={pending !== null || parsing || busyGenerating}
              >
                {pending === "reset" ? "Starting over..." : "Start over"}
              </Button>
            ) : null}
          </div>
          {latestSource ? (
            <p className="text-sm text-muted-foreground">
              {latestSource.originalFilename} · {latestSource.type} · {latestSource.status}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No file uploaded yet.</p>
          )}
          {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
          {parsing ? (
            <p className="text-sm">Parsing your book and detecting chapters...</p>
          ) : null}
          {latestSource && !parsing && chapters.length === 0 && parseJob?.status !== "FAILED" ? (
            <Button onClick={() => void onParse()} disabled={pending !== null}>
              {pending === "parse" ? "Starting..." : "Parse book"}
            </Button>
          ) : null}
          {latestSource && !parsing && chapters.length > 0 && parseJob?.status !== "FAILED" ? (
            <Button variant="outline" onClick={() => void onParse()} disabled={pending !== null || busyGenerating}>
              {pending === "parse" ? "Starting..." : "Re-parse book"}
            </Button>
          ) : null}
          {parseJob?.status === "FAILED" ? (
            <Button onClick={() => void onParse()} disabled={pending !== null}>
              Try again
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {chapters.length > 0 ? (
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-start gap-5">
              {detail?.project.hasCover && coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt={`Cover of ${detail?.project.title ?? "the book"}`}
                  className="h-40 w-28 shrink-0 rounded-md border border-border object-cover"
                />
              ) : null}
              <div className="min-w-0 space-y-2">
                <CardTitle className="break-words">{detail?.project.title ?? "Untitled book"}</CardTitle>
                {detail?.project.author ? (
                  <p className="text-sm">by {detail.project.author}</p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {chapters.length} chapters · {totalWords.toLocaleString()} words ·{" "}
                  {formatSpokenLength(totalSeconds)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void persistIncluded(chapters.map((chapter) => chapter.id))}
                disabled={parsing || busyGenerating}
              >
                Select all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void persistIncluded([])}
                disabled={parsing || busyGenerating}
              >
                Select none
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedChapters.length} of {chapters.length} chapters selected
              </span>
            </div>
            <ol className="divide-y divide-border text-sm">
              {chapters.map((chapter) => {
                const currentBatch = batchChapter?.id === chapter.id;
                const queued =
                  batchRunning && !currentBatch && chapter.status !== "GENERATING" && chapter.latestTtsJobStatus === "QUEUED";
                const beyondBudget = narrationPlan.beyondBudget.some((item) => item.id === chapter.id);
                const statusLabel = chapter.hasAudio
                  ? "Ready"
                  : chapter.status === "GENERATING" || currentBatch
                    ? "Generating"
                    : chapter.status === "FAILED"
                      ? "Stopped"
                      : queued
                        ? "Queued"
                        : beyondBudget
                          ? signedIn ? "Beyond this month's allowance" : "Free account"
                          : "";
                return (
                  <li key={chapter.id} className="space-y-2 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={chapter.included}
                          disabled={busyGenerating}
                          onChange={(event) => void onToggleChapter(chapter, event.target.checked)}
                        />
                        <span>
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            {String(chapter.orderIndex).padStart(2, "0")}
                          </span>
                          {chapter.title}
                        </span>
                      </label>
                      <span className="shrink-0 text-muted-foreground">
                        {`${chapter.wordCount.toLocaleString()} words · ${formatSpokenLength(chapter.estimatedSeconds)}`}
                        {statusLabel ? ` · ${statusLabel}` : ""}
                      </span>
                    </div>
                    {audioUrls[chapter.id] ? (
                      <audio className="w-full" controls src={audioUrls[chapter.id]} preload="metadata">
                        Your browser does not support audio playback.
                      </audio>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {chapters.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Voice and narration</CardTitle>
            <CardDescription>
              One click generates every selected chapter that still needs audio, in order, within your remaining allowance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="seo-voice">Narration voice</Label>
              <select
                id="seo-voice"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={voiceId}
                onChange={(event) => setVoiceId(event.target.value)}
                disabled={pending !== null || parsing || busyGenerating}
              >
                {groupVoices(voices).map((group) => (
                  <optgroup key={group.key} label={group.label}>
                    {group.voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voiceLabel(voice)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <SpeechSpeedControl
              id="seo-speed"
              value={speed}
              onChange={setSpeed}
              disabled={pending !== null || busyGenerating}
            />
            <div className="space-y-2 text-sm text-muted-foreground">
              {narrationPlan.toGenerate.length > 0 ? (
                <p>
                  This click will generate {narrationPlan.toGenerate.length} chapter{narrationPlan.toGenerate.length === 1 ? "" : "s"}
                  {" · "}
                  {formatSpokenLength(narrationPlan.estimatedSeconds)}.
                </p>
              ) : leftoverChapters.length === 0 ? (
                <p>Every selected chapter already has audio.</p>
              ) : signedIn ? (
                <p>
                  The next chapter is larger than your remaining narration allowance. Save the project to continue in Studio.
                </p>
              ) : null}
              {narrationPlan.beyondBudget.length > 0 ? (
                <p className={signedIn ? undefined : "font-medium text-foreground"}>
                  {signedIn
                    ? `${chapterCountLabel(narrationPlan.beyondBudget.length, "later chapter")} won't fit your remaining allowance. Save the project to continue in Studio.`
                    : `The free preview covers the first part of the book. ${chapterCountLabel(narrationPlan.beyondBudget.length, "more chapter")} need${narrationPlan.beyondBudget.length === 1 ? "s" : ""} a free account; your finished chapters come with you.`}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void onPreview()} disabled={!voiceId || pending !== null || busyGenerating}>
                {pending === "preview" ? "Previewing..." : "Preview voice"}
              </Button>
              <Button
                onClick={() => void generateAudiobook()}
                disabled={
                  !voiceId
                  || pending !== null
                  || busyGenerating
                  || narrationPlan.toGenerate.length === 0
                }
              >
                {busyGenerating || pending === "generate" ? "Generating..." : "Generate audiobook"}
              </Button>
              {batchRunning ? (
                <Button variant="outline" onClick={() => void stopGeneration()} disabled={pending !== null}>
                  {pending === "stop" ? "Stopping..." : "Stop"}
                </Button>
              ) : null}
            </div>
            {busyGenerating ? (
              <p className="text-sm">
                {batchRunning && generation && progressChapter
                  ? `Generating ${Math.min(generation.completedChapters + 1, generation.totalChapters)} of ${generation.totalChapters}: ${progressChapter.title}${chunkProgressLabel(progressChapter)} (${formatSpokenLength(remainingBatchSeconds)} remaining). `
                  : progressChapter
                    ? `Generating “${progressChapter.title}”${chunkProgressLabel(progressChapter)}. `
                    : "Starting narration... "}
                You can leave this page; narration continues and finished chapters are saved.
              </p>
            ) : null}
            {previewUrl ? (
              <audio className="w-full" controls src={previewUrl} preload="metadata">
                Your browser does not support audio playback.
              </audio>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {readyChapters.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Listen and export</CardTitle>
            <CardDescription>
              Play the finished chapters in order, or pack them into one download. Missing chapters are not generated here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BookPlayer chapters={readyChapters} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Format</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="seo-export-format"
                  checked={exportFormat === "mp3"}
                  onChange={() => setExportFormat("mp3")}
                />
                MP3 ZIP
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="seo-export-format"
                  checked={exportFormat === "m4b"}
                  onChange={() => setExportFormat("m4b")}
                />
                M4B
              </label>
            </fieldset>
            {exportError ? <p className="text-sm text-destructive">{exportError}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void onExport()} disabled={pending !== null || busyGenerating || Boolean(activeExport)}>
                {pending === "export" ? "Starting..." : activeExport ? "Exporting..." : "Export audiobook"}
              </Button>
              {(["M4B", "ZIP"] as const).map((type) => {
                const item = completedExports[type];
                return item ? (
                  <Button key={type} variant="outline" onClick={() => void downloadExport(item.id)}>
                    Download {exportLabel(type)}
                  </Button>
                ) : null;
              })}
            </div>
            {activeExport ? (
              <p className="text-sm text-muted-foreground">
                Packing your audiobook. The download starts automatically when it&apos;s ready.
              </p>
            ) : downloadStarted ? (
              <p className="text-sm text-muted-foreground">Your download has started.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {projectId && (readyChapters.length > 0 || leftoverChapters.length > 0) ? (
        <SaveProjectCta
          projectId={projectId}
          signedIn={signedIn}
          title={
            !signedIn && narrationPlan.beyondBudget.length > 0
              ? `Narrate the remaining ${chapterCountLabel(narrationPlan.beyondBudget.length, "chapter")}`
              : undefined
          }
          reason={
            !signedIn && narrationPlan.beyondBudget.length > 0
              ? "Create a free account to finish this book in Studio. The chapters you've already made move with it."
              : leftoverChapters.length > 0
                ? "The remaining chapters stay with the project. Save it to finish narration in Studio."
                : undefined
          }
        />
      ) : null}
    </div>
  );
}
