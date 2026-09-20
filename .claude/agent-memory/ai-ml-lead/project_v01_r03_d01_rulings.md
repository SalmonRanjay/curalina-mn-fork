---
name: project-v01-r03-d01-rulings
description: ADR-0012 (V01 reference-free design, V01 dispatchable), ADR-0013 (R03 formal no-go on two grounds), ADR-0014 (D01 stays accept-with-limitations, §8 is a conformance target not an evaluation set)
metadata:
  type: project
---

Three `ai-ml-lead` rulings, 2026-09-14 (session 8). All three ADRs are in
`architecture/adr/`. `agentic_flow/open_questions.yaml` was **not edited** by
any of them.

## ADR-0012 — V01 is dispatchable

**The reframe:** V01 measures **attainment of a *requested* colour**, never
fidelity to a reference. The target is an input to the system under test, so
that claim is legitimate; "matches the true variant" is not available and is
falsification. Binding wording.

**Why the ruling was needed:** two of the three properties `ADR-0008` floated
are at ceiling by construction. Measured over 276 real (image, swatch) pairs:
protected-pixel changed-count outside the mask is `{0}` — *zero variance*,
guaranteed by `hard_composite`; Delta-E to target has median **0.517** because
the LAB algorithm *assigns* `a*,b* = target`, and its residual correlates
**+0.796** with gamut clipping. The metrics with real variance are **L\*
variance ratio (0.237–1.000)** and **gamut-clipped fraction (0.000–0.735)**.

**Claim ceiling:** no G-series gate, no camera-photography claim (CGI
renders), no colour-accuracy claim, no "synthetic-free corpus" claim, no
Delta-E claim, and **"held-out" may not appear** until the LUXUS run exists.

## ADR-0013 — R03 is a formal no-go, on two independent grounds

Ground 1 is the catalogue (zero rugs, zero lighting, zero availability across
all three sources). **Ground 2 is the engine**: four of the five validation
arms `13_recommendation_technical_design.md:176` requires — style, colour,
material, lighting — do not exist (`style.py`/`palette.py`/`pruning` absent),
each blocked on `OQ-002`/`OQ-004`/`OQ-007`/`OQ-009`.

**So a perfect catalogue delivered tomorrow does not unblock R03.** Reversal
needs both halves. Bundle composition may proceed logic-only against
labelled-synthetic fixtures. **G2 is not reached.** One correction to prior
sessions: the accent-chair gap is *no longer absolute* — ATRIANI supplies five
accent/arm chair products and an ottoman.

## ADR-0014 — D01 stays `accept-with-limitations`; §8 is not an evaluation set

Both originally-named blockers resolve (`MIN_WALKWAY` → `needs_input`/`OQ-013`
under `ADR-0010`; §8 is *inapplicable*, zero spatial content) but D01 does not
promote: `OQ-001`/CMR untouched, four rule families unbuilt, and a **new,
worse limitation** — D01 cell 7 synthesises `bed_point = Point(10, 10)`, which
`ADR-0010` codified as forbidden the day *after* D01 ran. An ADR can
retroactively make an existing artifact non-conformant.

§8 (pp147–150) is four narrative cases: admitted as a **conformance target**,
rejected as an **evaluation set** (n=4, no held-out split, expected outputs are
material nouns, all four currently un-runnable).

## Reusable corpus facts (ATRIANI, verified by me — `ADR-0008`'s figures are wrong)

- Usable working set is **95 full-product images across 26 folders**, not "163
  across 41". 163/40 counts *name-admitted files*, not products. **14 of 40
  folders have zero usable images.** Two folders drop, not one — `Zuma Side
  Table` as well as `Curva King Bed`.
- **19 of 163 admitted `.webp` are material/finish swatches, not products.**
  `AI01` is byte-identical across 7 folders (a brushed-steel texture; I opened
  it). The `.webp` extension does not partition products from swatches, and
  filename screening misses this entirely — a *second* contamination class,
  unrelated to AI generation.
- **Swatches are material textures, not colour chips**: intra-file Delta-E p90
  median **8.06**; 92 of 113 exceed 5. The *extraction rule* is stable though
  (mean/median/RGB-mean agree to ~0.5 Delta-E), so a single target colour is
  definable — just not tight.
- **`dark_to_light_risk()` in `agentic_flow/15_...md` is a wrong predictor**:
  corr **+0.034** with the observed failure. The real driver is the mask
  region's `std(L*)`, corr **+0.720**. Worst cases are often *light-to-dark*.
- **The Delta-E tolerance has no `OQ-xxx` and must not be filed as one** —
  "Delta E" appears **zero times** in 169 manual pages, so it is a designer
  agreement never made, not a manual blank. Same category as D01's
  `MIN_WALKWAY` finding.
- `OQ-007` verified to stand in full: **zero `#RRGGBB` tokens in 169 pages**.
  But its enumeration is *incomplete* — §8.3 needs a "Fossil Node" it omits.

See [[project-r02-evaluation-ruling]],
[[feedback-measure-the-quantity-the-metric-consumes]] and
[[feedback-verify-live-contract-before-designing-evaluation]] — the V01 probe
is the third consecutive instance of the same root cause.
