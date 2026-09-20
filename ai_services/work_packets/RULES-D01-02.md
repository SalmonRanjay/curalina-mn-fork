# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A6-equivalent — D01 re-run (`D01_rules_conformance`)
Owner: `ml-notebook-engineer`
Reviewer: `ai-ml-lead` (signs the gate; this packet produces evidence only)

## Objective

Re-run `D01_rules_conformance.ipynb` per `ADR-0014` §D2's four named items,
after `ADR-0010` changed `evaluate_spatial_layout`'s `MIN_WALKWAY` handling
and `ADR-0009` located and read the Design Manual's §8 — without exceeding
`ADR-0014`'s scope (no fixture re-authoring to pass, no new scenarios, no
`src/` changes).

## Context

Required reading, in order: `agent_instructions/STATUS.md` (operational
reference, dispatch item 6), `architecture/adr/ADR-0014-d01-status-and-design-manual-section-8-evidentiary-role.md`
§D2, `architecture/adr/ADR-0010-spatial-layout-circulation-endpoints.md`,
`architecture/adr/ADR-0009-design-manual-primary-source-provenance.md`,
`agentic_flow/16_notebook_standard.md`.

## Allowed files

- `ai_services/design_rules/tests/fixtures/golden_scenarios.py` — add
  declared, labelled-synthetic fields only (`ADR-0014` §D2 item 2, option
  (b)); no re-authoring of existing scenario geometry to make anything
  pass.
- `ai_services/design_rules/notebooks/D01_rules_conformance.ipynb`
- `ai_services/design_rules/notebooks/runs/**` (new run directory only —
  the `20260913T022937Z` run directory is untouched)
- `ai_services/work_packets/RULES-D01-02.md`

## Do not change

- Anything under `ai_services/design_rules/src/`.
- `agentic_flow/open_questions.yaml`.
- The existing `notebooks/runs/D01_20260913T022937Z/` artifacts.

## What was done

### 1. Fixture change

`tests/fixtures/golden_scenarios.py`: `GoldenScenario` gained three new
optional fields — `sofa_placement_id: str | None`, `bed_point: Point |
None`, `ensuite_door_point: Point | None` — with a comment on the
dataclass explicitly labelling them **"Synthetic, fixture-authored
geometry -- NOT client data"** and citing `OQ-010`/`ADR-0010`. The two
sofa-carrying scenarios (`condo_living_room_conversation_circle`,
`large_living_room_floating_anchor_violation`) now set
`sofa_placement_id="inst_sofa"`. `condo_bedroom_pinched_ensuite_path` now
sets `bed_point=Point(10, 10)` and
`ensuite_door_point=Point(room.boundary[1].x_mm - 10, 10)` — the identical
values the notebook previously minted inline, moved onto the fixture and
labelled, not changed, per `ADR-0014`'s instruction to move the points,
not re-author the scenario.

### 2. Notebook change

`D01_rules_conformance.ipynb` cell 7 (Execution) no longer imports
`curalina_design_rules.types.Point` or constructs any `Point(...)`. It
reads `s.sofa_placement_id`, `s.bed_point`, `s.ensuite_door_point` off the
fixture and looks up the sofa placement by `instance_id` equality instead
of `s.placements[0]`. Markdown cells 0, 1, 3, the new "closed finding" cell
(formerly the `MIN_WALKWAY` unanticipated-finding cell), the decision
record (cell "6"), and the handoff note were all rewritten to: (a) cite the
Design Manual by path + sha256
`7d450d28facc0ff87c40e7e6f5c33bbbb7f7d13e653aec6be07ced79b4c65cca` wherever
referenced, never as "the Design Manual says"; (b) state §8 is
**inapplicable**, not **unavailable**; (c) record that the original
`MIN_WALKWAY` finding was correct and is now corroborated and closed at the
engine level, not silently dropped; (d) keep the decision at
`accept-with-limitations`.

### 3. Re-execution

Executed fresh end to end via
`jupyter nbconvert --to notebook --execute --inplace --ExecutePreprocessor.kernel_name=curalina-py314`
(the notebook's saved `kernelspec.name` is the generic `python3`, which on
this machine resolves to a stray Python 3.9 interpreter lacking `datetime.UTC`
and the package install — `curalina-py314` is the correct kernel, same one
`RULES-D01-01.md` registered; this is an environment note, not a content
change). Zero error cells.

## Verification — real output, not assumed

**`expect_passes_hard_spatial` mismatch count: 1 of 4 (was 3 of 4).**
Verified by reading the executed notebook's own printed cell output, not
assumed from `ADR-0014`'s prediction:

```
1 of 4 scenarios mismatch their fixture module's stated expect_passes_hard_spatial
(CMR_VALIDATION set aside as its own separate, always-needs_input finding -- see below):

  MISMATCH  condo_bedroom_pinched_ensuite_path: fixture docstring claims a pass,
  engine additionally fired ('BR_ENSUITE_PATH',)
```

This matches `ADR-0014`'s prediction exactly (1/4, not some other number).
`MIN_WALKWAY` moved to `needs_input`/`OQ-013` on all 4 scenarios (was `hard`
on 3 of 4) — confirmed in `metrics.csv` (`hard` column now 0/0/1/1 instead
of 1/1/2/2, `needs_input` column now 2/2/2/2 instead of 1/1/1/1) and in
`all_violations.csv` (`MIN_WALKWAY` rows now `severity=needs_input`,
`open_question_id=OQ-013`, `source_section="9.1 (ADR-0004 interim)"`, for
all four scenarios).

`BR_ENSUITE_PATH` still fires `hard` on `condo_bedroom_pinched_ensuite_path`
— unchanged from the prior run, because `check_br_ensuite_path` was
untouched by `ADR-0010` and its endpoints (now sourced from the labelled
fixture fields, not minted inline) are the same values as before. This is
the fixture's own documented intent (a deliberate reachability failure a
consumer must check separately from `evaluate_spatial_layout`), not a new
defect.

New run directory: `ai_services/design_rules/notebooks/runs/D01_20260915T041535Z/`
(`manifest.json`, `metrics.csv`, `metrics.json`, `all_violations.csv`,
`decision_record.json`). The prior run directory
`runs/D01_20260913T022937Z/` is untouched, so the before/after is
auditable side by side.

## Test suite verification (real, independently re-run)

```
$ make -C ai_services/design_rules lint
All checks passed!

$ make -C ai_services/design_rules typecheck
Success: no issues found in 20 source files

$ python3 -m mypy --strict tests/fixtures/golden_scenarios.py
Success: no issues found in 1 source file

$ make -C ai_services/design_rules test
============================== 83 passed in 7.19s ==============================
TOTAL branch coverage 92% (unchanged; api.py 100%, spatial/geometry.py 100%)

$ make -C ai_services test-all
83 passed   (design_rules)
264 passed  (recommendation)
96 passed   (variants)
73 passed   (rooms)

$ make -C ai_services test-contracts
7 passed
```

No regression anywhere. `curalina_design_rules` test count is unchanged at
83 (the fixture change added fields with defaults; no new tests were added
or required by this packet's scope, and none of the four out-of-scope
items — new scenarios, fixture re-authoring, `src/` changes — were
attempted).

## Decision record (unchanged verdict, changed reasons)

**`accept-with-limitations`.** Per `ADR-0014` D1, this re-run does not
promote D01. What changed:

- `MIN_WALKWAY` no longer trips as a spurious hard violation on
  "passing" fixtures — **dissolved** into `needs_input`/`OQ-013`, and the
  notebook explicitly records that its own original diagnosis (an
  over-strict whole-free-floor reading of §9.1, not a fixture-authoring
  defect) is now **corroborated** by `ADR-0009`'s direct read of the
  Design Manual (sha256 `7d450d28facc0ff87c40e7e6f5c33bbbb7f7d13e653aec6be07ced79b4c65cca`,
  169 pages: zero whole-floor language for walkway/circulation-path/
  access-path/dead-zone across all pages, p151 separates walkways/access
  paths/functional spacing as three distinct things). This is stated as a
  correct behaviour change and a correct original finding — not silently
  dropped.
- The prior run's fabricated-geometry defect (`Point(10, 10)` and
  `placements[0]`-as-sofa minted inline) is corrected: `bed_point`,
  `ensuite_door_point`, `sofa_placement_id` are now declared,
  labelled-synthetic fields on the fixture.
- §8 is ruled **inapplicable**, not **unavailable** — the Design Manual is
  now admitted (`ADR-0009`) and §8 (pp147–150) was read directly: four
  colour/material/tectonic narrative proofs, zero spatial content. It
  cannot confirm or falsify a spatial gate either way (`ADR-0014` §D4).
- `OQ-001`/CMR remains genuinely undefined (unchanged), and
  `style.py`/`palette.py`/`pruning` remain unbuilt (unchanged).

**D01 stays `accept-with-limitations` per `ADR-0014`'s ruling.** It is not
promoted by this packet, and per `ADR-0014` D3 nothing an engineer can do
moves it further while `OQ-001`, `OQ-010`, `OQ-013`, and the four unbuilt
rule families remain open — this should not be re-queued as an engineering
backlog item.

## Out of scope, and confirmed not attempted

- No fixture re-authoring beyond the four new declared fields — geometry
  values for the sofa/bed/table/credenza/wardrobe placements are byte-for-
  byte identical to the prior run.
- No new scenarios added; `ALL_SCENARIOS` is still exactly the same four.
- No `src/` changes — `evaluate_spatial_layout`, `check_lr_floating_anchor`,
  `check_br_ensuite_path`, `has_walkway`, `check_walkways_adr0004` are all
  untouched by this packet (their behaviour changed only because `ADR-0010`
  changed `api.py` in a prior, separate session).
- `agentic_flow/open_questions.yaml` was not opened or edited.
