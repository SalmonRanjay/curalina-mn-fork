---
name: primary-sources-live-outside-the-repo
description: Curalina's load-bearing client artifacts (Design Manual, supplier imagery, supplier handoff workbooks) live outside version control — as of 2026-09-24 under ~/Documents/Humber/misc.curalina, previously ~/Downloads; check before declaring an input missing
metadata:
  type: project
---

Curalina's most important source documents are **not in the repository**.
They were first found by accident in `/Users/rjsalmon/Downloads`. **As of
2026-09-24 the supplier material has moved** to
`/Users/rjsalmon/Documents/Humber/misc.curalina/` (`Supplier CSV Files/`,
`Supplier Images/`), and `~/Downloads` no longer holds it. Use Spotlight
(`mdfind -name ...`) if a path goes stale again.

- `Training Doc 1 - Design Manual.pdf`: the 169-page primary specification
  (`ADR-0009`), read in place, pinned by sha256, never copied into the repo.
  Its current location was not re-checked in session 20.
- `Supplier Images/` (`ATRIANI`, `LUXUS`, `LAZZONI`, `CELADON`): admitted
  by `ADR-0008`.
- `Supplier CSV Files/{Celadon CSV,Lazzoni CSV,Luxus} Programmer Handoff.xlsx`:
  **first examined 2026-09-24 (ADR-0021 §C1-C2)**. They are tagged 3x3x3 on
  the client's quiz axes (Room Type / Design Style / Atmosphere), and a
  `Practical Touches` column (`; `-delimited) uses the consultation's quiz
  sentences verbatim. **Not yet admitted as a catalogue**: STATUS item 35
  is mine.
- Client UI mockups: `docs/consultation-1/pages/` (in the repo, untracked).

**Why:** the project spent seven sessions treating the Design Manual as an
absent artifact while the original sat one directory away. In session 20,
measuring the handoff workbooks directly overturned two assumptions: that
recommendation's `canonical_tags` was the atmosphere authority, and that
seating and bed size had no catalogue evidence.

**How to apply:** before writing "this input does not exist", search the
filesystem and ask the user. `~/Downloads` and `misc.curalina` are **not
sanctioned delivery paths**; say so to the client. Admit files read in
place and pinned by hash. Never copy them in. The manual resolves *scope*
questions, not *undefined-number* questions.

See also [[feedback-verify-before-ruling]].
