# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A2b — rule evaluation pipeline (extends the gate named in
`agentic_flow/AMENDMENTS.md` A7)
Owner: `python-services-engineer`
Reviewer: `tech-lead` (ADR-0004 interim owner) + design authority (real
decision owner for `OQ-013`, has not ruled)

## Objective

Implement the ADR-0004 interim reading of §9.1 `MIN_WALKWAY` — a
reachability test between circulation endpoints, composed over
`check_reachability`'s existing connected-component semantics — alongside
the existing literal whole-free-floor reading (`has_walkway`/
`check_walkways`), which is left unchanged as the revert path. This is
implementation of an already-made ADR, not a re-derivation of the decision
and not a resolution of `OQ-013`, which stays `open` /
`owner: design_authority`.

## Context

Required guides:

- `architecture/adr/ADR-0004-walkway-clearance-interim-interpretation.md`
  (the spec for this packet — read in full before implementing)
- `agentic_flow/open_questions.yaml` (`OQ-013`, read only, unchanged)
- `agentic_flow/12_design_rules_engine.md` lines 151–166 (opening-test
  pseudocode; line 164 names reachability as the intended endpoint-
  connectivity primitive)
- `ai_services/work_packets/RULES-A2b-01.md` (prior packet; this one only
  adds to `spatial/geometry.py` and does not touch anything RULES-A2b-01
  already delivered)

## Allowed files

- `ai_services/design_rules/src/curalina_design_rules/spatial/geometry.py`
- `ai_services/design_rules/src/curalina_design_rules/spatial/__init__.py`
- `ai_services/design_rules/tests/unit/test_walkway_adr0004.py` (new)
- `ai_services/work_packets/RULES-A2b-02.md`

## Do not change

- `agentic_flow/open_questions.yaml` — `OQ-013` stays `open` /
  `owner: design_authority`; not edited.
- `has_walkway`, `check_walkways` (the literal §9.1 reading) — kept exactly
  as they were; this packet adds a new function alongside them, it does not
  modify or replace either.
- `spatial/rules.py` — no change needed; the new reading reuses
  `check_reachability` directly rather than adding a new named-rule wrapper.
- `api.py` / `evaluate_spatial_layout` — the A3 entry point still calls the
  literal `check_walkways`; wiring `check_walkways_adr0004` into that entry
  point (which needs a source of doorway/functional-zone positions per
  room) is out of scope for this packet and is not attempted here to avoid
  guessing that input source.
- Any other service package, `architecture/**`, `agentic_flow/**`,
  `agent_instructions/**`.

## Deliverables

- `spatial/geometry.py`: added, after `check_reachability`, without
  touching anything above it:
  - `ADR_0004_MARKER = "9.1 (ADR-0004 interim)"` — the marker every result
    produced under this reading carries.
  - `Adr0004WalkwayResult` (frozen dataclass): `violations: tuple[Violation,
    ...]`, `interim_marker: str = ADR_0004_MARKER`, `passes` property. Used
    instead of a bare `tuple[Violation, ...]` specifically so a *pass* also
    carries the marker — a pass produces no `Violation` of its own to carry
    one on, and ADR-0004 requires "every layout accepted... must carry a
    marker".
  - `check_walkways_adr0004(placements, room, min_walkway_mm,
    doorway_points, functional_zone_points) -> Adr0004WalkwayResult` —
    builds the required pairs (every doorway to every other doorway, every
    doorway to every functional zone) and calls the existing
    `check_reachability` for each pair; any pair not connected in the
    space opened by `min_walkway_mm / 2` produces one `HARD` `MIN_WALKWAY`
    violation naming how many of how many pairs failed, with
    `source_section=ADR_0004_MARKER`. If either `doorway_points` or
    `functional_zone_points` is empty, returns `needs_input` citing
    `OQ-013` instead of guessing endpoint coordinates.
- `spatial/__init__.py`: exports `ADR_0004_MARKER`, `Adr0004WalkwayResult`,
  `check_walkways_adr0004` alongside the existing `has_walkway`/
  `check_walkways` exports (both unchanged).
- `tests/unit/test_walkway_adr0004.py` (new, 4 named tests — see Acceptance
  criteria).

## Local commands

Required before completion:

```bash
cd ai_services/design_rules
make check
```

## Acceptance criteria

- `test_adr0004_passes_furniture_gap_narrower_than_walkway_when_endpoints_reachable`:
  reuses the `condo_living_room_conversation_circle` golden fixture (the
  exact case `OQ-013` cites — 381mm sofa-to-table gap vs. 813mm condo
  minimum). Proves the literal `check_walkways` still fails on it (regression
  guard on the documented failure mode itself), then proves
  `check_walkways_adr0004` passes given a doorway and seating-zone point
  that remain connected by routing around the sofa/table grouping.
- `test_adr0004_fails_when_circulation_endpoints_are_genuinely_blocked`:
  reuses the `condo_bedroom_pinched_ensuite_path` golden fixture (a
  full-depth wardrobe genuinely pinching the only route between bed and
  ensuite doorways). Proves `check_walkways_adr0004` still fails this case —
  the interim reading accepts a harmless pinch nobody walks through, but
  not a pinch that blocks a required path.
- `test_adr0004_missing_circulation_endpoints_returns_needs_input_citing_oq_013`:
  proves empty `doorway_points`, empty `functional_zone_points`, and both
  empty each independently return `needs_input` with
  `open_question_id == "OQ-013"` — never a guessed/synthesized coordinate.
- `test_has_walkway_literal_reading_unchanged_regression`: calls
  `has_walkway` and `check_walkways` with the exact same call shapes used
  before this packet and asserts identical results, proving the literal
  reading (the revert path) is untouched.
- Every `Violation` produced under the new reading — `HARD` and
  `needs_input` alike — has `source_section == ADR_0004_MARKER ==
  "9.1 (ADR-0004 interim)"`; every `Adr0004WalkwayResult`, pass or fail,
  carries `interim_marker`.
- `OQ-013` in `agentic_flow/open_questions.yaml` is unmodified and still
  reads `status: open`, `owner: design_authority`.
- No existing test in the 76-test suite this packet inherited regressed.
- `mypy --strict` and Ruff clean; no pandas/I/O/framework import introduced.

## Known blockers

- **OQ-013 stays open.** This packet implements the ADR-0004 interim
  reading only; it does not and cannot resolve whether §9.1 means the
  literal whole-free-floor test or the reachability test. Every result
  produced by `check_walkways_adr0004` carries the ADR-0004 marker
  specifically so a later `design_authority` ruling can find and
  re-evaluate every affected result, per the ADR's "Consequences and
  reversal" section.
- Wiring `check_walkways_adr0004` into `evaluate_spatial_layout` (`api.py`)
  is not done here: that entry point has no source of doorway/functional-
  zone positions per room today, and inventing one would be exactly the
  kind of guessed input this project's process forbids. That wiring is a
  follow-on packet once a room-geometry doorway/zone input source exists
  (see ADR-0004's note that this "may interact with `OQ-010`").
- D01's conformance record is not updated by this packet (out of the
  allowed-files list); the ADR itself already directs that the notebook's
  record be updated separately to say it measures against an interim
  interpretation.

## Completion evidence

Files changed (relative to `ai_services/design_rules/`):

- `src/curalina_design_rules/spatial/geometry.py` — added
  `ADR_0004_MARKER`, `Adr0004WalkwayResult`, `check_walkways_adr0004`
  after the existing `check_reachability`; nothing above it in the file was
  touched (`has_walkway`, `check_walkways`, `check_reachability` are
  byte-for-byte the same logic as before, only a `from dataclasses import
  dataclass` addition to the import block).
- `src/curalina_design_rules/spatial/__init__.py` — exported the three new
  names; existing exports unchanged.
- `tests/unit/test_walkway_adr0004.py` — new, 4 named tests (listed above).

Exact commands run and their real results (2026-09-13, this session):

```
$ cd ai_services/design_rules && make check
python3 -m ruff check --no-cache .
All checks passed!
python3 -m mypy --strict --cache-dir=/tmp/curalina_design_rules_mypy_cache src/curalina_design_rules
Success: no issues found in 20 source files
PYTHONDONTWRITEBYTECODE=1 COVERAGE_FILE=/tmp/curalina_design_rules.coverage python3 -m pytest -p no:cacheprovider
...
collected 80 items
tests/unit/test_api.py .....
tests/unit/test_contracts.py ...........
tests/unit/test_golden_scenarios.py .....
tests/unit/test_rule_loaders.py ......
tests/unit/test_rule_source_metadata.py .............................
tests/unit/test_scaffold.py ..
tests/unit/test_spatial_engine.py ................
tests/unit/test_spatial_properties.py ..
tests/unit/test_walkway_adr0004.py ....
TOTAL branch coverage: 91%
80 passed in 7.72s
```

- 80 = the pre-existing 76 (all still passing, unchanged) + this packet's
  4 new named tests. No regression.
- Branch coverage held at 91% (was 91% before this packet;
  `spatial/geometry.py` itself is at 96% branch, missing only two
  defensive branches in `_component_containing`/`check_reachability` that
  predate this packet).
- `mypy --strict` clean across all 20 source files (up from the file count
  before only in that `geometry.py` now has more lines; no new file added).
- Ruff clean.
- Verified directly (ahead of writing the test file) with a throwaway
  interpreter session against the golden scenarios: literal `check_walkways`
  fails `condo_living_room_conversation_circle` with `measured=812.0,
  required=813.0` (the 381mm gap), while `check_walkways_adr0004` with a
  doorway at `(3800, 1500)` and a seating-zone point at `(700, 2300)`
  returns `Adr0004WalkwayResult(violations=(), interim_marker='9.1
  (ADR-0004 interim)')` — confirming the pass is for the documented reason
  (alternate route around the furniture pinch), not an accidentally
  permissive check.
- **`OQ-013` verified unmodified**: `agentic_flow/open_questions.yaml` was
  not part of this diff; its `OQ-013` entry still reads `status: open`,
  `owner: design_authority` (confirmed by re-reading the file after
  implementation, not just by omission from the allowed-files list).
- **Gate status**: this extends A2b's existing gate (already met by
  RULES-A2b-01) with the ADR-0004 interim reading; it does not itself
  constitute or claim a §9.1 conformance ruling, and G-gate sign-off must
  continue to treat §9.1 as unsettled per the ADR.
