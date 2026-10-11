import { describe, expect, it } from "vitest";
import { evaluateExportReadiness } from "@/lib/export/eligibility";

describe("export eligibility", () => {
  it("blocks a full export when any chapter is missing audio", () => {
    const result = evaluateExportReadiness([
      { id: "c1", title: "One", orderIndex: 1, status: "READY", currentAudioFileId: "a1" },
      { id: "c2", title: "Two", orderIndex: 2, status: "PENDING", currentAudioFileId: null },
      { id: "c3", title: "Three", orderIndex: 3, status: "READY", currentAudioFileId: "a3" },
    ]);

    expect(result.ready).toBe(false);
    expect(result.readyChapterCount).toBe(2);
    expect(result.chapterCount).toBe(3);
    expect(result.missingChapters.map((chapter) => chapter.id)).toEqual(["c2"]);
  });

  it("allows export when a failed regeneration still has current audio", () => {
    const result = evaluateExportReadiness([
      { id: "c1", title: "One", orderIndex: 1, status: "FAILED", currentAudioFileId: "a1" },
    ]);

    expect(result.ready).toBe(true);
    expect(result.missingChapters).toEqual([]);
  });

  it("orders chapters by orderIndex rather than insertion order", () => {
    const result = evaluateExportReadiness([
      { id: "c2", title: "Two", orderIndex: 2, status: "READY", currentAudioFileId: "a2" },
      { id: "c1", title: "One", orderIndex: 1, status: "READY", currentAudioFileId: "a1" },
    ]);

    expect(result.chapters.map((chapter) => chapter.id)).toEqual(["c1", "c2"]);
  });

  it("rejects a project with no chapters", () => {
    expect(evaluateExportReadiness([]).ready).toBe(false);
  });

  it("ignores chapters that were deselected for export", () => {
    const result = evaluateExportReadiness([
      { id: "c1", title: "One", orderIndex: 1, status: "READY", currentAudioFileId: "a1", included: true },
      { id: "c2", title: "Two", orderIndex: 2, status: "PENDING", currentAudioFileId: null, included: false },
    ]);

    expect(result.ready).toBe(true);
    expect(result.chapterCount).toBe(1);
    expect(result.missingChapters).toEqual([]);
  });
});
