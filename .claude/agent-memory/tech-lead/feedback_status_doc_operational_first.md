---
name: status-doc-operational-first
description: STATUS.md must be operational-reference-first with a labelled archive after; as tech-lead I add per-item implementation guidance, not a bare task list
metadata:
  type: feedback
---

`agent_instructions/STATUS.md` is structured as **one self-sufficient
operational reference first** (where things stand, dispatch table, per-item
implementation guidance, what needs the client, a "where to find X" index,
working practices, known defects), then everything else under a labelled
`# SESSION HISTORY (ARCHIVE)` header. Superseded content is never deleted —
it is moved down with its correction notice intact.

**Why:** the file grew to 1095 lines over 8 sessions and someone dispatching
work had to mentally filter live guidance out of session narrative every
time. Several ADRs' reasoning depends on figures recorded in the narrative
(corpus counts, the exact `assert True` test bodies, the D01
invented-coordinates trail), so cutting history would break the project's
"every claim is independently checkable" discipline. Reorganisation, not
content cut — favour a compressed pointer over deletion.

**How to apply:** when asked to update STATUS.md, edit the operational
section in place and push anything that has become narrative down into the
archive. Keep dispatch-table item numbers stable — ADRs and prior sessions
cite them by number ("dispatch-table item 9"). Date the operational section.

The user asked for **technical/implementation guidance per dispatch item by
name** — "this is exactly the value a tech-lead adds over a bare task list."
Name the established pattern to copy and the exact file/line that implements
it (e.g. rooms' A3 mirrors `variant_generator/.../api/sqlite_store.py`'s
lease/fencing shape; the V01 notebook follows `ADR-0012` §D2's metric set
literally rather than an engineer's substitute). Use judgment on what is
worth flagging per item — do not pad every row uniformly.

See also [[feedback-check-gate-done-evidence-not-just-tests]] and
[[feedback-verify-before-ruling]].
