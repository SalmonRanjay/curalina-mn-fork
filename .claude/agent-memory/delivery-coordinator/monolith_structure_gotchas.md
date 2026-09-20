---
name: monolith-structure-gotchas
description: Non-obvious structural facts about the existing TypeScript monolith, needed before writing any packet that touches server/, client/, or shared/
metadata:
  type: project
---

Two facts about `curalina`'s existing Express/Drizzle monolith that are easy
to get wrong when writing a work packet, discovered while decomposing the
UI adapter (A5) into `UI-A5-01/02/03`:

1. **`shared/schema.ts` is the live schema, not `shared/schema-curalina.ts`.**
   `server/db.ts` and `server/storage.ts` both import from `"@shared/schema"`.
   `shared/schema-curalina.ts` is a separate, differently-shaped file used
   only by some `client/src/pages/*` and `server/storage-curalina.ts` — it
   is not wired to the database. `quizResponses`, `products`, `renders`,
   `selectionLedger` all live in `schema.ts`. Similarly `server/routes.ts`
   (registered via `registerRoutes()` in `server/index.ts`) is the live
   route table; `server/routes-curalina.ts` is an unused stub.
   **Why:** a packet that cites `schema-curalina.ts` or `routes-curalina.ts`
   as the mapping target would build against dead code.
   **How to apply:** any packet touching quiz/product/render/ledger data
   must name `shared/schema.ts` and `server/routes.ts` explicitly, and should
   flag the schema-curalina.ts/routes-curalina.ts trap for the engineer the
   same way `UI-A5-01` does.

2. **There is no test runner configured in the monolith.** No vitest, no
   jest, no `test` script in `package.json` (only `dev`, `build`, `start`,
   `check` = `tsc`, `db:push`). The one precedent for a "test" file,
   `server/services/budget-allocation.test.ts`, is a hand-run script
   invoked with `npx tsx <file>.test.ts` that just logs — no assertion
   framework.
   **Why:** "existing tests pass unchanged" as done-evidence language (used
   throughout `agentic_flow/ui_adapter_workflow.md`) cannot mean a test
   suite run — there isn't one.
   **How to apply:** for any packet in this codebase, name `npm run check`
   (tsc) plus a new `npx tsx`-style manual script following
   `budget-allocation.test.ts`'s shape as the actual checkable commands.
   Don't let a packet imply `npm test` exists.

3. **`server/storage-curalina.ts` is live, despite its name suggesting it
   pairs with the dead `shared/schema-curalina.ts`.** It does not — it
   imports from `@shared/schema` (the live schema, confirmed at its own
   import block) and operates through `getDb()`. It is the actual storage
   class `server/routes.ts` calls as `curalinaStorage` for
   `quizResponses`/`renders`/`products` (`getQuizResponse`, `getProduct`,
   `getProductBySku`, `createRender`, etc.) — it is not the same kind of
   dead code as `schema-curalina.ts`/`routes-curalina.ts`.
   **Why:** an earlier session's shorthand ("storage-curalina.ts pairs
   with the unused schema-curalina.ts") was wrong on this specific file
   and could mislead a packet into treating it as unused or avoiding it.
   **How to apply:** when a packet needs to read or persist
   `quizResponses`/`renders`/`products`/`selectionLedger`, point it at
   `curalinaStorage` (from `storage-curalina.ts`), not `storage.ts` —
   check which methods actually exist on `curalinaStorage` before assuming
   one does.
4. **The one real route that generates a render for a quiz submission is
   `POST /api/render` in `server/routes.ts` (not `/api/quiz`, which only
   persists the quiz row).** Confirmed by reading the actual frontend
   callers, not by trusting workflow-doc prose: `client/src/pages/Quiz.tsx`
   (initial submission, needs `render.id` in the response to navigate) and
   `client/src/pages/Results.tsx` (regenerate-after-swap) both call this
   route. `Loading.tsx` then polls `GET /api/render/:id`/`GET
   /api/render/latest` for a `Render`-shaped body every 2s.
   **Why:** matters for any future packet that wires a real backend call
   into this route — get the exact handler and its two real callers right
   before writing "the render/recommendation route" as if it were
   self-evident.

See [[decomposing-flat-workflow-docs-into-packets]] for the packeting
approach this was used in.
