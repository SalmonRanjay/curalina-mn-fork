/**
 * Network-level (unreachable) vs. HTTP-level (non-2xx) failure detection
 * for AI-service HTTP calls (phase A5, packet 4 of 4, UI-A5-04).
 *
 * Per `ADR-0016-app-fails-closed-when-ai-services-unreachable.md`, three
 * failure classes must be kept distinct:
 *
 *  1. Unreachable — connection refused, DNS failure, timeout. No HTTP
 *     response exists at all.
 *  2. Service responded, non-2xx — the service is healthy and returned its
 *     own `error.schema.json`-shaped body (surfaced as
 *     `RecommendationServiceError`/`AiAdapterServiceError`, both already
 *     thrown by `recommendation-client.ts`/`asset-import.ts`/
 *     `render-job-client.ts`). This module does not detect that case; it
 *     only detects case 1.
 *  3. Misconfiguration — handled entirely in `render-orchestrator.ts`
 *     before any network call is made; this module is not involved.
 *
 * Detection method: in Node's built-in (undici-backed) `fetch`, a
 * connection-level failure (ECONNREFUSED, DNS resolution failure, a fetch
 * timeout) rejects the returned promise with a `TypeError` whose `.cause`
 * is the underlying `Error` from undici's connector (commonly exposing a
 * `code` such as `ECONNREFUSED`, `ENOTFOUND`, or `UND_ERR_CONNECT_TIMEOUT`).
 * This is distinct from a resolved `Response` with a non-2xx `status`,
 * which is not a `TypeError` at all — `postBundle`/`importAssetToRooms`/
 * `submitRoomRenderJob` resolve normally in that case and throw their own
 * typed service-error classes instead, never a bare `TypeError`.
 *
 * This check is inherently runtime/library-version-dependent (undici's
 * exact `TypeError`/`.cause` shape is not a versioned public contract) —
 * flagged explicitly here, and in this packet's completion evidence, so the
 * next engineer to touch it knows why it works and what could break it
 * (e.g. a Node/undici upgrade changing the shape of network-error causes).
 */

const NETWORK_ERROR_CAUSE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/**
 * True when `err` looks like a network-level `fetch` failure (no HTTP
 * response was ever received) rather than a resolved non-2xx response
 * (which surfaces as `RecommendationServiceError`/`AiAdapterServiceError`,
 * never as a `TypeError`) or any other application error.
 */
export function isServiceUnreachableError(err: unknown): boolean {
  if (!(err instanceof TypeError)) {
    return false;
  }

  // Plain `fetch failed` TypeError with no further detail still counts —
  // undici does not always attach a `.cause` (e.g. some abort/timeout
  // paths), and a bare "fetch failed" TypeError from the global `fetch`
  // implementation is itself already evidence no response was received.
  const cause = (err as { cause?: unknown }).cause;
  if (cause === undefined) {
    return /fetch failed/i.test(err.message);
  }

  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code && NETWORK_ERROR_CAUSE_CODES.has(code)) {
      return true;
    }
    // Fall back to message sniffing for causes that carry no `.code` (some
    // undici internal errors set only a message).
    return /(ECONNREFUSED|ENOTFOUND|timeout|connect)/i.test(cause.message);
  }

  return false;
}
