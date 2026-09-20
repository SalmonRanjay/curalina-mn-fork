/**
 * Traceability record assembly (phase A5, packet 3 of 3) — the remaining
 * two rows of `ui_adapter_workflow.md`'s required-mappings table:
 *
 *  - `render record -> Render job/result`: `toAiServiceRef` builds the
 *    `renders.aiServiceRef` jsonb shape (see `shared/schema.ts`) from a
 *    job/candidate/bundle/review, so a render row can be traced back to
 *    the exact service job, candidate, bundle revision, and review that
 *    produced it.
 *  - `selection ledger -> Bundle explanation/provenance`: `toSelectionLedgerProvenance`
 *    maps a recommendation bundle response's line items and violations
 *    into the shape the app's existing `selectionLedger` columns
 *    (`shared/schema.ts` line 372 onward) already support, per that row.
 *
 * This module contains no ranking/scoring/rule logic of its own — it only
 * reshapes service responses that already carry that information.
 */

import type { BundleLineItemShape, BundleViolationShape } from "./recommendation-client.js";

// --- render record -> Render job/result -----------------------------------

/**
 * Mirrors `ai_services/contracts/v1/schemas/job.schema.json` field-for-
 * field for the subset this module reads. `job_id` is validated by the
 * caller of `toAiServiceRef`'s test against the schema's own
 * `^job_` pattern (not a hand-copied string) — see `traceability.test.ts`.
 */
export interface JobFixture {
  schema_version: string;
  job_id: string;
  status: string;
  candidate_id?: string | null;
}

/**
 * Mirrors `candidate.schema.json` plus the `variant` sub-object's asset
 * fields from `visual_variant.schema.json` (`source_asset_id`,
 * `output_asset_id`) — the only two asset-bearing fields on a candidate,
 * and the honest source for `AiServiceRefRecord.assetIds` (no other asset
 * ID is available to this function without inventing one).
 */
export interface CandidateFixture {
  schema_version: string;
  candidate_id: string;
  revision: number;
  variant: {
    source_asset_id: string;
    output_asset_id: string | null;
  };
}

/** Mirrors `review.schema.json`. */
export interface ReviewFixture {
  schema_version: string;
  review_id: string;
  candidate_id: string;
  revision: number;
}

/** The slice of recommendation's `BundleResponse` (see
 * `recommendation-client.ts`'s `BundleResponseShape`) this module needs —
 * just enough to thread `bundle_id`/`revision` through, per this packet's
 * dependency on `UI-A5-02`. */
export type BundleFixture = { bundle_id: string; revision: number };

/** Matches `shared/schema.ts`'s `renders.aiServiceRef` column comment
 * exactly: `{ schemaVersion, jobId, candidateId, bundleId, bundleRevision,
 * reviewId, assetIds: string[] }`. */
export interface AiServiceRefRecord {
  schemaVersion: string;
  jobId: string;
  candidateId: string | null;
  bundleId: string | null;
  bundleRevision: number | null;
  reviewId: string | null;
  assetIds: string[];
}

/**
 * Assembles the `renders.aiServiceRef` record from a job, its candidate (if
 * one exists yet), the bundle it was rendered for, and its review (if one
 * has happened yet). Any of `candidate`/`bundle`/`review` may be `null` —
 * a queued job has no candidate yet, a variant job has no bundle, an
 * unreviewed candidate has no review — and the corresponding output field
 * is `null` rather than fabricated. `assetIds` is derived only from
 * `candidate.variant.source_asset_id`/`output_asset_id` (the only asset IDs
 * a candidate actually carries); it is `[]`, not invented, when there is no
 * candidate yet.
 */
export function toAiServiceRef(
  job: JobFixture,
  candidate: CandidateFixture | null,
  bundle: BundleFixture | null,
  review: ReviewFixture | null
): AiServiceRefRecord {
  const assetIds = candidate
    ? [candidate.variant.source_asset_id, candidate.variant.output_asset_id].filter(
        (id): id is string => Boolean(id)
      )
    : [];

  return {
    schemaVersion: job.schema_version,
    jobId: job.job_id,
    candidateId: candidate?.candidate_id ?? job.candidate_id ?? null,
    bundleId: bundle?.bundle_id ?? null,
    bundleRevision: bundle?.revision ?? null,
    reviewId: review?.review_id ?? null,
    assetIds,
  };
}

// --- selection ledger -> Bundle explanation/provenance --------------------

export interface ProvenanceLineItem {
  productId: string;
  category: string;
  quantity: number;
  unitPriceMinorUnits: number;
  currency: string;
}

/** `code`/`message` carried through unchanged from recommendation's
 * `BundleViolation` (schemas.py) — never dropped, never replaced with a
 * generic message. See `traceability.test.ts` named test 5. */
export interface ProvenanceViolation {
  code: string;
  message: string;
}

/**
 * Shape this module hands back for persistence into the app's existing
 * `selectionLedger` columns (`shared/schema.ts` line 372 onward):
 *  - `candidatePoolSnapshot` (jsonb, not null) <- `lineItems`
 *  - `selectionRationale` (jsonb, not null) <- `rationale`
 *  - `compositionOrder` (text[], not null) <- `compositionOrder`
 *
 * Known, named gap (per this packet's stop condition, not papered over):
 * recommendation's `BundleResponse` (`schemas.py` lines 140-148) does not
 * echo the `rules_version` it was requested with, and `BundleLineItem` (the
 * same file) carries no per-item `score` — only `/v1/recommendations`'
 * separate `RankedCandidate` type has `score`/`reasons`, and that is a
 * different endpoint's response, not this bundle's. `rulesVersionRequested`
 * below is therefore threaded through from the *caller's own request*
 * value (which the caller already has, from the `rulesVersion` argument it
 * passed to `postBundle`) rather than reconstructed from the bundle
 * response — this module still fabricates nothing, but the caller must
 * supply it. If the caller cannot supply it either, this is a follow-up for
 * `tech-lead`: either `BundleResponse` should echo `rules_version`, or
 * `BundleLineItem` should carry a per-item score, so `selectionLedger` can
 * be as fully traceable via the bundle endpoint as it already is via
 * `/v1/recommendations`.
 */
export interface ProvenanceRecord {
  candidatePoolSnapshot: ProvenanceLineItem[];
  selectionRationale: {
    bundleId: string;
    bundleRevision: number;
    feasible: boolean;
    lineItems: ProvenanceLineItem[];
    violations: ProvenanceViolation[];
    warnings: string[];
    rulesVersionRequested: string | null;
  };
  compositionOrder: string[];
}

export interface BundleForProvenance {
  bundle_id: string;
  revision: number;
  feasible: boolean;
  line_items: BundleLineItemShape[];
  violations: BundleViolationShape[];
  warnings: string[];
}

function toProvenanceLineItem(lineItem: BundleLineItemShape): ProvenanceLineItem {
  return {
    productId: lineItem.product_id,
    category: lineItem.category,
    quantity: lineItem.quantity,
    unitPriceMinorUnits: lineItem.unit_price_minor_units,
    currency: lineItem.currency,
  };
}

export function toSelectionLedgerProvenance(
  bundle: BundleForProvenance,
  rulesVersionRequested: string | null = null
): ProvenanceRecord {
  const lineItems = bundle.line_items.map(toProvenanceLineItem);
  const violations: ProvenanceViolation[] = bundle.violations.map((violation) => ({
    code: violation.code,
    message: violation.message,
  }));

  return {
    candidatePoolSnapshot: lineItems,
    selectionRationale: {
      bundleId: bundle.bundle_id,
      bundleRevision: bundle.revision,
      feasible: bundle.feasible,
      lineItems,
      violations,
      warnings: bundle.warnings,
      rulesVersionRequested,
    },
    compositionOrder: bundle.line_items.map((lineItem) => lineItem.product_id),
  };
}
