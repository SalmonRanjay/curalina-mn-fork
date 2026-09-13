# Agent work packet

## Task

Service: `curalina_recommendation`
Phase: A0 scaffold
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Create the empty recommendation service package scaffold with immutable
settings and working local commands. No recommendation logic, catalogue
import, ranking, bundle composition, API endpoints, persistence, or model
inference.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/README.md`
- `agent_instructions/01_recommendation_service.md`
- `agentic_flow/recommendation_workflow.md`
- `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`

## Allowed files

- `ai_services/recommendation/**`
- `ai_services/work_packets/REC-A0-01.md`

## Do not change

- Existing TypeScript app paths
- Other service packages except shared root suite targets
- `agentic_flow/**`, `architecture/**`, and `agent_instructions/**`

## Deliverables

- `pyproject.toml`, `requirements.lock`, `Makefile`, `README.md`
- `src/curalina_recommendation/{domain,application,ports,adapters,api}`
- `bootstrap.py` and immutable `Settings`
- `data/raw`, `data/curated`, and `runs` scaffolding
- Unit, contract, and integration placeholder tests

## Local commands

```bash
make -C ai_services/recommendation setup
make -C ai_services/recommendation test
make -C ai_services/recommendation test-contract
make -C ai_services/recommendation test-integration
make -C ai_services/recommendation lint
make -C ai_services/recommendation typecheck
make -C ai_services/recommendation run-api
```

## Acceptance criteria

- Package imports from `src` layout.
- Settings read `CURALINA_ENV`, `CURALINA_DATA_DIR`, and
  `CURALINA_DATABASE_URL`.
- README commands match reality.
- No business logic is added.
- No worker is added for recommendation.

## Known blockers

- `OQ-011` real furniture catalogue blocks later R03 real-data claims, not A0.

## Completion evidence

- `make -C ai_services/recommendation setup` passed after approved network
  access installed scaffold dependencies.
- `make -C ai_services/recommendation test` passed: 3 unit tests, 100%
  coverage on the scaffold.
- `make -C ai_services/recommendation test-contract` passed: 1 placeholder
  contract test.
- `make -C ai_services/recommendation test-integration` passed: 1 placeholder
  integration test.
- `make -C ai_services/recommendation lint` passed.
- `make -C ai_services/recommendation typecheck` passed under mypy strict.
- `make -C ai_services/recommendation run-api` returned scaffold status for
  `127.0.0.1:8101`.
- No ranking, filtering, catalogue import, API endpoint, persistence, model,
  or worker logic was added.
