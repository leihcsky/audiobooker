"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobSummary, SourceFileSummary } from "@/lib/projects/project.detail";

type ApiError = {
  success: false;
  error: { code: string; message: string };
};

type SourceIngestionPanelProps = {
  projectId: string;
  sourceFiles: SourceFileSummary[];
  latestParseJob: JobSummary | null;
  chapterCount: number;
  narrating: boolean;
};

function userFacingError(code?: string, message?: string) {
  if ((code === "CONFLICT" || code === "PLAN_REQUIRED") && message) {
    return message;
  }
  if (code === "FILE_TOO_LARGE") {
    return "That file is too large.";
  }
  if (code === "FILE_TYPE_NOT_SUPPORTED") {
    return "Use an EPUB, PDF, or TXT file.";
  }
  if (code === "UPLOAD_FAILED") {
    return "We couldn't upload this file. Check the R2 credentials and try again.";
  }
  return "We couldn't process this file.";
}

export function SourceIngestionPanel({
  projectId,
  sourceFiles,
  latestParseJob,
  chapterCount,
  narrating,
}: SourceIngestionPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"upload" | "parse" | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [replaceSourceId, setReplaceSourceId] = useState<string | null>(null);
  const latestSource = sourceFiles[0] ?? null;
  const polling = latestParseJob?.status === "QUEUED" || latestParseJob?.status === "PROCESSING";

  useEffect(() => {
    if (!polling || !latestParseJob) {
      return;
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${latestParseJob.id}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { data?: { job?: JobSummary } };
      if (payload.data?.job && payload.data.job.status !== latestParseJob.status) {
        router.refresh();
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [latestParseJob, polling, router]);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setError(null);
    setPending("upload");

    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const presignPayload = (await presignResponse.json()) as
        | { success: true; data: { uploadUrl: string; objectKey: string } }
        | ApiError;

      if (!presignResponse.ok || !presignPayload.success) {
        setError(userFacingError(!presignPayload.success ? presignPayload.error.code : undefined));
        return;
      }

      const uploadBody = new FormData();
      uploadBody.set("objectKey", presignPayload.data.objectKey);
      uploadBody.set("file", file);

      const uploadResponse = await fetch("/api/uploads/object", {
        method: "POST",
        body: uploadBody,
      });
      if (!uploadResponse.ok) {
        const payload = (await uploadResponse.json().catch(() => null)) as ApiError | null;
        setError(userFacingError(payload?.error.code));
        return;
      }

      const confirmResponse = await fetch(`/api/projects/${projectId}/source-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: presignPayload.data.objectKey,
          originalFilename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const confirmPayload = (await confirmResponse.json().catch(() => null)) as
        | { success: true; data: { sourceFile: { id: string } } }
        | ApiError
        | null;
      if (!confirmResponse.ok || !confirmPayload?.success) {
        setError(userFacingError(confirmPayload && !confirmPayload.success ? confirmPayload.error.code : undefined));
        return;
      }

      const sourceFileId = confirmPayload.data.sourceFile.id;
      if (chapterCount === 0) {
        await startParse(sourceFileId);
        return;
      }
      if (!narrating) {
        setReplaceSourceId(sourceFileId);
        setConfirmReplace(true);
      }
      router.refresh();
    } catch {
      setError("We couldn't upload this file.");
    } finally {
      setPending(null);
    }
  }

  async function startParse(sourceFileId: string) {
    setError(null);
    setConfirmReplace(false);
    setReplaceSourceId(null);
    setPending("parse");
    try {
      const response = await fetch(`/api/projects/${projectId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFileId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        setError(userFacingError(payload?.error.code, payload?.error.message));
      }
    } catch {
      setError("We couldn't start reading this file. Try again.");
    } finally {
      setPending(null);
      router.refresh();
    }
  }

  function onParseClick() {
    if (chapterCount > 0) {
      setReplaceSourceId(null);
      setConfirmReplace(true);
      return;
    }
    if (latestSource) {
      void startParse(latestSource.id);
    }
  }

  function onConfirmReplace() {
    const sourceFileId = replaceSourceId ?? latestSource?.id;
    if (sourceFileId) {
      void startParse(sourceFileId);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
          <CardDescription>Upload your book. Supported: EPUB, PDF, TXT.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">
            {pending === "upload" ? "Uploading..." : pending === "parse" ? "Reading your book..." : "Choose File"}
            <input
              type="file"
              accept=".epub,.pdf,.txt,application/epub+zip,application/pdf,text/plain"
              className="sr-only"
              disabled={pending !== null || polling}
              onChange={onUpload}
            />
          </label>

          {latestSource ? (
            <p className="text-sm text-muted-foreground">
              {latestSource.originalFilename} · {latestSource.type} · {latestSource.status}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No source uploaded yet.</p>
          )}

          {polling ? (
            <div className="rounded-md bg-muted px-4 py-3 text-sm">
              <p className="font-medium">Parsing your book...</p>
              <p className="mt-1 text-muted-foreground">
                Analyzing document structure, extracting chapters, and preparing the project.
              </p>
            </div>
          ) : null}

          {latestParseJob?.status === "FAILED" ? (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm">
              <p className="font-medium">We couldn&apos;t process this file.</p>
              <Button className="mt-3" onClick={onParseClick} disabled={pending !== null || narrating}>
                Try Again
              </Button>
            </div>
          ) : null}

          {latestSource && chapterCount > 0 && !polling && latestParseJob?.status !== "FAILED" ? (
            <Button variant="outline" onClick={onParseClick} disabled={pending !== null || narrating}>
              Parse again
            </Button>
          ) : null}

          {latestSource && chapterCount === 0 && latestSource.status === "UPLOADED" && !polling && pending === null && latestParseJob?.status !== "FAILED" ? (
            <Button onClick={onParseClick}>Read chapters</Button>
          ) : null}

          {narrating && chapterCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Parsing is paused while chapters are being narrated.
            </p>
          ) : null}

          {confirmReplace ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
              <p className="font-medium">Replace all {chapterCount} chapters?</p>
              <p className="mt-1 text-muted-foreground">
                {replaceSourceId ? "The new file rebuilds the chapter list." : "Parsing again rebuilds the chapter list from this file."}{" "}
                Text edits, chapter order, and generated audio for the current chapters will be removed.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="destructive" size="sm" onClick={onConfirmReplace} disabled={pending !== null}>
                  Replace chapters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirmReplace(false);
                    setReplaceSourceId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
