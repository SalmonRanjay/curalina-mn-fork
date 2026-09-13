# Agent work packet

## Task

Service: `curalina_variants`
Phase: A1 contracts
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Implement the `/v1` contract layer for the variant-generator service: typed
DTOs and JSON fixtures for `VisualVariant`/`Asset`/`Mask` records and the
job-lifecycle endpoints, a shared error vocabulary, and contract tests that
exercise the job state machine and idempotency behaviour with a
fixture-backed fake store. No real image decoding, mask math, model
inference, durable persistence, or worker process — those are A2/A3.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/02_variant_generator_service.md`
- `architecture/guides/03_data_contracts.md`
- `agentic_flow/variant_generator_workflow.md` (A1 section)
- `ai_services/contracts/v1/CONTRIBUTING.md`
- `ai_services/contracts/v1/id_versioning.md`

## Allowed files

- `ai_services/variant_generator/src/curalina_variants/api/**`
- `ai_services/variant_generator/tests/contract/**`
- `ai_services/contracts/v1/schemas/**` (additive only)
- `ai_services/work_packets/VAR-A1-01.md`

## Do not change

- `domain/`, `application/`, `ports/`, `adapters/`, `workers/`, `settings.py`,
  `bootstrap.py` — later phases
- `pyproject.toml` / `requirements.lock` — no new runtime dependency was
  needed; see "Design decision" below
- Existing TypeScript app paths, other service packages
- `ai_services/contracts/v1/CONTRIBUTING.md`, `id_versioning.md`,
  `error.schema.json` (read, not edited)
- `agentic_flow/**`, `architecture/**`, and `agent_instructions/**`

## Deliverables

- `api/errors.py`: `ErrorBody` (`code, message, details, retryable,
  request_id`) and `ApiError`, matching
  `ai_services/contracts/v1/schemas/error.schema.json` exactly, plus
  constructors for every error case this packet exercises (unsupported
  version, validation, not-found, idempotency conflict, revision conflict,
  payload-too-large, invalid state transition).
- `api/schemas.py`: frozen Pydantic v2 DTOs for `AssetRecord`, `MaskRecord`,
  `VisualVariant`, `JobRecord`, `CandidateRecord`, `ReviewRecord`, their
  request bodies, and the job state machine
  (`queued -> running -> succeeded/failed/cancelled`) as an explicit
  transition table (`ALLOWED_JOB_TRANSITIONS`).
- `api/store.py`: `FakeJobStore`, an in-memory fixture-backed fake covering
  asset upload/content, variant-job creation with idempotency-key semantics,
  job cancellation, and version-checked candidate review. Explicitly not a
  persistence layer — no SQLite, no `ports`/`adapters` involvement.
- `api/handlers.py`: plain-callable request handlers (`create_asset`,
  `get_asset_content`, `create_variant_job`, `get_job`, `cancel_job`,
  `create_review`) that validate `schema_version`, turn pydantic
  `ValidationError` into structured 422s (never a 500), and dispatch to the
  fake store.
- `api/fixtures/`: JSON fixtures (`create_asset_request`,
  `create_variant_job_request`, `create_review_request`,
  `unsupported_version_variant_job_request`,
  `missing_field_variant_job_request`) plus a loader module.
- `ai_services/contracts/v1/schemas/{asset,mask,visual_variant,job,candidate,review}.schema.json`:
  additive JSON Schema definitions for the new record types, in the same flat
  layout as the existing `error.schema.json`.
- `tests/contract/test_contract_scaffold.py`: replaced the A0 placeholder
  with 24 contract tests (see below).

## Design decision: no ASGI framework in A1

The brief pins FastAPI for the service, but A1's own scope statement is
"Contracts" — DTOs, fixtures, and fixture-backed fake job responses — while
`agentic_flow/variant_generator_workflow.md`'s A3 section is explicitly
titled "API and worker" and owns "loopback API on 8102". Neither `fastapi`
nor `httpx` is installed in this environment (`pip show` confirms), and
installing them requires network access this packet did not request. Adding
an ASGI app now would also mean either leaving it unwired (dead weight) or
prematurely doing A3's job. So the contract layer here is expressed as plain
Python callables (`handlers.py`) operating on Pydantic DTOs, with status
codes and headers modeled explicitly in `ApiResponse`. This keeps A1 fully
decoupled from A3's transport choice while still testing status codes,
headers (`Location`), and the error/job-lifecycle contract precisely.
`pyproject.toml` was therefore left untouched. Flagging this for the
reviewer: A3 should confirm FastAPI wiring reuses these DTOs/handlers rather
than re-deriving the contract.

## Local commands

```bash
make -C ai_services/variant_generator test-contract
make -C ai_services/variant_generator lint
make -C ai_services/variant_generator typecheck
```

## Acceptance criteria

- Error body shape is exactly `code, message, details, retryable,
  request_id` and matches `error.schema.json` field-for-field.
- `schema_version` other than major `1` (including non-string, non-`x.y`, and
  numeric-major-mismatch payloads) is rejected with `422` and code
  `unsupported_schema_version`, before field-level validation runs.
- A missing required field produces a structured `422` (`validation_error`)
  with a populated `details.errors` list — never an unhandled/500-shaped
  exception.
- Oversized asset upload (>16 MiB fixture-level cap) returns `413`.
- Job state machine only allows `queued -> running ->
  {succeeded,failed,cancelled}` and `queued -> cancelled`; every other
  transition raises `invalid_state_transition` (`409`).
- Same idempotency key + same payload returns the original job unchanged;
  same key + changed payload returns `409` (`idempotency_conflict`).
- `POST /v1/variant-jobs` response models a `202` with a `Location` header
  pointing at `/v1/jobs/{job_id}`.
- Review against a stale `expected_revision` returns `409`
  (`revision_conflict`); review against an unknown candidate returns `404`.
- Approving a candidate flips `review_status` only — `commercial_status`
  stays `conceptual`, proving approval alone is never purchasability.
- `AssetRecord` never serializes a storage key.

## Known blockers

- None specific to A1. The service-wide blocker (no upholstery product
  photos, so V01 cannot start) is unaffected by and does not block this
  contract-only phase.

## Completion evidence

- `make -C ai_services/variant_generator test-contract` passed: 24 contract
  tests, 0 failures.
- Coverage check (informational; the `test-contract` Makefile target runs
  with `--no-cov` by convention, so this was run manually):
  `pytest tests/contract --cov=curalina_variants.api --cov-branch` reported
  **94% branch coverage** on `curalina_variants.api`, with `errors.py`,
  `schemas.py`, `handlers.py` and `fixtures/__init__.py` at 100% and
  `store.py` at 98% (one uncovered defensive branch: `_transition`'s
  internal "impossible transition" guard, which no current call path can
  trigger since every public method checks `ALLOWED_JOB_TRANSITIONS` before
  calling it).
- `make -C ai_services/variant_generator lint` passed: `ruff check` reports
  "All checks passed!".
- `make -C ai_services/variant_generator typecheck` passed: `mypy --strict`
  reports "Success: no issues found in 14 source files" (`src/curalina_variants`).
- `make -C ai_services/variant_generator test` (unit), `test-integration`,
  and `test-worker` still pass (4, 1, 1 tests respectively) — A0's scaffold
  tests are unaffected.
- Explicitly verified as *not* done, deliberately: unsupported-major-version
  rejection is tested with four shapes (`"not-a-version"`, `"one.0"`,
  integer `2`, and `None`), not just one string case; a missing-field case is
  asserted to raise `ApiError` (422) rather than propagate as an unhandled
  exception, by construction (`_validated` in `handlers.py` catches
  `pydantic.ValidationError` and re-raises as `validation_error`).
- Files changed: `ai_services/variant_generator/src/curalina_variants/api/{errors,schemas,store,handlers}.py`,
  `ai_services/variant_generator/src/curalina_variants/api/fixtures/{__init__.py,*.json}`,
  `ai_services/variant_generator/tests/contract/test_contract_scaffold.py`,
  `ai_services/contracts/v1/schemas/{asset,mask,visual_variant,job,candidate,review}.schema.json`,
  `ai_services/work_packets/VAR-A1-01.md`.
- No image processing, mask math, model loading, SQLite/durable persistence,
  ASGI wiring, or worker execution logic was added — confirmed by grep (no
  `torch`, `PIL`, `cv2`, `sqlalchemy`, `fastapi` imports anywhere under
  `src/curalina_variants/api/`).
