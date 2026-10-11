import { describe, expect, it } from "vitest";
import { planNarrationWithinBudget, type BudgetChapter } from "@/lib/tools/narration-plan";

function chapter(overrides: Partial<BudgetChapter> & Pick<BudgetChapter, "id" | "orderIndex" | "characterCount">): BudgetChapter {
  return {
    title: overrides.id,
    wordCount: overrides.characterCount,
    included: true,
    hasAudio: false,
    ...overrides,
  };
}

describe("planNarrationWithinBudget", () => {
  it("keeps chapters in order until the remaining budget is exhausted", () => {
    const plan = planNarrationWithinBudget(
      [
        chapter({ id: "a", orderIndex: 1, characterCount: 100 }),
        chapter({ id: "b", orderIndex: 2, characterCount: 50 }),
        chapter({ id: "c", orderIndex: 3, characterCount: 80 }),
      ],
      160,
    );

    expect(plan.toGenerate.map((item) => item.id)).toEqual(["a", "b"]);
    expect(plan.beyondBudget.map((item) => item.id)).toEqual(["c"]);
    expect(plan.characters).toBe(150);
  });

  it("skips chapters that already have audio and chapters that are not selected", () => {
    const plan = planNarrationWithinBudget(
      [
        chapter({ id: "done", orderIndex: 1, characterCount: 100, hasAudio: true }),
        chapter({ id: "off", orderIndex: 2, characterCount: 20, included: false }),
        chapter({ id: "next", orderIndex: 3, characterCount: 40 }),
      ],
      1000,
    );

    expect(plan.toGenerate.map((item) => item.id)).toEqual(["next"]);
    expect(plan.beyondBudget).toEqual([]);
  });

  it("does not start when the next chapter is larger than the remaining budget", () => {
    const plan = planNarrationWithinBudget(
      [chapter({ id: "body", orderIndex: 3, characterCount: 12000 })],
      8000,
    );

    expect(plan.toGenerate).toEqual([]);
    expect(plan.beyondBudget.map((item) => item.id)).toEqual(["body"]);
  });
});
