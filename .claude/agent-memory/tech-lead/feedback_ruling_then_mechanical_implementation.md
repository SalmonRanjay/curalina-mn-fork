---
name: feedback-ruling-then-mechanical-implementation
description: Tech-lead is expected to implement the small mechanical code change that follows directly from its own ruling, then re-run full verification and report real output
metadata:
  type: feedback
---

When a `tech-lead` ruling resolves into a small, mechanical code change
(a new optional dataclass field, a schema realignment), the orchestrator
expects me to **make the change myself** and then re-run the owning
package's full verification (`make test`, `make test-contract`, `make lint`,
`make typecheck`), pasting **real** output into the ADR's Verification
section — not "tests pass".

**Why:** the role brief says "you do not write production code", but that
is aimed at feature work. Twice now the orchestrator has explicitly
authorized the follow-through (ADR-0003 rooms schema alignment; ADR-0007
`Product.overview`), scoped as "same category as your rooms-schema fix".
Separately, the project has a standing rule (`agent_instructions/STATUS.md`)
that every agent report — including ADRs — is a claim to verify, not a fact
to relay, after three incidents of propagated wrong claims. Pasting real
command output is how a ruling avoids becoming another such claim.

**How to apply:** the boundary is *does this change follow mechanically
from a decision I just made, with no design latitude left?* A new optional
field with a default: yes. Wiring an importer, building a notebook,
touching another package: no — specify it in the ADR as "authorized as
consequential implementation" and hand off. Never exceed the packages named
in the brief.

See also [[feedback-verify-before-ruling]].
