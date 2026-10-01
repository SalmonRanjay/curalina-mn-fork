/**
 * What a recommendation-backed render stores about its products (ADR-0025).
 *
 * `renders.productPlacements` holds `RenderProductPlacement[]` (one entry per
 * Design Manual room slot that was filled) and `renders.aiServiceRef.recommendation`
 * holds `RenderRecommendationSummary`. Written by
 * `server/services/ai-adapter/render-orchestrator.ts`, read by
 * `client/src/pages/Results.tsx`.
 */

export interface RenderProductPlacement {
  slotId: string;
  tier: "foundation" | "bridge" | "accent";
  label: string;
  quantity: number;
  quantitySource: string;
  /** Recommendation's id, e.g. `Luxus:row622`; also the app product's `sku`. */
  recommendationProductId: string;
  /** `products.id` in the app database; what the cart takes. */
  appProductId: string;
  name: string;
  supplier: string;
  category: string;
  unitPriceMinorUnits: number;
  lineTotalMinorUnits: number;
  currency: string;
  /** The trained model's match probability, 0-1. */
  matchScore: number;
  /** Whether the labelling rule agrees; `false` marks a visible model error. */
  ruleMatch: boolean;
}

export interface RenderRecommendationSummary {
  modelFamily: string;
  modelRun: string | null;
  weightsSha256: string;
  minMatchScore: number;
  catalogueFingerprint: string;
  currency: string;
  totalMinorUnits: number;
  budgetCeilingMinorUnits: number | null;
  notes: string[];
  notInCatalogue: string[];
  planSource: string | null;
  productsScored: number;
  modelRuleDisagreements: number;
}
