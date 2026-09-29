# Archived: 2026-09-29 dead-code cleanup

These 19 files were removed from the live codebase in commit `9a6a676`
("Dead-code cleanup pass 1") because nothing in the running app imported
them anymore. They're kept here, verbatim, instead of only living in git
history — so anyone can see exactly what existed without needing to check
out an old commit, and so restoring one is a copy, not an archaeology dig.

**Nothing here runs.** This folder is excluded from the TypeScript build
(see the root `tsconfig.json` `exclude` entry) and from the app's routes.
It is documentation, not a second copy of the app.

Full investigation trail, including why each file was judged dead and what
was independently re-verified before deletion:
- [`docs/dead-code-audit/AUDIT.md`](../../docs/dead-code-audit/AUDIT.md) — the findings
- [`docs/dead-code-audit/CLEANUP-PACKET.md`](../../docs/dead-code-audit/CLEANUP-PACKET.md) — the scoped removal packet
- Commit `9a6a676` — the actual removal, with full before/after verification numbers in the commit message
- Commit `9a05d5c` — the last commit where these files were live (`git show 9a05d5c:<path>` also recovers any of them)

## What's here

### Legacy render stack (`server/services/`) — 3 files, 7,282 lines

Already unreachable from `server/index.ts` before this cleanup — flagged as
"orphaned" in `ADR-0018` §C2. Superseded by the AI-services render path
(`server/services/ai-adapter/render-orchestrator.ts`).

- `gemini-ai.ts` (3,423 lines) — legacy product-selection and render
  orchestration against the Gemini API.
- `openai-render.ts` (107 lines) — legacy DALL-E renderer.
- `gemini-image-only-render.ts` (3,752 lines) — legacy Gemini-only renderer.
  Its `fetchImageAsBase64` helper is cited (not imported) from
  `server/services/ai-adapter/asset-import.ts` as prior art for how the
  live code should treat image-byte fetching.

### Quiz step components (`client/src/components/quiz/`) — 16 files

Two superseded generations of the quiz UI. Both were already dead before
this cleanup, per an existing comment in `client/src/pages/Quiz.tsx`.

**Pre-V2 originals** (7 files, 628 lines) — the oldest generation:
`RoomTypeStep.tsx`, `StyleStep.tsx`, `BudgetStep.tsx`, `FeaturesStep.tsx`,
`PreferencesStep.tsx`, `VibeUploadStep.tsx`, `FloorplanStep.tsx`.

**V2 set** (9 files, 2,086 lines) — replaced by the Consultation-1 quiz
rebuild (`ADR-0021`): `RoomTypeStepV2.tsx`, `StyleSelectionStepV2.tsx`,
`ColorMaterialsStepV2.tsx`, `ColorPaletteStepV2.tsx`, `MaterialsStepV2.tsx`,
`FeaturesStepV2.tsx`, `BudgetStepV2.tsx`, `VibeCheckStepV2.tsx`,
`FinalStepV2.tsx`. The live quiz today is `client/src/components/quiz/Consult*.tsx`
plus `consultationOptions.ts`, driven from `client/src/pages/Quiz.tsx`.

## How to restore a file

**Just want to look at it or copy a snippet?** It's already sitting right
here at its archived path — open it directly, nothing to restore.

**Want it back in the live tree, importable again?**

```bash
# from the repo root
cp archive/dead-code-2026-09-29/<path> <path>
# e.g.
cp archive/dead-code-2026-09-29/server/services/gemini-ai.ts server/services/gemini-ai.ts
```

Then re-wire it in:
1. Add back whatever `import` line used to pull it in (check the removal
   commit's parent, `9a05d5c`, for the exact original import site —
   `git show 9a05d5c -- <the file that used to import it>`).
2. Run `npm run check` — a restored file that references something *else*
   that was also archived will show up immediately as a missing-module
   error; restore that file too.
3. If restoring one of the three `server/services/` render files, check
   whether it needs an API key env var (`GEMINI_API_KEY`, `OPENAI_API_KEY`)
   that may no longer be documented in `.env.example` — check the archived
   file's own top-of-file imports/usage for which one.
4. Run `npm run build` and click through the affected flow in a browser
   before trusting it — the same verification standard used to remove it
   in the first place.

**Want the whole cleanup undone instead of one file?**

```bash
git revert 9a6a676
```

This restores all 19 files to their live paths in one commit and reverts
the 4 comment rewords and 3 doc notes made alongside the deletion.
`archive/dead-code-2026-09-29/` would then hold a redundant second copy —
delete this folder in the same revert if you go this route.
