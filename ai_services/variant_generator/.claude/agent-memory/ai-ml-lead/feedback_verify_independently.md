---
name: feedback-verify-independently
description: Always re-verify deliverables against raw run artifacts before signing a gate — relayed summaries have carried real arithmetic errors, including from the orchestrator
metadata:
  type: feedback
---

**Never sign a gate from a summary. Always read the notebook's own stored
outputs and the archived run CSVs/JSON yourself, and recompute the headline
numbers.**

**Why:** this project's standing practice is that independent verification
has caught a real, previously-undisclosed problem in every session (recorded
in `agent_instructions/STATUS.md` under "Working practices worth not
rediscovering"). On 2026-09-15 it held again at the sign-off layer
specifically: the orchestrator's own carefully-verified V01 summary still
contained three arithmetic/logic errors that only appeared when I opened the
raw CSVs — a failure count that contradicted its own pass rate, a control
reported as "confirmed" that its own CSV falsified, and a prose fix that had
been applied to a notebook cell's *stored output* instead of its *source*.
The user explicitly invites this check; it is not treated as distrust. See
[[user-role]].

**How to apply:**

- Read `runs/<RUN_ID>/*.csv` and `decision*.json` directly, not just the
  notebook narrative and not just the work packet.
- **Recompute pass rates from the per-row data.** Cross-check narrative
  prose against the computed fields in the same artifact — that is where the
  drift lives. See [[pattern-prose-drifts-from-numbers]].
- **Diff a notebook cell's `source` against its stored `outputs`.** A
  mismatch means an output was hand-edited, which is fabricated execution
  evidence even when the edited text is more accurate.
- Re-run `make test` for the affected package and check **per-module**
  coverage, not the aggregate. Watch for `tail`-truncating the coverage
  table — modules sorting early alphabetically (`adapters/` before `api/`)
  get cut off and look missing when they are fine.
- Grep for forbidden claim-ceiling vocabulary ("held-out", "ground truth",
  "fidelity", "colour accuracy") scoped to the artifact under review, not
  the whole repo — unexecuted sibling skeletons produce false hits.
