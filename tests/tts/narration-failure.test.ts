import { describe, expect, it } from "vitest";
import { NARRATION_BUSY_MESSAGE, narrationFailureCopy } from "@/lib/tts/narration-failure";
import type { Chapter } from "@/generated/prisma";
import { toChapterSummary } from "@/lib/projects/project.detail";

describe("narrationFailureCopy", () => {
  it("prefers the stored job message", () => {
    expect(
      narrationFailureCopy({
        title: "Chapter 9",
        code: "TTS_PROVIDER_BUSY",
        message: NARRATION_BUSY_MESSAGE,
      }),
    ).toBe(NARRATION_BUSY_MESSAGE);
  });

  it("explains how to continue when no stored message exists", () => {
    const copy = narrationFailureCopy({ title: "Chapter 9" });
    expect(copy).toContain("Chapter 9");
    expect(copy).toContain("Generate audiobook");
  });
});

describe("toChapterSummary generationError", () => {
  const chapter = {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Chapter 9",
    orderIndex: 9,
    sourceText: "Once upon a time.",
    characterCount: 18,
    selectedVoiceId: null,
    selectedSpeed: 1,
    included: true,
    currentAudioFileId: null,
    status: "FAILED",
  } as unknown as Chapter;

  it("attaches the latest failed TTS job", () => {
    const summary = toChapterSummary(chapter, {
      id: "job-9",
      status: "FAILED",
      errorCode: "TTS_PROVIDER_BUSY",
      errorMessage: NARRATION_BUSY_MESSAGE,
      totalChunks: 4,
      completedChunks: 2,
    });
    expect(summary.latestTtsJobId).toBe("job-9");
    expect(summary.generationError).toEqual({
      code: "TTS_PROVIDER_BUSY",
      message: NARRATION_BUSY_MESSAGE,
    });
    expect(summary.generationProgress).toBeNull();
  });

  it("exposes chunk progress while the job is running", () => {
    const summary = toChapterSummary(chapter, {
      id: "job-10",
      status: "PROCESSING",
      errorCode: null,
      errorMessage: null,
      totalChunks: 8,
      completedChunks: 3,
    });
    expect(summary.generationProgress).toEqual({
      completedChunks: 3,
      totalChunks: 8,
      percentage: 38,
    });
  });

  it("uses the timeout code as a busy-service message", () => {
    expect(narrationFailureCopy({ title: "Chapter 2", code: "TTS_PROVIDER_TIMEOUT" })).toBe(
      NARRATION_BUSY_MESSAGE,
    );
  });
});
