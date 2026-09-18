# Architecture decision record

ID: ADR-0010 — Circulation endpoints for `evaluate_spatial_layout`: source, and what happens when absent
Status: **accepted and implemented.**
Owner and reviewer: `tech-lead`
Date: 2026-09-14

## Context

`ADR-0004` adopted an interim reachability reading of §9.1 `MIN_WALKWAY`, and
`check_walkways_adr0004`
(`ai_services/design_rules/src/curalina_design_rules/spatial/geometry.py:216`)
implements it. It has never been wired into the consumer-facing entry point
`evaluate_spatial_layout`
(`ai_services/design_rules/src/curalina_design_rules/api.py:37`), which still
called the literal `check_walkways`.

`agent_instructions/STATUS.md` has carried this as queued for **three
sessions** with the same note each time — "still needs a real source of
doorway/functional-zone positions, which nobody has investigated yet". The
investigation was never done. This ADR does it.

### The investigation: does any Curalina input carry doorway positions?

**No. Nothing does. This is now settled, not assumed.**

1. **The rules engine's own type carries none.** `RoomGeometry`
   (`types/geometry.py:18`) is `room_id`, `room_type`, `home_category`,
   `boundary: tuple[Point, ...]`, `ceiling_height_mm`. A boundary polygon,
   no openings.

2. **The existing production app captures doorway *size*, never doorway
   *position*.** `shared/schema.ts:272-289` defines `ParsedRoomData` with
   `doorway?: { width?, height?, unit }` — three scalars, no coordinates and
   no wall assignment. `shared/schema.ts:320` is the only column that holds
   it (`quiz_responses.parsed_room_data`).

3. **That field exists for a different purpose, and the purpose is
   incompatible.** `server/services/spatial-fit-validator.ts:77-110`
   (`canFitThroughDoorway`) uses it to answer "can this product's largest
   diagonal pass through the door opening" — a **delivery** check. Its other
   check (`:115-205`) tests the product against the room's bounding box with
   a hardcoded `MINIMUM_CLEARANCE_INCHES = 30` /
   `COMFORTABLE_CLEARANCE_INCHES = 36` symmetric per-side margin
   (`:45-46`). Neither is a circulation-path test and neither needs a
   position.

4. **The extractor is not asked for positions either.**
   `server/services/room-parser-service.ts` prompts Gemini to "Extract
   doorway/entryway dimensions (**critical for furniture delivery**)" and
   to assume "Standard doorway = 32 inches if not specified". It parses a
   *natural-language description*, not a photo. It could not produce a
   position if asked.

5. **The manual says where positions are supposed to come from, and that
   source does not exist yet.** §10 STEP 2 (p162 of the manual admitted by
   `ADR-0009`) mandates extracting "Room boundaries / Windows / **doors** /
   Ceiling height (estimated) / Fixed architectural elements" from an
   uploaded photo or floorplan. It specifies **no method, no accuracy
   requirement, no coordinate frame and no scale reference**. That is
   `OQ-010` (`ROOM_GEOMETRY_SOURCE`, `blocking`, owner
   `design_authority + client`), and it is unresolved.

6. **Functional-zone positions are worse off.** Nothing anywhere — not the
   manual, not the schema, not the rules engine — enumerates the "primary
   functional zones" per room type that `ADR-0004` requires, let alone
   locates them.

**Conclusion: doorway and functional-zone positions are downstream of
`OQ-010`. They are not derivable from any existing input, and no amount of
further searching will change that.** The three-session wait was waiting for
something that was never going to arrive from the direction being watched.

`ADR-0004` anticipated exactly this: "If those cannot be derived from
existing inputs, that is a new blocked input and must produce `needs_input`
citing `OQ-013` — do not synthesise doorway coordinates."

## Options

**(a) Keep it queued pending a data source.** What the last three sessions
did. Now known to be indefinite: it is queued behind a blocking, client-owned
open question. Keeping an engineering item queued behind a client decision
disguises a client blocker as an engineering backlog item.

**(b) Wire `check_walkways_adr0004` with required endpoint arguments.**
Forces every caller to supply coordinates nobody has. Callers would invent
them — the exact failure `ADR-0004` forbade.

**(c) Derive endpoints heuristically from the boundary polygon** (e.g. assume
a doorway at the midpoint of the longest wall). Fabricates geometry, produces
a confident verdict from invented input, and would be indistinguishable from
a real result downstream. Rejected outright.

**(d) (chosen) Wire it with optional endpoints defaulting to empty, and let
the existing `needs_input` path fire.** The entry point starts honouring
`ADR-0004`'s reading immediately, returns `needs_input` citing `OQ-013` for
`MIN_WALKWAY` until `OQ-010` yields real endpoints, and returns a genuine
reachability verdict the moment a caller can supply them.

## Decision and rationale

**Option (d), implemented in this ADR.**

1. `evaluate_spatial_layout` gains two keyword-only parameters,
   `doorway_points: tuple[Point, ...] = ()` and
   `functional_zone_points: tuple[Point, ...] = ()`.
2. It calls `check_walkways_adr0004` instead of `check_walkways`.
   `check_walkways`/`has_walkway` are **retained untouched** — they are the
   literal reading and `ADR-0004`'s designated rollback path.
3. `RuleResult` gains `interim_markers: tuple[str, ...] = ()`, carrying
   `ADR_0004_MARKER` on **pass as well as failure**. `ADR-0004` requires a
   marker on every accepted layout, and an accepted layout produces no
   `Violation` to hang one on. Consumers persisting a `RuleResult` must
   persist this field alongside `rules_version`.

Rationale:

- It invents no number and no coordinate. The blocked input stays blocked and
  says so, citing `OQ-013`, which is what the project's standing invariant
  requires.
- It converts an indefinitely-queued engineering item into a **closed
  engineering item with a named client dependency**. That is a real change:
  the work is done, and what remains is `OQ-010`, tracked where client
  blockers belong.
- Blocking behaviour is unchanged. `RuleResult.passes_hard`
  (`types/results.py:41`) already treats `NEEDS_INPUT` and `HARD` alike, so
  swapping a `HARD` walkway violation for a `NEEDS_INPUT` one does not turn
  any previously-failing layout into a passing one.
- `CMR_VALIDATION` already returns unconditional `needs_input` on `OQ-001`
  from this same entry point, so `evaluate_spatial_layout` could not return
  `passes_hard is True` today regardless. This change adds a second honest
  blocker to an entry point that was already honestly blocked — it does not
  newly stall anything.

### Versioning

**Additive, minor.** Both new parameters are keyword-only with defaults; the
new `RuleResult` field has a default. Every existing call site compiles and
behaves identically in structure. No consumer currently calls this function
in production code — `ports/bundle_composer.py:31` references it in a
docstring only — so no consuming-service sign-off is required. No
`rules_version` bump.

### Known limitation, inherited from ADR-0009

`ADR-0009` established that `ADR-0004`'s endpoint set (doorway↔doorway and
doorway↔functional-zone) is a strict subset of the paths the manual names:
the 30" behind-sofa circulation path (§9.2.2), the 36"/44" dining Pull-Back
Zone and 48" Credenza Buffer (§9.3.1). **This wiring inherits that
under-reporting.** It is not introduced here and it is safe in the same
direction, but do not read a `MIN_WALKWAY` pass from this entry point as
"all §9 circulation rules satisfied". Several of those named paths already
have their own dedicated checks in
`curalina_design_rules.spatial.rules` (`check_lr_floating_anchor`,
`check_dr_pull_back`, `check_dr_credenza_buffer`) which this entry point
deliberately does not bundle.

## Consequences and reversal

Consequences:

- `evaluate_spatial_layout` now always reports `MIN_WALKWAY` as
  `needs_input` on `OQ-013` for callers that supply no endpoints — which is
  every caller today. This is the correct and intended outcome.
- Recommendation's bundle composition (A2 step 5) and rooms' layout
  validation can integrate against this entry point now and will get a
  truthful blocked answer rather than a fabricated verdict.
- Anything persisting a `RuleResult` must now persist `interim_markers`.
  Nothing persists one today; this is a forward obligation, not a migration.
- D01's conformance notebook calls this entry point
  (`ai_services/design_rules/notebooks/D01_rules_conformance.ipynb`) and its
  recorded results will change. **Re-running D01 is not done here** — that is
  `ml-notebook-engineer` work under `ai-ml-lead` sign-off.

**Reversal** (one commit, no data migration):

1. Restore the `check_walkways` call in `api.py` — the function was never
   removed.
2. Drop the two keyword parameters and the `interim_markers` field.
3. Delete the three tests named in Verification below.

**What would prove this decision wrong:**

- `OQ-010` resolves with a room-geometry source that **does** carry doorway
  positions and a zone taxonomy. Then the defaults stop being exercised, the
  `needs_input` branch goes cold, and the endpoints should become required
  rather than optional.
- `design_authority` rules §9.1 literal (whole-free-floor). Then `ADR-0004`
  reverses, this wiring reverses with it, and — per `ADR-0004`'s reversal
  clause — §9.2.1 must be amended by the client because the conflict does not
  disappear. `ADR-0009` makes this outcome substantially less likely: the
  manual's own §9.1 body contains no whole-floor language.
- A consumer is found treating `needs_input` as a pass. That would be a bug
  in the consumer, but it would also mean this entry point's blocked state is
  too easy to ignore, and the signal should be strengthened.

## Verification

Changed files (all in `ai_services/design_rules`):

- `src/curalina_design_rules/api.py` — endpoint parameters, swap to
  `check_walkways_adr0004`, `interim_markers` propagation, docstring stating
  the `OQ-010`/`OQ-013` dependency and the do-not-synthesise rule.
- `src/curalina_design_rules/types/results.py` — `RuleResult.interim_markers`
  with a default and a docstring explaining why passes need a marker.
- `tests/unit/test_api.py` — three new tests:
  `test_evaluate_spatial_layout_needs_input_for_walkway_without_endpoints`
  (asserts `MIN_WALKWAY` is `NEEDS_INPUT`, cites `OQ-013`, carries
  `ADR_0004_MARKER`, across every golden scenario);
  `test_evaluate_spatial_layout_marks_every_result_with_the_adr0004_marker`;
  `test_evaluate_spatial_layout_uses_reachability_with_endpoints` (asserts a
  real verdict is returned once endpoints are supplied).

Commands run and real output:

```
$ make -C ai_services/design_rules lint
python3 -m ruff check --no-cache .
All checks passed!

$ make -C ai_services/design_rules typecheck
Success: no issues found in 20 source files

$ make -C ai_services/design_rules test
src/curalina_design_rules/api.py                        15      0      4      0   100%
src/curalina_design_rules/spatial/geometry.py           79      0     18      0   100%
TOTAL                                                  563     30    150     26    92%
============================== 83 passed in 7.49s ==============================
```

80 → 83 tests; aggregate branch coverage 91% → 92%. Per-module, not just
aggregate: `api.py` 100%, and `spatial/geometry.py` moved **96% → 100%** —
`check_walkways_adr0004`'s branches were previously only partly exercised and
are now fully covered.

No consumer regression — `design_rules` is the shared package, so all four
packages plus the root contracts suite were re-run:

```
$ make -C ai_services test-all
============================== 83 passed in 7.61s ==============================   (design_rules)
============================= 259 passed in 3.12s ==============================   (recommendation)
======================== 71 passed, 2 warnings in 1.45s ========================   (variants)
======================== 60 passed, 2 warnings in 1.29s ========================   (rooms)

$ make -C ai_services test-contracts
============================== 7 passed in 0.21s ===============================
```

- `agentic_flow/open_questions.yaml` **not edited**. `OQ-013` and `OQ-010`
  both remain `open` with their existing owners.
- `check_walkways` and `has_walkway` confirmed still present and exported
  (`spatial/__init__.py:8,11`) as the rollback path.
