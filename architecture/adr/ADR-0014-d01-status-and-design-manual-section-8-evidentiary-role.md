# Architecture decision record

ID: ADR-0014 — D01 conformance status after `ADR-0009`/`ADR-0010`, and the
evidentiary role of Design Manual §8
Status: **accepted.** Gate decision (D01) plus an evidence-sufficiency
ruling (§8). D01 **stays at `accept-with-limitations`** but its recorded
limitations are now wrong in three places, so a **re-run is required**, not
a note. §8 is admitted as a **conformance target, not an evaluation set.**
Owner and reviewer: `ai-ml-lead` (gate and evidence authority).
**`design_authority` owns `OQ-001`, `OQ-013` and the §8 scenarios'
blocking questions. `ml-notebook-engineer` owns the re-run.**
Date: 2026-09-14

## Context

Two things changed under D01
(`ai_services/design_rules/notebooks/D01_rules_conformance.ipynb`, last run
`20260913T022937Z`) during session 8, and `agent_instructions/STATUS.md`
asked whether either changes its `accept-with-limitations` status.

D01's own handoff note names exactly two gaps holding it below a clean
accept:

1. Only 1 of 4 representative scenarios matched its fixture module's stated
   `expect_passes_hard_spatial` once CMR was set aside; the other three
   additionally tripped `MIN_WALKWAY` (and `BR_ENSUITE_PATH` for the
   bedroom) as **hard** violations.
2. No §8 conformance claim was possible, because §8's text was not in the
   repository.

`ADR-0010` changed what `evaluate_spatial_layout` returns. `ADR-0009`
located §8 and found it has no spatial content. I read both, read the
notebook's executed outputs in full, and read the current package source
rather than reasoning from the ADRs' summaries.

### What actually changes, gap by gap

**Gap 1, `MIN_WALKWAY` — dissolves, and D01 was right.**

`evaluate_spatial_layout` now calls `check_walkways_adr0004` with optional
endpoints defaulting to empty, and returns `needs_input` citing `OQ-013`
when they are absent — which is every D01 scenario. So the three
`MIN_WALKWAY` **hard** violations become **needs_input** violations, and the
"fixtures don't match their docstrings" finding evaporates for
`MIN_WALKWAY`.

More than that: **D01's own root-cause analysis is now confirmed by the
primary source.** D01 §5 offered two explanations and named option (b) —
that `12_design_rules_engine.md`'s whole-room "no pinched area anywhere"
reading of §9.1 is stricter than a designer would consider a real failure,
and is worth confirming with the design authority. `ADR-0009` searched all
169 manual pages and found **zero whole-floor language**, establishing that
the morphological opening is an artifact of
`agentic_flow/12_design_rules_engine.md` lines 151–160, not of §9.1.

**D01 surfaced a real defect, correctly diagnosed it, refused to smooth it
into the metrics, and the defect has since been fixed.** That is the
notebook standard working exactly as intended, and the re-run's decision
record should say so rather than quietly dropping a finding that no longer
fires.

**Gap 1, `BR_ENSUITE_PATH` — does not change, and a worse problem replaces it.**

`check_br_ensuite_path` calls `check_reachability` with endpoints the
*caller* supplies; `ADR-0010` touched neither. It will still fire.

But D01 cell 7 supplies those endpoints itself:

```python
bed_point = Point(10, 10)
ensuite_point = Point(s.room.boundary[1].x_mm - 10, 10)
```

**Those are invented coordinates with no source.** `ADR-0010` option (c) —
deriving endpoints heuristically from the boundary polygon — was rejected
outright as fabricating geometry and producing "a confident verdict from
invented input", and `ADR-0004` had already forbidden synthesising doorway
coordinates. Cell 7 does exactly the rejected thing, one line of it
literally reading a corner off the boundary.

**So D01's recorded `BR_ENSUITE_PATH` hard violation is a verdict computed
from fabricated input.** This was not visible as a defect when D01 ran on
2026-09-13, because the rule it violates was only codified by `ADR-0010`
the next day. It is visible now. The same pattern sits in the same cell for
`check_lr_floating_anchor`, which reads `s.placements[0]` as "the sofa" by
index — an assumption encoded in the notebook rather than in the fixture.

**This is a worse limitation than the one it replaces**, because the old
one was an honest disagreement between a fixture and an over-strict rule,
while this one is a number produced from data that does not exist.

**Gap 2, §8 — resolved as inapplicable, not as passed.**

`ADR-0009` located §8 at pp147–150 and found four narrative colour/
material/tectonic proofs with zero spatial content. I read those four pages
directly to confirm rather than relay: 8.1 OM, 8.2 CL, 8.3 CL, 8.4 MS, each
a quiz-input list followed by Gate 1/2/3 palette decisions, a 7.0 Tectonic
Layering anchor/feature/comfort triple, and a one-sentence narrative
result. **No floor plan, no dimension, no placement, no clearance, nothing
spatial.**

D01's claims are spatial. **§8 therefore cannot be a blocker on D01,
because §8 does not test what D01 tests.** The correct wording is
"§8 conformance is inapplicable to this notebook's scope", not "§8 is
unavailable" — and D01's current record says the latter, at length, in four
separate places.

**What does not change at all.** `CMR_VALIDATION` still fires `needs_input`
on `OQ-001` for every scenario, and `ADR-0009` confirmed `OQ-001` is
genuinely undefined ("Circulation-to-Mass Ratio" appears twice in 169 pages,
both as a bare name). `style.py`, `palette.py` and `pruning` still do not
exist — I confirmed by listing
`ai_services/design_rules/src/curalina_design_rules/`, which holds
`api.py`, `loader.py`, `constitution/`, `pipeline/`, `rules/`, `spatial/`,
`types/` and nothing else. D01 cell 16's `NOT IMPLEMENTED` result stands.

## Options

**(a) Append a note to D01's existing decision record.** Cheapest, and
wrong. D01's archived `metrics.csv`, `all_violations.csv` and
`decision_record.json` assert severities the code no longer produces —
`MIN_WALKWAY` as `hard` on four scenarios. A note appended to a data table
that contradicts it produces a record that argues with itself, and the CSVs
are what a future reader greps. The rule is not "re-run when the decision
changes", it is **"re-run when the recorded evidence stops being true"**.

**(b) Re-run and promote D01 to a clean accept**, on the grounds that both
named blockers are now resolved. Rejected. One is dissolved and one is
inapplicable, but `CMR_VALIDATION`/`OQ-001` is untouched, four rule
families remain unbuilt, and a new limitation (synthesised endpoints) is
strictly worse than the one it replaces. Promoting here would be lowering a
bar because the paperwork moved.

**(c) Re-run, keep `accept-with-limitations`, and rewrite the limitations
list to what is actually true.** Chosen.

**(d) Retire D01 and fold rules conformance into R03/G01.** Rejected —
those are blocked (`ADR-0013`, `ADR-0011`) and D01 is the only artifact
exercising the spatial engine end to end.

## Decision and rationale

### D1. D01 stays `accept-with-limitations`. It does not promote.

Two of its four grounds resolve, two stand, and one new one appears. Net:
the same gate verdict for a materially different and smaller set of
reasons.

| Limitation | Status after `ADR-0009`/`ADR-0010` |
|---|---|
| 3 of 4 fixtures trip `MIN_WALKWAY` as hard | **Dissolved.** Now `needs_input` on `OQ-013`. D01's diagnosis was correct and is corroborated by the manual. |
| §8 conformance unclaimable | **Resolved as inapplicable.** §8 has zero spatial content; it cannot bear on a spatial gate. |
| `CMR_VALIDATION` unconditional `needs_input` (`OQ-001`) | **Unchanged.** Confirmed genuinely undefined by `ADR-0009`. |
| Style/material/palette families unexercised | **Unchanged.** `style.py`/`palette.py`/`pruning` still absent; blocked on `OQ-002`–`OQ-009`. |
| *(new)* Notebook synthesises `BR_ENSUITE_PATH` endpoints and infers the sofa by list index | **New, and worse than what it replaces.** Violates `ADR-0004`'s and `ADR-0010`'s do-not-synthesise rule. |

### D2. A re-run is required, not a note. Scope is fixed below.

`ml-notebook-engineer`, under this role's sign-off. Four items, no more:

1. **Re-execute end to end** against current `curalina_design_rules` and
   regenerate all four run artifacts. `MIN_WALKWAY` will move to
   `needs_input`/`OQ-013` on all four scenarios and the
   `expect_passes_hard_spatial` mismatch count will change from 3/4 to
   1/4 — verify that, do not assume it.
2. **Stop synthesising endpoints.** Either (a) drop the
   `check_br_ensuite_path` call and record `needs_input` citing `OQ-010`
   for want of a geometry source, **or** (b) move `bed_point` /
   `ensuite_door_point` into `tests/fixtures/golden_scenarios.py` as
   declared fields of the fixture, labelled **synthetic, fixture-authored,
   not client geometry**. **(b) is preferred** — a representative fixture
   is allowed to declare its own synthetic geometry; a notebook is not
   allowed to mint it inline. Apply the same treatment to
   `check_lr_floating_anchor`'s `placements[0]`-is-the-sofa assumption:
   name the sofa in the fixture. **Under no circumstances keep the
   current inline `Point(10, 10)`.**
3. **Rewrite §8's framing.** Replace every "the source text was never
   supplied" passage — cell 0, cell 3, cell 18's rationale, cell 19 — with
   the inapplicability finding, citing `ADR-0009` and the manual's pinned
   sha256 `7d450d28…`. **Cite by hash, never "the Design Manual says"**
   (`ADR-0009`'s travelling caveat). Do not copy the manual into the repo.
4. **Record that D01's `MIN_WALKWAY` finding was correct and is now
   closed.** A notebook that surfaces a real defect and then silently
   loses the finding when the defect is fixed has lost the evidence that
   the process works.

**Out of scope, and must not be attempted in this packet:** re-authoring
fixtures to pass, adding scenarios, touching `src/`, or any change that
would make the `expect_passes_hard_spatial` mismatch count move for any
reason other than `ADR-0010`'s severity change.

### D3. D01 is at its ceiling, and that is a healthy state

Everything now holding D01 below a clean accept is owned by
`design_authority` or is downstream of unbuilt rule families that are
themselves blocked on open questions: `OQ-001` (CMR formula), `OQ-013`
(endpoint set — narrowed by `ADR-0009`, not closed), `OQ-010` (geometry
source), and `OQ-002`/`OQ-004`/`OQ-007`/`OQ-009` for the style and palette
families.

**Nothing an engineer can do moves D01 past `accept-with-limitations`.**
It should sit there indefinitely without being re-queued, in the same way a
service can sit at A3 with a working API while its model remains unproven.
Future sessions should not treat `accept-with-limitations` as a defect to
be worked off.

### D4. §8 is a **conformance target**, not an evaluation set

The optional question, ruled on because the answer is short and leaving it
open invites someone to build a metric on four narrative cases.

§8 is genuinely the only client-authored ground truth found anywhere in
this project, and its framing is unambiguous acceptance language: "a 'Test
Run' of these specific quiz combinations **must result in** the
architectural compositions described below" (p147). That is worth
something. It is not worth what an evaluation set is worth.

**Admitted as:** four named binary acceptance cases for the D-series, each
either reproduced or not. It supports an all-pass / not-all-pass conformance
statement.

**Not admitted as:** an evaluation set. Three independent reasons, any one
sufficient:

1. **n = 4, with no held-out split available.** Splitting four narrative
   cases 2/2 yields no statistical statement, and tuning against all four
   and reporting on all four is the rejected-result case in this role's
   standing rules, not a borderline one. No metric, no threshold, no
   confidence interval is computable.
2. **The expected outputs are not measurable quantities.** They are named
   intermediate decisions and material nouns — "Samples Oatmeal Node
   (approx. 12% Saturation)", "Locks Muted Olive", "Rift-cut White Oak
   base", "Honed Silver Travertine coffee table", "Emerald Mohair accent
   chairs", "Taj Mahal Quartzite fireplace plinth". Scoring these needs a
   `material_class` contract that `ADR-0005` established does not exist
   (`OQ-009`), against catalogue rows that also do not exist — `ADR-0013`
   confirms the admitted catalogues have zero lighting and zero rugs, and
   `Coffee Table` is a canonical category with zero rows in the combined
   workbook.
3. **Every scenario is currently un-runnable.** Each depends on at least
   two unbuilt modules and at least two open questions:

| Scenario | Needs | Blocked by |
|---|---|---|
| 8.1 OM | Gate 1 nodal sampling; 6.1 Performance Swap; 7.0 tectonic | `OQ-005`, `OQ-007`, `OQ-009`; `palette.py`, `style.py` absent |
| 8.2 CL | Gate 1/2/3; **3.5.2 Luster Fail-Safe, invoked by name** | `OQ-005`, `OQ-006`, `OQ-007`; both modules absent |
| 8.3 CL | Gate 1/2; 6.3 Millwork Engine ("Museum Shadow", ½" reveal) | `OQ-005`, `OQ-007`; **Millwork Engine has no `OQ-xxx` at all** |
| 8.4 MS | Gate 1/2/3; 7.0 tectonic | `OQ-005`, `OQ-007`, `OQ-009`; both modules absent |

**Two findings for `design_authority`, both new:**

- **`OQ-007`'s enumeration is incomplete relative to §8.** `OQ-007` names
  "Parchment, Chalk, Optic White, Light Grey, Alabaster, Mist, Oatmeal,
  Wheat, Obsidian, etc." §8.3 requires a **Fossil Node** (p149), which is
  absent from that list. The ask should be for the *complete* library, and
  should name Fossil explicitly so the client does not answer the partial
  question.
- **`OQ-007` stands in full, verified.** I searched all 169 pages for
  `#RRGGBB` tokens: **zero hits.** P81 states outright "The AI must not
  treat the colors below as static Hex codes", so the manual is
  prescriptive about nodal sampling while supplying no node values. This is
  a genuine, confirmed blank, not an extraction failure.
- **6.3's Millwork Engine has no tracked open question**, unlike the other
  §8 dependencies. Whether it needs one is `design_authority`'s call.

**Binding consequence:** §8 may be cited as a conformance target and its
four cases enumerated as a future acceptance checklist. **No number derived
from four narrative cases may be reported as an evaluation metric, and §8
must not be used to promote D01, R02 or R03.** It is not an evaluation set
for any of them.

## Consequences and reversal

### Consequences

- **D01 re-run is dispatchable now** (`ml-notebook-engineer`, scope D2,
  `ai-ml-lead` sign-off). It has no dependency on rooms A3 or on the
  variants work.
- **D01's status does not change** and no downstream consumer gains a
  stronger claim. `curalina_design_rules` remains the shared package it
  was, at the same gate.
- **A new limitation is on record** (synthesised endpoints) that was
  invisible until `ADR-0010` codified the rule it breaks. Worth noting as a
  pattern: an ADR can retroactively make an existing artifact
  non-conformant without anyone touching it.
- **§8 is now a named, enumerable acceptance checklist with a per-scenario
  dependency list**, which converts "the §8 examples exist" from a fact into
  four actionable asks. That list is the useful output of this ruling.
- `agentic_flow/open_questions.yaml` **not edited.** Two recommendations to
  `design_authority` (extend `OQ-007`'s enumeration to include Fossil and
  request the complete library; decide whether 6.3 Millwork needs an `OQ`)
  are recommendations, not edits — those questions are theirs.
- The manual is **not copied** into the repository. All citations are by
  path and sha256 `7d450d28…`, per `ADR-0009`.

### Reversal

- **If `design_authority` accepts representative fixtures as a permanent
  substitute for the §8 spatial gate** — which D01's own handoff note asks
  for — then §8's inapplicability stops being a limitation and becomes the
  agreed scope. D01 would still not promote, because `OQ-001` and the
  unbuilt families remain.
- **If `OQ-001` resolves with a CMR formula**, D01's largest standing
  limitation clears and a promotion review becomes worthwhile. That is the
  single highest-value unblock for D01 and should be the first ask.
- **If a later manual revision contains spatial worked examples in §8**,
  D4's inapplicability ruling reverses. `ADR-0009` flags this as a live
  risk: the admitted file carries no version or revision marker.

### What would prove this decision wrong

- **The re-run producing something other than 1/4 mismatch.** I predicted
  the outcome from reading the code; if the re-run disagrees, my reading of
  `check_walkways_adr0004`'s wiring is wrong and this ruling's gap-1
  analysis needs redoing. The re-run must report what it finds, not what
  this ADR predicts.
- **A per-scenario §8 dependency turning out to be already satisfiable.**
  The session-8 `research-scout` pass over the pinned manual for
  `OQ-002`–`OQ-009` could, for instance, find the anchor hex library in a
  section nobody has read. That would move 8.1/8.4 closer to runnable and
  make the conformance-target framing immediately useful rather than
  prospective.
- **`design_authority` ruling §9.1 literal (whole-free-floor).** Then
  `ADR-0004` and `ADR-0010` reverse, D01's original `MIN_WALKWAY` finding
  returns as a hard violation, and gap 1 un-dissolves. `ADR-0009` makes
  this substantially less likely but it is the client's call, not mine.

## Verification

- D01's executed outputs read in full from
  `ai_services/design_rules/notebooks/D01_rules_conformance.ipynb`
  (run `20260913T022937Z`, `rules_version 2026.09.12-a`, seed 20260912,
  Python 3.14.0): 4 scenarios, 10 retained violations, `MIN_WALKWAY` hard
  on 4/4, `CMR_VALIDATION` `needs_input`/`OQ-001` on 4/4,
  `LR_FLOATING_ANCHOR` hard on 1, `BR_ENSUITE_PATH` hard on 1, 3/4
  `expect_passes_hard_spatial` mismatches, decision
  `accept-with-limitations`.
- Cell 7 confirmed to contain `bed_point = Point(10, 10)` and
  `ensuite_point = Point(s.room.boundary[1].x_mm - 10, 10)`, and to read
  `s.placements[0]` as the sofa.
- `api.py` confirmed to call `check_walkways_adr0004` with
  `doorway_points` / `functional_zone_points` defaulting to `()`, and to
  propagate `interim_markers`.
- `spatial/rules.py:167` `check_br_ensuite_path` confirmed to call
  `check_reachability` with caller-supplied endpoints — unaffected by
  `ADR-0010`.
- `spatial/__init__.py` confirmed to export both `check_walkways` and
  `check_walkways_adr0004`, per `ADR-0010`'s rollback path.
- Package contents confirmed by listing: `api.py`, `loader.py`,
  `constitution/`, `pipeline/`, `rules/`, `spatial/`, `types/`. No
  `style.py`, no `palette.py`, no `pruning`.
- Design Manual pp147–150 extracted and read directly from
  `/Users/rjsalmon/Downloads/Training Doc 1 - Design Manual.pdf`, sha256
  re-verified as
  `7d450d28facc0ff87c40e7e6f5c33bbbb7f7d13e653aec6be07ced79b4c65cca`,
  169 pages. §8 contains scenarios 8.1–8.4; **no dimension, placement,
  clearance or floor plan appears on any of the four pages.**
- Full-document search: `#RRGGBB` → **0 hits**. `Fossil` → pp 77, 78, 82,
  89, 91, **149**. `Millwork Engine` → p150 only. `Delta E`/`ΔE` → 0 hits
  (recorded for `ADR-0012`, not used here).
- `agentic_flow/open_questions.yaml` **not edited**. No `OQ-xxx` changes
  status.

### Approval

No approval record exists. This is an `ai-ml-lead` gate and
evidence-sufficiency ruling. The re-run in D2 requires this role's sign-off
on completion; the `design_authority` recommendations in D4 are handed over,
not decided here.
