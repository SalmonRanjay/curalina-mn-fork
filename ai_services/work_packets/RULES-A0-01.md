# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A0 scaffold
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Create the empty Python package scaffold for the shared design-rules library,
with no rule logic yet, and make the package ready for A1 contracts.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/README.md`
- `agent_instructions/00_design_rules_engine.md`
- `architecture/templates/agent_work_packet.md`
- `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`
- `agentic_flow/12_design_rules_engine.md`

Input data, fixtures or decisions:

- A0 creates only scaffold and smoke tests.
- Rule contracts, YAML loaders, rule evaluation, notebooks, and golden
  scenarios are out of scope for this packet.

## Allowed files

- `ai_services/design_rules/pyproject.toml`
- `ai_services/design_rules/Makefile`
- `ai_services/design_rules/README.md`
- `ai_services/design_rules/requirements.lock`
- `ai_services/design_rules/src/curalina_design_rules/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/py.typed`
- `ai_services/design_rules/src/curalina_design_rules/types/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/constitution/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/spatial/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/pipeline/__init__.py`
- `ai_services/design_rules/tests/unit/test_scaffold.py`
- `ai_services/work_packets/RULES-A0-01.md`

## Do not change

- Existing TypeScript application files under `client/`, `server/`,
  `functions/`, and `shared/`
- `agentic_flow/**`
- `architecture/**`
- Other future Python service packages

## Deliverables

- Contract fixtures: none in A0.
- Domain/application code: package skeleton only.
- API/worker code: none; this library has no HTTP API or worker.
- Tests: import/version smoke tests.
- Docs/report/ADR: this work packet.

## Local commands

Required before completion:

```bash
make -C ai_services/design_rules setup
make -C ai_services/design_rules test
make -C ai_services/design_rules lint
make -C ai_services/design_rules typecheck
```

Optional slow commands:

```bash
make -C ai_services/design_rules check
```

## Acceptance criteria

- `pyproject.toml` defines an installable `src/` layout package.
- `src/curalina_design_rules/{types,constitution,spatial,pipeline}/` exists
  and is importable.
- `make setup` and `make test` pass.
- No rule logic or undocumented defaults are introduced.
- No runtime dependency on GPU, internet, cloud accounts, customer data,
  HTTP frameworks, or databases.

## Known blockers

- No `OQ-xxx` blocker is touched by this scaffold packet.
- Later rule-evaluation packets must return `needs_input` for undefined
  rules such as `OQ-001` and `OQ-007`.

## Completion evidence

- Files changed are limited to the explicit allowed-file list above.
- `make -C ai_services/design_rules setup` passed after approved network
  access installed local dev tooling.
- `make -C ai_services/design_rules test` passed: 2 tests, 100% coverage on
  the empty scaffold.
- `make -C ai_services/design_rules lint` passed: Ruff reported all checks
  passed.
- `make -C ai_services/design_rules typecheck` passed: mypy strict reported
  no issues in 6 source files.
- No rule logic, YAML parsing, service code, DB code, model code, or notebook
  work was added.
