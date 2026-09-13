# Agent work packet

## Task

Service: `curalina_rooms`
Phase: A0 scaffold
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Create the empty room-generator service package scaffold with immutable
settings, API/worker command surface, and smoke tests. No rendering,
homography, durable job logic, model loading, or asset import behavior.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/README.md`
- `agent_instructions/03_room_generator_service.md`
- `agentic_flow/room_generator_workflow.md`
- `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`

## Allowed files

- `ai_services/room_generator/**`
- `ai_services/work_packets/ROOM-A0-01.md`

## Do not change

- Existing TypeScript app paths
- Other service packages except shared root suite targets
- `agentic_flow/**`, `architecture/**`, and `agent_instructions/**`

## Deliverables

- `pyproject.toml`, `requirements.lock`, `Makefile`, `README.md`
- `src/curalina_rooms/{domain,application,ports,adapters,api,workers}`
- `bootstrap.py` and immutable `Settings`
- Unit, contract, integration, and worker placeholder tests

## Local commands

```bash
make -C ai_services/room_generator setup
make -C ai_services/room_generator test
make -C ai_services/room_generator test-contract
make -C ai_services/room_generator test-integration
make -C ai_services/room_generator test-worker
make -C ai_services/room_generator lint
make -C ai_services/room_generator typecheck
make -C ai_services/room_generator run-api
make -C ai_services/room_generator run-worker
```

## Acceptance criteria

- Package imports from `src` layout.
- Settings include model cache, device, model revision, max image pixels, and
  job timeout.
- README commands match reality.
- No rendering/model logic is added and `make setup` downloads no model
  weights.

## Known blockers

- `OQ-010` room geometry blocks later room-scale claims, not A0.

## Completion evidence

- `make -C ai_services/room_generator setup` passed after approved network
  access installed scaffold dependencies.
- `make -C ai_services/room_generator test` passed: 4 unit tests, 100%
  coverage on the scaffold.
- `make -C ai_services/room_generator test-contract` passed: 1 placeholder
  contract test.
- `make -C ai_services/room_generator test-integration` passed: 1
  placeholder integration test.
- `make -C ai_services/room_generator test-worker` passed: 1 placeholder
  worker test.
- `make -C ai_services/room_generator lint` passed.
- `make -C ai_services/room_generator typecheck` passed under mypy strict.
- `make -C ai_services/room_generator run-api` and `run-worker` returned
  scaffold status for port `8103`.
- No rendering, homography, durable job logic, API endpoint, model, or worker
  execution logic was added.
