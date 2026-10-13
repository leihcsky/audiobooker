export type PlanId = "free" | "creator";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  monthlyPriceUsd: number;
  maxProjects: number;
  /** Premium audio granted once per billing period, in seconds. */
  premiumSecondsPerPeriod: number;
  /** Standard-voice fair use: above the soft line jobs still run but are logged. */
  standardMonthlySoftCharacters: number;
  standardMonthlyHardCharacters: number;
  /** Pays the discounted minute-pack price. */
  discountedMinutePacks: boolean;
  /** Publish-ready mastered MP3 exports with a QC report. */
  publishMastering: boolean;
  /** Per-project "say it as" rules applied before synthesis. */
  pronunciationDictionary: boolean;
  /** Paragraph view on the chapter page: fix or re-read one paragraph. */
  paragraphFix: boolean;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    maxProjects: 2,
    premiumSecondsPerPeriod: 0,
    standardMonthlySoftCharacters: 2_000_000,
    standardMonthlyHardCharacters: 5_000_000,
    discountedMinutePacks: false,
    publishMastering: false,
    pronunciationDictionary: false,
    paragraphFix: false,
  },
  creator: {
    id: "creator",
    name: "Creator",
    monthlyPriceUsd: 9.99,
    maxProjects: 10,
    premiumSecondsPerPeriod: 60 * 60,
    standardMonthlySoftCharacters: 10_000_000,
    standardMonthlyHardCharacters: 25_000_000,
    discountedMinutePacks: true,
    publishMastering: true,
    pronunciationDictionary: true,
    paragraphFix: true,
  },
};

export const DEFAULT_PLAN_ID: PlanId = "free";

export function isPlanId(value: string): value is PlanId {
  return Object.prototype.hasOwnProperty.call(PLANS, value);
}

export function getPlan(planId: string | null | undefined): PlanDefinition {
  return planId && isPlanId(planId) ? PLANS[planId] : PLANS[DEFAULT_PLAN_ID];
}
