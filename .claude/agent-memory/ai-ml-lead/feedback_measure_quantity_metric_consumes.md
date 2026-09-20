---
name: feedback-measure-the-quantity-the-metric-consumes
description: Before freezing an evaluation, measure each candidate metric's actual variance on real data — check both the do-nothing floor and the by-construction ceiling; never select on a proxy statistic
metadata:
  type: feedback
---

Before freezing any evaluation set, compute — on the actual pinned data — the
**base rate a do-nothing ranker would achieve on the reported metric**, and
check that the achievable headroom is several times the decision threshold the
ADR uses. Select evaluation strata on that quantity, never on a proxy like raw
column frequency.

**Check the ceiling as well as the floor.** A metric can be useless for the
opposite reason: pinned at its maximum *by construction*, so nothing can fail
it. In V01 (ADR-0012) two of the three properties `ADR-0008` proposed as the
gate were exactly this — protected-pixel changed-count was `{0}` across all 276
pairs because `hard_composite` guarantees it, and Delta-E-to-target had median
0.517 because the LAB algorithm literally *assigns* `a*,b* = target`. Both
would have returned a near-perfect V01 pass proving only that the arithmetic
was transcribed correctly. **The test is: run the metric and look at its
distribution. If min ≈ max, it is an assertion, not a measurement** — keep it
as a unit test, but it earns no gate credit and may not enter a pass rate.

Corollary: a threshold that nothing fails measures nothing. When you set one,
say what fraction of the measured distribution it rejects. If the answer is
"none", the threshold is decorative.

**Why:** in ADR-0006 §D3 I selected Stratum A's terms by frequency in the
catalogue. That is a proxy. The metric (P@5, relevance = label ≥ 1) actually
consumes the *union* rate of (style ∨ atmosphere) *within the brief's candidate
pool*. On the real workbook the frequency rule produced a union rate of 0.85 —
a broken encoder scores 0.85, several briefs score 1.00 for every arm, and the
0.10 decision margin exceeded the available headroom. `tech-lead` caught it in
ADR-0007 §C3 before the freeze; I had not, because I wrote the rule from the
column's shape rather than from its distribution. I had the file the whole time.

**How to apply:** applies to any evaluation-set design — R03's briefs, V01/V02
acceptance sets, G02/G03 scene sets. Three habits that would have caught it:

1. Write down the metric's formula, identify the exact quantity it consumes,
   and compute *that* — not a marginal that feels related to it.
2. Compute a **prevalence / no-op baseline** as a named arm. If you cannot say
   what a ranker that does nothing scores, you cannot interpret any arm.
3. Sanity-check thresholds against headroom: a fixed absolute margin silently
   changes stringency when the base rate moves. Express it relative to
   `(1 − baseline)` as well as absolutely.

Also: check term/feature **collinearity within the actual subset**, not
globally. Values that look independent catalogue-wide can be identical inside a
stratum, which makes duplicate observations look like independent ones and
inflates effective sample size against the stated n.

See [[project-r02-evaluation-ruling]] and
[[feedback-verify-live-contract-before-designing-evaluation]] — same root
cause: designing from the document instead of the live artifact.
