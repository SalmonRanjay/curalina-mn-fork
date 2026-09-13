# Agent work packet

## Task

Service: `curalina_variants`
Phase: A2 — Package use cases (fake `ImageEditor`/adapter path only)
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Build the fake-adapter slice of A2 only: typed domain records (`Mask`,
`VisualVariant`, colour/material value objects, the three independent
job/review/commercial states), the `ColourTransferAdapter` and
`DiffusionRefinementAdapter` ports those records flow through, deterministic
fake implementations of both ports, and `application/` use cases wired
against the fakes and testable today. No real LAB colour-space math, no
real masking/segmentation, no Pillow/OpenCV/SDXL — those are blocked (see
"Known blockers").

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/02_variant_generator_service.md`
- `agentic_flow/00_agentic_workflow_overview.md` (gate legend: A0/A1 and the
  fake-adapter parts of A2 need no notebook evidence; real-logic extraction
  waits for its notebook)
- `agentic_flow/variant_generator_workflow.md` (A2 section)
- `agentic_flow/15_variant_generation_technical_design.md` (module layout,
  three-state model, "Blocking dependency" section)
- `ai_services/work_packets/VAR-A1-01.md` (house style for this service)

## Allowed files

- `ai_services/variant_generator/src/curalina_variants/domain/**`
- `ai_services/variant_generator/src/curalina_variants/ports/**`
- `ai_services/variant_generator/src/curalina_variants/adapters/**`
- `ai_services/variant_generator/src/curalina_variants/application/**`
- `ai_services/variant_generator/tests/unit/**`
- `ai_services/work_packets/VAR-A2-01.md`

## Do not change

- `api/**` — A1's contract shapes are untouched; this packet does not wire
  `application/` into `api/` because A1's DTOs and A3's transport are a
  separate concern from this phase's fake-adapter use cases, and the packet
  scope explicitly excludes touching A1's contract.
- `workers/`, `bootstrap.py`, `settings.py` — A3's job/worker lifecycle.
- Real colour-space math, real masking/segmentation logic, any Pillow/
  OpenCV/SDXL import or dependency — explicitly out of scope until V01/V02.
- `pyproject.toml` / `requirements.lock` — no new runtime dependency was
  needed; the fakes use only stdlib.
- `agentic_flow/**`, `architecture/**`, `agent_instructions/**`.

## Deliverables

- `domain/colour_spec.py`: `RgbColour` (hex parse/serialize, channel-range
  validated), `MaterialSpec`, `ColourSpec`. No colour-space conversion —
  that is `ColourTransferAdapter`'s job, not a domain value object's.
- `domain/mask_spec.py`: `Region` (protected subregion) and `Mask`
  (`mask_id`, `source_asset_id`, `width_px`/`height_px`, `editable_mask` as
  raw `bytes` — 1 byte/pixel, `1==editable`/`0==protected` — so no NumPy
  import is needed in `domain/`, `protected_subregions`, `feather_px`,
  `human_corrected`, `revision`), with `is_empty`/`is_fully_editable`
  properties and full structural validation (length match, byte values,
  bounds, blank ids, negative feather, revision floor).
- `domain/review.py`: `ReviewDecision` (`pending|approved|rejected`).
- `domain/commercial_status.py`: `CommercialAvailability`
  (`conceptual|custom_order|supplier_confirmed`).
- `domain/variant_candidate.py`: `JobOutcome`
  (`queued|running|succeeded|failed|cancelled`), `ALLOWED_JOB_TRANSITIONS`,
  `TERMINAL_JOB_OUTCOMES`, and `VisualVariant` — the frozen record carrying
  all three states as **independent fields**, with `__post_init__`
  invariants that (a) `commercial_status` cannot leave `conceptual` unless
  `review_status == approved`, and (b) `output_asset_id` cannot be set
  unless `job_outcome == succeeded`. `generation_manifest` is frozen via
  `MappingProxyType` so a candidate's recorded manifest cannot be mutated
  after construction.
- `ports/colour_transfer.py`: `ColourTransferAdapter` (ABC) +
  `ColourTransferResult`. Docstring states plainly this is V01's home and
  names both blockers explicitly.
- `ports/diffusion_refinement.py`: `DiffusionRefinementAdapter` (ABC) +
  `DiffusionRefinementResult`. Docstring states this is V02's home, blocked
  behind V01 and inheriting both of V01's blockers.
- `adapters/fake_colour_transfer.py`: `FakeColourTransferAdapter` — a
  labelled no-op pass-through (`diagnostics["fake"] = True`); does no LAB
  math, no compositing, no image decoding.
- `adapters/fake_diffusion_refinement.py`: `FakeDiffusionRefinementAdapter`
  — a labelled no-op pass-through; does no SDXL inference.
- `application/generate_variants.py`: `GenerateCandidateRequest` and
  `GenerateCandidateUseCase`, orchestrating an injected
  `ColourTransferAdapter` (and optional `DiffusionRefinementAdapter`) to
  produce a `VisualVariant` with `job_outcome=SUCCEEDED`,
  `review_status=PENDING`, `commercial_status=CONCEPTUAL` — proving success
  never implies approval or purchasability by construction.
- `application/review_candidate.py`: `apply_review` — the only allowed
  transitions are a single `pending -> approved` or `pending -> rejected`;
  everything else raises `InvalidReviewTransition`.
- `application/advance_commercial_status.py`: `advance_commercial_status` —
  requires `review_status == approved` first; raises
  `CommercialAvailabilityBlocked` otherwise, and blocks moving back to
  `conceptual`.
- Tests: `tests/unit/test_colour_spec.py`,
  `tests/unit/test_mask_spec.py`, `tests/unit/test_variant_candidate.py`,
  `tests/unit/test_fake_adapters.py`, `tests/unit/test_generate_variants.py`,
  `tests/unit/test_review_and_commercial_status.py` (60 tests total,
  including the 4 pre-existing A0 scaffold tests).

## Local commands

```bash
make -C ai_services/variant_generator test
make -C ai_services/variant_generator lint
make -C ai_services/variant_generator typecheck
```

Optional slow commands: none — this phase adds no GPU-dependent or
network-dependent code.

## Acceptance criteria

- `domain/` imports nothing from PIL/OpenCV/NumPy/torch/diffusers/pydantic —
  verified by `grep -rnE "import (torch|PIL|cv2|numpy|sklearn|diffusers)"
  domain ports adapters application` returning no matches.
- `Mask` rejects: length mismatch against `width_px*height_px`, byte values
  other than 0/1, non-positive dimensions, negative `feather_px`, revision
  below 1, blank `mask_id`/`source_asset_id`, and a protected subregion that
  exceeds the mask's bounds. `is_empty` and `is_fully_editable` correctly
  flag the all-protected and all-editable cases from the workflow's
  mandatory test list.
- `RgbColour.from_hex` rejects every malformed shape tried (missing `#`,
  wrong length, non-hex characters, empty string) — the "bad colour codes"
  mandatory case.
- `VisualVariant.__post_init__` refuses to construct an instance whose
  `commercial_status` has left `conceptual` without `review_status ==
  approved`, and refuses an `output_asset_id` on a non-succeeded job.
- `apply_review` covers the "pending/rejected status transitions" mandatory
  case: approve-from-pending, reject-from-pending, re-review-after-decision
  rejected, and reverting to pending rejected.
- `GenerateCandidateUseCase.execute` never returns a `VisualVariant` with
  `review_status == approved` or `commercial_status != conceptual` — no
  candidate is ever treated as approved or purchasable merely because
  generation returned success.
- Both fake adapters are deterministic (same input -> byte-identical,
  diagnostics-identical output) and both diagnostics dicts carry
  `"fake": True` plus a `"note"` naming exactly what real logic they skip.
- `mypy --strict` and `ruff check` are clean across
  `src/curalina_variants` and `tests/unit`.

## Known blockers

Two independent, hard blockers on any real image/colour logic in this
service — neither is resolved by fixing the other:

1. **V01 has not been run.** The LAB lightness/chroma-separated
   colour-transfer baseline
   (`agentic_flow/15_variant_generation_technical_design.md`, "Recolour —
   LAB baseline (primary)") has no frozen, reviewed notebook run. Per
   `agentic_flow/00_agentic_workflow_overview.md`'s gate legend, "a variant
   colour-transfer function can be extracted once V01 is reviewed" — it has
   not been.
2. **No real upholstery/product photographs exist in this repo.** The
   reference artwork workbook contains no upholstery images
   (`agentic_flow/15_variant_generation_technical_design.md`, "Blocking
   dependency", `OQ-011`). Even if V01 existed today, there is nothing real
   to run it against; artwork recolouring is explicitly called out as not a
   substitute ("do not substitute artwork recolouring as a demonstration of
   furniture variants — they are different problems").

V02 (SDXL diffusion refinement) is additionally blocked behind V01 itself,
so it carries both of the above blockers plus its own dependency on V01's
output. None of this blocks the fake-adapter scope delivered in this
packet — `ColourTransferAdapter`/`DiffusionRefinementAdapter` are defined
and exercised entirely through their fake implementations, which touch no
image data at all.

No `OQ-xxx` in `agentic_flow/open_questions.yaml` was hit by this packet's
scope (no CMR-formula or anchor-hex-library decision was needed for pure
value objects and fakes); if/when `LabColourTransformer` is built, expect it
to touch `OQ-007` (anchor hex library) for named-colour resolution.

## Completion evidence

- `make -C ai_services/variant_generator test` (unit): **60 passed**, 0
  failures. 100% statement and branch coverage on every new module
  (`domain/colour_spec.py`, `domain/mask_spec.py`, `domain/review.py`,
  `domain/commercial_status.py`, `domain/variant_candidate.py`,
  `application/generate_variants.py`, `application/review_candidate.py`,
  `application/advance_commercial_status.py`,
  `adapters/fake_colour_transfer.py`,
  `adapters/fake_diffusion_refinement.py`). `ports/colour_transfer.py` and
  `ports/diffusion_refinement.py` sit at 93%/92% — the single uncovered
  line in each is the abstract method's `raise NotImplementedError` body,
  which no caller can reach since both fakes override it.
- `make -C ai_services/variant_generator test-contract`: 24 passed
  (unchanged from A1 — `api/` was not touched).
- `make -C ai_services/variant_generator test-integration`: 1 passed
  (A0 scaffold, unchanged).
- `make -C ai_services/variant_generator test-worker`: 1 passed (A0
  scaffold, unchanged).
- `make -C ai_services/variant_generator lint`: `ruff check` — "All checks
  passed!".
- `make -C ai_services/variant_generator typecheck`: `mypy --strict` —
  "Success: no issues found in 26 source files".
- Verified by grep: no `torch`, `PIL`, `cv2`, `numpy`, `sklearn`, or
  `diffusers` import anywhere under `domain/`, `ports/`, `adapters/`,
  `application/`.
- Files changed/added: `src/curalina_variants/domain/{colour_spec,mask_spec,
  review,commercial_status,variant_candidate}.py`,
  `src/curalina_variants/ports/{colour_transfer,diffusion_refinement}.py`,
  `src/curalina_variants/adapters/{fake_colour_transfer,
  fake_diffusion_refinement}.py`,
  `src/curalina_variants/application/{generate_variants,review_candidate,
  advance_commercial_status}.py`,
  `tests/unit/{test_colour_spec,test_mask_spec,test_variant_candidate,
  test_fake_adapters,test_generate_variants,
  test_review_and_commercial_status}.py`,
  `ai_services/work_packets/VAR-A2-01.md`.
- Explicitly not done, deliberately: no wiring into `api/` (out of scope
  per "Do not change"), no asset-import/hashing logic, no durable job
  storage/worker (A3), no SAM/SDXL/Qwen adapter beyond the labelled fakes,
  no real colour-transfer math of any kind. These remain blocked exactly as
  described above.
