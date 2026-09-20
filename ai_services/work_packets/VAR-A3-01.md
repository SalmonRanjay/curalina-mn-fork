# VAR-A3-01 — durable-job integration evidence

## Task

Service: variants. Phase: A3. Owner: python-services-engineer (primary agent).
Reviewer: code-reviewer. Coordinator: primary agent.

## Objective

Replace the integration placeholder with real temporary-SQLite lifecycle
tests for STATUS dispatch item 2, or record reproducible engineering blockers.

## Context

- `agent_instructions/STATUS.md` — operational reference, item 2.
- `agentic_flow/variant_generator_workflow.md` — A3 mandatory cases and evidence.
- `ai_services/variant_generator/src/curalina_variants/api/sqlite_store.py`
- `ai_services/variant_generator/src/curalina_variants/workers/runner.py`
- `ai_services/variant_generator/tests/contract/test_a3_persistence.py`
- `agentic_flow/EXAMPLE_work_packet_rules_engine.md` — packet standard.

Inputs are existing labelled fake job fixtures and temporary SQLite databases.
No client data or open-question rules are used; no OQ is resolved by this work.

## Allowed files

- `ai_services/variant_generator/tests/integration/test_integration_scaffold.py`
- `ai_services/variant_generator/tests/integration/test_a3_durable_jobs.py`
- `ai_services/work_packets/VAR-A3-01.md` — coordination/evidence only.
- `agent_instructions/STATUS.md` — coordination/status only.

## Do not change

Source, contracts, dependencies, notebooks, other services, open questions,
and unrelated existing changes. Any required source fix escalates to tech-lead.

## Deliverables and acceptance criteria

Integration cases individually cover: unexpired lease excludes another worker;
expired lease permits recovery; worker exits after claim and a restarted worker
recovers; stale worker completion is rejected; restart retains completed state;
changed idempotency payload returns HTTP 409; cancellation before completion
and cancellation interleaved after completion's read cannot resurrect a job;
candidate/job transaction failure rolls back partial records. Assess the
mandatory asset-write-success/DB-commit-failure path: if no worker asset-write
path exists, report the missing engineering rather than fabricate coverage.

Use direct timestamp updates against the temporary database, no clock port or
sleeps. Use deterministic failure/interleaving seams with the real store.
Retain failing regression evidence without weakening assertions or marking
failures as passing. No model-quality or stage-gate claim.

## Local commands

From `ai_services/variant_generator`:

```sh
make test-integration
make test
make test-contract
make test-worker
make lint
make typecheck
COVERAGE_FILE=/tmp/curalina_variants_a3.coverage python3 -m pytest tests/unit tests/integration -p no:cacheprovider
```

Report `api/sqlite_store.py` module coverage as well as aggregate coverage.

## Known blockers and stop condition

Potential cancellation TOCTOU and missing worker output assets require
tech-lead assessment. Finish only when all mandatory evidence is present and
reviewed. If engineering is required, stop implementation at the tests-only
boundary and record reproduction and follow-up scope; do not mark A3 done.

## Completion evidence

**Disposition: blocked on engineering; A3 is not complete.**

- Packet-validator: PASS, all six checks; single service and phase.
- Code-reviewer: no defects in the new tests; confirmed cancellation
  resurrection and absent output-asset persistence. The distinct-worker test
  does not prove per-claim fencing for reused worker IDs.
- `make test-integration`: 6 passed, 1 failed. The enabled regression
  `test_cancellation_after_completion_read_cannot_resurrect_job` observes
  `succeeded` where `cancelled` is required. No xfail or skip hides it.
- `make test`: 81 passed, 90% coverage with branches enabled.
- `make test-contract`: 27 passed; `make test-worker`: 2 passed.
- `make lint`: passed; `make typecheck`: no issues in 33 source files.
- Final combined unit/integration run: 87 passed, 1 failed, 92% coverage
  with branches enabled. `api/sqlite_store.py`: 77% unit-only → 82% combined.
  Two existing FastAPI/Starlette deprecation warnings remain.
- Replaced the `assert True` scaffold. Only integration tests and the
  packet/status records were changed by this task. Existing unrelated LAB
  modules explain why the unit count exceeds STATUS's earlier 71.

The rollback test injects an SQLite UPDATE failure after candidate insertion;
it proves candidate/job transaction rollback and recovery, **not** an actual
commit failure after output-asset persistence. That mandatory case remains
unimplemented because the worker has no generated-asset write path.

### Tech-lead escalation disposition

Inspection confirmed completion reads ownership separately from its final
write, allowing cancellation to be overwritten. Cancellation likewise reads
then writes separately; claim selection has no immediate write transaction.
Completion always sets `output_asset_id=None`, and the runner delegates only
to lease/completion methods. These are source requirements, not test seams.

A successor engineering packet is justified: explicitly enumerate the
variants source/test files for transactional claims, cancellation/completion
validation, stale-claim rejection and labelled-fake generated-output
persistence. Specify its storage design before introducing any new adapter
or asset-store module. Require both cancellation orderings, stale/competing
workers, genuine output-write/final-commit failure and recovery, plus restart.
No Clock port, contract changes, other services, model claims or stage gates.
The current tests-only packet stops here under STATUS item 2's boundary.
