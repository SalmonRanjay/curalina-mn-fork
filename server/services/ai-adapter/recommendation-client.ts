/**
 * Thin HTTP client for recommendation's `/v1/recommendations` and
 * `/v1/bundles` endpoints (phase A5, packet 2 of 3).
 *
 * Request/response shapes mirror
 * `ai_services/recommendation/src/curalina_recommendation/api/schemas.py`
 * (`RecommendationRequest`/`RecommendationResponse`,
 * `BundleRequest`/`BundleResponse`) and
 * `ai_services/recommendation/src/curalina_recommendation/api/routes.py`
 * lines 53-140. No retry/backoff logic — out of scope for this packet. A
 * non-2xx response is surfaced as a typed `RecommendationServiceError`
 * carrying the response body's `code`/`message`/`details`/`retryable`/
 * `request_id` (per `ai_services/contracts/v1/schemas/error.schema.json`),
 * never swallowed into a generic failure.
 */

import { getAiServicesSettings } from "../../config/ai-services.js";
import type { DesignProfileIn } from "./design-profile-mapper.js";

export interface RankedCandidate {
  product_id: string;
  category: string;
  score: number;
  reasons: string[];
}

export interface RecommendationResponseShape {
  schema_version: string;
  catalogue_snapshot_id: string;
  candidates: RankedCandidate[];
}

export interface BundleLineItemShape {
  product_id: string;
  category: string;
  quantity: number;
  unit_price_minor_units: number;
  currency: string;
}

export interface BundleViolationShape {
  code: string;
  message: string;
}

export interface BundleResponseShape {
  schema_version: string;
  bundle_id: string;
  revision: number;
  feasible: boolean;
  line_items: BundleLineItemShape[];
  total_minor_units: number;
  currency: string | null;
  violations: BundleViolationShape[];
  warnings: string[];
}

/**
 * Mirrors `ai_services/contracts/v1/schemas/error.schema.json` exactly:
 * `code`, `message`, `details`, `retryable`, `request_id` are all required
 * on every error body recommendation returns.
 */
export interface ServiceErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
  retryable: boolean;
  request_id: string;
}

/**
 * Thrown when recommendation returns a non-2xx response. Carries the
 * service's own error body verbatim (not a generic "request failed"
 * message), so callers and logs retain `code`/`request_id` for
 * traceability back to the service.
 */
export class RecommendationServiceError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly retryable: boolean;
  readonly requestId: string;
  readonly httpStatus: number;

  constructor(httpStatus: number, body: ServiceErrorBody) {
    super(body.message);
    this.name = "RecommendationServiceError";
    this.code = body.code;
    this.details = body.details;
    this.retryable = body.retryable;
    this.requestId = body.request_id;
    this.httpStatus = httpStatus;
  }
}

async function parseErrorBody(response: Response): Promise<ServiceErrorBody> {
  try {
    const parsed = await response.json();
    if (
      parsed &&
      typeof parsed.code === "string" &&
      typeof parsed.message === "string" &&
      typeof parsed.retryable === "boolean" &&
      typeof parsed.request_id === "string"
    ) {
      return {
        code: parsed.code,
        message: parsed.message,
        details: parsed.details ?? {},
        retryable: parsed.retryable,
        request_id: parsed.request_id,
      };
    }
  } catch {
    // fall through to the generic body below
  }
  return {
    code: "unrecognized_error_body",
    message: `Recommendation service returned HTTP ${response.status} with a body that does not match error.schema.json`,
    details: {},
    retryable: false,
    request_id: "unknown",
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw new RecommendationServiceError(response.status, errorBody);
  }

  return (await response.json()) as T;
}

/**
 * Calls `POST /v1/recommendations`. `catalogueSnapshotId` must already be
 * a snapshot recommendation itself issued (e.g. from a prior
 * `/v1/catalogue/imports` call) — this client does not create one.
 */
export function postRecommendations(
  profile: DesignProfileIn,
  catalogueSnapshotId: string
): Promise<RecommendationResponseShape> {
  const settings = getAiServicesSettings();
  return postJson<RecommendationResponseShape>(
    `${settings.recommendationUrl}/v1/recommendations`,
    {
      schema_version: settings.contractVersion,
      catalogue_snapshot_id: catalogueSnapshotId,
      profile,
    }
  );
}

/**
 * Calls `POST /v1/bundles`. `rulesVersion` is passed through as-is — this
 * client does not select or validate a rules version; that is a
 * design-rules-engine concern, not adapter logic.
 */
export function postBundle(
  profile: DesignProfileIn,
  catalogueSnapshotId: string,
  rulesVersion: string
): Promise<BundleResponseShape> {
  const settings = getAiServicesSettings();
  return postJson<BundleResponseShape>(`${settings.recommendationUrl}/v1/bundles`, {
    schema_version: settings.contractVersion,
    catalogue_snapshot_id: catalogueSnapshotId,
    rules_version: rulesVersion,
    profile,
  });
}
