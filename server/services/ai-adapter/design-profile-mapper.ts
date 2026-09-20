/**
 * quiz response -> DesignProfile mapping (phase A5, packet 2 of 3).
 *
 * Maps the app's live `quizResponses` row (`shared/schema.ts`) onto
 * recommendation's `DesignProfileIn` wire shape
 * (`ai_services/recommendation/src/curalina_recommendation/api/schemas.py`
 * lines 55-70). `DesignProfileIn` is the exact and only shape
 * recommendation's HTTP surface accepts: `room_type`, `style`, `atmosphere`,
 * `categories`, `furniture_budget_minor_units`, `currency`. No other field
 * exists on that model, and this module does not invent one.
 *
 * Per `ui_adapter_workflow.md` deliverable 5, any required field this
 * mapper cannot honestly fill returns a structured `needs_input` result
 * instead of a guessed value. This module contains no ranking, mask, or
 * generation business logic — it is a pure structural mapping.
 */

import type { QuizResponse } from "@shared/schema";

/**
 * The exact wire shape recommendation's `/v1` endpoints accept for
 * `profile`. Mirrors `DesignProfileIn` in
 * `curalina_recommendation/api/schemas.py` field-for-field. Do not add a
 * field here that is not present on that Pydantic model.
 */
export interface DesignProfileIn {
  room_type: string;
  style: string;
  atmosphere: string;
  categories: string[];
  furniture_budget_minor_units: number;
  currency: string;
}

/**
 * Returned instead of a `DesignProfileIn` when a required field cannot be
 * honestly filled from the source `quizResponses` row. `missingField`
 * names the field using the app-side name that failed to resolve (not
 * necessarily the wire-shape name), so the caller can point a user or log
 * entry at the right gap.
 */
export interface DesignProfileNeedsInput {
  needsInput: true;
  missingField: string;
}

export type DesignProfileMappingResult = DesignProfileIn | DesignProfileNeedsInput;

function needsInput(missingField: string): DesignProfileNeedsInput {
  return { needsInput: true, missingField };
}

/**
 * Resolves `quizResponses.styles` (an array of up to two style tags) down
 * to the single string `DesignProfileIn.style` requires. Only the
 * unambiguous case — exactly one style recorded — is honest to resolve
 * without inventing a rule for which of two styles to prefer; zero or
 * multiple styles return `needsInput` naming `styles` rather than picking
 * one arbitrarily (picking a "winning" style among several would be a
 * business rule, and belongs in a contract/ADR, not here).
 */
function resolveStyle(styles: string[] | null | undefined): string | null {
  if (!styles || styles.length !== 1) {
    return null;
  }
  const only = styles[0]?.trim();
  return only ? only : null;
}

/**
 * Parses the app's free-text `budgetRange` bracket (per `shared/schema.ts`
 * line 304's documented example, `'$2K-$5K'`) into a midpoint dollar
 * figure, in integer minor units (cents). Only closed brackets with both a
 * low and a high bound are parseable — an open-ended bracket (e.g. "Over
 * $20,000") has no upper bound to average against, and inventing one would
 * be a fabricated number, not a mapping. Two closed-bracket formats seen in
 * this codebase are supported: the `$2K-$5K` shorthand
 * (`shared/schema.ts`'s own documented example) and the `$2,000-$5,000`
 * comma-thousands form used by `client/src/components/quiz/BudgetStepV2.tsx`.
 * Anything else (including the older `budget`/`moderate`/`premium`/`luxury`
 * id form from `client/src/components/quiz/BudgetStep.tsx`) is honestly
 * unparseable and returns `null` — the caller must return `needsInput`
 * rather than guess.
 */
/**
 * Exported for direct unit testing of the money math in isolation
 * (`mapping.test.ts`'s budget-midpoint test): `toDesignProfile` itself
 * always returns `needsInput` naming `atmosphere` today (no quiz field
 * supplies it yet), so the only way to assert the exact parsed integer is
 * to call the parser directly rather than through the full mapping
 * function's result.
 */
export function parseBudgetRangeToMinorUnits(budgetRange: string | null | undefined): number | null {
  if (!budgetRange) {
    return null;
  }
  const trimmed = budgetRange.trim();

  // "$2K-$5K" (shorthand, thousands implied by the K suffix)
  const shorthandMatch = trimmed.match(
    /^\$?\s*(\d+(?:\.\d+)?)\s*K\s*-\s*\$?\s*(\d+(?:\.\d+)?)\s*K$/i
  );
  if (shorthandMatch) {
    const low = parseFloat(shorthandMatch[1]) * 1000;
    const high = parseFloat(shorthandMatch[2]) * 1000;
    return closedRangeMidpointMinorUnits(low, high);
  }

  // "$2,000-$5,000" or "$2,000 - $5,000" (comma-thousands, no K suffix)
  const commaMatch = trimmed.match(/^\$?\s*([\d,]+)\s*-\s*\$?\s*([\d,]+)$/);
  if (commaMatch) {
    const low = parseFloat(commaMatch[1].replace(/,/g, ""));
    const high = parseFloat(commaMatch[2].replace(/,/g, ""));
    return closedRangeMidpointMinorUnits(low, high);
  }

  return null;
}

function closedRangeMidpointMinorUnits(low: number, high: number): number | null {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0 || high < low) {
    return null;
  }
  const midpointDollars = (low + high) / 2;
  return Math.round(midpointDollars * 100);
}

/**
 * Converts a `quizResponses` row into recommendation's `DesignProfileIn`
 * shape, or a `needsInput` result naming the first field this app's data
 * cannot honestly supply. Check order (room_type, style, budget,
 * categories, atmosphere, currency) is deliberate: `atmosphere` and
 * `currency` are *always* missing today (no source field for either exists
 * on `quizResponses`), so they are checked last — a fixture that is
 * otherwise fully mappable surfaces the true, single blocking gap
 * (`atmosphere`) rather than an earlier field that happens to also be
 * unfilled in a given fixture.
 */
export function toDesignProfile(quizResponse: QuizResponse): DesignProfileMappingResult {
  const roomType = quizResponse.roomType?.trim();
  if (!roomType) {
    return needsInput("roomType");
  }

  const style = resolveStyle(quizResponse.styles);
  if (!style) {
    return needsInput("styles");
  }

  const furnitureBudgetMinorUnits = parseBudgetRangeToMinorUnits(quizResponse.budgetRange);
  if (furnitureBudgetMinorUnits === null) {
    return needsInput("budgetRange");
  }

  const categories = quizResponse.keyFeatures;
  if (!categories || categories.length === 0) {
    return needsInput("categories");
  }

  // `atmosphere` has no source field anywhere on `quizResponses` today.
  // This is not a business-rule gap or an OQ-xxx blocker — it is a
  // missing-field gap in the existing app's own schema, and the correct
  // response is `needsInput`, per this packet's known-blockers note.
  const atmosphere: string | null = null;
  if (!atmosphere) {
    return needsInput("atmosphere");
  }

  // `currency` defaults to "USD" only if every existing `products.price`
  // in this app is confirmed USD-only. No comment in `shared/schema.ts`
  // confirms that (checked: `price`/`tradePrice`/`priceAtRender`/
  // `priceAtPurchase` are all bare `decimal` columns with no currency
  // annotation), so per this packet's instruction, `currency` is treated
  // the same as `atmosphere` — `needsInput`, not a guessed default. This
  // branch is presently unreachable (atmosphere always fails first), and
  // is kept so the rule is documented in code, not only in a comment.
  const currencyConfirmedUsdOnly = false;
  if (!currencyConfirmedUsdOnly) {
    return needsInput("currency");
  }

  return {
    room_type: roomType,
    style,
    atmosphere,
    categories,
    furniture_budget_minor_units: furnitureBudgetMinorUnits,
    currency: "USD",
  };
}
