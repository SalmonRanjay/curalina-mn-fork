# Agent work packet

## Task

Service: `curalina_rooms`
Phase: A1 contracts
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Implement the `/v1` contract surface for the room-generator service as
typed DTOs, JSON fixtures, and a fixture-backed fake contract service:
`POST /v1/assets`, `POST /v1/render-jobs`, `GET /v1/jobs/{id}`,
`POST /v1/jobs/{id}/cancel`, `POST /v1/candidates/{id}/reviews`, and
`GET /v1/assets/{id}/content`. No rendering, homography, model loading, or
real durable-job execution — that is A2/A3.

## Context

Required guides:

- `agent_instructions/03_room_generator_service.md`
- `architecture/guides/03_data_contracts.md`
- `agentic_flow/room_generator_workflow.md` (A1 section)
- `ai_services/contracts/v1/CONTRIBUTING.md` and `id_versioning.md`
- `ai_services/work_packets/ROOM-A0-01.md` (prior phase, house style)

Input data, fixtures or decisions:

- `ai_services/contracts/v1/schemas/error.schema.json` — the shared error
  shape this service's `ErrorResponse` DTO must match field-for-field.
- Fixture data invented for A1 only (fake bundle revision `bundle_liv001`,
  fake seeded assets/candidate) — no real customer data, no model output.

## Allowed files

- `ai_services/room_generator/src/curalina_rooms/api/**`
- `ai_services/room_generator/tests/contract/**`
- `ai_services/work_packets/ROOM-A1-01.md`

## Do not change

- `ai_services/room_generator/src/curalina_rooms/{domain,application,ports,adapters,workers}/**`
  (untouched — later phases)
- `ai_services/contracts/v1/**` (read for conventions; no changes made —
  the CONTRIBUTING.md note that "services own fixtures for their own
  endpoints during A1" meant endpoint fixtures stay in this service's own
  `api/fixtures/`, not in the shared contracts folder)
- Other service packages, `agentic_flow/**`, `architecture/**`,
  `agent_instructions/**`

## Deliverables

- Contract fixtures: `src/curalina_rooms/api/fixtures/*.json` — bundle
  snapshot seed, seeded assets, seeded candidate, valid/invalid request
  bodies for render-job creation (valid, stale bundle revision, missing
  reference image, unsupported schema version, missing required field),
  asset import, and candidate review.
- Domain/application code: none (out of scope for A1 by design).
- API/worker code: `src/curalina_rooms/api/schemas.py` (typed Pydantic v2
  DTOs for every `/v1` record — asset, render job, job status/cancel,
  candidate review, and the shared error shape), `src/curalina_rooms/api/errors.py`
  (`ContractError` plus one factory per failure mode: unsupported schema
  version, malformed request, stale bundle revision, unknown bundle,
  missing reference image, resource not found, review version conflict),
  `src/curalina_rooms/api/service.py` (`RoomsContractService`, a
  fixture-seeded, in-memory fake implementing every A1 endpoint's
  validation and response shape; returns a `ContractResult(http_status,
  body, headers)` so a later ASGI layer in A3 can wrap it directly), and
  `src/curalina_rooms/api/fixtures/__init__.py` (fixture loader).
- Tests: `tests/contract/test_render_jobs_contract.py`,
  `test_assets_contract.py`, `test_candidate_reviews_contract.py`,
  `test_id_and_version_conventions_contract.py`, and
  `test_contract_scaffold.py` (replaced its A0 placeholder with a real
  error-schema-parity assertion since A1 is no longer "the placeholder
  phase").
- Docs/report/ADR: this packet.

## Local commands

Required before completion:

```bash
make -C ai_services/room_generator test-contract
make -C ai_services/room_generator lint
make -C ai_services/room_generator typecheck
```

Optional slow commands:

```bash
make -C ai_services/room_generator test
make -C ai_services/room_generator test-integration
make -C ai_services/room_generator test-worker
```

## Acceptance criteria

- Every `/v1` endpoint named in the workflow doc's A1 section has a typed
  request/response DTO and at least one fixture.
- `ErrorResponse` matches `error.schema.json`'s required-field list and
  order exactly: `code, message, details, retryable, request_id`.
- Unsupported major `schema_version` (e.g. `"2.0"`) is rejected with `422`
  on every mutating endpoint, not just render-jobs.
- A missing required field produces a structured `400 malformed_request`
  error carrying the pydantic validation errors in `details`, never an
  unhandled exception / 500.
- A render-job request referencing a stale bundle revision returns `409
  stale_bundle_revision` (current vs. requested revision both in
  `details`).
- A render-job request referencing a reference image asset that was never
  imported via `POST /v1/assets` returns `422 missing_reference_image` —
  the service never substitutes or guesses a replacement asset.
- Candidate reviews are version-checked: a stale `expected_review_version`
  returns `409 review_version_conflict`; a rejection after an approval
  creates a new review record (version 3) without rewriting the earlier
  approved record (version 2) — matching the contract guide's "a rejection
  does not rewrite job history" rule applied to candidate reviews.
- IDs use the documented prefixes (`job_`, `asset_`, `cand_`) and content
  hashes are `sha256:` plus 64 lowercase hex characters.
- `mypy --strict` and Ruff are clean over `src/curalina_rooms`.
- No import of, or reference to, another service's package or SQLite file.

## Known blockers

- `OQ-010` (room geometry/measurement source) does not block A1 — no
  geometry or scale claim is made anywhere in this phase's contracts.
- The `POST /v1/assets` DTO (`AssetImportRequest`) models only the JSON
  metadata that accompanies a multipart upload (ownership, filename,
  media type, size, provenance); it does not attempt to model multipart
  file bytes as a JSON fixture. A3, which stands up the real ASGI
  transport, will need to decide the multipart-parsing boundary — flagging
  this now rather than inventing an upload-bytes fixture that would be
  fiction.
- `GET /v1/assets/{id}/content` is modeled as returning authorized content
  *metadata* (a `content_ref`, never a raw filesystem path) rather than
  literal bytes, since no real storage adapter exists until A2/A3.

## Completion evidence

Files changed (all new, all inside the allowed-files list):

- `ai_services/room_generator/src/curalina_rooms/api/schemas.py`
- `ai_services/room_generator/src/curalina_rooms/api/errors.py`
- `ai_services/room_generator/src/curalina_rooms/api/service.py`
- `ai_services/room_generator/src/curalina_rooms/api/__init__.py` (updated
  to export `ContractError`, `ContractResult`, `RoomsContractService`)
- `ai_services/room_generator/src/curalina_rooms/api/fixtures/__init__.py`
  and 10 JSON fixture files under the same directory
- `ai_services/room_generator/tests/contract/test_contract_scaffold.py`
  (replaced placeholder assertion)
- `ai_services/room_generator/tests/contract/test_render_jobs_contract.py`
- `ai_services/room_generator/tests/contract/test_assets_contract.py`
- `ai_services/room_generator/tests/contract/test_candidate_reviews_contract.py`
- `ai_services/room_generator/tests/contract/test_id_and_version_conventions_contract.py`
- `ai_services/work_packets/ROOM-A1-01.md` (this file)

Command results (all run from `ai_services/room_generator`, no GPU/internet
involved, all against the fake fixture-backed service):

- `make test-contract` passed: **26 tests**, 0 failures — covers valid
  render-job creation (202 + `Location`), stale bundle revision (409),
  missing reference image (422), unsupported schema version (422 on both
  render-jobs and asset import), missing required field (400, both
  endpoints), unknown bundle (404), full job lifecycle (create → get →
  cancel → get again shows `cancelled`), unknown job get/cancel (404),
  asset import (201, deterministic content hash for identical payloads),
  asset content lookup (200 / 404), an imported asset immediately usable as
  a render-job reference image, candidate review accept (201, version
  2), stale review version (409), unknown candidate (404), a rejection
  after an approval producing a new version-3 record without mutating the
  version-2 record, and error-shape/ID-prefix/version-convention parity
  with `ai_services/contracts/v1/`.
- `make test` passed: 4 unit tests (unchanged A0 scaffold tests), 100%
  line coverage on non-`api` scaffold modules; `api/` coverage is exercised
  by the contract suite, not the unit suite, by design.
- Combined run (`pytest tests/unit tests/contract --cov=curalina_rooms
  --cov-branch`): **30 passed**, **99% branch coverage** over the whole
  package (`api/errors.py`, `api/fixtures`, `api/schemas.py` at 100%;
  `api/service.py` at 99%, one partial branch on a for-loop exit that is
  exercised in every test path that reaches it — the fixtures always
  supply at least one reference image).
- `make test-integration` and `make test-worker` still pass (1 placeholder
  test each, untouched — A2/A3 scope).
- `make lint` passed: `ruff check .` reports no issues.
- `make typecheck` passed: `mypy --strict src/curalina_rooms` reports no
  issues across 13 source files.
- No rendering, homography, model loading, worker execution, or real job
  persistence logic was added; `domain/`, `application/`, `ports/`,
  `adapters/`, and `workers/` are byte-identical to A0.

Per-phase done-evidence (from `agentic_flow/room_generator_workflow.md`'s
A1 row): **met** — "contract tests cover a request referencing a stale
bundle revision (409) and a request missing a required reference image
(422 or needs-input, not a silent guess)" is satisfied by
`test_stale_bundle_revision_returns_409` and
`test_missing_reference_image_returns_422_not_a_silent_guess` in
`tests/contract/test_render_jobs_contract.py`.

No stage gate is claimed here (A1 makes no rendering, model, or
acceptance-threshold claim); `OQ-010` remains open and unaffected by this
phase.
