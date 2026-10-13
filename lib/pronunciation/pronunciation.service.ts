import { Prisma, type PronunciationEntry } from "@/generated/prisma";
import {
  pronunciationDuplicate,
  pronunciationLimitReached,
  pronunciationNotFound,
  validationError,
} from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import {
  assertCanUsePronunciationDictionary,
  canUsePronunciationDictionary,
} from "@/lib/billing/entitlements";
import { FILE_LIMITS } from "@/lib/config/limits";
import { prisma } from "@/lib/db/prisma";
import { getProjectForUser } from "@/lib/projects/project.service";
import {
  applyPronunciations,
  containsTerm,
  countOccurrences,
  findSampleSentence,
  type PronunciationRule,
} from "@/lib/pronunciation/apply";
import type {
  CreatePronunciationInput,
  PreviewPronunciationInput,
  UpdatePronunciationInput,
} from "@/lib/validation/pronunciation";
import { previewVoiceForActor } from "@/lib/voices/voice.service";

export const MAX_PRONUNCIATIONS_PER_PROJECT = 100;
const SAMPLE_SENTENCE_MAX_CHARS = 180;

export type PronunciationEntryDto = PronunciationRule & {
  id: string;
  occurrences: number;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PronunciationMutationResult = {
  entry: PronunciationEntryDto;
  outdatedChapters: number;
};

function toRule(entry: PronunciationRule): PronunciationRule {
  return {
    term: entry.term,
    replacement: entry.replacement,
    caseSensitive: entry.caseSensitive,
    wholeWord: entry.wholeWord,
  };
}

function toDto(entry: PronunciationEntry, texts: string[]): PronunciationEntryDto {
  const rule = toRule(entry);
  let occurrences = 0;
  let chapterCount = 0;
  for (const text of texts) {
    const count = countOccurrences(text, rule);
    occurrences += count;
    chapterCount += count > 0 ? 1 : 0;
  }
  return {
    id: entry.id,
    ...rule,
    occurrences,
    chapterCount,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function userActor(userId: string): Actor {
  return { type: "user", userId };
}

async function includedChapterTexts(projectId: string): Promise<string[]> {
  const chapters = await prisma.chapter.findMany({
    where: { projectId, included: true },
    orderBy: { orderIndex: "asc" },
    select: { sourceText: true },
  });
  return chapters.map((chapter) => chapter.sourceText);
}

async function findEntryOrThrow(projectId: string, entryId: string): Promise<PronunciationEntry> {
  const entry = await prisma.pronunciationEntry.findFirst({ where: { id: entryId, projectId } });
  if (!entry) {
    throw pronunciationNotFound();
  }
  return entry;
}

/** The unique index uses a case-insensitive collation, so this lookup is case-insensitive too. */
async function assertTermAvailable(projectId: string, term: string, exceptId?: string): Promise<void> {
  const existing = await prisma.pronunciationEntry.findFirst({
    where: { projectId, term, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw pronunciationDuplicate();
  }
}

function rethrowDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw pronunciationDuplicate();
  }
  throw error;
}

/**
 * Chapters whose current audio was made without the changed rule(s) are
 * marked "Text changed" so the Narration card offers to regenerate them.
 */
async function markAffectedChapters(
  projectId: string,
  rules: PronunciationRule[],
  enabled: boolean,
): Promise<number> {
  if (!enabled || rules.length === 0) {
    return 0;
  }
  const chapters = await prisma.chapter.findMany({
    where: { projectId, currentAudioFileId: { not: null }, audioOutdated: false },
    select: { id: true, sourceText: true },
  });
  const affected = chapters
    .filter((chapter) => rules.some((rule) => containsTerm(chapter.sourceText, rule)))
    .map((chapter) => chapter.id);
  if (affected.length === 0) {
    return 0;
  }
  const result = await prisma.chapter.updateMany({
    where: { id: { in: affected }, audioOutdated: false },
    data: { audioOutdated: true },
  });
  return result.count;
}

export async function listPronunciationsForUser(
  projectId: string,
  userId: string,
): Promise<{ entries: PronunciationEntryDto[]; enabled: boolean }> {
  await getProjectForUser(projectId, userId);
  const [entries, texts, enabled] = await Promise.all([
    prisma.pronunciationEntry.findMany({
      where: { projectId },
      orderBy: [{ term: "asc" }, { id: "asc" }],
    }),
    includedChapterTexts(projectId),
    canUsePronunciationDictionary(userActor(userId)),
  ]);
  return { entries: entries.map((entry) => toDto(entry, texts)), enabled };
}

export type PronunciationPageData = {
  projectId: string;
  title: string;
  entries: PronunciationEntryDto[];
  enabled: boolean;
  voiceId: string | null;
  speed: number | null;
};

export async function getPronunciationPageForUser(
  projectId: string,
  userId: string,
): Promise<PronunciationPageData> {
  const project = await getProjectForUser(projectId, userId);
  const [list, voiced] = await Promise.all([
    listPronunciationsForUser(projectId, userId),
    prisma.chapter.findFirst({
      where: { projectId, selectedVoiceId: { not: null } },
      orderBy: { orderIndex: "asc" },
      select: { selectedVoiceId: true, selectedSpeed: true },
    }),
  ]);
  return {
    projectId: project.id,
    title: project.title,
    ...list,
    voiceId: voiced?.selectedVoiceId ?? null,
    speed: voiced ? Number(voiced.selectedSpeed) : null,
  };
}

export async function createPronunciationForUser(
  projectId: string,
  userId: string,
  input: CreatePronunciationInput,
): Promise<PronunciationMutationResult> {
  await getProjectForUser(projectId, userId);
  await assertCanUsePronunciationDictionary(userActor(userId));

  const count = await prisma.pronunciationEntry.count({ where: { projectId } });
  if (count >= MAX_PRONUNCIATIONS_PER_PROJECT) {
    throw pronunciationLimitReached(MAX_PRONUNCIATIONS_PER_PROJECT);
  }
  await assertTermAvailable(projectId, input.term);

  const entry = await prisma.pronunciationEntry
    .create({ data: { projectId, ...toRule(input) } })
    .catch(rethrowDuplicate);
  const [outdatedChapters, texts] = await Promise.all([
    markAffectedChapters(projectId, [toRule(entry)], true),
    includedChapterTexts(projectId),
  ]);
  return { entry: toDto(entry, texts), outdatedChapters };
}

export async function updatePronunciationForUser(
  projectId: string,
  entryId: string,
  userId: string,
  input: UpdatePronunciationInput,
): Promise<PronunciationMutationResult> {
  await getProjectForUser(projectId, userId);
  await assertCanUsePronunciationDictionary(userActor(userId));
  const current = await findEntryOrThrow(projectId, entryId);

  const next = toRule({
    term: input.term ?? current.term,
    replacement: input.replacement ?? current.replacement,
    caseSensitive: input.caseSensitive ?? current.caseSensitive,
    wholeWord: input.wholeWord ?? current.wholeWord,
  });
  if (next.term === next.replacement) {
    throw validationError("“Say it as” must be different from the word.");
  }
  if (next.term !== current.term) {
    await assertTermAvailable(projectId, next.term, current.id);
  }

  const entry = await prisma.pronunciationEntry
    .update({ where: { id: current.id }, data: next })
    .catch(rethrowDuplicate);
  const [outdatedChapters, texts] = await Promise.all([
    markAffectedChapters(projectId, [toRule(current), next], true),
    includedChapterTexts(projectId),
  ]);
  return { entry: toDto(entry, texts), outdatedChapters };
}

export async function deletePronunciationForUser(
  projectId: string,
  entryId: string,
  userId: string,
): Promise<{ deleted: true; outdatedChapters: number }> {
  await getProjectForUser(projectId, userId);
  const entry = await findEntryOrThrow(projectId, entryId);
  await prisma.pronunciationEntry.delete({ where: { id: entry.id } });
  const enabled = await canUsePronunciationDictionary(userActor(userId));
  const outdatedChapters = await markAffectedChapters(projectId, [toRule(entry)], enabled);
  return { deleted: true, outdatedChapters };
}

export async function previewPronunciationForUser(
  projectId: string,
  userId: string,
  input: PreviewPronunciationInput,
): Promise<{ audioUrl: string; expiresAt: string; text: string }> {
  await getProjectForUser(projectId, userId);
  const actor = userActor(userId);
  await assertCanUsePronunciationDictionary(actor);

  const rule = toRule(input);
  const sample = findSampleSentence(await includedChapterTexts(projectId), rule, SAMPLE_SENTENCE_MAX_CHARS);
  const spoken = sample ? applyPronunciations(sample, [rule]) : rule.replacement;
  const text = spoken.length <= FILE_LIMITS.TTS_PREVIEW_MAX_CHARS ? spoken : rule.replacement;

  const preview = await previewVoiceForActor({
    actor,
    voiceId: input.voiceId,
    text,
    speed: input.speed,
  });
  return { ...preview, text };
}

/** Rules for synthesis; empty for anonymous projects or when the owner's plan lacks the dictionary. */
export async function loadActivePronunciationRules(
  projectId: string,
  userId: string | null,
): Promise<PronunciationRule[]> {
  if (!userId || !(await canUsePronunciationDictionary(userActor(userId)))) {
    return [];
  }
  const entries = await prisma.pronunciationEntry.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
  });
  return entries.map(toRule);
}
