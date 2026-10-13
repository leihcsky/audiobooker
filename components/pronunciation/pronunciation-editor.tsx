"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoicePreviewPlayer } from "@/components/tts/voice-preview";
import { useVoiceOptions, VoiceSelect } from "@/components/tts/voice-select";
import type { PronunciationEntryDto } from "@/lib/pronunciation/pronunciation.service";
import { userFacingTtsError } from "@/lib/tts/tts-error-copy";
import { PRONUNCIATION_REPLACEMENT_MAX, PRONUNCIATION_TERM_MAX } from "@/lib/validation/pronunciation";

type PronunciationEditorProps = {
  projectId: string;
  initialEntries: PronunciationEntryDto[];
  enabled: boolean;
  initialVoiceId: string | null;
  speed: number | null;
  maxEntries: number;
};

type RuleForm = {
  term: string;
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
};

type ApiPayload<T> = {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

const EMPTY_FORM: RuleForm = { term: "", replacement: "", caseSensitive: false, wholeWord: true };

async function callApi<T>(url: string, method: string, body?: unknown): Promise<ApiPayload<T> & { ok: boolean }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
    return { ok: response.ok && Boolean(payload?.success), ...payload };
  } catch {
    return { ok: false };
  }
}

function usageLabel(entry: PronunciationEntryDto): string {
  if (entry.occurrences === 0) {
    return "Not found in the selected chapters";
  }
  const times = `${entry.occurrences} ${entry.occurrences === 1 ? "time" : "times"}`;
  const chapters = `${entry.chapterCount} ${entry.chapterCount === 1 ? "chapter" : "chapters"}`;
  return `Found ${times} in ${chapters}`;
}

function sortEntries(entries: PronunciationEntryDto[]): PronunciationEntryDto[] {
  return [...entries].sort((a, b) => a.term.localeCompare(b.term));
}

export function PronunciationEditor({
  projectId,
  initialEntries,
  enabled,
  initialVoiceId,
  speed,
  maxEntries,
}: PronunciationEditorProps) {
  const voices = useVoiceOptions();
  const [entries, setEntries] = useState(initialEntries);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chosenVoiceId, setChosenVoiceId] = useState(initialVoiceId ?? "");
  /** "save", "preview", or the id of the entry being deleted. */
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ audioUrl: string; text: string } | null>(null);
  const [outdatedTotal, setOutdatedTotal] = useState(0);

  const voiceId = chosenVoiceId || voices[0]?.id || "";
  const baseUrl = `/api/projects/${projectId}/pronunciations`;
  const atLimit = entries.length >= maxEntries;
  const formReady = form.term.trim().length > 0 && form.replacement.trim().length > 0;

  function updateForm(patch: Partial<RuleForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setPreview(null);
  }

  function startEdit(entry: PronunciationEntryDto) {
    setEditingId(entry.id);
    setForm({
      term: entry.term,
      replacement: entry.replacement,
      caseSensitive: entry.caseSensitive,
      wholeWord: entry.wholeWord,
    });
    setPreview(null);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPreview(null);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending("save");
    setError(null);
    const result = editingId
      ? await callApi<{ entry: PronunciationEntryDto; outdatedChapters: number }>(`${baseUrl}/${editingId}`, "PATCH", form)
      : await callApi<{ entry: PronunciationEntryDto; outdatedChapters: number }>(baseUrl, "POST", form);
    setPending(null);
    if (!result.ok || !result.data) {
      setError(result.error?.message ?? "Unable to save the rule. Try again.");
      return;
    }
    const { entry: saved, outdatedChapters } = result.data;
    setEntries((current) => sortEntries([...current.filter((entry) => entry.id !== saved.id), saved]));
    setOutdatedTotal((total) => total + outdatedChapters);
    resetForm();
  }

  async function onDelete(entry: PronunciationEntryDto) {
    setPending(entry.id);
    setError(null);
    const result = await callApi<{ deleted: true; outdatedChapters: number }>(`${baseUrl}/${entry.id}`, "DELETE");
    setPending(null);
    if (!result.ok || !result.data) {
      setError(result.error?.message ?? "Unable to delete the rule. Try again.");
      return;
    }
    const { outdatedChapters } = result.data;
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setOutdatedTotal((total) => total + outdatedChapters);
    if (editingId === entry.id) {
      resetForm();
    }
  }

  async function onPreview() {
    setPending("preview");
    setError(null);
    const result = await callApi<{ audioUrl: string; text: string }>(`${baseUrl}/preview`, "POST", {
      ...form,
      voiceId,
      ...(speed === null ? {} : { speed }),
    });
    setPending(null);
    if (!result.ok || !result.data) {
      setError(userFacingTtsError(result.error?.code, result.error?.message));
      return;
    }
    setPreview(result.data);
  }

  return (
    <div className="space-y-6">
      {outdatedTotal > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {outdatedTotal} {outdatedTotal === 1 ? "chapter needs" : "chapters need"} regenerating to use your
          changes.{" "}
          <Link href={`/studio/projects/${projectId}`} className="font-medium underline">
            Go to the project to generate {outdatedTotal === 1 ? "it" : "them"}
          </Link>
          .
        </div>
      ) : null}

      {enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit rule" : "Add a rule"}</CardTitle>
            <CardDescription>
              Write the word the way it should sound. Listen before you save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => void onSave(event)}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pronunciation-term">Word or name in the book</Label>
                  <Input
                    id="pronunciation-term"
                    value={form.term}
                    maxLength={PRONUNCIATION_TERM_MAX}
                    placeholder="Hermione"
                    onChange={(event) => updateForm({ term: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pronunciation-replacement">Say it as</Label>
                  <Input
                    id="pronunciation-replacement"
                    value={form.replacement}
                    maxLength={PRONUNCIATION_REPLACEMENT_MAX}
                    placeholder="Her-MY-oh-nee"
                    onChange={(event) => updateForm({ replacement: event.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.wholeWord}
                    onChange={(event) => updateForm({ wholeWord: event.target.checked })}
                  />
                  Whole word only
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.caseSensitive}
                    onChange={(event) => updateForm({ caseSensitive: event.target.checked })}
                  />
                  Match case
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="pronunciation-voice">Listen with</Label>
                  <VoiceSelect
                    id="pronunciation-voice"
                    voices={voices}
                    value={voiceId}
                    onChange={(value) => {
                      setChosenVoiceId(value);
                      setPreview(null);
                    }}
                    disabled={pending !== null}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => void onPreview()}
                    disabled={!formReady || !voiceId || pending !== null}
                  >
                    {pending === "preview" ? "Listening..." : "Listen"}
                  </Button>
                  <Button type="submit" disabled={!formReady || pending !== null || (!editingId && atLimit)}>
                    {pending === "save" ? "Saving..." : editingId ? "Save changes" : "Add rule"}
                  </Button>
                  {editingId ? (
                    <Button variant="ghost" onClick={resetForm} disabled={pending !== null}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>

              {preview ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Heard: “{preview.text}”</p>
                  <VoicePreviewPlayer audioUrl={preview.audioUrl} />
                </div>
              ) : null}
              {!editingId && atLimit ? (
                <p className="text-sm text-muted-foreground">
                  This project has the maximum of {maxEntries} rules. Delete one to add another.
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            {entries.length === 0
              ? "No rules yet. Add the first word above."
              : `${entries.length} of ${maxEntries} rules`}
          </CardDescription>
        </CardHeader>
        {entries.length > 0 ? (
          <CardContent>
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {entry.term} <span className="text-muted-foreground">→</span> {entry.replacement}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {usageLabel(entry)}
                      {entry.caseSensitive ? " · Match case" : ""}
                      {entry.wholeWord ? "" : " · Also inside words"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {enabled ? (
                      <Button size="sm" variant="outline" onClick={() => startEdit(entry)} disabled={pending !== null}>
                        Edit
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void onDelete(entry)}
                      disabled={pending !== null}
                    >
                      {pending === entry.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
