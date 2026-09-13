# Build status — where things stand

Last updated: 2026-09-13 (session 2, later). Read this before assigning any
new work — it tells you what's actually done (verified, not just claimed),
what's blocked, and exactly what to hand the next agent to pick up each
service without re-reading `architecture/`/`agentic_flow/` from scratch.

Commits so far, in order: `76c0984` (agent_instructions briefs) →
`6889604`/`6c35d20` (agent roster) → `9163002` (design_rules through
A3+D01) → `fcdf1b8` (recommendation/variants/rooms A0+A1) → `6241650`
(status doc) → `914bdd7` (ADR-0002/0003/0004 rulings, rooms schema fix) →
`beab59a` (A2 fake-adapter scope, all three services) → `c1bc6b6` (status
doc) → `83e3a7f` (ADR-0004 implemented; ADR-0005 catalogue-workbook
ruling) → `203649f` (R01 catalogue audit complete). All on `main`, none
pushed to `origin` — still no working push access from this environment
(unchanged across both sessions).

## Five ADRs exist now — read before touching anything they cover

- `ADR-0002-recommendation-a1-http-wiring.md` — recommendation's A1
  FastAPI app stands as A1. Consequence: variants' and rooms' A1 fakes
  each owe an A3 line item to re-run their contract suites through a real
  in-process HTTP client (they currently assert intended, not observed,
  HTTP behaviour). Not yet done for either.
- `ADR-0003-rooms-asset-review-schema-alignment.md` — rooms' asset/review
  DTOs realigned to the shared schemas. Done and verified, not just
  recommended.
- `ADR-0004-walkway-clearance-interim-interpretation.md` — interim reading
  of `OQ-013`. **Now implemented**, not just recommended:
  `check_walkways_adr0004` in `curalina_design_rules/spatial/geometry.py`
  composes the existing `check_reachability` endpoint-connectivity logic;
  the literal `has_walkway`/`check_walkways` reading is untouched
  alongside it. Every result under the new reading carries an
  `ADR_0004_MARKER`. **Not yet wired into `api.py`'s
  `evaluate_spatial_layout`** — that entry point has no source of
  doorway/functional-zone positions today; inventing one would itself be
  a guess, so this is an open follow-on, not an oversight. `OQ-013` itself
  is still `open`/`owner: design_authority` in `agentic_flow/open_questions.yaml`
  (gitignored, verify by reading the file directly, not `git log`).
- `ADR-0005-catalogue-workbook-provenance-and-oq011.md` — rules on a real
  385-row furniture workbook found in the existing app's `attached_assets/`
  folder (not previously known to any architecture/agentic_flow doc; see
  "New this session" below). Recommendation's R01 may proceed against it;
  R03 stays blocked (zero rugs/lighting/accent chairs, no availability
  data). **Contains one corrected factual claim**: the original ruling
  said 2 blank `Furniture Category` rows; independently re-verified twice
  (once by R01's own re-derivation, once by a direct spot-check) that the
  true count is zero. Corrected in-place in the ADR with a struck-through
  note — the correction didn't change the ruling.

## New this session: a real furniture catalogue was found, not supplied

While continuing the build, `attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`
(md5 `3ad1f5d7e47cca273e3fecd5ede64054` — **use this exact file**; two
other copies exist on disk, one byte-identical, one genuinely different
content, both flagged as provenance risks, neither should be used without
re-checking against this one) turned up in the existing production app's
upload folder. It is real: 385 rows, 271 Four Hands + 114 Moe's Home,
343 distinct SKU pairs after removing 42 duplicates, real prices/
dimensions/materials/style tags. It does **not** resolve everything:
- No rugs, lighting, or accent chairs anywhere in the data.
- No availability/delivery information (100% empty on 4 of the columns
  meant to carry it).
- None of `OQ-009`'s six missing attributes (edge geometry, leg style,
  material class, gloss, undertone, performance-fabric flag).
- No product photos of any kind — this finding is **irrelevant to
  variants' photo blocker**, don't cite it there.

`OQ-011` (furniture catalogue existence) stays `open` — its *text* is now
known to be stale (it references "62 artwork records"), but closing it
requires client confirmation on data identity/currency/completeness, which
is explicitly not something an engineer or this session can supply.
Whoever eventually gets that confirmation should update `OQ-011`'s
`question:` text and only then consider `status: resolved`.

## Per-service status

### `curalina_design_rules` — A0, A1, A2, A2b, A3, D01 done. ADR-0004 now implemented on top.

- 80 tests (up from 76), 91% branch coverage, `mypy --strict`/Ruff clean.
- **Next:** wire `check_walkways_adr0004` into `api.py`'s
  `evaluate_spatial_layout` — needs a real source of doorway/functional-
  zone positions first (currently has none; this is the actual next
  blocker, not a trivial wiring task).

### Recommendation — A0, A1, A2, R01 all done and verified.

- A0/A1/A2 unchanged in substance from last session (ADR-0002 confirmed
  A1's FastAPI app is legitimate; A2 fake-adapter domain/ports/adapters).
- **R01 (catalogue audit) is now done** — real (not fake) `CatalogueImporter`
  adapter (`adapters/xlsx_*.py`) added alongside the untouched
  `FakeCatalogueImporter`, executed notebook with a decision record that
  explicitly does NOT overclaim ("accept for catalogue-audit purposes; R03
  composition remains blocked per ADR-0005"). 85 unit tests (up from 48),
  92% branch coverage, contract suite unchanged at 14 (proves `api/`
  wasn't touched), `mypy --strict`/Ruff clean.
- **Next, two independent options:**
  1. R02 (ranking baseline notebook) — this is the next real-logic
     unblock per `agentic_flow/recommendation_workflow.md`'s A2 sequence
     (rule-only ranking depends on R02). Nothing blocks starting it.
  2. The ADR-0002-flagged A3 remainder — wire `application/` into `api/`'s
     request handlers via a DTO↔domain translation layer (deliberately
     deferred in A2 to avoid touching A1's frozen fixture behavior).
  R03 (bundle composition) stays blocked regardless — needs both a real
  R03 notebook AND the missing rugs/lighting/accent-chairs/availability
  data that ADR-0005 confirmed isn't in the found workbook.

### Variants — A0, A1, A2 done. No change this session.

- Still blocked on real product photos for any real-logic work (V01/V02).
  The catalogue workbook found this session does not help here — no image
  data of any kind.
- **Next:** the missing-photos gap is a data-sourcing task, not
  engineering — keep flagging it up rather than routing around it.
  Separately, actionable now regardless of photos: the ADR-0002-flagged
  A3 remainder (re-run the existing 24 contract tests through a real
  in-process HTTP client instead of the current plain-callable fakes).

### Rooms — A0, A1, A2 done. No change this session.

- Schema alignment (ADR-0003) and A2 fake-adapter scope both stand as
  verified last session.
- **Next:** G01 (room-prep/homography notebook) is the next real-logic
  unblock. `OQ-010` (room geometry/measurement source) blocks any
  certified room-scale claim independent of G01. Also actionable now: the
  ADR-0002-flagged A3 remainder (re-run the 32 contract tests through a
  real in-process HTTP client).

### Contracts & suite steward — A0, A1 done. No change this session.

- **Next:** A4 (suite runner wiring) still needs at least two services at
  A3. None have reached A3 yet — all three sit at A2 (recommendation also
  has R01). Not yet actionable.

### UI adapter — not started. Correctly not started: depends on
recommendation reaching A3/A4.

## What to pick up next, concretely

No decisions are blocking anything right now. Six independent units of
work, all safe to run in parallel (verified pattern: 3 at once has been
fine twice; haven't tried more than 3):

1. **`curalina_design_rules`**: source doorway/functional-zone positions
   for `evaluate_spatial_layout` so ADR-0004's reading can actually be
   used end-to-end — likely needs a design/product-team input, not pure
   engineering; investigate what's available before assuming it's blocked.
2. **Recommendation**: R02 (ranking baseline notebook).
3. **Recommendation**: A3 remainder (real HTTP wiring in `application/`↔`api/`).
4. **Variants**: A3 remainder (real HTTP wiring, same pattern as #3).
5. **Rooms**: G01 (room-prep/homography notebook).
6. **Rooms**: A3 remainder (real HTTP wiring, same pattern as #3).

\#2 and #5 are the two genuine "prove the model/logic works" unblocks;
\#3/#4/#6 are the ADR-0002-mandated cleanup that's been sitting since last
session. Do the ADR-0002 items relatively soon — they're small, well-
scoped, and the longer they sit the more "temporarily fake" work
accumulates on top of them in later phases.

## Environment notes worth not rediscovering

- `agentic_flow/` is intentionally gitignored (local-only) — all `OQ-xxx`
  entries live there and won't show in `git log`/`git show`. Read the file
  directly.
- No push access to `origin`: neither available SSH identity has write
  access to `CuralinaTech/curalina`, confirmed three times now across two
  sessions. Commits are local-only on `main`.
- Batches of 3 independent-package Sonnet-tier agents in parallel have
  been fine twice (A1 and A2 across recommendation/variants/rooms).
- Each Python package needs its own `.gitignore` — all four current
  packages plus `ai_services/contracts` have one now; check before
  committing if a new package is ever added.
- **Always independently re-run `make test`/`make lint`/`make typecheck`
  after any engineering agent reports success — do not commit on the
  agent's self-report alone.** Confirmed useful again this session in a
  smaller way: an agent's ADR-0005 draft had a wrong count (2 blank rows
  vs. the true 0), caught by a direct spot-check rather than propagated.
  This is now a pattern across three separate incidents (session 1's
  rooms mypy failure, and two smaller factual-claim corrections since) —
  treat every agent report, including ADRs and rulings, as a claim to
  verify, not a fact to relay.
- When new source data turns up in unexpected places (this session:
  `attached_assets/`, the *existing* app's folder, not anywhere the new
  services' docs point to), don't assume it's sanctioned input just
  because it's real — get a `tech-lead` ruling on provenance before an
  engineer builds against it, same as any other cross-service or
  ambiguous-input decision.
