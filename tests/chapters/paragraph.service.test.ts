import { beforeEach, describe, expect, it, vi } from "vitest";

const audioFindUnique = vi.hoisted(() => vi.fn());
const getChapterForActor = vi.hoisted(() => vi.fn());
const updateChapterForActor = vi.hoisted(() => vi.fn());
const startChapterGeneration = vi.hoisted(() => vi.fn());
const canUseParagraphFix = vi.hoisted(() => vi.fn());
const assertCanUseParagraphFix = vi.hoisted(() => vi.fn());
const loadActivePronunciationRules = vi.hoisted(() => vi.fn());
const resolveVoice = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: { audioFile: { findUnique: audioFindUnique } } }));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({}) }));
vi.mock("@/lib/chapters/chapter.service", () => ({ getChapterForActor }));
vi.mock("@/lib/chapters/chapter-edit.service", () => ({ updateChapterForActor }));
vi.mock("@/lib/chapters/generation.service", () => ({ startChapterGeneration }));
vi.mock("@/lib/billing/entitlements", () => ({ canUseParagraphFix, assertCanUseParagraphFix }));
vi.mock("@/lib/pronunciation/pronunciation.service", () => ({ loadActivePronunciationRules }));
vi.mock("@/lib/tts", () => ({ resolveVoice }));

import { AppError } from "@/lib/api/errors";
import { getParagraphViewForUser, regenerateParagraphForUser } from "@/lib/chapters/paragraph.service";
import { assembleSegments, planChapterChunks } from "@/lib/tts/segments";
import type { TTSProvider, VoiceDefinition } from "@/lib/tts/types";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const chapterId = "33333333-3333-4333-8333-333333333333";
const TEXT = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";

const provider = {
  id: "replicate",
  limits: { targetCharacters: 100, hardLimitCharacters: 100 },
  modelFor: () => "minimax",
} as unknown as TTSProvider;

function voiceOf(tier: "standard" | "premium"): VoiceDefinition {
  return { id: "premium-voice", providerVoiceId: "Wise_Woman", languageCode: "en-US", tier } as VoiceDefinition;
}

function frames(count: number): Buffer {
  const frame = Buffer.alloc(417);
  frame.writeUInt32BE(0xfffb9000, 0);
  return Buffer.concat(Array.from({ length: count }, () => frame));
}

function manifestFor(text: string) {
  const chunks = planChapterChunks({ text, provider, voice: voiceOf("premium"), speed: 1, rules: [] });
  return assembleSegments(
    chunks.map((chunk) => ({ paragraph: chunk.paragraph, cacheKey: chunk.cacheKey, audio: frames(40) })),
    { voiceId: "premium-voice", speed: 1 },
  ).manifest;
}

function chapter(overrides: Record<string, unknown> = {}) {
  return {
    id: chapterId,
    projectId: "project-1",
    sourceText: TEXT,
    status: "READY",
    selectedVoiceId: "premium-voice",
    selectedSpeed: 1,
    currentAudio: { id: "audio-1" },
    ...overrides,
  };
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((error: AppError) => expect(error.code).toBe(code));
}

const regenerate = (index: number, body: { original: string; text?: string; retry: boolean }) =>
  regenerateParagraphForUser({ chapterId, userId, index, body });

beforeEach(() => {
  vi.clearAllMocks();
  canUseParagraphFix.mockResolvedValue(true);
  assertCanUseParagraphFix.mockResolvedValue(undefined);
  loadActivePronunciationRules.mockResolvedValue([]);
  resolveVoice.mockReturnValue({ voice: voiceOf("premium"), provider });
  getChapterForActor.mockResolvedValue(chapter());
  audioFindUnique.mockResolvedValue({ segmentManifest: manifestFor(TEXT) });
  startChapterGeneration.mockResolvedValue({ id: "job-1", status: "QUEUED" });
});

describe("regenerateParagraphForUser", () => {
  it("requires the Creator plan", async () => {
    assertCanUseParagraphFix.mockRejectedValue(new AppError("PLAN_REQUIRED", "Upgrade", 403));
    await expectAppError(regenerate(1, { original: "Second paragraph.", retry: true }), "PLAN_REQUIRED");
    expect(getChapterForActor).not.toHaveBeenCalled();
  });

  it("rejects stale, missing, or busy paragraphs", async () => {
    await expectAppError(regenerate(5, { original: "x", retry: true }), "PARAGRAPH_NOT_FOUND");
    await expectAppError(regenerate(1, { original: "Old text.", text: "New.", retry: false }), "CONFLICT");
    getChapterForActor.mockResolvedValueOnce(chapter({ status: "GENERATING" }));
    await expectAppError(regenerate(1, { original: "Second paragraph.", retry: true }), "CONFLICT");
  });

  it("requires a text change or a retry", async () => {
    await expectAppError(
      regenerate(1, { original: "Second paragraph.", text: " Second paragraph. ", retry: false }),
      "VALIDATION_ERROR",
    );
  });

  it("saves the edit and reserves only the edited paragraph", async () => {
    await regenerate(1, { original: "Second paragraph.", text: "Second, fixed.", retry: false });

    expect(updateChapterForActor).toHaveBeenCalledWith(chapterId, { type: "user", userId }, {
      sourceText: "First paragraph.\n\nSecond, fixed.\n\nThird paragraph.",
    });
    expect(startChapterGeneration).toHaveBeenCalledWith({
      actor: { type: "user", userId },
      chapterId,
      voiceId: "premium-voice",
      speed: 1,
      synthesisCharacters: "Second, fixed.".length,
      retryParagraphs: undefined,
    });
  });

  it("re-reads an unchanged paragraph with a premium voice", async () => {
    await regenerate(1, { original: "Second paragraph.", retry: true });

    expect(updateChapterForActor).not.toHaveBeenCalled();
    expect(startChapterGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ retryParagraphs: [1], synthesisCharacters: "Second paragraph.".length }),
    );
  });

  it("does not offer retry for standard voices or audio without a manifest", async () => {
    resolveVoice.mockReturnValue({ voice: voiceOf("standard"), provider });
    await expectAppError(regenerate(1, { original: "Second paragraph.", retry: true }), "VALIDATION_ERROR");

    resolveVoice.mockReturnValue({ voice: voiceOf("premium"), provider });
    audioFindUnique.mockResolvedValue({ segmentManifest: null });
    await expectAppError(regenerate(1, { original: "Second paragraph.", retry: true }), "VALIDATION_ERROR");
    expect(startChapterGeneration).not.toHaveBeenCalled();
  });
});

describe("getParagraphViewForUser", () => {
  it("maps paragraphs to audio positions and flags changed text", async () => {
    getChapterForActor.mockResolvedValue(
      chapter({ sourceText: "First paragraph.\n\nSecond, edited.\n\n* * *\n\nThird paragraph." }),
    );

    const view = await getParagraphViewForUser(chapterId, userId);

    expect(view.status).toBe("ready");
    expect(view.retryAvailable).toBe(true);
    expect(view.paragraphs.map((item) => [item.changed, item.start !== null, item.speakable])).toEqual([
      [false, true, true],
      [true, false, true],
      [false, false, false],
      [false, true, true],
    ]);
    expect(view.paragraphs[0].start).toBe(0);
    expect(view.paragraphs[3].start).toBeGreaterThan(view.paragraphs[0].end ?? 0);
  });

  it("reports legacy audio and plan-less users without timings", async () => {
    audioFindUnique.mockResolvedValue({ segmentManifest: null });
    expect((await getParagraphViewForUser(chapterId, userId)).status).toBe("legacy");

    getChapterForActor.mockResolvedValue(chapter({ currentAudio: null }));
    expect((await getParagraphViewForUser(chapterId, userId)).status).toBe("no-audio");
  });
});
