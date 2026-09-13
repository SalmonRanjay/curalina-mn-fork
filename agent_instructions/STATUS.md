# Build status — where things stand

Last updated: 2026-09-13 (session 2). Read this before assigning any new
work — it tells you what's actually done (verified, not just claimed),
what's blocked, and exactly what to hand the next agent to pick up each
service without re-reading `architecture/`/`agentic_flow/` from scratch.

Commits so far, in order: `76c0984` (agent_instructions briefs) →
`6889604`/`6c35d20` (agent roster) → `9163002` (design_rules through
A3+D01) → `fcdf1b8` (recommendation/variants/rooms A0+A1) → `6241650`
(prior status doc) → `914bdd7` (tech-lead ADRs resolving the two session-1
cross-service findings, plus rooms schema-alignment fix) → `beab59a`
(A2 fake-adapter scope for all three services). All on `main`, none pushed
to `origin` — still no working push access from this environment (see
below, unchanged from last session).

**The two blockers from the previous STATUS.md are resolved.** Do not
re-open them without reading their ADRs first:
- `architecture/adr/ADR-0002-recommendation-a1-http-wiring.md` — recommendation's
  A1 FastAPI app stands as A1, not an A3 overreach. Consequence: variants'
  and rooms' A1 fakes now each owe an A3 line item to re-run their contract
  suites through a real in-process HTTP client, since they currently only
  assert *intended* HTTP behaviour, not *observed* behaviour.
- `architecture/adr/ADR-0003-rooms-asset-review-schema-alignment.md` — rooms'
  local asset/review DTOs were aligned to the shared schemas (code fix
  applied and verified, not just recommended). `width_px`/`height_px` stay
  deliberately nullable — rooms' A1 fake doesn't decode image bytes and
  must not invent pixel dimensions; this is guarded by a test, not an
  oversight.

A third ADR was also written this session, **interim, not a resolution**:
- `architecture/adr/ADR-0004-walkway-clearance-interim-interpretation.md` —
  picks a reasoned interim reading of `OQ-013` (walkway clearance vs.
  furniture spacing) so engineering isn't stalled on a client decision:
  circulation endpoints must be connected through the opened free space,
  reusing `check_reachability`'s existing semantics, rather than requiring
  the whole free floor to be walkway-width. **`curalina_design_rules`
  source code has not been changed to implement this reading** — the ADR
  is a recommendation for whoever does that engineering next, not a
  completed fix. `OQ-013` itself is untouched (still `open`,
  `owner: design_authority`).

## Per-service status

### `curalina_design_rules` — A0, A1, A2, A2b, A3, D01 all done and verified. No change this session.

- 76 tests, 91% branch coverage, `mypy --strict` and Ruff clean.
- Consumer API live at `src/curalina_design_rules/api.py`
  (`pinned_rules_version()`, `evaluate_spatial_layout()`, `load_rules`) —
  now genuinely consumed: recommendation's `BundleComposer` port and
  rooms' `RoomPrepAdapter`/`GroundedGenerationAdapter` domain types both
  wrap this package's real types directly (`NormalizedRoom`, `StyledRoom`),
  not parallel re-invented types.
- **Next:** implement ADR-0004's interim walkway-reachability reading in
  `spatial/geometry.py`/`spatial/rules.py` (compose `check_walkways` with
  `check_reachability`'s endpoint-connectivity logic; keep `has_walkway`
  as-is for the literal reading and the revert path). Every result under
  the new reading needs an ADR-0004 marker per the ADR's own instruction,
  so a later client ruling can find and re-evaluate them all. This is real
  engineering work, not yet done.

### Recommendation — A0, A1, A2 (fake-adapter scope) done and verified.

- A0/A1 unchanged from last session (14 contract tests, FastAPI app,
  confirmed by ADR-0002 to be legitimate A1 scope).
- A2 this session: `Money`/dimension/clearance value objects, `Product`/
  `Profile`/`Bundle` domain records, `CatalogueImporter`/`FeatureEncoder`/
  `BundleComposer` ports with fake adapters. 48 new unit tests (89% branch
  overall). `BundleComposer`'s docstring specifies the exact future call
  sequence into `curalina_design_rules.api` — read it before implementing
  step 5 for real.
- **Deliberately not done, and correctly so:** real catalogue-workbook
  import (needs R01), real rule-only or embedding ranking (needs R02),
  real bundle composition logic (needs R03). None of R01/R02/R03 notebooks
  have been created yet. 5 of the 12 mandatory named tests are deferred
  for the same reason (incompatible pair, impossible clearance,
  insufficient categories, tie-breaking, substitution-breaks-layout) — see
  `ai_services/work_packets/REC-A2-01.md` for the exact mapping of which
  tests are done vs. deferred and why.
- **Next:** either (a) build R01 (catalogue audit notebook) to unblock the
  real importer, or (b) do the ADR-0002-flagged A3 remainder (wire
  `application/` into `api/`'s request handlers via a DTO↔domain
  translation layer — deliberately not done in A2 to avoid touching A1's
  frozen fixture behavior).

### Variants — A0, A1, A2 (fake-adapter scope) done and verified.

- A0/A1 unchanged (24 contract tests, plain-callable fake service layer,
  6 schemas contributed to the shared folder).
- A2 this session: colour/mask value objects, the three independent states
  (job outcome / review decision / commercial availability) enforced by
  constructor invariants so they cannot collapse into one field,
  `ColourTransferAdapter`/`DiffusionRefinementAdapter` ports with
  deterministic no-op fakes. 60 total unit tests (56 new), 100% branch on
  every new module. Verified by grep that domain/ports/adapters/
  application import none of PIL/OpenCV/NumPy/torch/diffusers.
- **Deliberately not done:** real LAB colour-transfer math, real masking,
  any diffusion logic. Two independent hard blockers, not one: V01 hasn't
  been run, **and** there are no real upholstery/product photos in this
  repo at all — even building V01 today would have nothing to run against.
- **Next:** sourcing real product photos is a client/data-input task, not
  an engineering one — flag it up rather than trying to route around it
  with placeholder imagery. Once photos exist, V01 (LAB baseline notebook)
  is the next unit of work; the fake-adapter A2 code does not need to
  change when that happens, only the real adapters get filled in behind
  the same ports.

### Rooms — A0, A1, A2 (fake-adapter scope) done and verified. Schema divergence resolved.

- A1 was corrected this session (ADR-0003): local DTOs realigned to the
  shared `asset`/`review` schemas. Contract suite grew 26 → 32 tests (new
  `test_shared_schema_alignment_contract.py` checks the DTOs against the
  actual shared JSON Schema files, so future drift fails loudly instead of
  silently).
- A2 this session: render-job state (three independent fields, same
  never-collapse discipline as variants), `RoomPrepAdapter`/
  `GroundedGenerationAdapter` ports, domain types wrapping
  `curalina_design_rules`'s real `NormalizedRoom`/`StyledRoom` directly.
  `measurement_certified` is hard-pinned to `False` in the domain layer's
  `__post_init__` for **every** input source including customer-confirmed
  ones, citing `OQ-010` — this is enforced at the type level, not by
  convention, specifically so "customer confirmed" input can't later be
  silently treated as a certified measurement. 57 new unit tests, 100%
  branch on every new domain/application/ports/adapters module.
- Added `curalina-design-rules` as a real dependency (editable install
  from `../design_rules` in `make setup`, since there's no PyPI release).
  **A real defect was caught and fixed here**: the implementing agent
  added this dependency but didn't update rooms' `pyproject.toml` mypy
  `python_version` to match — numpy (pulled in transitively via
  `curalina_design_rules → shapely`) needs 3.12-syntax stubs, so
  `mypy --strict` broke. The agent's own report claimed
  "no issues found," which was wrong at the time it was written; caught by
  independently re-running `make typecheck` rather than trusting the
  report. Fixed by bumping `[tool.mypy] python_version` to `"3.12"`
  (`requires-python` floor unchanged) — same fix already applied to
  `ai_services/design_rules` for the identical reason. **Lesson for next
  session: always re-run verification commands yourself after any agent
  adds a new cross-package dependency, even if the agent reports success.**
- **Deliberately not done:** real homography/room-prep math (needs G01),
  real generation/compositing (needs G01+G02), any certified room-scale
  measurement claim (needs `OQ-010`, independent of G01/G02). Wiring
  `application/` into `api/`'s request handlers is deferred to A3, same
  reasoning as recommendation.
- **Next:** G01 (room-prep/homography notebook) is the next real-logic
  unblock; `OQ-010` blocks real measurements regardless of G01 status.

### Contracts & suite steward — A0 done, A1 reconciliation done (ADR-0002/0003 came out of it).

- `ai_services/contracts/v1/CONTRIBUTING.md`, `id_versioning.md`, and 7
  shared schemas (error + 6 from variants) exist and are the checked
  source of truth all three services match.
- **Next:** A4 (suite runner wiring — `run-suite` starting all three
  services with independent databases) once at least two services reach
  their own A3. None have reached A3 yet (all three are now at A2).

### UI adapter — not started. Correctly not started: depends on
recommendation reaching A3/A4, which hasn't happened yet.

## What "pick this up tomorrow" looks like, concretely

No decisions are blocking forward progress right now — the two from last
session are resolved (see ADR-0002/0003 above). The next concrete units of
engineering work, all independent of each other and safe to run in
parallel:

1. **`curalina_design_rules`**: implement ADR-0004's interim walkway/
   reachability reading. Self-contained, no cross-service dependency.
2. **Recommendation**: R01 (catalogue audit notebook) to unblock the real
   importer, or the A3 API-wiring remainder. Two different people/agents
   could do these in parallel since they touch different layers
   (`notebooks/` vs. `api/`+`application/` wiring).
3. **Variants**: flag the missing-product-photos gap upward (not an
   engineering task); no further engineering is productive on V01 until
   that's resolved.
4. **Rooms**: G01 (room-prep/homography notebook).
5. **Contracts/suite**: A4 suite-runner wiring is still one service away
   (needs at least two services at A3) — not yet actionable, don't start
   it early.

None of these need re-deriving scope — the per-service briefs in this
folder (`00`–`04`) have the full reading list, and each service's
`ai_services/work_packets/*-A2-01.md` names its own next blocker precisely
in its "Known blockers" section.

## Environment notes worth not rediscovering

- `agentic_flow/` is intentionally gitignored (local-only, pre-existing
  convention) — `OQ-013` and any future OQ entries live there and will not
  appear if you only look at `git log`/`git show`. Read the file directly.
- No push access to `origin` from this environment: neither available SSH
  identity (`id_github`, `id_ed25519_eng_rj`) has write access to
  `CuralinaTech/curalina`, confirmed twice now. Commits are local-only on
  `main` until that's resolved (grant push access, or push from a machine
  that has it).
- Running more than one Sonnet-tier engineering agent in parallel can hit
  a session-level rate limit (happened once, session 1). Batches of 3
  independent-package agents (used twice now, for A1 and A2 across
  recommendation/variants/rooms) were fine both times.
- Each Python package needs its own `.gitignore`
  (`__pycache__/`, `*.egg-info/`, `.coverage`, `.pytest_cache/`,
  `.mypy_cache/`, `.ruff_cache/`, `.hypothesis/`) — new packages won't have
  one until someone adds it; check before committing or build artifacts
  get staged. All four current packages (`design_rules`, `recommendation`,
  `variant_generator`, `room_generator`) and `ai_services/contracts` have
  one now.
- **Always independently re-run `make test`/`make lint`/`make typecheck`
  after any engineering agent reports success — do not commit on the
  agent's self-report alone.** This caught a real, currently-broken
  `mypy --strict` failure in rooms this session (see above) that the
  implementing agent's own completion report incorrectly claimed was
  passing. This has now happened enough times to be a pattern, not a
  one-off: verify, then commit.
