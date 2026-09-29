# Agent work packet: dead-code cleanup, pass 1

Scoped by `tech-lead`, 2026-09-29, from `docs/dead-code-audit/AUDIT.md`.
This is the only authority for what gets deleted in this pass. If this packet
and `AUDIT.md` disagree, this packet wins. `AUDIT.md` got two line totals
wrong (see "Corrections to AUDIT.md" below).

## Task

- Service: existing monolith (`client/`, `server/`). No `ai_services/` work.
- Phase: one-off hygiene pass. No behaviour change.
- Owner: `typescript-app-engineer`
- Reviewer: `code-reviewer`
- Branch: `chore/dead-code-audit-cleanup` (off `RJ-001`). Do not push, merge
  or rebase. Commit only if the dispatcher tells you to.

## Objective

Delete 19 files (9,996 lines) that have no importers. Reword 4 comments in
live files that name the deleted files. Add dated notes to STATUS.md and 2
ADRs. When you are done, `npm run check` must show **exactly 171** errors
(baseline is 206; 35 of those are in files this packet deletes). `npm run
build` must end in the same state as before you started.

## (a) Files to delete: the final, verified list

Before approving this list, `tech-lead` re-checked every file below with
`grep -rnE "[\"'/]<basename>([\"'.]|$)"` over `*.ts`, `*.tsx`, `*.js`,
`*.mjs`, `*.cjs` and `*.json`, excluding `node_modules`, `dist` and
`server/functions/`. I also ran `git grep` over every other tracked
non-Markdown file, grepped each file's exported symbols by name, and looked
for dynamic `import()`/`require()`. No file has a real importer. The only
hits were comments, and section (b) covers those. The only dynamic import
with a computed path (`upload-job-service.ts:279`) resolves to
`visual-analysis-job-service[-v2]`, which is unrelated.

Each quiz file exports only its own component (`export default function X`
or `export function X`). None of them exports a type, a props interface, a
constant or a context that something else uses. `Quiz.tsx` imports nothing
from any of them. Its quiz types and context come from
`@/contexts/QuizContext` and `@/components/quiz/Consult*`, which stay.

Legacy render stack (3 files, 7,282 lines). Nothing imports these, and
`server/routes.ts` has no route that reaches them (`ADR-0018` §C2):

1. `server/services/gemini-ai.ts` (3,423 lines). Legacy product-selection
   and render orchestration. Zero importers.
2. `server/services/openai-render.ts` (107 lines). Legacy DALL-E renderer.
   Zero importers.
3. `server/services/gemini-image-only-render.ts` (3,752 lines). Legacy
   Gemini renderer. Only two comments in `asset-import.ts` name it; see (b).

Pre-V2 quiz steps (7 files, 628 lines). A generation older than V2. Zero
importers:

4. `client/src/components/quiz/RoomTypeStep.tsx` (95)
5. `client/src/components/quiz/StyleStep.tsx` (54)
6. `client/src/components/quiz/BudgetStep.tsx` (68). One comment in
   `design-profile-mapper.ts` names it; see (b).
7. `client/src/components/quiz/FeaturesStep.tsx` (73)
8. `client/src/components/quiz/PreferencesStep.tsx` (64)
9. `client/src/components/quiz/VibeUploadStep.tsx` (137)
10. `client/src/components/quiz/FloorplanStep.tsx` (137)

V2 quiz steps (9 files, 2,086 lines). Consultation-1 replaced them
(`ADR-0021`). Zero importers:

11. `client/src/components/quiz/RoomTypeStepV2.tsx` (127)
12. `client/src/components/quiz/StyleSelectionStepV2.tsx` (198)
13. `client/src/components/quiz/ColorMaterialsStepV2.tsx` (457).
    `ADR-0018` §D1 used its palette ids as the atmosphere source. `ADR-0021`
    superseded that section (see its supersession table), so the file is not
    a kept reference.
14. `client/src/components/quiz/ColorPaletteStepV2.tsx` (175). `ADR-0018`
    already calls it dead.
15. `client/src/components/quiz/MaterialsStepV2.tsx` (249)
16. `client/src/components/quiz/FeaturesStepV2.tsx` (373)
17. `client/src/components/quiz/BudgetStepV2.tsx` (107). Comments in
    `design-profile-mapper.ts` and `consultationOptions.ts` name it; see (b).
18. `client/src/components/quiz/VibeCheckStepV2.tsx` (176)
19. `client/src/components/quiz/FinalStepV2.tsx` (224)

**Total: 19 files, 9,996 lines.** No directories are deleted. Use `git rm`
with these 19 exact paths. No globs: `*V2.tsx` is fine today, but it must
not become a habit in this directory.

### Keep-status check

`tech-lead` grepped `agent_instructions/STATUS.md` and `architecture/adr/`
for every filename above. No document treats any of these files as an
intentionally kept reference implementation. The documents that cite them
fall into two groups:

- Point-in-time evidence citations: `ADR-0018` lines 46, 58-61, 121-122 and
  372; `ADR-0021` line 146; STATUS item 20; STATUS lines ~956-966 and
  ~1031-1032.
- Statements that the files are orphaned or dead.

Both groups become historical once the files are gone. Section (d) handles
them with dated notes and does not rewrite them.

### Corrections to AUDIT.md (recorded here, not edited there)

- Bucket 1's "Subtotal: 8058 lines" is wrong. The 9 files listed sum to
  **4,158**.
- The "~610 total" for the 9 V2 files is wrong. `wc -l` gives **2,086**.
- `AUDIT.md` missed 3 comment references to deleted files:
  `design-profile-mapper.ts:82,84`, `consultationOptions.ts:94` and
  `Quiz.tsx:32-34`. None of them is an import, so no file comes off the
  list. The rewording tasks are in (b).

## (b) Comment rewords in live files (comment-only, no code change)

A comment must not name a file that no longer exists. Each task below
changes comment text only. If your diff touches any non-comment token in
these files, you went too far.

1. **`server/services/ai-adapter/asset-import.ts` lines ~17-19 and ~34-37.**
   Both comments name `gemini-image-only-render.ts`.
   - Line ~19: replace "`server/services/gemini-image-only-render.ts`'s
     `fetchImageAsBase64`" with "the legacy `fetchImageAsBase64` helper
     (formerly in `server/services/gemini-image-only-render.ts`, removed in
     the 2026-09-29 dead-code cleanup)".
   - Lines ~34-37: change "The existing app's own code that reads product
     image *bytes* today — `fetchImageAsBase64` in
     `gemini-image-only-render.ts` — treats ... and falls back" to the past
     tense: "The legacy code that read product image *bytes* —
     `fetchImageAsBase64` in the since-removed `gemini-image-only-render.ts`
     (recoverable at commit `<PIN>`, see below) — treated ... and fell
     back". Leave the rest of the paragraph alone. The precedent it records
     still holds.
2. **`server/services/ai-adapter/design-profile-mapper.ts` lines ~81-84.**
   - Replace "comma-thousands form used by
     `client/src/components/quiz/BudgetStepV2.tsx`" with "comma-thousands
     form stored by the live quiz (`INVESTMENTS` in
     `client/src/components/quiz/consultationOptions.ts`) and by the removed
     pre-consultation `BudgetStepV2`, so older `quiz_responses` rows carry
     it too".
   - Replace "id form from `client/src/components/quiz/BudgetStep.tsx`" with
     "id form from the removed pre-V2 `BudgetStep` component (older rows
     only)".
   - The parser does not change. Stored rows still contain both formats.
3. **`client/src/components/quiz/consultationOptions.ts` line ~94.** Replace
   "(BudgetStepV2 style)" with "(comma-thousands `$X,XXX-$Y,YYY` form, parsed
   by `server/services/ai-adapter/design-profile-mapper.ts`)".
4. **`client/src/pages/Quiz.tsx` lines ~32-34.** Delete the three-line
   comment that begins "The V2 step components ... remain in the repo".
   After this pass that statement is false. Git history is the record.

## (c) Verification: required before and after, with numbers in your report

Run these **before** deleting anything and save the output:

```bash
git rev-parse HEAD                 # this is <PIN>, the last commit that contains the 19 files
npm run check 2>&1 | grep -c "error TS"          # expect 206
npm run check 2>&1 | grep "error TS" | sed -E 's/\(.*//' | sort | uniq -c > <scratch-dir-outside-repo>/tsc_before.txt
npm run build; echo "build exit=$?"
```

`tech-lead` measured the baseline on 2026-09-29 at `9a05d5c`: **206 errors,
35 of them in files this packet deletes**. The 35 break down as 19 in
`gemini-ai.ts`, 15 in `gemini-image-only-render.ts` and 1 in
`openai-render.ts`. None of the 16 quiz files has an error.

Run the same commands **after** the deletions and the (b) edits.

Acceptance:

- `npm run check` shows **exactly 171** errors (206 - 35).
- The per-file breakdown of the 171 matches the baseline breakdown exactly,
  minus the 3 deleted server files.
- `npm run build` exits with the same code it exited with before. If it
  passed before, it must pass after.
- A final grep (the (a) pattern, all 19 basenames) returns zero hits in
  `*.ts`/`*.tsx` outside `server/functions/`.

**Stop rules. Do not work around any of these.**

- An error count above 171.
- Any error that was not in the baseline.
- Any `Cannot find module` or `TS2307` naming a deleted path.
- A build that fails where it previously passed.

Any of these means `tech-lead`'s verification missed a live reference. Do
not add a stub, a shim, a `// @ts-ignore`, or a re-created file to get past
it. Restore the file (`git restore --staged --worktree <path>`), leave it
off the list, and report the exact error. A count below 171 is not a
failure, but it is unexpected, so explain it before you claim done.

`npm run build` copies `dist/*` into `server/functions/dist/`. Git ignores
that path, so the copy is expected. Do not stage it, and do not "fix" the
build script. That script belongs to the `server/functions/` question, which
is out of scope.

## (d) Doc-accuracy pass (dated notes, no rewrites)

Once the files are gone, add short dated notes. Do not rewrite decision
text or change historical `file:line` citations. Those citations stay
resolvable at `<PIN>` (`git show <PIN>:<path>`).

1. **`agent_instructions/STATUS.md`, operational section only** (above
   `# SESSION HISTORY (ARCHIVE)`):
   - Item 20 row: after the `ColorMaterialsStepV2.tsx:16-58` citation, append
     "(file deleted 2026-09-29; cite at `<PIN>`; `ADR-0021` superseded that
     half of item 20 anyway)".
   - Implementation guidance, the paragraph at ~line 956-966 ("Two traps.
     `ColorPaletteStepV2.tsx` is **dead code**..."): append one sentence:
     "2026-09-29: both V2 files deleted in the dead-code cleanup (item 36);
     cite at `<PIN>`."
   - Implementation guidance, the paragraph at ~line 1031-1032 (the legacy
     render-stack list): append one sentence: "2026-09-29:
     `openai-render.ts` and `gemini-image-only-render.ts`, plus
     `gemini-ai.ts`, deleted (item 36); the rest of this list is still
     present."
   - Mark item 36 in the dispatch table as done, with your before/after
     numbers.
   - **Do not edit the archive section.**
2. **`architecture/adr/ADR-0018-end-to-end-demo-scope-and-the-four-chain-breaks.md`**:
   append one dated note at the end of the file. Do not edit inline. Use this
   text: "Post-decision note (2026-09-29): `ColorMaterialsStepV2.tsx`,
   `ColorPaletteStepV2.tsx`, `openai-render.ts` and
   `gemini-image-only-render.ts` cited above were deleted in the dead-code
   cleanup (`docs/dead-code-audit/CLEANUP-PACKET.md`). Citations remain
   valid at commit `<PIN>`."
3. **`architecture/adr/ADR-0021-consultation-1-quiz-and-flow-changes.md`**:
   append the same kind of note at the end, covering `FeaturesStepV2.tsx`
   (line 146) only.
4. Do **not** touch `architecture/PROJECT_MAP_AND_UNDERSTANDING.md`,
   `docs/CURALINA_FULL_DOCUMENTATION.md`, `docs/consultation-1/EXTRACTION.md`,
   or `docs/dead-code-audit/AUDIT.md`. They are historical or
   original-pack documents, and correcting them is not part of this pass.

## (e) Out of scope. Restated on purpose; do not "helpfully" include these

- **`server/functions/`, the whole directory, including
  `server/functions/lib/server/services/gemini-ai.js`,
  `openai-render.js`, `gemini-image-only-render.js` and their `.map`
  files.** They share names with files you are deleting. They are compiled
  output inside a possible separate Firebase deployment, and the project
  owner has not decided on it. Do not touch a single file under this path.
- **Both LoRA notebooks:**
  `ai_services/room_generator/notebooks/sd15_lora_products_in_rooms_colab.ipynb`
  (the owner's own edited copy, commit `9a05d5c`) and
  `ai_services/room_generator/notebooks/learning/sd15_lora_products_in_rooms_colab.ipynb`.
  Do not delete them, move them, dedupe them or open them for edits.
- **`package.json`**, including the `build` script's
  `server/functions/dist` copy step.
- **Assets imported only by the deleted V2 components**
  (`attached_assets/generated_images/*`, `attached_assets/stock_images/*`)
  will be orphaned after this pass. Leave them. They go in a later sweep.
- **Other legacy render-stack files** named in `ADR-0018` §C2
  (`stability-ai-render.ts`, `stability-inpainting-render.ts`,
  `hybrid-compositing.ts`, `room-composite-service.ts`, `render-qa.ts`,
  `spatial-fit-validator.ts`), plus `server/webSocket.ts` and
  `server/progress-emitter.ts`. They are not verified in this packet.
- **`server/services/stability-ai-qc.ts`** loses its only importer
  (`gemini-ai.ts`) in this pass. It becomes a Bucket-2 candidate for the
  next pass. Do not delete it now.

## Allowed files

- `git rm` of exactly the 19 paths in (a).
- Comment-only edits to: `server/services/ai-adapter/asset-import.ts`,
  `server/services/ai-adapter/design-profile-mapper.ts`,
  `client/src/components/quiz/consultationOptions.ts`,
  `client/src/pages/Quiz.tsx`.
- Append-only notes in: `agent_instructions/STATUS.md` (operational section
  only), `ADR-0018`, `ADR-0021`.

Nothing else.

## Completion evidence (what your report must contain)

- `<PIN>` SHA.
- Before/after `npm run check` error counts and whether the per-file
  breakdowns match.
- Before/after `npm run build` exit codes.
- The final grep output, which should be empty.
- `git status --short`, which should show exactly 19 `D` lines and
  modifications to the 4 source files and 3 docs above.

## Reversal

Everything happens on an isolated branch. `git revert` the cleanup commit,
or recover a single file with `git checkout <PIN> -- <path>`. The decision
is wrong if anything proves one of these files had a live consumer: a
runtime error in the monolith that names one of them, or a build or check
failure under the stop rules in (c). In that case restore the file and
record the missed reference in `AUDIT.md`'s Limitations.
