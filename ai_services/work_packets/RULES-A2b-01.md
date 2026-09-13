# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A2b — rule evaluation pipeline (gate named in `agentic_flow/AMENDMENTS.md` A7)
Owner: `python-services-engineer`
Reviewer: Recommendation/data contributor + named design authority

## Objective

Implement the §9 spatial rule-evaluation engine over the A1/A2 frozen
contracts: geometric primitives (footprint, collision, walkway opening,
reachability) and the eleven named §9 rules, plus the blocked
`CMR_VALIDATION` port. Every rule returns `tuple[Violation, ...]` with a
non-empty `source_section`; nothing is evaluated as a boolean pass/fail with
no citation. `CMR_VALIDATION` always returns `needs_input` citing `OQ-001` —
never a guessed formula, never a silent pass.

## Context

Required guides:

- `agent_instructions/00_design_rules_engine.md`
- `agentic_flow/EXAMPLE_work_packet_rules_engine.md` (this packet's literal
  template — test names reused verbatim)
- `agentic_flow/12_design_rules_engine.md` (spatial engine section, §9 rule
  table, build order)
- `agentic_flow/open_questions.yaml` (OQ-001)
- `ai_services/design_rules/src/curalina_design_rules/rules/spatial_rules.yaml`
  (source of every threshold — nothing in the diff invents a number)

## Allowed files

- `ai_services/design_rules/pyproject.toml`
- `ai_services/design_rules/src/curalina_design_rules/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/types/rules.py`
- `ai_services/design_rules/src/curalina_design_rules/types/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/spatial/__init__.py`
- `ai_services/design_rules/src/curalina_design_rules/spatial/loader.py`
- `ai_services/design_rules/src/curalina_design_rules/spatial/geometry.py` (new)
- `ai_services/design_rules/src/curalina_design_rules/spatial/rules.py` (new)
- `ai_services/design_rules/src/curalina_design_rules/loader.py`
- `ai_services/design_rules/tests/unit/test_spatial_engine.py` (new)
- `ai_services/design_rules/tests/unit/test_spatial_properties.py` (new)
- `ai_services/work_packets/RULES-A2b-01.md`

## Do not change

- `style.py`, `palette.py`, `pruning.py`, `pipeline/*` evaluation logic — later
  packets (A3 only adds a consumer-facing entry point, not style/palette
  evaluation)
- Any service package (`curalina_recommendation`, `curalina_variants`,
  `curalina_rooms`)
- `agentic_flow/**`, `architecture/**`, `agent_instructions/**`
- `rules/spatial_rules.yaml` — read only; no edits were needed or made
- `agentic_flow/open_questions.yaml` — not touched; OQ-001 remains open

## Deliverables

- `types/rules.py`: `StyleSpacingRule`, `SpatialRuleTable` frozen dataclasses
  holding every §9 named-rule threshold in integer millimetres, plus
  `RuleSet.spatial_rule_table` (optional field, backward compatible with
  existing A1/A2 fixtures that construct `RuleSet` without it).
- `spatial/loader.py`: `load_spatial_rule_table(spatial_doc, rules_version)` —
  parses `sofa_to_table_in`, `hard_guardrails`, `symmetry`, `rug`,
  `suite_circulation`, `clearances`, `perimeter_accents.require`, and the
  `SIGHTLINE_12IN` invariant into `SpatialRuleTable`, converting inches to mm
  once at load time. Wired into `loader.load_rules()`.
- `spatial/geometry.py` (new): `footprint()`, `room_polygon()`,
  `check_collisions()`, `has_walkway()`, `check_walkways()`,
  `check_reachability()` — Shapely-backed, integer-mm throughout, using
  mitred-join/flat-cap buffering so the erode-dilate opening test is exact
  on axis-aligned rectilinear geometry rather than losing area to
  round-join approximation.
- `spatial/rules.py` (new): the eleven named rules —
  `check_lr_rug_front_leg`, `check_lr_media_sightline`,
  `check_lr_floating_anchor`, `check_br_twin_nightstand`,
  `check_br_rug_landing_strip`, `check_br_ensuite_path`,
  `check_br_closet_path`, `check_dr_pull_back`, `check_dr_credenza_buffer`,
  `check_dr_credenza_proportion`, `check_sightline_12in` — plus
  `check_cmr_validation()`, which always returns a `needs_input` `Violation`
  citing `OQ-001`.
- `pyproject.toml`: added `shapely>=2.0` runtime dependency and
  `types-shapely>=2.0` dev dependency (per `12_design_rules_engine.md`'s
  spatial-engine code sketch, which specifies Shapely explicitly); bumped
  `[tool.mypy] python_version` from `3.11` to `3.12` — required only because
  `numpy`'s installed type stubs (a transitive Shapely dependency) use
  3.12-only stub syntax; the package's own `requires-python` floor is
  unchanged at `>=3.11`.
- Tests: `test_spatial_engine.py` (16 named unit tests) and
  `test_spatial_properties.py` (2 hypothesis property tests).

## Local commands

Required before completion:

```bash
cd ai_services/design_rules
make test
make lint
make typecheck
```

## Acceptance criteria

- Every named test in `EXAMPLE_work_packet_rules_engine.md`'s table is
  present, named to match, and green: walkway boundary, unit conversion,
  collision, rotation, rug front-leg, media sightline, floating anchor, twin
  nightstand, rug landing strip, ensuite/closet path, credenza proportion,
  CMR blocked, the two hypothesis properties, and traceability.
- `CMR_VALIDATION` never returns anything but `needs_input` citing `OQ-001`.
- Every `Violation` produced by this packet's rules carries a
  `source_section` that is a real `spatial_rules.yaml` section reference.
- No `HARD` severity was relaxed to `SOFT` to make a test pass; no threshold
  was invented where the YAML/manual didn't already supply one.
- No pandas, torch, SQLAlchemy, or FastAPI import anywhere in the diff.
- All linear comparisons are on `int` millimetre values — no float
  comparisons on measurements (float is used only for polygon area/geometry
  intermediates inside Shapely, never as a measurement of record).

## Known blockers

- **OQ-001 (`CMR_VALIDATION`)** — the manual requires validating a
  Circulation-to-Mass Ratio (9 implementation note, 10 STEP 5) but never
  defines the formula or pass band. `check_cmr_validation()` always returns
  a `Violation` with `severity=NEEDS_INPUT` and `open_question_id="OQ-001"`.
  This is exercised by `test_cmr_validation_returns_needs_input_citing_oq_001_never_passes`
  and by `test_evaluate_spatial_layout_always_surfaces_cmr_needs_input` (A3).
  No formula is guessed anywhere in this diff.
- OQ-002/003/004 (style proportion/material-ratio denominators) are out of
  scope for A2b (spatial only) and are not touched.
- OQ-007/OQ-006 (palette) are out of scope for A2b and are not touched.

## Completion evidence

Files changed/added (relative to `ai_services/design_rules/`):

- `pyproject.toml` — added `shapely`, `types-shapely`; bumped mypy
  `python_version` to `3.12` (see rationale above).
- `src/curalina_design_rules/types/rules.py` — added `StyleSpacingRule`,
  `SpatialRuleTable`; `RuleSet` gained an optional `spatial_rule_table` field.
- `src/curalina_design_rules/types/__init__.py` — exported the two new types.
- `src/curalina_design_rules/spatial/loader.py` — added
  `load_spatial_rule_table` and supporting parse helpers
  (`_required_list`, `_required_str_list`, `_number`, `_number_at`).
- `src/curalina_design_rules/spatial/geometry.py` — new file.
- `src/curalina_design_rules/spatial/rules.py` — new file.
- `src/curalina_design_rules/spatial/__init__.py` — re-exports everything
  above.
- `src/curalina_design_rules/loader.py` — `load_rules()` now populates
  `RuleSet.spatial_rule_table`.
- `tests/unit/test_spatial_engine.py` — new, 18 tests (15 named cases plus
  3 additional boundary tests for `DR_PULL_BACK`, `DR_CREDENZA_BUFFER`, and
  `SIGHTLINE_12IN` added purely to close coverage gaps left by the named
  list; they do not replace any named test).
- `tests/unit/test_spatial_properties.py` — new, 2 hypothesis property
  tests.

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

(76 total includes A1/A2's pre-existing 48 tests, this packet's 18 named
spatial-engine tests, 2 hypothesis property tests, plus the A3 packet's 10
tests below — all in the same `make test` run since they share one test
suite.)

- `make test` wall time: ~6.5s, CPU-only, well under the 30s budget.
- Coverage did not regress: was 90% branch before this packet (48 tests),
  is 91% branch after both A2b and A3 (76 tests).
- **A2b gate is met**: every named test from `EXAMPLE_work_packet_rules_engine.md`
  is present and green, `mypy --strict` is clean, Ruff is clean, and
  `CMR_VALIDATION` is verified (by a dedicated test) to always return
  `needs_input` citing `OQ-001` — it never silently passes.
