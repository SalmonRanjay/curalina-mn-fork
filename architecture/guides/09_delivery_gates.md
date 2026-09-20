# Proof to service delivery plan

## Working model

Four part-time contributors retain primary ownership: recommendation/data, variants, rooms, and architecture/QA/local tooling. Each image owner needs a reviewer; share benchmark sessions to avoid simultaneous GPU demand. This revises the earlier single GenAI-owner allocation for this work-package plan. All contributors implement tests for their own code; QA ownership is not permission to delegate testing away.

Keep the earlier 14-week horizon as a planning reference at 10–12 hours/person/week, subject to actual academic capacity. Production-grade implementation is a quality progression, not a guaranteed public production launch in that horizon. GPU readiness and catalogue expansion are critical dependencies.

| Weeks | Work | Exit evidence |
|---|---|---|
| 1–2 | Local kernels, source audit, fixtures, reviewed rules and asset acquisition | G0 data contract and supported inputs agreed |
| 3–4 | R02 baseline, V01 masks/recolouring, G01 room/placement preparation | Repeatable CPU results and valid image experiment set |
| 5–6 | V02/G02 candidate comparisons, R03 bounded composition | G1 feasibility results per workstream, including failures |
| 7 | Held-out review and scope decision | G2 chosen strategies or explicit no-go/reduced scope |
| 8–9 | Extract domain/use cases; write units; local persistence and model adapters | Notebook/package parity and locked environments |
| 10–11 | Standalone APIs/workers; durable jobs; contract and recovery tests | G3 each service starts and runs independently |
| 12 | Local client passes exported fixtures/assets between services | G4 traceable end-to-end run without existing application |
| 13 | Held-out rerun, quality/security checks and UAT | Failure report and reviewed acceptance results |
| 14 | Fix critical defects, repeatability check, handover | G5 local service release candidate and remaining deployment gates |

## Proposed evaluation gates

These numbers are starting decision criteria, not measured results or client-approved commitments. Freeze them before held-out tests and record designer acceptance or revisions.

Recommendation: zero hard-rule violations and explicit no-solution behaviour on all agreed constraint cases. On labelled briefs, target mean Precision@5 >=0.80 and NDCG@5 >=0.80; select a learned/embedding approach only if benefit over the simple baseline justifies complexity. Report sample size and per-profile failures, not only averages.

Variants: for four held-out products and three colours each, propose >=10/12 outputs accepted within at most three attempts per request; all accepted outputs must preserve identity. Require zero changed pixels in the strictly protected region of lossless composited outputs, excluding the agreed feather band. Set the colour Delta E tolerance with designers on development examples before testing.

Rooms: first require all five one-product scenes to preserve the intended hero product within three attempts. Later propose >=4/5 bounded multi-product scenes accepted within three attempts, with no missing or wrong hero identity in accepted scenes. Hold-out scenes are not used to tune prompts. Five scenes give weak statistical evidence; the report must state that limitation.

Performance: set acceptable latency and memory only after hardware measurement. Record median/p95 where sample size supports it, cold/warm timings, peak memory, attempt counts and timeouts. Do not advertise a p95 from two successful calls.

## Stage evidence

G0: input inventory, rights/provenance, unresolved fields and supported scope. G1: notebooks restart and run, all attempts logged, model configuration captured. G2: held-out results and signed decision record. G3: clean dependencies, tests, restart recovery, no model work in API loop. G4: each imported reference hash matches its source; IDs and revisions survive transport. G5: fresh-machine instructions verified, tests passed, limitations explicit, known critical defects resolved.

If one workstream fails G2, preserve its interface using labelled fixtures for integration tests but do not claim that fixtures prove model capability. Reduce scope or revisit assets/models through a decision record. No beautiful demo bypasses the feasibility gate.

## Agentic implementation gates

Use these gates for task assignment after the architecture pack is accepted:

| Gate | Agent output | Required proof |
|---|---|---|
| A0 Scaffold | `ai_services/` layout, service READMEs, local command targets and shared contract fixture folder | `make setup-all` documents missing optional model assets without failing fast tests |
| A1 Contracts | JSON schemas or typed DTOs plus fixtures for success, invalid input and no-solution cases | contract tests reject unsupported major versions and unknown required fields |
| A2 Package use cases | Domain/application code with fake ports | unit and contract tests pass without GPU, Internet or current-app database access |
| A3 Durable APIs/workers | Loopback APIs, SQLite repositories, workers for image services and restart recovery | integration tests cover idempotency, cancellation, stale worker completion and sanitized errors |
| A4 Suite run | local suite runner and fixture client passing data across service HTTP boundaries | service IDs, revisions and content hashes survive export/import without shared local paths |
| A5 UI adapter | current app adapter behind feature flag | adapter tests map quiz/product/upload/render records to service contracts and persist returned IDs |
| A6 Evaluation handoff | experiment reports, ADRs and known limitations | held-out results or explicit no-go are recorded before model-backed claims |

No later gate can repair a missing earlier gate. If a service cannot reach a gate because assets, labels or hardware are missing, keep its HTTP contract available with labelled fixtures and mark the model capability blocked rather than silently lowering acceptance.

## Later production release readiness

Future deployment design must address identity provider, network/TLS, durable distributed jobs, storage retention, backup/restore, migration safety, concurrency/quotas, monitoring alerts, rollback and cost controls. Current ports and immutable contracts make those additions possible. Public production readiness remains unapproved until these deployment-specific gates are satisfied.
