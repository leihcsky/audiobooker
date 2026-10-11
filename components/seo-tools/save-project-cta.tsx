"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SaveProjectCtaProps = {
  projectId: string;
  signedIn: boolean;
  reason?: string;
};

export function SaveProjectCta({ projectId, signedIn, reason }: SaveProjectCtaProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setPending(true);
    setError(null);
    void fetch("/api/tools/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "tool_signup_clicked", projectId }),
    }).catch(() => undefined);

    if (!signedIn) {
      router.push(`/signup?claim=${encodeURIComponent(projectId)}`);
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/claim`, { method: "POST" });
    setPending(false);
    if (!response.ok) {
      setError("We couldn't save this project. Try again or open Studio.");
      return;
    }
    router.push(`/studio/projects/${projectId}`);
  }

  return (
    <div className="rounded-md border border-border bg-card px-4 py-4">
      <p className="font-medium">Save this project to Studio</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {reason ??
          "Keep the chapters, audio, and remaining work in your account so you can finish the book later."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void onSave()} disabled={pending}>
          {signedIn ? (pending ? "Saving..." : "Save to Studio") : "Create a free account"}
        </Button>
        {!signedIn ? (
          <Link
            href={`/login?claim=${encodeURIComponent(projectId)}`}
            className="text-sm hover:underline"
          >
            Sign in
          </Link>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
