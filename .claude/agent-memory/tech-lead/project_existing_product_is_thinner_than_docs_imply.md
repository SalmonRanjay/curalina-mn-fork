---
name: existing-product-is-thinner-than-docs-imply
description: The "existing running product" in docs/ is substantially not present in this checkout — the legacy AI render stack is orphaned and the Results page's endpoints never existed
metadata:
  type: project
---

`CLAUDE.md` frames `docs/` as "the current, running system" and
`architecture/`+`agentic_flow/` as "not yet built". **The first half of
that framing is unreliable and cost a session to discover.**

Verified 2026-09-16 while tracing quiz → results for `ADR-0018`:

- The monolith's legacy image-generation stack (`openai-render.ts`,
  `stability-*`, `gemini-image-only-render.ts`, `hybrid-compositing.ts`,
  `room-composite-service.ts`, `render-qa.ts`) is imported by **nothing**
  in the live server tree. The older compiled tree under
  `server/functions/lib/` has no render-generation route either.
- `client/src/pages/Results.tsx` — the page that *is* the product —
  fetches four endpoints that have never existed in any tree in this repo.
- `POST /api/render`'s legacy branch writes a hardcoded Pexels stock photo
  with `status: "completed"`.

**Why:** this is a Replit/Firebase-Studio-lineage codebase whose
documentation describes a deployed system, while the checkout carries a
partial tree plus build-output mirrors (`server/functions/`). Treating
`docs/` as a description of *this code* produces wrong effort estimates in
both directions — some "existing" features need building from scratch,
while other gaps turn out to be five thin handlers over a storage layer
that is already complete.

**How to apply:** when a question depends on what the existing app does,
**enumerate the routes actually registered** in `server/routes.ts` /
`routes-curalina.ts` / `routes-mapping-analysis.ts` and grep for real
imports, before quoting `docs/` or `replit.md`. Do not assume a file under
`server/services/` is reachable just because it exists. Conversely, check
`server/storage-curalina.ts` before estimating app-side work — it is far
more complete than the route layer.

See also [[feedback-verify-before-ruling]] and
[[primary-sources-live-outside-the-repo]].
