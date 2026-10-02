# Archived 2026-10-02

Second dead-code pass (see `archive/dead-code-2026-09-29/README.md` for the
first), plus the old Firebase/Cloud Build deployment setup — removed
because the owner confirmed the GCP deployment is being built from scratch
(see `ADR-0022`/`ADR-0023`/`ADR-0024`), so there was no reason left to chase
down who owned the old `curalina-git-2` Cloud Run service or keep its
config around.

Nothing here is deleted from git history — this is a move, not a delete.
`tsconfig.json` excludes `archive/**` from the TypeScript build.

## What's here and why

**`server/services/*.ts`** (19 files, ~8,305 lines) — the pre-AI-services
image pipeline (Stability AI direct calls, custom room compositing, custom
visual QA/analysis). Confirmed dead by tracing actual reachability from the
app's one entrypoint (`server/index.ts` → `registerRoutes` in
`server/routes.ts`) rather than just checking for zero importers per file —
this whole set forms its own disconnected island: they import each other,
but nothing in the live route tree (`routes.ts`, `routes-curalina.ts`,
`routes-mapping-analysis.ts`, `storage.ts`, `storage-curalina.ts`,
`services/ai-adapter/**`) imports any of them. Superseded by the Python AI
services (`ai_services/recommendation`, `ai_services/room_generator`,
`ai_services/variant_generator`) and the `ai-adapter` integration layer.

**`server/functions/`** (~46MB) — a separate, stale Firebase Cloud
Functions build (its own compiled `routes.js`/`storage.js`/`index.js`,
wired via `firebase.json`'s `/api/**` rewrite to a function named `api`).
It was already out of date — it still contained `gemini-ai.js`, which was
deleted from the live app in the 2026-09-29 cleanup. Nothing in this
repo's history confirmed it was actually deployed anywhere live.

**`firebase.json`, `.firebaserc`, `cloudbuild.yaml`** — the deployment
config that pointed at the above. `cloudbuild.yaml` was tied to a Cloud Run
service called `curalina-git-2` in a project this session never identified
the owner of (see `git log` on that file if you need to chase that down
later — author `Design44inc`, repo `CuralinaTech/curalina`, 2026-02-28).
Moot now that the GCP deployment is being built from scratch.

## To restore any of this

```bash
git mv archive/dead-code-2026-10-02/<path> <original-path>
```

Original paths are exactly what's under `archive/dead-code-2026-10-02/`,
minus that prefix (e.g. `archive/dead-code-2026-10-02/firebase.json` →
`firebase.json`, `archive/dead-code-2026-10-02/server/functions/` →
`server/functions/`).

If restoring `server/services/*.ts`, also re-add `server/functions/**` back
to `tsconfig.json`'s `exclude` list if you're restoring `server/functions/`
too (it was removed from `exclude` in this same commit since the directory
no longer existed at that path) — and restore the
`mkdir -p server/functions/dist && cp -r dist/* server/functions/dist/`
tail end of the `build` script in `package.json` if you're bringing back a
live Firebase Functions deployment target.
