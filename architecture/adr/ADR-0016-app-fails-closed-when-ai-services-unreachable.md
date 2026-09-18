# Architecture decision record

ID: ADR-0016
Status: accepted
Owner and reviewer: `tech-lead` (decision); raised by `delivery-coordinator`
while scoping `ai_services/work_packets/UI-A5-04.md`
Date: 2026-09-15

## Context

`UI-A5-04` is the first work packet that makes the existing TypeScript
monolith call a Curalina AI service from a real, customer-facing request
handler (`POST /api/render` in `server/routes.ts`). Whatever it does when a
service is unreachable becomes the template for every later route that
consumes recommendation (`8101`), variants (`8102`) or rooms (`8103`), so
the decision is worth recording once rather than re-litigating per route.

Three failure classes must be kept distinct, and only the first is the
subject of this ADR:

1. **Unreachable** — connection refused, DNS failure, timeout. No HTTP
   response exists. In this Node/undici `fetch` stack it surfaces as a
   `TypeError` with a connection-failure `.cause`.
2. **Service responded, non-2xx** — the service is healthy and is telling
   the caller something specific, in the envelope defined by
   `ai_services/contracts/v1/schemas/error.schema.json`
   (flat `code` / `message` / `details` / `retryable` / `request_id`).
3. **Misconfiguration** — `CURALINA_AI_SERVICES_ENABLED=true` but
   `CURALINA_CATALOGUE_SNAPSHOT_ID` / `CURALINA_RULES_VERSION` unset. A
   deployment defect, not a per-request outcome.

Evidence gathered directly from the code, not from the packet's prose:

- **What the legacy path actually writes.** `server/routes.ts` lines
  755–788: the existing `POST /api/render` handler persists a `renders` row
  with `status: "completed"`, `prompt: "Local development render
  placeholder based on quiz response"`, and a hardcoded
  `images.pexels.com/photos/1571460/...` stock photograph. It calls no AI
  service at all. This is decisive: a "silent fallback to legacy" is not a
  degraded render, it is a persisted row asserting a **completed** render
  that is a stock photo of someone else's room.
- **What the callers do with an error.** `client/src/pages/Quiz.tsx`
  lines 106–109 read `errorData.error` from a non-ok `/api/render` response
  and pass it straight into `new Error(...)`, whose message reaches a
  customer-visible toast (lines 133–140).
  `client/src/pages/Results.tsx` line 810 ignores the body entirely
  (`if (!response.ok) throw new Error("Failed to regenerate")`).
- **What the app's own routes return today.** Every error branch in
  `POST /api/render` returns a flat `{ message: string }`. The monolith's
  browser-facing convention and the inter-service contracts envelope are
  two different shapes, and neither is `{ error: { code, message } }`.
- **What the loading screen does.** `client/src/pages/Loading.tsx` lines
  57–69 poll `GET /api/render/:id` on an unconditional
  `refetchInterval: 2000` with no terminal-status branch.

## Options

**A. Fail closed.** Unreachable service → `503`, no `renders` row, the
customer sees an error and can retry. Cost: a visible failure for that
customer whenever the services are down. Benefit: the outage is legible
from outside the process, and the flag-on/flag-off separation that
`UI-A5-01`–`03` proved by byte-identical capture continues to hold at
runtime.

**B. Silent fallback to the legacy placeholder path.** Customer always gets
a response. Cost, as measured against the actual legacy code above: the app
writes `status: "completed"` plus a stock photograph for a request that
generated nothing. A broken AI service runs in this mode indefinitely with
no external signal, and no observer of a `renders` row can tell which code
path produced it. This does not merely degrade the flag-on/flag-off proof;
it manufactures a success state.

**C. Fallback with a warning field on the response.** Softer than B, but
the row still says `completed` with a stock image, and the warning is
carried only in the HTTP response, which nothing persists. Retains B's core
defect while adding a field that implies the problem was handled.

**D. Circuit breaker.** Trip after N consecutive unreachable results and
stop calling the service for a cooldown. This is an efficiency and
thundering-herd control, not an answer to the question "what does the
customer get" — it still has to resolve to A, B or C when the circuit is
open. Premature here: there is exactly one consuming route, a single-process
Express server, and no measured retry-storm problem.

## Decision and rationale

**Option A. Fail closed. Confirmed as specified in
`ai_services/work_packets/UI-A5-04.md` — with three revisions to the
response shape, listed below.**

The rationale is not primarily the "undefined means blocked" analogy the
packet reaches for; it is narrower and stronger. This project treats **job
success, candidate review, and commercial availability as three separate
states, never collapsed**, and forbids fabricating data to make something
look done. Option B writes `status: "completed"` for work that was never
attempted. That is not a fallback, it is a false success record, persisted,
against a customer's real quiz response. Once the legacy path's actual
contents are read rather than assumed, the choice stops being a UX
tradeoff.

The secondary argument stands too: the flag defaults off and is not
true-by-default, so flag-on-plus-services-down is overwhelmingly a
misconfiguration, and B hides it behind output that looks normal.

### Revisions to `UI-A5-04`'s specified behavior

**R1 — the error body must be flat, and `error` must be a string.** The
packet specifies `{ error: { code, message, service } }` for the `503` and
`{ error: { code, message, requestId } }` for the pass-through case. Both
are a third shape, matching neither the app's `{ message }` convention nor
the contracts envelope, and both are actively broken against the primary
caller: `Quiz.tsx` does `new Error(errorData.error)` on an object, which
renders the customer-visible toast as the literal string
`"[object Object]"`. Required shape for both cases, flat:

```
{ message: string, error: string, code: string, service: string,
  retryable: boolean, requestId?: string }
```

`message` and `error` carry the same human-readable sentence —
`error` is a deliberate compatibility shim for `Quiz.tsx`'s extractor, and
should be commented as such, with a note that a later packet may normalize
the client and drop it. For the unreachable case `retryable` is `true`. For
the service-responded-non-2xx case, `code`, `message`, `requestId` and
`retryable` are taken verbatim from the service's own contracts-envelope
body and are never replaced with a generic message.

**R2 — the app boundary does not adopt the inter-service envelope.**
`ai_services/contracts/v1/schemas/error.schema.json` governs
service-to-service HTTP between the Python services. `POST /api/render` is
the monolith's own browser-facing API, not a contract surface, and it keeps
the monolith's own convention. Service error fields are flattened *into*
the app's response, not nested as a foreign envelope inside it. Any future
app route consuming an AI service follows the same rule.

**R3 — no `renders` row for the `503`, and the reason is on the record.**
The packet's asymmetry is correct but unexplained: `needs_input` (step 2)
persists a row, while unreachable (step 4) and misconfigured (step 3) do
not. The principle is that a **per-request outcome attributable to the
customer's own input** is durable and worth persisting; an **environment
condition** is not attributable to the request, would write one junk row per
retry, and is properly visible in logs and monitoring rather than in the
`renders` table. Keep the behavior, state the principle.

### Explicitly not decided here

Circuit breaking, retry-with-backoff, and any health-check-before-call
pattern are out of scope. Revisit only with evidence of a real retry-storm
or latency problem, which cannot exist before the flag is on for real
traffic.

## Consequences and reversal

**Costs accepted.** With the flag on and a service down, a customer
submitting the quiz gets a destructive toast and stays on the quiz page.
There is no queue-and-retry-later behavior; the customer must resubmit. That
is the honest representation of the system's state and is accepted.

**A limitation this decision does not fix, and should not be read as
fixing.** Fail-closed covers only the unreachable case at submission time.
`UI-A5-04`'s success path creates `status: "generating"` rows that nothing
ever transitions to `completed` (the packet's own named gap), and
`Loading.tsx` polls unconditionally every 2s with no terminal-status
branch. The result is that the *success* path, and the `needs_input` path,
currently end in an indefinite spinner. That is the same silent-degradation
failure mode this ADR rejects, displaced downstream. It is not `UI-A5-04`'s
to fix, but the follow-up packet that adds job-completion reconciliation is
**required** to also give `Loading.tsx` a terminal state for `failed`,
`needs_input`, and a bounded wait for `generating`. Dispatching that packet
without the client-side terminal states would leave the phase in a state
this ADR would not have approved.

**Reversal.** Cheap and localized by construction: the decision lives in one
`catch` branch in `server/services/ai-adapter/render-orchestrator.ts` plus
the `isServiceUnreachableError` predicate in
`server/services/ai-adapter/service-availability.ts`. Reverting to a
fallback is deleting a throw and calling the legacy branch. Nothing in the
schema, the contracts, or the Python services depends on this choice.

**Evidence that would prove this decision wrong.** Any one of:

- The legacy path stops writing `status: "completed"` with a stock image —
  e.g. it is changed to write an explicitly-marked placeholder status that a
  downstream reader cannot mistake for a real render. The central argument
  above is entirely contingent on what that path persists today; change the
  fact and the decision should be re-opened.
- Real-traffic data showing AI-service unavailability is frequent *and*
  short-lived (seconds), where a bounded in-request retry would convert most
  failures into successes. That argues for retry, not for fallback, but it
  would justify re-opening the section.
- A product decision that the placeholder render is itself a legitimate
  customer deliverable rather than a development scaffold. If it is a real
  product surface, it is not a "fallback" and should be selected
  deliberately and labelled, not reached by a `catch`.

## Verification

- `ai_services/work_packets/UI-A5-04.md`, "Failure-mode decision" and
  "Named tests" — tests 4 and 5 must prove the unreachable and
  service-responded-non-2xx cases take different code paths, and must
  additionally assert the body is flat with `typeof body.error === "string"`
  (the `"[object Object]"` regression guard from R1).
- Test 4 asserts no `renders` row is created and the response is not the
  legacy placeholder shape (R3).
- Test 7 asserts the misconfigured case makes no HTTP call at all.
- Read-verified against `server/routes.ts` lines 755–788,
  `client/src/pages/Quiz.tsx` lines 95–140,
  `client/src/pages/Results.tsx` lines 800–821,
  `client/src/pages/Loading.tsx` lines 57–69, and
  `ai_services/contracts/v1/schemas/error.schema.json` on 2026-09-15.
