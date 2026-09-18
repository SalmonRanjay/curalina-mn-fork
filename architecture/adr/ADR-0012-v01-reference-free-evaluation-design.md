# Architecture decision record

ID: ADR-0012 — V01 reference-free evaluation design: what a V01 pass means
when no ground-truth colour variants exist, and what it can never mean
Status: **accepted.** Evaluation-methodology ruling. It unblocks **V01
dispatch only**. It does **not** unblock V02, V03, G01, or any G-series
stage gate, and it sets no Delta-E tolerance.
Owner and reviewer: `ai-ml-lead` (methodology and gate authority).
**`tech-lead` owns corpus admissibility (`ADR-0008`), which this ruling
builds on and amends in one factual respect. `design_authority` /
`designers` own the Delta-E tolerance, which is recorded here as a new,
un-tracked gap.**
Date: 2026-09-14

## Context

`ADR-0008` retired V01's "no product photos" blocker and explicitly handed
the evaluation methodology to this role, gating V01 dispatch on this
document existing first. That sequencing is the same one that produced the
`ADR-0006`/`ADR-0007` chain for R02, where three rounds of methodology
review before any notebook code was written caught a term-selection defect
that would have burned the whole freeze-and-run cycle to
`insufficient_evidence`.

The constraint that drives everything below: **there is no ground truth.**
`ADR-0008` §2 established that image-filename finish codes match the
manifest's `Finish` in 2 of 42 folders and sibling swatch filenames in 3 of
42, and that 89 of 197 ATRIANI webp files carry no finish code at all.
Swatches are target colours to transfer *toward*, not target renderings to
compare *against*. Any metric shaped like "how close is our output to the
true variant" fabricates its own reference.

`ADR-0008` named three candidate reference-free properties without
endorsing them as sufficient: protected-pixel invariance, geometry/texture
preservation outside the mask, and whether the transferred region lands on
the intended swatch colour in LAB. **Deciding whether those constitute an
accepted baseline is this ruling.** I ran a methodology probe over the real
corpus before deciding, because two of the three turn out not to measure
what they appear to measure.

### The probe

Not a V01 run. A methodology probe, run by me on 2026-09-14 to size the
metrics before specifying them — the direct application of the lesson from
`ADR-0006` Amendment 1, where a selection rule written from a column's
*shape* rather than its *distribution* produced a broken evaluation set.
Reproduction details are in Verification.

I ported `agentic_flow/15_variant_generation_technical_design.md`'s
`recolour_lab` and `hard_composite` faithfully into numpy, built a
background-derived mask as a stand-in for the human-authored per-region
masks V01 will actually use, and ran **276 (product image, in-folder
swatch) pairs across 24 ATRIANI folders**.

#### Finding 1 — the corpus is not what `ADR-0008` recorded, in two ways

`ADR-0008` describes the admitted assets as "clean, full-product,
pure-white-background studio assets", from opening two files in
`Ducci Bed`, and gives a working set of "roughly 163 ATRIANI images across
41 folders". Measured across all 163:

- **The folder count is 40, not 41.** Two folders drop entirely under
  `ADR-0008`'s own exclusion rules, not one. `Curva King Bed` is the named
  case (its only webp is the AI-generated bed). **`Zuma Side Table` also
  drops** — every one of its webp files is a `-150x150` thumbnail. It is
  not named anywhere and a run that reported "41 folders" would be wrong.
- **Only 95 of the 163 are full-product white-background images, across 26
  folders.** 54 are detail crops or non-white-backdrop views. I opened
  three: `Ottagono Console/LO1.L188.RAL7031.ST26-WB-6-P` is a close-up of a
  marble tabletop corner; `Ducci Nightstand/NDU2.l64.LP03-R-WB-7-W` is a
  drawer-corner crop; `Forma/SOFA-FORMA-FRONTAL-scaled.webp` is a full sofa
  on a warm taupe backdrop with floor and cast shadow. **14 of the 40
  folders contain zero full-product white-background images.**

#### Finding 2 — a second contamination class, missed by every existing filter

**19 of the 163 name-admitted webp files are material and finish samples,
not product photographs.** The `.webp` extension does not separate products
from swatches in this corpus.

I opened `Alice Chair/AI01 Steelness steel.webp`. It is a **brushed-steel
texture swatch**, and the identical file (same sha256) sits in seven
different product folders under three different names. `AI07` is
byte-identical across four folders. Others are fabric flat-shots named for
their textile: `BZ 28 EL-MALIBU-VELVET-ICE.webp`, `BZ77 OMNI-FLAX.webp`,
`BZ13 EL-SWISS-VELVET-BEIGE.webp`, all 481×481.

None of these match `ADR-0008`'s exclusion regex
(`chatgpt|screenshot|midjourney|dall-?e|generated`) or its `-150x150` rule.
**`ADR-0008`'s conclusion that filename screening is necessary but not
sufficient is correct and now has a second, independent confirming
instance** — one that is not about AI generation at all. The corpus's
contamination surface is larger than `ADR-0008` recorded.

Automatic classification does not close this either. My heuristics produce
at least two false positives: `Alice Chair/CADEIRA-ALICE-FRONTAL-768x768.webp`
is a genuine product view caught by a size rule, and
`CADEIRA-CIELO-FRONTAL-scaled.webp` is a genuine product image legitimately
shared by two chair SKUs, caught by the cross-folder-duplicate rule. **This
is why `ADR-0008`'s condition 4 (human per-file review) is load-bearing and
not belt-and-braces.** See control C2 below.

#### Finding 3 — the swatches are material textures, not colour chips

113 non-webp files. Their intra-file CIEDE2000 spread about their own mean
has median p50 = 4.12, **median p90 = 8.06**, median p99 = 15.42.
**92 of 113 have an intra-file p90 above 5 Delta-E.** "The swatch colour"
is a distribution, not a point.

The *extraction rule*, however, is stable: mean-in-LAB vs median-in-LAB vs
mean-in-RGB-then-convert agree to median 0.51 / p90 1.71 Delta-E, and only
16 of 113 files exceed 2 Delta-E disagreement — all 16 being the non-swatch
contaminants (UUID-named lifestyle jpgs, `RAL 7024.jpg`). So a single
target colour *is* definable deterministically; what is not available is any
claim that it characterises the material tightly.

#### Finding 4 — two of `ADR-0008`'s three candidate properties do not measure capability

| Candidate property | Measured across 276 pairs | Verdict |
|---|---|---|
| Protected-pixel invariance | Changed-pixel count outside mask: the **complete set of observed values is `{0}`** | **Zero variance.** `hard_composite` guarantees it. An assertion, not a measurement. |
| Target attainment (Delta-E to swatch in LAB) | min 0.043, median **0.517**, p90 3.62, max 8.99 | At ceiling **by construction** — the algorithm *assigns* `a*,b* = target`. Worse: its residual correlates **+0.796** with gamut clipping, so it is a derived clipping statistic, not an independent measure. |
| Structure preservation | L\* variance ratio: min **0.237**, p25 0.772, median 0.953, p90 1.000. Gamut-clipped fraction: median 0.043, p75 **0.224**, max **0.735** | **Real variance. This is the honest V01 signal.** |

Two of the three properties `ADR-0008` floated are at ceiling by
construction. Had V01 been dispatched against them as stated, it would have
returned a near-perfect score that proved only that the arithmetic was
transcribed correctly. **That is the R02 prevalence-baseline failure in a
new domain**, and finding it before dispatch is the entire reason this
document was required to exist first.

#### Finding 5 — the technical design's own failure predictor is wrong on this corpus

`agentic_flow/15_variant_generation_technical_design.md` specifies
`dark_to_light_risk(img, mask, target) = max(0, (target_L - src_mean_L)/100)`
as the detector for the known dark-to-light failure mode.

Measured: **corr(clipped fraction, target_L\* − source_mean_L\*) = +0.034.**
It has no predictive power here. Several of the highest-clipping cases have
*negative* dL — light to dark — which that formula scores as exactly zero
risk.

The actual driver is the **source region's lightness spread**:
**corr(clipped fraction, std(L\*) within mask) = +0.720.** Median clipped
fraction by source std(L\*) band: 0–10 → 2.1%, 10–20 → 1.7%, 20–30 →
**20.7%**, 30+ → **38.0%**.

Physically this is unsurprising once stated: pinning `a*,b*` to a constant
target chroma while `L*` still spans ±30 pushes the (L,a,b) triple out of
the sRGB gamut at both ends of the range, regardless of direction. The
failure is chroma-against-shading-range, not lightness-direction.

#### Finding 6 — the best score in the probe belongs to a file that is not a product

Running the pipeline on `Bench J/BZ 28 EL-MALIBU-VELVET-ICE.webp` — a
fabric swatch misfiled as a product image — with a naive full-frame mask:

| Metric | Result |
|---|---|
| Protected pixels changed outside mask | **0** |
| Delta-E00(region mean, target) | **0.000** |
| Per-pixel Delta-E00 p99 inside region | **1.26** |
| Gamut-clipped fraction | **0.000%** |

**The single best result in the entire probe is produced by an input that
is not a product photograph.** This is not a hypothetical falsification
constructed for the ruling; it is an actual file sitting in the admitted
corpus today.

## Options

**(a) Endorse `ADR-0008`'s three candidate properties as the V01 gate.**
The path of least resistance, and wrong on evidence. Two of the three are
at ceiling by construction (Finding 4). V01 would return a near-perfect
pass that could not distinguish a working colour transfer from a correctly
transcribed no-op, and could not distinguish a sofa from a fabric swatch
(Finding 6). A gate nothing fails is not a gate.

**(b) Declare V01 unrunnable without ground truth and keep it blocked.**
Symmetric to the Option B that `ADR-0005` and `ADR-0008` both rejected, and
wrong for the same reason. The absence of a reference forecloses *colour
fidelity* claims; it does not forecloses *structure preservation* claims,
and structure preservation is where the LAB baseline actually fails
(L\* variance ratio reaching 0.237). Refusing to measure the thing that
varies because the thing that does not vary is unmeasurable produces no
evidence.

**(c) Synthesise ground truth** — render a known recolour, then score
recovery of it. Rejected outright. It fabricates the reference this whole
chain exists to refuse, and it would measure the synthesiser, not the
product path.

**(d) (chosen) Reframe V01 around the quantities that actually vary,
demote the ones that do not, and make the do-nothing and non-product cases
mandatory named controls.** V01 becomes a structure-preservation and
gamut-feasibility gate, with target attainment reported but explicitly
demoted, and with a pair-admission rule that guarantees headroom over an
identity transform.

## Decision and rationale

### D1. What a V01 pass means

> **V01 pass:** the deterministic LAB colour-transfer baseline, applied to
> a human-confirmed product image under a human-authored per-region mask,
> produces an output that (i) alters nothing it was forbidden to alter,
> (ii) preserves the lightness structure it was required to preserve, and
> (iii) attains the **requested** target colour without leaving the sRGB
> gamut — each measured against the *request*, never against a reference
> rendering.

The reframe that makes this legitimate without ground truth: the target
colour is an **input to the system under test**, not a fabricated
reference. Measuring "did the output attain the colour it was asked for" is
a different and defensible claim from "does the output match the true
variant". **Every V01 artifact must use the first wording. The second is
not available and its use is falsification.**

### D2. The metric set, with evidentiary weight stated per metric

Four families. The weight column is binding — it governs what may be
written in the decision record, not just what is computed.

| ID | Metric | Threshold | Evidentiary weight |
|---|---|---|---|
| **M1** | Changed-pixel count outside the editable mask, **dilated by `Mask.feather_px`** to exclude the feather band | Exactly **0** | **None.** Guaranteed by `hard_composite`; observed set is `{0}` across 276/276. Report as `assertion_held`, never as a score, never in a pass rate. It is a unit test that happens to run in a notebook. |
| **M2a** | L\* variance ratio inside mask: `var(L*_out) / var(L*_src)` | **≥ 0.90** | **Primary.** Real variance (0.237–1.000). |
| **M2b** | Gamut-clipped fraction inside mask — fraction of mask pixels whose LAB→linear-RGB round trip left `[0,1]` before clamping | **≤ 0.02** | **Primary.** Real variance (0.000–0.735). |
| **M3** | Delta-E00(mean LAB of output mask region, requested target LAB) | **`needs_input`** — see D4 | **Demoted.** At ceiling by construction; r = +0.796 with M2b. Report the distribution; do not treat it as independent evidence at V01. Becomes a genuine measure at V02. |
| **M4** | Silhouette IoU (edge detection + IoU vs original) | Reported, **no threshold at V01** | **Instrument calibration only.** Vacuous for a pure per-pixel colour map — an edge cannot move. Its V01 job is to establish the measurement and its noise floor on an unchanged silhouette so V02 has a calibrated zero. The tech design's ≥0.98 bar is a V02 bar. |

### D3. Threshold reasoning — why these numbers and not others

**M2a ≥ 0.90.** Not a taste judgment. The achieved distribution has a
theoretical maximum of exactly 1.000, attained whenever the transform is a
pure chroma substitution with no clipping, and the measured p90 is 1.000 —
so the ceiling is real and reachable. A 0.90 floor admits a 10% loss of
lightness variance and sits between the measured p25 (0.772) and median
(0.953). **It will fail roughly 40% of naive pairs.** That is deliberate:
a threshold that nothing fails measures nothing, and this is the one
metric where the baseline demonstrably struggles.

**M2b ≤ 0.02.** An **operating point, not a perceptual constant**, and
labelled as such wherever it appears. Derived from where the two primary
metrics stop being independent: at clipped fraction ≤ 2% the L\* variance
ratio stays essentially at its 1.000 ceiling; above it, texture collapse
begins (r = −0.534 between the two), and the std(L\*) banding shows median
clip jumping 1.7% → 20.7% precisely where variance ratio starts falling.
**This number is mine, it is V01-only, and it must be re-derived on any new
corpus.** It is not a product quality bar and may not be quoted as one.

**M4 unthresholded at V01.** Applying the tech design's 0.98 bar to a
transform that cannot move an edge would manufacture a pass.

### D4. The Delta-E tolerance is `needs_input`, and it has no `OQ-xxx`

`agentic_flow/15_variant_generation_technical_design.md:111` and
`variant_generator_workflow.md`'s A6 both say the tolerance is "set with
designers". It is not set. **I am not setting it.**

It is also not a Design Manual blank: I searched all 169 pages of the
manual admitted by `ADR-0009` (sha256 `7d450d28…`) for `Delta E`, `DeltaE`
and `ΔE`. **Zero occurrences.** The manual does not use Delta-E as a
concept at all. So this is **not** an existing `OQ-xxx` and must not be
filed under one — it is a **new designer-agreement gap**, in the same
category as D01's `MIN_WALKWAY` finding: a real blocker that predates no
open question. `agentic_flow/open_questions.yaml` is **not edited by this
ADR**; raising it as an `OQ` is `design_authority`'s act, not mine.

**V01 is runnable without it**, because M2 carries the decision. V01
reports M3's full distribution and each pair's headroom, and records
`needs_input` against the tolerance itself.

**When the designers are asked, they must be shown one number:** the
swatches' own intra-file Delta-E00 p90 is **8.06** (median across 113
files). A tolerance tighter than that is a tolerance the swatch fails
against its own mean. Without that figure the question is unanswerable;
with it, it is a real decision about a real material.

### D5. Pair admission rule — the `ADR-0006` Amendment 1 analogue

A `(image, target)` pair enters the V01 evaluation set only if **all four**
hold. Each is enforced in code and each rejection is counted and reported.

1. **Do-nothing Delta-E00 ≥ 15.** The identity-transform distance from the
   source region's mean to the target. Measured distribution: min 1.42,
   p25 9.00, median 16.84, max 56.91. **21 of 276 pairs (7.6%) sit below
   5** — on those, an identity transform passes a 5 Delta-E tolerance while
   doing nothing. 15 is chosen as ≥3× the loosest plausible tolerance so
   the identity control fails by a margin rather than marginally, exactly
   as `ADR-0006` Amendment 1 required headroom to exceed the decision
   margin. **Retention: 150 of 276 pairs across 21 folders** — ample.
2. **The image is full-product with a clean background** (border ring ≥95%
   near-white, or an equivalent human-confirmed judgment for backdrop
   images like `Forma/SOFA-FORMA-FRONTAL-scaled.webp`). 95 of 163 qualify
   automatically.
3. **The image is human-confirmed as a product photograph**, per
   `ADR-0008` condition 4. Finding 2 makes this mandatory, not advisory.
4. **The target's swatch has central-crop-vs-whole-image Delta-E00 ≤ 5**
   (filters the 5 lifestyle/`RAL 7024` contaminants), **and its intra-file
   p90 travels with every number derived from it.**

Target reduction happens **outside** the port: the live contract is
`ColourTransferAdapter.transfer(source_image: bytes, mask: Mask,
target_colour: RgbColour)` — a single sRGB triple, verified in
`ai_services/variant_generator/src/curalina_variants/ports/colour_transfer.py`.
**Pin mean-in-LAB over the admitted swatch region** as the reduction rule
and publish it; the three candidate rules agree to median 0.51 Delta-E so
any is defensible, but an unpinned one makes run 2 incomparable to run 1.

### D6. Controls — three, mandatory, all reported whatever they show

**C1 — Identity control** (the shuffled-label analogue). Re-run every
admitted pair with the colour transform replaced by an identity map, same
mask, same compositing.

Required outcome: M1 passes (0 changed outside), M4 passes (IoU 1.0),
M2a = 1.000, M2b = 0 — **and M3 fails**, at the pair's do-nothing distance
of ≥15 Delta-E. If any admitted pair's identity run does not fail M3, that
pair was mis-admitted under D5.1; drop it and report the drop.

This is the check the brief asked for, and its result is the point:
**M1, M2 and M4 cannot distinguish "correctly transferred" from "did
nothing" — an identity transform scores perfectly on all three.** Only M3,
and only on a pair with enforced headroom, separates them. That asymmetry
must be stated in the decision record, because it is the reason M3 stays in
the metric set despite being demoted.

**C2 — Non-product control.** Run the pipeline on
`Bench J/BZ 28 EL-MALIBU-VELVET-ICE.webp` with a full-frame mask, and
record the result from Finding 6: it scores the **best** result in the
probe on every metric. Required handling: the notebook states plainly that
**the metric set cannot detect this case**, and that the only control which
catches it is the human per-file review. This converts `ADR-0008`'s
condition 4 from a process rule into an evidenced necessity.

**C3 — Wrong-target control.** For each admitted pair, additionally run
against a target drawn from a *different* folder's swatch, matched on
do-nothing separation. Required outcome: M1, M2 and M4 are indistinguishable
from the correct-target run. This makes explicit that **nothing in the V01
metric set is evidence that the *right* colour was chosen** — only that *a*
requested colour was applied. Choosing the right colour is a design-rules
and palette question (`OQ-007`, which stands in full: I confirmed **zero
`#RRGGBB` tokens across all 169 manual pages**), not a variants one.

### D7. Reporting

- **Per admitted pair first. Never aggregate before per-pair.** Roll up by
  folder and by product afterwards.
- **Failures reported per mode, separately** — the same discipline the
  G-series requires: (a) gamut clip-out, (b) L\* texture collapse, (c) mask
  defect found at review, (d) rejected at admission, with the admission
  criterion that rejected it. **Merging these into one pass rate is
  falsification, not summarization.**
- **Every failure retained.** A V01 notebook showing only successes has not
  been run honestly.
- **The funnel is reported as counts at every stage:** 197 webp → 163 after
  `ADR-0008` name exclusions → 19 flagged as material samples → 95
  full-product → N human-confirmed → M admissible pairs → K evaluated.
- **Hashes.** sha256 of every admitted image and of
  `ATRIANI/Design 44.xlsx` (which is
  `f4b00dce359dbf19d5a0abad9eba56ecdadaf3f1490116bcfb83d9e69872c0bb`,
  measured — `ADR-0008` pinned the requirement but not the value).

### D8. Engineering constraints on the V01 notebook

1. **No business logic in notebook cells** (`16_notebook_standard.md`). The
   LAB transform, the composite and every metric go into the package: a
   `LabColourTransferAdapter` implementing the existing
   `ColourTransferAdapter` port, plus an `evaluation/` module for the
   metrics — mirroring R02's `evaluation/` package. The notebook narrates,
   plots, and calls in.
2. **Per-module test coverage must be reported for every new module**, not
   just the aggregate. This is the defect pattern that recurred twice in
   session 3 (nine, then two more, `evaluation/` modules at 0% while the
   aggregate looked healthy).
3. **No OpenCV dependency.** Implement sRGB↔CIELAB and CIEDE2000 as
   explicit numpy (~60 lines), cross-checked once against scikit-image
   **in the evaluation run, not in the fast test path**. Two reasons:
   `cv2.cvtColor`'s 8-bit LAB is quantised to 0–255 with `L` scaled by
   255/100, silently costing ~0.4 L\* on a measurement whose decision band
   is a few Delta-E; and the service must not acquire a 35 MB binary
   dependency for arithmetic. My reference implementation is verified
   against canonical values (white → L\*=100; pure red → 53.241, 80.092,
   67.203; Delta-E00(white, black) = 100.0).
4. **No glob** (`ADR-0008` condition 2) — allowlist from `Design 44.xlsx`'s
   `Linl to pictures ` column (sic).
5. **No service-runtime path dependency** (`ADR-0008` §4) — notebook-scope
   `CURALINA_SOURCE_ASSETS_DIR` only, never `CURALINA_DATA_DIR`, never
   added to `Settings`.
6. **Masks are human-authored per-region**, not background-derived. My
   probe used a background-derived mask deliberately and that is *not*
   admissible for the run: it cannot separate legs, piping and hardware
   from upholstery, which is precisely what
   `15_variant_generation_technical_design.md` §2 says a product-wide mask
   fails to do. Note `Mask.editable_mask` is `bytes`, one byte per pixel —
   6.55 MB at 2560×2560.
7. **No dependency trap.** Verified, so nobody repeats R02's `not_run`
   arms: Python 3.14 cp314 wheels exist and are fetchable for Pillow
   (12.3.0), scikit-image (0.26.0) and opencv-python-headless (abi3). V01
   has no torch-shaped hole. AVIF decodes natively in Pillow 12 — needed,
   as 5 swatches are `.avif`.

### D9. Claim ceiling — binding, whatever the numbers say

Modelled on `ADR-0006` §D6a. This section is the operative constraint on
the decision record and is not negotiable by the engineer who runs it.

**V01 can support:**

- "The deterministic LAB colour-transfer baseline and `hard_composite` are
  implemented and behave as specified on *N* human-reviewed ATRIANI product
  renders; protected-pixel invariance holds exactly and lightness-structure
  preservation is quantified per pair."
- A **revise** decision on the algorithm — in particular, Finding 5 already
  supports replacing `dark_to_light_risk` with a mask-region `std(L*)`
  predictor, and V01 should test that replacement explicitly.
- A **go/no-go on proceeding to V02** — whether a baseline exists that is
  worth comparing a diffusion path against.
- An `insufficient_evidence` outcome. That is a first-class result here and
  a likely one.

**V01 cannot support, under any outcome:**

1. **No G-series stage gate.** `variant_generator_workflow.md`'s own gate
   table binds "meets acceptance thresholds (≥10/12 accepted, identity
   preserved)" to **V03 + G1/G2**. V01 is not that gate and cannot become
   it by scoring well.
2. **No claim about camera photography.** The admitted assets read as CGI
   renders and the probe corroborates it: the class-A set's border ring is
   ≥95% *exactly* white with corner std 0.00 at the median — a camera
   sensor does not produce that. **If the shipped product ingests real
   photos, V01 is re-established on real photos or its result does not
   apply.** This sentence goes in the decision record regardless of
   outcome.
3. **No colour-accuracy claim against a true variant.** No reference
   exists. M3 measures attainment of a *requested* target. The words
   "colour accuracy", "fidelity", "matches the variant" and "ground truth"
   may not appear.
4. **No "synthetic-free corpus" claim.** `ADR-0008` established filename
   screening is insufficient; Finding 2 adds a second contamination class
   that filename screening also missed and that is not about AI generation
   at all. No completeness claim about the corpus is available.
5. **No Delta-E tolerance claim.** See D4.
6. **No generalisation claim, and the word "held-out" may not appear.**
   `ADR-0008` pre-approved LUXUS as the held-out generalisation set for a
   second run. Until that run exists, ATRIANI is a **development set** and
   V01's result is a development-set result. A baseline that passes on
   ATRIANI and fails on LUXUS would show the ATRIANI assets' uniformity was
   doing the work — `ADR-0008` correctly calls this the cheapest available
   falsification, and it is now cheaper still, because Finding 3 shows
   ATRIANI's swatches are uniform in a way LUXUS's absent swatches cannot
   be.
7. **No movement on V02, V03, G01, `OQ-009`, `OQ-010` or `OQ-011`.**

**Scope every finding to "this corpus", never to "Curalina's product
photos".** `ADR-0008`'s Verification section carries the verbatim provenance
caveat; V01's decision record must carry it in substance, **extended with
Findings 1 and 2** — the folder count is 40 not 41, and 19 admitted files
are material samples rather than products.

## Consequences and reversal

### Consequences

- **V01 may be dispatched.** This document is the precondition `ADR-0008`
  set. `ml-notebook-engineer` is the owner, under this role's sign-off.
- **`ADR-0008` is amended in one factual respect** and corroborated in
  another. The working set is **95 full-product images across 26 folders**,
  not "163 across 41"; the 163/40 figures describe name-admitted files, not
  usable product images. `ADR-0008`'s filename-screening-is-insufficient
  finding is independently reconfirmed by a new contamination class.
  `ADR-0008` is **not edited** — this ADR supersedes those two figures by
  reference, per the project's amend-don't-rewrite convention.
- **A defect in `agentic_flow/15_variant_generation_technical_design.md` is
  now evidenced**: `dark_to_light_risk` does not predict the observed
  failure mode (r = +0.034 vs r = +0.720 for the `std(L*)` alternative).
  Per project convention this deserves a targeted entry in
  `agentic_flow/AMENDMENTS.md`. Not written by this ADR.
- **A new designer-agreement gap is recorded** (D4) and is not an
  `OQ-xxx`. `agentic_flow/open_questions.yaml` **not edited**.
- V02, V03 and everything room-side are untouched.

### Reversal

- **If the client supplies per-image colourway labels** (`ADR-0008`'s
  client item 4): reference-based metrics become computable, M3 is promoted
  from demoted to primary, and D1's reframe is no longer needed. Supersede
  D1–D3 by amendment naming this ADR, not a rewrite. **Cost of having
  ruled this way meanwhile: one notebook run**, and the structure-
  preservation metrics survive unchanged because they never depended on a
  reference.
- **If the corpus is found unlicensed or not current:** the methodology
  transfers to any future corpus intact; no V01 acceptance claim survives.
- **If more contamination is found among the admitted set:** every V01
  finding over the contaminated set is void and the run repeats. Finding 2
  makes this materially more likely than `ADR-0008` assumed.

### What would prove this decision wrong

- **A V01 run where M2a and M2b both sit at ceiling across all admitted
  pairs.** Then I mis-sized the thresholds from a background-derived mask,
  human masks are much tighter than my proxy, and the primary metrics are
  as vacuous as the demoted ones. This is the most likely way to be wrong
  and the run should report the M2 distribution first, before any pass
  rate, so it is visible immediately.
- **The `std(L*)` predictor failing to hold on human-authored masks.** My
  probe's masks include the whole product, not just upholstery; restricting
  to a genuine upholstery region shrinks the lightness range and may change
  the correlation. Finding 5 is a probe result, not a V01 result, and the
  run must re-derive it rather than cite it.
- **Designers setting a tolerance above ~8 Delta-E.** Then M3 becomes
  passable by a wider set of pairs than D5.1 assumes and the admission
  threshold of 15 should be re-derived from the agreed tolerance rather
  than from a placeholder of 5.

## Verification

### Reproducing the probe

All numbers above are mine, measured 2026-09-14 against
`/Users/rjsalmon/Downloads/Supplier Images/ATRIANI` (out-of-repository, not
copied in) on Python 3.14.0 / numpy 2.5.3 / Pillow 12.3.0, with an isolated
virtualenv outside the project. The probe wrote nothing to the repository
and touched no service `src/`.

Colour-science implementation verified against canonical values before use:
sRGB white → `L* = 100.000`, pure red → `(53.241, 80.092, 67.203)`,
CIEDE2000(white, black) = `100.000`, CIEDE2000(x, x) = `0.000`.

### Factual claims and their checks

- `ATRIANI/Design 44.xlsx` sha256
  `f4b00dce359dbf19d5a0abad9eba56ecdadaf3f1490116bcfb83d9e69872c0bb`;
  one sheet `design 44 product development`; header on row 2; 42 distinct
  `Linl to pictures ` values.
- 197 webp total; **163** after `ADR-0008`'s name exclusions; **153
  distinct sha256** among them (10 duplicate files, 3 hashes cross-folder:
  ×7, ×4, ×2).
- Folders: 42 total, **40** with ≥1 admitted webp. Dropped:
  `Curva King Bed` (named in `ADR-0008`) and **`Zuma Side Table`** (all
  webp are `-150x150`; not named anywhere previously).
- **95** of 163 have a border ring ≥95% near-white, across **26** folders;
  **14 of 40** folders have none.
- **19** of 163 flagged as material/finish samples. `AI01` is byte-identical
  across 7 folders, `AI07` across 4. `Alice Chair/AI01 Steelness steel.webp`
  opened and visually confirmed as a brushed-steel texture.
- 113 non-webp files; intra-file Delta-E00 p90 median **8.06**; **92 of 113**
  exceed p90 > 5. Extraction-rule disagreement > 2 Delta-E on **16 of 113**.
- Probe: **276 pairs, 24 folders.** Outside-mask changed-pixel values
  observed: `{0}`. Delta-E00(region mean, target): median 0.517, p90 3.622,
  max 8.987. Clipped fraction: median 0.043, p75 0.224, max 0.735; >1% on
  200/276, >20% on 81/276. L\* variance ratio: min 0.237, p25 0.772, median
  0.953. Do-nothing Delta-E00: min 1.416, p25 9.000, median 16.839, max
  56.905; **21 of 276 below 5**.
- Correlations: clip vs dL **+0.034**; clip vs `std(L*)` **+0.720**; clip vs
  Delta-E residual **+0.796**; clip vs variance ratio **−0.534**. Median
  clip by `std(L*)` band: **2.1% / 1.7% / 20.7% / 38.0%** for 0–10 / 10–20 /
  20–30 / 30+.
- Degenerate case `Bench J/BZ 28 EL-MALIBU-VELVET-ICE.webp`, full-frame
  mask: 0 changed outside, Delta-E00 **0.000**, per-pixel p99 1.26, clip
  0.000%.
- Design Manual (sha256 `7d450d28…`, 169 pages, per `ADR-0009`): `Delta E`,
  `DeltaE`, `ΔE` → **0 hits**. `#RRGGBB` tokens → **0 hits** across all 169
  pages (`OQ-007` stands in full).
- Live contract confirmed by reading source, not the design doc:
  `ColourTransferAdapter.transfer(source_image: bytes, mask: Mask,
  target_colour: RgbColour) -> ColourTransferResult`;
  `Mask.editable_mask` is `bytes` at one byte per pixel;
  `Mask.feather_px` defaults to 3; no `LabColourTransformer` exists yet —
  only `FakeColourTransferAdapter`, a labelled no-op.
- cp314 wheels confirmed fetchable via `pip download --no-deps` for
  `pillow` (12.3.0), `scikit-image` (0.26.0), `opencv-python-headless`
  (abi3).

### Approval

No approval record exists. This is an `ai-ml-lead` methodology ruling
pending the client confirmations in `ADR-0008`, and pending the
`design_authority`/designer Delta-E tolerance agreement in D4 — neither of
which blocks the V01 run, both of which bound its claims.
