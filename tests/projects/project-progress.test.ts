import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { formatAudioDuration } from "@/lib/audio/format-duration";
import { summarizeProjectProgress } from "@/lib/projects/project.progress";

function chapter(overrides: Partial<Parameters<typeof summarizeProjectProgress>[0][number]> = {}) {
  return { included: true, hasAudio: false, audioOutdated: false, audioDurationSeconds: null, ...overrides };
}

describe("summarizeProjectProgress", () => {
  it("counts only selected chapters and treats outdated audio as not ready", () => {
    expect(
      summarizeProjectProgress([
        chapter({ hasAudio: true, audioDurationSeconds: 300.4 }),
        chapter({ hasAudio: true, audioOutdated: true, audioDurationSeconds: 120 }),
        chapter(),
        chapter({ included: false, hasAudio: true, audioDurationSeconds: 999 }),
      ]),
    ).toEqual({ chapterCount: 3, readyCount: 1, outdatedCount: 1, percentage: 33, audioSeconds: 420 });
  });

  it("handles a project with nothing selected", () => {
    expect(summarizeProjectProgress([chapter({ included: false })]).percentage).toBe(0);
  });
});

describe("formatAudioDuration", () => {
  it.each([
    [0, "0:00"],
    [65, "1:05"],
    [3725, "1:02:05"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatAudioDuration(seconds)).toBe(expected);
  });
});
