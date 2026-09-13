# Build status — where things stand

Last updated: 2026-09-13, end of session. Read this before assigning any
new work — it tells you what's actually done (verified, not just claimed),
what's blocked, and exactly what to hand the next agent to pick up each
service without re-reading `architecture/`/`agentic_flow/` from scratch.

Commits so far, in order: `76c0984` (agent_instructions briefs) →
`6889604`/`6c35d20` (agent roster) → `9163002` (design_rules through A3+D01)
→ `fcdf1b8` (recommendation/variants/rooms A0+A1). All on `main`, none
pushed to `origin` — this repo has no working push access from this
environment (see below).

## Per-service status

### `curalina_design_rules` — A0, A1, A2, A2b, A3 done and verified. D01 done, accept-with-limitations.

- 76 tests, 91% branch coverage, `mypy --strict` and Ruff clean.
- Consumer API is live at `src/curalina_design_rules/api.py`
  (`pinned_rules_version()`, `evaluate_spatial_layout()`, `load_rules`) —
  **recommendation and rooms should import this now**, not stub it out.
- D01 conformance notebook exists and was actually executed
  (`ai_services/design_rules/notebooks/D01_rules_conformance.ipynb`, run
  artifacts under `notebooks/runs/D01_20260913T022937Z/`). Decision:
  **accept-with-limitations** — not a clean accept. Two things block a
  clean accept:
  1. The Design Manual's §8 (four client worked examples) is not in this
     repo. Conformance against it cannot be claimed either way. All results
     use representative fixtures instead, labelled as such everywhere.
  2. A genuine new spec ambiguity was found and logged as **`OQ-013`** in
     `agentic_flow/open_questions.yaml` (local-only, gitignored, same as
     the rest of that pack): Section 9.1's walkway-clearance rule and
     Section 9.2.1's furniture-spacing rule are structurally incompatible
     for any living/dining-room layout, as literally specified. This needs
     a design-authority decision, not an implementation guess. **Do not
     resolve this by editing `spatial/geometry.py`'s `has_walkway` without
     that decision** — it was independently verified as a faithful
     implementation of the technical design's own pseudocode, not a bug.
- **Next for this service:** nothing is blocking further work, but no one
  has picked an interpretation for OQ-013 yet. Whoever owns `tech-lead`
  should read OQ-013 and either get a design-authority ruling or write an
  ADR picking an interim interpretation.

### Recommendation — A0, A1 done and verified. Flagged for a phase-boundary correction before A2.

- A0: package skeleton, `Settings`, empty layers. A1: FastAPI app
  (`api/routes.py`, `create_app()`), Pydantic DTOs, 14 contract tests,
  fixture-backed fake responses for all four `/v1` endpoints.
- 3 unit + 14 contract tests, `mypy --strict` and Ruff clean, error shape
  matches `ai_services/contracts/v1/schemas/error.schema.json` exactly.
- **Open finding (not yet resolved):** recommendation built a live ASGI
  app and added `fastapi`+`httpx` as dependencies during A1. Its own
  workflow doc (`agentic_flow/recommendation_workflow.md`) assigns real
  HTTP wiring to **A3**, not A1 — rooms and variants both correctly
  deferred it. This blurs the phase gate the whole process exists to keep
  legible (A1 done-evidence shouldn't require a live server). It is not
  broken — the 14 contract tests genuinely pass — but it is inconsistent
  with the other two services and with A3's own definition. **Before
  starting A2, get a `tech-lead` ruling**: either (a) treat this as
  recommendation having effectively also completed A3's HTTP-wiring step
  early and adjust its packet trail to say so honestly, or (b) leave the
  FastAPI app in place but re-scope A3 for recommendation to something
  smaller (loopback-only hardening, SQLite persistence) since the routing
  layer already exists.
- **Next:** once the above is decided, A2 (domain/application logic) per
  `agentic_flow/recommendation_workflow.md` A2 — typed domain records →
  workbook importer (needs R01) → rule-only ranking (needs R02) → bundle
  composition (needs `curalina_design_rules`, which is ready, and R03).
  R01/R02/R03 notebooks have not been started.

### Variants — A0, A1 done and verified.

- A1: plain-callable fake service layer (`FakeJobStore`, `handlers.py`)
  over Pydantic DTOs, deferring real ASGI wiring to A3 — correctly matches
  the workflow doc. 24 contract tests, `mypy --strict` and Ruff clean.
  Contributed six schemas additively to `ai_services/contracts/v1/schemas/`
  (asset, mask, visual_variant, job, candidate, review).
- **Next:** A2 per `agentic_flow/variant_generator_workflow.md` — still
  blocked on real upholstery/product photos for anything claiming
  real-model accuracy (V01). The fake-adapter A2 work (mask handling,
  LAB colour-transfer extraction stub, ports) does **not** wait on that and
  can proceed now.

### Rooms — A0, A1 done and verified, with one open cross-service finding.

- A1: plain-callable fake service layer (`RoomsContractService`) over
  Pydantic DTOs, correctly deferring ASGI wiring to A3. 26 contract tests,
  `mypy --strict` and Ruff clean.
- **Open finding (not yet resolved):** rooms defined its own local
  `AssetResponse`/review DTOs instead of using the shared schemas variants
  contributed to `ai_services/contracts/v1/schemas/`. They diverge:
  `provenance` type (dict vs. string), an exposed `storage_key` the shared
  schema forbids, a third `needs_changes` review outcome the shared schema
  doesn't have, and a `review_version` field name where the shared
  convention is `revision`. `ai_services/contracts/v1/CONTRIBUTING.md` was
  updated with a rule for this going forward (shared-endpoint concepts
  belong in the shared folder during A1, not service-local), but **the
  actual divergence in rooms' `schemas.py` has not been fixed** — it needs
  cross-service sign-off first, since asset import (`POST /v1/assets`) is
  the one endpoint used by more than one service.
- **Next:** resolve the schema divergence (align rooms' local DTOs to the
  shared schemas, or get an explicit ADR for why rooms' shape should win)
  before A2. Then A2 per `agentic_flow/room_generator_workflow.md` —
  blocked on `OQ-010` (room geometry/measurement source) for anything
  claiming a room-scale result; the fake-adapter A2 work does not wait on
  that.

### Contracts & suite steward — A0 done (Makefile scaffold), A1 partially done via the reconciliation pass above.

- `ai_services/contracts/v1/CONTRIBUTING.md` and `id_versioning.md` exist.
  Shared schemas exist for six concepts (contributed by variants). Error
  schema is the single source of truth all three services match.
- **Next:** resolve the two findings above (they were escalated, not
  fixed), then A4 (suite runner wiring — `run-suite` starting all three
  services with independent databases) once at least two services reach
  their own A3.

### UI adapter — not started. Correctly not started: depends on
recommendation reaching A3/A4, which hasn't happened yet.

## What "pick this up tomorrow" looks like, concretely

Two decisions are blocking forward progress on two services and should be
made **before** dispatching more engineering work, not discovered again by
re-reading code:

1. **Recommendation's A1-vs-A3 phase boundary.** Give whoever plays
   `tech-lead` this file's recommendation section plus
   `ai_services/recommendation/src/curalina_recommendation/api/routes.py`
   and ask for a ruling.
2. **Rooms vs. shared asset/review schema divergence.** Give `tech-lead`
   this file's rooms section plus the diff between
   `ai_services/room_generator/src/curalina_rooms/api/schemas.py` and
   `ai_services/contracts/v1/schemas/{asset,review}.schema.json`.

Everything else (design_rules' OQ-013, recommendation/variants/rooms A2,
the suite runner A4) can proceed independently of those two and does not
need re-deriving scope — the per-service briefs in this folder
(`00`–`04`) already have the full reading list and phase content; the
`agentic_flow/*_workflow.md` A2 sections are the next concrete unit of
work per service.

## Environment notes worth not rediscovering

- `agentic_flow/` is intentionally gitignored (local-only, pre-existing
  convention) — `OQ-013` lives there and will not appear if you only look
  at `git log`/`git show`. Read the file directly.
- No push access to `origin` from this environment: neither available SSH
  identity (`id_github`, `id_ed25519_eng_rj`) has write access to
  `CuralinaTech/curalina`, confirmed in an earlier session. Commits are
  local-only on `main` until that's resolved (grant push access, or push
  from a machine that has it).
- Running more than one Sonnet-tier engineering agent in parallel can hit
  a session-level rate limit (happened once already this project). Batches
  of 3 independent-package agents (as used for recommendation/variants/
  rooms A1) were fine; keep an eye out if the pattern recurs.
- Each Python package needs its own `.gitignore`
  (`__pycache__/`, `*.egg-info/`, `.coverage`, `.pytest_cache/`,
  `.mypy_cache/`, `.ruff_cache/`, `.hypothesis/`) — new packages won't have
  one until someone adds it; check before committing or build artifacts
  get staged.
