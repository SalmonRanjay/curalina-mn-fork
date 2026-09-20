# Agent work packet

## Task

Service: shared contracts and local suite
Phase: Suite A4, available-service flow
Owner: `contracts-qa-steward`
Reviewer: `code-reviewer`

## Objective

Replace the A0 dry-run suite stub with an HTTP-only runner that starts the
services that have reached A3, verifies the recommendation to variants fixture
flow, and reports rooms as deferred until its A3 storage/worker/render path is
ready.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/04_contracts_suite_and_ui_adapter.md`
- `agentic_flow/contracts_and_suite_workflow.md`
- `ai_services/work_packets/CONTRACTS-SUITE-A0-01.md`
- `agent_instructions/STATUS.md`

## Allowed files

- `ai_services/Makefile`
- `ai_services/suite_client.py`
- `ai_services/tests/**`
- `ai_services/work_packets/CONTRACTS-SUITE-A4-01.md`
- `agent_instructions/STATUS.md`

## Do not change

- Service-local business logic
- Existing TypeScript app paths
- `agentic_flow/**` and `architecture/**`

## Deliverables

- `make -C ai_services run-suite` starts recommendation and variants with
  explicit local environment variables and independent SQLite database files.
- The suite uses only public HTTP endpoints.
- The suite verifies catalogue import, recommendation ranking, bundle
  creation, variant asset import, variant job creation, worker completion, and
  candidate review.
- The suite verifies IDs, revision numbers, and content hashes at service
  boundaries.
- Rooms are reported by name as deferred; no room render is submitted.
- Named failure tests cover occupied-port and contract-field mismatch paths.

## Local commands

```bash
make -C ai_services test-contracts
make -C ai_services run-suite
```

## Acceptance criteria

- Suite runner imports no service packages and reads no service SQLite files.
- Recommendation and variants run with different `CURALINA_DATABASE_URL`
  values.
- `run-suite` exits non-zero with a service/endpoint/field in the message on a
  contract mismatch.
- Rooms are not silently skipped; the output names rooms as deferred.

## Known blockers

- Full recommendation -> variants -> rooms fixture flow waits for rooms full A3
  and supplied catalogue/product imagery. Per the current project direction,
  image and room renders are delayed until the catalogue image set exists.

## Completion evidence

- `make -C ai_services test-contracts` passed: 7 tests.
- `make -C ai_services run-suite` passed after installing declared
  recommendation/variant runtime dependencies and running with loopback bind
  permission.
- Suite output:
  `recommendation->variants flow passed (snapshot=snap_a3fixture0001,
  bundle=bundle_fake_0001@1, variant_job=job_000001, candidate=cand_000001)`.
- Suite output names rooms as deferred.

## Update (item 8 — rooms A4 suite participation, session 14, 2026-09-15)

Rooms (`8103`) was wired into `ai_services/suite_client.py` as a third
uvicorn process, following the exact pattern already established for
recommendation/variants: `ServiceSpec` entry with its own
`rooms.sqlite3` under the shared temp `data_dir`, `_wait_for_service`
health-check against `/openapi.json`, a `_run_rooms_worker` helper mirroring
`_run_variant_worker` (`python3 -m curalina_rooms.bootstrap worker`, nonzero
exit raises a named `SuiteError`), and a new `_rooms_flow` function mirroring
`_variants_flow`'s verification depth. `READY_SERVICES` now lists
`("recommendation", "variants", "rooms")` and `DEFERRED_SERVICES` is empty;
the stale "rooms deferred" print branch was removed from `run_suite()`, and
`dry_run()` now prints `deferred services: none` instead of a bare trailing
`; deferred services: `.

**Rooms leg of the flow, in order:** import a room-photo asset and a
hero-product asset via `POST /v1/assets` (rooms' asset contract is
metadata-only — `content_length`, not raw bytes — so the suite independently
recomputes the `owner_id|original_filename|content_length|upstream_asset_id`
sha256 digest and asserts it matches the service's returned `content_hash`,
same verification shape as variants' asset-bytes hash check) → `POST
/v1/render-jobs` against rooms' single fixture-seeded bundle
(`bundle_liv001@rev_002` — rooms exposes no bundle-listing endpoint, so this
id/revision pair is a named constant in `suite_client.py`, commented as such)
referencing both imported assets and the recommendation-flow `product_id` →
one `_run_rooms_worker` pass → `GET /v1/jobs/{job_id}` asserting
`status == "succeeded"` and extracting `result.candidate_id` (prefix
`cand_`) → `POST /v1/candidates/{candidate_id}/reviews` asserting the
`candidate_id` round-trips and `revision` advances `1 → 2`, matching the
depth already applied to variants' candidate review.

**Bug found and fixed in the same touch, not scoped to rooms specifically:**
`run_suite()` built its `services` list via a single list-comprehension over
`READY_SERVICES`. If any service's `_start_service` (which includes the
occupied-port check) raised partway through, services already started
earlier in the comprehension were never assigned to `services` and were
never reached by the `try/finally` shutdown — they leaked as orphaned
`uvicorn` processes holding their ports. This was always structurally
possible with two services; three services materially raises the odds of
hitting it. Reproduced directly: pre-binding port 8103 and running the
suite left `recommendation` (8101) and `variants` (8102) processes running
after suite exit 2. Fixed by appending to `services` inside the same
`try` block used for the rest of teardown, so any partial start is captured
for cleanup. Reproduced again post-fix: same pre-bound-8103 scenario now
exits 2 with zero processes left listening on 8101/8102/8103.

**Verification (this session, all commands run for real):**

- `make -C ai_services test-contracts` → **10 passed** (was 7; three new
  tests: `test_rooms_flow_verifies_hash_render_and_review_roundtrip`,
  `test_rooms_flow_names_field_on_content_hash_mismatch`,
  `test_dry_run_reports_no_deferred_services`).
- `python3 -m ruff check suite_client.py tests/test_suite_client.py` →
  All checks passed.
- `python3 -m mypy --strict suite_client.py tests/test_suite_client.py` →
  Success: no issues found in 2 source files.
- `make -C ai_services run-suite` →
  `suite: recommendation->variants->rooms flow passed
  (snapshot=snap_a3fixture0001, bundle=bundle_logic_0001@1,
  variant_job=job_000001, variant_candidate=cand_000001,
  room_job=job_000001, room_candidate=cand_000001)`.
- Named-failure check: pre-binding port 8103 and running the suite produced
  `suite error: rooms port 8103 is already occupied; run-suite requires
  explicit local service ownership`, exit code 2, with no leaked
  recommendation/variants processes afterward.

**Scope discipline confirmed:** no changes were made to
`room_generator/src/**`, no `curalina_rooms` internals were imported, no
rooms SQLite file or asset path was opened directly by the suite — every
rooms interaction in `_rooms_flow`/`_rooms_import_asset` goes through
`POST/GET` on `http://127.0.0.1:8103/v1/...`. The rooms worker still runs
the fake `ImageEditor` adapter; no image/room render claim is made anywhere
in this change. `agentic_flow/open_questions.yaml` and all ADRs were left
untouched. Nothing was committed to git per instructions.

**Files changed:** `ai_services/suite_client.py`,
`ai_services/tests/test_suite_client.py`,
`ai_services/work_packets/CONTRACTS-SUITE-A4-01.md`.
