/**
 * AI services adapter — namespace skeleton (phase A5, packet 1 of 3).
 *
 * This module exists only to establish the adapter layer's location and
 * the feature-flag check every later packet builds on. It does not call
 * any AI service, does not map any app record to a service contract, and
 * has no HTTP client. Those land in packets 2 and 3.
 */

import { getAiServicesSettings } from "../../config/ai-services.js";

/**
 * Returns whether the AI services adapter path is enabled. Reads a fresh
 * settings object on every call (see getAiServicesSettings), so this
 * reflects the current environment variable state rather than a cached
 * value captured at process start.
 */
export function isAiServicesEnabled(): boolean {
  return getAiServicesSettings().enabled;
}

// Packet 2 of 3 (UI-A5-02): recommendation-facing mapping. Re-exported here
// so callers can import from the adapter namespace rather than reaching
// into individual modules.
export {
  toDesignProfile,
  type DesignProfileIn,
  type DesignProfileNeedsInput,
  type DesignProfileMappingResult,
} from "./design-profile-mapper.js";
export {
  postRecommendations,
  postBundle,
  RecommendationServiceError,
  type RankedCandidate,
  type RecommendationResponseShape,
  type BundleLineItemShape,
  type BundleViolationShape,
  type BundleResponseShape,
  type ServiceErrorBody,
} from "./recommendation-client.js";
export {
  toAppProductRef,
  ProductMappingMismatchError,
  type AppProductRef,
} from "./product-response-mapper.js";

// Packet 3 of 3 (UI-A5-03): asset import, render-job persistence,
// traceability. Re-exported here so callers can import from the adapter
// namespace rather than reaching into individual modules.
export {
  importAssetToVariants,
  importAssetToRooms,
  defaultFetchProductImageBytes,
  AiAdapterServiceError,
  parseAiAdapterErrorBody,
  type AssetRef,
  type AssetImportNeedsInput,
  type AssetImportResult,
  type ImportAssetOptions,
  type ProductImageBytes,
  type ProductImageFetcher,
  type SupportedMediaType,
  type AiAdapterErrorBody,
  type AiAdapterServiceName,
} from "./asset-import.js";
export {
  submitVariantJob,
  submitRoomRenderJob,
  getJobStatus,
  type JobRef,
  type SubmitVariantJobParams,
  type SubmitRoomRenderJobParams,
  type RoomRenderInstance,
  type RoomReferenceImage,
  type AiJobService,
} from "./render-job-client.js";
export {
  toAiServiceRef,
  toSelectionLedgerProvenance,
  type JobFixture,
  type CandidateFixture,
  type ReviewFixture,
  type BundleFixture,
  type AiServiceRefRecord,
  type ProvenanceLineItem,
  type ProvenanceViolation,
  type ProvenanceRecord,
  type BundleForProvenance,
} from "./provenance-mapper.js";

// Phase A5, packet 4 of 4 (UI-A5-04): live route wiring.
export { isServiceUnreachableError } from "./service-availability.js";
export {
  orchestrateAiRender,
  type RenderOrchestratorStorage,
  type OrchestrateAiRenderParams,
  type AiRenderOutcome,
} from "./render-orchestrator.js";
