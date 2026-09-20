# REC-A3-01 — recommendation A3 integration evidence

## Task

Service: recommendation  
Phase: A3  
Owner: python-services-engineer  
Reviewer: primary agent

## Objective

Replace the integration placeholder with real temporary-SQLite tests for
repository rollback, process restart, and malformed-workbook import, closing
dispatch item 3 only if all A3 done-evidence is satisfied.

## Context

Read these exact sources before editing:

- `agent_instructions/01_recommendation_service.md`
- `agent_instructions/STATUS.md`, operational reference item 3
- `agentic_flow/recommendation_workflow.md`, A3
- `agentic_flow/AMENDMENTS.md`, relevant recommendation corrections
- `ai_services/recommendation/src/curalina_recommendation/api/repository.py`
- `ai_services/recommendation/src/curalina_recommendation/api/routes.py`
- `ai_services/recommendation/src/curalina_recommendation/api/application_services.py`
- `ai_services/contracts/v1/schemas/error.schema.json` and the relevant catalogue schemas

Use only synthetic workbooks created under `tmp_path` and real temporary SQLite
files. No customer data, internet, model downloads, or current-app database.
No open question is resolved or changed by this packet.

## Allowed files

- `ai_services/recommendation/tests/integration/test_integration_scaffold.py`
- `ai_services/recommendation/tests/integration/test_a3_persistence.py`
- `ai_services/work_packets/REC-A3-01.md`
- `agent_instructions/STATUS.md` for verified completion status only

## Do not change

- `ai_services/recommendation/src/**`
- contracts, dependencies, notebooks, other services, and open questions
- existing unrelated changes in the dirty worktree

A source change needed to make a named case testable is an implementation
ambiguity: stop and escalate to the tech lead instead of refactoring.

## Deliverables and named tests

1. Repository rollback: inject a deterministic failure during a real
   multi-statement SQLite write and prove no partial row remains after a new
   repository instance opens the same file.
2. Process restart: create durable state through one repository/app instance,
   construct a second instance against the same SQLite file, and prove the
   snapshot, bundle, rule version, and subsequent public operation survive.
3. Malformed workbook import: exercise the catalogue-import HTTP endpoint with
   the real workbook importer and a synthetic malformed `.xlsx`; assert the
   exact HTTP status and structured error code defined in
   `ai_services/contracts/v1`, not merely an exception.
4. Remove the `assert True` integration placeholder.

## Commands and done evidence

From `ai_services/recommendation` run and record actual results:

```sh
make test-integration
make test
make test-contract
make lint
make typecheck
```

The packet is complete only when all three named integration cases pass,
contract tests remain green, and Ruff/mypy strict pass. Report per-module
coverage for any API module newly exercised when available. Do not claim a
model/stage gate. If a required case reveals missing source behavior or an
unmapped HTTP 500, leave the regression enabled, record the concrete failure,
and stop at the tests-only boundary for tech-lead disposition.

## Completion evidence

Implemented at the tests-only boundary on 2026-09-14.

Files changed:

- deleted `ai_services/recommendation/tests/integration/test_integration_scaffold.py`
- added `ai_services/recommendation/tests/integration/test_a3_persistence.py`
- updated this packet and the verified dispatch status in
  `agent_instructions/STATUS.md`

Named-case evidence:

- Repository rollback passes against a real temporary SQLite file. A trigger
  deterministically aborts the second statement in `save_bundle`; a newly
  constructed repository finds neither the bundle nor the rule-version row.
- Process restart passes. A first app creates a bundle, a second repository/app
  instance against the same file reads the seeded snapshot, bundle revision,
  and rule version, then completes a public substitution at revision 2.
- Malformed workbook import fails the required contract assertion. The test
  injects `XlsxCatalogueImporter`, sends a synthetic malformed `.xlsx` through
  `POST /v1/catalogue/imports`, and expects structured `422 invalid_request`.
  The actual response is unstructured HTTP 500 because the workbook-reader
  exception is not mapped by the API.

Commands run from `ai_services/recommendation` and actual results:

- `make test-integration` — failed: 2 passed, 1 failed. The failure is
  `test_malformed_workbook_import_returns_structured_invalid_request`:
  expected 422, actual 500.
- `make test` — passed: 259 tests, 91% aggregate branch coverage.
- `make test-contract` — passed: 17 tests.
- `make lint` — initially failed on one 89-character test line; after wrapping
  that line, passed with `All checks passed!`.
- `make typecheck` — passed: no issues in 54 source files.
- focused integration coverage for the two passing persistence cases — passed:
  2 tests, 1 deselected; `api/repository.py` 91%, `api/routes.py` 81%.

A3 done-evidence is not met because all three named integration cases do not
pass. The failing regression remains enabled. Closing the gap requires a
source-level mapping for malformed-workbook exceptions and therefore needs a
new scoped engineering packet / tech-lead disposition. No `src/` file,
contract, open question, model path, or stage gate was changed or claimed.

The shared error schema defines the structured shape but does not enumerate
error codes. The expected `invalid_request` code follows the recommendation
API's established A1 error vocabulary and contract tests.

Follow-up: `REC-A3-02` implemented the tech-lead's narrow source ruling. The
previously failing regression now passes and A3 done-evidence is complete.
