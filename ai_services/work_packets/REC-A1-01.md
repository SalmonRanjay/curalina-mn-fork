# Agent work packet

## Task

Service: `curalina_recommendation`
Phase: A1 contracts
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Freeze request/response meaning for the four recommendation HTTP endpoints
before any business logic exists: typed DTOs, fixture-backed fake
responses, and the shared error vocabulary, with contract tests proving
version rejection and structured validation failure. No catalogue import,
ranking, or bundle-composition logic.

## Context

Required guides:

- `architecture/guides/01_system_architecture.md`
- `architecture/guides/02_local_setup.md`
- `architecture/guides/03_data_contracts.md`
- `architecture/guides/08_engineering_and_tests.md`
- `architecture/guides/09_delivery_gates.md`

Additional workstream guides:

- `agent_instructions/01_recommendation_service.md`
- `agentic_flow/recommendation_workflow.md` (A1 section)
- `agentic_flow/13_recommendation_technical_design.md` (module layout:
  `api/ routes.py schemas.py errors.py`)
- `ai_services/contracts/v1/CONTRIBUTING.md`, `id_versioning.md`,
  `schemas/error.schema.json` (contracts steward's shared conventions —
  read, not modified)

Input data, fixtures or decisions:

- `03_data_contracts.md`'s HTTP surface table (four recommendation rows)
  and its "Contract rules" (`/v1` paths, `schema_version=1.0`, reject
  unsupported majors with 422, error shape
  `code, message, details, retryable, request_id`).
- Per `ai_services/contracts/v1/CONTRIBUTING.md`: "Services own fixtures for
  their own endpoints during A1." Recommendation's per-endpoint fixtures
  therefore live under `ai_services/recommendation/`, not
  `ai_services/contracts/v1/`. No changes were needed under
  `ai_services/contracts/v1/` for this phase — the shared error schema
  already covers this service's needs and recommendation has no
  cross-service field or ID-prefix conflict to raise with the contracts
  steward.

## Allowed files

- `ai_services/recommendation/src/curalina_recommendation/api/`
- `ai_services/recommendation/src/curalina_recommendation/api/fixtures/` (new)
- `ai_services/recommendation/tests/contract/test_contract_scaffold.py`
- `ai_services/recommendation/pyproject.toml` (dependency + package-data
  additions only: `fastapi`, `httpx`)
- `ai_services/work_packets/REC-A1-01.md`

## Do not change

- `domain/`, `application/`, `ports/`, `adapters/` (later phases)
- `ai_services/contracts/v1/` (no change needed this phase — see above)
- Other service packages
- `agentic_flow/**`, `architecture/**`, `agent_instructions/**`

## Deliverables

- Contract fixtures: `api/fixtures/catalogue_imports_success.json`,
  `recommendations_success.json`, `bundles_success.json`,
  `bundles_infeasible.json`, `substitutions_success.json`.
- Domain/application code: none (out of scope for A1).
- API/worker code: `api/schemas.py` (typed request/response DTOs for all
  four endpoints plus the shared `SchemaVersionedRequest`/`Response`
  bases), `api/errors.py` (`CuralinaError` model, `build_error`, and the
  `RequestValidationError` handler that turns missing-field and
  unsupported-major-version failures into a structured 422), `api/routes.py`
  (`create_app()` building the FastAPI app, the exception handler wiring,
  and the four fixture-backed fake route handlers — one deterministic
  budget-threshold fixture selector for the bundles `feasible=false` case,
  which is fixture selection, not a solver).
- Tests: `tests/contract/test_contract_scaffold.py` — 14 contract tests
  covering, per endpoint, a success case, a missing-required-field case
  (structured 422), and an unsupported-major-`schema_version` case
  (structured 422 with `code=unsupported_schema_version`); plus the
  bundles `feasible=false` no-solution case and one test asserting the
  error body's key set matches `error.schema.json` exactly.
- Docs/report/ADR: this packet.

## Local commands

Required before completion:

```bash
make -C ai_services/recommendation setup
make -C ai_services/recommendation test
make -C ai_services/recommendation test-contract
make -C ai_services/recommendation test-integration
make -C ai_services/recommendation lint
make -C ai_services/recommendation typecheck
```

Optional slow commands:

```bash
pending (none for this phase)
```

## Acceptance criteria

- All four endpoints (`POST /v1/catalogue/imports`, `POST
  /v1/recommendations`, `POST /v1/bundles`, `POST
  /v1/bundles/{bundle_id}/substitutions`) exist behind typed Pydantic DTOs
  and return fixture-backed responses only — no ranking, no catalogue
  import, no bundle solving.
- Every response and request DTO carries `schema_version`; every response
  uses `/v1` paths.
- A request with an unsupported `schema_version` major returns 422 with
  `code=unsupported_schema_version`.
- A request missing a required field returns 422 with
  `code=invalid_request`, not a 500.
- The bundles endpoint returns `200` with `feasible=false` and populated
  `violations` for the explicit no-solution fixture case.
- The error body always has exactly `code, message, details, retryable,
  request_id` and matches `ai_services/contracts/v1/schemas/error.schema.json`.
- `mypy --strict` and Ruff are clean on `src/`.

## Known blockers

- None for A1. R03/bundle-composition real logic remains blocked on
  `OQ-011` (real furniture catalogue data), but that only affects A2/A3 —
  A1's bundle fixtures are explicitly synthetic and labelled as such
  (`warnings: ["fixture_backed_response_no_real_ranking"]`).

## Completion evidence

Files changed:

- `ai_services/recommendation/pyproject.toml` — added `fastapi` to core
  dependencies and `httpx` to `dev` extras (needed for
  `fastapi.testclient.TestClient`); added `[tool.setuptools.package-data]`
  so `api/fixtures/*.json` ships with the package.
- `ai_services/recommendation/src/curalina_recommendation/api/schemas.py` —
  new. Typed DTOs for all four endpoints, `SchemaVersionedRequest` (validates
  `schema_version` major via a `field_validator`), `DesignProfileIn`,
  `BundleLineItem`, `BundleViolation`, and per-endpoint request/response
  models. All models use `extra="forbid"`.
- `ai_services/recommendation/src/curalina_recommendation/api/errors.py` —
  new. `CuralinaError` Pydantic model matching
  `contracts/v1/schemas/error.schema.json` field-for-field, `build_error`,
  `new_request_id`, and `validation_exception_handler` registered against
  `RequestValidationError`; distinguishes `unsupported_schema_version` from
  `invalid_request` by inspecting the Pydantic error `loc` path.
- `ai_services/recommendation/src/curalina_recommendation/api/routes.py` —
  new. `create_app()` factory wiring the exception handler and four POST
  routes, each loading a canned JSON fixture via
  `importlib.resources` and validating it back through the response DTO.
  Bundle feasibility is chosen by one fixed constant
  (`INFEASIBLE_BUDGET_THRESHOLD_MINOR_UNITS = 500`), documented in-module
  as fixture selection, not a solver.
- `ai_services/recommendation/src/curalina_recommendation/api/fixtures/*.json`
  — five new canned fixtures (one per success case, one bundles-infeasible
  case).
- `ai_services/recommendation/src/curalina_recommendation/api/__init__.py`
  — now exports `create_app`.
- `ai_services/recommendation/tests/contract/test_contract_scaffold.py` —
  replaced the A0 placeholder with 14 real contract tests using
  `fastapi.testclient.TestClient` against the real `create_app()` object
  (per `08_engineering_and_tests.md`'s "real in-process HTTP client with
  fake application dependencies" rule).
- No changes were made under `ai_services/contracts/v1/`.

Commands run and results (this session, from
`ai_services/recommendation/`, `python3` used throughout since the shell
has no `python`):

```
$ python3 -m pip install "fastapi>=0.111" "httpx>=0.27"
Successfully installed ... fastapi-0.141.1 httpx-0.28.1 ...

$ python3 -m pip install -e .
Successfully installed curalina-recommendation-0.0.0

$ make test
collected 3 items
tests/unit/test_scaffold.py ...                                   [100%]
3 passed in 0.65s
(coverage 73% overall; domain/application/ports/adapters remain 100% at
0 statements — still empty, out of scope for A1. api/ coverage is
exercised by the contract suite below, not the unit suite.)

$ make test-contract
collected 14 items
tests/contract/test_contract_scaffold.py ..............            [100%]
14 passed in 0.67s

$ make test-integration
collected 1 item
tests/integration/test_integration_scaffold.py .                   [100%]
1 passed in 0.17s

$ make lint
python3 -m ruff check --no-cache .
All checks passed!

$ make typecheck
python3 -m mypy --strict --cache-dir=/tmp/curalina_recommendation_mypy_cache src/curalina_recommendation
Success: no issues found in 11 source files

$ python3 -m pytest ai_services/contracts/tests -q   # unaffected, sanity check
2 passed in 0.18s
```

A1 done-evidence status (`agentic_flow/recommendation_workflow.md`):

- "Contract tests pass" — met (14/14).
- "A request using an unsupported major version returns 422" — met,
  verified for all four endpoints
  (`test_*_unsupported_major_version_is_422`), asserting
  `code=unsupported_schema_version`.
- "A request missing a required field is rejected with a structured
  error, not a 500" — met, verified for all four endpoints
  (`test_*_missing_required_field_is_structured_422`), asserting
  `code=invalid_request` and the full `error.schema.json` field set.
- Bundles `feasible=false` explicit no-solution case — met
  (`test_bundles_no_solution_is_feasible_false_with_200`), returns HTTP 200
  per the contract table, not an error.

Limitations / follow-up:

- `make setup` was not re-run as the full pip-install-from-scratch flow in
  this session; dependencies were installed directly
  (`pip install fastapi httpx` then `pip install -e .`) against the same
  interpreter A0 verified against. `make setup` itself is unchanged and
  would install the same versions from `pyproject.toml`'s updated
  dependency list on a clean environment.
- `requirements.lock` was left as the A0 placeholder (no lock policy has
  been selected for the Python services yet); not in this phase's scope.
- README was not updated to mention the new endpoints — it is outside this
  phase's allowed-files list (`api/` and `contracts/v1/` only) and its A0
  commands still match reality unchanged.
- This phase intentionally added no domain/application code; A2 depends on
  R01/R02 notebooks and `curalina_design_rules` and is not started here.
