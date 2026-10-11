import type { PlanDefinition } from "@/lib/billing/plans";

export type MinutePackId = "short" | "book" | "series";

export type MinutePack = {
  id: MinutePackId;
  name: string;
  minutes: number;
  priceUsd: number;
  creatorPriceUsd: number;
  description: string;
};

/** One-time packs for any signed-in account. Purchased minutes never expire. */
export const MINUTE_PACKS: readonly MinutePack[] = [
  {
    id: "short",
    name: "Short",
    minutes: 120,
    priceUsd: 24,
    creatorPriceUsd: 20,
    description: "A novella or several chapters",
  },
  {
    id: "book",
    name: "Book",
    minutes: 600,
    priceUsd: 99,
    creatorPriceUsd: 84,
    description: "About one 10-hour novel",
  },
  {
    id: "series",
    name: "Series",
    minutes: 1500,
    priceUsd: 229,
    creatorPriceUsd: 205,
    description: "Two or three novels",
  },
];

export function minutePackPrice(pack: MinutePack, plan: PlanDefinition): number {
  return plan.discountedMinutePacks ? pack.creatorPriceUsd : pack.priceUsd;
}
