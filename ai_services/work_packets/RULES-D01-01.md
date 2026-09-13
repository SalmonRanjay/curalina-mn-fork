# Agent work packet

## Task

Service: `curalina_design_rules`
Phase: A6-equivalent — conformance notebook and handoff (`D01_rules_conformance`)
Owner: `ml-notebook-engineer`
Reviewer: `ai-ml-lead` (signs the gate; this packet produces evidence only)

## Objective

Build and actually execute the `D01_rules_conformance` notebook per the
7-section standard in `agentic_flow/16_notebook_standard.md`, run it against
the A3 golden-scenario fixture set, and end with a written decision record —
without fabricating a Design Manual §8 conformance claim that the available
inputs cannot support.

## Context

Required guides:

- `agent_instructions/00_design_rules_engine.md` (A6-equivalent bullet)
- `agentic_flow/12_design_rules_engine.md` (§8 framing, "golden scenario" test
  row, build order)
- `agentic_flow/16_notebook_standard.md` (7-section structure, manifest cell
  template, notebook inventory row for `D01_rules_conformance`)
- `agentic_flow/open_questions.yaml` (all twelve `OQ-xxx`)
- `agentic_flow/R02_ranking_baseline.ipynb` (structural reference only)
- `ai_services/work_packets/RULES-A2b-01.md`, `RULES-A3-01.md`

Input data, fixtures or decisions:

- `ai_services/design_rules/tests/fixtures/golden_scenarios.py` — the four
  **representative** fixtures built from `spatial_rules.yaml` thresholds.
  Its module docstring and `RULES-A3-01.md`'s "Known blockers" section both
  already record, independently of this packet, that
  `Training_Doc_1_-_Design_Manual.pdf` (and therefore its §8 text) is not
  present anywhere in this repository. I re-verified this with my own
  full-tree search before writing the notebook; the finding is unchanged.

## Allowed files

- `ai_services/design_rules/notebooks/D01_rules_conformance.ipynb` (new)
- `ai_services/design_rules/notebooks/runs/**` (new — run artifacts)
- `ai_services/work_packets/RULES-D01-01.md`

## Do not change

- Any file under `ai_services/design_rules/src/` or `tests/` — this packet
  is notebook-only; no package code was touched, and none needed to be
  (every cell calls existing `curalina_design_rules` entry points).
- `agentic_flow/**`, `architecture/**`, `agent_instructions/**`.

## Deliverables

- `notebooks/D01_rules_conformance.ipynb` — 7 sections, executed top to
  bottom with real outputs retained in the file (not stripped):
  0. Manifest — run ID, git SHA (+ dirty flag), `rules_version`
     (`2026.09.12-a`, via `pinned_rules_version()`), `snapshot_id: None`
     (no catalogue snapshot — this notebook exercises spatial geometry only,
     not catalogue-backed products; see OQ-011), seed `20260912`, package
     versions (`curalina-design-rules 0.0.0`, `shapely 2.1.2`, `PyYAML
     6.0.3`), hardware (`CPU-only`).
  1. Purpose and exit criteria — states plainly, before any results appear,
     that §8 conformance cannot be claimed and names exactly what the run
     can and cannot prove.
  2. Inputs — `load_rules()` + `fixtures.golden_scenarios.ALL_SCENARIOS`
     only; no ad-hoc parsing.
  3. Execution — `evaluate_spatial_layout` (the A3 entry point) plus the two
     named A2b checks the fixture module documents as needing extra points
     (`check_lr_floating_anchor`, `check_br_ensuite_path`) — package calls
     only, no rule logic in any cell.
  4. Metrics — a pandas table (presentation only, matching the R02
     reference pattern) built from `RuleResult`/`Violation` objects, with
     every row labelled `REPRESENTATIVE (not Design Manual §8)`.
  5. Failure analysis — every violation retained (`all_violations.csv`, 10
     rows across 4 scenarios, nothing filtered), plus an explicit
     expectation-vs-actual mismatch check and a dedicated write-up of the
     unanticipated finding described below.
  6. Decision record — `accept-with-limitations`, written as
     `decision_record.json` and printed in the notebook, plus a handoff
     note for `ai-ml-lead`.
- Run artifacts under `notebooks/runs/D01_<timestamp>/`: `manifest.json`,
  `metrics.csv`/`.json`, `all_violations.csv`, `decision_record.json`.

## Local commands

Required before completion (all run from `ai_services/design_rules/`):

```bash
python3 -m pip install --quiet nbformat nbclient ipykernel pandas   # not preinstalled
python3 -m ipykernel install --user --name curalina-py314 --display-name "curalina (py3.14)"
cd notebooks
python3 -c "
import nbformat
from nbclient import NotebookClient
nb = nbformat.read('D01_rules_conformance.ipynb', as_version=4)
NotebookClient(nb, timeout=120, kernel_name='curalina-py314',
               resources={'metadata': {'path': '.'}}).execute()
nbformat.write(nb, 'D01_rules_conformance.ipynb')
"
```

Result: notebook executed cleanly, zero error cells, all 19 cells populated
with real outputs (verified by scanning `cell['outputs']` for
`output_type == 'error'` after the run — none found).

Note on environment: the pre-registered Jupyter kernel
(`~/Library/Jupyter/kernels/python3`) pointed at
`/Library/Developer/CommandLineTools/usr/bin/python3`, a different
interpreter from the one `curalina-design-rules` is installed into
(`/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`). A new
kernelspec (`curalina-py314`) was registered pointing at the correct
interpreter — this is a one-time local environment fix, not a notebook
content change.

## Acceptance criteria

- All 7 sections present, in order, matching `16_notebook_standard.md`.
- Manifest cell complete (no placeholder fields left as `None` except
  `snapshot_id`, which is correctly `None` because no catalogue is involved
  at this phase).
- No cell contains business logic — every Section 3/4/5 cell calls into
  `curalina_design_rules.api`/`curalina_design_rules.spatial` or aggregates
  their typed results with pandas/stdlib for display, mirroring the R02
  reference pattern exactly (`import pandas as pd  # presentation only`).
- No §8 conformance claim anywhere in the notebook. Every table row and the
  decision record label the fixtures `REPRESENTATIVE (not Design Manual
  §8)`.
- Decision record is `accept-with-limitations`, not a clean `accept`, and
  lists every `OQ-xxx` the notebook's scope actually touches (`OQ-001`
  directly exercised; `OQ-002`, `OQ-004`, `OQ-007` named per the notebook
  inventory's "Blocked by" column, with an honest note that `style.py`/
  `palette.py` don't exist yet so those three couldn't even be exercised,
  only cited) plus the remaining eight `OQ-xxx` listed as open project-wide
  but out of this notebook's spatial-only scope.
- Every failure retained and shown (Section 5), not summarized away.
- Notebook was actually executed; outputs in the committed `.ipynb` are
  real, not hand-written to look plausible.

## Known blockers

- **§8 golden scenarios do not exist in this repository** — same gap
  `RULES-A3-01.md` already recorded. `Training_Doc_1_-_Design_Manual.pdf`
  is not checked in anywhere; only unrelated marketing/quiz PDFs exist
  under `attached_assets/`. This blocks a true D01 gate outcome above
  `accept-with-limitations` until the design authority supplies the text
  (or an equivalent extract) or explicitly accepts representative fixtures
  as a permanent substitute for this gate.
- **New finding, surfaced only by actually running the notebook (not
  previously recorded anywhere):** `MIN_WALKWAY` fires as a **hard**
  violation on 3 of the 4 representative fixtures
  (`condo_living_room_conversation_circle`,
  `mid_dining_room_service_perimeter`,
  `condo_bedroom_pinched_ensuite_path`), even though each of those three
  fixtures' own docstring in `golden_scenarios.py` asserts an easy pass
  ("well within the 32in walkway minimum", "collision-free"). Root cause,
  traced into `spatial/geometry.py`: `has_walkway` implements a strict
  morphological-opening test requiring that **all** free floor area survive
  erosion by half the minimum walkway width — not merely that some path of
  sufficient width exists. The fixtures place furniture close enough to a
  wall (e.g. ~254mm/10in gaps) that a thin sliver of free space fails that
  erosion test, even though the room has ample open circulation elsewhere.
  `12_design_rules_engine.md` specifies exactly this erode-then-dilate
  primitive for every §9 walkway/reachability rule, so this reads as the
  engine doing what it was told against fixtures authored for a different
  purpose (exercising A3's spacing/proportion rules) without full-perimeter
  clearance in mind. This is **not** one of the twelve `OQ-xxx` — it is
  recorded as a new, separate open item in the decision record
  (`unanticipated_findings`) rather than being folded into an existing
  question it does not match, and rather than being silently smoothed out
  of the metrics table. Only the deliberately-constructed failure scenario
  (`large_living_room_floating_anchor_violation`) matches its stated
  expectation once `CMR_VALIDATION` is set aside as its own separate,
  always-`needs_input` finding.
- `OQ-001` (`CMR_VALIDATION`) fires `needs_input` on all 4 scenarios, exactly
  as A2b/A3 already established — no new handling, passed through unchanged.
- `style.py`/`palette.py` do not exist in `curalina_design_rules` as of this
  run (confirmed live in the notebook via `importlib.import_module` probes
  against `curalina_design_rules.style`, `.palette`, `.pruning`, all three
  reporting `NOT IMPLEMENTED`) — so `OQ-002`, `OQ-004`, `OQ-007` (and
  `OQ-003`, `OQ-005`, `OQ-006`, `OQ-008`) could not be exercised at all in
  this notebook, only cited as still-open per the project inventory.

## Completion evidence

Files changed/added (relative to `ai_services/design_rules/`):

- `notebooks/D01_rules_conformance.ipynb` — new, 19 cells (10 markdown, 9
  code), executed with real outputs retained.
- `notebooks/runs/D01_20260913T022937Z/` — new, run artifacts:
  `manifest.json`, `metrics.csv`, `metrics.json`, `all_violations.csv`,
  `decision_record.json`.

Exact commands run and their real results (2026-09-13, this session):

```
$ pip install --quiet nbformat nbclient ipykernel pandas
(installed: nbformat 5.11.1, nbclient 0.11.0, pandas 3.0.5, ipykernel)

$ python3 -m ipykernel install --user --name curalina-py314 --display-name "curalina (py3.14)"
Installed kernelspec curalina-py314 in /Users/rjsalmon/Library/Jupyter/kernels/curalina-py314

$ cd ai_services/design_rules/notebooks && python3 -c "... NotebookClient(...).execute() ..."
EXECUTED OK   (0 error cells; scanned all 9 code cells' outputs)
```

Real metrics from the executed run (`runs/D01_20260913T022937Z/metrics.csv`):

| scenario_id | expected pass | api_passes_hard | hard | needs_input | rule_ids_fired |
|---|---|---|---|---|---|
| condo_living_room_conversation_circle | True | False | 1 | 1 | CMR_VALIDATION, MIN_WALKWAY |
| mid_dining_room_service_perimeter | True | False | 1 | 1 | CMR_VALIDATION, MIN_WALKWAY |
| large_living_room_floating_anchor_violation | False | False | 2 | 1 | CMR_VALIDATION, LR_FLOATING_ANCHOR, MIN_WALKWAY |
| condo_bedroom_pinched_ensuite_path | True | False | 2 | 1 | BR_ENSUITE_PATH, CMR_VALIDATION, MIN_WALKWAY |

10 total violations retained across 4 scenarios, none filtered.
`api_passes_hard` is `False` for all four by construction while
`CMR_VALIDATION`/OQ-001 remains open — expected and by design, not a defect.

**Decision: `accept-with-limitations`.** Two independent, stated reasons it
is not a clean accept:

1. §8 conformance cannot be claimed — the source text does not exist in
   this repository.
2. Only 1 of 4 representative scenarios matches its own fixture-authoring
   docstring's stated expectation once `CMR_VALIDATION` is set aside — the
   `MIN_WALKWAY` finding above is real and unresolved.

**Not produced / explicitly out of scope for this packet:** no package
code (`style.py`, `palette.py`, or a fix to the `golden_scenarios.py`
fixtures / `has_walkway` semantics) was written or modified — this packet
is notebook-only per its allowed-files list. Resolving the `MIN_WALKWAY`
finding (either re-author the fixtures or confirm the strict reading is
intended) and supplying real §8 text are both follow-up decisions for the
design authority / a future packet, not something this notebook could
settle on its own authority.
