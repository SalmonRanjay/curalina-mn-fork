# REC-A3-02 — map malformed workbook imports

## Task

Service: recommendation  
Phase: A3  
Owner: python-services-engineer  
Reviewer: primary agent

## Objective

Close the single source defect exposed by `REC-A3-01`: malformed workbook
content sent to catalogue import must return a structured HTTP 422
`invalid_request` response instead of an unmapped 500, allowing all A3
done-evidence tests to pass.

## Decision and context

Read:

- `ai_services/work_packets/REC-A3-01.md`
- `agentic_flow/recommendation_workflow.md`, A3
- `ai_services/recommendation/src/curalina_recommendation/api/routes.py`
- `ai_services/recommendation/src/curalina_recommendation/api/errors.py`
- `ai_services/recommendation/src/curalina_recommendation/adapters/xlsx_workbook_reader.py`
- `ai_services/recommendation/src/curalina_recommendation/domain/errors.py`
- `ai_services/contracts/v1/schemas/error.schema.json`

Tech-lead ruling: malformed archive/workbook content is HTTP 422 with code
`invalid_request`, `retryable=false`, and the existing five-field error shape.
The schema defines the shared shape; the semantic mapping is an established
recommendation API vocabulary decision. The `REC-A3-01` rollback test already
meets done-evidence.

## Allowed files

- `ai_services/recommendation/src/curalina_recommendation/api/errors.py`
- `ai_services/recommendation/src/curalina_recommendation/api/routes.py`
- `ai_services/recommendation/src/curalina_recommendation/domain/errors.py`
- `ai_services/recommendation/src/curalina_recommendation/adapters/xlsx_workbook_reader.py`
- `ai_services/recommendation/tests/integration/test_a3_persistence.py`
- recommendation API unit/contract tests only if needed for the same mapping
- `ai_services/work_packets/REC-A3-01.md`
- `ai_services/work_packets/REC-A3-02.md`
- `agent_instructions/STATUS.md` for verified completion status

## Do not change

Importer parsing semantics, schemas/contracts, adapters, dependencies,
notebooks, other services, open questions, or unrelated dirty-worktree files.
Translate only recognized archive/format parsing failures into one typed
domain error, preserving the cause. Do not catch broad `Exception`,
`ValueError`, or `OSError` around the pipeline. Missing files, permission
failures, repository failures and programming errors must remain server
errors. Do not expose parser exception text or local paths.

## Acceptance and verification

- The enabled malformed-workbook integration regression passes with status
  422, code `invalid_request`, `retryable=false`, nonempty request ID, and
  useful non-sensitive details.
- Use the ruled response message `Catalogue source is not a valid XLSX
  workbook.` and details `{"field": "source_uri", "reason":
  "malformed_workbook"}`.
- Assert malformed import leaves snapshot state unchanged, and a repository
  failure remains outside the malformed-input mapping.
- Add focused coverage for the exact exception mapping if the integration test
  alone does not cover all introduced branches.
- Repository rollback and restart tests remain passing.
- Run `make test-integration`, `make test`, `make test-contract`, `make lint`,
  and `make typecheck` from `ai_services/recommendation` and record results.
- Stop after this mapping; no A4, UI adapter, R03/model, or stage-gate work.

## Completion evidence

Completed on 2026-09-14.

Files changed:

- `src/curalina_recommendation/domain/errors.py`
- `src/curalina_recommendation/adapters/xlsx_workbook_reader.py`
- `src/curalina_recommendation/api/errors.py`
- `src/curalina_recommendation/api/routes.py`
- `tests/integration/test_a3_persistence.py`
- `ai_services/work_packets/REC-A3-01.md`
- this packet
- `agent_instructions/STATUS.md`

Implemented behavior:

- Recognized XLSX archive/format failures (`BadZipFile` and openpyxl's
  `InvalidFileException`) become `MalformedWorkbookError` with the original
  exception preserved as its cause.
- FastAPI maps only that typed error to HTTP 422 `invalid_request`, the ruled
  message and details, `retryable=false`, and a nonempty request ID. Parser
  text and local paths are not exposed.
- The malformed-workbook regression verifies the full response and unchanged
  snapshot row count. A separate regression drops the snapshot table and
  proves a repository failure remains an ordinary HTTP 500.
- The rollback and restart tests from `REC-A3-01` remain passing.

Commands run from `ai_services/recommendation` and actual results:

- `make test-integration` — passed: 4 tests.
- `make test` — passed: 259 tests, 91% aggregate branch coverage.
- `make test-contract` — passed: 17 tests.
- `make lint` — initially found one import-order issue in the workbook reader;
  after correcting it, passed with `All checks passed!`.
- `make typecheck` — passed: no issues in 54 source files.
- Integration suite with branch coverage — passed: 4 tests;
  `adapters/xlsx_workbook_reader.py` 55%, `api/errors.py` 68%,
  `api/routes.py` 85%, and `api/repository.py` 91% in the focused run. The
  normal unit suite covers the workbook reader at 90%.

All recommendation A3 named integration cases and prescribed checks now pass,
so A3 done-evidence is complete. No A4, UI-adapter, R03/model, open-question,
contract-schema, or stage-gate work was performed or claimed. The test runs
retain the environment's existing FastAPI/Starlette deprecation warnings; the
focused coverage run also reports SQLite `ResourceWarning`s from failed HTTP
request cleanup, without test failures.
