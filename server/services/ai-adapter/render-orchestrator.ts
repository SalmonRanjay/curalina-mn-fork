/**
 * End-to-end orchestration of the AI-services `POST /api/render` path
 * (phase A5, packet 4 of 4, UI-A5-04).
 *
 * Splices `design-profile-mapper.ts` -> `recommendation-client.ts` ->
 * `product-response-mapper.ts`/`asset-import.ts` -> `render-job-client.ts`
 * -> `provenance-mapper.ts` into one function, kept out of `routes.ts` so
 * that file's diff stays a small dispatch rather than the whole
 * implementation (per this packet's allowed-files note).
 *
 * Failure-mode behavior (unreachable vs. service-responded-non-2xx vs.
 * misconfiguration vs. per-request `needs_input`) follows
 * `architecture/adr/ADR-0016-app-fails-closed-when-ai-services-unreachable.md`
 * exactly, including its three revisions (R1/R2/R3) to the original work
 * packet text:
 *
 *  - R1/R2: every error body this module returns is FLAT — `{ message,
 *    error, code, ... }` — never `{ error: { code, message, ... } }`. This
 *    is a deliberate fix for `client/src/pages/Quiz.tsx:106-109`, which does
 *    `new Error(errorData.error)` in a customer-facing toast; a nested
 *    object there renders as the literal string `"[object Object]"`. The
 *    `error` field is a compatibility shim duplicating `message` as a plain
 *    string for that extractor; a later packet may normalize the client and
 *    drop it. Service-responded-non-2xx bodies flatten the service's own
 *    `code`/`message`/`request_id`/`retryable` in, never nesting the
 *    inter-service `error.schema.json` envelope as a foreign object inside
 *    the app's own response.
 *  - R3: no `renders` row is created for the unreachable (503) or
 *    misconfigured (500) cases — both are environment conditions, not a
 *    per-request outcome attributable to the customer's own input, and
 *    persisting one row per retry would be junk data. `needs_input` is the
 *    one failure case that DOES get a row, because it is attributable to
 *    the customer's own (incomplete) quiz response, not the environment.
 *
 * Scope narrowing (per the work packet): exactly one room-level render job
 * per call (`instances: []` with one entry per bundle line item,
 * `synthetic_defaults` mode per `ADR-0015` — see the room-job submission
 * comment below for the one confirmed contract gap this surfaces). No
 * per-product variant/colour-swap job is submitted here — that is a
 * distinct, out-of-scope feature.
 *
 * Named, explicit gap left open by this packet: nothing here updates a
 * `generating` row to `completed` when the rooms job actually finishes.
 * `GET /api/render/:id`/`GET /api/render/latest` (unmodified by this
 * packet) will keep returning `status: "generating"` indefinitely for
 * AI-services-path renders until a future job-completion-reconciliation
 * packet exists.
 */

import * as crypto from "node:crypto";
import type {
  InsertRender,
  InsertSelectionLedger,
  Product,
  QuizResponse,
  Render,
  SelectionLedger,
} from "@shared/schema";
import { getAiServicesSettings } from "../../config/ai-services.js";
import { toDesignProfile, type DesignProfileMappingResult } from "./design-profile-mapper.js";
import {
  postBundle,
  RecommendationServiceError,
  type BundleLineItemShape,
  type BundleResponseShape,
} from "./recommendation-client.js";
import { toAppProductRef, ProductMappingMismatchError } from "./product-response-mapper.js";
import {
  importAssetToRooms,
  AiAdapterServiceError,
  type AssetRef,
  type ProductImageFetcher,
} from "./asset-import.js";
import {
  submitRoomConceptJob,
  submitRoomRenderJob,
  type RoomRenderInstance,
  type RoomReferenceImage,
} from "./render-job-client.js";
import {
  toAiServiceRef,
  toSelectionLedgerProvenance,
  type BundleFixture,
  type JobFixture,
} from "./provenance-mapper.js";
import { isServiceUnreachableError } from "./service-availability.js";

// --- Storage dependency (kept narrow and injectable for tests) -----------

/**
 * The subset of `curalinaStorage` (`server/storage-curalina.ts`) this
 * orchestrator needs. `CuralinaStorage` already satisfies this structurally
 * — `routes.ts` passes the real singleton; tests pass a mock implementing
 * just these four methods, following `UI-A5-01`/`02`/`03`'s mocking
 * approach for this adapter layer.
 */
export interface RenderOrchestratorStorage {
  getQuizResponse(id: string): Promise<QuizResponse | undefined>;
  getProduct(id: string): Promise<Product | undefined>;
  createRender(input: InsertRender): Promise<Render>;
  createSelectionLedger(input: InsertSelectionLedger): Promise<SelectionLedger>;
}

export interface OrchestrateAiRenderParams {
  quizResponseId: string;
  sessionId: string;
  userId?: string;
  productSkus?: string[];
  storage: RenderOrchestratorStorage;
  /**
   * Overrides `toDesignProfile` — defaults to the real, unmodified mapper.
   * Exists only as a test seam: `design-profile-mapper.ts` (outside this
   * packet's allowed files) currently returns `needsInput` naming
   * `atmosphere` unconditionally (no `quizResponses` column supplies it
   * today — see that module's own docstring), so this packet's tests for
   * the success/failure paths *downstream* of profile mapping (postBundle
   * onward) inject a fixture profile here rather than fabricating a
   * `quizResponses` row that could satisfy the real mapper (no such row is
   * currently possible). Production code never supplies this — `routes.ts`
   * calls `orchestrateAiRender` without it, so the real mapper's honest
   * `needsInput` behavior is unchanged in production.
   */
  mapProfile?: (quiz: QuizResponse) => DesignProfileMappingResult;
  /**
   * Overrides `importAssetToRooms`'s default HTTP-fetch image reader — same
   * test-seam purpose as `ImportAssetOptions.fetchImageBytes` in
   * `asset-import.ts` itself. Production code never supplies this; tests
   * use it so `product.images` URLs do not need to resolve over a real
   * network.
   */
  fetchImageBytes?: ProductImageFetcher;
}

/** `routes.ts` maps this straight onto `res.status(status).json(body)`. */
export interface AiRenderOutcome {
  status: number;
  body: Record<string, unknown>;
}

// --- Flat error body builders (R1/R2) -------------------------------------

type AiServiceName = "recommendation" | "rooms";

function unavailableErrorBody(service: AiServiceName): Record<string, unknown> {
  const message = `The ${service} AI service is unreachable. Please try again shortly.`;
  return {
    message,
    // R1 compatibility shim — see this module's docstring. A later packet
    // may normalize client/src/pages/Quiz.tsx's error extractor and drop
    // this duplication.
    error: message,
    code: "ai_service_unavailable",
    service,
    retryable: true,
  };
}

function servicePassthroughErrorBody(
  service: AiServiceName,
  code: string,
  message: string,
  requestId: string,
  retryable: boolean
): Record<string, unknown> {
  return {
    message,
    // R1/R2 compatibility shim — same flat-string duplication as
    // unavailableErrorBody, applied to the service-responded-non-2xx case.
    error: message,
    code,
    service,
    retryable,
    requestId,
  };
}

function misconfiguredErrorBody(missingSettings: string[]): Record<string, unknown> {
  const message = `AI services are enabled but misconfigured: ${missingSettings.join(
    ", "
  )} must be set.`;
  return {
    message,
    // Same flat-string duplication applied for consistency — every
    // non-2xx body this handler returns follows the same shape so
    // Quiz.tsx's `errorData.error` extractor never sees an object,
    // regardless of which branch produced the error.
    error: message,
    code: "ai_services_misconfigured",
  };
}

function productMappingMismatchErrorBody(productId: string): Record<string, unknown> {
  const message = `Bundle line item references product_id "${productId}", which has no matching row in the app's own products table.`;
  return {
    message,
    error: message,
    code: "product_mapping_mismatch",
  };
}

// --- Main orchestration ----------------------------------------------------

export async function orchestrateAiRender(
  params: OrchestrateAiRenderParams
): Promise<AiRenderOutcome> {
  const { quizResponseId, sessionId, userId, productSkus, storage } = params;
  const mapProfile = params.mapProfile ?? toDesignProfile;
  const fetchImageBytesOptions = params.fetchImageBytes
    ? { fetchImageBytes: params.fetchImageBytes }
    : {};

  // Step 1: load the quiz response.
  const quiz = await storage.getQuizResponse(quizResponseId);
  if (!quiz) {
    // Same shape as the existing GET /api/quiz-response/:id 404.
    return { status: 404, body: { message: "Quiz response not found" } };
  }

  // Concept mode (CURALINA_ROOM_RENDER_MODE=concept): straight to a rooms
  // render_brief. Recommendation is NOT called and no products are mapped —
  // the recommender is not wired into the demo chain yet.
  if (getAiServicesSettings().roomRenderMode === "concept") {
    return orchestrateConceptRender({ quiz, quizResponseId, sessionId, userId, productSkus, storage });
  }

  // Step 2: map to DesignProfileIn, or persist an honest needs_input row.
  const profileResult = mapProfile(quiz);
  if ("needsInput" in profileResult) {
    const render = await storage.createRender({
      quizResponseId,
      sessionId,
      userId: userId ?? undefined,
      imageUrl: null,
      prompt: `AI services path — quiz response is missing required field "${profileResult.missingField}"`,
      productSkus: productSkus ?? [],
      status: "needs_input",
      errorMessage: `needs_input: ${profileResult.missingField}`,
    } as InsertRender);
    return { status: 201, body: render as unknown as Record<string, unknown> };
  }
  const profile = profileResult;

  // Step 3: catalogueSnapshotId/rulesVersion must both be configured before
  // any network call — fail closed rather than guess either value (no
  // renders row: a deployment configuration defect, not a per-request
  // outcome).
  const settings = getAiServicesSettings();
  const missingSettings: string[] = [];
  if (!settings.catalogueSnapshotId) missingSettings.push("CURALINA_CATALOGUE_SNAPSHOT_ID");
  if (!settings.rulesVersion) missingSettings.push("CURALINA_RULES_VERSION");
  if (missingSettings.length > 0) {
    return { status: 500, body: misconfiguredErrorBody(missingSettings) };
  }
  const catalogueSnapshotId = settings.catalogueSnapshotId as string;
  const rulesVersion = settings.rulesVersion as string;

  // Step 4: postBundle. Unreachable -> 503, no row. Non-2xx -> pass through
  // the service's own status/code/message verbatim, no row.
  let bundle: BundleResponseShape;
  try {
    bundle = await postBundle(profile, catalogueSnapshotId, rulesVersion);
  } catch (err) {
    if (isServiceUnreachableError(err)) {
      return { status: 503, body: unavailableErrorBody("recommendation") };
    }
    if (err instanceof RecommendationServiceError) {
      return {
        status: err.httpStatus,
        body: servicePassthroughErrorBody(
          "recommendation",
          err.code,
          err.message,
          err.requestId,
          err.retryable
        ),
      };
    }
    throw err;
  }

  // Step 5a: resolve every bundle line item to an app `products` row first
  // (before any asset import call) — this ordering is asserted by name in
  // the packet's test 2 (getProduct ×2 then importAssetToRooms ×2, not
  // interleaved).
  const resolved: { lineItem: BundleLineItemShape; product: Product }[] = [];
  for (const lineItem of bundle.line_items) {
    const appProduct = await storage.getProduct(lineItem.product_id);
    try {
      // Throws ProductMappingMismatchError on a missing/mismatched row;
      // the built AppProductRef itself is not needed here (never exposes
      // tradePrice — see product-response-mapper.ts), only the validation.
      toAppProductRef(lineItem, appProduct);
    } catch (err) {
      if (err instanceof ProductMappingMismatchError) {
        // A data-integrity problem, not a per-request customer-input
        // outcome or an environment condition — no renders row, since the
        // request cannot proceed and nothing was submitted to any service.
        return { status: 500, body: productMappingMismatchErrorBody(err.productId) };
      }
      throw err;
    }
    resolved.push({ lineItem, product: appProduct as Product });
  }

  // Step 5b: import each resolved product's image into rooms. A single
  // unresolvable image is not fatal to the whole request — it is recorded
  // in `skippedProducts` and that product is left out of the room job's
  // instances/reference_images, so a partial catalogue image gap degrades
  // gracefully. This is a deliberate difference from step 4's bundle-level
  // failure handling (bundle failure is fatal; one missing product image is
  // not).
  const instances: RoomRenderInstance[] = [];
  const referenceImages: RoomReferenceImage[] = [];
  const skippedProducts: string[] = [];
  let instanceIndex = 0;

  for (const { lineItem, product } of resolved) {
    let assetResult;
    try {
      assetResult = await importAssetToRooms(product, fetchImageBytesOptions);
    } catch (err) {
      if (isServiceUnreachableError(err)) {
        return { status: 503, body: unavailableErrorBody("rooms") };
      }
      if (err instanceof AiAdapterServiceError) {
        return {
          status: err.httpStatus,
          body: servicePassthroughErrorBody(
            "rooms",
            err.code,
            err.message,
            err.requestId,
            err.retryable
          ),
        };
      }
      throw err;
    }

    if ("needsInput" in assetResult) {
      skippedProducts.push(product.sku);
      continue;
    }

    instanceIndex += 1;
    instances.push({
      instanceId: `instance_${instanceIndex}`,
      productId: lineItem.product_id,
      variantId: null,
      quantity: lineItem.quantity,
    });
    referenceImages.push({
      asset: assetResult as AssetRef,
      // "hero_product" mirrors the room generator's own fixtures
      // (`ai_services/room_generator/.../fixtures/render_job_request_valid.json`)
      // — not an invented value.
      role: "hero_product",
    });
  }

  // Step 6: submit exactly one room-level render job for the whole request.
  //
  // Confirmed, named contract gap (packet stop condition, resolved as an
  // escalation rather than a guess): rooms' wire-level `RenderJobRequest`
  // (`ai_services/room_generator/src/curalina_rooms/api/schemas.py` lines
  // 131-139) has NO field carrying ADR-0015's `provenance_mode` — only the
  // service's internal domain type
  // (`curalina_rooms/domain/render_request.py`'s `RenderRequest.provenance_mode`,
  // defaulting to `MEASURED`) models it, and that type is never reached
  // over HTTP. `render-job-client.ts` (built and reviewed in UI-A5-03,
  // outside this packet's allowed files) already reflects the true wire
  // shape and has no parameter for this either. This module therefore
  // cannot honestly declare `synthetic_defaults` mode on the outbound
  // request — it is not fabricated here, it is escalated: `tech-lead` needs
  // to add a `provenance`/`provenance_mode` field to `RenderJobRequest`
  // before any caller can satisfy ADR-0015's "every request must carry its
  // provenance mode" requirement over this endpoint.
  //
  // Separately, `layout_version` (also required by `RenderJobRequest`) has
  // no named source anywhere in this packet's spec or its two new settings.
  // Reusing `CURALINA_RULES_VERSION` here is a deliberate, flagged
  // simplification (not a distinct fabricated value — it is the one
  // version identifier this deployment already configures), not a
  // considered business decision; `tech-lead` should confirm whether rooms
  // needs its own distinct layout-version setting.
  let job;
  try {
    job = await submitRoomRenderJob({
      bundleId: bundle.bundle_id,
      bundleRevision: String(bundle.revision),
      roomType: profile.room_type,
      layoutVersion: rulesVersion,
      instances,
      referenceImages,
      idempotencyKey: `${quizResponseId}:${sessionId}`,
    });
  } catch (err) {
    if (isServiceUnreachableError(err)) {
      return { status: 503, body: unavailableErrorBody("rooms") };
    }
    if (err instanceof AiAdapterServiceError) {
      return {
        status: err.httpStatus,
        body: servicePassthroughErrorBody(
          "rooms",
          err.code,
          err.message,
          err.requestId,
          err.retryable
        ),
      };
    }
    throw err;
  }

  // Step 7: persist the generating render row with full traceability.
  const jobFixture: JobFixture = {
    schema_version: job.schemaVersion,
    job_id: job.jobId,
    status: job.status,
    candidate_id: job.candidateId,
  };
  const bundleFixture: BundleFixture = { bundle_id: bundle.bundle_id, revision: bundle.revision };
  const aiServiceRef = toAiServiceRef(jobFixture, null, bundleFixture, null);

  const render = await storage.createRender({
    quizResponseId,
    sessionId,
    userId: userId ?? undefined,
    // No image exists yet — never reuse the legacy path's placeholder URL
    // here, that would misrepresent a real pending job as a stock photo.
    imageUrl: null,
    prompt: `AI services path — rooms render job ${job.jobId} for bundle ${bundle.bundle_id} rev ${bundle.revision} (synthetic_defaults mode per ADR-0015; see room-job submission comment above for the provenance-field contract gap)`,
    productSkus: productSkus ?? [],
    status: "generating",
    aiServiceRef,
  } as InsertRender);

  // Step 8: selection ledger provenance.
  const provenance = toSelectionLedgerProvenance(bundle, rulesVersion);
  const selectionHash = crypto
    .createHash("sha256")
    .update(`${bundle.bundle_id}:${bundle.revision}:${quizResponseId}`)
    .digest("hex");
  await storage.createSelectionLedger({
    renderId: render.id,
    selectionHash,
    candidatePoolSnapshot: provenance.candidatePoolSnapshot,
    selectionRationale: provenance.selectionRationale,
    compositionOrder: provenance.compositionOrder,
  } as InsertSelectionLedger);

  return {
    status: 201,
    body: { ...(render as unknown as Record<string, unknown>), skippedProducts },
  };
}

// --- Concept render path ---------------------------------------------------

// Canonical quiz strings (client/src/components/quiz/consultationOptions.ts).
// Anything else is needs_input: no defaults are invented.
const CONCEPT_ROOMS = ["Living Room", "Dining Room", "Bedroom"];
const CONCEPT_STYLES = ["Organic Modern", "Contemporary Luxe", "Mid-Century Scandinavian"];
const CONCEPT_ATMOSPHERES = ["Bright & Airy", "Warm & Balanced", "Dark & Moody"];
const CONCEPT_PATTERNS = ["Just Solids", "Patterned Accents", "Pattern Forward"];

async function orchestrateConceptRender(args: {
  quiz: QuizResponse;
  quizResponseId: string;
  sessionId: string;
  userId?: string;
  productSkus?: string[];
  storage: RenderOrchestratorStorage;
}): Promise<AiRenderOutcome> {
  const { quiz, quizResponseId, sessionId, userId, productSkus, storage } = args;
  const settings = getAiServicesSettings();

  const roomType = quiz.roomType?.trim();
  const style = quiz.styles?.[0]?.trim();
  const atmosphere = quiz.atmosphere?.trim();
  let missingField: string | null = null;
  if (!roomType || !CONCEPT_ROOMS.includes(roomType)) missingField = "roomType";
  else if (!style || !CONCEPT_STYLES.includes(style)) missingField = "styles";
  else if (!atmosphere || !CONCEPT_ATMOSPHERES.includes(atmosphere)) missingField = "atmosphere";

  if (missingField) {
    const render = await storage.createRender({
      quizResponseId,
      sessionId,
      userId: userId ?? undefined,
      imageUrl: null,
      prompt: `AI services path (concept) — quiz response is missing required field "${missingField}"`,
      productSkus: productSkus ?? [],
      status: "needs_input",
      errorMessage: `needs_input: ${missingField}`,
    } as InsertRender);
    return { status: 201, body: render as unknown as Record<string, unknown> };
  }

  const pattern =
    quiz.patternPreference && CONCEPT_PATTERNS.includes(quiz.patternPreference)
      ? quiz.patternPreference
      : null;

  let job;
  try {
    job = await submitRoomConceptJob({
      brief: {
        renderer: settings.roomRenderer,
        room_type: roomType as string,
        style: style as string,
        atmosphere: atmosphere as string,
        pattern,
        prompt: null,
        seed: null,
      },
      idempotencyKey: `${quizResponseId}:${sessionId}`,
    });
  } catch (err) {
    if (isServiceUnreachableError(err)) {
      return { status: 503, body: unavailableErrorBody("rooms") };
    }
    if (err instanceof AiAdapterServiceError) {
      return {
        status: err.httpStatus,
        body: servicePassthroughErrorBody("rooms", err.code, err.message, err.requestId, err.retryable),
      };
    }
    throw err;
  }

  const render = await storage.createRender({
    quizResponseId,
    sessionId,
    userId: userId ?? undefined,
    imageUrl: null,
    prompt: `AI services path (concept) — rooms job ${job.jobId}, renderer ${settings.roomRenderer}`,
    productSkus: productSkus ?? [],
    status: "generating",
    aiServiceRef: {
      schemaVersion: job.schemaVersion,
      jobId: job.jobId,
      renderer: settings.roomRenderer,
      mode: "concept",
      candidateId: null,
      bundleId: null,
      bundleRevision: null,
      reviewId: null,
      assetIds: [],
    },
  } as InsertRender);

  return { status: 201, body: render as unknown as Record<string, unknown> };
}
