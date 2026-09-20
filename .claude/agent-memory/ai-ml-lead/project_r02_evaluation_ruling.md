---
name: project-r02-evaluation-ruling
description: ADR-0006 (+Amendment 1) ruled R02 may use a constructed derived-label evaluation set; prerequisites cleared by ADR-0007, freeze may begin, G2 still unreached
metadata:
  type: project
---

ADR-0006 (`architecture/adr/ADR-0006-r02-evaluation-methodology.md`) ruled that
recommendation's R02 **may** proceed with a constructed evaluation set — labels
*derived* by a published deterministic rule over designer-authored catalogue
columns, not hand-judged — under a hash-freeze protocol, with a hard ceiling:
no `adopt_minilm`, no G2 claim, no "meets acceptance thresholds", whatever the
numbers. **That ceiling has never moved and is not negotiable.**

**Status as of 2026-09-13:** both prerequisites are closed and the §D5 freeze
may begin.

- §P (encoder-visible text) — closed by ADR-0007 §D1: `Product.overview` added
  as a single named optional field. Deliberately *not* a `Mapping` bag and
  deliberately *no* material text (material columns are supplier-disjoint).
- §D0 (workbook scope R01 → R02) — closed by ADR-0007 §D2, plus a mandatory
  per-supplier reporting condition.
- ADR-0007 §C3 (defective §D3 term selection) — closed by my Amendment 1
  (§D3a / §D4a / §D6b) at the end of ADR-0006.

**Why the amendment exists:** §D3 originally picked Stratum A's style/tag terms
by catalogue frequency. Measured on the pinned workbook that gives a mean
within-pool relevance rate of 0.85, so a do-nothing ranker scores P@5 ≈ 0.85
and the whole freeze-and-run cycle burns to `insufficient_evidence`.
Discriminative selection brings it to 0.37.

**Reusable findings about this catalogue** (md5 `3ad1f5d7…`, 385 rows), each
verified by me, each likely to bite R03 and any future ranking work:

- Candidate pools are near-perfectly **supplier-determined** (Dining Chairs
  94/94 Four Hands; Nightstand 82/82 Moe's). Six atmosphere tags are
  *perfectly* supplier-disjoint — ADR-0007's "3x tag density" understates it.
- The `Tags` column has far fewer degrees of freedom than its 26 values: within
  a single-supplier pool tags collapse into Jaccard = 1.00 equivalence classes.
  Two briefs on a collinear pair are the same brief twice, which inflates
  effective n while every CI assumes the stated n.
- Material-family tags echo verbatim into `Overview`; style terms never do
  (0/385). So material tags are safe as *label inputs* but leak if used to
  define a brief.

**How to apply:** if asked to sign off R02, run ADR-0006's Verification checks
1–17 — the freeze-hash, firewall, and the amendment's band/collinearity/
supplier-skew checks. The nine briefs tabulated in §D3a-I are *expected output
of a procedure*, not a frozen answer; the procedure is what is normative. R03
will hit the same labels question — point it at ADR-0006 rather than
re-litigating, but note R03 sits on the *other* side of ADR-0005's split (it
needs a buyable/placeable catalogue), so derived labels do not rescue it.
See [[feedback-verify-live-contract-before-designing-evaluation]] and
[[feedback-measure-the-quantity-the-metric-consumes]].
