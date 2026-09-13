# Architecture decision record

ID: ADR-0004 — Interim interpretation of §9.1 walkway clearance (OQ-013)
Status: **accepted as an interim, reversible interpretation.** Not a
resolution of OQ-013. `OQ-013` stays `open` and `owner: design_authority`.
Owner and reviewer: `tech-lead` (interim call); **`design_authority`
(client) is the real decision owner and has not ruled.**
Date: 2026-09-13

## Context

`OQ-013` (`agentic_flow/open_questions.yaml`, last entry, rule
`MIN_WALKWAY`, severity `blocking`) records that the Design Manual's §9.1
and §9.2.1 cannot both be satisfied as literally specified:

- §9.1, per the pseudocode in `agentic_flow/12_design_rules_engine.md`
  (lines 151–160), is a morphological **opening** over the *entire* free
  floor polygon: `free.buffer(-min/2).buffer(+min/2)`, then
  `pinched = free.difference(passable)`. Any leftover sliver of free floor
  narrower than the category minimum is a hard violation, with no
  origin/destination restriction.
- §9.2.1 mandates furniture spacings — sofa-to-coffee-table 15–20″
  depending on style — that are always narrower than every home category's
  walkway minimum (32″ condo, 36″ mid, 48–60″ large).

So the 381 mm gap §9.2.1 *requires* between a sofa and its coffee table is
itself a "pinched" region under §9.1's 813 mm condo minimum. Every
correctly composed conversation grouping fails. This is not an edge case;
it is every living room and every dining room.

Two independent confirmations are already on record and I am not
re-deriving them: the D01 conformance notebook run
(`ai_services/design_rules/notebooks/runs/D01_20260913T022937Z/`, fixture
`condo_living_room_conversation_circle`) and a code review of
`ai_services/design_rules/src/curalina_design_rules/spatial/geometry.py`.
I read `has_walkway` (lines 91–101) and `check_walkways` (113–132) directly
for this ADR: they implement the spec's pseudocode faithfully, including a
mitred-join opening so axis-aligned corridors erode and dilate back to
their exact width. **The engine is not buggy. The specification is.**

The same file already contains the alternative reading, implemented and
working: `check_reachability` (lines 149–171) opens the free space by
`min_width_mm/2` and then asks whether an origin and a destination fall in
the same connected component. That is "a path of at least N wide exists
between these two points", and it is what §9.4.4's bed→ensuite (42″) and
bed→closet (36″) rules use. `12_design_rules_engine.md` line 164 describes
exactly this as the intended follow-on primitive: "Connectivity between
required endpoints ... is then a graph reachability check on the opened
polygon."

No client is reachable in this session. `agent_instructions/STATUS.md`
directs that the tech lead either obtain a design-authority ruling or
record an interim interpretation so forward engineering is not blocked.

## Options

**(a) Literal §9.1 — whole free floor must be walkway-width everywhere.**
Internally consistent with the pseudocode and with nothing else. Makes
`MIN_WALKWAY` unsatisfiable in combination with §9.2.1, which means the
rule can never pass on a real layout and the rules engine can never produce
a valid living or dining room. Self-evidently not what a design manual that
also mandates 15″ sofa-to-table spacing can have meant.

**(b) Return `needs_input` for `MIN_WALKWAY` until the client rules.**
The invariant-respecting default, and the right answer if §9.1 required us
to *invent a number*. It does not — the numbers (32/36/48–60″) are given;
only the predicate's scope is ambiguous. Cost: `MIN_WALKWAY` blocks every
composition, so recommendation's bundle composition (A2 step 5) and rooms'
layout validation cannot be exercised end to end at all. That is a large
amount of downstream work stalled on a question whose two candidate answers
differ only in which one is *obviously* wrong.

**(c) (chosen) Traversal-path interpretation, as an explicitly interim,
reversible reading.** §9.1 means: a continuous corridor of at least the
category minimum connects the room's circulation endpoints — each doorway
to each other doorway, and each doorway to each primary functional zone —
through the opened free-space polygon. Furniture-to-furniture gaps that
§9.2.1 governs are *not* walkways and are not tested by §9.1.

**(d) Make §9.2.1 gaps an exemption carved out of §9.1's literal test**
(subtract §9.2.1-governed gaps from `pinched` before measuring). Preserves
the everywhere-else semantics, but needs a rule for which gaps are
"§9.2.1-governed", which the manual does not give — so it smuggles in an
invented predicate, and it would still flag harmless slivers behind a
credenza or in a corner. Strictly worse than (c) and harder to reverse.

## Decision and rationale

**Option (c), interim.** §9.1 `MIN_WALKWAY` is interpreted as a
**reachability** rule, not an everywhere-clearance rule:

> A layout satisfies `MIN_WALKWAY` for home category *C* when, in the free
> space opened by `min_walkway_mm(C)/2`, every required circulation
> endpoint pair lies in the same connected component. Required pairs are:
> every doorway to every other doorway, and every doorway to each primary
> functional zone of the room type. A pinched region that no required pair
> depends on is not a violation.

Rationale:

1. It is the only reading under which §9.1 and §9.2.1 are simultaneously
   satisfiable, and a manual that specifies both must have intended both to
   be satisfiable.
2. It is not a new invention. `check_reachability` in the same module
   already implements precisely this semantics, and the design document
   itself (line 164) names reachability as the intended use of the opened
   polygon. Choosing it aligns §9.1 with §9.4.4 rather than creating a
   third behaviour.
3. It invents **no number**. The thresholds stay exactly as the manual
   gives them. Only the *scope of the predicate* changes — from "all free
   floor" to "between circulation endpoints". This is why this ADR does not
   violate the never-guess-a-threshold invariant, and why option (b),
   though safe, is more conservative than the situation requires.
4. It fails in the safe direction for the user: it can accept a layout the
   client would reject (a pinched corner nobody walks through), but it
   cannot accept a layout you literally cannot walk across. The literal
   reading fails in the unsafe direction for the *product* — it rejects
   everything, including correct layouts.

**What is explicitly NOT decided here.** This is an engineering interim
reading adopted so that composition and layout validation can be built and
tested. It is not a design ruling, it is not client sign-off, and nothing
downstream may cite it as "§9.1 conformance". `OQ-013` remains open with
`owner: design_authority`, and this ADR does not edit
`agentic_flow/open_questions.yaml`.

**Not implemented here.** This ADR is a recommendation to whoever picks up
the `MIN_WALKWAY` work; per this session's mandate no `curalina_design_rules`
source was touched. Implementation notes for that engineer:

- `check_walkways` (geometry.py:113) should compose over
  `check_reachability`'s component logic rather than `has_walkway`'s
  whole-polygon `pinched.area` test. `has_walkway` itself is a correct
  primitive and should stay — it is the literal reading, and it is what we
  switch back to if the client rules the other way.
- Circulation endpoints are an *input* the current signature does not
  carry. `RoomGeometry` will need doorway positions, and room-type
  functional zones will need naming. **If those cannot be derived from
  existing inputs, that is a new blocked input and must produce
  `needs_input` citing `OQ-013` — do not synthesise doorway coordinates.**
  This may interact with `OQ-010` (room geometry/measurement source).
- Every `Violation` produced, and every layout accepted, under this reading
  must carry a marker tying it to this ADR, so that a later client ruling
  can find every affected result. Suggested: extend the violation's
  `message`/`source_section` with `"9.1 (ADR-0004 interim)"`, or add an
  explicit interim-interpretation flag to the evaluation result.
- D01's conformance record must be updated to say it now measures against
  an interim interpretation, and its accept-with-limitations status stands.

## Consequences and reversal

Consequences:

- `MIN_WALKWAY` becomes satisfiable, unblocking composition work in
  recommendation (A2 step 5) and layout validation in rooms.
- Any conformance claim made before the client rules is provisional. G-gate
  sign-off must not treat §9.1 as settled.
- Two rules in §9 now share one primitive (`check_reachability`'s component
  test), which is a simplification, not added surface.

**If the design authority rules the other way** (literal, whole-free-floor
§9.1), then:

1. Revert `check_walkways` to the `has_walkway` whole-polygon test — the
   primitive is deliberately being kept for exactly this.
2. **§9.2.1 must then be amended by the client**, because the combination
   is unsatisfiable and the conflict does not disappear by choosing (a).
   The client would have to either raise the §9.2.1 spacings above the
   category walkway minima, or scope §9.1 to a subset of the floor — which
   is option (c) under another name. Say this back to them when asking.
3. Every layout accepted under the interim reading must be re-validated;
   this is why the ADR-0004 marker on results is mandatory, not optional.
4. Fixtures asserting `MIN_WALKWAY` passes (notably
   `condo_living_room_conversation_circle`) invert to expected failures.

**What would prove this interpretation wrong before the client rules:** a
passage in the Design Manual's §9.1 body (not the derived pseudocode) that
names the whole floor area, or §8's four worked examples — which are **not
in this repo** (the other blocker on D01's clean accept) — showing a
compliant composition whose free floor *is* walkway-width everywhere. If §8
arrives, check it against this ADR first; it is authored by the client and
outranks this reading.

## Verification

- `agentic_flow/open_questions.yaml` `OQ-013` read in full; unchanged by
  this ADR.
- `ai_services/design_rules/src/curalina_design_rules/spatial/geometry.py`
  lines 82–171 read directly: `has_walkway`/`check_walkways` implement the
  literal reading faithfully; `check_reachability` implements the proposed
  reading and is already in production use for §9.4.4.
- `agentic_flow/12_design_rules_engine.md` lines 151–166 read: pseudocode
  confirms the opening test, and line 164 confirms reachability as the
  intended endpoint-connectivity primitive.
- Prior evidence relied on, not re-derived: D01 run
  `D01_20260913T022937Z` and the independent code review recorded in
  OQ-013's `source`.
- No tests were run and no source changed for this ruling; nothing here is
  executable yet. Verification of the *implementation* belongs to the work
  packet that adopts it, whose done-evidence must include the
  ADR-0004 marker on results and a fixture proving a §9.2.1-compliant
  conversation grouping now passes `MIN_WALKWAY` while a genuinely blocked
  doorway-to-doorway path still fails.
