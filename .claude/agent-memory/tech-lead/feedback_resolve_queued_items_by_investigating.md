---
name: resolve-queued-items-by-investigating
description: A "blocked pending investigation" item that survives multiple sessions is a tech-lead failure; go check whether the input exists and convert it into a closed item with a named client dependency
metadata:
  type: feedback
---

When an item has sat in `agent_instructions/STATUS.md` for more than one
session with a note like "still needs a real source of X, which nobody has
investigated yet" — **that is the item to pick up, and the deliverable is a
finding, not a re-queue.**

**Why:** session 8, 2026-09-14. Two items had been queued three sessions
each. Both resolved in under an hour of actual looking:

- *Doorway positions for `ADR-0004`'s walkway wiring.* They do not exist and
  never would: `RoomGeometry` has a boundary polygon and no openings; the
  production app's `ParsedRoomData.doorway` is `{width, height, unit}` — a
  **delivery-fit** check (`spatial-fit-validator.ts` asks whether a product's
  diagonal passes through the opening), not a position; the Gemini prompt
  asks for "dimensions (critical for furniture delivery)" from *text*, not a
  photo. The manual routes positions through §10 STEP 2 extraction, i.e.
  `OQ-010`, unresolved. → `ADR-0010`: wire it with optional endpoints,
  return `needs_input` on `OQ-013`, **item closed as engineering** with the
  residue tracked as a client blocker.
- *G01's room scenes.* Its prerequisite is not "room photos" but photo +
  **measured** dimensions + annotated corners + planned mm. Nothing anywhere
  qualifies. → `ADR-0011`.

The pattern: an item framed as "blocked pending data" is usually really
"nobody has established whether the data can exist". Those are different
states and only the second one is mine to resolve.

**How to apply:**
- Prefer "this provably cannot come from any existing input, here is the
  trail" over "still blocked". The first closes an item; the second renews it.
- The best outcome is usually **not** unblocking the work — it is converting
  an open-ended engineering queue item into a *closed* one plus a precisely
  named client dependency. Ship the `needs_input` path; that is finished work,
  not deferred work.
- Name the tempting-but-wrong substitute explicitly in the ADR. `ADR-0011`
  lists `attached_assets/stock_images/**` as inadmissible precisely because a
  future session will find a real room photo there and reasonably think it
  might work. Rejecting it once, in writing, is cheaper than re-deriving it.
- Check the *existing production app* for the input. It is documented in
  `docs/` and its schema is in `shared/schema*.ts`; twice now it has been the
  fastest way to settle "does Curalina capture X".

See also [[feedback-ruling-then-mechanical-implementation]] and
[[check-gate-done-evidence-not-just-tests]].
