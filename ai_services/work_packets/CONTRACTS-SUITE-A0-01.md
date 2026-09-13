# Agent work packet

## Task

Service: shared contracts and local suite
Phase: Contracts A1 foundation and suite A0 scaffold
Owner: `contracts-qa-steward`
Reviewer: `code-reviewer`

## Objective

Create the shared contracts foundation and suite-runner command surface
without adding cross-service business logic or importing service internals.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/README.md`
- `agent_instructions/04_contracts_suite_and_ui_adapter.md`
- `agentic_flow/contracts_and_suite_workflow.md`

## Allowed files

- `ai_services/Makefile`
- `ai_services/suite_client.py`
- `ai_services/contracts/**`
- `ai_services/work_packets/CONTRACTS-SUITE-A0-01.md`

## Do not change

- Existing TypeScript app paths
- Service-local business logic
- `agentic_flow/**`, `architecture/**`, and `agent_instructions/**`

## Deliverables

- Root `ai_services/Makefile` with `setup-all`, `test-all`,
  `test-contracts`, and `run-suite`.
- Suite client skeleton with no service-internal imports.
- Canonical error schema.
- ID/versioning conventions.
- Contracts CONTRIBUTING note.
- Scaffold contract tests.

## Local commands

```bash
make -C ai_services test-contracts
make -C ai_services run-suite
```

## Acceptance criteria

- Suite runner uses no service internals.
- Contract tests pass.
- Shared error vocabulary requires `code`, `message`, `details`,
  `retryable`, and `request_id`.
- Unsupported major version behavior is documented for later service A1
  tests.

## Known blockers

- Full `run-suite` fixture flow waits until at least two services reach A3.

## Completion evidence

- `make -C ai_services test-contracts` passed: 2 shared-contract scaffold
  tests.
- `make -C ai_services run-suite` passed in dry-run scaffold mode and
  reported that A3 HTTP integration is not built yet.
- `make -C ai_services test-all` passed across design rules,
  recommendation, variants, and rooms unit scaffold tests.
- Root suite code imports no service internals and starts no service
  processes in A0.
- Full end-to-end fixture flow remains blocked until at least two services
  reach A3.
