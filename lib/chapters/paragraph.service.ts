import { conflict, paragraphNotFound, validationError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { assertCanUseParagraphFix, canUseParagraphFix } from "@/lib/billing/entitlements";
import { updateChapterForActor } from "@/lib/chapters/chapter-edit.service";
import { getChapterForActor } from "@/lib/chapters/chapter.service";
import { startChapterGeneration } from "@/lib/chapters/generation.service";
import { hasSpeakableText, normalizeChapterText, replaceParagraph, splitParagraphs } from "@/lib/chapters/paragraphs";
import { FILE_LIMITS } from "@/lib/config/limits";
import { prisma } from "@/lib/db/prisma";
import type { JobSummary } from "@/lib/projects/project.detail";
import type { PronunciationRule } from "@/lib/pronunciation/apply";
import { loadActivePronunciationRules } from "@/lib/pronunciation/pronunciation.service";
import { resolveVoice } from "@/lib/tts";
import {
  matchSegments,
  parseSegmentManifest,
  planChapterChunks,
  type PlannedChunk,
  type SegmentManifest,
} from "@/lib/tts/segments";
import { normalizeSpeechSpeed } from "@/lib/tts/speed";
import type { RegenerateParagraphInput } from "@/lib/validation/paragraph";

export type ParagraphViewItem = {
  index: number;
  text: string;
  /** Seconds into the current audio, or null when the paragraph has no audio yet. */
  start: number | null;
  end: number | null;
  /** True when the text (or a pronunciation rule) changed since the audio was made. */
  changed: boolean;
  speakable: boolean;
};

export type ParagraphView = {
  enabled: boolean;
  /** "legacy": audio made before paragraph segments existed; regenerate once to use the view. */
  status: "ready" | "no-audio" | "legacy";
  retryAvailable: boolean;
  paragraphs: ParagraphViewItem[];
};

type ChapterVoice = { voiceId: string; speed: number };

async function loadManifest(audioFileId: string | null): Promise<SegmentManifest | null> {
  if (!audioFileId) {
    return null;
  }
  const file = await prisma.audioFile.findUnique({
    where: { id: audioFileId },
    select: { segmentManifest: true },
  });
  return parseSegmentManifest(file?.segmentManifest);
}

function planFor(text: string, voice: ChapterVoice, rules: PronunciationRule[]) {
  const resolved = resolveVoice({ premium: true }, voice.voiceId);
  return {
    premium: resolved.voice.tier === "premium",
    chunks: planChapterChunks({ text, provider: resolved.provider, voice: resolved.voice, speed: voice.speed, rules }),
  };
}

function toViewItems(paragraphs: string[], chunks: PlannedChunk[], manifest: SegmentManifest): ParagraphViewItem[] {
  const matches = matchSegments(chunks, manifest);
  return paragraphs.map((text, index) => {
    const own = chunks.flatMap((chunk, position) => (chunk.paragraph === index ? [matches[position]] : []));
    const found = own.filter((segment) => segment !== null);
    const first = found[0];
    const last = found[found.length - 1];
    return {
      index,
      text,
      start: first ? first.start : null,
      end: last ? Math.round((last.start + last.duration) * 1000) / 1000 : null,
      changed: own.length > 0 && found.length < own.length,
      speakable: hasSpeakableText(text),
    };
  });
}

export async function getParagraphViewForUser(chapterId: string, userId: string): Promise<ParagraphView> {
  const actor: Actor = { type: "user", userId };
  const chapter = await getChapterForActor(chapterId, actor);
  const [enabled, manifest] = await Promise.all([
    canUseParagraphFix(actor),
    loadManifest(chapter.currentAudio?.id ?? null),
  ]);
  const paragraphs = splitParagraphs(chapter.sourceText);
  const plain = (status: ParagraphView["status"]): ParagraphView => ({
    enabled,
    status,
    retryAvailable: false,
    paragraphs: paragraphs.map((text, index) => ({
      index,
      text,
      start: null,
      end: null,
      changed: false,
      speakable: hasSpeakableText(text),
    })),
  });
  if (!chapter.currentAudio) {
    return plain("no-audio");
  }
  if (!manifest || !enabled) {
    return plain(manifest ? "ready" : "legacy");
  }
  try {
    const rules = await loadActivePronunciationRules(chapter.projectId, userId);
    const plan = planFor(chapter.sourceText, manifest, rules);
    return {
      enabled,
      status: "ready",
      retryAvailable: plan.premium,
      paragraphs: toViewItems(paragraphs, plan.chunks, manifest),
    };
  } catch {
    return plain("legacy");
  }
}

export async function regenerateParagraphForUser(input: {
  chapterId: string;
  userId: string;
  index: number;
  body: RegenerateParagraphInput;
}): Promise<JobSummary> {
  const actor: Actor = { type: "user", userId: input.userId };
  await assertCanUseParagraphFix(actor);
  const chapter = await getChapterForActor(input.chapterId, actor);
  if (chapter.status === "GENERATING") {
    throw conflict("This chapter is being narrated. Try again when it finishes.");
  }

  const paragraphs = splitParagraphs(chapter.sourceText);
  const current = paragraphs[input.index];
  if (current === undefined) {
    throw paragraphNotFound();
  }
  if (normalizeChapterText(input.body.original) !== current) {
    throw conflict("The chapter text changed since this page loaded. Reload and try again.");
  }

  const replacement = input.body.text === undefined ? current : normalizeChapterText(input.body.text);
  const textChanged = replacement !== current;
  if (!textChanged && !input.body.retry) {
    throw validationError("Change the paragraph text, or choose Try again.");
  }
  const nextText = textChanged ? replaceParagraph(chapter.sourceText, input.index, replacement) : chapter.sourceText;
  if (nextText.length > FILE_LIMITS.MAX_CHAPTER_TEXT_LENGTH) {
    throw validationError(
      `Chapter text can be at most ${FILE_LIMITS.MAX_CHAPTER_TEXT_LENGTH.toLocaleString("en-US")} characters.`,
    );
  }

  const manifest = await loadManifest(chapter.currentAudio?.id ?? null);
  const voiceId = manifest?.voiceId ?? chapter.selectedVoiceId;
  if (!voiceId) {
    throw validationError("Generate this chapter first.");
  }
  const voice: ChapterVoice = {
    voiceId,
    speed: manifest?.speed ?? normalizeSpeechSpeed(chapter.selectedSpeed || undefined),
  };
  const rules = await loadActivePronunciationRules(chapter.projectId, input.userId);
  const plan = planFor(nextText, voice, rules);

  const retry = !textChanged && input.body.retry;
  if (retry && !manifest) {
    throw validationError("Regenerate the whole chapter once, then you can re-read single paragraphs.");
  }
  if (retry && !plan.premium) {
    throw validationError(
      "Standard voices read the same text the same way. Edit the text or add a pronunciation rule instead.",
    );
  }

  const reusable = new Set(manifest?.segments.map((segment) => segment.cacheKey) ?? []);
  const synthesisCharacters = plan.chunks
    .filter((chunk) => (retry && chunk.paragraph === input.index) || !reusable.has(chunk.cacheKey))
    .reduce((sum, chunk) => sum + chunk.characterCount, 0);

  if (textChanged) {
    await updateChapterForActor(chapter.id, actor, { sourceText: nextText });
  }
  return startChapterGeneration({
    actor,
    chapterId: chapter.id,
    voiceId: voice.voiceId,
    speed: voice.speed,
    synthesisCharacters,
    retryParagraphs: retry ? [input.index] : undefined,
  });
}
