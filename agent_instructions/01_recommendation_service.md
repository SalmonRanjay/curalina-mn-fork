# Build brief: recommendation service (`curalina_recommendation`)

Give this file to one agent. It names every other document that agent
needs, in the order to read them. Do not start writing code before step 9
below (the workflow doc) — it is the authoritative phase-by-phase spec;
everything before it is framing you need to interpret it correctly.

## What you are building

`ai_services/recommendation/` — a synchronous, no-worker HTTP service
(local port `8101`) that ranks catalogue products against a design profile
and composes shoppable/no-shoppable bundles, deterministic and
rule-governed, with two optional model-backed upgrades (embedding-based
ranking; bundle composition depending on the design-rules engine) that only
become "accepted" once their evidence gates clear.

## Required reading, in this order

1. This file.
2. `architecture/templates/agent_work_packet.md` — packet skeleton, one per phase.
3. `agentic_flow/EXAMPLE_work_packet_rules_engine.md` — calibration example for what a fully-specified packet looks like (different service, same bar).
4. `agentic_flow/00_agentic_workflow_overview.md` — gate legend (notebook/stage gates vs. A0–A6), non-negotiable invariants, work-packet discipline.
5. `agentic_flow/AMENDMENTS.md` — corrections to apply on top of the guide in step 7.
6. `architecture/guides/01_system_architecture.md`, `02_local_setup.md`, `03_data_contracts.md`, `08_engineering_and_tests.md`, `09_delivery_gates.md` — shared architecture, contracts, and test/gate baselines.
7. `architecture/guides/04_recommendation.md` — original service spec and build order (read with AMENDMENTS applied).
8. `agentic_flow/13_recommendation_technical_design.md` — the four-layer design (hard filters → per-category ranking → beam-search solver → validation/explanation) and module layout. This is your primary technical reference.
9. `agentic_flow/recommendation_workflow.md` — **the authoritative phase-by-phase (A0–A6) task breakdown for this service.** Scope, allowed files, deliverables, mandatory named tests, and done-evidence per phase all live here. Execute this document; do not re-derive phase scope from the guides above.
10. `agentic_flow/16_notebook_standard.md` — 7-section notebook structure and manifest cell.
11. `architecture/notebooks/recommendation/01_catalogue_audit.ipynb`, `02_ranking_baselines.ipynb`, `03_bundle_and_substitutions.ipynb` — existing skeletons for R01/R02/R03. Fill these in; do not create new notebooks from scratch.
12. `agentic_flow/R02_ranking_baseline.ipynb` — a working reference notebook already following the standard; use it as your pattern for structure and manifest cell, not as content to copy.
13. `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` — pinned stack for this service: NumPy/pandas (ingest-only, never crosses into `domain/`), scikit-learn TF-IDF, sentence-transformers MiniLM, a custom beam-search solver, Shapely.
14. `agentic_flow/12_design_rules_engine.md` and `agent_instructions/00_design_rules_engine.md` — read only if your current phase touches bundle composition (A2 step 5 depends on `curalina_design_rules`); otherwise skip.

## Gate dependencies (do not claim a phase is "accepted" without these)

| Claim | Requires |
|---|---|
| Rule-only ranking as accepted baseline | R02 baseline comparison recorded |
| Embedding ranking (MiniLM) as accepted path | R02 held-out comparison shows benefit over baseline, ADR recorded |
| Bundle/composition logic as accepted | R03 go/no-go record (a legitimate outcome is "no-go on real furniture data, logic-only on synthetic fixtures") |
| Any "meets acceptance thresholds" claim | Stage gate **G2** (held-out review + scope decision, `architecture/guides/09_delivery_gates.md`) |

A0, A1, and the fake-adapter parts of A2 do not wait on any of the above and should start immediately.

## Phase-by-phase build

Follow `agentic_flow/recommendation_workflow.md` A0 → A6 exactly, filling
one `agent_work_packet.md` per phase before starting it:

- **A0 — Scaffold:** package skeleton, immutable `Settings`, README with real `make setup`/`make test`/`make test-contract`/`make test-integration`/`make run-api` commands. No business logic. No worker — do not add one speculatively; recommendation has none.
- **A1 — Contracts:** JSON fixtures + typed DTOs for the four HTTP endpoints (`/v1/catalogue/imports`, `/v1/recommendations`, `/v1/bundles`, `/v1/bundles/{id}/substitutions`) per `03_data_contracts.md`'s HTTP surface table — success, invalid-input, and (for bundles) explicit `feasible=false` cases. Fixture-backed fake responses only, no real ranking yet.
- **A2 — Domain/application logic, fake adapters first:** typed domain records → workbook/audit importer (depends on R01) → rule-only ranking with deterministic tie-breaking (depends on R02) behind a `FeatureEncoder` port → MiniLM embedding adapter as a second `FeatureEncoder`, wired as accepted only once the R02 gate clears → bundle composition/substitutions with full revalidation (depends on R03 and on `curalina_design_rules`).
- **A3 — API (no worker):** loopback HTTP on `8101` backed by real or fixture-labelled A2 logic; SQLite persistence for snapshots and rule versions.
- **A4 — Suite participation:** clean start under `make run-suite`; snapshot IDs and bundle revisions survive export/import with content hashes intact.
- **A5 — UI-adapter support (contract-only):** recommendation does not implement adapter code (see `04_contracts_suite_and_ui_adapter.md`); just keep `/v1` contracts stable and provide realistic quiz-shaped fixtures.
- **A6 — Evaluation handoff:** experiment report (Precision@5, NDCG@5, category coverage, no-result rate, hard-constraint violations, runtime, sample size, per-profile failures) + ADR on whether embeddings earned their complexity over the rule-only baseline. Requires stage gate **G2** or an explicit no-go/reduced-scope record.

## Mandatory named unit tests (do not replace with a coverage percentage)

Exact budget boundary; currency mismatch; whitespace SKU; missing required
facts; duplicate keys; unit conversion (in/mm); quantity totals;
incompatible pair; impossible clearance; insufficient categories; equal-score
deterministic tie-breaking; substitution that breaks a previously valid
layout. (Full detail and rationale in `04_recommendation.md` and
`08_engineering_and_tests.md`.)

## Boundaries you must not cross

- Never fabricate a valid recommendation in shoppable mode using fallback products.
- Required-unknown commercial facts produce `unknown`, never `available`.
- No pandas DataFrame crosses into `domain/`.
- No model inference blocks the request handler; keep classical-ranking computation bounded and fast even though there's no GPU model here.

## Blocked inputs

R03 (bundle composition) may legitimately be blocked on real furniture
catalogue data (`OQ-011` in `agentic_flow/open_questions.yaml`) — ship
against clearly labelled synthetic fixtures rather than waiting or
fabricating real-looking data. Any rule-engine call that returns
`needs_input` propagates as-is; do not catch and default it.

## Definition of done for this file

- All mandatory named tests pass; contract tests pass without GPU/internet/current-app DB access.
- R01/R02/R03 notebooks filled per the 7-section standard, each ending in a decision record.
- A6 experiment report and ADR exist, honestly stating which gate (G2) is or isn't met.
- Completion evidence lists exact files changed, exact commands run and results, and every phase's done-evidence status.
