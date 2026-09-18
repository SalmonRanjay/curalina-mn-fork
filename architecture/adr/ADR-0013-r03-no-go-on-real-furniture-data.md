# Architecture decision record

ID: ADR-0013 — R03 (bundle composition): formal no-go on real furniture
data; proceed logic-only against labelled-synthetic fixtures
Status: **accepted.** Gate decision. This is the recorded `no-go` that
`agentic_flow/recommendation_workflow.md`'s own gate table anticipates. It
does **not** close `OQ-011`, does **not** reach stage gate **G2**, and does
**not** permit any downstream "meets acceptance thresholds" claim.
Owner and reviewer: `ai-ml-lead` (gate authority). **`OQ-011` remains
`open`, `owner: client`. `OQ-002`/`OQ-004`/`OQ-007`/`OQ-009` remain `open`,
`owner: design_authority`.**
Date: 2026-09-14

## Context

`agent_instructions/STATUS.md` has carried R03 for several sessions as
"likely a no-go but that's `ai-ml-lead`'s call". Leaving it implicit has a
cost: an implicit no-go is indistinguishable from an item nobody has got to
yet, and a future session can reasonably read the silence as "still
pending" and re-queue the investigation. The evidence is closed. This
records the decision.

`ADR-0005` already split `OQ-011` by consumer: satisfied for R01 (which
consumes a catalogue *as an object of audit*), not satisfied for R03 (which
consumes a catalogue *as a source of truth about what can be bought and
placed*). That split stands. What follows is the gate decision R03 needs on
top of it.

### The data evidence — verified by me, not relayed

The project's standing posture is that every agent report, including an
ADR, is a claim to verify. I re-derived each of the following directly.

**1. The combined workbook (md5 `3ad1f5d7`, 385 rows × 36 cols).**
Splitting `Furniture Category` on commas yields **27 distinct category
tokens**. The complete list of tokens matching
`rug|lamp|light|pendant|sconce|chandelier|chair` is:

| Token | Rows |
|---|---|
| `Dining Chairs` | 94 |
| `Reading Chair` | 6 |

**Zero rug categories. Zero lighting categories. Zero accent chairs.**
`ADR-0005`'s claim is confirmed against the column itself. (The 89-hit
keyword sweep that alarms a naive check lands entirely in `Overview`,
`Colour` and `Product Name`, never in `Furniture Category` — session 8
established this and I did not need to re-derive it, because the
column-level check above is strictly stronger.)

**2. `attached_assets/Four Hands Accent Chairs_1763831596643.xlsx`**
(md5 `1521feaf`). Despite its filename: **20 data rows, 19 `Bench` and 1
`Ottoman`, zero accent chairs.** `Delivery Options` 0/20, `LEAD Time` 0/20,
`Inventory` 20/20 but undated. The last "but maybe this file helps" thread
is closed. Its only contribution to the gap list is one ottoman.

**3. `ATRIANI/Design 44.xlsx`** (sha256 `f4b00dce…`, the third supplier
`ADR-0008` surfaced). 42 distinct products. **Zero rugs. Zero lighting.**

This one deserves a nuance the prior sessions did not draw out, because it
narrows one gap while leaving the decisive ones untouched. ATRIANI **does**
supply seating that the combined workbook lacks: `Cielo Accent Chair`,
`Vela Arm Chair`, `Abbraccio Armchair`, `Poltrona Chair Studio`,
`Minimalo Ottoman`. **So the accent-chair gap narrows and should stop being
cited as absolute.** But `Design 44.xlsx`'s ten columns are `Name`,
`Linl to pictures `, `Deficiency`, `Finish`, `Price` and five dimension
fields — **no inventory, no lead time, no delivery data of any kind.** It
narrows a seating gap and widens nothing else.

### Consolidated across all three sources

| R03 requirement | Combined workbook | Four Hands Accent Chairs | ATRIANI Design 44 |
|---|---|---|---|
| Rugs | **0** | **0** | **0** |
| Lighting | **0** | **0** | **0** |
| Accent / arm chairs | 0 | 0 | **5 products** |
| Ottomans | 0 | 1 | 1 |
| Delivery / availability data | 0/385 | 0/20 | **no such column** |

**Rugs, lighting and commercial availability are absent from every admitted
catalogue in the project.** That is not a sampling accident across three
independent sources.

### The second, independent cause — the engine cannot validate a bundle either

This did not appear in the brief and it changes the shape of the decision.

`agentic_flow/13_recommendation_technical_design.md:176` specifies that
bundle validation runs "through `curalina_design_rules`: spatial (§9),
style proportion (§1), colour (§3), material (§7), **lighting (§9.6)**",
and `:170` requires `pruning.prune()` (§9.7/§9.8) on an infeasible solve.

I checked the package.
`ai_services/design_rules/src/curalina_design_rules/` contains
`api.py`, `loader.py`, `constitution/`, `pipeline/`, `rules/`, `spatial/`,
`types/`. There is **no `style.py`, no `palette.py`, no `pruning`** — the
same absence D01 recorded on 2026-09-13 and which still holds. Four of the
five validation arms R03's own design names do not exist, and each is
blocked on a distinct, design-authority-owned open question:

| Validation arm | Module | Blocked by |
|---|---|---|
| Spatial (§9) | `spatial/` — **exists** | partially: `OQ-001` (CMR undefined, confirmed genuinely blank by `ADR-0009`), `OQ-013`/`OQ-010` (`ADR-0010`) |
| Style proportion (§1) | `style.py` — absent | `OQ-002`, `OQ-003` |
| Colour (§3) | `palette.py` — absent | `OQ-005`, `OQ-006`, `OQ-007`, `OQ-008` |
| Material (§7) | `style.py` — absent | `OQ-004`, `OQ-009` |
| Lighting (§9.6) | absent | `OQ-011` *and* the above |
| Pruning (§9.7/§9.8) | `pruning` — absent | — |

**Even a perfect catalogue delivered tomorrow would not make R03 runnable
today.** That is the load-bearing consequence: "wait for the catalogue" is
not a plan, because the catalogue is not the only thing missing.

## Options

**(a) Run R03 against the real catalogues as they are.** Rejected. A bundle
composer that cannot place a rug or a light source in a living room is not
exercising material ratios, the lighting rule, or the spatial engine on
real data — it is exercising them on whichever supplier sheets happened to
be merged. Any P@5-style number from such a run describes the merge, not
the method. This is `ADR-0005`'s reasoning and it has only strengthened
with a third supplier confirming the same two absences.

**(b) Synthesise the missing rugs and lighting** into the real catalogue to
make it composable. Rejected outright, and named here because it is the
tempting move. It would produce a bundle validated against invented
products, reported as a real-data result, with no marker saying which rows
were fabricated. This is the failure mode the project's `needs_input`
invariant exists to prevent.

**(c) Keep R03 queued pending `OQ-011`.** What the last several sessions
did. Now known to be doubly indefinite: it waits on a client-owned blocking
question *and* on four design-authority-owned questions *and* on four
unbuilt modules. Keeping it queued disguises a client-and-design-authority
blocker as an engineering backlog item — the exact anti-pattern `ADR-0010`
named when it closed the three-session doorway-position wait.

**(d) (chosen) Record a deliberate no-go on real data, and let bundle
composition proceed logic-only against labelled-synthetic fixtures.**
Explicitly legitimate and precedented by the service's own gate table.

## Decision and rationale

### D1. R03 is a **no-go on real furniture data.** Recorded, deliberate, not pending.

`agentic_flow/recommendation_workflow.md:18` states the gate dependency as:

> Bundle/room-composition logic as accepted | R03 go/no-go record (may
> legitimately be "no-go on real furniture data, logic-only on synthetic
> fixtures")

and `:62` permits step 5 to "legitimately ship against synthetic fixtures
if R03 records a no-go on real furniture data, as long as fixtures are
labelled synthetic."

**This is that record.** Two independent and individually sufficient
grounds:

1. **Data.** Rugs, lighting and commercial availability are absent from all
   three admitted catalogues. A living-room bundle without a rug or a light
   source is not a bundle the §9.6 lighting rule or the §7 material ratios
   can be evaluated on.
2. **Engine.** Four of the five validation arms R03's own technical design
   requires do not exist, and each is blocked on an open design-authority
   question. Ground 2 is not contingent on ground 1 and does not resolve
   when `OQ-011` does.

Recording the no-go on *both* grounds matters: if the client delivers rugs,
lighting and availability tomorrow, **R03 still does not unblock**, and a
session reading only ground 1 would wrongly conclude otherwise.

### D2. Bundle composition proceeds logic-only against labelled-synthetic fixtures

Permitted, with four binding conditions:

1. **Every fixture is labelled synthetic at the data structure, not in a
   comment.** The existing precedent is right: recommendation's A3 seeds "a
   labelled synthetic A3 catalogue" into SQLite. The label travels with
   every number derived from it, per this role's standing rule that a
   fallback fixture may preserve an integration but is never evidence of
   model quality.
2. **No accuracy, quality or acceptance claim may be derived from a
   synthetic-fixture run.** What such a run can demonstrate is that the
   composition *logic* is deterministic, terminates, respects a budget,
   produces a revision on substitution, and carries its violations —
   mechanical properties, not quality ones.
3. **Validation arms that do not exist must surface as `needs_input`
   citing their `OQ-xxx`, never as silent passes.** The precedent is
   `check_cmr_validation`'s unconditional `needs_input` on `OQ-001`, which
   D01 confirmed fires on 4 of 4 scenarios and which `ADR-0009` confirmed
   is correct because the manual genuinely contains no CMR formula. A
   bundle that "passes" because four of its five validators are absent is
   the most dangerous artifact this service could produce.
4. **`OQ-011` is not closed and its text should be corrected, not
   cleared.** `ADR-0005` already recommends replacing its stale "the only
   supplied catalogue is 62 artwork records" with the accurate gap
   statement. I add one correction to that recommendation: **the accent-
   chair gap is no longer absolute** — ATRIANI supplies five accent/arm
   chair products and an ottoman. The accurate statement for the client is
   now: *"we have ~343 distinct case goods, seating and tables across two
   suppliers, plus 42 products across a third; we have zero rugs, zero
   lighting, and zero delivery/availability data anywhere."*
   `agentic_flow/open_questions.yaml` is **not edited by this ADR** —
   `OQ-011` is `owner: client`.

### D3. Stage gate G2 is **not** reached and nothing downstream may claim otherwise

`recommendation_workflow.md`'s A6 done-evidence is "stage gate **G2** signed
off, **or** an explicit no-go/reduced-scope record. Nothing downstream may
claim 'meets acceptance thresholds' without this."

This ADR is the second branch. It satisfies A6's *done-evidence* obligation
and it does **not** satisfy G2. Recommendation's acceptance criteria —
mean P@5 ≥ 0.80, NDCG@5 ≥ 0.80, zero hard-rule violations — are unreached
and remain unreached. R02 returned `insufficient_evidence` (`ADR-0006`'s
ceiling, never moved), and R03 returns `no-go on real data`. **Neither is a
G2 sign-off and the two together are not one either.**

Specifically forbidden in any downstream artifact, UI copy, or status
summary: "bundle composition is accepted", "meets acceptance thresholds",
"R03 complete", "G2 reached". The permitted phrasing is **"R03: no-go on
real furniture data; composition logic exercised against labelled-synthetic
fixtures only."**

### D4. What this is *not*

It is not a failure of the work, and it should not be recorded as one. R01
audited a real workbook and found real defects. R02 ran a real methodology
chain and produced an honest negative. R03 now records an honest no-go
on evidence gathered across three independent supplier sources and a
direct check of the rules package. **The process produced the correct
answer three times running. A no-go that is recorded, dated, grounded and
reversible is a better artifact than a green number computed from a
catalogue that cannot furnish a room.**

## Consequences and reversal

### Consequences

- **R03 leaves the dispatch queue.** It is not "blocked pending
  investigation"; it is decided. A future session must not re-queue an R03
  investigation — it must instead check whether a reversal condition below
  has fired.
- **Recommendation's A6 done-evidence obligation is satisfied** by this
  record, on its second branch. A5 (UI adapter) does not depend on R03; it
  depends on recommendation reaching signed-off A3, which is a separate and
  currently unmet engineering item.
- **Bundle composition and substitution may be built and shipped
  logic-only**, under D2's four conditions.
- **Room generation's dependency on `OQ-011` is untouched.** `OQ-011`'s
  `blocks:` list includes "all room generation" and this ADR does not
  narrow it. `ADR-0011`'s separate G01 block also stands.
- **Four design-authority questions are now on R03's critical path
  explicitly** (`OQ-002`, `OQ-004`, `OQ-007`, `OQ-009`), where previously
  only the client-owned `OQ-011` was visible. This should be escalated as
  part of the same ask, not separately — the client cannot unblock R03 on
  their own.
- `agentic_flow/open_questions.yaml` **not edited**. No `OQ-xxx` changes
  status here.

### Reversal — pre-specified, and it requires both halves

R03 reopens only when **both** of the following hold. Either alone is
insufficient, and this is the point of ruling on two grounds:

1. **Data.** A catalogue arrives carrying rugs, lighting and commercial
   availability, through a sanctioned delivery path, with provenance
   confirmed per `ADR-0005`'s five points. *And*
2. **Engine.** `style.py`, `palette.py` and `pruning` exist in
   `curalina_design_rules`, which requires `OQ-002`, `OQ-004`, `OQ-007` and
   `OQ-009` resolved by `design_authority`.

When both hold, R03 is re-dispatched as a fresh notebook under a fresh
methodology review — **not** by re-opening this record. R02's methodology
chain (`ADR-0006`, `ADR-0007`, and `ADR-0006`'s Amendment 1) should be read
first, but must not be assumed to transfer: several of its guards
(supplier-proxy, Jaccard collinearity, the leakage firewall) are specific
to properties of the combined workbook that a new catalogue may not share,
and R03 sits on the other side of `ADR-0005`'s split — derived labels do
not rescue a catalogue that cannot furnish a room.

### What would prove this decision wrong

- **Evidence that rugs and lighting were never in MVP scope.** Then ground
  1 collapses to the availability gap alone and should be re-argued. This
  interacts with `OQ-012` (`GENERATED_ARCHITECTURE_SCOPE`), also open and
  also client-owned — if generated architecture covers lighting, the
  catalogue may legitimately not need to.
- **A fourth catalogue source turning up with rugs and lighting.** Three
  sources have now been found in unsanctioned locations
  (`attached_assets/`, `~/Downloads` twice); a fourth is not implausible.
  Ground 2 would still hold.
- **The style/palette/pruning modules turning out not to be required for a
  reduced-scope R03.** If `design_authority` scopes R03 to spatial
  validation only, ground 2 weakens substantially. I do not think this is
  right — a bundle validated on spatial rules alone is a bundle whose style
  and material claims are unmade — but it is the cheapest way this ruling
  is over-strict, and it is `design_authority`'s call, not mine.

## Verification

Reproduced by me on 2026-09-14 with `openpyxl` (`read_only=True,
data_only=True`), and by direct directory listing of the rules package.

- `attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`,
  md5 prefix `3ad1f5d7`: 385 data rows, 36 headers. `Furniture Category`
  comma-split yields **27 distinct tokens**; complete list of tokens
  matching `rug|lamp|light|pendant|sconce|chandelier|chair` is
  `Dining Chairs` (94) and `Reading Chair` (6). Top tokens: Dining Chairs
  94, End Table 84, Nightstand 84, Dresser 47, Console Table 41, Dining
  Table 37, Bed 32, Sofa 21, Stool 12, Shelving Unit 12. One junk token
  (`Final CSV-Ready Summary`, 1) persists, as `ADR-0005` recorded.
- `attached_assets/Four Hands Accent Chairs_1763831596643.xlsx`, md5 prefix
  `1521feaf`: 20 data rows, 28 columns. `Furniture Category` = `Bench` ×19,
  `Ottoman` ×1. `Delivery Options` 0/20, `LEAD Time` 0/20, `Inventory`
  20/20.
- `/Users/rjsalmon/Downloads/Supplier Images/ATRIANI/Design 44.xlsx`,
  sha256 `f4b00dce359dbf19d5a0abad9eba56ecdadaf3f1490116bcfb83d9e69872c0bb`:
  42 distinct `Linl to pictures ` products; zero matching
  `rug|lamp|light|pendant|sconce|chandelier`; accent/arm seating present
  (`Cielo Accent Chair`, `Vela Arm Chair`, `Abbraccio Armchair`,
  `Poltrona Chair Studio`, `Minimalo Ottoman`); columns are `Name`,
  `Linl to pictures `, `Deficiency`, `Finish`, `Price`, `Overall
  Length/Depth/Height`, `Seat Height/Depth` — **no availability column of
  any kind**.
- `ai_services/design_rules/src/curalina_design_rules/` contains `api.py`,
  `loader.py`, `constitution/`, `pipeline/`, `rules/`, `spatial/`,
  `types/`. **No `style.py`, no `palette.py`, no `pruning`.** Matches
  D01's recorded `NOT IMPLEMENTED` result for
  `curalina_design_rules.{style,palette,pruning}`.
- `agentic_flow/13_recommendation_technical_design.md:176` reads "spatial
  (§9), style proportion (§1), colour (§3), material (§7), lighting
  (§9.6)"; `:170` requires `pruning.prune()`.
- `agentic_flow/recommendation_workflow.md:18`, `:62`, `:104` quoted above,
  verbatim.
- `agentic_flow/open_questions.yaml` **not edited**; `OQ-011` remains
  `open`/`client`, `OQ-002`/`OQ-004`/`OQ-007`/`OQ-009` remain
  `open`/`design_authority`.

### Approval

No approval record exists. This is an `ai-ml-lead` gate decision. It
requires no client or design-authority sign-off to stand — recording a
no-go is squarely this role's authority — but both are named above as
owners of the reversal conditions.
