import { describe, expect, it } from "vitest";
import {
  chapterNeedsNarration,
  chapterNeedsRematch,
  planProjectNarration,
  type ProjectNarrationChapter,
} from "@/lib/chapters/project-narration";

function chapter(id: string, overrides: Partial<ProjectNarrationChapter> = {}): ProjectNarrationChapter {
  return {
    id,
    included: true,
    status: "READY",
    characterCount: 1000,
    hasAudio: true,
    audioOutdated: false,
    selectedVoiceId: "edge-en-us-ava",
    selectedSpeed: 1,
    ...overrides,
  };
}

describe("project narration plan", () => {
  it("flags missing or outdated audio for narration", () => {
    expect(chapterNeedsNarration(chapter("a", { hasAudio: false, status: "PENDING" }))).toBe(true);
    expect(chapterNeedsNarration(chapter("b", { audioOutdated: true }))).toBe(true);
    expect(chapterNeedsNarration(chapter("c"))).toBe(false);
  });

  it("flags ready audio when voice or speed differs", () => {
    const ready = chapter("a");
    expect(chapterNeedsRematch(ready, "edge-en-us-ava", 1)).toBe(false);
    expect(chapterNeedsRematch(ready, "edge-en-us-andrew", 1)).toBe(true);
    expect(chapterNeedsRematch(ready, "edge-en-us-ava", 1.2)).toBe(true);
    expect(chapterNeedsRematch(chapter("b", { hasAudio: false }), "edge-en-us-andrew", 1)).toBe(false);
  });

  it("plans generate-only targets when nothing needs rematch", () => {
    const plan = planProjectNarration(
      [
        chapter("a", { hasAudio: false, status: "PENDING", selectedVoiceId: null }),
        chapter("b", { audioOutdated: true }),
        chapter("c"),
      ],
      "edge-en-us-ava",
      1,
    );
    expect(plan.targets.map((item) => item.id)).toEqual(["a", "b"]);
    expect(plan.overwritesAudio).toBe(false);
    expect(plan.rematchCount).toBe(0);
  });

  it("includes rematch chapters when the selected voice changes", () => {
    const plan = planProjectNarration(
      [
        chapter("a"),
        chapter("b", { hasAudio: false, status: "PENDING", selectedVoiceId: null }),
        chapter("c", { included: false }),
      ],
      "edge-en-us-andrew",
      1,
    );
    expect(plan.targets.map((item) => item.id)).toEqual(["a", "b"]);
    expect(plan.rematchCount).toBe(1);
    expect(plan.overwritesAudio).toBe(true);
  });
});
