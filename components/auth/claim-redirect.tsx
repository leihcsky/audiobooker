"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ClaimRedirect({ projectId }: { projectId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/claim`, { method: "POST" }).then((response) => {
      if (cancelled) {
        return;
      }
      router.replace(response.ok ? `/studio/projects/${projectId}` : "/studio");
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  return <p className="text-sm text-muted-foreground">Saving your project to Studio...</p>;
}
