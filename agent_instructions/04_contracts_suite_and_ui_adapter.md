# Build brief: shared contracts, local suite runner, and UI adapter

Give this file to one agent (or a paired hand-off between two agents at the
UI-adapter boundary noted below). It covers three roles that have no model
or notebook gate of their own: contracts stewardship, the local suite
runner, and the feature-flagged UI adapter into the existing app. Unlike
the other three service briefs, there is no single deep technical-design
doc here — the workflow docs themselves are the primary spec. Read
everything below before writing anything.

## What you are building

1. `ai_services/contracts/v1/` stewardship — keeping the shared contract
   fixtures coherent across recommendation, variants, and rooms.
2. `ai_services/` root suite runner — a Makefile-driven local orchestrator
   that starts all available services and runs a fixture flow end to end.
3. A feature-flagged adapter layer inside the **existing** TypeScript/
   Express app that turns it into an HTTP consumer of the three new
   services, switchable behind an environment flag.

These three roles can run continuously starting week 1 (parts 1–2) and
only start the third part once recommendation has reached A3/A4 and all
three services' A1 contracts are stable.

## Required reading, in this order

1. This file.
2. `architecture/templates/agent_work_packet.md` — packet skeleton, one per part/phase below.
3. `agentic_flow/EXAMPLE_work_packet_rules_engine.md` — calibration example of a fully-specified packet (different service, same bar for detail).
4. `agentic_flow/00_agentic_workflow_overview.md` — gate legend and non-negotiable invariants (this track has no notebook gate, but the invariants — separate databases, HTTP-only cross-service traffic, three separate render/job states — still apply and are exactly what this track enforces on everyone else).
5. `agentic_flow/AMENDMENTS.md` — corrections to apply on top of the guides below.
6. `architecture/guides/01_system_architecture.md` ("suite integration boundary"), `02_local_setup.md`, `03_data_contracts.md` — read in full; these three are your primary specs (there is no deeper technical-design doc for this track).
7. `agentic_flow/contracts_and_suite_workflow.md` — **authoritative task breakdown for Parts 1 and 2 (contracts stewardship, suite runner).**
8. `agentic_flow/ui_adapter_workflow.md` — **authoritative task breakdown for Part 3 (UI adapter, phase A5).**
9. `architecture/guides/10_source_audit.md` — background on the existing app and proposal source material (needed for Part 3 context).
10. `docs/replit.md` and `docs/PLATFORM_GUIDE.md` — current-state description of the existing app (quiz flow, product scoring, render pipeline, DB schema). Needed only for Part 3, to know exactly what you're mapping *from*. Do not treat these as specs for the new services — they describe the system being adapted, not the target.
11. `architecture/guides/09_delivery_gates.md` — general gate context, for completeness; this track has no gate of its own but must not let another service claim one falsely (see Part 1's arbitration role below).

## Part 1 — Shared contracts (`ai_services/contracts/v1/`)

**Role:** steward, not sole author. Recommendation, variants, and rooms
each propose additive fixtures for their own endpoints; your job is to keep
the folder coherent and catch cross-service inconsistencies — duplicate
error codes, incompatible ID formats, a field meaning two things in two
services.

**Deliverables:**
- Canonical error-vocabulary schema (`code, message, details, retryable, request_id`) used identically by all three services.
- Shared ID/versioning conventions: `schema_version=1.0`, `/v1` paths, snapshot/revision ID shape, content-hash format.
- A CONTRIBUTING note in the contracts folder: additive-only for minor versions; a removed field, changed unit, or changed semantic requires a major version bump and sign-off from every consuming service.

**Boundaries:** do not write business logic for any service. Do not resolve
a cross-service disagreement by picking a winner unilaterally — a
breaking-change proposal gets an ADR (`architecture/templates/architecture_decision.md`), same as a model decision would.

**Done evidence:** every service's own contract tests pass against the
shared fixtures; a deliberate test shows an unsupported major version
rejected with `422` identically in all three services.

## Part 2 — Local suite runner (`ai_services/` root)

**A0 (parallel with the other services' scaffolds):** `ai_services/Makefile`
with `setup-all`, `test-all`, `test-contracts`, `run-suite`; a local
fixture-client skeleton with no business logic yet.

**A4 (once at least two services have reached their own A3):** `run-suite`
starts recommendation (`8101`), variants (`8102`), rooms (`8103`), and any
available worker, each with explicit environment variables and
**independent databases per service**; health-checks each; runs the fixture
flow catalogue import → ranking → bundle → variant export → render job →
review; verifies IDs, revisions, and content hashes survive each hop; exits
non-zero on any contract mismatch or missing/occupied port/setting.

**Boundaries:** the suite runner is an orchestration convenience, never a
fourth business service — it must never import a service's Python
internals, open another service's SQLite file, or read another service's
local asset paths. All cross-service traffic goes through public HTTP
endpoints and exported fixtures.

**Escalation rule:** if a service isn't ready to join the run (e.g. rooms
still has only a fake adapter), the suite still runs against the available
services and reports the missing one by name — it never silently blocks or
silently skips a check.

**Done evidence:** `make run-suite` completes the fixture flow end to end
on a fresh checkout, fails clearly (not silently) when a service is missing
or a contract mismatches, and the failure message names the specific
service/endpoint/field involved.

## Part 3 — UI adapter (phase A5, existing app)

**Scope:** the existing app (Drizzle/PostgreSQL, `quizResponses`,
`products`, `renders`, `renderProducts`, `selectionLedger`, legacy AI
generation paths) becomes a **consumer** of the three services over HTTP,
behind a feature flag. This does not touch service internals, and the
existing legacy AI path must remain switchable, not removed.

**Allowed files:** the app's adapter layer only — new module(s); do not
restructure existing quiz/catalogue/render/upload/cart code beyond what's
needed to call the adapter.

**Settings:**
```
CURALINA_AI_SERVICES_ENABLED=false
CURALINA_RECOMMENDATION_URL=http://127.0.0.1:8101
CURALINA_VARIANTS_URL=http://127.0.0.1:8102
CURALINA_ROOMS_URL=http://127.0.0.1:8103
CURALINA_AI_CONTRACT_VERSION=1.0
```

**Required mappings** (from `03_data_contracts.md`, current app → service contract):

| Current app concept | Service contract concept | Rule |
|---|---|---|
| quiz response | DesignProfile | Preserve room, styles, colour/palette, functional needs, budget, uploaded asset refs; unsupported fields → null with provenance |
| product row | Product + Asset refs | Preserve SKU, supplier, dimensions, price, availability, image URLs; never expose trade price in customer-facing responses |
| product image URL/upload | Asset import | Import/upload into the owning service; persist returned `asset_id`/content hash |
| render record | Render job/result | Store service job ID, status, `schema_version`, `bundle_id`/revision, candidate/review IDs |
| selection ledger | Bundle explanation/provenance | Keep scores, rejected reasons, rule versions traceable to the immutable bundle revision |

**Deliverables:**
1. Flag off → legacy path behaves exactly as before (existing tests unchanged).
2. Flag on → quiz responses convert to `DesignProfile` and call recommendation.
3. Product/room assets are imported into the owning service before a job is submitted — never a raw local path passed cross-service.
4. Returned service IDs, revisions, and schema versions are persisted on the app's own render-related records for traceability.
5. A required-field mapping the adapter cannot fill returns a structured `needs_input`/validation error — the adapter never invents data to fill a gap.

**Boundaries:** no direct connection to any service's SQLite file or
filesystem asset path. No AI-service business logic (ranking weights, mask
rules, generation controls) implemented in the app — if a mapping decision
turns out to need a business rule, that rule belongs in the service
contract or an ADR, not hidden in adapter code.

**Done evidence:** adapter fixture tests prove current-app records map to
service contracts and that returned IDs/revisions round-trip back into app
persistence; legacy path remains switchable and passes its own existing
tests unchanged; `needs_input` is returned (not fabricated data) for at
least one deliberately incomplete fixture.

## Definition of done for this file

- Part 1: contract tests green across all three services against shared fixtures; `422` behavior verified identically in all three.
- Part 2: `make run-suite` runs the full fixture flow on a fresh checkout and fails loudly and specifically when something's missing.
- Part 3: adapter fixture tests pass, legacy path's own test suite is unchanged and green, and the `needs_input` fixture test exists and passes.
- Completion evidence lists exact files changed, exact commands run and results, per-part done-evidence status, and any ADR filed for a cross-service arbitration decision.
