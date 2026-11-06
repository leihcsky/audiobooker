"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const storageKey = (projectId: string) => `audiobooker:premium-nudge:${projectId}`;

/**
 * Soft prompt after Standard audio exists. Dismissible; never blocks download or regenerate.
 */
export function PremiumVoiceNudge({ projectId }: { projectId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey(projectId)) === "1") {
        return;
      }
    } catch {
      // private mode — still show once per mount
    }
    setVisible(true);
  }, [projectId]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey(projectId), "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <aside className="rounded-xl border border-amber-700/25 bg-amber-50/50 px-5 py-4">
      <h3 className="font-serif text-lg tracking-tight">Want a More Expressive Audiobook?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try Premium Voice for more natural narration and engaging character dialogue. Your finished
        Standard audio stays available to download.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/pricing#voice-comparison-heading"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Explore Premium Voice
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </aside>
  );
}
