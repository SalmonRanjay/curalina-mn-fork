/**
 * Product image import into variants'/rooms' real `POST /v1/assets`
 * endpoints (phase A5, packet 3 of 3).
 *
 * `ui_adapter_workflow.md` required-mappings table row 3 ("product
 * image/upload -> Asset import"): bytes are imported into the *owning*
 * service before a job is ever submitted, and the returned `asset_id`/
 * `content_hash` are what get persisted for traceability — never a raw
 * local path, never a hash this module recomputes itself.
 *
 * Storage-backend determination (packet context item 8), resolved by
 * reading the code, not guessed:
 *
 *   `server/objectStorage.ts` wraps `@google-cloud/storage` and backs only
 *   the "Legacy object storage upload URL generator" routes in
 *   `server/routes.ts` (`/objects/upload`, `/api/objects/upload` — both
 *   literally commented "Legacy" at the call site) plus one narrow
 *   `/public-objects/` fast-path inside
 *   `server/services/gemini-image-only-render.ts`'s `fetchImageAsBase64`.
 *   Grepping `server/` for `ObjectStorageService`/`objectStorage` turns up
 *   no other call site, and specifically none in the code that actually
 *   populates `products.images`.
 *
 *   `products.images` is populated by `server/services/upload-job-service.ts`
 *   (`uploadFileToS3` -> `https://curalina.s3.<region>.amazonaws.com/...`,
 *   written into `products.images` via `images: [...existingImages,
 *   result.s3Url]`) and maintained by `server/services/s3-image-renamer.ts`/
 *   `server/services/s3-renaming-job-service.ts` — all three go through
 *   AWS S3 directly (the same bucket/URL shape `server/s3.ts` uses, whose
 *   own `uploadToS3` sets `ACL: "public-read"`). These are the real,
 *   already-public URLs the storefront's `<img>` tags already load
 *   directly from `product.images`.
 *
 *   The existing app's own code that reads product image *bytes* today —
 *   `fetchImageAsBase64` in `gemini-image-only-render.ts` — treats
 *   `/public-objects/` as a narrow, optional fast path and falls back to a
 *   plain HTTP `fetch` on the stored URL for everything else. That fallback
 *   is the general-case, backend-agnostic precedent this module follows:
 *   read bytes via `fetch(url)` against whatever URL is actually stored on
 *   `product.images[i]` (predominantly public S3 URLs per the above), never
 *   a raw filesystem path and never a bare storage key. This also means
 *   this module never needs to import `objectStorage.ts` or `s3.ts`
 *   directly (neither is on this packet's allowed-files list) — the bytes
 *   are dereferenced the same way the browser already does, over HTTP.
 *
 * Neither service's fixture-stage `/v1/assets` endpoint is identical:
 * variants' `CreateAssetRequest` (schemas.py lines 93-101) has a
 * `content_bytes` field and actually hashes what's sent; rooms'
 * `AssetImportRequest` (schemas.py lines 51-65) is metadata-only today
 * (`content_length`, no bytes field — a documented A1-fixture gap, see
 * `AssetResponse`'s own docstring in that file) and derives its
 * `content_hash` from metadata, not bytes. Both are read in full before
 * writing the two functions below; they are not assumed identical.
 */

import type { Product } from "@shared/schema";
import { getAiServicesSettings } from "../../config/ai-services.js";

// --- Shared shapes -----------------------------------------------------

/**
 * The three media types variants' `CreateAssetRequest.media_type` accepts
 * (schemas.py line 100, `Literal["image/png", "image/jpeg", "image/webp"]`).
 * Rooms' `AssetImportRequest.media_type` is a bare `str`, but this module
 * only ever supplies one of these three either way — there is no reason to
 * send a media type this module cannot itself decode.
 */
const SUPPORTED_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export interface ProductImageBytes {
  bytes: Uint8Array;
  mediaType: SupportedMediaType;
}

/**
 * Reads a single candidate image URL into bytes, or returns `null` if the
 * URL is unreachable or its content type can't be resolved to one of the
 * three supported media types. Never returns the URL/path itself as a
 * stand-in for the bytes.
 */
export type ProductImageFetcher = (url: string) => Promise<ProductImageBytes | null>;

function mediaTypeFromContentType(contentType: string | null): SupportedMediaType | null {
  if (!contentType) {
    return null;
  }
  const normalized = contentType.split(";")[0]!.trim().toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(normalized)
    ? (normalized as SupportedMediaType)
    : null;
}

function mediaTypeFromExtension(url: string): SupportedMediaType | null {
  const match = url.toLowerCase().match(/\.(png|jpe?g|webp)(?:[?#]|$)/);
  if (!match) {
    return null;
  }
  const ext = match[1];
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Default `ProductImageFetcher`: reads bytes over HTTP from the URL already
 * stored on `product.images[i]` — see the storage-backend determination in
 * this module's docstring for why this is the correct, precedented
 * approach rather than reaching into a specific SDK. Callers (and tests)
 * may inject a different fetcher; this module never falls back to
 * fabricating bytes when a fetch fails.
 */
export async function defaultFetchProductImageBytes(
  url: string
): Promise<ProductImageBytes | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const mediaType =
      mediaTypeFromContentType(response.headers.get("content-type")) ??
      mediaTypeFromExtension(url);
    if (!mediaType) {
      return null;
    }
    return { bytes: new Uint8Array(arrayBuffer), mediaType };
  } catch {
    return null;
  }
}

interface ResolvedProductImage extends ProductImageBytes {
  url: string;
}

/**
 * Tries each URL in `product.images`, in order, returning the first one
 * that resolves to real bytes. An empty/absent `images` array never calls
 * `fetchImageBytes` at all (there is nothing to try) — this is what makes
 * the "no HTTP call for a missing image" test assertable by construction.
 */
async function resolveProductImageBytes(
  images: string[] | null | undefined,
  fetchImageBytes: ProductImageFetcher
): Promise<ResolvedProductImage | null> {
  for (const url of images ?? []) {
    if (!url) {
      continue;
    }
    const result = await fetchImageBytes(url);
    if (result) {
      return { ...result, url };
    }
  }
  return null;
}

function originalFilenameFor(
  url: string,
  sku: string,
  mediaType: SupportedMediaType
): string {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop();
    if (base) {
      return base;
    }
  } catch {
    // Not an absolute URL (or otherwise unparsable) — fall through to a
    // derived name rather than guessing at a real one.
  }
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  return `${sku}.${ext}`;
}

/**
 * `owner_id` identifies the *importing system*, not a per-product human
 * owner — `products` rows have no such field. This mirrors the identity
 * strings already used in both services' own fixtures (`"designer_kim"`,
 * `"customer_upload"`-style `provenance` values): short, stable, honest
 * about who is doing the importing, not a fabricated per-row value.
 */
const APP_OWNER_ID = "curalina_app";

/** `provenance` (rooms only — variants' `CreateAssetRequest` has no such
 * field) is a fixed string identifying that these bytes came from the
 * app's existing product catalogue, not a customer upload or a variant
 * export — the two other `provenance` values already seen in this
 * service's own fixtures. */
const APP_CATALOGUE_PROVENANCE = "app_product_catalogue";

// --- Result shapes -------------------------------------------------------

/** What gets persisted for traceability after a successful import: the
 * service's own returned identifiers, never a locally recomputed hash. */
export interface AssetRef {
  assetId: string;
  contentHash: string;
  schemaVersion: string;
}

/** Returned instead of an `AssetRef` when `product.images` is empty or
 * every URL in it is unreachable/undecodable — never a fabricated
 * placeholder asset. Names the product's `sku` per the packet's deliverable
 * text, so the caller can point a user or log entry at the right product. */
export interface AssetImportNeedsInput {
  needsInput: true;
  sku: string;
  reason: string;
}

export type AssetImportResult = AssetRef | AssetImportNeedsInput;

function needsInputForUnresolvableImage(
  sku: string,
  images: string[] | null | undefined
): AssetImportNeedsInput {
  const reason =
    !images || images.length === 0
      ? "product.images is empty — no image to import"
      : `product.images has ${images.length} entr${images.length === 1 ? "y" : "ies"} but none were reachable or decodable to a supported image media type`;
  return { needsInput: true, sku, reason };
}

// --- Service error shape (shared with render-job-client.ts) --------------

/** Mirrors `ai_services/contracts/v1/schemas/error.schema.json` exactly —
 * the same shape `recommendation-client.ts`'s `AiAdapterErrorBody` uses, for
 * the same reason (both variants and rooms return this canonical error
 * body on every non-2xx response). */
export interface AiAdapterErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
  retryable: boolean;
  request_id: string;
}

export type AiAdapterServiceName = "variants" | "rooms";

/** Thrown when variants or rooms returns a non-2xx response for an asset
 * import or job call. Carries the service's own error body verbatim (not a
 * generic "request failed" message), so callers and logs retain
 * `code`/`request_id` for traceability back to the service. Shared by
 * `asset-import.ts` and `render-job-client.ts`. */
export class AiAdapterServiceError extends Error {
  readonly service: AiAdapterServiceName;
  readonly httpStatus: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly retryable: boolean;
  readonly requestId: string;

  constructor(service: AiAdapterServiceName, httpStatus: number, body: AiAdapterErrorBody) {
    super(`${service} service error (HTTP ${httpStatus}): ${body.message}`);
    this.name = "AiAdapterServiceError";
    this.service = service;
    this.httpStatus = httpStatus;
    this.code = body.code;
    this.details = body.details;
    this.retryable = body.retryable;
    this.requestId = body.request_id;
  }
}

export async function parseAiAdapterErrorBody(
  service: AiAdapterServiceName,
  response: Response
): Promise<AiAdapterErrorBody> {
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
    message: `${service} service returned HTTP ${response.status} with a body that does not match error.schema.json`,
    details: {},
    retryable: false,
    request_id: "unknown",
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export interface ImportAssetOptions {
  /** Overrides the default HTTP-fetch image reader — used by tests to
   * inject a mock "storage backend" without a real network call. */
  fetchImageBytes?: ProductImageFetcher;
  ownerId?: string;
}

/**
 * Imports a product's primary image into the variant generator's real
 * `POST /v1/assets` (`ai_services/variant_generator/src/curalina_variants/api/app.py`
 * line 60), never sending a raw local path or bare storage key — bytes are
 * always read first (see this module's docstring), then base64-encoded
 * into `content_bytes` per `CreateAssetRequest` (schemas.py lines 93-101).
 */
export async function importAssetToVariants(
  product: Pick<Product, "sku" | "images">,
  options: ImportAssetOptions = {}
): Promise<AssetImportResult> {
  const fetchImageBytes = options.fetchImageBytes ?? defaultFetchProductImageBytes;
  const ownerId = options.ownerId ?? APP_OWNER_ID;

  const resolved = await resolveProductImageBytes(product.images, fetchImageBytes);
  if (!resolved) {
    return needsInputForUnresolvableImage(product.sku, product.images);
  }

  const settings = getAiServicesSettings();
  const response = await fetch(`${settings.variantsUrl}/v1/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schema_version: settings.contractVersion,
      owner_id: ownerId,
      original_filename: originalFilenameFor(resolved.url, product.sku, resolved.mediaType),
      media_type: resolved.mediaType,
      content_bytes: bytesToBase64(resolved.bytes),
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
    asset_id: string;
    content_hash: string;
  };

  return {
    assetId: body.asset_id,
    contentHash: body.content_hash,
    schemaVersion: body.schema_version,
  };
}

/**
 * Imports a product's primary image into the room generator's real
 * `POST /v1/assets` (`ai_services/room_generator/src/curalina_rooms/api/app.py`
 * line 42). Rooms' `AssetImportRequest` (schemas.py lines 51-65) is
 * metadata-only at this fixture stage — there is no `content_bytes` field
 * to send, and `content_hash` is derived server-side from metadata, not
 * bytes (a documented, in-service gap, not something this adapter papers
 * over). This function still reads the image into real bytes first (never
 * a bare path/key) so `content_length` reflects the actual byte count, not
 * a guess.
 */
export async function importAssetToRooms(
  product: Pick<Product, "sku" | "images">,
  options: ImportAssetOptions = {}
): Promise<AssetImportResult> {
  const fetchImageBytes = options.fetchImageBytes ?? defaultFetchProductImageBytes;
  const ownerId = options.ownerId ?? APP_OWNER_ID;

  const resolved = await resolveProductImageBytes(product.images, fetchImageBytes);
  if (!resolved) {
    return needsInputForUnresolvableImage(product.sku, product.images);
  }

  const settings = getAiServicesSettings();
  const response = await fetch(`${settings.roomsUrl}/v1/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schema_version: settings.contractVersion,
      owner_id: ownerId,
      original_filename: originalFilenameFor(resolved.url, product.sku, resolved.mediaType),
      media_type: resolved.mediaType,
      content_length: resolved.bytes.byteLength,
      provenance: APP_CATALOGUE_PROVENANCE,
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
    asset_id: string;
    content_hash: string;
  };

  return {
    assetId: body.asset_id,
    contentHash: body.content_hash,
    schemaVersion: body.schema_version,
  };
}
