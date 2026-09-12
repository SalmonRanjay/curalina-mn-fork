# Build brief: variant-generator service (`curalina_variants`)

Give this file to one agent. Read in the order below; do not start writing
code before the workflow doc (step 9) — it is authoritative for phase
scope.

## What you are building

`ai_services/variants/` — an HTTP + worker service (local port `8102`) that
generates visual variants of products (e.g. alternate upholstery/finish) via
a CPU-only LAB colour-transfer baseline and an optional GPU SDXL-inpainting
refinement path, with durable job handling — API enqueues, workers execute,
never the reverse.

## Required reading, in this order

1. This file.
2. `architecture/templates/agent_work_packet.md` — packet skeleton, one per phase.
3. `agentic_flow/EXAMPLE_work_packet_rules_engine.md` — calibration example of a fully-specified packet (different service, same bar for detail).
4. `agentic_flow/00_agentic_workflow_overview.md` — gate legend, non-negotiable invariants, work-packet discipline.
5. `agentic_flow/AMENDMENTS.md` — corrections to apply on top of the guide in step 7.
6. `architecture/guides/01_system_architecture.md`, `02_local_setup.md`, `03_data_contracts.md`, `08_engineering_and_tests.md`, `09_delivery_gates.md`.
7. `architecture/guides/05_variants.md` — original service spec (read with AMENDMENTS applied).
8. `architecture/guides/07_model_selection.md` — SDXL/SAM candidates, licences, hardware/VRAM arithmetic.
9. `agentic_flow/15_variant_generation_technical_design.md` — LAB-baseline code, SDXL refinement design, module layout. Primary technical reference.
10. `agentic_flow/variant_generator_workflow.md` — **authoritative phase-by-phase (A0–A6) task breakdown.** Execute this; do not re-derive scope from the guides above.
11. `agentic_flow/16_notebook_standard.md` — 7-section notebook structure and manifest cell.
12. `architecture/notebooks/variant_generator/01_masks_and_colour.ipynb`, `02_diffusion_comparison.ipynb`, `03_evaluation_and_export.ipynb` — existing skeletons for V01/V02/V03. Fill these in.
13. `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` — pinned stack: Pillow + OpenCV, colour-science, LAB baseline (primary path), SDXL inpainting (experiment path), SAM (optional, masks).

## Gate dependencies

| Claim | Requires |
|---|---|
| LAB colour-transfer baseline as accepted | V01 reviewed run |
| SDXL-inpainting refinement as accepted alternative/upgrade | V02 diffusion-comparison run recorded against V01 baseline |
| Any "meets acceptance thresholds" claim | Stage gate matching `09_delivery_gates.md`'s variants row (silhouette IoU, colour-tolerance, held-out acceptance criteria below) |

A0–A3 (scaffold, contracts, fake-adapter domain/application logic, API/worker
skeleton) have **no** dependency on real product photos and should proceed
fully in parallel with sourcing them.

## Phase-by-phase build

Follow `agentic_flow/variant_generator_workflow.md` A0 → A6 exactly, filling
one `agent_work_packet.md` per phase:

- **A0 — Scaffold:** package skeleton, immutable `Settings`, README with real `make setup`/`make test`/`make run-api`/`make run-worker` commands. No image logic yet.
- **A1 — Contracts:** JSON fixtures + typed DTOs for `VisualVariant`/`Asset`/`Mask` records and the job-lifecycle endpoints per `03_data_contracts.md`. Fixture-backed fake job responses only.
- **A2 — Domain/application logic, fake adapters first:** mask handling, LAB colour-transfer extraction (depends on V01's reviewed run), SDXL refinement adapter behind a port (depends on V02), all callable identically from a notebook and from the worker.
- **A3 — API + worker (durable jobs):** API enqueues a durable job and returns immediately; a separate worker process executes inference. No inference in the request handler, ever. This phase does **not** require a real model — it can and should be built against the fake adapter from A2 first.
- **A4 — Suite participation:** clean start under `make run-suite`; job/asset IDs survive export/import with content hashes intact.
- **A5 — UI-adapter support (contract-only):** keep `/v1` contracts stable for the adapter team; see `04_contracts_suite_and_ui_adapter.md`.
- **A6 — Evaluation handoff:** report against the acceptance criteria below; ADR on LAB-baseline-only vs. SDXL-refinement-as-accepted-upgrade. Requires the matching stage gate from `09_delivery_gates.md`.

## Acceptance criteria (from `09_delivery_gates.md`)

Zero changed pixels outside the protected region's feather band; silhouette
IoU ≥0.98; Delta-E colour tolerance agreed with designers and recorded, not
assumed; ≥10/12 held-out outputs accepted within 3 attempts. Job success,
candidate review, and commercial availability are three separate states —
never collapse them into one status field.

## Blocked inputs — read this before starting V01

The reference workbook has **no upholstery/product images** as of this
pack's writing. V01 (and anything claiming real-model accuracy) is blocked
until real product photos are supplied — do not substitute stock/placeholder
imagery and label the result as real evidence. A0–A3 have no such
dependency and should be built now regardless. If you reach V01 with no
images available, stop, record the blocker explicitly (cite it as the
"no upholstery images" gap), and do not fabricate a passing run.

## Definition of done for this file

- Unit tests pass with no GPU/internet required for the fast suite; any GPU-dependent test is clearly marked and excluded from the fast path.
- V01/V02/V03 notebooks filled per the 7-section standard, each ending in a decision record — or, if blocked on real images, an explicit written limitation instead of a fabricated pass.
- A6 report and ADR exist, honestly stating which stage gate is or isn't met.
- Completion evidence lists exact files changed, exact commands run and results, and per-phase done-evidence status.
