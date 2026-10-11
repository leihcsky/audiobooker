export type BudgetChapter = {
  id: string;
  title: string;
  orderIndex: number;
  characterCount: number;
  wordCount: number;
  included: boolean;
  hasAudio: boolean;
};

export type NarrationBudgetPlan = {
  toGenerate: BudgetChapter[];
  beyondBudget: BudgetChapter[];
  characters: number;
  words: number;
};

export function planNarrationWithinBudget(
  chapters: BudgetChapter[],
  remainingCharacters: number,
): NarrationBudgetPlan {
  const pending = chapters
    .filter((chapter) => chapter.included && !chapter.hasAudio)
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex);

  const toGenerate: BudgetChapter[] = [];
  const beyondBudget: BudgetChapter[] = [];
  let characters = 0;
  let blocked = false;

  for (const chapter of pending) {
    if (blocked || characters + chapter.characterCount > remainingCharacters) {
      blocked = true;
      beyondBudget.push(chapter);
      continue;
    }
    toGenerate.push(chapter);
    characters += chapter.characterCount;
  }

  return {
    toGenerate,
    beyondBudget,
    characters,
    words: toGenerate.reduce((sum, chapter) => sum + chapter.wordCount, 0),
  };
}
