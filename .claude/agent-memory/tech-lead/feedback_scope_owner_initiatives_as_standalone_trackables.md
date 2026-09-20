---
name: scope-owner-initiatives-as-standalone-trackables
description: When the owner asks for a capability "as its own initiative", give it its own ADR plus its own numbered STATUS dispatch item and phased packets — never fold it into an existing item
metadata:
  type: feedback
---

When the project owner asks for a capability to be scoped as its own
initiative ("decoupled", "independently trackable"), the deliverable shape is:
one new ADR + one new numbered dispatch item in `agent_instructions/STATUS.md`
+ a phase table where each phase is packet-sized. Do **not** extend an
existing dispatch item or append phases to a neighbouring ADR.

**Why:** the owner tracks progress by dispatch-item number and by ADR. Folding
new scope into an existing item makes the initiative invisible to that
tracking and entangles its status with unrelated work. Item numbers are
explicitly declared stable and cited by ADRs (`STATUS.md` dispatch-table
preamble), so a new number is cheap and a merged item is expensive.

**How to apply:** check the current max item number in the dispatch table and
append after it — numbers are never reused or renumbered. Pair the row with an
`### Item NN` block in the "Implementation guidance (`tech-lead`)" section
carrying the non-obvious constraints, per
[[status-doc-operational-first]]. When the owner has *also* sanctioned an
interim stopgap running in parallel, say in the ADR that no claim transfers
between the two — the risk is a later session treating the stopgap's output as
evidence for the real path.

Confirmed on the 2026-09-17 real-room-generation ask (`ADR-0020`, item 27),
which ran alongside a separately-scoped labelled compositing preview.
