# Build status — where things stand

Last updated: 2026-09-14 (session 3). Read this before assigning any new
work — it tells you what's actually done (verified, not just claimed),
what's blocked, and exactly what to hand the next agent to pick up each
service without re-reading `architecture/`/`agentic_flow/` from scratch.

Commits so far, in order: `76c0984` (agent_instructions briefs) →
`6889604`/`6c35d20` (agent roster) → `9163002` (design_rules through
A3+D01) → `fcdf1b8` (recommendation/variants/rooms A0+A1) → `6241650`
(status) → `914bdd7` (ADR-0002/0003/0004 rulings, rooms schema fix) →
`beab59a` (A2 fake-adapter scope, all three services) → `c1bc6b6`
(status) → `83e3a7f` (ADR-0004 implemented; ADR-0005 catalogue-workbook
ruling) → `203649f` (R01 catalogue audit complete) → `16da153` (status) →
`aec8436` (R02 ranking baseline: methodology chain + engineering +
coverage remediation). All on `main`, none pushed to `origin` — still no
working push access from this environment (unchanged across three
sessions now).

## Recommendation just cleared its second real-logic gate: R02

**Decision: `insufficient_evidence`.** Not a failure of process — the
process worked exactly as designed and produced an honest negative
result instead of a fabricated positive. Full detail in
`ai_services/work_packets/REC-R02-01.md` and the executed notebook
(`architecture/notebooks/recommendation/02_ranking_baselines.ipynb`), but
the headline: the rule-only baseline **ties or loses** to a do-nothing
prevalence baseline on multiple held-out briefs. TF-IDF and MiniLM both
recorded `not_run` (scikit-learn/sentence-transformers correctly kept out
of runtime deps; this environment's Python 3.14 has no `torch` wheel
regardless of network access — confirmed independently, not just
asserted). **No G2 gate reached. No embedding path adopted. That was
never possible from this run** — `ADR-0006` fixed that ceiling before any
code was written.

Getting to this result took three rounds of methodology review before
any notebook code was written, each catching something the previous
round missed — read `ADR-0006` (`ai-ml-lead`, as amended in place —
the amendment block near the end is the operative rule, not the
struck-through original), `ADR-0007` (`tech-lead`, approves
`Product.overview` and the workbook's R01→R02 scope extension, rejects
an `attributes` bag in favor of one named field, rejects the optional
material columns as a supplier-discriminator leak), and `ADR-0006`'s
Amendment 1 again (frequency-based term selection would have picked the
LEAST discriminative values — a style in 80% of rows — producing
near-uniform relevance; revised to a discriminativeness band derived
from the decision threshold itself). **If R03's eventual evaluation
methodology reuses any of this reasoning, read all three before assuming
the pattern transfers** — several of the guards (supplier-proxy, Jaccard
collinearity, the leakage firewall) are specific to properties of this
one catalogue that may or may not recur.

**A real defect pattern surfaced twice this session and is now called
out explicitly in "Environment notes" below**: the ml-notebook-engineer's
own completion report did not disclose that nine `evaluation/` modules
sat at 0% test coverage (exercised only by manually running the
notebook). Independent re-verification caught it both times — once for
the original nine modules, once again for two more (`metrics.py`,
`label_source.py`) that the first coverage-remediation pass itself
missed. Both are now fixed; all eleven modules sit at 98-100%.

## Per-service status

### `curalina_design_rules` — A0-A3, D01, and ADR-0004's implementation all done. No change this session.

- 80 tests, 91% branch coverage, `mypy --strict`/Ruff clean.
- **Next:** wire `check_walkways_adr0004` into `api.py`'s
  `evaluate_spatial_layout` — still needs a real source of doorway/
  functional-zone positions, which nobody has investigated yet (queued
  since session 2, still queued).

### Recommendation — A0, A1, A2, R01, R02 all done and verified.

- 256 tests (up from 88 at session start), 92% branch coverage, contract
  suite unchanged at 14 (proves `api/` untouched across all of this),
  `mypy --strict`/Ruff clean.
- `Product` now carries `overview: str | None` (ADR-0007), consumed by
  real `RuleOnlyEncoder`/`TfidfEncoder`/`MiniLMEncoder` adapters behind
  the existing `FeatureEncoder` port (fake adapter untouched, still used
  elsewhere). New `evaluation/` package: vocabulary extraction, pool
  selection, brief construction, the freeze mechanism, label derivation,
  metrics (P@5, NDCG, prevalence baseline, shuffled-label control,
  supplier-proxy guard).
- **Next, two independent options** (same as last session's queue, R02
  now done instead of pending):
  1. R03 (bundle composition notebook) — still blocked regardless of
     anything above: `ADR-0005` confirmed zero rugs/lighting/accent
     chairs and no availability data in the found catalogue. R03 would
     need either a materially different/expanded catalogue, or to record
     a deliberate no-go on real data and proceed logic-only against
     labelled-synthetic fixtures (a legitimate, precedented outcome per
     `agentic_flow/recommendation_workflow.md`'s own gate table).
  2. The `ADR-0002`-flagged A3 remainder (wire `application/` into
     `api/`'s request handlers via a DTO↔domain translation layer) — has
     been queued and untouched for two sessions now. Small, well-scoped,
     and the longer it sits the more phases stack on top of the
     currently-fake wiring. **Consider prioritizing this over R03** next
     session purely because of how long it's been deferred.
- If real product photos or a bigger catalogue ever materialize, revisit
  whether they also help R03 before assuming they don't.

### Variants — A0, A1, A2 done. No change this session.

- Still blocked on real product photos (V01/V02). Nothing found this
  session helps here — the furniture workbook has no image data.
- **Next:** the missing-photos gap is a data-sourcing task; keep flagging
  it rather than routing around it. The `ADR-0002` A3 remainder (real
  HTTP wiring for the existing 24 contract tests) is independently
  actionable now and has been queued for two sessions.

### Rooms — A0, A1, A2 done. No change this session.

- **Next:** G01 (room-prep/homography notebook) — queued for two
  sessions, still not investigated for real blockers the way R02 turned
  out to have one. Worth checking whether rooms has an analogous
  "assumed input doesn't actually exist" surprise before assuming it's
  purely an engineering task. `OQ-010` blocks certified room-scale claims
  independent of G01. The `ADR-0002` A3 remainder is also queued here.

### Contracts & suite steward — A0, A1 done. No change this session.

- **Next:** A4 (suite runner) still needs at least two services at A3.
  None have reached A3 yet.

### UI adapter — not started. Correctly not started.

## What to pick up next, concretely

No decisions are blocking anything right now, but one prioritization note
carries forward from this session: **the three `ADR-0002` A3-remainder
items (recommendation, variants, rooms — real HTTP wiring replacing the
current plain-callable/partial-fake state) have now been queued and
untouched for two full sessions.** They're small. Do them before they
compound into a bigger gap between what each service's A1 "proves" and
what it actually runs as.

Units of work, roughly in priority order:

1. **The three `ADR-0002` A3 remainders** (recommendation, variants,
   rooms) — same shape each time, safe to run as 3 parallel agents (the
   verified pattern from sessions 1-2).
2. **Rooms G01** — but consider a short investigation pass first (similar
   to what caught R02's missing-evaluation-set and missing-`overview`-field
   problems) before assuming it's pure engineering with no hidden
   methodology gap.
3. **Design rules**: source doorway/functional-zone positions for
   `evaluate_spatial_layout` — still just queued, not investigated.
4. **Recommendation R03** — likely a documented no-go given the catalogue
   gaps, but that's `ai-ml-lead`'s call to make formally, not an
   assumption to skip past.
5. **Variants**: the photo-sourcing gap is not engineering work; keep
   surfacing it.

## Environment notes worth not rediscovering

- `agentic_flow/` is intentionally gitignored (local-only) — all `OQ-xxx`
  entries live there and won't show in `git log`/`git show`. Read the
  file directly.
- No push access to `origin`: confirmed across three sessions now.
  Commits are local-only on `main`.
- Batches of 3 independent-package Sonnet-tier agents in parallel have
  been fine every time tried (sessions 1-2, A1 and A2 across the three
  services).
- Each Python package needs its own `.gitignore` — all four current
  packages plus `ai_services/contracts` have one now.
- **Always independently re-run `make test`/`make lint`/`make typecheck`
  after any engineering agent reports success.** This is no longer a
  cautionary note, it's a confirmed, recurring pattern — verification has
  caught a real, previously-undisclosed problem in every single session
  so far (session 1: rooms' mypy break from a transitive numpy
  dependency; session 2: two wrong factual claims in an ADR; session 3:
  nine, then two more, `evaluation/` modules at 0% coverage that a
  building agent's own report did not mention). Specifically for
  coverage: **check per-module numbers, not just the aggregate percentage**
  — an aggregate in the high 80s/low 90s can still hide individual
  modules sitting at 0%, especially newly-added ones, because they're a
  small fraction of total statements.
- When new source data turns up in unexpected places, don't assume it's
  sanctioned input just because it's real — get a `tech-lead` ruling on
  provenance first (this is now precedented three times: the catalogue
  workbook's discovery, its extension from R01 to R02, and the
  `Product.overview` field it justified).
- When a notebook's reference implementation or an existing skeleton
  assumes an input exists (a fixture file, a labelled dataset, a specific
  column), **check that the input is actually present before dispatching
  engineering work** — R02's reference notebook assumed a 12-brief
  labelled evaluation set that existed nowhere in the repository, and
  catching that before dispatch (rather than after a wasted engineering
  round) is what triggered the whole `ADR-0006` methodology chain in the
  first place. This is the same category of check as verifying V01's
  photos or G01's room-prep inputs — do it up front, not after the fact.
