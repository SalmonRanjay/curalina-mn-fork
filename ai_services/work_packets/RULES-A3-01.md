# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A3 — consumer-facing API surface (in-process, not HTTP)
Owner: `python-services-engineer`
Reviewer: Recommendation/data contributor + named design authority

## Objective

Expose the stable, in-process Python entry points that
`curalina_recommendation` and `curalina_rooms` will import (this library has
no HTTP API of its own), and build a golden-scenario fixture set consumers
and future packets can use as an acceptance suite. Consumers must be able to
pin an exact `rules_version` and get identical behavior back.

## Context

Required guides:

- `agent_instructions/00_design_rules_engine.md`
- `agentic_flow/12_design_rules_engine.md` (§8 "golden scenarios" framing,
  module map, "Why a library, not a service")
- `ai_services/work_packets/RULES-A2b-01.md` (the spatial engine this
  surface wraps)

## Allowed files

- `ai_services/design_rules/src/curalina_design_rules/api.py` (new)
- `ai_services/design_rules/src/curalina_design_rules/__init__.py`
- `ai_services/design_rules/tests/fixtures/golden_scenarios.py` (new)
- `ai_services/design_rules/tests/unit/test_api.py` (new)
- `ai_services/design_rules/tests/unit/test_golden_scenarios.py` (new)
- `ai_services/work_packets/RULES-A3-01.md`

## Do not change

- `style.py`, `palette.py`, `pruning.py`, `pipeline/*` evaluation — still out
  of scope; `evaluate_spatial_layout` only aggregates the A2b geometry-driven
  checks (collision, walkway, CMR), not style/material/palette rules
- Any service package (`curalina_recommendation`, `curalina_variants`,
  `curalina_rooms`)
- `agentic_flow/**`, `architecture/**`, `agent_instructions/**`

## Deliverables

- `api.py` (new): the package's stable import surface —
  - `pinned_rules_version() -> str` — the version a consumer records at
    startup and passes back into `load_rules(version=...)` on every call, so
    a mid-deployment rules change cannot silently alter an in-flight request.
  - `evaluate_spatial_layout(placements, room, rules) -> RuleResult` — the
    §9/§10-STEP-5 entry point aggregating `check_collisions`,
    `check_walkways` (using the room's home-category minimum), and
    `check_cmr_validation` (always `needs_input`). Raises `ValueError` if
    called with a `RuleSet` that wasn't built by `load_rules()` (no
    `spatial_rule_table`) or with a room whose `home_category` isn't in the
    loaded rule set — both are programmer errors, not design-rule failures,
    so they raise rather than returning a `Violation`.
  - Re-exports `load_rules` from `loader.py` unchanged.
  - **Deliberately does not** bundle the eleven named per-rule checks (rug
    front-leg inset, TV sightline height, twin-nightstand product IDs,
    credenza proportion, etc.) into one call, because those need
    designer/product inputs this entry point does not have. Consumers call
    the corresponding function in `curalina_design_rules.spatial` directly.
  Re-exported at the package root (`curalina_design_rules.__init__`) so
  consumers do `from curalina_design_rules import evaluate_spatial_layout,
  load_rules, pinned_rules_version`.
- `tests/fixtures/golden_scenarios.py` (new): four representative scenarios
  (`condo_living_room_conversation_circle`, `mid_dining_room_service_perimeter`,
  `large_living_room_floating_anchor_violation`,
  `condo_bedroom_pinched_ensuite_path`) covering all three home categories
  and living/dining/bedroom room types, built only from thresholds already
  present in `spatial_rules.yaml`.
- Tests: `test_api.py` (5 tests) and `test_golden_scenarios.py` (5 tests).

## Local commands

Required before completion:

```bash
cd ai_services/design_rules
make test
make lint
make typecheck
```

## Acceptance criteria

- `pinned_rules_version()` and `load_rules(version)` round-trip to the same
  version.
- `evaluate_spatial_layout` raises (does not silently misbehave) when given
  a `RuleSet` without a spatial rule table, or a room whose home category
  isn't loaded.
- `CMR_VALIDATION`'s `needs_input` surfaces through the consumer-facing
  entry point exactly as it does at the `spatial.py` level — `passes_hard`
  is `False` for every golden scenario until OQ-001 is resolved, and this is
  asserted directly (not merely "observed once").
- All four golden scenarios are collision-free, and the one deliberately
  built as a hard-spatial-failure case (`large_living_room_floating_anchor_violation`)
  is verified to actually fail `LR_FLOATING_ANCHOR`.

## Known blockers

- **§8 golden scenarios do not exist in this repository.**
  `12_design_rules_engine.md` calls Design Manual §8 "a gift" — four
  worked examples the client authored specifically as an acceptance suite —
  but `Training_Doc_1_-_Design_Manual.pdf` is not checked in anywhere under
  this repo (`attached_assets/` holds only unrelated marketing/quiz PDFs;
  `docs/` holds only the MVP proposal). I searched the full repository tree
  before writing fixtures and confirmed this. Fabricating four scenarios and
  labeling them as the manual's literal §8 examples would violate this
  project's own "never invent a rulebook value" rule, so I did not do that.
  Instead, `tests/fixtures/golden_scenarios.py` documents this gap in its
  module docstring and provides four **representative** scenarios built only
  from already-loaded YAML thresholds, explicitly not claimed to be the
  manual's originals. **This blocks true §8 acceptance-suite completion** —
  it needs either the source PDF or an equivalent extract of §8's text
  supplied by the design authority before the real four examples can be
  encoded. This is a new gap, not one of the twelve `OQ-xxx` entries in
  `open_questions.yaml` (closest existing one is OQ-011, which blocks the
  furniture catalogue for an unrelated reason); it should be raised with the
  design authority as an additional open question if the real §8 text is
  needed for a later gate.
- OQ-001 (`CMR_VALIDATION`) continues to surface through this entry point;
  no new handling was added, it is passed through unchanged from A2b.

## Completion evidence

Files changed/added (relative to `ai_services/design_rules/`):

- `src/curalina_design_rules/api.py` — new file, 4 tested functions/`__all__`
  entries (`pinned_rules_version`, `evaluate_spatial_layout`, plus
  re-exported `load_rules`).
- `src/curalina_design_rules/__init__.py` — re-exports `evaluate_spatial_layout`
  and `pinned_rules_version` alongside the existing `load_rules`.
- `tests/fixtures/golden_scenarios.py` — new, 4 `GoldenScenario` fixtures.
- `tests/unit/test_api.py` — new, 5 tests.
- `tests/unit/test_golden_scenarios.py` — new, 5 tests.

Exact commands run and their real results (2026-09-12, this session):

```
$ cd ai_services/design_rules && make check
python3 -m ruff check --no-cache .
All checks passed!
python3 -m mypy --strict --cache-dir=/tmp/curalina_design_rules_mypy_cache src/curalina_design_rules
Success: no issues found in 20 source files
PYTHONDONTWRITEBYTECODE=1 COVERAGE_FILE=/tmp/curalina_design_rules.coverage python3 -m pytest -p no:cacheprovider
...
76 passed in 6.55s
TOTAL branch coverage: 91%
```

`src/curalina_design_rules/api.py` itself is at 100% statement and branch
coverage (see per-file coverage table in the same run).

- **A3 is functionally complete for the in-process entry points and a
  fixture set**, but the golden-scenario deliverable is **accept-with-
  limitations**, not a clean accept: the fixtures are representative, not
  the manual's actual four §8 examples, because that source text is not in
  this repository (see Known blockers). Recommend the design authority
  either supply the §8 extract or explicitly accept the representative set
  as sufficient for this gate.
- The `D01_rules_conformance` notebook and its decision record (the
  "A6-equivalent" phase in `agent_instructions/00_design_rules_engine.md`)
  were **not** produced in this session — out of scope for the A2b/A3 task
  as given. It should reproduce the real §8 examples once they are
  available, and end in the accept/accept-with-limitations/no-go decision
  record `16_notebook_standard.md` requires.
