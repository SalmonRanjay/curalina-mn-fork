# Build brief: room-generator service (`curalina_rooms`)

Give this file to one agent. Read in the order below; do not start writing
code before the workflow doc (step 9) — it is authoritative for phase
scope.

## What you are building

`ai_services/rooms/` — an HTTP + worker service (local port `8103`) that
renders a customer's room as a "photograph" of a `StyledRoom` object the
design-rules engine already decided — the renderer never makes a styling
decision itself, it only projects one. Primary approach: composite-then-
harmonize (promoted over the original A/B/C neutral framing per
`agentic_flow/AMENDMENTS.md` A5).

## Required reading, in this order

1. This file.
2. `architecture/templates/agent_work_packet.md` — packet skeleton, one per phase.
3. `agentic_flow/EXAMPLE_work_packet_rules_engine.md` — calibration example of a fully-specified packet (different service, same bar for detail).
4. `agentic_flow/00_agentic_workflow_overview.md` — gate legend, non-negotiable invariants, work-packet discipline.
5. `agentic_flow/AMENDMENTS.md` — read amendment A5 specifically (renderer-approach promotion) plus general corrections, before the guide in step 7.
6. `architecture/guides/01_system_architecture.md`, `02_local_setup.md`, `03_data_contracts.md`, `08_engineering_and_tests.md`, `09_delivery_gates.md`.
7. `architecture/guides/06_room_generation.md` — original service spec (read with AMENDMENTS applied; note its neutral A/B/C framing is superseded).
8. `architecture/guides/07_model_selection.md` — SDXL/ControlNet/IP-Adapter candidates, licences, hardware arithmetic.
9. `agentic_flow/14_room_generation_technical_design.md` — **the central design reference.** Explains why the renderer never decides anything, the composite-then-harmonize approach, homography/layout-to-image projection, and post-render validation types. Primary technical reference.
10. `agentic_flow/room_generator_workflow.md` — **authoritative phase-by-phase (A0–A6) task breakdown.** Execute this; do not re-derive scope from the guides above.
11. `agentic_flow/16_notebook_standard.md` — 7-section notebook structure and manifest cell.
12. `architecture/notebooks/room_generator/01_room_inputs.ipynb`, `02_grounded_generation.ipynb`, `03_room_evaluation.ipynb` — existing skeletons for G01/G02/G03. Fill these in.
13. `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` — pinned stack: SDXL + ControlNet + IP-Adapter, composite-then-harmonize as recommended primary.
14. `agentic_flow/12_design_rules_engine.md` and `agent_instructions/00_design_rules_engine.md` — read for how `StyledRoom` is produced upstream; this service consumes it, it does not reimplement any styling rule.

## Gate dependencies

| Claim | Requires |
|---|---|
| Composite-then-harmonize pipeline as accepted primary | G01 (room prep/homography) reviewed run |
| Single-product identity preservation as accepted | G02 — all 5 one-product scenes preserve the hero product within 3 attempts |
| Bounded multi-product scenes as accepted | G03 — ≥4/5 scenes accepted |
| Any "meets acceptance thresholds" claim | Stage gate per `09_delivery_gates.md`'s rooms row |

A0–A3 (scaffold, contracts, fake-adapter logic, API/worker skeleton) have no
dependency on real room photos or customer measurements and should proceed
in parallel with resolving the blocker below.

## Phase-by-phase build

Follow `agentic_flow/room_generator_workflow.md` A0 → A6 exactly, filling
one `agent_work_packet.md` per phase:

- **A0 — Scaffold:** package skeleton, immutable `Settings`, README with real `make setup`/`make test`/`make run-api`/`make run-worker` commands. No rendering logic yet.
- **A1 — Contracts:** JSON fixtures + typed DTOs for room/asset/render-job records per `03_data_contracts.md`, including the `POST /v1/assets` import contract used to pull in variant exports. Fixture-backed fake job responses only.
- **A2 — Domain/application logic, fake adapters first:** room-prep/homography extraction (depends on G01), grounded-generation pipeline consuming a `StyledRoom` from `curalina_design_rules` (never deciding styling itself), post-render validation (identity preservation, architecture non-alteration).
- **A3 — API + worker (durable jobs):** API enqueues; a separate worker executes inference. No inference in the request handler.
- **A4 — Suite participation:** clean start under `make run-suite`; consumes recommendation's bundle and variants' exports **only via public HTTP** (`POST /v1/assets`) — never by reading another service's SQLite database or filesystem directly.
- **A5 — UI-adapter support (contract-only):** keep `/v1` contracts stable; see `04_contracts_suite_and_ui_adapter.md`.
- **A6 — Evaluation handoff:** report against the acceptance criteria below, with failure modes reported separately (see below). Requires the matching stage gate.

## Acceptance criteria and failure-mode discipline

All 5 one-product scenes must preserve the hero product within 3 attempts
(G02); ≥4/5 bounded multi-product scenes accepted (G03). Failure modes —
product absent, wrong identity, wrong colour, distorted, altered
architecture — must be reported **separately per mode**, never merged into
one aggregate score. If neither the composite-then-harmonize approach nor
any fallback preserves product identity reliably, the correct action is to
**stop promotion and record the limitation** — not to lower the acceptance
bar or average it away.

## Blocked inputs

Room geometry / measurement source is unresolved (`OQ-010` in
`agentic_flow/open_questions.yaml`): a single customer photo cannot certify
real-world dimensions on its own; customer-confirmed measurements are
required before any room-scale claim is treated as reliable. A0–A3 do not
depend on this and should be built now; G01 and anything downstream must
either have real measurements or an explicitly labelled synthetic/assumed
geometry, never a silently guessed one.

## Definition of done for this file

- Unit tests pass with no GPU/internet required for the fast suite; GPU-dependent tests clearly marked and excluded from the fast path.
- G01/G02/G03 notebooks filled per the 7-section standard, each ending in a decision record.
- A6 report exists with failure modes broken out separately, plus an ADR, honestly stating which stage gate is or isn't met.
- Completion evidence lists exact files changed, exact commands run and results, and per-phase done-evidence status.
