"use client";

import { useEffect, useState } from "react";

function readCoverUrl(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    return null;
  }
  const data = (payload as { data?: { cover?: { coverUrl?: unknown } } }).data;
  return typeof data?.cover?.coverUrl === "string" ? data.cover.coverUrl : null;
}

/** Short-lived signed cover URL; `version` refetches it after the project changes. */
export function useProjectCover(projectId: string | null, hasCover: boolean, version?: string): string | null {
  const [cover, setCover] = useState<{ projectId: string; url: string } | null>(null);

  useEffect(() => {
    if (!projectId || !hasCover) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/cover`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        const url = readCoverUrl(payload);
        if (!cancelled && url) {
          setCover({ projectId, url });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, hasCover, version]);

  return hasCover && cover?.projectId === projectId ? cover.url : null;
}
