import type { ChapterSummary } from "@/lib/projects/project.detail";

export type BookStatsChapter = Pick<
  ChapterSummary,
  "included" | "wordCount" | "estimatedSeconds" | "audioDurationSeconds"
>;

export type BookStats = {
  chapters: number;
  words: number;
  /** Real audio length where a chapter has audio, the estimate otherwise. */
  seconds: number;
};

function sum(chapters: readonly BookStatsChapter[]): BookStats {
  return chapters.reduce<BookStats>(
    (total, chapter) => ({
      chapters: total.chapters + 1,
      words: total.words + chapter.wordCount,
      seconds: total.seconds + (chapter.audioDurationSeconds ?? chapter.estimatedSeconds),
    }),
    { chapters: 0, words: 0, seconds: 0 },
  );
}

export function bookStats(chapters: readonly BookStatsChapter[]): { book: BookStats; selected: BookStats } {
  return { book: sum(chapters), selected: sum(chapters.filter((chapter) => chapter.included)) };
}
