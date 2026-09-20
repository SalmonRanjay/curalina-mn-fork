---
name: feedback-verify-live-contract-before-designing-evaluation
description: Before specifying any Curalina evaluation, read the live domain model and check label-source vs feature-source field disjointness — design docs here describe fields that do not exist
metadata:
  type: feedback
---

When designing an evaluation for a Curalina service, do two checks before
writing any methodology:

1. **Read the live domain model, not the technical design doc.**
   `agentic_flow/13_recommendation_technical_design.md` specifies encoders
   scoring against product style/atmosphere/overview fields; the actual
   `Product` dataclass carries none of them. The design doc describes an
   intended contract, the code carries the real one, and R01 deliberately
   mapped only what it was authorised to map.
2. **Check that label-source fields and feature-source fields are disjoint.**
   In R02, grounding labels in `Design Style`/`Tags` while letting the
   rule-only baseline read the same columns makes the baseline win 1.00 by
   construction and grades the embedding arms on a string they cannot see.
   Enforce the split structurally (label fields simply absent from the object
   encoders receive) and make the notebook assert it — a convention an engineer
   can forget is not a firewall.

**Why:** both were caught only by reading source in this repo; either one alone
would have produced a spec that looked complete and yielded a meaningless
number. The project's own posture is that every agent report — including ADRs —
is a claim to verify, not a fact to relay.

**How to apply:** applies to R02/R03, V01-V03, G01-G03 and any future gate
spec. Cheap: one `grep` of the dataclass, one table of which fields feed labels
vs features. Do it before writing the methodology, not during review.
See [[project-r02-evaluation-ruling]].
