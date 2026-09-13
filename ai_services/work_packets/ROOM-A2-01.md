# Agent work packet

## Task

Service: `curalina_rooms`
Phase: A2 (fake-adapter scope only)
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Implement `domain/`, `ports/`, `adapters/` and `application/` for the
room-generator service, restricted to the parts of A2 that do not depend on
G01 (room-prep/homography notebook) or on resolving `OQ-010` (room
geometry/measurement source): typed domain records (render-job state with
three separate fields, a `RenderPlan` that wraps `curalina_design_rules`'s
`StyledRoom` directly, post-render validation result types), the
`RoomPrepAdapter` and `GroundedGenerationAdapter` ports, deterministic fake
implementations of both, and application use cases that wire them together
at a level testable now. No real homography/geometry-extraction math, real
image compositing, or SDXL/ControlNet/IP-Adapter generation is implemented.

## Context

Required guides:

- `agent_instructions/03_room_generator_service.md`
- `agentic_flow/14_room_generation_technical_design.md` — central design
  reference (renderer "photographs" a `StyledRoom`; composite-then-
  harmonize approach; homography/layout-to-image projection; post-render
  validation types).
- `architecture/guides/06_room_generation.md` — module layout, agent build
  order, evaluation/test discipline.
- `agentic_flow/room_generator_workflow.md` (A2 section) — mandatory unit
  test list and boundaries.
- `agentic_flow/00_agentic_workflow_overview.md` — gate legend; A0/A1/fake-
  adapter-A2 need no notebook evidence, real-logic A2 does.
- `ai_services/design_rules/src/curalina_design_rules/api.py` and
  `pipeline/types.py` — the consumer API and `StyledRoom`/`ValidatedLayout`/
  `NormalizedRoom` types this service consumes directly (A0–A3 complete for
  that service).
- `ai_services/work_packets/ROOM-A1-01.md` — prior phase, house style.

Input data, fixtures or decisions:

- No customer photos, no real room measurements, no model weights. All
  test data is fabricated fixture data built by `tests/unit/factories.py`
  (a fixture `StyledRoom`, `NormalizedRoom`, `RenderRequest`, etc.),
  labelled as fixtures throughout, never presented as real scenes.
- `curalina_design_rules` is added as this service's one permitted shared
  dependency (`pyproject.toml`); `make setup` now installs it in editable
  mode from `../design_rules` first, since it has no PyPI release.

## Allowed files

- `ai_services/room_generator/src/curalina_rooms/{domain,ports,adapters,application}/**`
- `ai_services/room_generator/tests/unit/**`
- `ai_services/room_generator/pyproject.toml` (added the
  `curalina-design-rules` dependency only)
- `ai_services/room_generator/Makefile` (added the `../design_rules`
  editable install step to `setup` only)
- `ai_services/work_packets/ROOM-A2-01.md`

## Do not change

- `ai_services/room_generator/src/curalina_rooms/api/**` — done in A1 and
  realigned to shared schemas this session; untouched here except that
  `application/` now exists for a future, small wire-through (not built in
  this packet — see Known blockers/Deferred).
- `ai_services/room_generator/src/curalina_rooms/workers/**` (A3 scope)
- `ai_services/room_generator/tests/{contract,integration,worker}/**`
  (unchanged; re-run as regression checks only)
- Other service packages, `agentic_flow/**`, `architecture/**`,
  `agent_instructions/**`

## Deliverables

- Domain (`src/curalina_rooms/domain/`): `geometry.py` (`BoundingBox` —
  image-space box math only, not homography estimation), `room_prep.py`
  (`ProtectedRegion(Kind)`, `RoomPrepRequest`, `RoomPrepResult` — wraps
  `curalina_design_rules.NormalizedRoom`; `measurement_certified` is
  hard-pinned to `False`, citing OQ-010, in `__post_init__`),
  `render_request.py` (`ReferenceAssetInfo`, `RenderRequestInstance`,
  `RenderRequest`, `VisibilityExpectation`, `VariantReviewStatus`),
  `render_plan.py` (`PlannedInsertion`, `RenderPlan` — wraps
  `curalina_design_rules.StyledRoom` directly), `render_job.py`
  (`JobStatus`, `CandidateReviewStatus`, `CommercialAvailability`,
  `RenderJobState` — three independent fields, never collapsed),
  `generation_outcome.py` (`GenerationOutcome`), `validation.py`
  (`Verdict` incl. `NOT_EVALUATED`, `InstanceValidation`,
  `ArchitectureValidation`, `RoomValidationResult`), `errors.py` (domain
  error hierarchy for every named A2 failure mode).
- Ports (`src/curalina_rooms/ports/`): `room_prep.py`
  (`RoomPrepAdapter` — docstring names its G01/OQ-010 blockers),
  `grounded_generation.py` (`GroundedGenerationAdapter` — docstring names
  its G01/G02 blockers), `clock.py` (`Clock`, for deterministic timestamps
  later).
- Adapters (`src/curalina_rooms/adapters/`): `fake_room_prep.py`
  (`FakeRoomPrepAdapter` — canned `NormalizedRoom`, `source=FAKE_FIXTURE`,
  `measurement_certified=False`), `fake_grounded_generation.py`
  (`FakeGroundedGenerationAdapter` — deterministic placeholder
  `asset_fake_...` reference, no image generated), `fake_clock.py`
  (`FixedClock`).
- Application (`src/curalina_rooms/application/`): `validate_render_request.py`
  (pure validation → typed domain errors), `plan_rendering.py`
  (`build_render_plan`, `NEGATIVE_CONSTRAINTS`), `generate_room.py`
  (`generate_room` — bounded attempts via `GroundedGenerationAdapter`,
  `MaxAttemptsExceededError`), `evaluate_room.py` (`evaluate_room` — always
  returns `NOT_EVALUATED` verdicts citing `G01`/`G02`, never fabricates
  `PASS`), `review_room.py` (`review_room`,
  `ReviewVersionConflictError` — version-checked, never touches
  `commercial_availability`).
- Tests: `tests/unit/factories.py` (shared builders) plus 13 test modules
  covering every item in the workflow doc's A2 mandatory list (see Local
  commands/Acceptance criteria below for the mapping).
- Docs/report/ADR: this packet.

## Local commands

Required before completion:

```bash
make -C ai_services/room_generator setup
make -C ai_services/room_generator test
make -C ai_services/room_generator lint
make -C ai_services/room_generator typecheck
```

Optional slow commands:

```bash
make -C ai_services/room_generator test-contract
make -C ai_services/room_generator test-integration
make -C ai_services/room_generator test-worker
```

## Acceptance criteria

- Job success, candidate review, and commercial availability are three
  independent fields on `RenderJobState`, individually assertable and never
  derivable from one another — `test_render_job_state.py`.
- `RenderPlan` wraps `curalina_design_rules.StyledRoom` directly (imported,
  not re-typed) — `curalina_rooms/domain/render_plan.py` and
  `tests/unit/factories.py::make_styled_room`.
- Post-render validation types exist and default to `Verdict.NOT_EVALUATED`
  with a cited blocking gate (`G01` architecture, `G02` identity); no path
  in this phase can produce a fabricated `PASS` — `test_evaluate_room.py`,
  `test_validation_types.py`.
- `RoomPrepResult.measurement_certified` cannot be constructed as `True`
  regardless of `source` — `test_room_prep.py`.
- Every mandatory unit test named in `agentic_flow/room_generator_workflow.md`'s
  A2 section is present: missing reference
  (`test_missing_reference_asset_is_rejected`), mismatched variant parent
  (`test_mismatched_variant_parent_is_rejected`), unsupported schema
  (`test_unsupported_schema_version_is_rejected`), invalid mask coordinates
  (`test_geometry.py::test_bounding_box_rejects_invalid_mask_coordinates`
  — enforced at construction, a stronger guarantee than a downstream
  check), protected-opening overlap
  (`test_protected_opening_overlap_is_rejected`), intentional quantity two
  (`test_intentional_quantity_two_is_accepted`), duplicate instance IDs
  (`test_duplicate_instance_ids_are_rejected`,
  `test_render_plan_rejects_duplicate_instance_ids`), rejected-variant
  import (`test_rejected_variant_import_is_rejected`), stale bundle
  revision (`test_stale_bundle_revision_is_rejected`), maximum attempts
  exceeded (`test_generate_room_raises_when_max_attempts_exceeded`),
  immutable input snapshots
  (`test_render_request_is_an_immutable_input_snapshot`,
  `test_render_plan_is_an_immutable_input_snapshot`).
- Fake adapters are deterministic (same input → equal output, checked by
  dataclass equality) and clearly labelled as fake in both code and
  docstrings — `test_fake_adapters.py`.
- `mypy --strict` and Ruff are clean over `src/curalina_rooms`.
- Domain and application coverage is 100% line/branch on this phase's new
  modules (`make test`'s coverage report); overall package branch coverage
  is 86%, comfortably above the >=85% floor.
- No import of, or reference to, another service's package or SQLite file;
  `curalina_design_rules` remains the only shared import.

## Known blockers

- **G01 (room-prep/homography notebook) has not been run.** Real
  homography estimation
  (`agentic_flow/14_room_generation_technical_design.md`'s
  `estimate_floor_homography`), real protected-region mask derivation from
  a photo, and real room-geometry normalization are out of scope and
  blocked until that notebook has a frozen, reviewed run. `RoomPrepAdapter`
  and `FakeRoomPrepAdapter` exist only to make `application/` and A3
  testable now; `FakeRoomPrepAdapter` returns a canned fixture room and
  says so in its docstring.
- **`OQ-010` (room geometry/measurement source) is a second, independent
  blocker.** Even once G01 clears, a single customer photo cannot certify
  real-world dimensions on its own
  (`architecture/guides/10_source_audit.md`). This packet enforces that at
  the type level: `RoomPrepResult.__post_init__` raises if
  `measurement_certified=True` is ever passed, for any `source` including
  `CUSTOMER_CONFIRMED`, until `OQ-010` has a recorded resolution. No test
  or fixture in this packet claims a certified measurement.
- **G02 (one-hero-product identity preservation) has not been run.**
  `GroundedGenerationAdapter`'s real implementation (composite-then-
  harmonize or ControlNet-conditioned generation) is blocked on it, and
  `evaluate_room`'s per-instance validation is honestly `NOT_EVALUATED`
  rather than fabricating a `PASS`/`FAIL` verdict.
- **Deferred, not blocked:** wiring `application/` into `api/` (so
  `POST /v1/render-jobs` actually calls `validate_render_request` →
  `build_render_plan` → `generate_room`) is left for A3, which is where the
  durable job/worker split and the ASGI transport are built together — a
  synchronous call from a request handler into these use cases today would
  violate "Image APIs enqueue a durable job... never inference in a
  request handler." `application/generate_room.py`'s docstring says this
  explicitly.
- **Not attempted:** depth-sorted occlusion ordering for `PlannedInsertion`
  (needs real geometry, G01); real overlap-derived protected-opening
  coordinates from an actual photo (this packet's box-overlap check is
  pure math on already-supplied coordinates, exercised with fixture boxes,
  never derived by this service via computer vision).

## Completion evidence

Files changed (all new unless noted, all inside the allowed-files list):

- `ai_services/room_generator/src/curalina_rooms/domain/{geometry,room_prep,render_request,render_plan,render_job,generation_outcome,validation,errors}.py`
  and `domain/__init__.py` (updated to export the above)
- `ai_services/room_generator/src/curalina_rooms/ports/{room_prep,grounded_generation,clock}.py`
  and `ports/__init__.py` (updated)
- `ai_services/room_generator/src/curalina_rooms/adapters/{fake_room_prep,fake_grounded_generation,fake_clock}.py`
  and `adapters/__init__.py` (updated)
- `ai_services/room_generator/src/curalina_rooms/application/{validate_render_request,plan_rendering,generate_room,evaluate_room,review_room}.py`
  and `application/__init__.py` (updated)
- `ai_services/room_generator/pyproject.toml` (added the
  `curalina-design-rules` dependency, with a comment explaining the
  editable-install expectation)
- `ai_services/room_generator/Makefile` (`setup` now installs
  `../design_rules` in editable mode before this package)
- `ai_services/room_generator/tests/unit/factories.py` (shared builders)
  and 13 new test modules: `test_geometry.py`, `test_room_prep.py`,
  `test_render_request_validation.py`, `test_render_plan.py`,
  `test_render_job_state.py`, `test_fake_adapters.py`,
  `test_generate_room_use_case.py`, `test_evaluate_room.py`,
  `test_review_room.py`, `test_plan_rendering.py`,
  `test_validation_types.py`, `test_generation_outcome.py`,
  `test_domain_invariants.py`
- `ai_services/work_packets/ROOM-A2-01.md` (this file)

Command results (run from `ai_services/room_generator`, in a venv with both
`curalina-design-rules` and this package installed in editable mode; no
GPU, no internet, no model weights):

- `make test`: **57 passed**. Coverage report: every new `domain/` and
  `application/` module at 100% line and branch coverage
  (`geometry.py`, `room_prep.py`, `render_request.py`, `render_plan.py`,
  `render_job.py`, `generation_outcome.py`, `validation.py`, `errors.py`,
  `validate_render_request.py`, `plan_rendering.py`, `generate_room.py`,
  `evaluate_room.py`, `review_room.py`); every new `ports/` and
  `adapters/` module at 100%; package-wide total (including `api/`, which
  the unit suite doesn't exercise by design — that's the contract suite's
  job) is 86% branch coverage, 740 statements, 95 missed, all missed lines
  in `api/errors.py`, `api/fixtures/__init__.py` and `api/service.py`
  (A1 code, exercised by `test-contract` instead).
- `make lint` (`ruff check --no-cache .`): **no issues**, across
  `src/curalina_rooms` and `tests/`.
- `make typecheck` (`mypy --strict src/curalina_rooms`): **Success: no
  issues found in 32 source files.**
- `make test-contract`: **32 passed**, unchanged from A1 — confirms A2 did
  not disturb the API layer.
- `make test-integration`: **1 passed** (unchanged placeholder).
- `make test-worker`: **1 passed** (unchanged placeholder).
- Combined `pytest tests/unit tests/contract --cov=curalina_rooms
  --cov-branch`: **89 passed**, 95% total branch coverage,
  `src/curalina_rooms/api/service.py` at 99% (one partial branch, same one
  A1 recorded and explained: exercised in every path that reaches it).

Per-phase done-evidence (from `agentic_flow/room_generator_workflow.md`'s
A2 row): **partially met, by design.** "Unit + contract tests pass with
the fake adapter" — met (`make test` and `make test-contract` both pass).
"Render-plan construction correctly enumerates multiple instances of one
product" — met (`test_intentional_quantity_two_is_accepted`). The row's
step 5 ("Real one-product experiments only after G01/G02") and step 6
("bounded multi-product rendering only after one-product identity
preservation clears its own gate") are explicitly **not attempted** here —
they require gates this packet does not have.

No stage gate (G1/G2, per `09_delivery_gates.md`) is claimed. `G01`, `G02`
and `OQ-010` all remain open and are cited by name at every point in the
code where their absence changes what this service is allowed to claim
(`RoomPrepAdapter`, `GroundedGenerationAdapter`, `RoomPrepResult.
measurement_certified`, and every `Verdict.NOT_EVALUATED` result).
