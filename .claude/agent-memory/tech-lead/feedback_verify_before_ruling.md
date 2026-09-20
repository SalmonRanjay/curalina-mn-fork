---
name: feedback-verify-before-ruling
description: Re-derive the requesting agent's load-bearing factual claims from source before ruling on them, and hand cross-role findings over explicitly rather than ruling on them
metadata:
  type: feedback
---

Two habits the orchestrator rewards when a ruling is requested:

1. **Independently check the empirical claim the requesting ADR is resting
   on**, even when told to "trust both documents". Briefs here routinely
   say "don't just take the summary above — look at the actual data". Doing
   the check has repeatedly turned up something the requesting agent missed
   (ADR-0007: material columns are perfectly supplier-disjoint and label
   density differs 3x by supplier — a confound the requesting ADR's own
   shuffled-label control would *not* catch).
2. **Name findings that belong to another role as handed over, not ruled
   on.** When a verified number undermines another role's methodology
   (e.g. `ai-ml-lead`'s brief-selection rule), record the number and the
   consequence in Consequences, state plainly that the amendment is theirs,
   and gate the downstream work on it. Do not quietly rewrite their rule.

**Why:** the project's split is that `tech-lead` owns boundaries/contracts/
provenance and `ai-ml-lead` owns whether evidence is sufficient. Blurring it
once makes both roles' sign-offs meaningless. And a ruling built on an
unverified summary is the failure mode `agent_instructions/STATUS.md`
already logs three instances of.

**The sharpest version of habit 1: when a scan generalises from one sample,
measure the whole population before ruling.** ADR-0008 — a `research-scout`
pass inferred from *one* ATRIANI folder that every product folder pairs a
base photo with matching ground-truth swatches. Scripting it across all 42
folders gave **2/42**. The ruling flipped from "we have supervised
colour-variant pairs" to "we have unlabelled base images only", which
changed the whole V01 methodology. The same pass also (a) missed the single
most important file in the corpus by reporting it in the wrong directory and
declaring it out of scope, and (b) missed an AI-generated image sitting
among the real assets. Cheap population-level scripts catch all three; more
sampling does not.

**How to apply:** budget one or two short scripts against the real source
data before writing the Decision section. If a check can't settle something
(e.g. I could test *verbatim* label-echo but not *semantic* auto-tagging),
say so explicitly in "What would prove this decision wrong" rather than
letting silence imply it was cleared.

See also [[feedback-ruling-then-mechanical-implementation]].
