import { beforeEach, describe, expect, it, vi } from "vitest";

const jobFindUnique = vi.hoisted(() => vi.fn());
const jobUpdate = vi.hoisted(() => vi.fn());
const chapterFindUnique = vi.hoisted(() => vi.fn());
const chapterUpdate = vi.hoisted(() => vi.fn());
const audioAggregate = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const generate = vi.hoisted(() => vi.fn());
const resolveVoice = vi.hoisted(() => vi.fn());
const captureReservation = vi.hoisted(() => vi.fn());
const releaseReservationForJob = vi.hoisted(() => vi.fn());
const readTtsCache = vi.hoisted(() => vi.fn());
const writeTtsCache = vi.hoisted(() => vi.fn());
const recordTtsCharacters = vi.hoisted(() => vi.fn());
const putObject = vi.hoisted(() => vi.fn());
const loadActivePronunciationRules = vi.hoisted(() => vi.fn());
const audioFindUnique = vi.hoisted(() => vi.fn());
const audioFileCreate = vi.hoisted(() => vi.fn());
const getObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generationJob: { findUnique: jobFindUnique, update: jobUpdate },
    chapter: { findUnique: chapterFindUnique, update: chapterUpdate },
    audioFile: { aggregate: audioAggregate, create: vi.fn(), findUnique: audioFindUnique },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/jobs/tts-claim", () => ({
  claimTtsJob: vi.fn().mockResolvedValue(true),
  touchTtsJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tts", () => ({ resolveVoice }));

vi.mock("@/lib/billing/credits.service", () => ({ captureReservation, releaseReservationForJob }));

vi.mock("@/lib/tts/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tts/cache")>();
  return { ...actual, readTtsCache, writeTtsCache };
});

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ putObject, getObject }),
}));

vi.mock("@/lib/usage/usage.service", () => ({ recordTtsCharacters }));

vi.mock("@/lib/pronunciation/pronunciation.service", () => ({ loadActivePronunciationRules }));

import { runTtsJob } from "@/lib/jobs/tts.runner";
import { assembleSegments, planChapterChunks } from "@/lib/tts/segments";
import type { TTSProvider, VoiceDefinition } from "@/lib/tts/types";

function mp3Frames(count: number): Buffer {
  const frameLength = 417;
  const frame = Buffer.alloc(frameLength);
  frame.writeUInt32BE(0xfffb9000, 0);
  return Buffer.concat(Array.from({ length: count }, () => frame));
}

const provider = {
  id: "edge",
  tier: "standard",
  limits: { targetCharacters: 20, hardLimitCharacters: 5000 },
  modelFor: () => "edge-neural",
  billableCharacters: (text: string) => text.length,
  estimateCost: ({ characters }: { characters: number }) => ({
    providerId: "edge",
    model: "edge-neural",
    characters,
    estimatedCost: 0,
    currency: "USD",
  }),
  generate,
};

const voice = {
  id: "edge-en-us-ava",
  provider: "edge",
  providerVoiceId: "en-US-AvaNeural",
  languageCode: "en-US",
  tier: "standard",
};

function queuedJob(
  sourceText: string,
  currentAudioFileId: string | null = null,
  tier: "STANDARD" | "PREMIUM" = "STANDARD",
  retryParagraphs: number[] | null = null,
) {
  return {
    id: "job-9",
    type: "GENERATE_TTS",
    tier,
    projectId: "project-1",
    chapterId: "chapter-1",
    voiceId: "edge-en-us-ava",
    estimatedCost: null,
    retryParagraphs,
    chapter: {
      id: "chapter-1",
      sourceText,
      selectedVoiceId: "edge-en-us-ava",
      selectedSpeed: 1,
      currentAudioFileId,
    },
    project: { userId: null, anonymousSessionId: "session-1" },
  };
}

describe("runTtsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveVoice.mockReturnValue({ voice, provider });
    jobUpdate.mockResolvedValue({});
    audioAggregate.mockResolvedValue({ _max: { version: null } });
    readTtsCache.mockResolvedValue(null);
    writeTtsCache.mockResolvedValue(undefined);
    loadActivePronunciationRules.mockResolvedValue([]);
    transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return input({
          audioFile: { create: audioFileCreate },
          chapter: { update: chapterUpdate },
          generationJob: { update: jobUpdate },
        });
      }
      return [];
    });
  });

  it("resolves standard jobs without premium access, never a paid fallback", async () => {
    jobFindUnique.mockResolvedValue(queuedJob("Hello there."));
    generate.mockResolvedValue({ audio: mp3Frames(20), characterCount: 12 });

    await runTtsJob("job-9");

    expect(resolveVoice).toHaveBeenCalledWith({ premium: false }, "edge-en-us-ava");
    expect(captureReservation).not.toHaveBeenCalled();
  });

  it("captures the reserved premium seconds when a premium job completes", async () => {
    jobFindUnique.mockResolvedValue(queuedJob("Hello there.", null, "PREMIUM"));
    generate.mockResolvedValue({ audio: mp3Frames(200), characterCount: 12 });

    await runTtsJob("job-9");

    expect(resolveVoice).toHaveBeenCalledWith({ premium: true }, "edge-en-us-ava");
    expect(captureReservation).toHaveBeenCalledWith(expect.anything(), {
      jobId: "job-9",
      billableSeconds: expect.any(Number),
    });
    expect(captureReservation.mock.calls[0][1].billableSeconds).toBeGreaterThan(0);
    expect(releaseReservationForJob).not.toHaveBeenCalled();
  });

  it("refunds the reservation when a premium job fails", async () => {
    jobFindUnique.mockResolvedValue(queuedJob("Hello there.", null, "PREMIUM"));
    generate.mockRejectedValue(new Error("provider down"));
    chapterFindUnique.mockResolvedValue({ currentAudioFileId: null });
    vi.useFakeTimers();

    const run = runTtsJob("job-9");
    await vi.runAllTimersAsync();
    await run;
    vi.useRealTimers();

    expect(releaseReservationForJob).toHaveBeenCalledWith(expect.anything(), "job-9", "job_failed");
    expect(captureReservation).not.toHaveBeenCalled();
  });

  it("keeps the previous audio when regeneration fails", async () => {
    jobFindUnique.mockResolvedValue(queuedJob("Hello there.", "audio-1"));
    generate.mockRejectedValue(new Error("provider down"));
    chapterFindUnique.mockResolvedValue({ currentAudioFileId: "audio-1" });

    await runTtsJob("job-9");

    expect(chapterUpdate).toHaveBeenCalledWith({
      where: { id: "chapter-1" },
      data: { status: "READY" },
    });
    expect(recordTtsCharacters).not.toHaveBeenCalled();
  });

  it("reuses cached chunks and only charges characters sent to the provider", async () => {
    jobFindUnique.mockResolvedValue(queuedJob("First sentence.\n\nSecond sentence."));
    readTtsCache.mockResolvedValueOnce({ audio: mp3Frames(10), durationSeconds: 0.26 });
    readTtsCache.mockResolvedValueOnce(null);
    generate.mockResolvedValue({ audio: mp3Frames(20), characterCount: 16 });

    await runTtsJob("job-9");

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Second sentence.", voiceId: "edge-en-us-ava" }),
    );
    expect(writeTtsCache).toHaveBeenCalledTimes(1);
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalChunks: 2 }) }),
    );
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { completedChunks: { increment: 1 }, cachedChunks: { increment: 1 } },
      }),
    );
    expect(recordTtsCharacters).toHaveBeenCalledWith(
      expect.objectContaining({
        characters: "Second sentence.".length,
        cachedCharacters: "First sentence.".length,
        tier: "standard",
        provider: "edge",
        actualCost: 0,
      }),
    );
  });

  it("speaks pronunciation rules and charges the replaced characters", async () => {
    jobFindUnique.mockResolvedValue(queuedJob("Hi Hermione."));
    loadActivePronunciationRules.mockResolvedValue([
      { term: "Hermione", replacement: "Her-MY-oh-nee", caseSensitive: false, wholeWord: true },
    ]);
    generate.mockResolvedValue({ audio: mp3Frames(20), characterCount: 17 });

    await runTtsJob("job-9");

    expect(loadActivePronunciationRules).toHaveBeenCalledWith("project-1", null);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ text: "Hi Her-MY-oh-nee." }));
    expect(recordTtsCharacters).toHaveBeenCalledWith(
      expect.objectContaining({ characters: "Hi Her-MY-oh-nee.".length }),
    );
  });

  describe("segments", () => {
    function previousAudio(text: string) {
      const chunks = planChapterChunks({
        text,
        provider: provider as unknown as TTSProvider,
        voice: voice as unknown as VoiceDefinition,
        speed: 1,
        rules: [],
      });
      return assembleSegments(
        chunks.map((chunk) => ({ paragraph: chunk.paragraph, cacheKey: chunk.cacheKey, audio: mp3Frames(30) })),
        { voiceId: voice.id, speed: 1 },
      );
    }

    it("copies unchanged paragraphs from the current audio and stores a manifest", async () => {
      const old = previousAudio("First sentence.\n\nOld second.");
      audioFindUnique.mockResolvedValue({ objectKey: "old.mp3", segmentManifest: old.manifest });
      getObject.mockResolvedValue(old.audio);
      jobFindUnique.mockResolvedValue(queuedJob("First sentence.\n\nSecond sentence.", "audio-1"));
      generate.mockResolvedValue({ audio: mp3Frames(20), characterCount: 16 });

      await runTtsJob("job-9");

      expect(getObject).toHaveBeenCalledWith("old.mp3");
      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate).toHaveBeenCalledWith(expect.objectContaining({ text: "Second sentence." }));
      expect(readTtsCache).toHaveBeenCalledTimes(1);
      const manifest = audioFileCreate.mock.calls[0][0].data.segmentManifest;
      expect(manifest).toMatchObject({ version: 1, voiceId: voice.id, speed: 1 });
      expect(manifest.segments.map((segment: { paragraph: number }) => segment.paragraph)).toEqual([0, 1]);
      expect(recordTtsCharacters).toHaveBeenCalledWith(
        expect.objectContaining({ characters: "Second sentence.".length }),
      );
    });

    it("re-reads a retried paragraph without the cache or the old audio", async () => {
      const text = "First sentence.\n\nSecond sentence.";
      const old = previousAudio(text);
      audioFindUnique.mockResolvedValue({ objectKey: "old.mp3", segmentManifest: old.manifest });
      getObject.mockResolvedValue(old.audio);
      jobFindUnique.mockResolvedValue(queuedJob(text, "audio-1", "STANDARD", [1]));
      generate.mockResolvedValue({ audio: mp3Frames(20), characterCount: 16 });

      await runTtsJob("job-9");

      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate).toHaveBeenCalledWith(expect.objectContaining({ text: "Second sentence." }));
      expect(readTtsCache).not.toHaveBeenCalled();
      expect(writeTtsCache).toHaveBeenCalledTimes(1);
    });

    it("falls back to synthesis when the old audio cannot be read", async () => {
      const old = previousAudio("Hello there.");
      audioFindUnique.mockResolvedValue({ objectKey: "old.mp3", segmentManifest: old.manifest });
      getObject.mockRejectedValue(new Error("missing"));
      jobFindUnique.mockResolvedValue(queuedJob("Hello there.", "audio-1"));
      generate.mockResolvedValue({ audio: mp3Frames(20), characterCount: 12 });

      await runTtsJob("job-9");

      expect(generate).toHaveBeenCalledTimes(1);
      expect(chapterUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "READY", audioOutdated: false }) }),
      );
    });
  });

  it("fails the job without charging when the provider returns unreadable audio", async () => {
    jobFindUnique.mockResolvedValue(queuedJob("Hello there."));
    generate.mockResolvedValue({ audio: Buffer.from("not audio"), characterCount: 12 });
    chapterFindUnique.mockResolvedValue({ currentAudioFileId: null });
    vi.useFakeTimers();

    const run = runTtsJob("job-9");
    await vi.runAllTimersAsync();
    await run;
    vi.useRealTimers();

    expect(generate).toHaveBeenCalledTimes(4);
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", errorCode: "TTS_AUDIO_INVALID" }),
      }),
    );
    expect(writeTtsCache).not.toHaveBeenCalled();
    expect(recordTtsCharacters).not.toHaveBeenCalled();
  });
});
