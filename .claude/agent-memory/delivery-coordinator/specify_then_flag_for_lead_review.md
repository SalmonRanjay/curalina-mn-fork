---
name: specify-then-flag-for-lead-review
description: How to handle a cross-cutting product/design decision that a packet needs answered but that is arguably above delivery-coordinator's authority
metadata:
  type: feedback
---

When a packet needs a real product/design decision to proceed (e.g.
"what should happen when a flag-on request hits a downstream service that
is unreachable") and it's genuinely ambiguous whether that decision is
routine enough to make directly or big enough to require `tech-lead`
sign-off, do both rather than picking one: **specify a concrete, reasoned
default behavior in the packet so the engineer is never blocked**, and
**separately log it in `agent_instructions/STATUS.md`'s dispatch table as
a named, non-blocking follow-up for `tech-lead` to confirm or override**.

**Why:** `AGENTS.md` §5 says an engineer escalates a design question a
packet doesn't answer — so the packet must not leave the question open.
But `CLAUDE.md`'s own framing distinguishes engineering decisions from
product ones, and some decisions (this one changed real user-facing
behavior once a flag is ever turned on for real traffic) are more product
policy than engineering default. Making the call *and* flagging it avoids
both failure modes: an unspecified packet that stalls on a design
question, and a silent unilateral product-policy call that never gets
reviewed. This mirrors the project's own established pattern of leaving a
specific, named, non-blocking follow-up in the dispatch table rather than
looping a lead role for routine confirmation (see `AGENTS.md` §5's "cap
review rounds" and the several non-blocking follow-ups already logged
against `ai-ml-lead`/`tech-lead` in `STATUS.md`, e.g. item 9's C3 wording
follow-up).

**How to apply:** in the packet, state the decision, the reasoning, and
that it is implemented as specified so the engineer proceeds. In
`STATUS.md`, add one clearly-labeled sentence identifying it as a
`tech-lead`-confirmable follow-up, not a closed ruling — so a future
session doesn't mistake "specified in a packet" for "signed off by the
role with actual authority over it."
