# Agent work packet

## Task

Service: room generator
Phase: A3 API and worker
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Complete room-generator A3 engineering without touching G01/model evidence:
durable SQLite job state, worker leasing/fencing, staged insertion
checkpointing, bounded attempt counts, and real `run-api` / `run-worker`
process entry points.

## Context

Required guides and rulings:

- `AGENTS.md`
- `agent_instructions/STATUS.md`
- `agentic_flow/room_generator_workflow.md` A3
- `architecture/adr/ADR-0011-g01-room-scene-corpus-does-not-exist.md`
- `ai_services/variant_generator/src/curalina_variants/api/sqlite_store.py`
- `ai_services/variant_generator/src/curalina_variants/workers/runner.py`

## Allowed files

- `ai_services/room_generator/**`
- `ai_services/work_packets/ROOM-A3-01.md`
- `agent_instructions/STATUS.md`

## Do not change

- Recommendation or variants service internals
- Existing TypeScript app paths
- G01 notebooks or real room-scene evaluation
- Any real model/image-generation path

## Deliverables

- SQLite-backed durable room store.
- FastAPI app defaults to the SQLite store configured by
  `CURALINA_DATABASE_URL`, while tests can still inject
  `RoomsContractService()`'s in-memory fixture path.
- Worker entry point leases one queued/expired running job and completes it
  through the fake grounded-generation path.
- Lease-owner fencing rejects completion by the wrong worker.
- Staged insertion rows persist partial artifacts on fake generation failure.
- Attempt count is bounded at the documented three-attempt room-rendering
  ceiling without making any G01/G02 acceptance claim.
- `bootstrap.main("api")` runs uvicorn against the FastAPI factory;
  `bootstrap.main("worker")` runs one worker pass.

## Local commands

```bash
make -C ai_services/room_generator test
make -C ai_services/room_generator test-contract
make -C ai_services/room_generator lint
make -C ai_services/room_generator typecheck
```

## Acceptance criteria

- No service imports another service's internals.
- No model call or room-scene/G01 work is introduced.
- Integration tests cover queued lifecycle, reference import/hash
  verification, cancellation, lease timeout/restart recovery, wrong-worker
  fencing, partial artifacts after failure, and process worker behavior.
- Existing contract tests remain green.

## Known blockers

- G01/G02/G03 remain blocked on `OQ-010` measured room scenes. This packet
  does not change that.
- Rooms A4 suite participation is now technically unblocked, but should only
  be added when the project wants the fake room job included in the root
  suite flow.

## Completion evidence

- `make -C ai_services/room_generator test` passed: 73 tests, 93% branch
  coverage, `api/sqlite_store.py` at 83% branch coverage.
- `make -C ai_services/room_generator test-contract` passed: 34 tests.
- `make -C ai_services/room_generator lint` passed.
- `make -C ai_services/room_generator typecheck` passed.
- Existing FastAPI/Starlette `TestClient` deprecation warnings remain.
