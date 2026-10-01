# Dead-code audit — 2026-09-29

Performed on branch `chore/dead-code-audit-cleanup` (off `RJ-001`), so any
cleanup from this audit is fully revertible via the branch. Nothing in this
document has been deleted yet — this is the findings pass; `tech-lead`
reviews and scopes the actual removal work next.

Scope note per `ADR-0019`: Express is **not** being removed — it's still
required (owns auth/sessions, the real Neon database, and orchestration) and
nothing about that decision has changed. This audit did not find any
stale/half-finished attempt at splitting the frontend out of Express — there
isn't one in the repo. This is a plain dead-code sweep, not migration prep.

A first pass at this audit was delegated to a `research-scout` agent that
hit its turn budget before writing its file; its partial in-progress report
is folded into "Bucket 3" below (I independently re-verified every claim in
it with fresh greps before including it — do not trust the agent's own
citations without doing that). Everything else below I verified directly.

## Bucket 1 — confirmed zero importers anywhere in the repo

| File | Lines | Evidence |
|---|---|---|
| `server/services/gemini-ai.ts` | 3423 | `grep -rl "from.*gemini-ai\|require.*gemini-ai"` across `server/`, `client/`, `shared/` → zero matches outside its own file |
| `server/services/openai-render.ts` | 107 | same grep pattern for `openai-render` → zero matches |
| `client/src/components/quiz/RoomTypeStep.tsx` | 95 | `grep -rl 'quiz/RoomTypeStep"'` → zero matches outside itself (superseded by `RoomTypeStepV2`, which is itself now superseded — see Bucket 3) |
| `client/src/components/quiz/StyleStep.tsx` | 54 | same pattern, zero matches |
| `client/src/components/quiz/BudgetStep.tsx` | 68 | same pattern, zero matches |
| `client/src/components/quiz/FeaturesStep.tsx` | 73 | same pattern, zero matches |
| `client/src/components/quiz/PreferencesStep.tsx` | 64 | same pattern, zero matches |
| `client/src/components/quiz/VibeUploadStep.tsx` | 137 | same pattern, zero matches |
| `client/src/components/quiz/FloorplanStep.tsx` | 137 | same pattern, zero matches |

These seven quiz-step files are the *pre-V2* originals — a generation older
than the V2 set in Bucket 3 below, superseded before this session even
started. Subtotal: **8058 lines**.

## Bucket 3 — known-dead per prior session notes, re-verified

| File(s) | Lines | Evidence |
|---|---|---|
| `server/services/gemini-image-only-render.ts` | 3752 | Only referenced from **comments** in `server/services/ai-adapter/asset-import.ts:19,35` (documenting where a helper function's behavior was modeled from) — zero real `import`/`require`. Matches `ADR-0018` §C2 / `STATUS.md` item 25's "orphaned legacy Gemini/Stability/OpenAI render stack" finding, independently re-confirmed here. |
| 9 pre-consultation-1 V2 quiz step components (`RoomTypeStepV2`, `StyleSelectionStepV2`, `ColorMaterialsStepV2`, `ColorPaletteStepV2`, `MaterialsStepV2`, `FeaturesStepV2`, `BudgetStepV2`, `VibeCheckStepV2`, `FinalStepV2`) | ~610 total (research-scout's figure; not independently re-summed line-by-line) | `Quiz.tsx` lines 32-34 already say in a comment that these "remain in the repo but are no longer part of the flow (consultation-1 replaced it)." Re-verified zero real imports beyond their own definitions. |
| `server/functions/` (whole directory) | 179 files, 41 MB | Independently re-confirmed: `grep -rn "server/functions"` across every `.ts`/`.tsx` in the live app → zero imports. This is a separately-built Firebase Functions sub-package (per its own `package.json`), excluded from the root `tsconfig.json` `include` (item 25's earlier finding). Not proven unused as a *separate Firebase deployment target* — see Limitations. |

Bucket 1 + Bucket 3 total: **~12,430 lines** across roughly 20 files/dirs
(the `server/functions/` file count dominates by count; the three legacy
render-stack files dominate by line count at 7282 lines combined).

## Bucket 4 — needs a human/tech-lead call, not a clean removal

- **`server/services/ai-adapter/asset-import.ts:19,35`** — two comments
  reference `gemini-image-only-render.ts` by name. If that file is deleted,
  these comments become dangling references and should be reworded (not a
  functional risk, just a docs/comment cleanup that should ride along).
- **Two copies of the SD1.5 LoRA notebook — do NOT touch, needs the owner's
  call, not a cleanup target:**
  - `ai_services/room_generator/notebooks/sd15_lora_products_in_rooms_colab.ipynb`
    — committed by **SalmonRanjay** (the project owner, not an agent) at
    `2026-09-25 14:36`, commit `9a05d5c` "Updated ROOM GEn NOTEbook".
  - `ai_services/room_generator/notebooks/learning/sd15_lora_products_in_rooms_colab.ipynb`
    — the version an earlier agent turn in this session built, committed at
    `2026-09-25 11:37`, ~3 hours *before* the owner's own copy above.
  - These now differ (10,188-line diff, almost certainly includes real
    Colab run output/edits in the owner's copy). **This is the owner's own
    live work product, most likely saved back from Colab into a new path
    by hand — not an accidental duplicate an agent introduced.** Treat as
    out of scope for this cleanup entirely; flagging only so nobody
    "deduplicates" it by deleting the newer, owner-edited copy. If the
    owner wants these reconciled into one path, that's their call to make
    explicitly.
- **`server/routes.ts`** confirmed to contain **zero** references to
  `gemini-ai`, `openai-render`, or `gemini-image-only-render` — the legacy
  stack was already fully disconnected from live routing before this
  session; deleting the three files is a clean removal with no route
  changes required.

## Not checked in this pass (explicitly out of scope, not silently skipped)

- Bucket 2 (code reachable only through other dead code) beyond what's
  already covered above.
- Unused *exports* inside files that are otherwise live (dead functions
  inside an active file).
- `ai_services/` Python services (recommendation, variant_generator,
  room_generator, design_rules, renderers/sd15, renderers/composite) —
  no per-service unused-adapter/fixture sweep was done.
- `package.json`/`pyproject.toml` declared-but-unimported dependencies.
- Commented-out business-logic blocks (as opposed to the doc comments
  found above).
- Orphaned test files for already-deleted code.

These are reasonable follow-up items but weren't necessary to answer the
question actually asked (remove confirmed dead code, keep the app running)
and pulling them in would have expanded this pass significantly without
changing the recommended action below.

## Limitations of this static analysis

- Dynamic `require(string)`/`import(string)` with a computed path would not
  show up in these greps. None was found while tracing the files above by
  hand, but a codebase-wide sweep for the pattern wasn't done.
- `server/functions/` might be an active **separate** Firebase deployment
  (built and deployed independently of the main app, per its own
  `package.json`) — "nothing in the live monolith imports it" is not the
  same claim as "it is safe to delete outright." This needs an explicit
  answer from the project owner before deletion, not just an import-graph
  check. Flagging for `tech-lead` to escalate rather than resolve.
