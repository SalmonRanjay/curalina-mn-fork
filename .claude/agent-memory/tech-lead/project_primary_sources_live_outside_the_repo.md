---
name: primary-sources-live-outside-the-repo
description: Curalina's load-bearing client artifacts (Design Manual, supplier imagery) live in ~/Downloads outside version control, not in the repo — check there before declaring an input missing
metadata:
  type: project
---

Curalina's most important source documents are **not in the repository**.
Three have now been found by accident in `/Users/rjsalmon/Downloads`:

- `Training Doc 1 - Design Manual.pdf` — the 169-page primary specification
  that the entire `agentic_flow/` pack is a secondary reading of. Admitted by
  `ADR-0009`, read in place, pinned by sha256, **never copied into the repo**
  (rights unestablished, revision status unknown).
- `Supplier Images/` (`ATRIANI`, `LUXUS`, `LAZZONI`, `CELADON`) — admitted
  by `ADR-0008`.
- `Celadon CSV Programmer Handoff.xlsx`, `Luxus Programmer Handoff.xlsx` —
  not yet examined by any session as of 2026-09-14.

**Why:** the project spent seven sessions treating the Design Manual as an
absent artifact and reasoning about §9.1's intent from `agentic_flow`'s
paraphrase, while the original sat one directory away. `ADR-0004` line 180
states §8's examples are "not in this repo" — they exist. Repeatedly deriving
blockers from a paraphrase of a document we can actually read is pure waste.

**How to apply:** before writing "this input does not exist" or "the manual is
unavailable", check `~/Downloads` (and ask the user what else they have).
Conversely, `~/Downloads` is **not a sanctioned delivery path** — say so to
the client every time, the way `attached_assets/` is not one either. Admit
such files read-in-place and pinned by hash; never copy them in, because a
committed copy becomes a second source of truth that silently drifts from the
client's.

Corollary worth remembering: the manual **confirmed** the `OQ-xxx` set is a
faithful record of real gaps (e.g. `OQ-005`'s "[blank]" is a physically
missing value on p81; CMR is named twice in 169 pages with no formula). The
pack's authors did not invent blockers. But the manual resolves *scope*
questions, not *undefined-number* questions — do not assume finding a primary
source unblocks an `OQ-xxx`.

See also [[feedback-verify-before-ruling]].
