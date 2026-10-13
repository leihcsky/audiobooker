import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_DISCLOSURE,
  describeWithDisclosure,
  effectiveAiDisclosure,
} from "@/lib/publish/disclosure";
import { PUBLISH_PLATFORMS, isPublishPlatformId } from "@/lib/publish/platforms";
import {
  evaluatePublishReadiness,
  publishAudioState,
  type PublishReadinessInput,
} from "@/lib/publish/publish-readiness";

function readyInput(overrides: Partial<PublishReadinessInput> = {}): PublishReadinessInput {
  return {
    projectId: "p1",
    author: "Jane Author",
    narrator: "Digital voice",
    description: "A story.",
    cover: { present: true, width: 3000, height: 3000 },
    chapters: [
      { title: "One", included: true, hasAudio: true, audioOutdated: false, durationSeconds: 600 },
      { title: "Two", included: true, hasAudio: true, audioOutdated: false, durationSeconds: 900 },
    ],
    publishAudio: { status: "ready", failingFiles: 0, creditsIncluded: true },
    canMaster: true,
    ...overrides,
  };
}

function statusOf(input: PublishReadinessInput, platformId: "spotify" | "google-play", checkId: string) {
  return evaluatePublishReadiness(input, PUBLISH_PLATFORMS[platformId]).checks.find(
    (check) => check.id === checkId,
  )?.status;
}

describe("disclosure", () => {
  it("falls back to the default text when nothing is stored", () => {
    expect(effectiveAiDisclosure(null)).toBe(DEFAULT_AI_DISCLOSURE);
    expect(effectiveAiDisclosure("   ")).toBe(DEFAULT_AI_DISCLOSURE);
    expect(effectiveAiDisclosure(" Custom. ")).toBe("Custom.");
  });

  it("appends the disclosure to the description", () => {
    expect(describeWithDisclosure("Blurb.", "AI.")).toBe("Blurb.\n\nAI.");
    expect(describeWithDisclosure(null, "AI.")).toBe("AI.");
  });
});

describe("evaluatePublishReadiness", () => {
  it("has nothing blocking for a complete project", () => {
    for (const platform of Object.values(PUBLISH_PLATFORMS)) {
      const result = evaluatePublishReadiness(readyInput(), platform);
      expect(result.blockingCount).toBe(0);
      expect(result.checks.find((check) => check.id === "disclosure")?.status).toBe("todo");
    }
  });

  it("requires a narrator credit and points to the metadata form", () => {
    const result = evaluatePublishReadiness(readyInput({ narrator: null }), PUBLISH_PLATFORMS.spotify);
    const narrator = result.checks.find((check) => check.id === "narrator");
    expect(narrator?.status).toBe("fail");
    expect(narrator?.detail).toContain("Digital voice");
    expect(narrator?.fix?.href).toBe("/studio/projects/p1/export#metadata");
  });

  it("only blocks on a missing description where the store requires one", () => {
    const input = readyInput({ description: null });
    expect(statusOf(input, "spotify", "description")).toBe("fail");
    expect(statusOf(input, "google-play", "description")).toBe("warn");
  });

  it("checks cover shape and size per store", () => {
    const wide = readyInput({ cover: { present: true, width: 3000, height: 2000 } });
    expect(statusOf(wide, "spotify", "cover")).toBe("fail");
    expect(statusOf(wide, "google-play", "cover")).toBe("warn");

    const small = readyInput({ cover: { present: true, width: 800, height: 800 } });
    expect(statusOf(small, "spotify", "cover")).toBe("warn");
    expect(statusOf(small, "google-play", "cover")).toBe("fail");

    expect(statusOf(readyInput({ cover: { present: false, width: null, height: null } }), "spotify", "cover")).toBe("fail");
    expect(statusOf(readyInput({ cover: { present: true, width: null, height: null } }), "spotify", "cover")).toBe("warn");
  });

  it("flags missing and outdated chapter audio, ignoring excluded chapters", () => {
    const missing = readyInput({
      chapters: [
        { title: "One", included: true, hasAudio: false, audioOutdated: false, durationSeconds: null },
        { title: "Skip", included: false, hasAudio: false, audioOutdated: false, durationSeconds: null },
      ],
    });
    const result = evaluatePublishReadiness(missing, PUBLISH_PLATFORMS.spotify);
    expect(result.checks.find((check) => check.id === "chapters")?.detail).toBe("1 of 1 chapters have no audio yet.");

    const outdated = readyInput({
      chapters: [{ title: "One", included: true, hasAudio: true, audioOutdated: true, durationSeconds: 600 }],
    });
    expect(statusOf(outdated, "spotify", "chapters")).toBe("warn");
  });

  it("enforces Spotify's per-file length and Google's minimum total length", () => {
    const long = readyInput({
      chapters: [{ title: "Epic", included: true, hasAudio: true, audioOutdated: false, durationSeconds: 121 * 60 }],
    });
    expect(statusOf(long, "spotify", "chapter-length")).toBe("fail");
    expect(statusOf(long, "google-play", "chapter-length")).toBeUndefined();

    const short = readyInput({
      chapters: [{ title: "Tiny", included: true, hasAudio: true, audioOutdated: false, durationSeconds: 120 }],
    });
    expect(statusOf(short, "google-play", "total-length")).toBe("fail");
    expect(statusOf(short, "spotify", "total-length")).toBeUndefined();
  });

  it("asks for a publish-ready export until the audio is mastered", () => {
    const raw = readyInput({ publishAudio: { status: "none", failingFiles: 0, creditsIncluded: false } });
    expect(statusOf(raw, "spotify", "audio-spec")).toBe("fail");
    expect(statusOf(raw, "spotify", "opening-credits")).toBe("fail");
    expect(statusOf(raw, "google-play", "opening-credits")).toBeUndefined();
  });

  it("points Free users to the Creator plan and Creators to the export", () => {
    const none = { status: "none", failingFiles: 0, creditsIncluded: false } as const;
    const free = evaluatePublishReadiness(readyInput({ publishAudio: none, canMaster: false }), PUBLISH_PLATFORMS.spotify);
    expect(free.checks.find((check) => check.id === "audio-spec")?.fix?.href).toBe("/pricing");

    const creator = evaluatePublishReadiness(readyInput({ publishAudio: none }), PUBLISH_PLATFORMS.spotify);
    expect(creator.checks.find((check) => check.id === "audio-spec")?.fix?.href).toBe(
      "/studio/projects/p1/export#publish-ready",
    );
  });

  it("reports failed QC and missing credits from the latest mastered export", () => {
    const failed = readyInput({ publishAudio: { status: "failed", failingFiles: 2, creditsIncluded: false } });
    const result = evaluatePublishReadiness(failed, PUBLISH_PLATFORMS.spotify);
    const audio = result.checks.find((check) => check.id === "audio-spec");
    expect(audio?.detail).toContain("2 files");
    expect(audio?.fix?.href).toBe("/studio/projects/p1/export#exports");
    expect(result.checks.find((check) => check.id === "opening-credits")?.detail).toContain("could not be created");
  });
});

describe("publishAudioState", () => {
  const exportedAt = new Date("2026-10-13T10:00:00Z");
  const before = new Date("2026-10-13T09:00:00Z");
  const after = new Date("2026-10-13T11:00:00Z");

  function report(verdict: "pass" | "fail", passes: boolean[], credits = true) {
    return {
      preset: "publish-v1",
      verdict,
      totalDurationSeconds: 100,
      openingCredits: { included: credits, voiceId: credits ? "edge-en-us-aria" : null },
      files: passes.map((pass, index) => ({ name: `f${index}`, pass })),
    };
  }

  const chapter = (createdAt: Date | null, extra: { included?: boolean; audioOutdated?: boolean } = {}) => ({
    included: extra.included ?? true,
    audioOutdated: extra.audioOutdated ?? false,
    currentAudioFile: createdAt ? { createdAt } : null,
  });

  it("is none without a readable mastered export", () => {
    expect(publishAudioState(null, [chapter(before)]).status).toBe("none");
    expect(publishAudioState({ createdAt: exportedAt, qcReport: { preset: "other" } }, [chapter(before)]).status).toBe("none");
  });

  it("is ready or failed based on the report verdict", () => {
    expect(publishAudioState({ createdAt: exportedAt, qcReport: report("pass", [true]) }, [chapter(before)])).toEqual({
      status: "ready",
      failingFiles: 0,
      creditsIncluded: true,
    });
    expect(
      publishAudioState({ createdAt: exportedAt, qcReport: report("fail", [true, false, false]) }, [chapter(before)]),
    ).toEqual({ status: "failed", failingFiles: 2, creditsIncluded: true });
  });

  it("is stale when included chapter audio changed after the export", () => {
    const latest = { createdAt: exportedAt, qcReport: report("pass", [true]) };
    expect(publishAudioState(latest, [chapter(after)]).status).toBe("stale");
    expect(publishAudioState(latest, [chapter(before, { audioOutdated: true })]).status).toBe("stale");
    expect(publishAudioState(latest, [chapter(null)]).status).toBe("stale");
    expect(publishAudioState(latest, [chapter(before), chapter(after, { included: false })]).status).toBe("ready");
  });
});

describe("isPublishPlatformId", () => {
  it("accepts only known stores", () => {
    expect(isPublishPlatformId("spotify")).toBe(true);
    expect(isPublishPlatformId("google-play")).toBe(true);
    expect(isPublishPlatformId("acx")).toBe(false);
    expect(isPublishPlatformId("toString")).toBe(false);
    expect(isPublishPlatformId(undefined)).toBe(false);
  });
});
