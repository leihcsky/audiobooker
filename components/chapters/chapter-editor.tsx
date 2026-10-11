"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ChapterEditorProps = {
  chapterId: string;
  title: string;
  sourceText: string;
  hasAudio: boolean;
  locked: boolean;
};

export function ChapterEditor({ chapterId, title, sourceText, hasAudio, locked }: ChapterEditorProps) {
  const router = useRouter();
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftText, setDraftText] = useState(sourceText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const titleChanged = draftTitle.trim() !== title;
  const textChanged = draftText.trim() !== sourceText.trim();
  const dirty = titleChanged || textChanged;

  async function onSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(titleChanged ? { title: draftTitle } : {}),
          ...(textChanged ? { sourceText: draftText } : {}),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(payload?.error?.message ?? "We couldn't save this chapter.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("We couldn't save this chapter.");
    } finally {
      setPending(false);
    }
  }

  function onReset() {
    setDraftTitle(title);
    setDraftText(sourceText);
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chapter text</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="chapter-title">Title</Label>
          <Input
            id="chapter-title"
            value={draftTitle}
            maxLength={500}
            onChange={(event) => {
              setDraftTitle(event.target.value);
              setSaved(false);
            }}
            disabled={locked || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chapter-text">Text</Label>
          <Textarea
            id="chapter-text"
            className="min-h-[28rem] font-serif text-base leading-8"
            value={draftText}
            onChange={(event) => {
              setDraftText(event.target.value);
              setSaved(false);
            }}
            disabled={locked || pending}
          />
          <p className="text-xs text-muted-foreground">
            {draftText.trim().length.toLocaleString()} characters
            {textChanged && hasAudio ? " · Saving keeps the current audio until you regenerate." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void onSave()} disabled={!dirty || locked || pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
          {dirty ? (
            <Button variant="outline" onClick={onReset} disabled={pending}>
              Discard
            </Button>
          ) : null}
          {saved && !dirty ? <span className="text-sm text-muted-foreground">Saved</span> : null}
          {locked ? (
            <span className="text-sm text-muted-foreground">Editing is paused while this chapter is narrated.</span>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
