---
name: user-role
description: The user orchestrates the Curalina agent roster and routes engineering deliverables to ai-ml-lead for gate sign-off; they pre-verify and expect independent re-verification back
metadata:
  type: user
---

The user runs the **orchestrating session** for Curalina — they decompose
work into packets, dispatch it to the engineering roles, and bring completed
deliverables to `ai-ml-lead` for gate sign-off. They are not the person who
wrote the code under review.

How they work, and what it means for me:

- **They independently verify before handing work over.** They re-run
  notebooks, re-read stored output cells, and re-compute funnels rather than
  quoting a work packet's own claims — and they say explicitly which parts
  they verified themselves versus which they are relaying.
- **They explicitly invite me to check their work too**, in the same
  message ("you may read the notebooks yourself rather than taking my
  summary at face value — same discipline this project has applied
  throughout"). This is a genuine invitation, not politeness. See
  [[feedback-verify-independently]].
- **They pre-state the answer they expect** ("it should — this was a
  mechanical fix") while leaving the decision open ("if you find the scope
  was exceeded or under-delivered, say so"). Treat the expectation as a
  hypothesis to test, never as the conclusion to reach.
- **They understand the two gate systems** (`R/V/G/D` + `G0-G5` vs `A0-A6`)
  and do not confuse "service is built" with "capability is proven". I do
  not need to re-explain the distinction, only apply it.
- **They ask for scope-boundary judgements, not just verdicts** — "confirm
  or correct", "say so if scope was exceeded or under-delivered". A bare
  yes/no underserves them.

They write terse, dense, heavily-cross-referenced prose and expect the same
back: specific file paths, specific numbers, named pairs/scenarios. Vague
qualifiers ("slightly better", "mostly passes") are not useful to them.
