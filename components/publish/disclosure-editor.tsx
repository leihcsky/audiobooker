"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_AI_DISCLOSURE, MAX_AI_DISCLOSURE_LENGTH } from "@/lib/publish/disclosure";

type DisclosureEditorProps = {
  projectId: string;
  effectiveDisclosure: string;
};

type ApiError = { success: false; error: { code: string; message: string } };

export function DisclosureEditor({ projectId, effectiveDisclosure }: DisclosureEditorProps) {
  const router = useRouter();
  const [text, setText] = useState(effectiveDisclosure);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = text.trim() !== effectiveDisclosure;

  async function save(value: string | null) {
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiDisclosure: value }),
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiError
      | { success: true; data: { metadata: { effectiveAiDisclosure: string } } }
      | null;
    setPending(false);
    if (!response.ok || !payload || !payload.success) {
      setError((payload as ApiError | null)?.error.message ?? "Unable to save the disclosure.");
      return;
    }
    setText(payload.data.metadata.effectiveAiDisclosure);
    setMessage("Saved. New exports will include it.");
    router.refresh();
  }

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text.trim());
      setMessage("Copied.");
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="ai-disclosure">Disclosure text</Label>
      <Textarea
        id="ai-disclosure"
        value={text}
        maxLength={MAX_AI_DISCLOSURE_LENGTH}
        rows={3}
        onChange={(event) => {
          setText(event.target.value);
          setMessage(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void copy()} disabled={pending}>
          Copy
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void save(text.trim() === DEFAULT_AI_DISCLOSURE ? null : text)}
          disabled={pending || !dirty || text.trim().length === 0}
        >
          {pending ? "Saving..." : "Save"}
        </Button>
        {effectiveDisclosure !== DEFAULT_AI_DISCLOSURE ? (
          <Button type="button" variant="ghost" onClick={() => void save(null)} disabled={pending}>
            Use default text
          </Button>
        ) : null}
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
