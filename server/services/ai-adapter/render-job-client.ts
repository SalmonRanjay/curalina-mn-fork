/**
 * Thin HTTP clients for variants' `POST /v1/jobs` and rooms'
 * `POST /v1/render-jobs`, plus a shared `GET /v1/jobs/{job_id}` status read
 * (phase A5, packet 3 of 3).
 *
 * Every job submission here takes `AssetRef`s from `asset-import.ts` as
 * input, never a bare `string` — see each function's signature. This is
 * deliberate, not incidental: it makes it a compile error (not a runtime
 * check) to call either submit function with a raw local path or an
 * unimported storage key. `traceability.test.ts`'s named test 3 proves this
 * with a `// @ts-expect-error` line.
 *
 * Request/response shapes mirror:
 *  - `ai_services/variant_generator/src/curalina_variants/api/schemas.py`
 *    lines 134-166 (`CreateVariantJobRequest`, `JobRecord`) and `app.py`
 *    lines 90-118 (`POST /v1/jobs` takes an `Idempotency-Key` header;
 *    `GET /v1/jobs/{job_id}`).
 *  - `ai_services/room_generator/src/curalina_rooms/api/schemas.py` lines
 *    114-162 (`RenderJobRequest`/`RenderJobResponse`/`JobStatusResponse`)
 *    and `app.py` lines 62-80 (`POST /v1/render-jobs`;
 *    `GET /v1/jobs/{job_id}`).
 *
 * The two services' shapes are read in full and are not assumed identical:
 * variants' job body takes a single `source_asset_id` + `mask_id` +
 * `target_colour`; rooms' takes a `bundle` reference, `instances`, and a
 * `reference_images` list of `{ asset_id, role }`. Rooms' `bundle_revision`
 * is a `str` on the wire (`BundleReference.bundle_revision`), while
 * recommendation's own `BundleResponse.revision` (see
 * `recommendation-client.ts`) is an `int` — callers must convert
 * explicitly (e.g. `String(bundle.revision)`); this module does not guess
 * a conversion rule on their behalf.
 */

import { getAiServicesSettings } from "../../config/ai-services.js";
import type { AssetRef } from "./asset-import.js";
import {
  AiAdapterServiceError,
  parseAiAdapterErrorBody,
  type AiAdapterServiceName,
} from "./asset-import.js";

/** Normalized job reference returned by both submit functions and by
 * `getJobStatus`. `candidateId` is `null` until the job succeeds. */
export interface JobRef {
  schemaVersion: string;
  jobId: string;
  status: string;
  candidateId: string | null;
}

// --- Variants: POST /v1/jobs --------------------------------------------

export interface SubmitVariantJobParams {
  parentProductId: string;
  ownerId: string;
  /** The asset to generate a variant from. Structurally an `AssetRef` (the
   * output of `importAssetToVariants`), never a bare string — this is what
   * makes calling this function with a raw path a compile error. Only the
   * first entry is used as `source_asset_id`; variants' own
   * `CreateVariantJobRequest` takes a single source asset, not a list. */
  sourceAssets: AssetRef[];
  maskId: string;
  targetColour: string;
  idempotencyKey: string;
}

export async function submitVariantJob(params: SubmitVariantJobParams): Promise<JobRef> {
  const sourceAsset = params.sourceAssets[0];
  if (!sourceAsset) {
    throw new Error(
      "submitVariantJob requires at least one AssetRef in sourceAssets (from importAssetToVariants)"
    );
  }

  const settings = getAiServicesSettings();
  const response = await fetch(`${settings.variantsUrl}/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      schema_version: settings.contractVersion,
      parent_product_id: params.parentProductId,
      source_asset_id: sourceAsset.assetId,
      mask_id: params.maskId,
      target_colour: params.targetColour,
      owner_id: params.ownerId,
    }),
  });

  if (!response.ok) {
    throw new AiAdapterServiceError(
      "variants",
      response.status,
      await parseAiAdapterErrorBody("variants", response)
    );
  }

  const body = (await response.json()) as {
    schema_version: string;
    job_id: string;
    status: string;
    candidate_id: string | null;
  };

  return {
    schemaVersion: body.schema_version,
    jobId: body.job_id,
    status: body.status,
    candidateId: body.candidate_id ?? null,
  };
}

// --- Rooms: POST /v1/render-jobs ------------------------------------------

export interface RoomRenderInstance {
  instanceId: string;
  productId: string;
  variantId?: string | null;
  quantity?: number;
}

export interface RoomReferenceImage {
  /** Structurally an `AssetRef` (the output of `importAssetToRooms`), never
   * a bare string — same compile-time guarantee as
   * `SubmitVariantJobParams.sourceAssets`. */
  asset: AssetRef;
  role: string;
}

export interface SubmitRoomRenderJobParams {
  bundleId: string;
  /** String on the wire per rooms' `BundleReference.bundle_revision` — see
   * this module's docstring on the int/str mismatch with recommendation's
   * `BundleResponse.revision`. */
  bundleRevision: string;
  roomType: string;
  layoutVersion: string;
  instances: RoomRenderInstance[];
  referenceImages: RoomReferenceImage[];
  idempotencyKey?: string;
}

export async function submitRoomRenderJob(params: SubmitRoomRenderJobParams): Promise<JobRef> {
  const settings = getAiServicesSettings();
  const response = await fetch(`${settings.roomsUrl}/v1/render-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schema_version: settings.contractVersion,
      bundle: {
        bundle_id: params.bundleId,
        bundle_revision: params.bundleRevision,
      },
      room_type: params.roomType,
      layout_version: params.layoutVersion,
      instances: params.instances.map((instance) => ({
        instance_id: instance.instanceId,
        product_id: instance.productId,
        variant_id: instance.variantId ?? null,
        quantity: instance.quantity ?? 1,
      })),
      reference_images: params.referenceImages.map((ref) => ({
        asset_id: ref.asset.assetId,
        role: ref.role,
      })),
      idempotency_key: params.idempotencyKey ?? null,
    }),
  });

  if (!response.ok) {
    throw new AiAdapterServiceError(
      "rooms",
      response.status,
      await parseAiAdapterErrorBody("rooms", response)
    );
  }

  const body = (await response.json()) as {
    schema_version: string;
    job_id: string;
    status: string;
  };

  return {
    schemaVersion: body.schema_version,
    jobId: body.job_id,
    status: body.status,
    // Rooms' RenderJobResponse (schemas.py lines 141-148) has no
    // candidate_id at creation time — only JobStatusResponse.result does,
    // once the job succeeds. Never guessed here.
    candidateId: null,
  };
}

// --- Shared: GET /v1/jobs/{job_id} ----------------------------------------

export type AiJobService = AiAdapterServiceName;

/**
 * Wraps `GET /v1/jobs/{job_id}` on whichever service the job belongs to.
 * Both services expose this path, but their response bodies differ:
 * variants' `JobRecord` carries `candidate_id` at the top level; rooms'
 * `JobStatusResponse` nests it under `result.candidate_id`
 * (schemas.py lines 151-162) — both are normalized into the same `JobRef`
 * shape here rather than leaking the per-service difference to callers.
 */
export async function getJobStatus(service: AiJobService, jobId: string): Promise<JobRef> {
  const settings = getAiServicesSettings();
  const baseUrl = service === "variants" ? settings.variantsUrl : settings.roomsUrl;
  const response = await fetch(`${baseUrl}/v1/jobs/${jobId}`);

  if (!response.ok) {
    throw new AiAdapterServiceError(
      service,
      response.status,
      await parseAiAdapterErrorBody(service, response)
    );
  }

  const body = (await response.json()) as {
    schema_version: string;
    job_id: string;
    status: string;
    candidate_id?: string | null;
    result?: { candidate_id?: string | null } | null;
  };

  const candidateId =
    service === "variants" ? body.candidate_id ?? null : body.result?.candidate_id ?? null;

  return {
    schemaVersion: body.schema_version,
    jobId: body.job_id,
    status: body.status,
    candidateId,
  };
}
