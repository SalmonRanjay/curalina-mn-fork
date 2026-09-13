# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A2 constitution and spatial rule loaders
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Load packaged YAML rule resources into the frozen A1 contract structures.
Scope is loader/schema only: no rule evaluation, spatial algorithms, pruning
behavior, or palette generation.

## Context

Required guides:

- `AGENTS.md`
- `agent_instructions/README.md`
- `agent_instructions/00_design_rules_engine.md`
- `agentic_flow/12_design_rules_engine.md`
- `agentic_flow/style_constitution.yaml`
- `agentic_flow/spatial_rules.yaml`
- `agentic_flow/open_questions.yaml`

## Allowed files

- `ai_services/design_rules/pyproject.toml`
- `ai_services/design_rules/requirements.lock`
- `ai_services/design_rules/README.md`
- `ai_services/design_rules/src/curalina_design_rules/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/types/rules.py`
- `ai_services/design_rules/src/curalina_design_rules/constitution/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/constitution/loader.py`
- `ai_services/design_rules/src/curalina_design_rules/spatial/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/spatial/loader.py`
- `ai_services/design_rules/src/curalina_design_rules/loader.py`
- `ai_services/design_rules/src/curalina_design_rules/rules/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/rules/style_constitution.yaml`
- `ai_services/design_rules/src/curalina_design_rules/rules/spatial_rules.yaml`
- `ai_services/design_rules/tests/unit/test_rule_loaders.py`
- `ai_services/design_rules/tests/unit/test_rule_source_metadata.py`
- `ai_services/work_packets/RULES-A2-01.md`

## Do not change

- Existing TypeScript app paths
- Other Python service packages
- `agentic_flow/**`, `architecture/**`, and `agent_instructions/**`

## Deliverables

- Package-resource YAML copies matching the authoritative local
  `agentic_flow` YAML files.
- `load_rules(version: str | None = None) -> RuleSet`.
- Constitution and spatial loader helpers.
- Parsed style HSL caps, home-category walkway minimums converted from
  inches to integer millimetres, version checks, and rule metadata with source
  citations.
- Tests proving version pinning, source-section preservation, representative
  parsed values, and package YAML copy parity.

## Local commands

```bash
make -C ai_services/design_rules setup
make -C ai_services/design_rules test
make -C ai_services/design_rules lint
make -C ai_services/design_rules typecheck
```

## Acceptance criteria

- `load_rules()` loads packaged YAML resources, not arbitrary project paths.
- `load_rules("2026.09.12-a")` succeeds; unknown versions fail.
- Style and spatial `rules_version` values must match.
- Rule metadata includes nonblank `source_section`.
- Representative YAML guardrail IDs are represented in metadata.
- Walkway conversions are `32 in -> 813 mm`, `36 in -> 914 mm`,
  `48 in -> 1219 mm`.
- No evaluator, geometry algorithm, palette generation, HTTP, DB, model,
  pandas, torch, diffusers, Shapely, or FastAPI code is introduced.

## Known blockers

Open questions are represented as blocked metadata only. They are not
resolved or evaluated in A2.

## Completion evidence

- To be filled after verification.
