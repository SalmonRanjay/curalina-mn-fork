# Architecture decision record

ID: ADR-0007 — R02 prerequisites: the additive `Product.overview` text
surface, and the extension of ADR-0005's workbook admissibility to R02
Status: **accepted, and D1 is implemented, not merely recommended.** Both
prerequisites ADR-0006 deferred to `tech-lead` are resolved here. R02's
§P blocker is cleared; R02's catalogue admissibility is granted on the
terms below.
Owner and reviewer: `tech-lead` (contract-shape and provenance calls).
`ai-ml-lead` owns ADR-0006's methodology and owns the §D3 amendment this
ADR requests in §C3 — I raise the finding, I do not rule on it.
Date: 2026-09-13
Supersedes nothing. Resolves ADR-0006 §P and concurs with ADR-0006 §D0.
Extends ADR-0005 on one narrow point (§D2 below).

## Context

`ADR-0006-r02-evaluation-methodology.md` is `ai-ml-lead`'s ruling on how
R02 (recommendation's ranking baseline notebook) may be evaluated. It
accepts a derived-label evaluation set under a freeze protocol, and it
correctly declines to decide two things that are not evidence questions:

1. **§P — the encoder-visible text surface.** `Product` in
   `ai_services/recommendation/src/curalina_recommendation/domain/product.py`
   carried `product_id`, `key`, `category`, `name`, `availability`,
   `price`, `dimensions`, `source_snapshot_id` and nothing else. That was
   a correct A0/A2 scoping decision — the docstring says so explicitly and
   `agentic_flow/AMENDMENTS.md` §A3's `design_attributes` sub-record is
   still blocked on `OQ-009` — but it means `RuleOnlyEncoder` has nothing
   to match a profile against, and `TfidfEncoder`/`MiniLMEncoder` would
   rank on a product name plus a category string. ADR-0006 §D6 would
   rightly record that as `insufficient_evidence`.
2. **§D0 — whether ADR-0005's admission of the found workbook for R01
   extends to R02.** ADR-0006 argues it should, on the grounds that "R02
   produces a measurement, not a buy/place decision", but routes the
   provenance judgment to me rather than assuming it.

### The hard constraint both decisions sit under

ADR-0006 §D2's leakage firewall is structural, not conventional: the
label-source columns (`Room Type`, `Design Style`, `Tags`) must be
*unreachable* from any `FeatureEncoder`, not merely "excluded by
convention". If a rule-only baseline can read the column its own labels
are derived from, it wins 1.00 by construction and the comparison is
worthless. So the question is not only "does `overview` help?" but "does
`overview` smuggle the label back in?"

### Evidence I gathered rather than assumed

ADR-0006's closing "what would prove this decision wrong" names one
finding that would invalidate its entire approach: *evidence that the
`Design Style`/`Tags` columns are themselves derived from the product
text (e.g. auto-tagged from `Overview` by the legacy app)*. It asked for
that check before the freeze. I ran it now, because it also determines
whether §P is safe to grant at all.

Against the pinned workbook
(`attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`,
md5 `3ad1f5d7e47cca273e3fecd5ede64054`, 385 rows × 36 cols; `Overview` is
column index 1):

| Check | Result |
|---|---|
| Rows with a non-empty `Overview` | **385 / 385** (100%) |
| `Overview` length (chars), min / median / max | 87 / 257 / 706 |
| Distinct `Overview` strings | 336 / 385 |
| Rows where a full `Design Style` phrase appears **verbatim** in `Overview` | **0 / 385** |
| Rows where a full `Tags` phrase appears **verbatim** in `Overview` | 31 / 385 (8.1%) |
| Which tag phrases ever echo verbatim | `marble` (16), `walnut` (14), `iron frame` (1) — **material words only**, never an atmosphere or style tag |
| Rows where a `Room Type` phrase appears verbatim in `Overview` | 39 / 385 (10.1%) |

`Overview` is genuinely supplier-authored marketing prose. Representative
sample, unedited:

> "The Holli side table artfully combines timeless travertine with sleek
> iron craftsmanship. Its organic travertine top is framed by a subtle
> metal rim, while the antique gold base features gracefully curved legs
> and distinctive buckle-like details on the stretcher that wrap around
> each leg."

That row's label-source columns read `Design Style: Contemporary Lux,
Warm Transitional` and a thirteen-value `Tags` list including
`calm/serene`, `soft contrast`, `satin/metallics`. None of those phrases
appear in the prose. **The auto-derivation hypothesis is not supported by
this data**, and the three verbatim echoes that do occur are material
nouns that describe the object rather than classify it.

Two further structural facts I found, which bear on *how much* text to
expose (§D1) and on the run's interpretation (§C3):

- **The three material columns are perfectly supplier-disjoint.** Column
  19 `Product Material` is filled 0/271 for Four Hands and 107/114 for
  Moe's Home; column 31 `Material` is filled 228/271 for Four Hands and
  0/114 for Moe's. Which column carries material text *is* the supplier.
- **Label density is supplier-conditioned.** Moe's rows carry a median of
  13 tags; Four Hands rows carry a median of 4. Moe's overviews are also
  longer (median 345 vs 225 chars). Under ADR-0006 §D4, grade 2 requires
  a tag match, so a Moe's product is roughly three times likelier to match
  an arbitrary atmosphere tag *for reasons unrelated to its suitability*.

### Contract-scope facts I verified rather than assumed

- `contracts/v1/schemas/` contains no product schema. The only match for
  "product" is `parent_product_id` inside `visual_variant.schema.json`,
  which is variants' shape and carries no product attributes.
- No module under `ai_services/recommendation/src/curalina_recommendation/api/`
  references `Product` at all. `api/schemas.py` holds its own DTOs; the
  DTO↔domain translation layer is still the ADR-0002-flagged A3 remainder
  and has not been built.
- `Product` is imported only by `domain/`, `ports/`, `application/` and
  `adapters/` inside this one package.

## Options

### For Decision 1 (the text surface)

**Option 1A — Refuse §P; leave `Product` frozen.** Rejected. ADR-0006's
own reversal clause already says the correct consequence would be "R02 is
blocked on a contract decision", and that running three encoders over a
product name is not a permitted fallback. Refusing costs the project A2
step 3 indefinitely in exchange for protecting a field list that A0/A2
explicitly described as extensible ("can be added additively when the
importer that needs them is built"). There is no risk being avoided here
that the evidence supports.

**Option 1B — Add a free-form `attributes: Mapping[str, str]` bag.** This
is the shape `architecture/guides/03_data_contracts.md`'s "Core records"
line actually names, and `product.py`'s own docstring cites it. Rejected
anyway, and this is the substantive part of the ruling: **an open
string→string bag makes ADR-0006 §D2's firewall unenforceable.** With a
bag, nothing structurally prevents an importer from writing
`attributes["design_style"]`, nothing fails if it does, and the
firewall degrades from a property of the type to a promise in a review
comment. §D2 requires the firewall to be structural. A bag is the one
shape that guarantees it cannot be.

**Option 1C — Add `overview` *and* merged material text.** ADR-0006 §P
offers this as optional and §D2's table lists "material text" as
encoder-visible. Rejected **for now**, on evidence I gathered above: the
material columns are perfectly supplier-disjoint, so exposing them hands
every encoder a near-perfect supplier discriminator, in a dataset where
supplier is already a three-fold predictor of label density. That turns a
confound I can currently only warn about into one the encoders are
actively invited to exploit. This is a deferral, not a permanent refusal —
see the reversal trigger in §C2.

**Option 1D (chosen) — Add exactly one named optional field,
`overview: str | None = None`.**

### For Decision 2 (workbook scope for R02)

**Option 2A — Require a fresh provenance ruling / block R02.** Rejected;
see §D2.

**Option 2B — Admit R02 on ADR-0005's existing terms, unchanged.**

**Option 2C (chosen) — Admit R02 on ADR-0005's terms plus one added
scoping caveat that ADR-0006 could not have written, because it comes
from the supplier-skew finding above.**

## Decision and rationale

### D1 — `Product.overview` is granted, as a single named optional field

`Product` now carries `overview: str | None = None`. Implemented in
`ai_services/recommendation/src/curalina_recommendation/domain/product.py`.

Rationale, in order of weight:

1. **It is leakage-safe on this data, checked rather than assumed.** Zero
   verbatim `Design Style` echoes in 385 rows; the only verbatim `Tags`
   echoes are three material nouns. The labels are not a function of the
   encoder-visible text, which is the precise condition §D2 exists to
   protect. I want to be explicit that this is a *falsifiable empirical
   finding about one pinned file*, not a general claim about the
   catalogue — see §C3's re-check trigger.
2. **One named field is the only shape that keeps the firewall
   structural.** Because `overview` is a declared field on a
   `@dataclass(frozen=True, slots=True)`, "`Product` has no `design_style`
   field" is a property a test can assert and `slots=True` a caller
   cannot route around. A test now does assert it
   (`test_product_carries_no_label_source_fields` in
   `ai_services/recommendation/tests/unit/domain/test_product.py`), listing
   the forbidden names and requiring the intersection with
   `Product.__dataclass_fields__` to be empty. That satisfies ADR-0006 §D2's
   "assert the firewall mechanically" requirement at the domain layer, so
   the notebook's own assertion becomes a second line of defence rather
   than the only one.
3. **Absence is `None`, never `""`.** `__post_init__` raises `ValueError`
   on a whitespace-only `overview`. This follows the file's existing idiom
   (`product_id must not be blank`, `category must not be blank`) and
   enforces the project rule that a missing fact must not be silently
   converted into a benign-looking default — an empty string reads to an
   encoder as "this product has no description", which is a claim the
   importer has no basis to make.
4. **It does not preempt `AMENDMENTS.md` §A3.** That amendment adds a
   typed `design_attributes` sub-record (edge geometry, leg style,
   material class, gloss, undertone, performance-fabric, each with
   `source` and `confidence`), blocked on `OQ-009`. `overview` is
   descriptive supplier prose, not a design attribute, and occupies none
   of that space. The amendment's own choice of a *typed sub-record* over
   a bag is the same instinct as option 1B's rejection.

**This is an additive (minor) change and needs no cross-service
sign-off.** The reasoning in the task framing is correct, and I verified
it rather than accepting it: `Product` appears in no `contracts/v1`
schema, is imported by no module under `api/`, and crosses no HTTP
boundary — the DTO↔domain layer that would expose it is the unbuilt
ADR-0002 A3 remainder. It is domain-internal to one package. Additionally
the change is additive in the strict sense: a new trailing field with a
default, no existing field's type, name, meaning or ordering touched, and
every existing construction site still valid. Under this project's
contract discipline that is a minor change, decidable by `tech-lead`
alone. I am recording it as an ADR rather than a code comment only
because it is load-bearing for ADR-0006's firewall — the *next* engineer
needs to know that the field list is deliberately short.

**Authorized as consequential implementation, not as a new decision:**
`adapters/xlsx_catalogue_importer.py` may map workbook column 1 →
`Product.overview`, with a test. That is R02's engineer's work, sanctioned
by this ADR; it does not need a further ruling. What it must *not* do is
map columns 7, 8 or 26.

### D2 — R02 may proceed against the pinned workbook; ADR-0006 §D0 concurred, with one added caveat

ADR-0005 split on whether the consumer treats the catalogue as an *object
of audit* or as a *source of truth about what can be bought and placed*.
R02 sits on the audit side, and I concur with ADR-0006 §D0's reasoning
rather than restating it.

The specific question put to me is whether producing a ranking
*comparison* rather than an *audit* changes the provenance calculus. **It
does not, and the reason is worth stating so R03 cannot borrow it.**
Provenance risk is the risk that the file does not describe reality. That
risk damages a claim in proportion to how much the claim asserts about
reality. R01 asserted "this file has these defects" — a claim about the
file. R02 asserts "encoder X ranks this file's contents better than
encoder Y" — also a claim about the file, because the comparison is
*internal* to the substrate. Both survive the file being stale; only the
absolute numbers are discarded. R03 would assert "buy these six items and
put them in a room", which is a claim about the world, and that is why
R03 stays blocked and is untouched here.

A ranking comparison is in one respect *less* provenance-exposed than an
audit, not more: R01's findings were statements about the data's quality
that a reader could mistake for statements about Curalina's catalogue,
whereas R02's headline output is a *relative* ordering of three encoders,
which is meaningful even over a supplier export that turns out to be test
material. What R02 must not do is report absolute P@5 as a property of
"the Curalina catalogue".

**Therefore:** R02 is admitted on exactly ADR-0005's terms. Its
provenance caveat travels verbatim in substance into R02's decision
record, and every finding is scoped to the pinned file by md5, never to
"the Curalina catalogue" — as ADR-0006 §D0 already requires.

**The one caveat I am adding, which ADR-0006 could not have written:**
the supplier-skew finding above means R02's decision record must also
report **per-supplier** metrics alongside per-brief metrics, and must
state that the catalogue is a two-supplier merge whose label density
differs threefold between them. Without that, a run could report a
genuine aggregate win that is an encoder having learned "prefer Moe's
Home", and no reader could detect it. ADR-0006 §D7's shuffled-label
control will **not** catch this: permuting labels within a brief destroys
exactly the product-level signal the confound rides on, so the control
would separate cleanly and the confound would survive. I am recording
this as a reporting requirement, which is my call as a scoping condition
on the admission; whether it should additionally change the *metric* is
`ai-ml-lead`'s call.

R03 remains blocked. `OQ-009` and `OQ-011` are unchanged and are not
advanced by anything here. Nothing in this ADR bears on variants' photo
blocker.

## Consequences and reversal

### Consequences

- **C1.** R02's §P prerequisite is cleared. Per ADR-0006 §D6a the claim
  ceiling is unchanged: no G2, no `adopt_minilm`, no advancement of
  `OQ-011`. Clearing §P makes R02 *runnable*; it does not make it
  *stronger*.
- **C2.** Material text is deliberately absent from the encoder surface.
  `RuleOnlyEncoder`'s controlled-vocabulary baseline (ADR-0006 §D2) must
  therefore score against `name` + `category` + `overview` only. If the
  R02 engineer finds that the designer descriptor words from the mapper's
  `Design Style Definitions` sheet have too little to match against —
  which is plausible and should be *measured before it is asserted* — the
  reversal is to add `materials: str | None` as a second additive field
  under this same ADR, merging columns 19/31/33 into one field, plus a
  mandatory per-supplier report so the disjointness is visible. That is a
  `tech-lead` note on this ADR, not a new ADR.
- **C3 — a finding I am handing to `ai-ml-lead`, not ruling on.** ADR-0006
  §D3 selects Stratum A's three styles and three atmospheres "by frequency
  in the pinned snapshot". Applied to this data that rule selects the
  *least discriminative* possible values: `Warm Transitional` appears on
  310/385 rows (80.5%), `clean line/structured` on 358/385 (93.0%), and
  `warm neutrals` on 321/385 (83.4%). Under §D4's grading, a brief built
  from those values grades nearly every precondition-passing product as 1
  or 2, and P@5 approaches 1.00 for any arm including a broken one. I
  believe §D7's shuffled-label control *would* eventually catch this — a
  near-constant label vector scores the same permuted — but the cost is
  that the whole freeze-and-run cycle burns to `insufficient_evidence`
  after the fact instead of being fixed before it. **This needs a §D3
  amendment from `ai-ml-lead` before the §D5 freeze**, and it is an
  evidence-design question (most-frequent vs most-discriminative
  selection), which is theirs and not mine. I am flagging the number, not
  proposing the rule.
- **C4.** `Overview` has 49 rows sharing text with another row (336
  distinct of 385) — colourway siblings like *Carrie Side Table Walnut* /
  *Carrie Side Table Natural Oak* carry near-identical prose while their
  label columns differ. TF-IDF and MiniLM will place these near-identically
  in vector space. Minor, but it should be reported rather than discovered.
- **C5.** Unit-test count for `curalina_recommendation` moves 85 → 88.
  Contract tests stay at 14, which is the intended proof that `api/` was
  not touched.

### Reversal

- **Reversing D1** is a field deletion plus three test deletions. Nothing
  persists `overview`, no migration exists, no wire format carries it, and
  no other package imports `Product`. Cost: R02 becomes unrunnable again
  and A2 step 3 re-blocks. This is genuinely cheap to undo, which is part
  of why granting it was easy.
- **Reversing D2** means R02's results are withdrawn as evidence, exactly
  as ADR-0005 contemplated for R01. The harness, freeze files and label
  rule survive; only the numbers are discarded.
- **If the client confirms provenance** (ADR-0005's five open points),
  D2's caveat lifts and absolute numbers become describable as being about
  the Curalina catalogue. ADR-0006 §D6a's sample-size ceiling does not
  lift with it.

### What would prove this decision wrong

- **The leakage finding is per-file and must be re-run on any replacement
  workbook.** If a future export shows `Design Style` or atmosphere `Tags`
  echoing verbatim in `Overview` at material rates, D1's safety argument
  collapses and `overview` must come back off the encoder surface — not be
  "filtered". The check is cheap: substring-match each row's split
  `Design Style` / `Tags` values against its lowercased `Overview`, and
  require the style rate to be zero and the tag rate to be confined to
  material nouns. My thresholds for concern: **any** verbatim style echo,
  or verbatim tag echo above ~10% involving non-material tags.
- **A subtler version I could not rule out and am naming so it is not
  mistaken for cleared:** verbatim echo is the only form of derivation I
  tested. If the legacy app tagged products by a *semantic* model over
  `Overview` rather than by copy-paste, my check would not detect it and
  ADR-0006's firewall would be circular through the data exactly as it
  feared — with MiniLM, of all arms, best placed to recover the tagger.
  The evidence that would settle this is not in the file: it is the legacy
  app's tagging code path, or the client confirming the columns were
  designer-authored by hand. Until one of those exists, an embedding arm
  beating rule-only by a *large* margin should be read as a possible
  tagger-recovery artifact, not a win. I flag this as a reason to hold
  ADR-0006 §D6's `embedding_promising_defer_to_designer_labels` threshold
  where it is, or higher — not lower.
- **If option 1B turns out to be forced** — i.e. if a later contract
  revision genuinely requires the `attributes` bag from
  `03_data_contracts.md` — then the firewall must move to an explicit
  allow-list of permitted keys with a test, because the structural
  guarantee will have been lost. That is a real ADR at that point, not a
  note.

## Verification

Run in `ai_services/recommendation/`, full output, 2026-09-13:

```
$ make test
88 passed in 1.76s
TOTAL   909 stmts   64 miss   152 branch   18 partial   92%
  (src/curalina_recommendation/domain/product.py  47 stmts  2 miss  94%)

$ make test-contract
14 passed, 2 warnings in 0.78s

$ make lint
python3 -m ruff check --no-cache .
All checks passed!

$ make typecheck
python3 -m mypy --strict --cache-dir=/tmp/curalina_recommendation_mypy_cache src/curalina_recommendation
Success: no issues found in 33 source files
```

Unit tests 85 → 88; branch coverage 92% (unchanged); contract tests 14
(unchanged, which is the intended evidence that `api/` was not touched).

Checks a reviewer runs against this ADR:

1. `Product.__dataclass_fields__` contains `overview` and contains none of
   `room_type`, `design_style`, `tags`, `style`, `attributes`. Asserted by
   `test_product_carries_no_label_source_fields`.
2. `Product(..., overview="   ")` raises `ValueError`. Asserted by
   `test_blank_overview_is_rejected_rather_than_coerced`.
3. `grep -rn "Product" ai_services/recommendation/src/curalina_recommendation/api/`
   returns nothing — the field crosses no HTTP boundary.
4. No `product` schema exists under `ai_services/contracts/v1/schemas/`.
5. The leakage table in Context recomputes against md5
   `3ad1f5d7e47cca273e3fecd5ede64054`: 0/385 verbatim style echo, 31/385
   verbatim tag echo confined to `marble`/`walnut`/`iron frame`.
6. The frequency figures in C3 recompute: `Warm Transitional` 310/385,
   `clean line/structured` 358/385, `warm neutrals` 321/385.

No approval record exists for this ADR. D1 and D2 are `tech-lead` calls
and are made here. ADR-0006's §D3 amendment requested in C3 is
`ai-ml-lead`'s and is **not** granted by this document — R02's freeze
should not begin until that amendment lands.
