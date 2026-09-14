# Architecture decision record

ID: ADR-0006 — R02 evaluation methodology: admissibility of a constructed
evaluation set, the leakage firewall, and the claim ceiling it implies
Status: **accepted as a conditional methodology ruling.** R02 may proceed
with a constructed (derived-label) evaluation set, under the protocol
below, with a hard ceiling on what its result may claim. R02 is **not**
runnable today — one blocking prerequisite (§P) must be resolved first,
and it is an engineering/contract item, not a data-sourcing item.
Owner and reviewer: `ai-ml-lead` (evidence-quality call). `tech-lead` owns
the `Product` contract extension in §P and owns the narrow extension of
ADR-0005's admissibility scope recorded in §D0. `design_authority` owns
any request to invent vocabulary (§D3).
Date: 2026-09-13
Supersedes nothing. Extends ADR-0005 on one narrow point (§D0).

**Amended 2026-09-13 (Amendment 1, §D3a / §D4a / §D6b, at the end of this
document).** §P is now resolved by ADR-0007 §D1 and §D0 is concurred by
ADR-0007 §D2, so R02 is no longer blocked as a task. §D3's Stratum A
term-selection paragraph and §D5 step 2 are **superseded**; §D4's
`unmapped` definition is clarified; §D6 gains two controls. Read §D3a
before implementing §D3 or §D5. The §D6a claim ceiling and the G2 status
are unchanged: **G2 remains not reached.**

## Context

### What R02 has to decide, and the two different bars it faces

`agentic_flow/recommendation_workflow.md`'s gate table does not treat R02
as one gate. It names two separable claims with different evidentiary
bars, and this distinction is the load-bearing fact in this ADR:

| Claim being promoted | Evidence the table demands |
|---|---|
| Rule-only ranking as accepted baseline (A2 step 3) | "R02 baseline comparison **recorded**" |
| Semantic/embedding ranking (MiniLM) as accepted path (A2 step 4) | "R02 held-out comparison **shows benefit** over baseline, ADR recorded" |
| Any "meets acceptance thresholds" claim | Stage gate **G2** |

"Recorded" and "shows benefit" are not the same standard, and neither is
G2. A constructed evaluation set can satisfy the first. It cannot satisfy
the third. Whether it can satisfy the second is the real question, and the
answer below is no — not on this data.

### What the reference notebook assumes, and why none of it exists

`agentic_flow/R02_ranking_baseline.ipynb` is a structural pattern for the
seven-section standard, not a runnable artifact. Independently confirmed:

- It loads `evaluation/briefs_v1.json` and
  `evaluation/relevance_labels_v1.csv` via
  `curalina_recommendation.evaluation.briefs`. No such module, package
  directory or file exists anywhere in this repository.
- It imports the catalogue from `data/raw/Celadon-CSV-Programmer-Handoff.xlsx`,
  sheet `ARTWORK`, 62 artwork records — i.e. the catalogue named in
  `OQ-011`'s *original, now-stale* text. R01 actually ran against the
  385-row Four Hands / Moe's Home furniture workbook admitted by ADR-0005.
- Its "blocked by" line names **designer relevance labels on a pooled
  candidate set**. That blocker is real and unresolved. This ADR does not
  pretend otherwise; it rules on what may be done in its absence.

So R02's stated inputs do not exist and its stated catalogue is the wrong
one. Same caveat as when this notebook was used as a pattern for D01.

### Why this is not the same kind of blocker as V01

Variants' V01 is blocked because the **input** is missing: there are no
upholstery/product photographs anywhere in the repository, and ADR-0005
confirmed the found workbook has no image or asset column of any kind. You
cannot inpaint a photograph that does not exist. Constructing one would
mean fabricating the very artifact under test — the pixels that V01
measures *are* the thing that is missing.

R02's **input exists**: ~343 distinct real products with real prices,
dimensions, materials, free-text overviews, and designer-authored
`Room Type` / `Design Style` / `Tags` values, plus a designer-authored
controlled vocabulary in
`attached_assets/Quiz and Product Mapper file instruction_1762400632880.xlsx`
(sheets `SUB-CATEGORIES`, `Design Style Definitions`, `Tags`, including a
`Tag Reference (Based on Style)` column that is a designer-authored
tag→style mapping). What is missing is the **target**: relevance labels.

A missing input cannot be conjured. A missing target can be constructed by
an authorized party — that is how ground truth is established for any
first baseline. The two are not the same blocker and treating them
identically would be a category error in both directions: it would
indefinitely freeze R02 for no gain, and it would imply V01 could be
unblocked by "constructing" photos, which it cannot.

### But a constructed evaluation set has a specific failure mode

The risk is not that constructing labels is illegitimate. The risk is
**circular validation**: if one party authors the briefs, authors the
labels, and implements the encoders, the labels can be written — even
unconsciously — to flatter whichever encoder that party expects to win,
and no reader of the notebook can detect it. The reference notebook's
requirement that designers label a *pooled* candidate set exists precisely
"so the winning method does not define its own ground truth."

That risk is real and is what most of this ruling is designed against. It
is not, however, a reason to produce no evidence. It is a reason to make
the labelling **derived rather than judged** — a published, deterministic
function over designer-authored columns, applied exhaustively, frozen by
hash before any encoder is constructed. The auditable question then
becomes "is this label rule defensible?", which any reader can check, in
place of "did the labeller favour an encoder?", which no reader can check.

### §P — The blocking prerequisite nobody has noticed yet

**R02 cannot be run today, for a reason unrelated to labels.** I read the
live domain model rather than the design document:

`ai_services/recommendation/src/curalina_recommendation/domain/product.py`
— `Product` carries `product_id`, `key`, `category`, `name`,
`availability`, `price`, `dimensions`, `source_snapshot_id`. **There is no
`overview`/description text, no style field, no tags field, no room-type
field.** This is correct and deliberate: ADR-0005 recorded workbook columns
7, 8, 9/34, 10, 26 (`Room Type`, `Design Style`, `Key Features`,
`Storage Solutions`, `Tags`) as *present in source but deliberately
unmapped*, and R01 mapped only what it was authorised to map.

The consequence for R02 is severe and must be stated before any engineer
starts work:

- `RuleOnlyEncoder` is specified in `agentic_flow/13_recommendation_technical_design.md`
  as "no vectors; score from explicit style/atmosphere tag matches only."
  There is nothing on `Product` to match `Profile.style` or
  `Profile.atmosphere` against. As the contract stands, the baseline
  **cannot be implemented at all**.
- `TfidfEncoder` and `MiniLMEncoder` would have `name` plus `category` as
  their entire candidate text. A TF-IDF-vs-MiniLM comparison over a
  product name and a category string measures almost nothing, and a result
  from it would be noise dressed as evidence.

R02 therefore has a precondition: the encoder-visible text surface must
carry the workbook's `Overview` column (and optionally the three supplier
material columns 19/31/33). That is an **additive `Product` contract
change** touching A2's frozen domain surface, and it is `tech-lead`'s
call, not an engineer's and not mine. It is small, it is resolvable
in-session, and it does not depend on any client input — which is exactly
why it is a prerequisite and not a blocker of V01's kind.

Note what this precondition does *not* include: `Room Type`,
`Design Style` and `Tags` must stay off `Product`. See §D2.

## Options

**Option A — Block R02 as V01 is blocked.** Wait for designer-sourced
relevance labels on a pooled candidate set before any R02 run. Rejected:
it conflates a missing target with a missing input; it produces zero
evidence and zero reproducible harness; it leaves the `FeatureEncoder`
port with only a no-op fake indefinitely, so A2 step 3 never moves; and it
contradicts the project's own posture, which is to produce documented
evidence with the caveat attached rather than indefinite silence (the
reasoning ADR-0005 used to reject the same move for R01).

**Option B — Proceed with a hand-authored evaluation set and treat the
result as a normal R02 clearance.** Author twelve briefs, hand-assign
0/1/2 labels by designer-style judgment, run three encoders, adopt the
winner. Rejected: this is the circular-validation failure mode with no
defence against it, on n=12 with ~n=4 held out, against a catalogue whose
provenance the client has not confirmed and whose style/tag columns R01
found to be pervasively drifted (`Warm Transittional`,
`Midcentury Scandi`, `Everyday Elegience/Gracious`, semicolon-delimited
tag lists). It would also permit `adopt_minilm` on evidence that cannot
bear the weight of a permanent `sentence-transformers` dependency.

**Option C (chosen) — Proceed with a *derived-label* evaluation set under
a freeze protocol, a structural leakage firewall, and a stated claim
ceiling that stops short of adoption and well short of G2.** Labels are
computed by a published deterministic rule over designer-authored columns,
not judged; the label-source fields are structurally invisible to the
encoders; briefs are drawn from the client's own controlled vocabulary;
everything is hashed before an encoder exists; and the set of decisions
the run is permitted to reach is enumerated in advance.

## Decision and rationale

### D0 — Catalogue admissibility for R02 (narrow extension of ADR-0005)

ADR-0005 admitted the pinned workbook as a labelled, real,
provenance-unconfirmed input **for R01 only**, splitting the ruling on
whether the consumer treats the catalogue as an *object of audit* or as a
*source of truth about what can be bought and placed*.

R02 sits on the R01 side of that line, and is admitted on the same terms,
**provided its outcome is capped below adoption per §D6.** R02 consumes
the catalogue as a ranking substrate for a measurement, and its output is
a findings document. Provenance uncertainty degrades a decision built on
the data; it does not degrade a measurement of relative ranking quality
over the data, provided the measurement says plainly what it ranked. If
the client later says this file is stale or test material, R02's harness,
label rule and relative comparison survive as an audit of *a* supplier
export; only the absolute numbers are discarded, and every number carries
the marker that says so.

ADR-0005's provenance caveat travels verbatim into R02's decision record,
exactly as it did for R01. Every finding is scoped to "the workbook at
`attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`,
md5 prefix `3ad1f5d7`, 385 rows × 36 cols", never to "the Curalina
catalogue". This extension is `tech-lead`'s to reverse; I am ruling on the
evidence dimension only, and the provenance dimension is unchanged.

R03 is untouched and stays blocked. Nothing here bears on OQ-009, OQ-011,
or the variants photo blocker.

### D1 — Ruling

**R02 may proceed with a constructed evaluation set.** It is not blocked
in V01's sense. It is gated on §P (the `Product` text-surface extension)
and on the protocol in §D2–§D7 being followed in order.

A run that departs from the freeze protocol is not a weaker R02 result. It
is **not an R02 result** and must be recorded as `insufficient_evidence`.

### D2 — The leakage firewall (the single most important requirement)

The tech design already warns that `Design Style` must be excluded from
candidate text so a style evaluation does not leak its own target. That
warning is necessary but not sufficient here, because a label rule built
on `Design Style` plus a rule-only encoder that can read `Design Style`
makes the baseline win 1.00 by construction, while the embedding arms are
graded on recovering a string they cannot see. Either way the comparison
is meaningless.

The firewall is therefore **structural, not conventional**:

| Field | Role | Where it lives |
|---|---|---|
| `name`, `category`, `overview`, material text | **Encoder-visible** | `Product` (per §P) |
| `Room Type`, `Design Style`, `Tags` (normalized) | **Label-basis only** | the frozen `evaluation/` files — **never on `Product`, never reachable from a `FeatureEncoder`** |
| `price`, `dimensions`, `availability` | Layer-1 hard filters | `Product` (already present) |

Consequences an engineer must not "fix":

- `RuleOnlyEncoder` is redefined for R02 as a **lexical controlled-vocabulary
  baseline**: it scores the overlap between the profile's canonical
  style/atmosphere/category terms (and the style's designer-authored
  descriptor words from the mapper's `Design Style Definitions` sheet) and
  the encoder-visible text. This is a legitimate, non-tautological
  baseline and is what "explicit tag matches, no vectors" must mean once
  field discipline is applied. Record this redefinition in the notebook —
  it is a deliberate deviation from the tech design's wording, made to
  remove leakage, not an implementation shortcut.
- The notebook must assert the firewall mechanically: a test/assertion
  listing the label-source field names and the encoder-source field names
  and requiring the intersection to be empty. If that assertion is absent,
  the run is `insufficient_evidence`.

### D3 — Briefs: how many, and on what basis

**Sixteen briefs, in three strata.** This revises the reference
notebook's "twelve = three styles × three atmospheres plus restrictive
budget/size cases", which was sized for a 62-record artwork catalogue.
Revisions and their reasons:

- **Stratum A — 9 briefs: 3 design styles × 3 atmospheres.** Unchanged in
  shape; this is the core comparison.
- **Stratum B — 4 briefs: constraint-restrictive.** Low budget; tight
  dimension ceiling; single required category; multi-category. These test
  that ranking survives Layer-1 filtering, which the artwork-era design
  also intended.
- **Stratum C — 3 briefs: adversarial / expected-negative.** New, and
  mandatory. At least one brief must be one where the *correct* answer is
  "insufficient eligible inventory" — e.g. a living room brief requiring
  lighting or a rug, which ADR-0005 established this catalogue contains
  zero of. Stratum C exists because a near-uniform catalogue lets a
  useless encoder post good aggregate numbers; a run with no brief that
  *should* fail cannot distinguish a working ranker from a lucky one.

**Vocabulary provenance — nothing may be coined by the brief author:**

- `style` values: verbatim from the mapper's `SUB-CATEGORIES` →
  `Design Style` column (`Mid-Century Scandi`, `Modern Farmhouse`,
  `Warm Transitional`, `Organic Modern`, `Contemporary Lux`,
  `Artful Eclectic`).
- `atmosphere` values: **verbatim single tag strings** from the mapper's
  `SUB-CATEGORIES` → `Tags` column (26 values). Do **not** invent
  atmosphere *families* or groupings over those tags. If the evaluation
  appears to need a grouping, that is a `needs_input` to
  `design_authority` — not an authoring decision.
- `room_type` values: verbatim from the `Rooms` column.
- `categories`: verbatim from the `Furniture Category` column.
- `budget`: set from the observed price distribution of the eligible set
  for that brief (e.g. 40th percentile for the low-budget case), recorded
  with the percentile used. Never a round number picked by feel.

**Which three styles and three atmospheres:** ~~chosen **by frequency in the
pinned snapshot after normalization, computed and recorded before any
label is written** — the three most-populated canonical styles and the
three most-populated canonical tags, with their counts printed in the
notebook. Not chosen by the author's sense of which are interesting.~~

> **SUPERSEDED by §D3a (Amendment 1, 2026-09-13).** This paragraph is
> wrong on this data and must not be implemented. Frequency selection
> picks the *least* discriminative values in the catalogue; measured, it
> yields a mean within-pool relevance rate of 0.85, at which a ranker that
> does nothing scores P@5 ≈ 0.85 and several briefs score 1.00 for every
> arm. Raised by `tech-lead` in ADR-0007 §C3; re-measured and ruled on in
> §D3a below. The Stratum A **structure** also changes — see §D3a §H.

**Realizability rule:** every Stratum A and B brief must have ≥20 eligible
products after Layer-1 filtering. A brief that does not is either
re-parameterised *before the freeze* or moved to Stratum C and declared a
thin-inventory case. After the freeze, no brief may move.

### D4 — Relevance labels: derived, not judged

Labels are produced by a published deterministic function, parameterised
by a frozen `evaluation/label_rules_v1.yaml`, applied **exhaustively to
every (brief, product) pair** in the pinned snapshot — not to a pooled
top-K. Exhaustive deterministic labelling removes the pooling-depth bias
the reference notebook's pooling requirement was designed to prevent, and
removes labeller preference entirely, at the cost that label *validity* is
only as good as the designer columns. That trade is stated, not hidden.

Grades, on the reference notebook's 0 / 1 / 2 scale:

- **Precondition** — the product's normalized `Furniture Category` is in
  the brief's required categories **and** its normalized `Room Type` set
  contains the brief's room type. Precondition fails → **0**.
- **2 (strong)** — precondition **and** normalized `Design Style` set
  contains the brief's style **and** normalized `Tags` set contains the
  brief's atmosphere tag.
- **1 (acceptable)** — precondition **and** exactly one of (style match,
  atmosphere match). The mapper's `Tag Reference (Based on Style)` column
  is the designer-authored authority on whether a tag is consistent with a
  style; where it resolves the case, use it rather than a coin-flip rule,
  and cite the row.
- **0** — everything else, including precondition pass with neither match.
- **`unmapped`** — a product whose style or tag strings do not resolve to
  canonical vocabulary through the frozen normalization map. **Excluded
  from the labelled set for that brief, counted, and reported per brief.**
  Never silently graded 0 — that would convert a data-quality defect into
  a ranking penalty. **(Definition clarified by §D4a — the wording above
  is ambiguous between "no token resolves" and "some token does not
  resolve", and the two readings differ by 51 percentage points on one
  Stratum A pool. Use §D4a.)**

**Normalization** (`evaluation/vocabulary_map_v1.yaml`) maps observed
free-text to canonical terms and is authored **against the mapper file's
canonical lists**, not invented. R01 catalogued the drift this must
handle: `Warm Transittional`, `Midcentury Scandi` vs
`Mid-Century Scandinavian`, `Contemporary Lux` vs `Contemporary Luxe`,
`Living room` vs `Living Room`, `entryway`, `Everyday Elegence/Gracious`,
`I love patters`, `Family Gatherinegs/ Humble`, semicolon-delimited tag
lists. Every mapping entry carries the canonical term it targets. Anything
not confidently mappable is `unmapped` — never best-guessed.

**Label-coverage guard:** if `unmapped` exceeds 15% of a brief's eligible
set, that brief is flagged `low_label_coverage`, reported in full, and
**excluded from headline means**. Coverage is reported per brief
regardless.

The label function must not read `name`, `overview`, or material text, and
must not read any encoder output. The notebook asserts this (§D2).

### D5 — Freeze protocol, in this order, no exceptions

1. Author `evaluation/vocabulary_map_v1.yaml` from the mapper file.
2. ~~Compute and record style/tag frequencies over the pinned snapshot;
   select the three styles and three tags for Stratum A from them.~~
   **Replaced by §D3a:** pin the three Stratum A candidate pools, then run
   the §D3a §I selection procedure over the frozen vocabulary map and
   record the full per-cell diagnostic table (including rejected cells and
   the guard each failed), not only the nine survivors.
3. Author `evaluation/briefs_v1.json` — 16 briefs, canonical vocabulary
   only, realizability checked.
4. Author `evaluation/label_rules_v1.yaml`.
5. Generate `evaluation/relevance_labels_v1.csv` exhaustively.
6. Assign the split **mechanically, not by hand**: within each stratum,
   sort `brief_id` by `sha256(brief_id)` and take `ceil(n/3)` as held-out.
   This yields 3 of 9 (A), 2 of 4 (B), 1 of 3 (C) → **6 held-out, 10 dev**,
   with every stratum represented on both sides.
7. Write `evaluation/FREEZE_v1.json`: `sha256` of each of the four files
   above, plus the pinned workbook md5, UTC timestamp, git SHA.
8. **Only now** may any `FeatureEncoder` adapter be constructed or run.
9. Section 0 of the notebook recomputes all five hashes and **fails the
   run loudly** on any mismatch. A run that cannot prove the freeze
   predates the encoders is `insufficient_evidence`.
10. **No in-place edits after freeze.** If a brief or label must change,
    bump to `_v2`, re-freeze, re-run all arms, and report *both* runs with
    a written statement of why v1 was invalidated. A silent re-freeze is a
    rejected result, not a borderline one.

Under this protocol one party may legitimately author the evaluation set
and implement the encoders, because the labels are derived by a rule a
third party can read and re-execute — which is the only thing that makes
that arrangement acceptable. It is not acceptable for a hand-judged set.

### D6 — Decisions available, and what separates them

Available outcomes from a constructed-set R02 run:

- `adopt_rule_only_interim`
- `prefer_tfidf_interim`
- `embedding_promising_defer_to_designer_labels`
- `insufficient_evidence`

**Not available from this run: `adopt_minilm`, and no durable adoption of
any embedding arm.** The gate table requires "held-out comparison shows
benefit over baseline" before MiniLM becomes an accepted path. Six
held-out briefs, labelled by a rule derived from columns the catalogue
audit found pervasively drifted, over a catalogue the client has not
confirmed, cannot certify benefit sufficient to justify a permanent
`sentence-transformers` dependency. Writing `adopt_minilm` into the
decision record of this run is out of scope for the run, whatever the
numbers say.

Criteria:

- **`adopt_rule_only_interim`** — satisfies the gate table's "R02 baseline
  comparison recorded", unblocking A2 step 3. Requires: freeze verified;
  firewall assertion passes; all arms ran or a missing arm is recorded as
  `not_run` with a reason (§D7); per-brief P@5 and NDCG@5 reported for dev
  and held-out with sample sizes; zero hard-rule violations; the
  shuffled-label control (§D7) separates cleanly. **It does not require
  P@5 ≥ 0.80** — that is G2's threshold, and this outcome makes no G2
  claim. Ships behind the `FeatureEncoder` port with a written limitation.
- **`prefer_tfidf_interim`** — same bar, where TF-IDF wins. Still interim;
  `scikit-learn` stays an optional extra (§D7).
- **`embedding_promising_defer_to_designer_labels`** — requires an
  embedding arm to beat rule-only by **≥0.10 absolute mean P@5 on
  held-out**, **and** to win on **≥5 of the 6 held-out briefs
  individually**, **and** to survive the shuffled-label control. Even then
  the action is "commission designer-sourced labels on a pooled candidate
  set", not adoption. Below that margin, the embedding path is **not**
  carried forward, and that negative *is* reportable on this evidence:
  the burden of proof sits with the added dependency, so declining
  complexity legitimately needs less evidence than adopting it. State this
  asymmetry in the decision record so a later reader does not mistake it
  for inconsistency.
- **`insufficient_evidence`** — mandatory if any of: a freeze hash
  mismatches; the firewall assertion is absent or fails; more than two
  held-out briefs are `low_label_coverage`; more than two held-out briefs
  have fewer than five eligible products (the metric is then measuring
  inventory, not ranking); the shuffled-label control does not separate;
  or the MiniLM arm did not run **and** the report would otherwise state a
  rule-only-vs-embedding conclusion.

### D6a — Claim-strength ceiling, stated plainly

**An R02 run on this constructed set cannot produce a G2 sign-off, cannot
support a "meets acceptance thresholds" claim, cannot promote MiniLM, and
cannot close or advance OQ-011 — even if held-out P@5 and NDCG@5 both come
back at 1.00 on all six briefs.**

Why, specifically:

1. **n = 6 held-out briefs.** Per-brief variation dominates; any
   confidence interval over six paired observations is wide enough to
   contain "no difference" for all but enormous margins.
2. **The labels are self-consistent by construction and of unknown
   validity.** A deterministic rule has perfect internal agreement, which
   looks like reliability and is not. There is no inter-rater agreement
   because there is no second rater — and no first human rater either.
   This is a *different* weakness from the reference notebook's "single
   designer pass, no inter-rater agreement", and in the validity dimension
   it is weaker, not stronger.
3. **The label basis is the drifty columns R01 audited as defective**, and
   the normalization map that repairs them is itself an authored artifact.
4. **Provenance is unconfirmed** (ADR-0005's five open points), so no
   absolute number here describes "the Curalina catalogue".
5. **The catalogue has zero rugs, lighting, and accent chairs**, so
   living-room ranking is exercised over a supplier-merge subset.

What it *can* support: unblocking A2 step 3 with rule-only ranking as the
accepted **interim** baseline carrying a written limitation; a frozen,
reproducible harness and label rule that the eventual designer-labelled
run will be measured against; and a documented negative on the embedding
path if one is observed.

**G2 remains not reached.** No notebook, phase, or ADR — including this
one — substitutes for it.

### D7 — Execution constraints: network, weights, dependencies, controls

**Network access for MiniLM weights: permitted in the notebook, forbidden
on the fast test path.** `sentence-transformers/all-MiniLM-L6-v2` is
roughly 90 MB and downloads from HuggingFace on first use. The
project-wide rule is that *fast tests* never require GPU, Internet, cloud
accounts, model downloads or customer data; evaluation runs are an
explicitly separate and slower path, and `agentic_flow/16_notebook_standard.md`
already presumes notebooks that require a GPU (V02, G02). A one-time
cached download in an evaluation notebook is therefore in scope and is
**not** a blocker worth escalating. Conditions:

- Pin `revision=` to a commit SHA, never a branch name.
- Cache to a gitignored local `model_cache/`.
- Record model id, revision SHA and the resolved weight-file hash in the
  Section 0 manifest.
- `MiniLMEncoder` lives behind the `FeatureEncoder` port and must not be
  imported by any module on the fast test path. Enforce with an
  import-guard test: `make test` stays green with `sentence-transformers`
  absent from the environment.

**Dependencies.** Neither `scikit-learn` nor `sentence-transformers` is a
dependency of `curalina_recommendation` today. Both go into a new
`[project.optional-dependencies] eval` extra. Adding either to runtime
`dependencies` before a gate accepts it would pre-decide R02's outcome and
is forbidden.

**No network available at run time** is an execution condition, not a
methodology failure: run the two available arms, record MiniLM as
`not_run: no_network`, and **never** record a not-run arm as a loss. The
outcome ceiling then drops per §D6's last bullet.

**Shuffled-label control (mandatory).** Re-compute all metrics against
labels randomly permuted across products within each brief, at a fixed
recorded seed. If an arm scores near its real value under permuted labels,
the metric is not measuring what the run claims. This is cheap, it is the
strongest single falsification check available at this sample size, and
its absence makes the run `insufficient_evidence`.

**Reporting.** Per the reference notebook and unchanged: P@5 (relevance =
label ≥ 1), NDCG@5 with graded gains over 0/1/2, per brief *and* averaged,
with sample size; no-result rate; hard-constraint violations; median
latency; insufficient-inventory reported **separately** from ranking
failure; NDCG marked undefined (and counted) where a brief has no relevant
labelled item. Added here: per-brief `unmapped` coverage, per-brief
paired deltas against rule-only, and a bootstrap interval over briefs that
is reported **with** the statement that six briefs make it wide by
construction. Every failure is retained and displayed; a notebook showing
only wins cannot clear anything.

## Amendment 1 — §D3a, §D4a, §D6b (2026-09-13)

Status: **accepted.** Owner and author: `ai-ml-lead`. Trigger: ADR-0007
§C3, in which `tech-lead` recorded that §D3's frequency-selection rule
picks the least discriminative values in the catalogue, and correctly
declined to fix it on the grounds that it is an evidence-design question.
This amendment supersedes §D3's "which three styles and three atmospheres"
paragraph and §D5 step 2, clarifies §D4's `unmapped` definition, and adds
two controls to §D6. Nothing in ADR-0007 §D1 (`Product.overview`) or §D2
(workbook scope) is touched; both are settled and this amendment depends
on them.

All figures below were computed by me against the pinned workbook
(md5 `3ad1f5d7e47cca273e3fecd5ede64054`, 385 rows × 36 cols), not taken
from ADR-0007 or from the task framing. Where my numbers differ from
ADR-0007 §C3's I say so and explain why.

### §D3a-A — Why frequency selection fails, measured rather than argued

The confirmed marginals (my normalization; see §D3a-K for its limits):

| Term | Catalogue prevalence | Four Hands | Moe's Home |
|---|---|---|---|
| `Warm Transitional` (style) | 312/385 (81.0%) | 269/271 (99.3%) | 43/114 (37.7%) |
| `Clean Line/Structured` (tag) | 358/385 (93.0%) | 269/271 (99.3%) | 89/114 (78.1%) |
| `Warm Neutrals` (tag) | 321/385 (83.4%) | 265/271 (97.8%) | 56/114 (49.1%) |

These reproduce ADR-0007 §C3 exactly for the two tags and to within two
rows for `Warm Transitional` (312 vs 310; the difference is that I map the
observed `Farmhouse` and `Mid-Century Scandinavian` variants, which touches
adjacent rows). The finding is not sensitive to that.

**The damage, quantified.** §D4 grades `label ≥ 1` on *(style match OR
atmosphere match)*, and §D7's headline metric is P@5 with relevance =
label ≥ 1. So the quantity that determines what P@5 can possibly measure
is not either column's marginal frequency — it is the **union rate**
r = P(style ∨ atmosphere | product passes the §D4 precondition), evaluated
*within the brief's own candidate pool*. A ranker that does nothing at all
scores an expected P@5 of exactly r. The entire achievable range for every
arm is therefore `1 − r`.

Applying the §D3 frequency rule (top-3 styles `Warm Transitional`,
`Organic Modern`, `Modern Farmhouse`; top-3 tags `Clean Line/Structured`,
`Warm Neutrals`, `Earth & Stone`) to the three pools selected in §D3a-I:

| Pool | min cell r | **mean cell r** | max cell r |
|---|---|---|---|
| A1 Dining room / dining categories (n=137) | 0.34 | **0.86** | 1.00 |
| A2 Bedroom / Nightstand (n=82) | 0.59 | **0.82** | 0.98 |
| A3 Living room / seating + storage (n=75) | 0.51 | **0.88** | 1.00 |

Mean r across the nine frequency-selected cells is **0.85**, and cells at
r = 1.00 are ones where *every* eligible product is relevant, so P@5 = 1.00
is returned by a broken encoder, a shuffled encoder and a correct encoder
alike. Total achievable range collapses to ≈ 0.15 — while §D6 requires a
0.10 absolute margin to call an embedding arm promising. Under the
superseded rule that threshold was two thirds of the entire range, which
made it accidentally near-unreachable rather than strict. ADR-0007's
judgement that this burns the whole freeze-and-run cycle is correct.

### §D3a-B — What is selected on

Terms are selected on **within-pool discriminativeness**, where a *pool* is
the set of catalogue rows passing a brief's §D4 precondition (room type and
furniture category) and its Layer-1 hard filters. Two statistics per
candidate cell:

- `r_union` = |{p : style(p) ∨ atmosphere(p)}| / |pool| — sets the floor a
  do-nothing ranker achieves and the ceiling any arm can improve on.
- `r_grade2` = |{p : style(p) ∧ atmosphere(p)}| / |pool| — determines
  whether the 0/1/2 scale is actually three-valued. With zero grade-2
  products, NDCG@5's graded gains are vacuous and the brief silently
  degrades to a binary measure.

Frequency in the catalogue as a whole is **not** a selection input. It is
recorded as context only.

### §D3a-C — The band, derived from the decision rule it has to support

A cell is admissible iff **all** of:

| Guard | Threshold | Why this number |
|---|---|---|
| Union rate upper bound | `r_union ≤ 0.60` | §D6 requires a **0.10** absolute mean-P@5 margin for `embedding_promising`. Requiring the achievable range `1 − r` to be at least **4×** that threshold gives `r ≤ 0.60`. Below 4× the decision threshold starts competing with the metric's own headroom rather than with the baseline. |
| Union rate lower bound | `r_union ≥ 0.15` | Not about discrimination — lower `r` is strictly better for that. It is about attrition: §D4's `unmapped` exclusions and Layer-1 filtering both remove products, and at very low `r` a handful of exclusions can move P@5 by a full rank position. |
| Absolute positives | `≥ 10` | P@5's ceiling is `min(1, positives/5)`. Below 5 positives the metric measures inventory, not ranking — §D6 already voids a run on that basis. 10 gives 2× slack against post-freeze attrition. |
| Absolute grade-2 | `≥ 3` | Keeps the 0/1/2 scale three-valued so NDCG@5 measures something P@5 does not. |
| Style↔atmosphere collinearity | `Jaccard(style_set, tag_set) < 0.60` | If the style indicator and the tag indicator are near-identical within the pool, the brief has one axis, not two, and grade 1 ("exactly one match") is nearly empty. |

The resulting target band is 0.15–0.60 with binding count floors — inside
the 20–60% range the framing anticipated, but derived from §D6's own
threshold rather than assumed.

### §D3a-D — Selection is joint, not per-axis. Ruling: joint

Marginal selection on each axis independently is rejected. The metric
consumes the **union**, and the union is not recoverable from the two
marginals, because style and tag are strongly and inconsistently dependent
in this data. Measured examples from the A1 pool: `Organic Modern` (26% of
that pool) with `Everyday Elegance/Gracious` gives r = 0.39, while
`Artful Eclectic` (a *rarer* style, 11%) with `Earth & Stone` gives a
*higher* r = 0.36–0.39 in the same pool. Independence would predict the
opposite ordering. The selection unit is therefore the
**(pool, style, atmosphere) triple**, and both `r_union` and `r_grade2` are
computed on the realised triple.

Note the corollary: the amended rule does **not** blacklist
`Warm Transitional`. It is unusable in a Four Hands pool (99.3%, saturated)
and perfectly usable in a Moe's pool (37.7%) — and it is in fact selected
for brief A2-2 below. Discriminativeness is a property of a term *in a
pool*, never of a term.

### §D3a-E — New guard: atmosphere-term collinearity within the pool

This is not in the original §D3 and is the finding that most changes the
design. The `Tags` column does not carry 26 independent atmosphere
dimensions; within a single-supplier candidate pool it collapses into a
handful of equivalence classes, because the tags were evidently applied in
bundles rather than judged one at a time. Measured, at Jaccard ≥ 0.80:

| Pool | Collinear atmosphere pairs | Examples (Jaccard) |
|---|---|---|
| Dining room / Dining Chairs (n=94, all Four Hands) | 6 | `Upscale/Chic` ≡ `Monochrome Luxe` ≡ `Everyday Elegance/Gracious` (**1.00**); `Earth & Stone` ≡ `Relaxed Sophistication/ Minimalist` (**1.00**); `Heritage Warmth` ≡ `Family Gatherings/ Humble` (**1.00**) |
| Entryway / Console Table (n=41, all Four Hands) | 8 | `Clean Line/Structured` ≡ `Warm Neutrals` ≡ `Relaxed Sophistication/ Minimalist` ≡ `Just Solids` (**1.00**) |
| Bedroom / Nightstand (n=82, all Moe's) | 9 | `Elegant/Balanced` ~ `Everyday Elegance/Gracious` (0.93); `Everyday Elegance/Gracious` ~ `Just Solids` (0.92) |
| Bedroom / Bed (n=32, mixed) | 8 | `Calm/Serene` ≡ `Elegant/Balanced` ≡ `Soft Contrast` ≡ `Just Solids` (**1.00**) |

Two briefs built on a J = 1.00 pair are **the same brief twice**. That is
not merely wasteful: §D6a's claim ceiling is argued from "n = 6 held-out
briefs", and duplicate briefs would make the effective n smaller than the
stated one while every reported confidence interval assumed the stated one.
That is a falsification risk, not an inefficiency.

**Guard: within a pool, no two selected atmosphere terms may have
Jaccard ≥ 0.60**, and the realised pairwise Jaccards are reported per pool.

### §D3a-F — New guard: material-family tags are excluded from the atmosphere axis

ADR-0007 §D1 established that `Overview` is safe to expose because the only
verbatim echoes of `Tags` into it are material nouns (`marble`, `walnut`,
`iron frame`). That finding cuts both ways, and ADR-0007 did not draw the
second edge: if a **material** tag is used as a brief's atmosphere term,
the label is partly recoverable verbatim from the encoder-visible
`overview` text, and §D2's firewall leaks through the data for that brief
specifically. My own token-level echo counts confirm the exposure is real:
`White Oak/Linen/Travertine` 32/385, `Velvet/Brass/Smoked Glass` 27/385,
`Walnut` 19/385 — against 0/385 for every style term.

**The five material-family tags — `Walnut`, `White Oak/Linen/Travertine`,
`Shiplap/Wrought Iron`, `Velvet/Brass/Smoked Glass`, `Satin/Metallics` —
are ineligible as atmosphere terms.** They remain valid label inputs; they
may not define a brief. The remaining 21 tags form the atmosphere
vocabulary. This restriction costs nothing: all five are rare
(≤ 13.5% catalogue-wide) and none would have passed the §D3a-C count
floors anyway.

### §D3a-G — Ruling on supplier awareness: yes, and per-supplier reporting is not a substitute

**Decision: the selection rule is supplier-aware, but not by stratifying
term selection per supplier.** ADR-0007's per-supplier reporting
requirement is necessary and is retained unchanged; it is not sufficient,
for a reason the reporting requirement cannot reach.

The finding that settles it is one neither ADR-0007 nor the framing had:
**the candidate pools are themselves almost perfectly supplier-determined.**

| Pool | n | Four Hands | Moe's |
|---|---|---|---|
| Dining room / Dining Chairs | 94 | 94 | 0 |
| Bedroom / Dresser | 47 | 47 | 0 |
| Entryway / Console Table | 41 | 41 | 0 |
| Bedroom / Nightstand | 82 | 0 | 82 |
| Living room / End Table | 84 | 0 | 84 |

And the tag distributions are not merely 3× skewed as ADR-0007 reported —
six atmosphere tags are **perfectly supplier-disjoint**: `Elegant/Balanced`
(0/271 FH, 94/114 MO), `Nurturing/Refined` (0, 77), `Patterned Accents`
(0, 64), `Walnut` (0, 52), `Statement Living/Glamorous Evenings` (0, 40),
`Artful Contrast` (0, 27). ADR-0007's 3× median tag-density figure
(Moe's 11, Four Hands 4 on my count) understates the problem: the issue is
not density, it is that whole tag axes exist for only one supplier.

That produces two distinct failure modes, and only the second is visible to
per-supplier reporting:

1. **Degenerate brief.** A supplier-disjoint term in a supplier-homogeneous
   pool has zero positives — the brief has no relevant items, NDCG is
   undefined, and per-supplier reporting on a single-supplier pool is
   *vacuous* by construction. Detected only at selection time.
2. **Supplier-proxy ranking.** A supplier-skewed term in a supplier-*mixed*
   pool makes "prefer Moe's Home" a near-perfect ranking strategy, which
   ADR-0007 C2 shows is learnable from `overview` length alone (median 345
   vs 225 chars) even with material columns withheld. Per-supplier
   reporting *would* surface this, but only after the run, and only as an
   anomaly a reader has to interpret.

Both are prevented at selection time by two mechanisms already in this
amendment plus one addition:

- Measuring `r_union` **within the pool** rather than catalogue-wide
  automatically kills failure mode 1 (a disjoint term scores r ≈ the style
  marginal and usually fails the count floors).
- **New guard for mixed pools:** where a pool's minority-supplier share
  is ≥ 0.15, the positive set's supplier composition must not deviate from
  the pool's by more than **0.15**. Formally
  `|P(FH | label ≥ 1) − P(FH | pool)| ≤ 0.15`. This makes "prefer supplier
  X" a losing strategy by construction rather than a detectable one after
  the fact. In supplier-homogeneous pools the guard is inert and correctly
  so — there is no supplier signal to exploit.
- **Pool selection is explicitly supplier-balanced** (§D3a-H), so that
  ADR-0007's per-supplier reporting has something to report.

Supplier-stratified *term* selection — picking a separate style/tag set per
supplier — is rejected. It would make the two suppliers' briefs
incomparable, and the supplier effect would then be inseparable from the
term effect in every cross-brief aggregate.

### §D3a-H — Consequence for brief structure: Stratum A changes shape

This is the part of the framing's question I have to answer against my own
preference. I searched the full design space and **a single-pool 3 × 3
style × atmosphere grid with all nine cells admissible does not exist on
this data** in any form that is usable:

- Of nine candidate pools tested, only two admitted a fully in-band 3 × 3
  grid — `Bedroom/Nightstand` and `Living room/End Table` — and both are
  100% Moe's Home. They are also largely the *same 60 products*, since
  `End Table, Nightstand` is a single combined category value on 60 rows.
  Adopting either would leave Stratum A testing zero Four Hands products,
  i.e. 70% of the catalogue untouched by the core comparison, and would
  make ADR-0007's per-supplier requirement unsatisfiable.
- No Four Hands pool admits three non-collinear in-band cells with distinct
  styles and distinct atmospheres. Relaxing the grade-2 floor to 1 does not
  fix it; the binding constraint is §D3a-E collinearity, and reaching
  feasibility requires `r ≤ 0.70` *and* `grade2 ≥ 0` *and* `J < 0.80`
  simultaneously — which is to say, requires abandoning the guards that
  make the measurement mean anything. I will not do that.

**Therefore Stratum A is restructured from one 3 × 3 grid into 3 pools ×
3 (style, atmosphere) pairs. The count is unchanged at 9 briefs. Strata B
(4 constraint-restrictive) and C (3 adversarial/expected-negative) are
unchanged in count, purpose and construction — only §D3's term-selection
sentence bound them, and Stratum C's "correct answer is insufficient
inventory" design is if anything reinforced by this amendment.** The §D5
split arithmetic (3 of 9 A, 2 of 4 B, 1 of 3 C → 6 held-out, 10 dev) is
unchanged, and the §D5.6 `sha256(brief_id)` mechanism applies unchanged.

What is lost: full crossing, so a failure can no longer be attributed
cleanly to a style versus an atmosphere. I judge that acceptable because
(a) the original 3 × 3 was inherited from a 62-record artwork catalogue and
was never load-bearing for any §D6 outcome, and (b) partial balance
survives in the realised selection — `Artful Eclectic` appears in all three
pools and `Modern Farmhouse` in two, so a per-style breakdown remains
computable for those, and must be reported with its n.

What is gained, and it is worth more: pool identity becomes a controlled
third dimension chosen for **supplier coverage** — one Four-Hands-only
pool, one Moe's-only pool, one mixed pool — which turns ADR-0007's
per-supplier reporting from an after-the-fact anomaly check into a designed
comparison.

### §D3a-I — The selection procedure, and the selection it produces on this data

**Procedure (normative).** After the vocabulary map is frozen (§D5 step 1):

1. Pin the three Stratum A pools. Required properties, all checked and
   recorded: pairwise product-disjoint; ≥ 1 pool ≥ 90% Four Hands; ≥ 1 pool
   ≥ 90% Moe's Home; ≥ 1 pool with minority-supplier share ≥ 0.15; each
   pool ≥ 20 products (the §D3 realizability rule, unchanged); three
   distinct room types.
2. For every (style, atmosphere) cell in every pool, compute `r_union`,
   `r_grade2`, absolute positives, absolute grade-2, `Jaccard(style, tag)`,
   and the supplier skew. Apply §D3a-C, §D3a-E, §D3a-F, §D3a-G.
3. From each pool's admissible cells choose three with three distinct
   styles, three distinct atmospheres, and pairwise atmosphere
   Jaccard < 0.60, minimising the deterministic objective
   `(mean |r_union − 0.35|, −min(grade2), lexicographic (style ‖ tag) tuple)`.
   The 0.35 centre is the midpoint of the admissible band; the
   lexicographic third key exists solely to make ties reproducible.
4. Record the **full** diagnostic table — every cell, admitted or not, with
   the guard it failed. A table showing only the nine survivors does not
   satisfy this ADR.

**Pools selected on this data** (pairwise disjoint; 294/385 = 76.4% of the
catalogue covered):

| Pool | Room type | Categories | n | FH / MO | Admissible cells |
|---|---|---|---|---|---|
| **A1** | Dining room | Dining Chairs, Dining Table, Dining Bench | 137 | 137 / 0 | 11 |
| **A2** | Bedroom | Nightstand | 82 | 0 / 82 | 23 |
| **A3** | Living room | Sofa, Sectional, Console Table, Shelving Unit, Bookcase | 75 | 57 / 18 | 27 |

**The nine Stratum A briefs the procedure selects:**

| Brief | Pool | Style | Atmosphere | Positives | `r_union` | Grade-2 | Supplier skew |
|---|---|---|---|---|---|---|---|
| A1-1 | A1 | Modern Farmhouse | Monochrome Luxe | 37/137 | 0.27 | 3 | n/a (homogeneous) |
| A1-2 | A1 | Organic Modern | Everyday Elegance/Gracious | 54/137 | 0.39 | 3 | n/a |
| A1-3 | A1 | Artful Eclectic | Earth & Stone | 49/137 | 0.36 | 5 | n/a |
| A2-1 | A2 | Mid-Century Scandi | Artful Contrast | 40/82 | 0.49 | 4 | n/a |
| A2-2 | A2 | Warm Transitional | I Love Patterns | 26/82 | 0.32 | 4 | n/a |
| A2-3 | A2 | Artful Eclectic | Monochrome Luxe | 28/82 | 0.34 | 8 | n/a |
| A3-1 | A3 | Modern Farmhouse | Family Gatherings/ Humble | 39/75 | 0.52 | 18 | 0.04 |
| A3-2 | A3 | Contemporary Lux | Elegant/Balanced | 28/75 | 0.37 | 5 | 0.05 |
| A3-3 | A3 | Artful Eclectic | Monochrome Luxe | 22/75 | 0.29 | 6 | 0.08 |

**Mean `r_union` = 0.37, against 0.85 under the superseded rule.** Mean
achievable range rises from 0.15 to 0.63 — a 4.2× increase in the room any
arm has to distinguish itself in, which is the entire point of the
amendment. All nine atmosphere terms clear §D3a-F; realised pairwise
atmosphere Jaccards within a pool are ≤ 0.52 (the maximum is
`Monochrome Luxe` ~ `Everyday Elegance/Gracious` in A1).

Every term is verbatim from the mapper workbook's `SUB-CATEGORIES` sheet;
§D3's vocabulary-provenance rule is unchanged and nothing is coined.

### §D3a-J — Status of these nine briefs: expected output, not the frozen answer

The table above is **not** authorised as the frozen brief set. It is the
result of running the §D3a-I procedure against *my* working normalization,
built for this analysis from R01's drift catalogue. The frozen
`vocabulary_map_v1.yaml` does not exist yet and will absorb drift I left
unmapped. The engineer runs the procedure against the frozen map and takes
whatever it returns.

I bounded the sensitivity rather than asserting it is small. Mapping the
residual drift variants I left out (`relaxed sophisitication/minimalist` 20
rows, `everyday elegance/glamorous` 6, `earthy & stone`/`earty & stone` 8,
`nurtuing/refined` 5, `family gatherings/hunble` 5, and six singletons)
moves the selected atmosphere terms by at most **+11 rows catalogue-wide**
(`Everyday Elegance/Gracious` 127 → 138; `Earth & Stone` 186 → 196;
`Family Gatherings/ Humble` 79 → 84; the other four unchanged) — under 3
percentage points of prevalence, which moves no selected cell out of the
band. The picks are robust to the residual ambiguity, but the **procedure
is what is normative**.

Two further limits on the table, stated so they are not discovered later:

- `r_union` above is computed **before** Layer-1 budget and dimension
  filtering. Budget filtering shrinks pools and can move `r_union` in
  either direction. **The §D3a-C guards must be re-checked on the
  post-Layer-1 eligible set**, and a brief that leaves the band after its
  budget percentile is set is re-parameterised before the freeze or moved
  to Stratum C — the §D3 re-parameterisation rule, unchanged.
- Eight rows carry room or category strings in the `Design Style` column
  (`Living Room`, `Bedroom`, `Home Office`, `Entryway`, `Chaise Lounge`,
  `Cabinet / Sideboard / Buffet`). That is column contamination, not style
  drift, and it must be recorded as `unmapped` under §D4a rather than
  mapped to anything.

### §D4a — §D4 re-confirmed, with one clarification that would otherwise void a brief

**The label-derivation rule itself does not change.** Precondition, grade 2
(style ∧ atmosphere), grade 1 (exactly one), grade 0, the
`Tag Reference (Based on Style)` tie-break, and the prohibition on the
label function reading `name`/`overview`/material text all stand
unmodified. Discriminative term selection changes how labels are
*distributed*, not how they are *derived* — which is the correct division,
because the derivation rule is the part a third party audits.

**But §D4's `unmapped` definition is ambiguous, and the ambiguity is
run-fatal.** "A product whose style or tag strings do not resolve" reads
either as *no* token resolving or as *any* token failing to resolve. On the
three Stratum A pools:

| Pool | `unmapped` under "no token resolves" | `unmapped` under "any token fails" |
|---|---|---|
| A1 | 0/137 (0.0%) | 42/137 (30.7%) |
| A2 | 0/82 (0.0%) | 42/82 (**51.2%**) |
| A3 | 2/75 (2.7%) | 5/75 (6.7%) |

§D4's coverage guard flags any brief above 15% as `low_label_coverage` and
excludes it from headline means, and §D6 voids the run at more than two
such held-out briefs. Under the second reading, A1 and A2 — six of the nine
Stratum A briefs — are flagged, and the run reaches
`insufficient_evidence` for a reason that is purely a wording accident.

The dominant cause is not drift at all: `Outdoor Suitable` appears on 43
rows and is a *functional* tag that legitimately has no atmosphere
equivalent in the mapper's vocabulary.

**Clarification (normative).** Each observed token is classified into
exactly one of three buckets, and the buckets are reported separately:

1. **Canonical** — resolves to a mapper vocabulary term through the frozen
   map.
2. **Out-of-axis** — resolves to a recognised non-atmosphere, non-style
   concept (functional tags such as `Outdoor Suitable`; material tags per
   §D3a-F; room or category strings misfiled into the style column per
   §D3a-J). Carries no label information for this axis. **Does not make the
   product `unmapped`** and does not count toward the coverage guard. The
   out-of-axis token list is itself frozen in `vocabulary_map_v1.yaml` and
   is part of the auditable artifact — it must not become a silent
   catch-all, and any token placed there needs a stated reason.
3. **Unresolvable** — neither of the above.

A product is `unmapped` **for an axis** iff *every* token in that axis's
column falls in bucket 3, i.e. the axis carries no label basis at all. The
§D4 15% coverage guard applies to that quantity. A product with some
canonical and some unresolvable tokens is labelled on what resolves, with
the unresolvable residual counted and reported per brief as
`partial_normalization_rate` — a separate, non-gating diagnostic. It is not
gating because partial residue reduces *recall* of the label basis
symmetrically across all arms; it does not favour one.

### §D6b — §D6 re-confirmed, with two additions the new term selection makes both possible and necessary

The four available outcomes are unchanged, the `adopt_minilm` prohibition
is unchanged, and §D6a's claim ceiling is unchanged in every particular —
**G2 remains not reached, and a more discriminative evaluation set does not
move it.** If anything §D6a's point 2 is sharper now: labels this
well-separated are still self-consistent by construction and of unknown
validity. Nothing here is an argument that R02 can claim more.

Two additions:

**1. A prevalence baseline becomes a mandatory fourth reported arm.** I can
specify this only because §D3a makes `r_union` a known, non-trivial
per-brief quantity; under the superseded rule a prevalence baseline scoring
0.85 would have been indistinguishable from a working encoder, which is
precisely the defect. Report, for every brief:

- the analytic expectation `E[P@5] = r_union` for a random ranker, and
- the observed P@5 of a deterministic no-op ranker that returns eligible
  products in source-snapshot row order.

**Any arm that does not beat the prevalence baseline is not ranking.** An
`adopt_rule_only_interim` outcome now additionally requires rule-only to
beat the prevalence baseline on held-out mean P@5 by ≥ 0.10 and on ≥ 4 of
the 6 held-out briefs individually. The superseded §D6 had no such floor —
it could have recorded a baseline as "accepted" that a coin flip matched.
That was a genuine gap in my original ruling, and it was concealed by the
same defect ADR-0007 found.

**2. The embedding threshold becomes headroom-relative as well as
absolute.** The 0.10 absolute margin is retained unchanged. Because the
achievable range has grown from ≈ 0.15 to ≈ 0.63, a fixed absolute margin
is now *easier* to clear than when §D6 was written, and leaving it alone
would silently loosen the bar while appearing to hold it.
`embedding_promising_defer_to_designer_labels` therefore now requires all
of: the existing ≥ 0.10 absolute held-out mean P@5 margin over rule-only;
wins on ≥ 5 of 6 held-out briefs individually; survival of the
shuffled-label control; **and** that the margin close at least **25% of the
remaining headroom**, i.e. `Δ ≥ 0.25 × (1 − P@5_rule_only)`.

On plausible numbers this binds: at a rule-only held-out P@5 of 0.60, the
headroom rule demands Δ ≥ 0.10 and the absolute rule demands Δ ≥ 0.10 —
identical. At a rule-only P@5 of 0.40 the headroom rule demands Δ ≥ 0.15
and is the binding constraint. The threshold thus holds constant
stringency instead of drifting with the baseline, which is what ADR-0007's
closing note asked for when it said to hold this threshold "where it is, or
higher — not lower". The asymmetry §D6 already states — declining
complexity needs less evidence than adopting it — is unchanged and still
must be stated in the decision record.

**Unchanged and re-confirmed:** the shuffled-label control remains
mandatory. It is now a genuinely informative check rather than a
near-tautology: at mean `r_union` = 0.37 a permuted-label run should fall
back toward ≈ 0.37, a visible separation, whereas at 0.85 real and permuted
runs would have been ≈ 0.85 apart by a margin inside the noise. ADR-0007
§C3's judgement that the control would "eventually" catch the old defect is
right, and §D3a is the fix that makes it catch things *early* instead.

### What would prove this amendment wrong

- **A pool whose post-Layer-1 `r_union` lands outside the band after budget
  filtering**, with no re-parameterisation available that keeps the brief
  in canonical vocabulary. The correct response is to move that brief to
  Stratum C as a thin-inventory case and report Stratum A at n = 8, not to
  widen the band.
- **Evidence that `Design Style`/`Tags` were assigned per-product by a
  semantic model over `Overview`** — ADR-0007's own unresolved subtler
  leakage hypothesis. §D3a does not address it and cannot; it changes which
  terms are selected, not whether the labels are independent of the
  encoder-visible text. If that hypothesis is confirmed, §D3a is irrelevant
  because §D2 has already collapsed.
- **The realised selection being unstable under the frozen vocabulary map** —
  if the engineer's run returns a materially different nine briefs than
  §D3a-I's table, that is not automatically an error, but it means the
  procedure sits near a decision boundary and the sensitivity in §D3a-J is
  understated. Report the divergence rather than reconciling to my table.
- **The collinearity structure turning out to be an artifact of my
  normalization** rather than of the supplier's tagging. The check is to
  recompute the per-pool Jaccard matrix against the frozen map; J = 1.00
  classes in Four Hands pools should persist, because they arise from
  identical raw cell strings, not from mapping choices.

### Verification checks added by this amendment

Additional to §Verification's existing nine:

10. `evaluation/briefs_v1.json` contains no brief whose Stratum A
    `r_union` on the frozen post-Layer-1 eligible set is outside
    [0.15, 0.60], and none with fewer than 10 positives or 3 grade-2.
11. The three Stratum A pools are pairwise product-disjoint, cover three
    room types, and include one ≥ 90% Four Hands, one ≥ 90% Moe's Home,
    and one with minority-supplier share ≥ 0.15.
12. No brief's atmosphere term is one of the five material-family tags
    in §D3a-F.
13. Within each pool, pairwise Jaccard between the three selected
    atmosphere terms is < 0.60, and it is reported.
14. For the mixed pool, `|P(FH | label ≥ 1) − P(FH | pool)| ≤ 0.15` for all
    three of its briefs.
15. The full per-cell diagnostic table is present, including rejected cells
    and the guard each failed — not only the nine selected.
16. The prevalence baseline is reported per brief as a named arm, and no
    outcome above `insufficient_evidence` is recorded for an arm that does
    not beat it.
17. `vocabulary_map_v1.yaml` carries an explicit `out_of_axis` token list
    with a stated reason per entry, and `unmapped` is computed as
    "every token in the axis is unresolvable", per §D4a.

## Consequences and reversal

### Consequences

- R02 is unblocked as a *methodology* and blocked as a *task* until §P is
  resolved. The next action is a `tech-lead` ruling on the additive
  `Product` text-surface extension, not an engineer starting a notebook.
- A2 step 3 (rule-only ranking) becomes reachable; A2 step 4 (MiniLM)
  does not, and should be expected to stay unreachable until designer
  labels exist.
- The `evaluation/` package that the reference notebook assumes must be
  written from scratch (`briefs`, `metrics`, label rule, freeze
  verification). Per the notebook standard, all of it is package code —
  no label logic, no metric arithmetic, no normalization in a cell body.
- R03 is untouched and stays blocked per ADR-0005.
- **R03's eventual evaluation will face this same question**, and should
  cite this ADR rather than re-litigate it. Note one asymmetry when it
  does: R03 composes bundles that must be *buyable and placeable*, so it
  sits on the far side of ADR-0005's split. A derived-label set does not
  rescue R03 from its missing rugs, lighting and availability data.
- A designer-labelled pooled set, when it arrives, supersedes §D4's
  derived labels. Keep the derived labels as a second arm at that point —
  agreement between a published rule and designer judgment is itself
  evidence about both.

### Reversal

- **If designer-sourced pooled labels arrive**: re-run against them,
  report both label sources, and the claim ceiling in §D6a lifts to
  whatever the new sample size and provenance actually support. §D5's
  freeze protocol still applies.
- **If the client confirms provenance (ADR-0005's five points)**: the
  absolute numbers become describable as being about the Curalina
  catalogue. The sample-size ceiling does not lift; only the provenance
  caveat does.
- **If §P is refused** (no `overview` on the encoder-visible surface):
  R02 is blocked, and the correct record is that it is blocked on a
  contract decision — not that the encoders performed poorly. Running
  three encoders over a product name is not a permitted fallback.

### What would prove this decision wrong

- Evidence that the designer `Design Style` / `Tags` columns are
  themselves derived from the product text (e.g. auto-tagged from
  `Overview` by the legacy app). That would collapse the firewall in §D2 —
  the labels would be a function of the encoder-visible features, and the
  whole comparison would be circular through the data rather than through
  the author. **Check this before the freeze**; it is the one finding that
  would invalidate the entire approach rather than merely weaken it.
- Evidence that a 16-brief constructed set produces a *different ordering*
  of the three encoders than a designer-labelled set later does. That
  would not make the protocol dishonest, but it would retire constructed
  sets as a basis for even interim preference, and §D6's interim outcomes
  should then be withdrawn rather than quietly grandfathered.

## Verification

Checks a reviewer runs against an R02 run claiming to follow this ADR:

1. `evaluation/FREEZE_v1.json` exists; all five recorded hashes recompute;
   its git SHA predates the first commit containing any encoder adapter.
2. The firewall assertion exists, names both field sets explicitly, and
   passes. `Room Type` / `Design Style` / `Tags` appear nowhere in
   `domain/product.py` or in any `FeatureEncoder` implementation.
3. Brief vocabulary: every `style`, `atmosphere`, `room_type` and
   `category` value in `briefs_v1.json` appears verbatim in the mapper
   workbook's `SUB-CATEGORIES` sheet. Zero coined terms.
4. Split is reproducible from `sha256(brief_id)` per §D5.6 — recompute it.
5. Stratum C exists and contains at least one brief whose correct outcome
   is insufficient inventory.
6. Shuffled-label control present, seeded, and reported.
7. `make test` passes in an environment with neither `scikit-learn` nor
   `sentence-transformers` installed.
8. The decision record carries ADR-0005's provenance caveat verbatim in
   substance, states the §D6a ceiling in its own words, and contains no
   G2 claim and no `adopt_minilm`.
9. Every failing brief is displayed in Section 5, not summarised away.

No approval record exists for this ADR. It is an `ai-ml-lead`
evidence-quality ruling; §P and §D0 additionally require `tech-lead`
concurrence before R02 starts — **both were granted in ADR-0007 §D1 and
§D2 on 2026-09-13.**

Amendment 1 (§D3a / §D4a / §D6b) is likewise an `ai-ml-lead`
evidence-design ruling and needs no further concurrence: it changes only
how the evaluation set is constructed, touches no contract, and does not
alter ADR-0007's two rulings. It closes ADR-0007 §C3. **The §D5 freeze may
now begin.** Checks 10–17 above are part of the review of any run claiming
to follow this ADR.
