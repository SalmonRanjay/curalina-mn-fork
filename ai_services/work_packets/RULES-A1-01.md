# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A1 contracts
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Implement frozen typed contracts for design-rules entities so later loaders
and evaluators can depend on stable structures. No YAML loading, rule
evaluation, spatial geometry logic, palette generation, HTTP, database, or
model code.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/README.md`
- `agent_instructions/00_design_rules_engine.md`
- `agentic_flow/12_design_rules_engine.md`
- `agentic_flow/open_questions.yaml`
- `architecture/templates/agent_work_packet.md`

## Allowed files

- `ai_services/design_rules/README.md`
- `ai_services/design_rules/src/curalina_design_rules/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/types/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/types/primitives.py`
- `ai_services/design_rules/src/curalina_design_rules/types/results.py`
- `ai_services/design_rules/src/curalina_design_rules/types/profile.py`
- `ai_services/design_rules/src/curalina_design_rules/types/catalog.py`
- `ai_services/design_rules/src/curalina_design_rules/types/geometry.py`
- `ai_services/design_rules/src/curalina_design_rules/types/rules.py`
- `ai_services/design_rules/src/curalina_design_rules/types/palette.py`
- `ai_services/design_rules/src/curalina_design_rules/pipeline/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/pipeline/types.py`
- `ai_services/design_rules/tests/fixtures/__init__.py`
- `ai_services/design_rules/tests/fixtures/contracts.py`
- `ai_services/design_rules/tests/unit/test_contracts.py`
- `ai_services/work_packets/RULES-A1-01.md`

## Do not change

- Existing TypeScript app paths
- Other Python service packages
- `ai_services/contracts/**`
- `agentic_flow/**`, `architecture/**`, and `agent_instructions/**`

## Deliverables

- Frozen contracts for violation results, profile/style inputs, color, money,
  product/catalog attributes, placements, room geometry, rule metadata,
  palette/material/lighting value objects, and pipeline ordering types.
- Deterministic synthetic fixtures for valid minimal profile, product, room,
  placement, blocked rule metadata, and pipeline objects.
- Unit tests for immutability, hard/needs-input behavior, source citations,
  blocker citation shape, versioned rule metadata, integer-mm dimensions, and
  pipeline nesting.

## Local commands

```bash
make -C ai_services/design_rules setup
make -C ai_services/design_rules test
make -C ai_services/design_rules lint
make -C ai_services/design_rules typecheck
```

## Acceptance criteria

- All new public contract objects are frozen/immutable.
- Money uses `decimal.Decimal`.
- Dimensions use integer millimetres.
- Rule outputs use `Violation` objects, not booleans.
- `RuleResult.passes_hard` exists and returns `False` for hard or
  `needs_input` violations.
- Rule metadata carries `rule_id`, `source_section`, `rules_version`, status,
  and optional `open_question_id`.
- Pipeline ordering types nest `StyledRoom -> ValidatedLayout ->
  NormalizedRoom`.
- No YAML files are read and no rule evaluation is introduced.

## Known blockers

Open questions remain unresolved contract data only: `OQ-001` through
`OQ-012`, especially `OQ-001` and `OQ-007` for upcoming rule evaluation and
palette work.

## Completion evidence

- `make -C ai_services/design_rules setup` passed after approved network
  access refreshed the editable install.
- `make -C ai_services/design_rules test` passed: 13 tests, 92% branch
  coverage on the A1 contract layer.
- `make -C ai_services/design_rules lint` passed.
- `make -C ai_services/design_rules typecheck` passed under mypy strict.
- Contracts are frozen dataclasses/enums; money uses `decimal.Decimal`; room
  and product dimensions are integer millimetres with runtime boundary checks.
- Rule outputs use `Violation` and `RuleResult`; blocked paths can carry
  `Severity.NEEDS_INPUT` plus exact `OQ-xxx` metadata, and blocked metadata
  now rejects missing, blank, or malformed source/open-question citations.
- No YAML loading, rule evaluation, HTTP, DB, Shapely, pandas, torch,
  diffusers, or model code was added.
