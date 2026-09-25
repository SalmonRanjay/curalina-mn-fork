/**
 * Configuration for the AI services adapter (phase A5).
 *
 * Reads the five CURALINA_* environment variables and builds a typed
 * settings object. This module intentionally contains no business logic —
 * it only parses and validates configuration. When
 * CURALINA_AI_SERVICES_ENABLED is unset or "false" (its default), the
 * legacy in-app AI path is untouched and this module has no effect on
 * behaviour.
 */

export interface AiServicesSettings {
  enabled: boolean;
  recommendationUrl: string;
  variantsUrl: string;
  roomsUrl: string;
  contractVersion: string;
  /**
   * Phase A5, packet 4 of 4 (UI-A5-04). Recommendation exposes no "latest
   * snapshot" lookup (confirmed by reading
   * `ai_services/recommendation/src/curalina_recommendation/api/routes.py`),
   * so the monolith has no way to derive this value itself — it must be
   * configured. `null` (the default, unset) means the AI-services render
   * path fails closed with a distinct `ai_services_misconfigured` error
   * rather than guessing a snapshot ID.
   */
  catalogueSnapshotId: string | null;
  /**
   * Phase A5, packet 4 of 4 (UI-A5-04). Passed through to
   * `postBundle`/`submitRoomRenderJob` as-is — this module does not select
   * or validate a rules version, that is a design-rules-engine concern. See
   * `catalogueSnapshotId`'s doc comment for the same "null means fail
   * closed" discipline.
   */
  rulesVersion: string | null;
  /**
   * "concept" submits a `render_brief` straight to rooms (no recommendation,
   * no product mapping); "full" is the original bundle-based path. Default
   * "full" so existing behaviour is unchanged.
   */
  roomRenderMode: "concept" | "full";
  /** Which rooms renderer a concept brief asks for. Default "sd15". */
  roomRenderer: "sd15" | "composite";
  /** ISO 4217 code used as the DesignProfile currency. Default "CAD". */
  defaultCurrency: string;
}

const DEFAULT_RECOMMENDATION_URL = "http://127.0.0.1:8101";
const DEFAULT_VARIANTS_URL = "http://127.0.0.1:8102";
const DEFAULT_ROOMS_URL = "http://127.0.0.1:8103";
const DEFAULT_CONTRACT_VERSION = "1.0";

/**
 * Parses CURALINA_AI_SERVICES_ENABLED. Only the literal strings "true" and
 * "false" (case-insensitive) are accepted. Any other value throws, naming
 * the bad value, so a misconfigured flag can never be silently misread as
 * "off" (or "on").
 */
function parseEnabledFlag(rawValue: string | undefined): boolean {
  if (rawValue === undefined) {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  throw new Error(
    `Invalid CURALINA_AI_SERVICES_ENABLED value: "${rawValue}". ` +
      `Only "true" or "false" (case-insensitive) are accepted.`
  );
}

function parseChoice<T extends string>(name: string, raw: string | undefined, allowed: readonly T[], dflt: T): T {
  if (raw === undefined || raw.trim() === "") return dflt;
  const v = raw.trim().toLowerCase() as T;
  if (allowed.includes(v)) return v;
  throw new Error(`Invalid ${name} value: "${raw}". Allowed: ${allowed.join(", ")}.`);
}

/**
 * Builds a fresh AiServicesSettings object from the current process.env.
 * Deliberately not memoized at module scope: callers that need to observe
 * a changed environment variable within the same process (e.g. tests)
 * should call this function again rather than rely on a cached singleton.
 */
export function getAiServicesSettings(): AiServicesSettings {
  return {
    enabled: parseEnabledFlag(process.env.CURALINA_AI_SERVICES_ENABLED),
    recommendationUrl:
      process.env.CURALINA_RECOMMENDATION_URL || DEFAULT_RECOMMENDATION_URL,
    variantsUrl: process.env.CURALINA_VARIANTS_URL || DEFAULT_VARIANTS_URL,
    roomsUrl: process.env.CURALINA_ROOMS_URL || DEFAULT_ROOMS_URL,
    contractVersion:
      process.env.CURALINA_AI_CONTRACT_VERSION || DEFAULT_CONTRACT_VERSION,
    catalogueSnapshotId: process.env.CURALINA_CATALOGUE_SNAPSHOT_ID || null,
    rulesVersion: process.env.CURALINA_RULES_VERSION || null,
    roomRenderMode: parseChoice("CURALINA_ROOM_RENDER_MODE", process.env.CURALINA_ROOM_RENDER_MODE, ["concept", "full"] as const, "full"),
    roomRenderer: parseChoice("CURALINA_ROOM_RENDERER", process.env.CURALINA_ROOM_RENDERER, ["sd15", "composite"] as const, "sd15"),
    defaultCurrency: (process.env.CURALINA_DEFAULT_CURRENCY || "CAD").trim().toUpperCase(),
  };
}

/**
 * Convenience singleton for call sites that don't need to observe
 * mid-process environment changes (e.g. route handlers, where process.env
 * is fixed for the life of the process in normal deployment). Tests that
 * need fresh reads must call getAiServicesSettings() directly instead of
 * this export.
 */
export const aiServicesSettings: AiServicesSettings = getAiServicesSettings();
