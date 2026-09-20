---
name: pattern-prose-drifts-from-numbers
description: Recurring Curalina defect — notebook decision-record prose contradicts the computed numbers in the same artifact; check narrative against computed fields every time
metadata:
  type: project
---

**In this project's notebooks, the computed numbers are reliable and the
narrative prose describing them is not.** Check every prose claim against
the computed field in the same artifact before accepting it.

**Why:** observed three times in one V01 review (2026-09-15, run
`V01_20260915T043322Z`), and it is structural rather than careless. The
metrics are produced by tested package code under `evaluation/`, so they are
correct by construction. The decision record's `rationale` string, the
Section 5 failure-analysis markdown, and the `controls` summary fields are
all **hand-written prose that no test covers**, and they drift from the
numbers sitting inches away:

- Section 5 markdown named 2 of 3 M2b failures and asserted a failing pair
  (`poltrona_chair_studio`, 0.1670 vs a 0.02 bar) "passes both" — directly
  under a code cell whose own output printed "3 of 4".
- A control's summary field said M2/M4 were "indistinguishable" between
  correct and wrong targets; its own CSV showed M2b gaps of 0.36 and 0.61
  that flipped the verdict in both directions.
- A stated failure mechanism ("light-to-dark with wide lightness spread")
  was non-discriminating: every pair was light-to-dark, and the one passing
  pair had a *higher* spread than two of the three failures.

This is the same class as `ADR-0014`'s ruling on D01 — recorded evidence
that stops being true must be re-run, not annotated, because "the CSVs are
what a future reader greps."

**How to apply:**

- Treat `decision.json`'s `rationale` / `controls` strings and Section 5
  markdown as **unverified claims**, and reconcile each against the adjacent
  computed field (`M2b_pass_rate`, the per-pair CSV, the control CSV).
- When a control asserts two things are "indistinguishable", check **every**
  sub-metric it names, not the ones the notebook chose to compute a gap for.
- A correct conclusion reached through wrong stated evidence still fails
  sign-off — the artifact is what downstream quotes. Fix the evidence.
- Prefer making these assertions **computed** (an f-string over the real
  numbers, or an assertion cell) rather than hand-written, so they cannot
  drift. Worth proposing in the correction packet. **This works** — the V01
  correction packet replaced a hand-typed failure list with
  `primary_df[~(m2a_pass & m2b_pass)]` and that cell was correct first try.
  Ask for the computed form by default.

**The durable fix is to make the claim computed, and it took three rounds to
get there.** V01 finally closed on run `V01_20260915T115907Z` when cell 28
stopped asserting flip behaviour and started *deriving* it — a boolean
compare of `metric >= bar` between correct- and wrong-target columns, with
counts printed from `len()` of the filtered frame, for **every** metric in
the claim. Two rounds of rewording the prose did not hold; one round of
computing it did. Ask for the computed form on the **first** review pass, not
after a prose fix fails.

**Distinguish a continuation of the finding from a new one before blocking
again.** At round 3 the last residual was `ADR-0012` §D6's own
pre-registered C3 wording ("indistinguishable"), which the run's evidence
has outgrown. That is a different defect class (ADR text vs observation, and
`tech-lead`'s to fix) than the false results-claim originally found, so it
was logged as a follow-up and the sign-off proceeded, per `AGENTS.md` §5's
round cap. Test to apply: *would leaving this closed mislead a downstream
reader about capability?* Here it would not — the decision record stated the
departure explicitly, in the same sentence, with per-pair numbers.

**Partial fixes re-assert the same error on the metric that was not named.**
On the V01 round-2 review (run `V01_20260915T045739Z`), defect 4 — C3's
"M2/M4 indistinguishable" claim falsified by its own CSV — was fixed for
M2b only. The corrected cell then applied a pass/fail flip test to M2b while
re-asserting M2a as "indistinguishable", which the same CSV falsifies
(`forma_sofa` M2a 0.9997 PASS → 0.8564 FAIL at the 0.90 bar), with the
contradicting 0.1433 gap printed on the same line. **When signing off a
correction, apply the corrected test to every metric in the original claim
yourself, not just the one the finding named** — a fix scoped to the literal
wording of the finding will leave the sibling metric wrong.

See [[feedback-verify-independently]].
