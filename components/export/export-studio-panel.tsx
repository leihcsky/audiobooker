"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExportDto } from "@/lib/export/export.dto";
import type { ExportReadinessDto } from "@/lib/export/export.service";
import type { JobSummary } from "@/lib/projects/project.detail";
import type { ProjectDto } from "@/lib/projects/project.dto";
import { QcReportDetails } from "@/components/export/qc-report-details";
import { DEFAULT_NARRATOR_CREDIT } from "@/lib/publish/disclosure";
import { cn, formatDate } from "@/lib/utils";

type ApiError = {
  success: false;
  error: { code: string; message: string };
};

type ExportStudioPanelProps = {
  project: ProjectDto;
  readiness: ExportReadinessDto;
  exports: ExportDto[];
  canMaster: boolean;
};

type ExportFormat = "publish" | "mp3" | "m4b";

function exportLabel(item: ExportDto): string {
  if (item.type === "M4B") {
    return "M4B audiobook";
  }
  return item.masteringPreset ? "Publish-ready MP3" : "MP3 ZIP";
}

function userFacingExportError(code?: string, fallback?: string) {
  if (code === "EXPORT_AUDIO_INCOMPLETE") {
    return "Generate audio for every chapter before exporting.";
  }
  if (code === "EXPORT_BUSY") {
    return "An export is already in progress.";
  }
  if (code === "FILE_TOO_LARGE") {
    return "That cover image is too large.";
  }
  if (code === "FILE_TYPE_NOT_SUPPORTED") {
    return "Use a JPEG, PNG, or WebP cover image.";
  }
  if (code === "PLAN_REQUIRED") {
    return "Publish-ready exports are part of the Creator plan.";
  }
  return fallback ?? "We couldn't export this audiobook.";
}

function formatBytes(value: string | null): string {
  if (!value) {
    return "";
  }
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportStudioPanel({ project, readiness, exports, canMaster }: ExportStudioPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"metadata" | "cover" | "export" | null>(null);
  const [format, setFormat] = useState<ExportFormat>(canMaster ? "publish" : "m4b");
  const [loadedCoverUrl, setLoadedCoverUrl] = useState<string | null>(null);
  const [startedExport, setStartedExport] = useState<ExportDto | null>(null);
  const exportsState = useMemo(() => {
    if (!startedExport || exports.some((item) => item.id === startedExport.id)) {
      return exports;
    }
    return [startedExport, ...exports];
  }, [exports, startedExport]);
  const coverUrl = loadedCoverUrl;
  const activeExport = useMemo(
    () => exportsState.find((item) => item.status === "QUEUED" || item.status === "PROCESSING") ?? null,
    [exportsState],
  );
  const canExport = readiness.ready && pending !== "export" && !activeExport;

  useEffect(() => {
    if (!project.hasCover) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/projects/${project.id}/cover`)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { data?: { cover?: { coverUrl?: string } } };
        if (!cancelled && payload.data?.cover?.coverUrl) {
          setLoadedCoverUrl(payload.data.cover.coverUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.hasCover, project.id]);

  useEffect(() => {
    if (!activeExport?.jobId) {
      return;
    }
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${activeExport.jobId}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { data?: { job?: JobSummary } };
      if (
        payload.data?.job &&
        payload.data.job.status !== "QUEUED" &&
        payload.data.job.status !== "PROCESSING"
      ) {
        router.refresh();
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeExport?.jobId, router]);

  async function onSaveMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending("metadata");
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/projects/${project.id}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(formData.get("title") ?? ""),
        author: String(formData.get("author") ?? ""),
        narrator: String(formData.get("narrator") ?? ""),
        language: String(formData.get("language") ?? ""),
        publisher: String(formData.get("publisher") ?? ""),
        copyright: String(formData.get("copyright") ?? ""),
        description: String(formData.get("description") ?? ""),
      }),
    });
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    setPending(null);
    if (!response.ok) {
      setError(payload?.error.message ?? "Unable to save metadata.");
      return;
    }
    router.refresh();
  }

  async function onUploadCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setError(null);
    setPending("cover");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/projects/${project.id}/cover`, {
      method: "POST",
      body: form,
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiError
      | { success: true; data: { cover: { coverUrl: string } } }
      | null;
    setPending(null);
    if (!response.ok || !payload || !("success" in payload) || !payload.success) {
      setError(userFacingExportError((payload as ApiError | null)?.error.code, "Unable to upload cover."));
      return;
    }
    setLoadedCoverUrl(payload.data.cover.coverUrl);
    router.refresh();
  }

  async function onExport() {
    setError(null);
    setPending("export");
    const response = await fetch(`/api/projects/${project.id}/export/${format === "m4b" ? "m4b" : "mp3"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        format === "m4b"
          ? { includeCover: true }
          : { includeMetadata: true, ...(format === "publish" ? { mastering: "publish" } : {}) },
      ),
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiError
      | { success: true; data: { export: ExportDto } }
      | null;
    setPending(null);
    if (!response.ok || !payload || !("success" in payload) || !payload.success) {
      setError(userFacingExportError((payload as ApiError | null)?.error.code, payload && "error" in payload ? payload.error.message : undefined));
      return;
    }
    setStartedExport(payload.data.export);
    router.refresh();
  }

  async function onDownload(exportId: string) {
    setError(null);
    const response = await fetch(`/api/exports/${exportId}/download`);
    const payload = (await response.json().catch(() => null)) as
      | ApiError
      | { success: true; data: { download: { downloadUrl: string } } }
      | null;
    if (!response.ok || !payload || !("success" in payload) || !payload.success) {
      setError(userFacingExportError((payload as ApiError | null)?.error.code, "This export is not available."));
      return;
    }
    window.location.assign(payload.data.download.downloadUrl);
  }

  return (
    <div className="space-y-8">
      <Card id="metadata" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Audiobook metadata</CardTitle>
          <CardDescription>These fields are written into the M4B file and the MP3 package.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveMetadata} className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={255} defaultValue={project.title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input id="author" name="author" maxLength={255} defaultValue={project.author ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="narrator">Narrator</Label>
              <Input
                id="narrator"
                name="narrator"
                maxLength={255}
                placeholder={DEFAULT_NARRATOR_CREDIT}
                defaultValue={project.narrator ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input id="language" name="language" maxLength={20} defaultValue={project.language} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input id="publisher" name="publisher" maxLength={255} defaultValue={project.publisher ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="copyright">Copyright</Label>
              <Input id="copyright" name="copyright" maxLength={255} defaultValue={project.copyright ?? ""} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                maxLength={5000}
                defaultValue={project.description ?? ""}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={pending !== null}>
                {pending === "metadata" ? "Saving..." : "Save metadata"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="cover" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Cover</CardTitle>
          <CardDescription>
            Square JPEG, PNG, or WebP. Stores recommend 3000×3000 pixels.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start gap-6">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={`${project.title} cover`}
              className="h-40 w-40 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              No cover
            </div>
          )}
          <label className="inline-flex">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={pending !== null}
              onChange={onUploadCover}
            />
            <span className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm hover:bg-muted">
              {pending === "cover" ? "Uploading..." : "Upload cover"}
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chapters</CardTitle>
          <CardDescription>
            {readiness.readyChapterCount} of {readiness.chapterCount} chapters have audio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readiness.chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Parse a book before exporting.</p>
          ) : (
            <ol className="divide-y divide-border">
              {readiness.chapters.map((chapter) => (
                <li key={chapter.id} className="flex items-center justify-between gap-4 py-3">
                  <Link
                    href={`/studio/projects/${project.id}/chapters/${chapter.id}`}
                    className="min-w-0 hover:underline"
                  >
                    <span className="mr-3 font-mono text-xs text-muted-foreground">
                      {String(chapter.orderIndex).padStart(2, "0")}
                    </span>
                    <span className="font-medium">{chapter.title}</span>
                  </Link>
                  <span className={chapter.hasAudio ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
                    {chapter.hasAudio ? "Ready" : "Missing audio"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Package the generated chapter audio into a downloadable audiobook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Format</legend>
            <div id="publish-ready" className="scroll-mt-24 rounded-md border border-border p-3">
              <label className={cn("flex items-start gap-2 text-sm", !canMaster && "text-muted-foreground")}>
                <input
                  type="radio"
                  name="format"
                  className="mt-1"
                  checked={format === "publish"}
                  disabled={!canMaster}
                  onChange={() => setFormat("publish")}
                />
                <span>
                  <span className="font-medium text-foreground">Publish-ready MP3</span>
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    Creator
                  </span>
                  <span className="mt-1 block">
                    Mastered for Spotify and Google Play: even loudness, 192 kbps, opening credits, and a
                    quality report for every file.
                  </span>
                </span>
              </label>
              {!canMaster ? (
                <Link href="/pricing" className="mt-2 ml-6 inline-block text-sm font-medium underline">
                  Upgrade to Creator
                </Link>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={format === "mp3"}
                onChange={() => setFormat("mp3")}
              />
              MP3 ZIP — original chapter files
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={format === "m4b"}
                onChange={() => setFormat("m4b")}
              />
              M4B — single audiobook with chapter markers
            </label>
          </fieldset>

          {activeExport ? (
            <div className="rounded-md bg-muted px-4 py-3 text-sm">
              <p className="font-medium">
                {activeExport.status === "QUEUED" ? "Export queued..." : "Exporting your audiobook..."}
              </p>
              <p className="mt-1 text-muted-foreground">
                {activeExport.masteringPreset
                  ? "Mastering takes a few minutes per hour of audio. You can leave this page."
                  : "This can take a few minutes for longer books."}
              </p>
            </div>
          ) : null}

          {!readiness.ready && readiness.chapterCount > 0 ? (
            <p className="text-sm text-destructive">
              Generate audio for the missing chapters before exporting the full audiobook.
            </p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button onClick={onExport} disabled={!canExport}>
            {pending === "export" ? "Starting..." : "Export audiobook"}
          </Button>
        </CardContent>
      </Card>

      <Card id="exports" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Export history</CardTitle>
        </CardHeader>
        <CardContent>
          {exportsState.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {exportsState.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{exportLabel(item)}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.status}
                      {item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
                      {` · ${formatDate(item.createdAt)}`}
                    </p>
                    {item.status === "FAILED" && item.errorMessage ? (
                      <p className="mt-1 text-sm text-destructive">{item.errorMessage}</p>
                    ) : null}
                    {item.status === "COMPLETED" && item.qcReport ? <QcReportDetails report={item.qcReport} /> : null}
                  </div>
                  {item.status === "COMPLETED" ? (
                    <Button variant="outline" onClick={() => void onDownload(item.id)}>
                      Download
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
