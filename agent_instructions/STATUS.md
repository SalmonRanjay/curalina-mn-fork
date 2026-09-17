# Build status — Curalina future-state services

**This file has two parts.**

1. **The operational reference** (below, through "Known defects noticed, not
   acted on") — everything needed to dispatch the next unit of work. It is
   self-sufficient. Read it and stop.
2. **Session history (archive)** — the reasoning behind past decisions.
   Read it only when you need to know *why* something was decided, or when
   an ADR's reasoning depends on a figure recorded here.

Nothing in the archive is live guidance. If the two parts disagree, the
operational reference wins.

---

# OPERATIONAL REFERENCE — current as of 2026-09-17 (session 19)

## Session 19 (2026-09-17) — fixed the stuck-loading-screen bug

The project owner reported the app gets stuck waiting for a room render
after quiz submission, and suspected a websocket connection. Both were
real, and are now fixed (`client/src/pages/Loading.tsx`):

1. **The actual hang.** `Loading.tsx`'s redirect effect only treated
   `render.status === 'completed' || 'failed'` as terminal. Every AI-path
   render today lands on `needs_input` (item 20, the `atmosphere` mapping
   gap, is still open) — polling correctly fetched `needs_input` every 2s,
   but the page never redirected, so the spinner ran forever. Fixed by
   adding `needs_input` to the terminal-status check; it now redirects to
   `Results.tsx`'s existing honest `needs_input` state (built session 18)
   within one poll interval.
2. **The websocket.** Confirmed genuinely dead code: `server/webSocket.ts`
   / `server/progress-emitter.ts` are never imported by `server/index.ts`
   — leftovers from the orphaned legacy Gemini render stack item 25
   already identified as unreachable. The client's `new WebSocket(...)`
   call in `Loading.tsx` always failed to connect (nothing on the server
   accepts it); it degraded silently to polling, so it wasn't the actual
   cause of the hang, but it was dead, misleading code and has been
   removed rather than wired up — a server-side poller (item 22) is
   already the documented design, not a websocket. The progress bar now
   animates on a simple client-side timer instead of live server pushes.

Independently re-verified live end to end after a full `docker compose up
-d --build app`: register → dashboard → quiz → submit → **redirects
within seconds** (previously hung indefinitely) → honest "More Info
Needed" state. Browser console confirmed no websocket errors remain.

**Also logged as explicit future work per the project owner's request,
not started:** redirect straight to the dashboard after quiz submission
instead of a blocking loading page, with the render's job status shown as
a small loading indicator on its dashboard card until the (still-to-be-
built) backend poller resolves it — tracked as new dispatch item 26,
blocked on item 22.

## Session 18 (2026-09-17) — post-auth dashboard, two live bugs found and fixed, Express question answered

*Full detail in the archive entry below and in `ADR-0019`. Summary for
dispatch purposes:*

**UI flow rebuilt per the project owner's direct request.** The app no
longer behaves like a single landing page. `register`/`login` now redirect
to `/my-dashboard` (not `/`); the quiz moved off the dashboard entirely —
the dashboard shows a "Start Quiz" entry point plus a card per past render,
and clicking a card opens its real detail state. The old thinner
`dashboard.tsx` and a duplicate `use-auth.tsx` hook were deleted (6
importers repointed at the canonical `useAuth.ts`). `/dashboard` now
redirects to `/my-dashboard`.

**Two real defects found by driving the live UI myself (browser
automation, real screenshots, not a subagent's self-report), fixed the
same session:**
- `server/localAuth.ts` session cookie was `secure: NODE_ENV ===
  "production"`, which silently drops the cookie when testing prod mode
  over plain HTTP (the browser refuses to store a `Secure` cookie set over
  HTTP). Registration succeeded server-side but left the user logged out.
  Fixed to `secure: "auto"`, which resolves per-request via `req.secure`
  and `trust proxy` — still a real `Secure` cookie behind Firebase's HTTPS
  load balancer in production.
- `client/src/pages/Results.tsx` had no branch for `render.status ===
  'needs_input'` — it fell through to the completed-render UI and rendered
  a broken `<img>` (`imageUrl` is null in that state). Added a
  `needs_input` branch mirroring the existing `failed` branch.

**Also closed a real DB drift gap, independent of the two bugs above.**
Item 10c (session 16) added `renders.aiServiceRef` to `shared/schema.ts`
but that migration was never generated or applied to the live Neon
database — every `POST /api/render` 500'd with `column "ai_service_ref" of
relation "renders" does not exist`. `drizzle-kit push` was correctly
avoided (it would have silently dropped 11 live columns not present in
`schema.ts`: `renders.rating`/`rating_feedback`/`rated_at`,
`users.duo_*`, five `documentation_sections` columns). Used `drizzle-kit
generate` instead (diffs against local snapshot history) — produced
`migrations/0003_demonic_magus.sql`, reviewed, then applied.

**Auth profile gap closed.** `POST /api/auth/register` previously returned
only `{id, email, role}` after collecting `firstName`/`lastName` — now
returns the full profile, matching what `POST /api/auth/login` already
returned.

**Live-verified end to end**, register through the known `atmosphere`
`needs_input` wall (item 20 — unchanged, still the next real blocker):
register → auto-login → dashboard → "Start Quiz" → all 7 quiz steps →
submit → render row created (`needs_input`, expected) → dashboard shows an
honest entry (correct room/style metadata, no fake photo) → click through
→ honest "More Info Needed" state, not a broken image.

Committed as `5927e74`.

**The Express question, asked directly by the project owner, is answered
in `ADR-0019`: no, Express is not removable today.** It is the only place
identity/sessions, the real product/user/cart/order database, and the
recommendation→rooms orchestration exist — none of the three Python
services replicate any of that, by design (`AGENTS.md`'s "separate
services, separate databases" rule). `ADR-0019` documents what a
decommissioning path would look like *if* that ever changes, explicitly as
reference material, not as an approved or scheduled piece of work — the
project owner was explicit that execution waits until the system reaches a
stable, fully-working state first. That means items 19-24 below, not this.

## Read this first: what stands between us and a demo you can click through

*Added 2026-09-16 in answer to the project owner's direct question. Plain
terms, no jargon. The full reasoning and the exact file/line evidence for
every claim here is in `ADR-0018`.*

**The short answer.** The three Python services are real and work. The
existing web app is real and works. **They are not actually joined up yet,
and there are four separate places where the chain breaks.** Each one on
its own is enough to stop the flow, which is why nothing appears to happen
when you click through. None of the four is hard, and none of them needs
client data, a model, or a GPU. Separately, there is a fifth problem that
*is* blocked on you, and it is the room picture.

**What you can honestly demo once items 18-25 are done — three surfaces:**

1. **The quiz, producing real product recommendations.** You answer the
   quiz, the recommendation service reads the real Four Hands / Moe's
   catalogue, and the results page shows real products with real prices and
   real photographs. This is the biggest piece and it is entirely
   buildable now. It is probably most of what you mean by "the product".
2. **`/admin/product`: upload a product photo, recolour it, accept it.**
   You upload a real photograph, someone draws the mask by hand, the
   service produces a genuinely recoloured image — real pixels, changed
   only inside the mask — you review it, and you accept it into the
   catalogue. The service side of this is finished. Only the admin screen
   is missing.
3. **The room render — as a progress state, with no picture.** This one is
   honest but disappointing, and you should know that going in.

**What is blocked on you, and why the room picture is the hard one.**
The room generator has **no image-producing code at all**. Not a weak one,
not a low-quality one — none. When a room job "succeeds" today it returns
the name of a picture that was never made. Building a real one needs
photographs of real rooms with measurements (`OQ-010`), which we have asked
for and not received. **Until then the demo will show the room job running
and finishing, and will say plainly that the picture isn't built yet.**

We are deliberately not filling that hole with a stock photo. One is in
there today — the current code writes a Pexels stock photograph and marks
it "completed" — and item 23 removes it. That is a regression you will
notice, and it is intentional: showing a stock photo as if it were your
generated room is the one thing that would make every other number in this
project untrustworthy.

**Two questions only you or the client can answer, both cheap, both
blocking:**

- **Are prices USD or CAD?** The app sends USD; the recommendation service
  prices in CAD. One is wrong. One sentence from you unblocks item 20.
- **Room photographs (`OQ-010`).** The full ask is in "What needs the
  client" item 1 below. Nothing about room images moves without it.

**What we found this session that nobody had recorded.** The results page —
the screen that *is* the product — asks the server for four things
(the product list, the reasoning ledger, individual products, swap
alternatives) and **not one of those four endpoints has ever existed** in
this codebase. That is why the page looks empty. The database work behind
them is already done and tested; it is about five small handlers. That is
item 21, and it is the cheapest, highest-value work in the whole backlog.

## Where things stand

Four Python packages exist and are verified green: `curalina_design_rules`
(83 tests, 92% branch), recommendation (264 unit / 91% / 17 contract),
variants (126 unit / 92% branch / 27 contract / 10 integration), rooms (108
fast tests / 93% branch / contract suite unchanged), plus the root contracts
suite (10 tests, up from 7). All are Ruff and `mypy --strict` clean and no
module sits at 0% coverage.

**All three services now have complete A3 done-evidence, not just A3
engineering** — recommendation and rooms since session 9, variants closed
this session (`VAR-A3-02`): the cancellation-race bug integration tests
exposed was a real TOCTOU defect, now fixed with a transactional
claim/completion re-check, plus a labelled-fake output-asset persistence
path so the "write succeeds, commit fails" durability case is testable.
`sqlite_store.py` moved 77% → 82% (unit+integration combined).

**All three services now genuinely participate in
`make -C ai_services run-suite`** over public HTTP — the "rooms deferred"
branch is gone. A real leaked-process bug (partial-startup failure skipped
`finally`-block cleanup for already-started services) was found and fixed
in the same pass that wired rooms in.

Rooms also has four explicit input-provenance modes now (`measured`,
`floorplan`, `inferred_from_image`, `synthetic_defaults`) per `ADR-0015`,
letting it produce E2E/demo output without claiming G01 —
`measurement_certified` is unconditionally guarded to `False` regardless of
mode, a structural invariant (`RoomPrepResult.__post_init__` raises if
violated), not a convention someone could forget to apply.

Eighteen ADRs (`ADR-0001`–`ADR-0018`) stand. As of session 13 there are **no
methodology blockers left with open work outstanding**: V01 ran and closed
signed-off under `ADR-0012` (decision: `revise` — evidence toward a future
V02 predictor call, not a V01 pass, not any G-series claim); R03 is a
recorded no-go under `ADR-0013`; D01's re-run closed `accept-with-limitations`
under `ADR-0014`. The two remaining hard blocks are client-owned (`OQ-010`
room scenes, which blocks G01 and everything behind it; and the unset
designer Delta-E tolerance, which blocks V03/G1/G2 but not V01).
Recommendation bundle composition runs `ADR-0013` logic-only over
labelled-synthetic fixtures and deliberately returns `needs_input` violations
instead of a feasibility claim; this is not R03/G2 acceptance.
`ADR-0015` allows rooms E2E/demo progress using explicit
`synthetic_defaults` or `inferred_from_image` modes while keeping G01 blocked.

**Docker Compose now brings up the full stack, not just the AI services.**
The root `docker-compose.yml` (`ai_services/work_packets/INFRA-DOCKER-01.md`
was the original AI-services-only build) now also defines an `app` service
using the existing repo-root `Dockerfile`, wired to the three AI services
over the Docker network with `CURALINA_AI_SERVICES_ENABLED=true` and
recommendation's real auto-seeded snapshot/rules values
(`snap_a3fixture0001`/`rules_2024_01`). `app`'s actual database is **not**
the compose's Postgres container — `server/db.ts` uses
`@neondatabase/serverless`, which needs a real Neon endpoint or a
Neon-compatible local proxy neither of which this setup provides; `app`
reads `DATABASE_URL` (and `SESSION_SECRET`, AWS/GCS/OpenAI/Stability keys)
from the repository's existing `.env` via `env_file`, unread and
unmodified by any agent. `docker compose up` from the repo root is now a
real local E2E environment: a live browser session against `app` on
`:8080` can exercise the actual `UI-A5-04` render path against real
recommendation/rooms containers. See `ai_services/DOCKER.md` and
`ai_services/RUNNING_AND_TESTING.md` §2c for full detail. **Verified live
2026-09-16** — the full stack comes up and the containers genuinely talk to
each other. Note what that does *and does not* prove: the environment is
real, but the render path inside it still stops at the first of the four
breaks in `ADR-0018` (`design-profile-mapper.ts` returns `needs_input` on
every request), so a green `docker compose up` is not evidence that the
chain works.

## Dispatch table

Item numbers are stable and are cited by ADRs and prior sessions — do not
renumber. Items 1-3, 6-9, 13, 14 are all closed as of session 14. Item
**10** (UI adapter, A5) is now genuinely ready — recommendation, variants,
and rooms all have complete A3 done-evidence — but `ui_adapter_workflow.md`
describes A5 as one flat phase, unlike every other service's `A0`-`A6`
breakdown, so it is decomposed here into three sequential sub-packets,
**10a → 10b → 10c**, following this project's one-service/one-phase/
one-measurable-result packeting discipline (`AGENTS.md` §9). Dispatch 10a
first; 10b and 10c both depend on it. A 4th sub-packet, **10d**, was found
mid-session (not originally planned) to close the gap 10a-10c left open —
none of them actually wire the adapter modules into a live request
handler — and is now dispatchable, depending on 10a-10c. **11** and **12**
stay hard-blocked on client-owned `OQ-010` and are not to be dispatched.
Items **15-17** are new this session, from the `/admin/product` ask: `ADR-0017`
found that the variants service has no way to obtain a mask for a real photo
**and**, more seriously, that its worker never calls the recolour path at all.
15 and 16 both closed 2026-09-16, each after two correction rounds, so
**17 is now fully dispatchable** — the variants upload → mask → recolour →
review path produces real pixels end to end on the service side. Items
**18-25** are new this session, from `ADR-0018`'s end-to-end trace: four
independent breaks in the quiz → recommendation → room → results chain,
plus the contract and type-checking gaps behind them. All eight are
ordinary engineering — no model, no GPU, no client data — except that item
20 needs one client sentence on currency and item 23 depends on accepting
that the room picture stays unbuilt until `OQ-010` is answered.

| # | Work | Owner role | Read first | Scope boundary | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | ~~Rooms A3: durable job store, worker (claim/lease/fencing), checkpointing between staged insertions, bounded attempt counts, `run-api`/`run-worker` bootstraps~~ | `python-services-engineer` | `ROOM-A3-01` | `room_generator/` only. Fake adapter retained; no model call, no room scenes, no G01 work | — | **Closed session 9 → `ROOM-A3-01`** |
| 2 | ~~**Variants A3 integration tests**: lease expiry, worker-dies-after-claim, cancellation-racing-completion, asset-write-succeeds-but-DB-commit-fails~~ | `python-services-engineer` | `agentic_flow/variant_generator_workflow.md:61` (six mandatory job tests) and `:63` (done-evidence) | Tests only, under `variant_generator/tests/integration/`. A `src/` change needed to make a case testable is an escalation, not a free refactor | nothing | **Closed 2026-09-15 (session 14) → `VAR-A3-02`.** Transactional claim re-check fixed the cancellation race for real (was a genuine TOCTOU bug, not a test gap); labelled-fake output-asset persistence added so the write/commit-fail case is now testable; `sqlite_store.py` 77% → 82% (unit+integration combined, independently re-verified). 10/10 integration tests pass. Variants A3 done-evidence is now complete |
| 3 | ~~Recommendation A3 integration tests: repository rollback, process restart, malformed-workbook import~~ | `python-services-engineer` | `agentic_flow/recommendation_workflow.md:78` (done-evidence names all three) | Tests only, under `recommendation/tests/integration/`. Same escalation rule as item 2 | nothing | **Closed session 9 → `REC-A3-01`, source follow-up `REC-A3-02`** |
| 4 | ~~V01 reference-free evaluation design~~ | `ai-ml-lead` | `ADR-0012` | — | — | **Closed session 8 → `ADR-0012`.** Successor is item 9 |
| 5 | ~~R03 formal no-go record~~ | `ai-ml-lead` | `ADR-0013` | — | — | **Closed session 8 → `ADR-0013`.** No-go on two independent grounds. Do not re-queue an R03 investigation |
| 6 | ~~**D01 re-run**~~ | `ml-notebook-engineer`, signed off by `ai-ml-lead` | `ADR-0014` §D2 (the four items); `ADR-0010`; `ADR-0009`; `agentic_flow/16_notebook_standard.md` | **Exactly `ADR-0014` §D2's four items.** Explicitly out of scope: re-authoring fixtures to pass, adding scenarios, touching `src/` | `ADR-0014` (done) | **Closed 2026-09-15 (session 11) → `RULES-D01-02`. Signed off by `ai-ml-lead`:** all four §D2 items delivered, `accept-with-limitations` confirmed, run `D01_20260915T041535Z`. Two non-blocking flags recorded below. Do not re-queue |
| 7 | ~~**Targeted Design Manual pass** for `OQ-002`–`OQ-009`, `OQ-011`, `OQ-012`~~ | `research-scout`, findings to `tech-lead` | `ADR-0009` (provenance + the read-in-place/by-hash rule) | Read-only over the pinned PDF. Scout reports findings with page numbers; scout does **not** rule and does **not** edit `agentic_flow/open_questions.yaml` | `ADR-0009` | **Closed session 11** — findings verified and folded into "What needs the client" items 8–13. No ADR warranted. Do not re-run this pass |
| 8 | ~~**Rooms A4 suite participation**~~ | `contracts-qa-steward` | `agentic_flow/contracts_and_suite_workflow.md`; `agentic_flow/room_generator_workflow.md` A4 (`:71`–`:73`); existing `ai_services/suite_client.py` | Public HTTP only. No shared DB, no shared filesystem paths, no importing service internals. Keep this fake-job-only; no real image/room render claim | item 1 (done) | **Closed 2026-09-15 (session 14).** All three services now genuinely participate in `make -C ai_services run-suite`; "rooms deferred" branch removed. 10 contract tests (was 7). A real leaked-process bug was found and fixed in the same touch (partial-startup failure left earlier services running past `finally` cleanup) — independently reproduced and re-verified fixed |
| 9 | ~~**V01 notebook run**~~ | `ml-notebook-engineer`, signed off by `ai-ml-lead` | `ADR-0012` **in full** — §D2 metric set, §D5 pair admission, §D6 controls, §D8 engineering constraints, §D9 claim ceiling; then `ADR-0008` for corpus conditions | Follow `ADR-0012`'s metric set **literally**; no substituted metrics. ATRIANI only. LUXUS is held out for run 2 and the words "held-out" may not appear until that run exists | item 4 (done) | **Closed 2026-09-15 (session 13) → `VAR-V01-01`, run `V01_20260915T115907Z`. Signed off by `ai-ml-lead`:** all four defects and both under-deliveries closed; decision stands at **`revise`**, which is a record of evidence, **not** a V01 pass and not any G-series claim. Do not re-queue this run — the "more pairs" re-run `revise` asks for is a **new** packet with its own admission review. One follow-up logged below (C3 pre-registration wording, `tech-lead`, non-blocking) |
| 10a | ~~**UI adapter A5, part 1 — scaffold, feature flag, settings**~~ | `typescript-app-engineer` | `ai_services/work_packets/UI-A5-01.md`; `agentic_flow/ui_adapter_workflow.md`; `architecture/guides/02_local_setup.md` "Existing UI integration settings" | `server/config/ai-services.ts` (new), `server/services/ai-adapter/` (new dir), one additive route in `server/routes.ts`, `.env.example`. No existing route logic, no `shared/schema.ts`, no `storage*.ts` touch. Flag defaults off; flag-off behavior must be provably unchanged | items 2+3 (both done) | **Closed 2026-09-15 (session 15).** `server/config/ai-services.ts` + `server/services/ai-adapter/` created, one additive `GET /api/ai-adapter/status` route (+12/-0 lines). All 8 named tests pass, independently re-run. Legacy `budget-allocation.test.ts` output byte-identical across independent runs — flag-off behavior provably unchanged. `git status` confirms only the allowed files touched. Not verified: the route was never hit over live HTTP (no server started this session) — correctness rests on the settings-module tests, not an end-to-end request |
| 10b | ~~**UI adapter A5, part 2 — recommendation-facing mapping**~~ | `typescript-app-engineer` | `ai_services/work_packets/UI-A5-02.md`; required-mappings table rows 1–2 in `agentic_flow/ui_adapter_workflow.md` | Quiz response → `DesignProfileIn` and recommendation bundle response → app product ref, against recommendation's real `/v1` surface only. `trade_price` never exposed; a `needs_input` fixture case is mandatory (`atmosphere` has no source field in `quizResponses` today — not an `OQ-xxx`, an app-schema gap). Must not claim `ADR-0013` §D3-forbidden feasibility/acceptance language — recommendation's bundle response is logic-only | 10a (done) | **Closed 2026-09-15 (session 16).** `design-profile-mapper.ts`/`recommendation-client.ts`/`product-response-mapper.ts` built, 7/7 named tests pass, independently re-verified. `AppProductRef` structurally has no `tradePrice` member. Real schema-drift finding: `quizResponses.styles` is an array but `DesignProfileIn.style` wants one — only the unambiguous single-style case maps, everything else is `needs_input`, not a guessed winner. Not wired into any live route yet — proven in isolation against fixtures, per packet scope. **Correction: 10c does not wire it in either** (`UI-A5-03.md`'s own "do not change" list forbids touching `server/routes.ts`) — a 4th packet is needed after 10c to actually splice this into a live request handler; see the note added to item 10c's row |
| 10c | ~~**UI adapter A5, part 3 — asset import, render-job persistence, traceability**~~ | `typescript-app-engineer` | `ai_services/work_packets/UI-A5-03.md`; required-mappings table rows 3–5 in `agentic_flow/ui_adapter_workflow.md` | Product/room image bytes imported into variants'/rooms' real `POST /v1/assets` before a job is submitted — never a raw local path crossing the boundary; one additive nullable `renders.aiServiceRef` jsonb column for traceability; no SQLite/filesystem access to any service | 10a, 10b (for the `bundle_id`/revision it threads through) | **Closed 2026-09-15 (session 16).** `asset-import.ts`/`render-job-client.ts`/`provenance-mapper.ts` built, 6/6 named tests pass, independently re-verified. `shared/schema.ts` diff confirmed additive-only (7 lines, nothing removed). `server/routes.ts` confirmed untouched by this packet. Storage-backend question resolved with real evidence (not escalated, not guessed): `products.images` goes through S3 (`upload-job-service.ts`'s `uploadFileToS3`/`s3Url`, independently confirmed by grep), `objectStorage.ts` (GCS) only backs a narrow legacy `/objects/upload` path unrelated to product images — `asset-import.ts` follows the app's own existing backend-agnostic precedent (`fetchImageAsBase64`'s plain-HTTP fallback) rather than importing either storage client directly |
| — | **Real finding, corrects prior rows:** `npm run check`'s `tsconfig.json` `include` glob **never covered `server/services/ai-adapter/**` or `server/config/ai-services.ts`** — every "npm run check clean, zero errors in my files" claim from 10a/10b was checking nothing, not confirming correctness (grep-for-my-files-returns-zero is vacuously true on files outside the type-checker's scope entirely). Caught by 10c's own engineer, not proactively — credit where due. **Independently re-verified by building a scratch tsconfig covering the real compiler options with `include` pointed at all of `server/services/ai-adapter/**` + `server/config/ai-services.ts` together (all three packets' files at once): exit 0, zero errors.** The underlying code is genuinely clean; the verification method used at the time was not. `tsconfig.json`'s `include` glob should be widened to cover `server/services/**` generally, not just this one packet's files — flagged for `tech-lead`, not fixed here (out of scope for any of the three UI-A5 packets, and widening a shared tsconfig is a call with wider blast radius than one packet's allowed-files list). **Superseded in part by 10d's row below**: the gap is confirmed repo-wide, not just the three ai-adapter packets' files — `include` never covered `server/routes.ts` or almost anything else under `server/` either. Still not fixed; still `tech-lead`'s call |
| 10d | ~~**UI adapter A5, part 4 of 4 — wire the adapter into a live route**~~ | `typescript-app-engineer` | `ai_services/work_packets/UI-A5-04.md`; `server/routes.ts` `POST /api/render` (lines 755–790) | `server/routes.ts` (the `/api/render` handler body only), `server/config/ai-services.ts` (two new additive settings: `CURALINA_CATALOGUE_SNAPSHOT_ID`, `CURALINA_RULES_VERSION`), new `server/services/ai-adapter/{service-availability,render-orchestrator}.ts` + test. One room-level render job per request (rooms only, `synthetic_defaults` mode per `ADR-0015`) — no per-product variant/colour-swap jobs, that is a separate future packet. Does **not** build job-completion reconciliation (`generating` → `completed`) — named, explicit gap left open | 10a, 10b, 10c (all done) | **Not yet dispatched.** Real integration point confirmed by reading the actual callers: `client/src/pages/Quiz.tsx:80-130` (initial submission, needs `render.id` in the response) and `client/src/pages/Results.tsx:~800` (regenerate-after-swap) both call the same `POST /api/render`; `server/storage-curalina.ts` is confirmed **live** (imports the real `@shared/schema`, not the dead `schema-curalina.ts` — a correction to how that file was characterized in earlier sessions). Two genuine new gaps found while scoping this packet, both specified rather than guessed: (1) recommendation's `postBundle`/`postRecommendations` require a `catalogue_snapshot_id`/`rules_version` the monolith has no source for today — resolved as two new `needs_input`-disciplined settings, fails closed if unset, not invented; (2) none of 10a-10c's typed error classes distinguish "AI service unreachable" from "AI service responded with an error" — resolved as a new `isServiceUnreachableError` check. **AI-service-down behavior: `tech-lead` CONFIRMED fail-closed → `ADR-0016`, on stronger grounds than originally argued.** `tech-lead` read the actual legacy path (`server/routes.ts:755-788`) rather than assuming: it persists `status: "completed"` with a hardcoded Pexels stock photo and calls no AI service at all — independently re-verified byte-for-byte by the orchestrating session. A silent fallback to that path would write a fabricated success state against a real customer's request, forbidden outright by this project's job-state and no-fabrication invariants — this is a correctness question, not a UX tradeoff. Rejected a circuit-breaker revision as solving a different problem (retry storms, not "what does the customer get"). **Three mandatory revisions, verified and baked into `UI-A5-04.md`'s failure-mode section:** R1 — the `503` error body must be flat (`{error: string, ...}`), not nested, because `client/src/pages/Quiz.tsx:106-109` does `new Error(errorData.error)` and a nested object there renders as the literal string `"[object Object]"` in a customer-facing toast (independently confirmed, real bug). R2 — the app-facing error shape must match the monolith's own existing `{message}` convention, not adopt the service-to-service `error.schema.json` envelope (confirmed flat: `code`/`message`/`details`/`retryable`/`request_id` — a third invented shape would match neither existing convention). R3 — no `renders` row is written on the 503/unreachable path (only customer-attributable outcomes like `needs_input` get a durable row; an environment-condition failure writing a row per retry would be junk data). **A downstream gap `ADR-0016` makes binding, not optional, for whatever packet reconciles `generating` → `completed`:** `client/src/pages/Loading.tsx:57-69` currently polls unconditionally with no terminal-state branch for `failed`/`needs_input` — that packet must add terminal states or it repeats, client-side, the exact silent-degradation failure mode this ruling just rejected server-side. **tsconfig `include` widening: still out of scope for 10d, confirmed repo-wide** (not just the three prior packets' files — `server/routes.ts` itself has never been type-checked by `npm run check`), flagged for `tech-lead` separately. **Closed 2026-09-15 (session 16).** All 8 named tests pass, independently re-verified, including the `typeof body.error === "string"` regression guard for R1. `git diff server/routes.ts` confirmed: legacy branch has zero removed/modified lines, only an additive `if (isAiServicesEnabled())` block inserted before it — flag-off is genuinely byte-identical. R1/R2/R3 confirmed directly in `render-orchestrator.ts` (flat `error: message` string, 4 occurrences, never nested; zero `createRender` calls on the unavailable/misconfigured paths). **Two new, honestly-escalated contract gaps for `tech-lead`, not fabricated around:** (1) rooms' wire-level `RenderJobRequest` schema has **no field** for `ADR-0015`'s `provenance_mode` — only the internal domain type models it, unreachable over HTTP; the orchestrator cannot honestly declare `synthetic_defaults` mode on the outbound request today (confirmed: `RenderJobRequest` at `curalina_rooms/api/schemas.py:131-139` has no such field). (2) `layout_version` (also required by `RenderJobRequest`) has no dedicated setting — `CURALINA_RULES_VERSION` is reused as a flagged simplification pending confirmation whether rooms needs its own distinct version identifier. UI adapter phase A5 is now feature-complete for the recommendation→rooms path; job-completion reconciliation (`generating`→`completed`) and `Loading.tsx`'s terminal-state handling remain the next, `ADR-0016`-mandated packet |
| 11 | **G01** | — | `ADR-0011` | — | `OQ-010` + client data | **Blocked. Do not dispatch.** No available imagery is an admissible substitute |
| 12 | **G02, G03, V02, V03** | — | `ADR-0011`, `ADR-0012` | — | G01 / V01 respectively | Blocked |
| 13 | ~~Bundle composition + substitution, logic-only against labelled-synthetic fixtures~~ | `python-services-engineer` | `ADR-0013` §D2 (four binding conditions) and §D3 (forbidden phrasing) **before writing any code** | Composition/substitution logic only. **No accuracy, quality or acceptance claim may be derived from the run.** G2 is not reached | `ADR-0013` (done) | **Closed session 10 → `REC-A2-02`** |
| 14 | ~~**Synthetic/default-dimension room E2E mode**~~ | `python-services-engineer` + `contracts-qa-steward` | `ADR-0015`; `agentic_flow/room_generator_workflow.md` A2-A4; `ROOM-A3-01`; `ai_services/suite_client.py` | Add explicit room input provenance and default geometry path for E2E/demo only. Product image source must be configurable. No G01/G02/G03 acceptance claim | item 1 (done), `ADR-0015` | **Closed 2026-09-15 (session 14) → `ROOM-A4-01`.** Four provenance modes (`measured`/`floorplan`/`inferred_from_image`/`synthetic_defaults`) added, `measurement_certified` unconditionally guarded to `False` per `OQ-010` regardless of mode (structural, not conventional — `RoomPrepResult.__post_init__` raises if violated). No `Settings`/`suite_client.py` touch. One lint defect (unused imports in a new test file) found on independent re-verification and fixed — false "Ruff clean" claim, now genuinely clean |
| 15 | ~~**Variants A2 completion — mask ingestion (`POST /v1/masks`)**~~ | `python-services-engineer` | `ADR-0017`; `agentic_flow/variant_generator_workflow.md:27-46` (MaskSpec) and `:45,51` (mandatory mask tests); `architecture/guides/03_data_contracts.md:32` | `variant_generator/` only. Ingest a **human-authored** mask; resolve `mask_id` in `POST /v1/jobs` against a mask repository behind a port. **No segmenter, no heuristic/auto mask generation** — explicitly forbidden by `ADR-0017`. Additive/minor, no version bump | `ADR-0017` | **Closed 2026-09-16 → `VAR-A2-03`, after two correction rounds.** `POST /v1/masks` + `GET /v1/masks/{id}` built; `mask_id` now resolved against a real `masks` SQLite table (`sqlite_store.py`) and `FakeJobStore`'s in-memory dict, returning a proper 404 instead of accepting any non-empty string. A `MaskRepository` port + `FakeMaskRepository` adapter exist but are intentionally unwired stubs (0% coverage by design, not a gap) — the live gate is the direct table/dict lookup. No segmenter or heuristic mask generation anywhere in the diff — independently grepped and confirmed. **First-round report was inaccurate on two counts, both caught by independent re-verification, not self-reported:** (1) claimed "11 tests passing" after adding mask tests to 2 files, but running the **full** suite showed 19 pre-existing tests broken (the entire `VAR-A3-02` durable-jobs suite plus `test_sqlite_store.py` and the worker scaffold test) — the new mask-existence gate wasn't threaded into every test file that creates jobs directly. Sent back; fixed properly (seeded a default mask in each store-creation helper, not a bypass of the check) — full suite now **171 passed**, independently re-run. (2) claimed "Ruff: All checks pass" when ruff actually found 6 errors (5 line-length, 1 unused import) — fixed directly by the orchestrating session rather than another round-trip; ruff and mypy both independently confirmed clean after. Take both first-round claims in this row as a reminder to always run the *whole* suite, not just the files touched, before reporting done |
| 16 | ~~**Variants A3 completion — wire `generate_variants` into the worker**~~ | `python-services-engineer` | `ADR-0017`; `agentic_flow/15_variant_generation_technical_design.md` (LAB transformer has no model dependency); `agentic_flow/variant_generator_workflow.md:53-92` | `workers/runner.py` + the real `LabColourTransformer` on the success path, replacing the labelled-fake output asset. CPU-only, synthetic images, no GPU, no model. **No V01/V02 evidence claim may be derived** — `OQ-011` still blocks evidence, not this code path | item 15, `ADR-0017` | **Closed 2026-09-16 → `VAR-A3-03`, after two correction rounds.** `workers/runner.py` now calls the real `LabColourTransferAdapter` on every job, using the mask ingested via item 15 and the source asset from `POST /v1/assets`. Hard-composite guarantee (`variant_generator_workflow.md:92`) independently confirmed by a genuine pixel-level test — reads the output PNG back to a numpy array and asserts byte-identity strictly outside the mask's editable region and a real difference strictly inside it, not a mock. **First round's test/ruff/mypy claims were accurate** (172 passed, independently re-run) — process discipline held after item 15's corrections. **But the logic itself had a serious defect, caught by the orchestrating session reading the code, not by any test:** `process_one_job` wrapped the whole transform in a bare `except Exception: pass`, and `complete_leased_job`'s `outcome` parameter defaults to `"succeeded"` — so *any* real-transform failure (bad mask decode, adapter crash, malformed colour) silently fell through to a fabricated fake output asset marked as a successful job, with no signal anywhere that the real path didn't run. This is the exact fabricated-success failure mode `ADR-0016` already ruled against on the render path, reintroduced here by the packet chartered to eliminate it. Sent back; fixed properly — every exception path now classifies the failure (`transform_mask_not_found`/`transform_asset_not_found`/`transform_invalid_colour`/`transform_dimension_mismatch`/`transform_adapter_failure`) and marks the job `FAILED` with a populated `ErrorSummary`, never a silent succeeded-with-fake-asset. Two new tests force real runtime failures via monkeypatching and assert `status == JobStatus.FAILED`, a populated `failure` field, and `candidate_id is None` — independently read and confirmed to actually exercise the path, not just assert a shape. Full suite now **175 passed**, ruff clean, mypy clean, all independently re-verified. **Lesson for future dispatches in this codebase: a clean test/lint report does not mean the logic is correct — read the actual error-handling path, especially any `except Exception`, before accepting a packet that touches job outcome/status** |
| 17 | **`/admin/product` page in the monolith** | `typescript-app-engineer` | `ADR-0017` (scope ruling); `ADR-0016` (fail-closed precedent) | Upload + product listing + existing image management only. **Variant generation ships visibly disabled and labelled unavailable.** No placeholder mask, no heuristic mask, no invented `OQ-xxx` | items 15+16 for the generation flow; the rest is dispatchable now | **Now fully dispatchable.** Items 15+16 both closed 2026-09-16, so the generation flow is no longer blocked — `ADR-0017`'s block is lifted. Settled and not to be re-argued: N colours = N jobs (no batch endpoint); "Accept" is two writes (variants review + monolith `products` write) and must not collapse job success / candidate approval / commercial availability. The mask is a **human-authored upload** on this screen, not something the page generates |
| 18 | ~~**Rooms contract: required `provenance_mode`, own `layout_version`**~~ | `contracts-qa-steward` + `python-services-engineer` | `ADR-0018` §D4, §D5; `ADR-0015`; `ai_services/room_generator/src/curalina_rooms/api/schemas.py:131-139` | Rooms' wire contract + both in-repo consumers (`server/services/ai-adapter/render-job-client.ts`, `ai_services/suite_client.py`). **`provenance_mode` is required with no default** — a request that omits it is a contract error. `CURALINA_ROOMS_LAYOUT_VERSION` is a new fail-closed setting. **Major version bump for rooms' request contract** | `ADR-0018` | **Closed 2026-09-16 → `ROOM-A2-02`, after a serious correction round.** `provenance_mode`/`layout_version` are now required on `RenderJobRequest`, `suite_client.py` updated to send them. **But independent full-suite verification (not the narrow `tests/contract/` subset the first report cited) found the real rooms FastAPI app could not even start** — `ImportError` on `sqlite_store.py` importing `invalid_job_state_error` (didn't exist in `errors.py`), plus `app.py` calling `RoomsContractService(store)` against a zero-argument constructor. Root cause traced to a **`git reset --hard HEAD` that silently wiped uncommitted edits to `errors.py`/`service.py`** — confirmed via `git reflog` showing two reset-to-HEAD events this session, almost certainly run by a background agent unaware this project's institutional state lives in uncommitted files (see the incident note in "Environment notes" below). Not this packet's fault, but it broke on top of this packet's work and had to be fixed here. Fixed: `invalid_job_state_error` added back, `RoomsContractService` now takes an optional `store` param (delegates to SQLite when present, in-memory fake when `None`), `api/__init__.py`/`workers/__init__.py` re-export what they should have. Also found and fixed: `RenderRequest.provenance_mode` had no default (breaking existing callers) and `RoomPrepResult` was missing `geometry_source_mode` entirely — both required by test files the first report never ran. `python3 -c "from curalina_rooms.api.app import create_app; app = create_app()"` now succeeds. Full suite: **142 passed**, 95% branch coverage, ruff clean, mypy clean — all independently re-verified by the orchestrating session. Also flagged, not fixed (out of scope): `ai_services/recommendation/tests/` has an identical duplicate-test-basename collision, reproduced independently, needs its own fix |
| 19 | **Recommendation contract: `supplier_id` + `supplier_sku` on `BundleLineItem`** | `contracts-qa-steward` + `python-services-engineer` | `ADR-0018` §D3 and C1-break-2; `architecture/guides/03_data_contracts.md:9,28`; `api/schemas.py:72-79` | Additive optional fields on `BundleLineItem` only. **Do not redefine `product_id`** — it stays recommendation's internal identifier per the data contract. Minor bump, no consumer breaks | `ADR-0018` | **Ready.** Without this the app has no way to resolve a bundle line item to its own `products` row — every AI-path render 500s with `product_mapping_mismatch`, guaranteed, regardless of fixtures |
| 20 | **Unblock `design-profile-mapper.ts`: real `atmosphere`, decide `currency`** | `typescript-app-engineer` | `ADR-0018` §D1, §D2; `vocabulary_map_v1.yaml:14-40`; `client/src/components/quiz/ColorMaterialsStepV2.tsx:16-58` | `design-profile-mapper.ts` only. `atmosphere` = the single `quizResponses.colorPalettes` value when it is an exact `canonical_tags` member; two values or a non-member → `needs_input`. **No fuzzy matching, no synonym table.** A contract test asserting the quiz option list and `canonical_tags` agree is mandatory | `ADR-0018`; `currency` needs the client answer (see "What needs the client" item 14) | **Ready for `atmosphere`; `currency` blocked on one client sentence.** This is the first break in the chain — today the AI path returns `needs_input` on *every* request and never calls recommendation at all |
| 21 | **The four missing Results-page endpoints** | `typescript-app-engineer` | `ADR-0018` §C3; `client/src/pages/Results.tsx:112-198`; `server/storage-curalina.ts:367,377,617,1304` | Add `GET /api/render/:id/products`, `GET /api/render/:id/ledger`, `GET /api/products/:id`, `GET /api/products/alternatives/:id`. Move `GET /api/render/latest` **above** `GET /api/render/:id`. Decide `/api/quiz-response/:id`'s auth. Also: `orchestrateAiRender` must write `renderProducts` rows. Thin handlers over existing storage methods — no new business logic | nothing | **Ready, and the cheapest high-value item in the backlog.** All four endpoints are fetched by the live Results page and none has ever existed in this repo. Storage layer already complete and tested |
| 22 | **Job-completion reconciliation (`generating` → terminal)** | `typescript-app-engineer` | `ADR-0018` §D6; `ADR-0016`; `render-orchestrator.ts:42-47` | A background poller in the app over `GET /v1/jobs/{job_id}` using `renders.aiServiceRef`. **Not** a webhook from rooms into the app; **not** inline in `GET /api/render/:id`. Mandatory: a succeeded job whose output asset cannot be retrieved sets `failed` with a reason, never `completed` | items 18, 19, 20 | **Ready after 18-20; the client-side symptom is fixed, the server-side reconciliation is not.** ~~Add the `needs_input` terminal branch to `Loading.tsx`~~ **done session 19** — it was previously the only unhandled terminal status and every AI-path request landed there (item 20 still unresolved), so `Loading.tsx` hung on the spinner forever with no error; now redirects to `Results.tsx`'s existing honest `needs_input` state within one poll interval, independently re-verified live. What item 22 itself still needs is unchanged: a real backend poller against rooms' `GET /v1/jobs/{job_id}` so a `completed` render is ever reachable, not just `needs_input`/`failed` |
| 23 | **Honest demo surface: remove the stock photo, label the room gap** | `typescript-app-engineer` | `ADR-0018` §D7.3, §C2; `ADR-0011`; `ADR-0015` | Delete the hardcoded Pexels URL at `server/routes.ts:792-793`. Results page shows the render job's real state and states plainly that room image generation is not built and is blocked on `OQ-010`. **No placeholder image of any kind** | item 22 | **Ready after 22.** Expect this to read as a regression — it is deliberate. Rooms has no image-producing code path at all (`fake_grounded_generation.py:24-40` returns an asset id for an asset that was never written), so any picture shown here would be fabricated |
| 24 | **Wire the real catalogue into recommendation's runtime** | `python-services-engineer` | `ADR-0005`, `ADR-0007`, `ADR-0013` §D3 (forbidden phrasing); `adapters/xlsx_workbook_reader.py`; `api/application_services.py:103-130` | Replace `FakeCatalogueImporter`'s four hardcoded fixtures in the composition root with the real workbook importer. Must emit `supplier_id`/`supplier_sku` per item 19. **No accuracy, feasibility or acceptance claim** may be derived — the composer stays logic-only | items 19, 20; `ADR-0013` | **Ready.** Recommendation currently serves 4 hardcoded products priced in **CAD** while the app sends USD (see "What needs the client" item 14). A real parser exists and is wired to nothing |
| 26 | **Async room-render job UX: queue submission, dashboard polling badge** | `typescript-app-engineer` | `ADR-0018` §D6; item 22 (server-side reconciliation, a prerequisite); `client/src/pages/my-dashboard.tsx`; `client/src/pages/Loading.tsx` | After quiz submission, redirect straight to `/my-dashboard` instead of `/loading` — the render is created in `needs_input`/`generating` state and the dashboard shows a small loading indicator over that entry until item 22's poller resolves it to a terminal state. No blocking full-screen loading page for the room-render step. **Not started — explicitly deferred by the project owner as future work**, requested alongside the session-19 stuck-loading fix below | item 22 | **Not yet dispatched, and not to be started before item 22** (there is no backend job-completion poller yet for this UX to react to) |
| 25 | ~~**`tsconfig.json` `include` covers the live `server/` tree**~~ | `typescript-app-engineer` | `ADR-0018` §D8, §C5 | Widen `include` to `server/**/*.ts`. Fix or explicitly annotate whatever pre-existing errors surface. **Do not narrow the glob back to make the build pass** | nothing; do it early, items 20-24 all edit `server/` | **Closed 2026-09-16.** `include` widened to `server/**/*.ts` with `server/functions/**` excluded (a stale, separately-built Firebase sub-package — confirmed unrelated by diffing its `routes.ts` against the real one). Added `esModuleInterop: true`, a legitimate systemic fix without which every default CommonJS import (`express`, `cors`, `multer`, `sharp`...) cascaded into spurious `implicit any` errors. 206 previously-invisible errors surfaced in real `server/` source on first run; traced the live import graph from `server/index.ts` via `madge` and fixed every error in every file actually reachable from the running app (`db.ts`, `storage.ts`, `storage-curalina.ts`, `localAuth.ts`, `objectAcl.ts`, `objectStorage.ts`, `routes.ts`, `routes-curalina.ts`, `routes-mapping-analysis.ts`). **Two of the fixes are real production bugs, not lint noise, independently verified:** (1) `storage-curalina.ts` had ~50 methods (including `getProductAlternatives`, which item 21/`ADR-0018` §C3 explicitly relies on as "already complete and tested" — it wasn't) referencing a bare, unimported `db` identifier instead of the file's real `getDb()` accessor; every one would have thrown `ReferenceError: db is not defined` at runtime. Fixed, spot-checked directly. (2) Both cart routes in `routes.ts` called `storage.addToCart(...)`, but that method only exists on `curalinaStorage`, not `DatabaseStorage` — every add-to-cart request would 500. Fixed to call `curalinaStorage.addToCart`, confirmed via direct read. 93 errors remain, all confirmed (via the same `madge` trace) to sit in the orphaned legacy Gemini/Stability/OpenAI render stack that `ADR-0018` §C2 already identified as dead code, unreachable from `server/index.ts` — correctly left untouched rather than rewriting abandoned business logic under a "fix the config" packet; deletion/revival of that stack is an explicit open decision for the owner, not something to resolve here. `npm run check`: exit 2, 209 errors (93 confirmed-dead-code server + 116 pre-existing client, both out of this packet's scope and unchanged by it). `npm run build`: exit 0, independently re-run. This is the highest-quality, most accurately self-reported packet of the session — no correction round needed |

**Suggested order:** 25 → 18 → 19 → 20 → 21 → 24 → 22 → 23. 25 first so
every later packet is type-checked. 18/19 are contract changes and should
land before their consumers. 21 is independent of everything and can run in
parallel with any of them.

**Session 18 addendum, not a numbered item:** `renders.aiServiceRef` (added
to `shared/schema.ts` by item 10c, session 16) had never actually been
migrated onto the live Neon database — `migrations/0003_demonic_magus.sql`
closes that drift. Nothing in the dispatch table above changes as a
result: item 20 (`atmosphere`) is still the next real blocker in the
chain, exactly as `ADR-0018` traced it. The post-auth dashboard rebuild
(register/login → `/my-dashboard`, quiz moved off the dashboard, honest
per-status render cards) is UI-flow work the project owner asked for
directly, outside this packet numbering — see the session 18 summary
above and the archive entry below for what changed.

## Implementation guidance (`tech-lead`)

Per-item opinions on approach. Where an item already has an established
pattern in this repo, follow it rather than reinvent — divergence here costs
review time and creates two ways to do one thing.

### Item 1 — Rooms A3 closed in session 9

Implemented in `ROOM-A3-01`:

- `curalina_rooms.api.sqlite_store.SQLiteRoomStore`
- SQLite-backed default FastAPI composition root with the fixture path still
  injectable through `RoomsContractService()`
- `workers.runner.process_one_job()` / `run_worker_once()`
- uvicorn-backed `bootstrap.main("api")` and one-pass
  `bootstrap.main("worker")`
- integration coverage for queued lifecycle, partial artifacts on fake
  failure, reference import/hash verification, timeout/lease expiry,
  cancellation, wrong-worker fencing and restart recovery

Verification: `make -C ai_services/room_generator test` passed with 73 tests
at 93% branch coverage; `api/sqlite_store.py` sits at 83%.

### Item 2 — Variants integration tests: prefer a data seam over a new port

**VAR-A3-01 update (2026-09-14):** replaced the placeholder with seven
real-SQLite integration cases: six pass and one fails reproducibly because
completion overwrites cancellation after its ownership read. The failing
regression remains enabled. Worker process exit/restart, lease recovery,
different-worker rejection, HTTP idempotency conflict and candidate/job
rollback are covered. This does not prove per-claim fencing for reused worker
IDs. The mandatory generated-asset-write/final-commit-failure case is blocked:
the worker never writes generated output, and candidates have
`output_asset_id=None`. No source changes were made under the tests-only scope.
Tech-lead and code-reviewer confirmed these gaps; A3 done-evidence remains
incomplete. The earlier statement that variants A3 engineering is done is
superseded by these findings. Recommendation's placeholder remains untouched.

Next for item 2: a scoped engineering packet for transactional claim,
cancellation and completion validation, stale-claim rejection, and a designed
labelled-fake output persistence path, followed by recovery/failure tests.
Keep source files explicitly enumerated, no contract changes or model claims.
See `ai_services/work_packets/VAR-A3-01.md` for verification and disposition.


The uncovered `lease_expired` branch is
`variant_generator/src/curalina_variants/api/sqlite_store.py:287`. Test it by
writing the row's lease-expiry timestamp into the past directly against the
temp SQLite file, **not** by introducing a `Clock` port purely for a test.
Rooms has `ports/clock.py` and `adapters/fake_clock.py`; variants
deliberately does not, and adding one is a design change that needs saying
out loud, not smuggling in under a test packet. Report **per-module**
coverage for `api/sqlite_store.py` (77% today) — the aggregate will not show
the movement. Use a real temp SQLite file, never a mock store; the whole
point of these four cases is durability behaviour.

### Item 3 — Recommendation integration tests: assert the contract, not the exception

Process restart means constructing a **second** store/app instance against
the same SQLite file and reading the prior state back — the same shape as
variants' `test_sqlite_job_survives_app_restart_and_worker_completion`.
Malformed-workbook import must assert the **error code and HTTP status from
`ai_services/contracts/v1`**, not merely that some exception was raised; an
import that fails with an unmapped 500 is a contract defect this test is
supposed to catch. Repository rollback means asserting that a failed
multi-statement write leaves no partial row, exercised against the real file.

### Item 6 — D01 re-run: the fixture may declare synthetic geometry; the notebook may not mint it

Take `ADR-0014` §D2 option **(b)**: move `bed_point` / `ensuite_door_point`
into `ai_services/design_rules/tests/fixtures/golden_scenarios.py` as
declared fields labelled *synthetic, fixture-authored, not client geometry*,
and name the sofa explicitly rather than relying on `placements[0]`. The
principle worth carrying beyond this packet: a representative fixture is
allowed to declare its own synthetic geometry because the label travels with
the data structure; a notebook cell that constructs `Point(10, 10)` inline
has invented client data. **Verify** the `expect_passes_hard_spatial`
mismatch moves 3/4 → 1/4; do not assume it. Cite the manual by its sha256,
never as "the Design Manual says". Notebook cells narrate, plot, or call into
the package — nothing else (`agentic_flow/16_notebook_standard.md`).

**Closed 2026-09-15 (session 11), signed off by `ai-ml-lead`.** Run
`D01_20260915T041535Z` (original `D01_20260913T022937Z` left intact). All
four `ADR-0014` §D2 items delivered and independently verified against the
notebook's own executed outputs: mismatch **1/4**, computed and printed by
cell 13 rather than assumed; `MIN_WALKWAY` `needs_input`/`OQ-013` on 4/4;
endpoints and the sofa identity moved onto `GoldenScenario` as declared
labelled-synthetic fields with no inline `Point(...)` left in any cell; §8
reframed as *inapplicable* in cells 0/3/18/19 and cited by sha256 only; the
original `MIN_WALKWAY` finding retained as correct-and-now-closed. Suite
re-run independently: **83 passed, 92% branch.** `accept-with-limitations`
**confirmed** — this was a mechanical evidence-integrity fix, not new
capability, and `OQ-001`/CMR plus the four unbuilt rule families are
untouched. Per `ADR-0014` D3 this is D01's ceiling; do not re-queue it.

Two non-blocking flags recorded so they are not rediscovered as defects:

1. **The remaining 1/4 mismatch is not "the fixture's intended failure",
   and should not be described that way.** The fixture sets
   `expect_passes_hard_spatial=True` for `condo_bedroom_pinched_ensuite_path`
   deliberately, and its own comment scopes that field to
   `evaluate_spatial_layout` only — reachability is "a separate named-rule
   check consumers run with explicit bed/door points". Cell 13 then folds
   `named_violations` (which include `BR_ENSUITE_PATH`) into the comparison,
   so the mismatch is an artifact of testing an entry-point-scoped
   expectation against an entry-point **plus** named-check result. The
   notebook's printed line "fixture docstring claims a pass" inverts what
   the docstring actually says. The **count is honest**; only the label on
   it is wrong. **Do not fix this under a D01 packet** — `ADR-0014` §D2
   forbids any change that moves the mismatch count for a reason other than
   `ADR-0010`'s severity change. It needs its own scoped packet, or a
   second fixture field distinguishing entry-point from named-check
   expectations.
2. **`tests/fixtures/golden_scenarios.py`'s module docstring is stale in
   framing.** Its literal claims still hold (the manual is genuinely not in
   the repo), but "encoding the actual four examples is blocked until the
   source PDF … is supplied" is superseded: `ADR-0009` located it and
   `ADR-0014` §D4 rules §8 **inapplicable** to spatial scope and
   inadmissible as an evaluation set. §D2 item 3 enumerated notebook cells,
   not this file, so this is not a scope breach — but it is the exact trap
   §D4 exists to prevent (someone concluding "get the PDF, then encode the
   golden scenarios"). Fix in whichever packet next touches that file.

### Item 7 — Manual pass: one finding per `OQ-xxx`, with a page number and a quote

The value of this pass is that it is checkable. Each `OQ-xxx` gets: found /
genuinely blank / partially specified, the page numbers searched, and a
verbatim quote where something was found. A scout finding of "nothing
relevant" is a useful, reportable result — `OQ-001`'s "CMR appears twice as a
bare name, no formula" is precisely that kind of finding and it is what
justified `check_cmr_validation`'s unconditional `needs_input`. Findings come
to `tech-lead` for a ruling; the scout does not close a client-owned question
and does not touch `agentic_flow/open_questions.yaml`.

**Closed session 11 (2026-09-15).** Ten `OQ-xxx` were searched; every one of
`OQ-002`, `OQ-003`, `OQ-004`, `OQ-006`, `OQ-008` came back *genuinely blank or
qualitative-only*, so not one produced an implementable threshold — the
`needs_input` paths in the engine all stand as written. Findings were
re-verified independently against the pinned sha256 before being written up.
Two traps recorded so they are not re-hit: p45's "70/30 split" is a lighting
**Metal Mixing** rule, unrelated to p4's **70/30 Edge** rule despite the
identical ratio; and §7.3's third style ratio (MS) is on **p146**, not p145
with the other two. The general lesson: a targeted manual pass that finds
nothing is still worth its cost, because "confirmed absent at this hash"
converts a suspected gap into a citable client ask.

### Item 8 — Rooms A4: extend the existing suite, do not fork it

`ai_services/suite_client.py` already starts recommendation (`8101`) and
variants (`8102`) as uvicorn processes with independent temp SQLite
databases and talks only over public HTTP. Rooms joins that same flow
(bundle → variant export → render job → review) with its own temp database.
The suite runner is an orchestration convenience, not a fourth business
service — it must not gain business logic, and it must not open any
service's SQLite file or asset path. Remove the "rooms deferred" branch from
suite output only when rooms genuinely runs.

### Item 14 — Synthetic room E2E mode: provenance first

`ADR-0015` is the authority. The implementation should add explicit room input
provenance modes (`measured`, `floorplan`, `inferred_from_image`,
`synthetic_defaults`) and a default-dimension path that lets the rooms service
produce demo/E2E artifacts without claiming G01. Local product imagery comes
from a configurable source root such as
`CURALINA_SOURCE_ASSETS_DIR=/Users/rjsalmon/Downloads/Supplier Images`; future
production storage is an object-store provider and must persist asset IDs and
content hashes, not local paths. UI work should later ask for explicit
dimensions/floorplans so runs can graduate from `synthetic_defaults` to
`measured`/`floorplan` when available.

### Item 9 — V01: `ADR-0012`'s metric set is binding, not a starting suggestion

This is the item most likely to be quietly re-litigated by a well-meaning
engineer, so state it in the packet: **M1 is reported as `assertion_held`
and never as a score or in a pass rate; M2a (L\* variance ratio ≥ 0.90) and
M2b (gamut-clipped fraction ≤ 0.02) are the primary evidence; M3 (Delta-E00)
is demoted and its tolerance is `needs_input`; M4 (silhouette IoU) is
reported unthresholded as instrument calibration.** No substitutions, no
additions promoted to primary, no applying the technical design's 0.98 IoU
bar — that bar is V02's. M2b is explicitly an operating point, not a
perceptual constant, and must be labelled as such wherever it appears.

Engineering constraints (`ADR-0012` §D8) that are easy to violate by habit:
the LAB transform, the composite and every metric live **in the package** —
a `LabColourTransferAdapter` behind the existing
`variant_generator/src/curalina_variants/ports/colour_transfer.py`, plus an
`evaluation/` module mirroring recommendation's — with the notebook only
narrating, plotting and calling in. No OpenCV. No `glob` — allowlist from
`Design 44.xlsx`'s `Linl to pictures ` column (sic). Notebook-scope
`CURALINA_SOURCE_ASSETS_DIR` only, **never** `CURALINA_DATA_DIR` and never
added to `Settings`. Masks are human-authored per-region, not
background-derived. Per-module coverage reported for every new module.

Two additions from me: the run should **test the replacement failure
predictor (mask-region `std(L*)`) explicitly** rather than cite `ADR-0012`'s
probe as evidence — a probe is a reason to test something, not a result; and
`ADR-0012` §D9's claim ceiling must be copied into the decision record
verbatim in substance, because that is the artifact a downstream reader will
quote.

**`ai-ml-lead` review 2026-09-15 (session 11): sign-off WITHHELD. Item 9 is
NOT closed.** Run `V01_20260915T043322Z`, packet `VAR-V01-01`.

**What is confirmed and does not need redoing.** The `"revise"` outcome is
the **correct call** and I am not substituting another. "Accept" is
unavailable (M2b passes 1 of 4; n=4 curated; §D9 forbids a gate claim);
"reject" is unavailable (M1 holds exactly, the baseline behaves as
specified, and `ADR-0012`'s own falsification condition — M2a *and* M2b both
at ceiling — did not occur, M2b spanning 0.0022–0.6146);
`insufficient_evidence` is unavailable because one result here **is**
decisive: `dark_to_light_risk` returned exactly `0.0` on all four pairs
while observed clipping varied ~270×. A formula emitting a constant while
the quantity it predicts varies that much is falsified without needing
n=276. **That falsification — not the `std(L*)` correlation — is what earns
"revise"**, and the record should lead with it. The claim ceiling is
honored: all seven §D9 prohibitions are carried in substance, M1 is
`assertion_held` and never scored, M2b is labelled an operating point, M3 is
distribution-only, M4 is unthresholded with V02's 0.98 bar explicitly not
applied, and "held-out" appears nowhere in the V01 notebook or its run
directory (the two repo hits are in the unexecuted `02_`/`03_` skeletons).
Engineering verified independently: **120 passed, 92% branch**;
`lab_colour_transfer.py` and `identity_colour_transfer.py` both **100%**.

**Why sign-off is withheld — four defects, all in the record, none in the
science.** These are cheap to fix and the run is deterministic.

1. **A stored output cell was hand-edited and its source was not.** Cell 37's
   *source* still reads "M2a/M2b pass on 2 of 4 admitted pairs and fail
   together on the other 2"; its stored *output* reads the corrected
   sentence; and the archived gate artifact
   `runs/V01_20260915T043322Z/decision.json` still carries the **old** text.
   The notebook therefore displays an execution output its own code did not
   produce. That is fabricated execution evidence regardless of the edited
   text being more accurate, it defeats §0's reproducibility purpose
   (`16_notebook_standard.md`), and it is the "record that argues with
   itself" that `ADR-0014` rejected option (a) over. **Correct the source,
   re-execute, archive a new `RUN_DIR`; leave the existing one in place.**
2. **Cell 35 was not corrected at all and reports a failure as a pass.** It
   states "`artigiano_dining_chair` and `alice_chair` fail M2b" and
   "`forma_sofa` and `poltrona_chair_studio` pass both M2a and M2b".
   `poltrona_chair_studio` **fails** M2b at 0.1670 — 8× the operating point
   — and cell 34's own executed output immediately above it lists three
   failures, not two. This is Section 5, the failure-analysis section
   §D7 and the notebook standard make load-bearing. Only **1 of 4** pairs
   (`forma_sofa`) passes both.
3. **The stated failure mechanism is contradicted by this run's own data.**
   Cell 35 and the decision rationale attribute the M2b failures to
   "light-source-to-dark-target requests with a wide source lightness
   spread". But `dark_to_light_risk` is `0.0` on **all four** pairs — every
   target is darker than its source, including the passing one — so
   light-to-dark does not separate pass from fail here; and the passing pair
   `forma_sofa` has `source_mask_l_std` **17.31**, higher than two of the
   three failures (14.85, 13.60). The mechanism may well be right at
   `ADR-0012`'s n=276, but n=4 does not evidence it and partly contradicts
   it. State `std(L*)` as **the candidate to test at larger n**, not as
   confirmed.
4. **C3's recorded outcome is falsified by its own CSV.** `decision.json`
   says "confirmed: M2/M4 are indistinguishable between the correct target
   and a rotated wrong target." For M2b that is false: gaps reach **0.3605**
   (`forma_sofa`) and **0.6111** (`alice_chair`), and the M2b verdict flips
   in *both* directions — `forma_sofa` passes on its correct target and
   fails on the wrong one; `alice_chair` fails on its correct target and
   **passes** on the wrong one. Cell 27 computes gaps for M2a and M4 only,
   then prints a claim about "M2". The C3 *conclusion* survives and is
   **strengthened** — M2b would actively prefer a wrong colour on
   `alice_chair` — but the evidence as written is wrong. Carry the
   corrected version forward: **M2b is strongly target-dependent**, which
   bears directly on treating 0.02 as a stable operating point at V02.

**Two under-deliveries to close in the same packet.** (a) `ADR-0012` §D5.4's
second half is not delivered: the swatch's **intra-file ΔE00 p90 must travel
with every number derived from it**, and no p90 is computed or recorded
anywhere — even the computed `swatch_disagreement_delta_e00` is dropped from
`pair_admission.csv`. Same class of obligation as the labelled-synthetic
rule: the caveat travels with the number. (§D5.4's *first* half is properly
delivered — `swatch_central_crop_disagreement` is a real enforced rejection
reason in `pair_admission.py`; it simply did not fire on these 8.) (b) §D7's
funnel omits the "19 material samples" and "95 full-product" stages;
defensible for a hand-picked 8-folder slice, but it must **say** that rather
than silently omit them.

**Do not widen this into a re-run with more pairs.** More pairs is the right
*next* run and it is what "revise" asks for, but it is a separate packet
with its own admission review. This one is a record-correction and
re-execution of the same four pairs.

**`ai-ml-lead` review round 2, 2026-09-15 (session 12): sign-off still
WITHHELD. Item 9 is NOT closed.** — **RESOLVED in round 3; retained as
history only. Everything in this block is done. Do not action it again; read
the round-3 sign-off that follows it.** Run `V01_20260915T045739Z`; the
rejected run `V01_20260915T043322Z` is correctly left in place.

**Closed and not to be re-opened.** Defect 1 — cell 38's source, its stored
output, and the archived `decision.json` now carry identical text; the
string "pass on 2 of 4" appears in none of the three. Defect 2 — cell 35 is
now a computed filter (`primary_df[~(m2a_pass & m2b_pass)]`) printing
"3 of 4", which is strictly better than a corrected literal because it
cannot drift again; prefer this form for every future assertion of this
kind. Defect 3 — `dark_to_light_risk` is correctly stated as 0.0 on all
four pairs (zero discriminative range) and `source_mask_l_std`'s +0.6068
as a larger-n candidate, not a mechanism; I recomputed the Pearson
coefficient from `predictor_comparison.csv` and it matches to 15 decimal
places. Both under-deliveries — `intra_file_delta_e00_p90()` exists in
`pair_admission.py`, is computed per swatch (2.706–21.932) and is carried
in `pair_admission.csv` next to `swatch_disagreement_delta_e00`; the funnel
now names the 19-material-sample and 95-full-product corpus-wide stages.

**Why sign-off is still withheld — defect 4 was half-fixed.** Cell 28 now
computes gaps for all three metrics (M2a 0.1433, M2b 0.6111, M4 0.0861) and
applies a pass/fail flip test — **but only to M2b**. It then prints, and
`decision.json` repeats in both `rationale` and `controls.C3`, that "M2a and
M4 behave exactly as ADR-0012 predicted (indistinguishable between correct
and wrong target)". Applying cell 28's *own* flip test to M2a at the 0.90
bar this run enforces, from this run's own `control_c3_wrong_target.csv`:

| pair | M2a correct | M2a wrong-target | |
|---|---|---|---|
| `artigiano_dining_chair` | 0.9434 PASS | 0.9985 PASS | wrong scores higher |
| `forma_sofa` | 0.9997 PASS | **0.8564 FAIL** | **verdict flips** |
| `alice_chair` | 0.9039 PASS | 1.0000 PASS | wrong scores higher |
| `poltrona_chair_studio` | 0.9925 PASS | 0.9615 PASS | — |

So the same cell applies one definition of "indistinguishable" to M2b
(verdict is stable across targets — falsified) and a different one to M2a
(the metric cannot identify the correct target — survives). Under either
definition applied uniformly, one of cell 28's two sentences is wrong. The
0.1433 M2a gap the cell prints *is* that flip, so the number contradicting
the claim is on the same line as the claim.

This matters beyond tidiness: the record's forward-looking conclusion is
that 0.02 must not be treated as a stable, target-independent operating
point. The identical statement is true of M2a's 0.90 bar on this data, and
the record instead reassures a V02 reader that M2a behaved as predicted.
That is the `ADR-0014` "record that argues with itself" failure reappearing
inside the fix for it.

**The fix, and it is the whole remaining scope.** Extend cell 28's flip test
to M2a (and print the M4 gap with an explicit note that V01 applies no M4
bar, so no flip test is possible — but that at V02's 0.98 bar the wrong
target would flip M4 on `artigiano_dining_chair` 0.9581→1.0 and
`poltrona_chair_studio` 0.9998→0.9137, so M4 must not be inherited as
target-independent either). Restate the C3 conclusion as: **M2a and M2b are
both target-dependent at their V01 operating points; neither identifies the
correct target, and neither holds a stable verdict across targets** — which
strengthens C3 again rather than weakening it. Mirror the corrected wording
into `decision.json`'s `rationale` and `controls.C3`, and re-execute into a
new `RUN_DIR`. Prefer computing the flip counts into the printed string
(cell 35's pattern) over hand-writing them.

**One non-blocking nit to fix in the same touch:** cell 36's markdown cites
"cell 34's own printed count: 3 of 4". The cell that prints that is index 35
(`execution_count` 19); index 34 is markdown. Either renumber or drop the
cross-reference.

**Nothing else is outstanding.** The `"revise"` outcome, the claim ceiling,
the metric set, the admission funnel, the controls' substance and all
computed CSVs remain correct — they are byte-identical to the rejected run,
as they should be, since only the record's description of them was at
issue. When the sentence above is corrected and re-executed, Item 9 closes.

**`ai-ml-lead` review round 3, 2026-09-15 (session 13): SIGNED OFF. Item 9
is CLOSED.** Run `V01_20260915T115907Z`; both superseded runs
(`V01_20260915T043322Z`, `V01_20260915T045739Z`) correctly left in place.

**Defect 4 is closed, and closed for all three metrics.** Cell 28 now
derives the flip verdicts from the dataframe rather than asserting them, and
prints counts from `len()` — M2a 1 of 4, M2b 2 of 4, M4 2 of 4 at V02's
unadopted bar. I re-derived every verdict from
`control_c3_wrong_target.csv` independently and each one holds:

| pair | M2a corr→wrong (0.90) | M2b corr→wrong (0.02) | M4 corr→wrong (V02 0.98, not applied) |
|---|---|---|---|
| `artigiano_dining_chair` | 0.9434→0.9985, both PASS | 0.3471→0.3409, both FAIL | 0.9581→1.0000 **flips** |
| `forma_sofa` | 0.9997→0.8564 **flips** | 0.0022→0.3627 **flips** | 1.0→1.0, no flip |
| `alice_chair` | 0.9039→1.0000, both PASS | 0.6146→0.0035 **flips (other direction)** | 1.0→1.0, no flip |
| `poltrona_chair_studio` | 0.9925→0.9615, both PASS | 0.1670→0.1722, both FAIL | 0.9998→0.9137 **flips** |

Both halves of the restated C3 conclusion are true on this data, not just
the half the round-2 finding named: **neither metric identifies the correct
target** (the wrong target scores *better* on M2a in 2 of 4 pairs and on M2b
in 2 of 4) and **neither holds a stable verdict across targets**. The
M4 caveat is correctly fenced as forward-looking — `V02_M4_BAR` is defined
inside cell 28, used nowhere else, and `metric_set.M4_silhouette_iou` still
records M4 as unthresholded. The string "M2a and M4 … indistinguishable"
survives nowhere.

**Verified independently, not taken from the summary.** Cell 38's stored
output is byte-identical to the archived `decision.json` (compared in full,
not grepped) — no hand-edited output. Code-cell `execution_count`s run 1–21
with no gaps, so this is one clean top-to-bottom execution, not a patched
re-run. `primary_metrics.csv`'s correct-target M2a/M2b columns match
`control_c3_wrong_target.csv`'s correct-target columns exactly on all four
pairs, so the control ran against the same results the primary table
reports. M2a pass rate 1.0 and M2b 0.25 recomputed from the per-row data.
`make test`: **126 passed, 92% branch**; every `evaluation/` module 98–100%.
The round-2 non-blocking nit is fixed (cell 36 now cites cell 35).

**What the sign-off does and does not authorise.** It closes the Item 9
packet and accepts `decision.json` as an honest record. The decision in it
is **`revise`** — evidence toward a future V02 call, on n=4 hand-picked
ATRIANI CGI renders. It is not a V01 pass, not V02/V03, not G1/G2, and moves
nothing on `OQ-009`/`OQ-010`/`OQ-011` or the ADR-0012 §D4 Delta-E tolerance.
The larger-n re-run that `revise` asks for is a **new packet** with its own
admission review.

**One follow-up, non-blocking, owner `tech-lead` — do not re-open Item 9 for
it.** `ADR-0012` §D6 pre-registers C3's required outcome as "M1, M2 and M4
are indistinguishable from the correct-target run", and cell 26 quotes that
wording verbatim. This run falsifies that literal operationalisation while
confirming and strengthening the control's actual purpose (nothing in the
V01 metric set evidences that the *right* colour was chosen). `decision.json`
handles this honestly — "reproduced their required outcomes … **with one
correction to C3**", with the per-pair flips spelled out — so the record is
not misleading and closure is not misleading. But `ADR-0012` §D6's C3
wording should be restated at V02 as *verdict stability and
target-discrimination*, not numeric indistinguishability, so a future reader
does not mark C3 failed against text the evidence has already outgrown.
This is a new finding about ADR text, not a continuation of defect 4, and
`AGENTS.md` §5's round cap applies: log it, do not cycle Item 9 again.

### Item 13 — Bundle composition closed in session 10

Implemented in `REC-A2-02`:

- `Product.fixture_label`, persisted through SQLite snapshot payloads
- `LogicOnlyBundleComposer`, wired into the recommendation API composition root
- deterministic category selection, budget filtering, revisioned substitution,
  and category-breaking substitution violations
- explicit `needs_input` violations for `OQ-002`, `OQ-004`, `OQ-007`,
  `OQ-009`, and `OQ-011`
- root suite-client expectation changed so recommendation bundles must not
  claim feasibility under ADR-0013 logic-only scope

Verification: recommendation `make test` passed with 264 tests at 91% branch
coverage, `make test-contract` passed with 17 tests, `make test-integration`
passed with 4 tests, Ruff passed, mypy strict passed on 55 source files, and
`ai_services/tests/test_suite_client.py` passed with 5 tests.

Standing limitation: this is not R03 acceptance, not a G2 sign-off, and not
evidence that recommendation meets acceptance thresholds.

Historical guidance retained for context:

The discipline already exists in this repo and should be copied exactly:
`recommendation/src/curalina_recommendation/adapters/fake_bundle_composer.py:15`
carries the labelled-synthetic obligation, and recommendation's A3
composition root seeds a *labelled* synthetic catalogue into SQLite rather
than fabricating a replacement product at request time. Follow that — the
label travels with every number derived from the fixture, as a field, not a
docstring.

The condition most likely to be missed is `ADR-0013` §D2 item 3: the four
validation arms that do not exist (style, colour, material, lighting) must
surface as **`needs_input` citing `OQ-002`/`OQ-004`/`OQ-007`/`OQ-009`**, never
as silent passes. The precedent is `check_cmr_validation`'s unconditional
`needs_input` on `OQ-001`. A bundle that "passes" because four of its five
validators are absent is the single most dangerous artifact this service
could produce. And the standing invariants apply: money is `decimal.Decimal`,
dimensions are integer millimetres.

### Items 15-17 — `/admin/product` and the variants mask gap (`ADR-0017`)

The `/admin/product` ask surfaced a gap that turned out to be two gaps, and
the second is the binding one. Read `ADR-0017` before touching any of the
three items; the short version:

**Masks are a human-authored input, not something the service produces.**
`agentic_flow/variant_generator_workflow.md:27-45` specifies manual
annotation first (`labelme` / notebook polygon tool), per-region, with
`protected_subregions` and `human_corrected` on the record. It says outright
that *"a product-wide mask is insufficient — legs, hardware, piping and
background must stay unchanged."* SAM is an optional accelerator **after**
the manual baseline, gated behind V01/V02 (`:49`), and V01 closed at
`revise`. So item 15 builds **ingestion**, not generation. A full-frame or
bounding-box mask is not a simplification of the spec, it is the thing the
spec names as wrong, and it will be rejected in review.

**Do not mint an `OQ-xxx` for this.** There is none —
`agentic_flow/open_questions.yaml` has zero mask/segmentation hits, and
`AMENDMENTS.md`'s two mask mentions (lines 108, 115) are not scope
amendments. `OQ-xxx` IDs are Design Manual gaps owned by the client or
design authority. This is internal engineering debt and belongs in the
dispatch table, which is where it now is. Citing a fabricated OQ to satisfy
the `needs_input` discipline inverts that discipline.

**Item 16 is the one that actually blocks honest output.**
`application/generate_variants.py` — the real LAB recolour path — has exactly
one caller in the repo and it is its own unit test. `workers/runner.py`
imports only `JobRecord`, `SQLiteJobStore` and `Settings`. So even with a
perfect mask, today's job returns a labelled-fake asset. Shipping
`/admin/product` against that would invite an admin to persist a fabricated
image into `products.images` — the same failure mode `ADR-0016` rejected on
the render path. That is why item 17's generation flow is blocked rather
than placeholder-ed.

Item 16 needs no model, no GPU and no client data: the LAB transformer is
stated to have *"no model dependency at all"* and to be unit-testable on
synthetic images on CPU
(`agentic_flow/15_variant_generation_technical_design.md`). `OQ-011` blocks
V01 *evidence claims*, not this wiring — do not use it as a reason to defer,
and do not use the wiring as a reason to claim V01 progress.

Acceptance worth stating up front for item 16: the output asset's pixels
must differ from the source **inside** the editable region and be
byte-identical **outside** it. That is the hard-composite guarantee at
`agentic_flow/variant_generator_workflow.md:92`, and it is a test, not an
aspiration.

For item 17, three things that are settled and should not be re-argued:
one job per colour (no batch endpoint exists, and N colours = N jobs is a UI
concern, not a reason to add one); "Accept" is two writes, the variants
review plus the monolith `products` write; and job success / candidate
approval / commercial availability stay three distinct states.

### Items 18-25 — the end-to-end demo push (`ADR-0018`)

Read `ADR-0018` before touching any of these. It traces the whole chain
from `Quiz.tsx` to `Results.tsx` against current source and corrects three
claims earlier sessions propagated. Per-item notes:

**Item 18 (rooms `provenance_mode`).** `provenance_mode` is **required with
no default**, and that is the whole point of the packet — an optional field
with a `MEASURED` default is exactly how the internal type
(`domain/render_request.py:131`) ended up silently declaring measured
geometry for synthetic runs. `ADR-0015` eliminated that structurally on
`RoomPrepResult.__post_init__`; do the same at the wire boundary. The
contract test to write is the negative one: a `RenderJobRequest` with no
`provenance_mode` must be rejected, not defaulted. Both consumers
(`render-job-client.ts`, `suite_client.py`) change in the same packet —
this is a major bump and a half-migrated contract is worse than either
state.

**Item 19 (`supplier_sku` on `BundleLineItem`).** Resist the temptation to
"simplify" by making `product_id` the SKU. `architecture/guides/03_data_contracts.md:9`
deliberately separates the stable internal `product_id` from the
`supplier_id` + `supplier_sku` compound natural key, and recommendation's
`ProductKey` (`domain/product.py`) already implements the compound key with
Unicode normalisation. The wire contract just never carried it. Add the two
fields optional-then-required; the app resolves with `getProductBySku`
(`server/storage-curalina.ts:372`), which already exists.

**Item 20 (`atmosphere`).** The current code comment saying *"`atmosphere`
has no source field anywhere on `quizResponses` today"* is **wrong** and is
the reason the AI path has never run. The live quiz step
(`ColorMaterialsStepV2.tsx:16-58`) offers eight palette ids that are
verbatim members of recommendation's `canonical_tags`
(`vocabulary_map_v1.yaml:14-40`), and `briefs_v1.json` already uses those
exact strings as `atmosphere`. This is admissible because it is **string
identity against a vocabulary the running service defines**, not a semantic
mapping — do not let it drift into fuzzy matching or a synonym table, which
would be fabrication.

Two traps. `ColorPaletteStepV2.tsx` is **dead code** with a different,
non-canonical option set (`Light Neutrals`, `Warm & Cozy`, `Colourful
Accent`) — `Quiz.tsx:23` imports `ColorMaterialsStepV2`, not that. And
before writing the mapper, **query the real `quiz_responses` table**: if
rows exist from an earlier quiz version using the dead vocabulary, they all
become `needs_input` and that is a migration decision, not a mapper
decision. `ADR-0018` names this as the most likely way D1 is wrong.

Multi-select handling follows the rule `UI-A5-02` already established for
`styles`: exactly one unambiguous value maps, anything else is
`needs_input`, never a guessed winner.

**Item 21 (missing endpoints).** Nothing to design — `storage-curalina.ts`
already has every method these handlers need (`getRenderProductsByRender`
`:1304`, `getSelectionLedgerByRender` `:617`, `getProduct` `:367`,
`getProductAlternatives` `:377`). Two things that are easy to miss: the
`GET /api/render/latest` route is registered *after* `GET /api/render/:id`
(`server/routes.ts:825` vs `:811`), so Express binds `:id = "latest"` and
it has always 404'd — move it up; and `orchestrateAiRender` writes a
`selectionLedger` row but never writes `renderProducts` rows, so
`/api/render/:id/products` returns `[]` for AI-path renders until that
write is added.

**Item 22 (reconciliation).** Poll from the app; do not add a webhook.
Rooms and variants must not acquire knowledge of the monolith's URLs — that
inverts the dependency direction this architecture is built on. And do not
reconcile inside `GET /api/render/:id`: `Loading.tsx` polls that endpoint
every 2 seconds and an outbound HTTP call there makes read latency a
function of service health.

The mandatory rule, and the one most likely to be quietly skipped: **a
rooms job that reports success but whose output asset cannot be retrieved
sets the render to `failed`, not `completed`.** That is every rooms job
today — `FakeGroundedGenerationAdapter` returns `asset_fake_<digest>` for
an asset that was never written. Mapping job-succeeded straight to
render-completed would reproduce, a third time, the fabricated-success
failure `ADR-0016` rejected and item 16's `except Exception: pass`
reintroduced. Test it explicitly.

**Item 23 (honest demo surface).** The hardcoded Pexels URL at
`server/routes.ts:792-793` is written with `status: "completed"`. Removing
it will look like a regression to anyone who believed it. That is the
point, and the STATUS header section above is written so the owner already
knows before the change lands.

**Item 24 (real catalogue).** `adapters/xlsx_workbook_reader.py` exists and
is referenced by nothing in `api/application_services.py` — the composition
root builds four hardcoded fixtures (`:51-63`). Swapping the importer is
the packet; the `LogicOnlyBundleComposer` stays exactly as it is.
`ADR-0013` §D3's forbidden phrasing is still binding — real catalogue data
does **not** convert a logic-only bundle into a feasibility or accuracy
claim, and nothing in this packet reaches G2.

Note the currency contradiction this exposes rather than papering over it:
the fixtures price in CAD (`application_services.py:43`) and the mapper
sends USD. See "What needs the client" item 14.

**Item 25 (tsconfig).** `include` currently lists `server/functions/**/*.ts`
— a copy of build output produced by `npm run build`, not the live tree.
Expect widening to surface errors in files nobody in this project has
touched. Fix them or annotate each with a reason; do **not** narrow the
glob back. Every "npm run check is clean" claim made about a `server/` file
before this packet is vacuous, for the same reason the 10a/10b claims were.

### On the orphaned legacy generation stack — do not act on this without the owner

`server/services/` contains a complete legacy image-generation stack
(`openai-render.ts`, `stability-ai-render.ts`, `stability-inpainting-render.ts`,
`gemini-image-only-render.ts`, `hybrid-compositing.ts`,
`room-composite-service.ts`, `render-qa.ts`, `spatial-fit-validator.ts`).
**Nothing in the live server tree imports any of it** — grepped across
`server/`, `client/`, `shared/`; the only hits are two comments in
`asset-import.ts`. The older compiled tree under `server/functions/lib/`
has no render-generation route either.

Two things follow. First, it is not a shortcut to a room image: using it to
fill the demo's picture would route around every gate `agentic_flow/`
exists to enforce, and `ADR-0018` rejects that explicitly. Second, whether
it should be deleted, revived or left alone is a question about the
*existing* product's roadmap and needs the owner's intent — it is not an
architecture ruling and no packet should touch it on its own initiative.

## What needs the client — escalate as concrete asks, not open questions

1. **`OQ-010` / G01 room scenes.** Stated as a shopping list because "what is
   the room geometry source" has been open without motion: *five real rooms;
   for each, photographs from the intended capture angle, measured floor
   dimensions, measured positions of every door and window opening along the
   walls, ceiling height, and — if available — the actual furniture present
   with catalogue identity and measured position. Plus written permission to
   use them as a development and evaluation corpus.* Also worth asking
   directly: **would floorplan drawings do instead of photographs?** They
   carry dimensions natively and `quiz_responses.floorplanUrl` already
   exists. That would change the problem substantially.
2. **Design Manual revision status.** The admitted PDF carries no version or
   revision marker. Confirm it is current, and confirm it is licensed for
   this use.
3. **`~/Downloads` is not a delivery path.** Two load-bearing client
   artifacts have now been found there by accident — the supplier image
   corpus (`ADR-0008`) and the Design Manual (`ADR-0009`). This is a process
   failure to raise, not a convention to adopt.
4. Unchanged and still outstanding from `ADR-0008`: supplier imagery usage
   rights; whether any AI imagery was placed deliberately; whether per-image
   colourway labels exist anywhere (**if they do, the no-ground-truth ruling
   reverses and V01 improves substantially**).
5. `OQ-013` narrowing (see `ADR-0009`) and `OQ-011` (`ADR-0005`,
   `ADR-0008`) — both still `open`. **`OQ-011`'s ask needs one correction
   per `ADR-0013`:** the accent-chair gap is no longer absolute (ATRIANI
   supplies five accent/arm chair products and an ottoman). Rugs, lighting
   and availability remain absent from all three sources. The accurate
   statement for the client is now: *"we have ~343 distinct case goods,
   seating and tables across two suppliers, plus 42 products across a third;
   we have zero rugs, zero lighting, and zero delivery/availability data
   anywhere."*
6. **`designers`: the variants Delta-E tolerance.** `ADR-0012` §D4.
   It is **not** an `OQ-xxx` and must not be filed as one: "Delta E"
   appears **zero times** in 169 manual pages, so it is not a manual blank
   but a designer agreement that has never been made. Ask concretely:
   *what CIEDE2000 tolerance, measured on agreed midtone patches, counts as
   an acceptable colour match?* — and show them that the supplier swatches'
   own intra-file Delta-E p90 is **8.06**, so a tighter tolerance is one the
   swatch fails against itself. V01 runs without this; V03/G1/G2 cannot.
7. **`design_authority`: `OQ-007`'s enumeration is incomplete.**
   `ADR-0014` §D4. §8.3 requires a **Fossil Node** (p149) that `OQ-007`'s
   named list omits — ask for the *complete* anchor library, naming Fossil,
   so the client does not answer the partial question. `OQ-007` is otherwise
   confirmed genuinely blank: **zero `#RRGGBB` tokens in all 169 pages.**
   Separately, §8.3's 6.3 "Millwork Engine" has **no tracked `OQ-xxx`** —
   decide whether it needs one.
8. **`design_authority`: one denominator answer settles both `OQ-002` and
   `OQ-003`.** Both are percentage-of-items rules whose *numerator* is
   defined and whose *denominator* is not. Verbatim, p4: *"70% of the pieces
   in an OM room must have a curved or radiused edge"*; p5: *"At least 80% of
   furniture must have space visible underneath it (tapered legs)"*. Ask one
   question, not two: *when the engine counts "pieces"/"furniture" for a
   style compliance percentage, what is in the set — every catalogue line
   item including accessories, or only floor-standing furniture, or only the
   items visible in the generated view?* The cheapest evidence they can give
   is a worked example: one real room, the item list, and the hand-computed
   ratio a designer would accept. `OQ-003` additionally needs a second
   number: *how much space underneath counts as "space visible" — a minimum
   leg height in mm?* No leg-height figure appears anywhere in the manual.
9. **`design_authority`: `OQ-004`'s "Material Volume" is never defined, and
   the section contradicts its own heading.** §7.3 (pp.145–146) gives three
   complete per-style ratios — OM 40 Anchor / 50 Comfort / 10 Feature, CL
   30/30/40, MS 60/30/10 — and calls the measured quantity *"Material
   Volume"*, but never says how volume is computed. Ask: *is the ratio
   measured by visible surface area in the rendered view, by item count, by
   footprint area, or by a designer's subjective visual mass?* Flag the
   inconsistency for them at the same time: §7.1 (p144) is titled *"The
   Material Hierarchy (The 60/30/10 Rule)"*, yet only MS is 60/30/10 — *is
   60/30/10 a default that per-style ratios override, or a stale heading?*
   Best evidence: one approved room image with the ratio they consider it to
   satisfy, computed their way. Note a third, separate ratio exists for
   millwork (§6.5, p140: *"style-specific 70/20/10 or dominant/accent
   logic"*) — do not assume it shares a basis with §7.3.
10. **`design_authority`: `OQ-006` is a hole in the document, not an
    ambiguity.** §3.5.2, p85, reads verbatim: *"If the 60% Foundation
    (Colour: Obsidian) and the 30% Neutral Accent (Graphite/Iron) are within
    of each other's Lightness value"* — a word or number is missing from the
    source after *"within"*. Ask for the missing value directly and for the
    scale it is on (*HSL L percentage points? LRV points?*), and while they
    are in that paragraph, ask them to confirm the rest of the sentence is
    intact. This is the same failure mode as `OQ-005`; two confirmed holes in
    one section is worth telling them about as a document-quality issue.
11. **`design_authority`: `OQ-008` has direction but no numbers.** §3.6
    (pp.87–89) fully specifies the *qualitative* wall-colour path — extract
    `Detected_Hex`/`Detected_HSL`/`Detected_Undertone`/`Detected_LRV`, test
    against style + tonality + undertone + HSL caps, reject and recalibrate
    to a named approved palette per style. What is missing is any number:
    **"LRV" appears on exactly one page of 169 (p87), as an output field
    name, with no numeric value anywhere in the document.** Ask: *for each
    style × tonality cell, what LRV range passes?* Nine cells (OM/MCS/CL ×
    Bright & Airy / Warm & Balanced / Dark & Moody) — a nine-row table is the
    entire answer and is cheap for them to fill in. If they cannot give
    bands, an equally usable answer is an approved paint list per cell with
    manufacturer LRV values, since we can derive bands from that.
12. **`OQ-012` cannot be resolved by more manual reading — it needs a
    business phasing decision.** The manual describes a real, detailed
    generated-architecture capability (§6.6 "Universal Hard-Coded
    Guardrails", pp.140–141: 1/2" shadow reveals, per-style edge treatments,
    mandatory cable concealment, at least one concealed lighting condition
    per unit, and an explicit *"No Standalone Catalog Pulls"* prohibition —
    fireplace/media/storage must be **generated**, not selected from
    catalogue). Against that, the MVP proposal scopes a living-room pilot
    with catalogue products only. **The words "MVP", "pilot" and "Phase 1"
    occur zero times in all 169 pages** — the manual describes one
    undifferentiated target capability and offers no phasing. Ask directly:
    *is generated millwork in or out of the first release?* If out, we need
    to know what a fireplace/media wall should do in the pilot, given §6.6
    forbids the obvious fallback of picking a catalogue unit. Secondary but
    cheap to ask in the same breath: **§6.6's dimensions are imperial
    (1/2" reveal, 2" channel)** and our contracts carry integer millimetres;
    1/2" is 12.7 mm, which is not an integer. *Are these nominal imperial
    values with intended metric equivalents, or is the manual's imperial
    figure the spec?* We will not pick a rounding rule for them.
13. **`OQ-011` gained nothing from the manual.** Recorded so it is not
    re-searched: the manual assumes a furniture catalogue exists (§§6, 7, 9)
    but neither supplies one nor addresses the gap. The `OQ-011` ask stands
    exactly as item 5 states it, sourced from the supplier data side
    (`ADR-0005`, `ADR-0008`, `ADR-0013`), not from the manual.

14. **Currency: USD or CAD? One sentence unblocks dispatch item 20.**
    Not an `OQ-xxx` and must not be filed as one — it is not a Design
    Manual gap, it is an unanswered business fact. The two halves of the
    system currently disagree: `design-profile-mapper.ts` would send `USD`,
    and recommendation's own catalogue fixtures price in **CAD**
    (`api/application_services.py:43`). The app's own price columns
    (`products.price`, `tradePrice`, `renders.priceAtRender`,
    `priceAtPurchase` in `shared/schema.ts`) are bare `decimal` with no
    currency annotation anywhere, so there is nothing in the schema to
    settle it. Ask concretely: *what currency are the Four Hands / Moe's
    workbook prices in, and is the storefront single-currency?* Until
    answered, `design-profile-mapper.ts` keeps returning `needs_input` for
    `currency` — which means **item 20 does not fully open the chain
    without this answer**, even after `atmosphere` is fixed. We will not
    infer a currency from supplier nationality.

**`agentic_flow/open_questions.yaml` has not been edited by any ADR to date.**
Client- and `design_authority`-owned questions are not closed on our reading
of their documents.

## Where to find information

**Decisions — which ADR governs what.** `ADR-0002` onward live in
`architecture/adr/`. **`ADR-0001` is not a file in that directory** — it is
`agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` (numbering note in
`ADR-0002:9`). Template: `architecture/templates/architecture_decision.md`.

| Decision | ADR |
|---|---|
| **Deterministic rules engine, not an ML system**; shared stack (Pydantic v2, `decimal.Decimal` money, integer-mm units, YAML rules compiled to frozen dataclasses, pytest + hypothesis, Ruff + mypy strict) | `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` (**= ADR-0001**) |
| Recommendation A1 HTTP wiring | `ADR-0002-recommendation-a1-http-wiring.md` |
| Rooms asset/review schema alignment | `ADR-0003-rooms-asset-review-schema-alignment.md` |
| Walkway clearance — interim interpretation (`OQ-013`) | `ADR-0004-walkway-clearance-interim-interpretation.md` (line 180 is **stale**; see `ADR-0009`) |
| Catalogue workbook provenance, `OQ-011` | `ADR-0005-catalogue-workbook-provenance-and-oq011.md` |
| R02 evaluation methodology (**read the in-place amendment block, not the struck original**) | `ADR-0006-r02-evaluation-methodology.md` |
| `Product.overview` field + workbook R01→R02 scope | `ADR-0007-r02-product-overview-field-and-workbook-scope.md` |
| Supplier image corpus provenance + V01 admissibility | `ADR-0008-supplier-image-corpus-provenance-and-v01-admissibility.md` (**corpus figures superseded by `ADR-0012`**) |
| Design Manual primary-source provenance | `ADR-0009-design-manual-primary-source-provenance.md` |
| Spatial-layout circulation endpoints (why doorway positions do not exist) | `ADR-0010-spatial-layout-circulation-endpoints.md` |
| G01 room-scene corpus does not exist | `ADR-0011-g01-room-scene-corpus-does-not-exist.md` |
| V01 reference-free evaluation design (metric set, thresholds, claim ceiling) | `ADR-0012-v01-reference-free-evaluation-design.md` |
| R03 no-go on real furniture data; synthetic-fixture conditions | `ADR-0013-r03-no-go-on-real-furniture-data.md` |
| D01 status + Design Manual §8's evidentiary role | `ADR-0014-d01-status-and-design-manual-section-8-evidentiary-role.md` |
| Synthetic/default-dimension room mode for E2E progress while G01 remains blocked | `ADR-0015-synthetic-room-mode-does-not-unblock-g01.md` |

**Build briefs, one per service** — `agent_instructions/00_design_rules_engine.md`,
`01_recommendation_service.md`, `02_variant_generator_service.md`
(its lines 64–72 "no product photos" blocker is **stale**, retired by
`ADR-0008`), `03_room_generator_service.md`,
`04_contracts_suite_and_ui_adapter.md`. Index: `agent_instructions/README.md`.

**Gate definitions and done-evidence** — `agentic_flow/*_workflow.md`, one
per service: `recommendation_workflow.md`, `variant_generator_workflow.md`,
`room_generator_workflow.md`, `contracts_and_suite_workflow.md`,
`ui_adapter_workflow.md`. The two gate systems are explained in
`agentic_flow/00_agentic_workflow_overview.md`. **The done-evidence clause is
the gate, not the test count** — that is how items 2 and 3 were missed.

**Technical designs** — `agentic_flow/12_design_rules_engine.md` (lines
151–160 provably over-specify §9.1; amendment owed),
`13_recommendation_technical_design.md` (`:176` names the five validation
arms), `14_room_generation_technical_design.md` (`:58` `load_cutout`, `:201`
G01 pass criterion), `15_variant_generation_technical_design.md` (`:111`
Delta-E tolerance "set with designers"; its `dark_to_light_risk()` is
evidenced as a wrong predictor — amendment owed).

**Corrections to the `architecture/` pack** — `agentic_flow/AMENDMENTS.md`.
Read the relevant entry before trusting any `architecture/guides/0X_*.md`
file. New corrections go here as targeted entries naming file and section,
never as a rewrite of the guide.

**Notebook standard** — `agentic_flow/16_notebook_standard.md`. A cell may
contain narrative, a plot, or a call into a package. Never business logic.

**Notebooks** — `ai_services/design_rules/notebooks/D01_rules_conformance.ipynb`
(the only executed-with-artifacts notebook under a package);
`architecture/notebooks/recommendation/{01_catalogue_audit,02_ranking_baselines,03_bundle_and_substitutions}.ipynb`
with executed run artifacts under
`architecture/notebooks/recommendation/runs/`;
`architecture/notebooks/variant_generator/{01_masks_and_colour,02_diffusion_comparison,03_evaluation_and_export}.ipynb`;
`architecture/notebooks/room_generator/{01_room_inputs,02_grounded_generation,03_room_evaluation}.ipynb`;
plus the reference skeleton `agentic_flow/R02_ranking_baseline.ipynb`.

**Work packets** — `ai_services/work_packets/` (21 completed:
`RULES-A0/A1/A2/A2b×2/A3/D01`, `REC-A0/A1/A2/A2-02/R01/R02`, `VAR-A0/A1/A2`,
`ROOM-A0/A1/A2`, `CONTRACTS-SUITE-A0/A4`). Template:
`architecture/templates/agent_work_packet.md`. Work is assigned one packet
at a time, per phase — never as "build the service".

**Open questions** — `agentic_flow/open_questions.yaml`. **`agentic_flow/`
is gitignored**: these entries will never appear in `git log`/`git show`, so
read the file directly and do not conclude from git that it does not exist.
Undefined rule or threshold ⇒ return `needs_input` citing the blocking
`OQ-xxx`. Never a guessed default.

**Contracts** — `ai_services/contracts/v1` (schemas), `ai_services/contracts/tests`.
Run with `make -C ai_services test-contracts`.

**Suite runner** — `ai_services/suite_client.py`, invoked by
`make -C ai_services run-suite`. Other targets in `ai_services/Makefile`:
`setup-all`, `test-all`, `test-contracts`, `clean`.

**Primary sources, outside the repository and outside version control** —
the Curalina Design Manual at
`/Users/rjsalmon/Downloads/Training Doc 1 - Design Manual.pdf`, 169 pages,
sha256 `7d450d28facc0ff87c40e7e6f5c33bbbb7f7d13e653aec6be07ced79b4c65cca`
(`ADR-0009`: read in place, cite by hash, never copied into the repo); and
the supplier image corpus at `/Users/rjsalmon/Downloads/Supplier Images`
(`ADR-0008`). Before declaring a client input missing, check there.

**The existing TypeScript monolith** — `docs/` (`replit.md` overview,
`PLATFORM_GUIDE.md` reference). Files cited by ADRs: `shared/schema.ts:279-283`
(doorway `{width, height, unit}`), `server/services/spatial-fit-validator.ts:45,77-110`,
`server/services/room-parser-service.ts`.

## Working practices worth not rediscovering

- **INCIDENT (2026-09-16, session 17): a background engineer agent's `git
  reset --hard HEAD` silently destroyed this entire file, twice.** This
  file had never been committed since session 3 — 14+ sessions of edits
  existed only as uncommitted working-tree state. `git reflog` showed two
  `reset: moving to HEAD` events; a hard reset discards uncommitted
  changes in every *tracked* file but leaves untracked files alone, which
  is why new Dockerfiles/ADRs/work-packet files survived untouched while
  this file (and, separately, `ai_services/room_generator`'s
  `errors.py`/`service.py`, breaking that service's real FastAPI app
  entirely) got silently wiped back to stale committed content. Neither
  loss was self-reported by whichever agent caused it — both were caught
  by the orchestrating session independently re-verifying a *different*
  packet's claims and noticing the surrounding damage. Recovered both
  times via `git fsck --unreachable` finding the pre-reset content as a
  still-uncollected dangling blob — this only worked because `git gc`
  hadn't run yet; it would not have been recoverable otherwise. **Fix
  going forward: this file is now committed after every major update**,
  specifically so a future stray `git reset`/`checkout`/`clean` from any
  agent can only lose the delta since the last commit, not months of
  institutional history. If you are an agent reading this: never run a
  repo-wide destructive git command (`reset --hard`, `checkout .`,
  `clean -f`) as a cleanup step in this project. If your own working tree
  looks wrong, stop and report it rather than resetting.
- **`agentic_flow/` is intentionally gitignored** (local-only). All `OQ-xxx`
  entries live there and won't show in `git log`/`git show`. Read the file
  directly. Its absence from git does not mean it is unused.
- **No push access to `origin`**: confirmed across sessions 1–3. Sessions
  4–8 did not retest it. Commits are local-only on `main`.
- **Batches of 3 independent-package Sonnet-tier agents in parallel have been
  fine every time tried** (sessions 1–2, A1 and A2 across the three
  services). Dispatch items 1–3 are exactly this shape.
- **Each Python package needs its own `.gitignore`** — all four current
  packages plus `ai_services/contracts` have one now.
- **Always independently re-run `make test`/`make lint`/`make typecheck`
  after any engineering agent reports success.** This is not a cautionary
  note, it is a confirmed recurring pattern — verification has caught a real,
  previously-undisclosed problem in every single session so far (session 1:
  rooms' mypy break from a transitive numpy dependency; session 2: two wrong
  factual claims in an ADR; session 3: nine, then two more, `evaluation/`
  modules at 0% coverage that the building agent's own report did not
  mention; session 8: two services' integration suites that were
  `assert True`). Specifically for coverage: **check per-module numbers, not
  just the aggregate** — an aggregate in the high 80s/low 90s hides
  individual modules at 0%, especially newly-added ones, because they are a
  small fraction of total statements.
- **Check the gate's own done-evidence clause, not just whether tests pass.**
  Recommendation and variants both had green suites and unmet A3
  done-evidence simultaneously.
- **When new source data turns up in an unexpected place, don't assume it is
  sanctioned input just because it is real** — get a `tech-lead` provenance
  ruling first. Precedented five times now: the catalogue workbook's
  discovery, its R01→R02 scope extension, the `Product.overview` field it
  justified, the supplier image corpus (`ADR-0008`), and the Design Manual
  (`ADR-0009`).
- **When a notebook skeleton or reference implementation assumes an input
  exists** (a fixture file, a labelled dataset, a specific column), **verify
  the input is present before dispatching engineering work.** R02's reference
  notebook assumed a 12-brief labelled evaluation set that existed nowhere;
  catching that before dispatch triggered the whole `ADR-0006` chain. Same
  category of check as V01's photos (`ADR-0008`) and G01's room scenes
  (`ADR-0011`) — both of which turned out to matter.
- **Do not assume the Design Manual resolves an `OQ-xxx` you have not
  checked.** Only `OQ-001`, `OQ-005`, `OQ-010` and `OQ-013` have been read
  against it. That is dispatch item 7.

## Known defects noticed, not acted on

- **Two `AMENDMENTS.md` entries are owed** and neither is written:
  1. `agentic_flow/12_design_rules_engine.md` lines 151–160 provably
     over-specify §9.1 relative to the manual — the whole-free-floor
     morphological opening is an artifact of those lines, not of the manual.
  2. `agentic_flow/15_variant_generation_technical_design.md`'s
     `dark_to_light_risk()` is **evidenced as a wrong predictor** of the
     failure it claims to detect (`ADR-0012` Finding 5): correlation with
     observed gamut clipping is **+0.034**, while the mask region's
     `std(L*)` correlates **+0.720**. Several worst cases are
     *light-to-dark*, which the formula scores as zero risk.
- `variant_generator/src/curalina_variants/api/sqlite_store.py:382`
  (`run_fake_job`) leases and completes a job inline. It is called **only
  from tests** — no `src/` caller — so the "inference never runs in a request
  handler" invariant is intact. But it is one call site away from violating
  it. Worth a comment or a move into test support when someone is next in
  that file. Not a blocker.
- FastAPI/Starlette `TestClient` deprecation warnings persist across
  variants and rooms against the currently installed `httpx` line. Unchanged,
  still not failing anything; worth remembering if the local dependency set
  changes.

---
---

# SESSION HISTORY (ARCHIVE)

**Read only if you need the reasoning behind a past decision. The
operational plan above is self-sufficient without it.** Several ADRs'
reasoning depends on figures recorded here — corpus counts, exact test file
contents, the methodology chain — which is why none of it is deleted. None
of it is current dispatch guidance.

## Commit history

`76c0984` (agent_instructions briefs) → `6889604`/`6c35d20` (agent roster) →
`9163002` (design_rules through A3+D01) → `fcdf1b8`
(recommendation/variants/rooms A0+A1) → `6241650` (status) → `914bdd7`
(ADR-0002/0003/0004 rulings, rooms schema fix) → `beab59a` (A2 fake-adapter
scope, all three services) → `c1bc6b6` (status) → `83e3a7f` (ADR-0004
implemented; ADR-0005 catalogue-workbook ruling) → `203649f` (R01 catalogue
audit complete) → `16da153` (status) → `aec8436` (R02 ranking baseline:
methodology chain + engineering + coverage remediation) → ... →
`2424e0c` (close items 18, 25; document the git-reset data-loss incident) →
`0f25a4a` (recover routes.ts AI-adapter wiring, schema.ts aiServiceRef) →
`ad355de` (recover variants mask/schema work, items 15-16) → `318679f`
(recover bootstrap.py, package-data, index.ts static-serving fixes) →
`5927e74` (session 18: post-auth dashboard flow; session cookie and DB
migration fixes).

Sessions 4–7 have uncommitted changes: session 4 cleared the ADR-0002
HTTP/application wiring gap across recommendation, variants, and rooms;
session 5 finished recommendation's remaining A3 persistence/process-serving
slice; session 6 finished variants' remaining A3 durable-store/worker/
process-serving slice; session 7 implemented the contracts A4 suite runner
across recommendation and variants, with rooms explicitly deferred. All on
`main`, none pushed to `origin`.

## Session 18 (2026-09-17) — post-auth dashboard, two live-found bugs, Express question

Two explicit asks from the project owner: (1) fix known issues, connect
the UI/frontend properly, and change the flow so authentication lands on a
dashboard with the quiz moved off it and an honest per-render history; (2)
answer whether the Express web app layer is still needed, documenting but
not executing any removal, with execution gated on reaching a stable
working state first.

### What was fixed, all independently re-verified rather than taken on a
subagent's report

Two work packets were dispatched (backend fixes; frontend dashboard
rebuild) and both were checked by driving the actual running app with live
browser automation — registering a real user, walking all 7 quiz steps,
inspecting network requests, checking the dashboard, clicking into a
render's detail view — the same verification discipline used throughout
this project, restated here because it is what caught the two defects
below that neither packet's own report surfaced.

**Backend:**
- `migrations/0003_demonic_magus.sql`: `renders.ai_service_ref` existed in
  `shared/schema.ts` (added by item 10c, session 16) but was never
  migrated onto the live Neon database — every `POST /api/render` 500'd.
  `drizzle-kit push` was checked and rejected before use: it would have
  silently dropped 11 live columns absent from `schema.ts`
  (`renders.rating`/`rating_feedback`/`rated_at`, `users.duo_*`, five
  `documentation_sections` columns) because `push` diffs directly against
  the live database rather than local migration history. `drizzle-kit
  generate` was used instead, producing a single additive-only statement,
  reviewed before applying.
- `server/localAuth.ts` register/login handlers: register previously
  returned `{id, email, role}` only; both now return the full profile
  (`firstName`, `lastName`, `profileImageUrl` included) matching what the
  client actually needs to render a name/avatar without a second request.

**Frontend:**
- `client/src/App.tsx`, `register.tsx`, `login.tsx`: post-auth redirect
  changed from `/` to `/my-dashboard` (admin redirect to `/admin`
  unchanged); `/dashboard` now redirects client-side to `/my-dashboard`.
- `client/src/pages/dashboard.tsx` deleted (thinner, non-auth-gated,
  superseded by `my-dashboard.tsx`); `client/src/hooks/use-auth.tsx`
  deleted as a duplicate of the canonical `useAuth.ts` (6 importers
  repointed: `AuthenticatedQuizButton.tsx`, `Header.tsx`,
  `StylesCarousel.tsx`, `HeroSection.tsx`, `Results.tsx`,
  `my-dashboard.tsx`).
- `client/src/pages/my-dashboard.tsx`: fixed a real bug found while
  extending it — `Render`/`RenderCard`/`SavedDesignCard` read flat
  `roomType`/`designStyle`/`thumbnailUrl` fields that do not exist on the
  `renders` table (the real data is nested under
  `render.quizResponse.roomType`/`.styles`; `thumbnailUrl` doesn't exist at
  all). Fixed to read the real nested fields. Render display made honest:
  a real `<img>` only when `status === "completed" && imageUrl`;
  `"generating"` shows a spinner; anything else shows
  `render.errorMessage` — verified live, a `needs_input` render showed
  correct metadata plus an honest placeholder, never a fabricated photo.

### Two defects found only by driving the live app myself, not by either
dispatched packet's own report

- **Session cookie silently dropped.** `secure: process.env.NODE_ENV ===
  "production"` in `getSession()` (`server/localAuth.ts`) meant no
  `Secure` cookie could ever be stored by a browser testing prod mode over
  plain HTTP (browsers refuse to persist a `Secure` cookie set without
  TLS) — registration succeeded server-side (confirmed via network
  inspection, `201` with a full profile body) but the user stayed logged
  out client-side, with no error surfaced anywhere. Root-caused by
  checking the actual `Set-Cookie` response header and the browser's
  cookie jar, not by reading the handler code in isolation. Fixed to
  `secure: "auto"` — `express-session` resolves this per-request via
  `req.secure`, which itself respects `app.set("trust proxy", 1)` against
  `X-Forwarded-Proto`, so production behind Firebase's HTTPS-terminating
  load balancer still gets a real `Secure` cookie; only the
  plain-HTTP-in-dev case changes.
- **`Results.tsx` broken image for `needs_input` renders.** No branch
  existed for `render.status === 'needs_input'`; it fell through to the
  default (completed) branch, which unconditionally rendered `<img
  src={render.imageUrl ?? ''}>` — a broken-image icon, since `imageUrl` is
  null in that state. Found by clicking through to a real
  `needs_input` render's detail page and seeing the broken icon directly,
  not by code inspection. Fixed by adding a `needs_input` branch that
  mirrors the existing `failed` branch: shows `render.errorMessage`
  (falling back to a generic "more info needed" message), an "Update
  Answers" button back to the quiz, and (when authenticated) a "Back to
  Dashboard" button.

### End-to-end live verification, through the known blocker

Full walkthrough via real browser automation, screenshots at each step:
register → cookie persists → lands on `/my-dashboard` authenticated →
"Start Quiz" → all 7 quiz steps → submit → `POST /api/render` succeeds
(post-migration-fix) → render row created at `needs_input` (expected —
item 20, the `atmosphere` mapping gap, is unchanged and untouched this
session) → dashboard shows one new entry with correct room/style metadata
and an honest non-photo placeholder, "Total Designs" counter correctly at
1 → click the entry → `Results.tsx` shows the new "More Info Needed" state
with the real blocking reason, not a broken image. This confirms items 1-3
of `ADR-0018`'s reasoning still hold and that nothing in this session's
work regressed them; item 20 remains the next real blocker in the chain.

Committed as `5927e74`, 16 files changed. Two files with unrelated,
pre-existing uncommitted changes from earlier session recovery work
(`room_generator` adapter files) were deliberately left unstaged rather
than bundled into an unrelated commit.

### The Express question

`ADR-0019` answers it: **no, not removable today.** Traced from the actual
code, not from assumption — `server/localAuth.ts` is the only place a user
identity/session exists; `shared/schema.ts`/Drizzle/the real Neon database
is the only system of record for users/products/carts/orders; and
`render-orchestrator.ts` is the only thing that sequences
recommendation → rooms and persists the result against a durable user
record. None of the three Python AI services has an equivalent — each is
deliberately a narrow, stateless-per-request domain service with its own
local database, per this project's "separate services, separate
databases" invariant, not designed to absorb identity, e-commerce data, or
cross-service orchestration. `ADR-0019` also records, as documentation
only and explicitly not authorized for execution, what a four-prerequisite,
five-step decommissioning path would look like if this answer ever
changes after real usage data justifies revisiting it. Per the project
owner's explicit instruction, no part of that path is to be started before
the system reaches the stable, fully-working state items 19-24 are aimed
at.

## Session 8 (2026-09-14) — full sweep of everything blocked or queued

Produced **six** ADRs — `ADR-0009`, `ADR-0010`, `ADR-0011` (`tech-lead`),
then `ADR-0012`, `ADR-0013`, `ADR-0014` (`ai-ml-lead`) — one implemented
code change, one independent re-verification of every service's test suite,
and several corrections to prior claims.

**The three `ai-ml-lead` ADRs closed every remaining methodology blocker.**
V01 became dispatchable (`ADR-0012`), R03 a recorded no-go (`ADR-0013`), and
D01 kept its status but needs a scoped re-run (`ADR-0014`). Note `ADR-0012`
**corrects `ADR-0008`'s corpus figures**: the usable working set is 95
product images across 26 folders, not 163 across 41.

### The headline: the Design Manual exists and nobody knew

For seven sessions this project treated the Curalina Design Manual as an
absent artifact. **It is at
`/Users/rjsalmon/Downloads/Training Doc 1 - Design Manual.pdf`** — 169 pages,
sha256 `7d450d28facc0ff87c40e7e6f5c33bbbb7f7d13e653aec6be07ced79b4c65cca`.
`ADR-0009` is the provenance ruling; read it before citing the manual.

Provenance is confirmed three ways (the `[blank]` in `OQ-005` is physically
absent on p81; §9.1/§9.2.1's numbers match `OQ-013` exactly; mtime is the day
`agentic_flow/` was authored). It is admitted **read-in-place, by hash, never
copied into the repo** — rights are unestablished and its revision status
relative to what the client holds is unknown.

What it settles:

- **`ADR-0004`'s interim walkway reading is corroborated by the primary
  source.** All 169 pages searched for `walkway`/`circulation path`/
  `access path`/`dead zone`: 9 hits, every one path/corridor language, **zero
  whole-floor language**. p151 lists "minimum walkways, access paths, and
  **functional spacing**" as three *distinct* things — the manual itself
  separates §9.2.1 furniture gaps from walkways, which dissolves `OQ-013`'s
  conflict at its source. The whole-free-floor morphological opening is an
  artifact of `agentic_flow/12_design_rules_engine.md` lines 151–160, not of
  the manual.
- **`ADR-0004` line 180 is now stale.** §8's worked examples are not missing.
  They exist (pp147–150) and are **colour/material/tectonic proofs with zero
  spatial content** — §8 is simply silent on space planning. That
  falsification route is *closed*, not passed.
- **`ADR-0004`'s endpoint set is too narrow, and this is now a known defect.**
  The manual names walkways that are neither doorway↔doorway nor
  doorway↔zone: 30" behind-sofa path (§9.2.2), 36"/44" dining Pull-Back Zone
  and 48" Credenza Buffer (§9.3.1). Safe direction, but under-reports.
- **`OQ-001` (CMR) confirmed genuinely undefined** — "Circulation-to-Mass
  Ratio" appears twice in 169 pages, both as a bare name in a list. No
  formula. `check_cmr_validation`'s unconditional `needs_input` is correct.
- **`OQ-013` is narrowed, not closed.** Closing a client-owned question on my
  reading of their document is not mine to do.
  `agentic_flow/open_questions.yaml` was **not edited**.

**Do not assume the manual resolves the other `OQ-xxx`s.** Only `OQ-001`,
`OQ-005`, `OQ-010` and `OQ-013` were examined. Each of the rest needs its own
targeted read — a cheap `research-scout` pass over the pinned PDF.

### Re-verification: two things prior sessions claimed that do not hold

Every service suite was re-run from scratch this session. **The headline
numbers all matched** (design_rules 80/91%, recommendation 259/91% + 17
contract, variants 71/89% + 27 contract + 2 worker, rooms 60/96% + 34
contract, root contracts 7 — all Ruff and `mypy --strict` clean, and no
module sits at 0% coverage). But:

#### 1. Recommendation and variants are NOT at full A3. The gate evidence is a stub.

`ai_services/recommendation/tests/integration/test_integration_scaffold.py`
and `ai_services/variant_generator/tests/integration/test_integration_scaffold.py`
are both, in full:

```python
def test_integration_suite_placeholder_passes_until_a3() -> None:
    assert True
```

Both services' A3 **done-evidence is explicitly integration-level**:

- Recommendation (`agentic_flow/recommendation_workflow.md:78`): "integration
  tests cover **repository rollback, process restart, and malformed-workbook
  import**". None of the three exists anywhere.
- Variants (`agentic_flow/variant_generator_workflow.md:63`): "integration
  tests cover restart recovery and **all job-lifecycle cases above**". Of the
  six mandatory job tests (`:61`), three are covered in the *unit* suite
  (fencing via `test_sqlite_store_rejects_wrong_worker_completion`,
  idempotency-409 via `test_sqlite_store_rejects_changed_idempotency_payload`,
  restart via `test_sqlite_job_survives_app_restart_and_worker_completion`)
  and **three are not covered at all**: lease expiry, worker dies after claim,
  cancellation racing completion, plus the separate "asset write succeeds but
  DB commit fails" case. The `lease_expired` branch at
  `variant_generator/src/curalina_variants/api/sqlite_store.py:287` has no
  test exercising it — which is why that module sits at 77%.

**The correct reading is "A3 engineering is done; A3 done-evidence is not."**
Sessions 5 and 6 built real durable storage, real leasing, real fencing and
real worker/process serving — that work is sound and verified. What is
missing is the evidence the gate names. These are small, tightly-specified
test packets, not redesign.

**This does not retroactively invalidate A4.** A4 asks that services behave
correctly over HTTP under the suite runner, and session 7's
`make -C ai_services run-suite` demonstrated that empirically end to end —
a stronger check for A4's specific purpose than the missing integration tests
would have been. A4 stands.

#### 2. `attached_assets/Four Hands Accent Chairs_1763831596643.xlsx` contains zero accent chairs

`ADR-0005:34` listed this file as "a separate 28-column single-supplier sheet,
not merged into the combined workbook" without inspecting its contents. It has
**20 data rows: 19 `Bench` and 1 `Ottoman`.** The filename does not describe
the file. It does carry an `Inventory` integer populated 20/20, but
`LEAD Time` and `Delivery Options` are 0/20.

Effect on R03: **`ADR-0005`'s no-go is reinforced, not weakened.** The one
file that looked like it might supply accent chairs supplies none.

#### And one prior claim that independently re-verified as correct

`ADR-0005`'s "zero rugs, zero lighting" was re-checked properly. A naive
keyword sweep of the combined workbook returns 89 matching rows, which looks
alarming — but all 89 hits are in `Overview` (71), `Colour` (33, e.g. "light
oak") and `Product Name` (5). The `Furniture Category` column contains
**no lighting category and no rug category**, exactly as `ADR-0005` states.
Worth recording that the check was done rather than leaving the 89 to scare a
future session.

### What was unblocked in session 8

#### `curalina_design_rules` — ADR-0004 wiring: DONE, item closed permanently

Queued three sessions with "nobody has investigated whether doorway positions
exist". The investigation is done and the answer is definitive: **they do not
exist and were never going to.** `ADR-0010` has the full trail:

- `RoomGeometry` (`types/geometry.py:18`) carries a boundary polygon and no
  openings.
- The production app captures doorway **size, never position** —
  `shared/schema.ts:279-283` is `{ width, height, unit }`, three scalars.
- That field exists for **delivery fit**, not circulation:
  `server/services/spatial-fit-validator.ts:77-110` uses it to ask whether a
  product's diagonal passes through the opening. Its other check tests the
  room bounding box against a hardcoded `MINIMUM_CLEARANCE_INCHES = 30`
  (`:45`). Neither needs a position.
- `server/services/room-parser-service.ts` prompts for "doorway/entryway
  dimensions (**critical for furniture delivery**)" from a *text
  description*. It could not produce a position if asked.
- The manual says positions come from §10 STEP 2 photo/floorplan extraction
  (p162) — with no method, accuracy, coordinate frame or scale. That is
  `OQ-010`, unresolved.

**Implemented** (small, mechanical, decision-implementing, per `ADR-0010`):
`evaluate_spatial_layout` now takes optional keyword-only `doorway_points` /
`functional_zone_points`, calls `check_walkways_adr0004`, and returns
`needs_input` citing `OQ-013` when endpoints are absent — which is every
caller today. `RuleResult` gained `interim_markers`, carried on **pass as well
as failure**, because `ADR-0004` requires a marker on accepted layouts and a
pass produces no `Violation` to hang one on. `check_walkways`/`has_walkway`
are retained untouched as the rollback path. Additive/minor; no
`rules_version` bump; no consuming-service sign-off needed (nothing calls it
in production code yet).

Verified: **83 tests (was 80), 92% branch (was 91%), `api.py` 100%,
`spatial/geometry.py` 96% → 100%**, Ruff and `mypy --strict` clean. All four
packages plus the root contracts suite re-run with no regression
(83 / 259 / 71 / 60 / 7).

This item is **closed as engineering.** What remains is `OQ-010`, a client
blocker, tracked where client blockers belong — not as a backlog item.

#### Rooms G01 — investigated, and it has the hidden problem

`ADR-0011`. Same pattern as R02's missing briefs and V01's missing pairs, but
**worse, because it has no reference-free escape hatch.**

G01's prerequisite is not "room photos". It is five *scenes*: photo +
**true measurements** + manually annotated floor corners + planned placement
in millimetres. Its pass criterion
(`agentic_flow/14_room_generation_technical_design.md:201`) is "image-space
placement matches planned **mm** within tolerance on 5 scenes", and the
notebook's own promotion cell says "**Do not infer exact real-world
measurements from image pixels**". The millimetres *are* the reference, so
unlike V01 there is no metric to reframe toward. A room photo without
measurements is not a partial G01 input; it is not an input.

Searched everywhere. Nothing qualifies. **Explicitly ruled inadmissible, so
nobody re-derives this:**

- `attached_assets/generated_images/**` (20 files) — AI-generated style
  boards. Synthetic rooms have no true measurements to be scored against.
- `attached_assets/stock_images/**` (24 files) — real photos, but no
  measurements, pose, scale, known placements, or rights. **This is the
  tempting one.** A future session will find
  `stock_images/modern_living_room_i_79b08ae6.jpg` and think it might work.
  It does not.
- `attached_assets/render-*.png` — system outputs, not validation inputs.
- `LAZZONI` in-situ photography — already excluded by `ADR-0008`.
- `quiz_responses.roomPhoto` / `floorplanUrl` — customer uploads, no rights
  or privacy answer.

**But rooms' A3 engineering is NOT blocked, and the status doc had these
conflated.** G01 gates the *model-backed* render path only. Durable job
storage, worker claim/lease/fencing, checkpointing between staged insertions,
bounded attempt counts and process-level serving all use the fake
`ImageEditor` adapter, need no room scenes, and are dispatchable today.

#### Contracts A4 — stands; rooms' participation still deferred

Session 7's suite runner was re-verified (7 tests pass). A4 does not need the
missing A3 integration tests. Rooms joins the suite once rooms has durable
storage and a worker.

### `ai-ml-lead` rulings — all four items A–D decided (2026-09-14, same session)

A–D below were briefed to `ai-ml-lead` and are **decided**, in `ADR-0012`,
`ADR-0013` and `ADR-0014`. Read the ADRs, not this summary, before acting.
Headlines and the things a future session is most likely to get wrong:

#### A → `ADR-0012`: V01 reference-free evaluation design. **V01 is dispatchable.**

The reframe: V01 measures **attainment of a requested colour**, never
fidelity to a reference. The target is an *input to the system under test*,
so measuring "did it get the colour it was asked for" is legitimate;
"does it match the true variant" is not available and its use is
falsification.

**A methodology probe over 276 real (image, swatch) pairs found that two of
the three properties `ADR-0008` floated are at ceiling by construction:**

- Protected-pixel invariance: observed values across 276 pairs are
  **`{0}`** — zero variance. `hard_composite` guarantees it. It is an
  assertion, not a measurement, and earns no gate credit.
- Delta-E to target: median **0.517** — the algorithm *assigns* `a*,b* =
  target`. Its residual correlates **+0.796** with gamut clipping, so it is
  a derived clipping statistic. **Demoted.**
- What actually varies: **L\* variance ratio (0.237–1.000)** and
  **gamut-clipped fraction (0.000–0.735)**. These are V01's real signal.

Had V01 been dispatched against `ADR-0008`'s properties as stated, it would
have returned a near-perfect score proving only that the arithmetic was
transcribed correctly. That is the R02 prevalence-baseline failure in a new
domain.

**Four corpus findings that correct or extend `ADR-0008` — do not use its
figures:**

1. Working set is **95 full-product images across 26 folders**, not "163
   across 41". The 163 figure counts name-admitted files, not usable
   products. **14 of 40 folders have zero usable product images.**
2. Folder count after exclusions is **40, not 41**. **`Zuma Side Table`
   drops too** — all its webp are `-150x150`. Never named before.
3. **19 of the 163 admitted webp are material/finish swatches, not
   products.** `AI01` is byte-identical across 7 folders; I opened it — it
   is a brushed-steel texture. A second contamination class that filename
   screening also misses, and it has nothing to do with AI generation.
4. **The best score in the entire probe belongs to a fabric swatch** run
   with a full-frame mask: 0 changed pixels, Delta-E **0.000**, zero
   clipping. The metric set cannot detect it. This is why `ADR-0008`'s
   human per-file review is load-bearing, not belt-and-braces.

**Also: `agentic_flow/15_variant_generation_technical_design.md`'s
`dark_to_light_risk` is wrong on this corpus.** corr with the actual
failure is **+0.034**. The real predictor is the mask region's lightness
spread, corr **+0.720**. Deserves an `AMENDMENTS.md` entry; not written.

**The Delta-E tolerance is `needs_input` and has NO `OQ-xxx`** — "Delta E"
appears **zero times** in all 169 manual pages, so it is not a manual blank.
It is a new designer-agreement gap. **V01 runs without it**; the structure
metrics carry the decision. When asking designers, show them the one number
that makes the question answerable: the swatches' own intra-file Delta-E p90
is **8.06**.

**Claim ceiling (binding):** no G-series gate, no camera-photography claim
(assets are CGI renders), no colour-accuracy claim, no "synthetic-free
corpus" claim, no Delta-E claim, and **the word "held-out" may not appear**
until the LUXUS run exists — ATRIANI is a development set.

#### B → `ADR-0013`: R03 is a **formal no-go on real furniture data.** Recorded, not pending.

Bundle composition proceeds **logic-only against labelled-synthetic
fixtures** — legitimate per `recommendation_workflow.md:18`/`:62`.
**G2 is not reached.** Permitted phrasing is *"R03: no-go on real furniture
data; composition logic exercised against labelled-synthetic fixtures
only."* Forbidden: "bundle composition is accepted", "meets acceptance
thresholds", "R03 complete", "G2 reached".

**The no-go rests on two independent grounds, and this matters:**

1. **Data.** Zero rugs and zero lighting in all three catalogues
   (re-verified by `ai-ml-lead` directly against `Furniture Category`: 27
   distinct tokens, the only chair-ish ones are `Dining Chairs` 94 and
   `Reading Chair` 6). Zero availability data anywhere.
2. **Engine.** Four of the five validation arms
   `13_recommendation_technical_design.md:176` requires — style (§1),
   colour (§3), material (§7), lighting (§9.6) — **do not exist**;
   `style.py`, `palette.py` and `pruning` are absent, each blocked on
   `OQ-002`/`OQ-004`/`OQ-007`/`OQ-009`.

**So a perfect catalogue delivered tomorrow would not unblock R03.**
"Wait for the catalogue" is not a plan. **Reversal requires both halves.**

One correction to prior sessions: **the accent-chair gap is no longer
absolute.** ATRIANI supplies `Cielo Accent Chair`, `Vela Arm Chair`,
`Abbraccio Armchair`, `Poltrona Chair Studio` and `Minimalo Ottoman`. Rugs,
lighting and availability remain absolute across all three sources. The
client ask should be corrected accordingly.

#### C → `ADR-0014`: D01 **stays `accept-with-limitations`. Re-run required, not a note.**

Both named blockers resolve — `MIN_WALKWAY` dissolves into `needs_input`/
`OQ-013` under `ADR-0010`, and §8 is *inapplicable* (zero spatial content)
rather than unavailable — **but D01 does not promote.** `OQ-001`/CMR is
untouched, four rule families are unbuilt, and a **new and worse limitation
appears**: D01 cell 7 synthesises `bed_point = Point(10, 10)` and
`ensuite_point = Point(boundary[1].x_mm - 10, 10)`. Those are invented
coordinates — exactly what `ADR-0010` option (c) rejected and `ADR-0004`
forbade. **The recorded `BR_ENSUITE_PATH` hard violation is a verdict
computed from fabricated input.** `ADR-0010` retroactively made an existing
artifact non-conformant without anyone touching it.

Re-run is required because the archived `metrics.csv`/`all_violations.csv`
assert severities the code no longer produces. **Scope is fixed at
`ADR-0014` §D2's four items.** Preferred fix for the endpoints is moving
them into `golden_scenarios.py` as declared, labelled-synthetic fixture
fields — a fixture may declare its own synthetic geometry; a notebook may
not mint it inline.

Also worth keeping: **D01's `MIN_WALKWAY` finding was correct** and is now
corroborated by the manual. The re-run must record that the notebook caught
a real defect, not silently drop the finding.

**D01 is at its ceiling.** Everything still holding it down is
`design_authority`-owned. Do not re-queue it as an engineering item.

#### D → `ADR-0014` §D4: §8 is a **conformance target, not an evaluation set.** Addressed.

n=4, no held-out split possible, expected outputs are material nouns not
measurable quantities, and **all four scenarios are currently un-runnable**
(each needs ≥2 unbuilt modules and ≥2 open questions). `ADR-0014` §D4
carries the per-scenario dependency table — that table is the useful
output, because it turns "the §8 examples exist" into four actionable asks.

**No number derived from four narrative cases may be reported as an
evaluation metric, and §8 must not be used to promote D01, R02 or R03.**

Two new findings for `design_authority`: **`OQ-007`'s enumeration is
incomplete** — §8.3 requires a **Fossil Node** (p149), absent from
`OQ-007`'s named list, so ask for the *complete* library; and **`OQ-007`
stands in full**, verified by **zero `#RRGGBB` tokens across all 169
pages**. Separately, 6.3's Millwork Engine has **no tracked `OQ-xxx`** at
all.

`agentic_flow/open_questions.yaml` was **not edited** by any of the three
ADRs.

### Original session-8 brief to `ai-ml-lead` (superseded by the rulings above; kept for the constraints it records)

#### A. V01 reference-free evaluation design (blocking; the long pole)

Carried over from `ADR-0008` and still outstanding. `tech-lead` has ruled on
provenance and admissibility; the *methodology* is explicitly not mine.

**What they must decide:** what a V01 pass means when no ground-truth colour
variants exist, and whether the result constitutes an accepted baseline.

**Constraints they are working with:**
- Corpus: `ATRIANI` only for run 1 — ~163 images across 41 folders after
  exclusions, allowlisted from `Design 44.xlsx`'s `Linl to pictures ` column
  (sic). `LUXUS` is pre-approved as a held-out generalisation set for run 2.
- **No ground truth.** Image-filename finish codes match the manifest's
  `Finish` in **2 of 42** folders and sibling swatch filenames in **3 of 42**.
  89 of 197 webp files carry no finish code at all. Swatches are *target
  colours to transfer toward*, not *target renderings to compare against*.
  Any metric of the form "how close to the true variant" has fabricated its
  reference.
- Candidate reference-free properties named in `ADR-0008` (not endorsed as
  sufficient — that is the call): protected-pixel invariance;
  geometry/texture preservation outside the mask; whether the transferred
  region lands on the intended swatch colour in LAB.
- The assets read as **CGI renders, not camera photographs** — uniform
  lighting, no sensor noise, geometrically perfect edges. Evidence it works
  here is not evidence it works on real photos.
- Two known AI-generated files must be excluded by name; **filename screening
  is necessary but not sufficient** — a renamed generated image is
  undetectable, so nobody may claim the corpus is synthetic-free.

**Deliverable:** a written evaluation design. Do **not** dispatch a V01
notebook packet before it exists — that is exactly the failure R02 hit.

#### B. R03 formal no-go (ready; evidence is now complete)

`STATUS.md` has said for several sessions that R03 is "likely a no-go but
that's `ai-ml-lead`'s call". The evidence is now closed and they can rule
without a lingering thread:

- `ADR-0005`: the combined 385-row workbook has **zero rug rows and zero
  lighting rows** in `Furniture Category` — independently re-verified this
  session against the column itself, not a keyword sweep. No accent chairs.
  No availability data.
- **New this session:** `Four Hands Accent Chairs_1763831596643.xlsx` is
  19 benches + 1 ottoman. The last "but maybe this file helps" thread is
  closed.
- `ADR-0008`: `Design 44.xlsx` (ATRIANI, a **third supplier** absent from
  the project's records — 42 products, 128 options, prices, dimensions) has
  no rugs and no lighting either, so `OQ-011`'s substance is unchanged.

**The decision:** record a deliberate no-go on real data and proceed
logic-only against labelled-synthetic fixtures — a legitimate, precedented
outcome per `agentic_flow/recommendation_workflow.md`'s own gate table — or
rule otherwise. Either way it needs to be *recorded*, not assumed.

#### C. D01 re-run and conformance status (ready)

Two things changed under D01 this session:

1. `ADR-0010` changed what `evaluate_spatial_layout` returns.
   `ai_services/design_rules/notebooks/D01_rules_conformance.ipynb` calls it,
   so its recorded results are now stale. `MIN_WALKWAY` will come back as
   `needs_input` on `OQ-013` rather than a hard violation.
2. `ADR-0004` line 180 named **two** blockers on D01's clean accept: the
   §9.1 ambiguity and the missing §8. Per `ADR-0009`, §8 is not missing —
   it is *inapplicable* (no spatial content). Whether that changes D01's
   accept-with-limitations status is theirs to say.

#### D. Optional: are §8's four scenarios an evaluation set? (new)

§8 (pp147–150) is four **client-authored** quiz-input → expected-composition
pairs, stated as "a 'Test Run' of these specific quiz combinations must result
in the architectural compositions described below". This is the **only
client-authored ground truth found anywhere in this project**. They are
narrative (colour/material/tectonic), not numeric, and there are four of them.
Whether four narrative cases constitute an evaluation set for D01 or R02/R03
is an evidence-sufficiency question, not a boundary question.

## Session 7 — contracts suite A4 for available services

The root `ai_services` suite runner is no longer an A0 dry-run stub:

- `make -C ai_services run-suite` starts recommendation (`8101`) and
  variants (`8102`) as local uvicorn processes with explicit environment
  variables and independent temporary SQLite databases.
- The suite talks only over public HTTP endpoints. It does not import
  service internals, open service SQLite files, or read service-local asset
  paths.
- The verified flow is catalogue import → recommendations → bundle →
  variant asset import → variant job creation → one worker pass →
  candidate review.
- It checks schema/version continuity, ID prefixes, bundle revision,
  variant content hash, job success, candidate ID, and review revision.
- Rooms are named as deferred in suite output; no room render is submitted.
  This matches the current direction to delay image and room renders until a
  catalogue image set is available, and rooms still lacks full A3 durable
  storage/worker execution.
- New root suite tests cover dry-run/deferred reporting, occupied-port
  failure naming, field-mismatch failure naming, and the variant hash/job/
  review round trip without network binding.

Verification from session 7:

- `make -C ai_services test-contracts`: 7 tests passed.
- `make -C ai_services run-suite`: passed after installing the declared
  recommendation/variant runtime dependency `uvicorn` and running with
  loopback bind permission. Output included
  `recommendation->variants flow passed
  (snapshot=snap_a3fixture0001, bundle=bundle_fake_0001@1,
  variant_job=job_000001, candidate=cand_000001)` and named rooms as
  deferred.

## 2026-09-14 — supplier image corpus found; V01 partially unblocked (ADR-0008)

> Corpus **figures** in this section are superseded by `ADR-0012` (95 usable
> product images across 26 folders, not 163 across 41; 40 folders after
> exclusions, not 41; 19 admitted webp are swatches, not products). The
> admissibility conditions, path-handling ruling and contamination findings
> below all still stand.

A local, **out-of-repository** directory
`/Users/rjsalmon/Downloads/Supplier Images` was found containing real
supplier furniture imagery. `ADR-0008`
(`architecture/adr/ADR-0008-supplier-image-corpus-provenance-and-v01-admissibility.md`)
is the ruling. Read it before touching V01. Headlines:

**V01's "no product photos" blocker is retired. V01 is now blocked on
methodology instead.** Real, full-product, uniform-white-background
furniture assets at 2048–2560px exist for 42 products. The blocker in
`agent_instructions/02_variant_generator_service.md` lines 64–72 no longer
describes reality.

**This is furniture PRODUCT photography. It is not room photography.**
Nothing here touches room generation. G01 is room prep/homography from a
*customer room photo*, and `OQ-010` (`ROOM_GEOMETRY_SOURCE`) blocks
certified room-scale claims. Product photos supply no room geometry, no
camera pose, no scale reference. **G01 is exactly as blocked as before.**
If someone asks "how does this help room render", the answer is: not yet,
and not the way you think. There *is* a real downstream link —
`agentic_flow/14_room_generation_technical_design.md:58` calls
`load_cutout(placement.variant_id or placement.product_id)`, and ATRIANI's
white backgrounds are the best cutout source in the project (alpha matte by
thresholding, no segmentation model). The chain is
`ATRIANI base image → V01 colour transfer → cutout → rooms composite`. That
is downstream of G01 and does not advance it.

### What is approved to build against

**`ATRIANI` only, for the first V01 run.** 42 product subfolders plus
`ATRIANI/Design 44.xlsx` at the folder root — which is the key file and was
nearly missed. That sheet (`design 44 product development`, 128 rows) has a
`Linl to pictures ` column (sic, trailing space, misspelled) whose 42
distinct values match the 42 image subfolders **exactly, with zero orphans
in either direction**. It also carries `Finish`, `Price`, and
`Overall Length/Depth/Height` (+ `Seat Height/Depth` on 33 seating rows).

Sheet defects — report, do not silently repair: `Name` blank on 17 rows
(multi-option products inherit the name implicitly); repeated header rows
embedded in the data; `Deficiency` holds product variant names on 11 rows
and is not a deficiency column; dimensions are decimal inches with `/` as
the N/A marker (project invariant is integer millimetres — state the
rounding rule); `Finish` is free text with embedded swatch codes and no
delimiter contract (`Wing and Headrest: L64, Headboard: ...`), so parsing it
into `(part, code)` pairs is **not** deterministic on this data.

### What is explicitly NOT approved

- **There are no ground-truth colour-variant pairs. Do not build as if
  there are.** The earlier scan inferred a "base photo + matching swatch"
  pairing from one folder. I tested all 42: image-filename finish codes
  match the manifest's `Finish` codes in **2 of 42** folders, and match
  sibling swatch filenames in **3 of 42**. 89 of 197 ATRIANI webp files
  carry no finish code at all (Portuguese view names —
  `CADEIRA-CIELO-FRONTAL`, `BUFFET-ELIO-VISTA-POSTERIOR`). Swatches are a
  source of **target colours to transfer toward**, not **target renderings
  to compare against**. Any V01 metric of the form "how close is our
  variant to the true variant" has fabricated its reference.
- **`LUXUS` — admitted but deferred.** 105 product folders, 129 images, 90
  products with exactly one image. No manifest, no swatches. Pre-approved
  as a **held-out generalisation set for a second run**, deliberately not
  the first. A baseline that passes on ATRIANI and fails on LUXUS means the
  ATRIANI assets' uniformity was doing the work — that is the cheapest
  available falsification of a V01 pass.
- **`LAZZONI` — not cleared for V01.** 33 flat PDFs; photography is
  lifestyle/in-situ (staged rooms, sometimes people), wrong background
  condition. Its spec data is a *recommendation*/`OQ-009` question, not a
  variants one, and ADR-0008 does not authorise extracting it.
- **`CELADON` — excluded.** Exactly **62** subfolders of framed decorative
  prints. The count matches `OQ-011`'s "only supplied catalogue is 62
  artwork records" precisely — this is that already-known set resurfacing,
  not new data.
- **V02, V03, G01, `OQ-009`, `OQ-010`, `OQ-011` — all unchanged.** V02
  compares against a V01 baseline that does not exist yet.

### Contamination — read this before writing any glob

Two files in `ATRIANI` are not supplier photography:

- `ATRIANI/Curva King Bed/ChatGPT-Image-Dec-1-2025-04_28_27-PM.webp`
- `ATRIANI/Bench J/Screenshot-2025-12-04-at-12.46.18-PM.webp`

I opened the first. **It is an AI-generated upholstered bed on a near-white
background and is not distinguishable at a glance from the genuine assets
beside it.** It is the *only* webp in `Curva King Bed`, so excluding it
drops that product entirely — report the drop, do not substitute.
**Filename screening is necessary but not sufficient**: a renamed generated
image is undetectable. Nobody may claim the corpus is free of synthetic
content.

### How to build it — the five mandatory conditions

1. **Scope every finding to "this corpus", never to "Curalina's product
   photos".** Verbatim caveat wording is in ADR-0008's Verification section;
   the V01 decision record must carry it in substance.
2. **Allowlist from the manifest. Never `glob("**/*.webp")`.** Build the
   input set from `Design 44.xlsx`'s `Linl to pictures` column, then filter.
3. **Hard exclusions, enforced in code, reported as counts:** the two files
   above; every `-150x150` file (32 across the corpus — WordPress
   thumbnails, worthless for colour work); anything matching
   `(?i)chatgpt|screenshot|midjourney|dall-?e|generated`.
4. **Human-eyeball every admitted image**, logging per-file accept/reject.
   42 folders makes this feasible, and it is the only control that catches a
   *renamed* generated image. Deliberate manual gate, not a process failure.
5. **Pin by hash.** sha256 of `Design 44.xlsx` and of every admitted image
   into the run manifest. The directory is outside version control on one
   machine and can change silently; without hashes run 2 is not comparable
   to run 1.

Working set after exclusions: roughly **163 ATRIANI images across 41
folders**, before manual review. (**Superseded — `ADR-0012` measured 95
across 26 after manual review.**)

### Path handling — do not reuse `CURALINA_DATA_DIR`

Files stay outside the repo. Nothing is copied in.

`CURALINA_DATA_DIR`
(`ai_services/variant_generator/src/curalina_variants/settings.py:11`, set
per-service at `ai_services/suite_client.py:150`) is the **service's own
mutable working directory** — the SQLite file lives under it. Pointing it at
a read-only external corpus conflates service state with source data and
gives the deployed service a filesystem dependency present in no contract.

**The variants service must not read this directory at runtime and must not
gain a setting pointing at it.** The HTTP API already takes asset bytes on
upload; that is the sanctioned entry path. If the notebook wants a
configurable root, it introduces its own notebook-scope
`CURALINA_SOURCE_ASSETS_DIR`, resolved in the notebook, never read by
`curalina_variants` runtime code, never added to `Settings`.

### What a first V01 run must validate (as written before `ADR-0012`)

**Do not dispatch V01 yet.** It needs `ai-ml-lead` to reframe the evaluation
in writing first — with no reference variants, "V01 established,
protected-pixel checks pass"
(`agentic_flow/variant_generator_workflow.md:13`) has to rest on properties
computable without a ground truth: protected-pixel invariance,
geometry/texture preservation outside the mask, and whether the transferred
region lands on the intended swatch colour in LAB. Whether that constitutes
an accepted baseline is `ai-ml-lead`'s call, not `tech-lead`'s. This is the
same pre-dispatch discipline that produced the `ADR-0006` chain, and it is
the same failure mode R02 hit — a reference methodology assuming a labelled
set that does not exist. (**That reframing is now `ADR-0012`, and it demoted
two of the three properties named here.**)

One further caveat for whoever writes the run: the admitted assets read as
**CGI renders, not camera photographs** (uniform lighting, no sensor noise,
geometrically perfect edges). Evidence that colour transfer works on these
is not evidence it works on real photos.

### Handed to other roles

- **`ai-ml-lead`:** the V01 reference-free evaluation reframing above.
  Blocking for dispatch. (**Delivered as `ADR-0012`.**)
- **`client` / `OQ-011`:** `Design 44.xlsx` is a **third supplier** absent
  from the Four Hands / Moe's workbook `ADR-0005` ruled on — 42 products,
  128 options, prices, dimensions. No rugs, no lighting, so `OQ-011`'s
  substance is unchanged, but the client's supplier set is wider than the
  project records. `OQ-011` stays `open`.
- **`client`:** provenance/rights checklist — identity (WordPress thumbnail
  suffixes and Portuguese view names suggest a **website media-library
  export**, not a delivered asset pack); **usage rights** (these look like
  *supplier marketing assets*, not Curalina- or customer-owned — a V01 run
  is cheap to redo, a shipped feature on unlicensed imagery is not);
  **synthetic content** (was any AI imagery placed deliberately, and
  which); **per-image colourway labels** (if these exist anywhere, the
  no-ground-truth ruling reverses and V01 improves substantially);
  **sanctioned delivery path** (`~/Downloads` must not become it by
  default, the way `attached_assets/` must not).

`agentic_flow/open_questions.yaml` is **not edited** — V01's photo gap was
never an `OQ-xxx`, it is a data-sourcing blocker tracked in this file.

## Session 6 — variants full A3 engineering

Variants got the A3 pieces that were still missing after session 4:

- SQLite-backed durable asset/job/idempotency/candidate/review storage via
  `curalina_variants.api.sqlite_store.SQLiteJobStore`.
- The FastAPI app now defaults to the SQLite store configured by
  `CURALINA_DATABASE_URL`, while tests can still inject `FakeJobStore`.
- Durable idempotency, asset byte persistence, job cancellation, candidate
  review updates, worker leases, lease-owner fencing, successful completion,
  and failed completion are covered in unit tests.
- A worker entry point exists in `curalina_variants.workers.runner`.
  `process_one_job()` leases one queued/running-expired job and completes
  it through the fake A2 generation path; `run_worker_once()` wires that to
  service settings.
- `bootstrap.main("api")` now runs the FastAPI app factory through uvicorn
  on `8102`; `bootstrap.main("worker")` runs one worker pass.
  `pyproject.toml` declares uvicorn as a runtime dependency.

Verification from session 6:

- Variants: 71 unit tests at 89% branch coverage, with
  `api/sqlite_store.py` at 77%; 27 contract tests; 2 worker tests; Ruff
  and `mypy --strict` clean.
- Existing FastAPI/Starlette `TestClient` deprecation warnings remain.

> Session 6 concluded "recommendation and variants may now both be counted
> as full A3." **Session 8 corrected this**: the A3 *engineering* is done,
> the A3 *done-evidence* is not — both `tests/integration/` suites are
> `assert True`. See dispatch items 2 and 3.

## Session 5 — recommendation full A3 engineering

Recommendation got the A3 pieces that were still missing after session 4:

- SQLite-backed API persistence for catalogue snapshots, persisted
  bundles, and rule-version records via
  `curalina_recommendation.api.repository`.
- `/v1/catalogue/imports` saves snapshots; `/v1/bundles` saves bundle
  revisions; `/v1/bundles/{id}/substitutions` now loads the original
  bundle from SQLite, chooses a same-category synthetic replacement, saves
  the revised bundle, and returns the existing substitution response
  contract. The old substitution fixture path is gone.
- The API composition root seeds a labelled synthetic A3 catalogue into
  SQLite, including a second sofa so substitutions can be exercised
  honestly without fabricating a replacement at request time.
- `bootstrap.main()` now runs the FastAPI app factory through uvicorn on
  the configured `service_host`/`service_port` (`8101` by default). The
  current Python environment did not have uvicorn installed, but
  `pyproject.toml` now declares it as a runtime dependency and the unit
  test verifies the runner target/host/port/factory wiring with an
  injected runner.

Verification from session 5:

- Recommendation: 259 unit tests at 91% branch coverage; 17 contract
  tests; Ruff and `mypy --strict` clean.
- Existing FastAPI/Starlette `TestClient` deprecation warnings remain.

R03/A6/model-quality claims remain separate and are still not met.

## Session 4 — cleared the queued ADR-0002 HTTP/application wiring gap

The three `ADR-0002` A3-remainder items that had been queued for two
sessions were implemented and verified, but this was deliberately **not
a claim that any service had completed full A3**. What was done:

- Recommendation's `/v1/catalogue/imports`, `/v1/recommendations`, and
  `/v1/bundles` routes now call `application/` services through explicit
  DTO↔domain mappers and a small API composition root. The concrete
  adapters remain labelled fake/synthetic. `/v1/bundles/{id}/substitutions`
  remained fixture-backed because there was still no bundle repository to
  load an original bundle honestly.
- Variants got a real FastAPI `create_app()` wrapper around the
  existing contract handlers/store for assets, jobs, cancellation, and
  reviews. Still in-memory at that point; no durable job store or worker.
- Rooms got a real FastAPI `create_app()` wrapper around
  `RoomsContractService` for assets, render jobs, cancellation, and
  candidate reviews. Still fixture/in-memory; no durable job store or
  worker.

Verification from session 4:

- Recommendation: 258 unit tests at 92% branch coverage; 16 contract tests;
  Ruff and `mypy --strict` clean.
- Variants: 63 unit tests at 93% branch coverage; 26 contract tests; Ruff
  and `mypy --strict` clean.
- Rooms: 60 unit tests at 96% branch coverage; 34 contract tests; Ruff and
  `mypy --strict` clean.

The only observed warnings were FastAPI/Starlette `TestClient`
deprecations about the currently installed `httpx` line; they did not fail
tests, but they are worth remembering if the local dependency set changes.

## Session 3 — recommendation's second real-logic gate: R02

**Decision: `insufficient_evidence`.** Not a failure of process — the
process worked exactly as designed and produced an honest negative
result instead of a fabricated positive. Full detail in
`ai_services/work_packets/REC-R02-01.md` and the executed notebook
(`architecture/notebooks/recommendation/02_ranking_baselines.ipynb`), but
the headline: the rule-only baseline **ties or loses** to a do-nothing
prevalence baseline on multiple held-out briefs. TF-IDF and MiniLM both
recorded `not_run` (scikit-learn/sentence-transformers correctly kept out
of runtime deps; this environment's Python 3.14 has no `torch` wheel
regardless of network access — confirmed independently, not just
asserted). **No G2 gate reached. No embedding path adopted. That was
never possible from this run** — `ADR-0006` fixed that ceiling before any
code was written.

Getting to this result took three rounds of methodology review before
any notebook code was written, each catching something the previous
round missed — read `ADR-0006` (`ai-ml-lead`, as amended in place —
the amendment block near the end is the operative rule, not the
struck-through original), `ADR-0007` (`tech-lead`, approves
`Product.overview` and the workbook's R01→R02 scope extension, rejects
an `attributes` bag in favor of one named field, rejects the optional
material columns as a supplier-discriminator leak), and `ADR-0006`'s
Amendment 1 again (frequency-based term selection would have picked the
LEAST discriminative values — a style in 80% of rows — producing
near-uniform relevance; revised to a discriminativeness band derived
from the decision threshold itself). **If R03's eventual evaluation
methodology reuses any of this reasoning, read all three before assuming
the pattern transfers** — several of the guards (supplier-proxy, Jaccard
collinearity, the leakage firewall) are specific to properties of this
one catalogue that may or may not recur.

**A real defect pattern surfaced twice this session**: the
`ml-notebook-engineer`'s own completion report did not disclose that nine
`evaluation/` modules sat at 0% test coverage (exercised only by manually
running the notebook). Independent re-verification caught it both times —
once for the original nine modules, once again for two more (`metrics.py`,
`label_source.py`) that the first coverage-remediation pass itself
missed. Both were fixed; all eleven modules sit at 98–100%.

## Per-service status as recorded before the session-8 restructure

Retained for the detail each entry carries. The operational reference above
is the current statement.

### `curalina_design_rules` — A0-A3, D01, and ADR-0004's implementation all done.

- 80 tests, 91% branch coverage, `mypy --strict`/Ruff clean (pre-`ADR-0010`).
- **Superseded 2026-09-14 (session 8) by `ADR-0010`.** The wiring is **done**
  and the item is closed; 83 tests at 92%. Doorway/functional-zone positions
  were investigated and provably do not exist in any Curalina input — what
  remains is `OQ-010`, a client blocker. Do not re-queue this.
- **D01: `accept-with-limitations` CONFIRMED, re-run required (`ADR-0014`).**
  Both originally-named blockers resolve, but D01 **does not promote** —
  `OQ-001`/CMR is untouched, four rule families are unbuilt, and a new,
  worse limitation surfaced: the notebook **synthesises** `BR_ENSUITE_PATH`
  endpoints inline (`Point(10, 10)`), which `ADR-0010` codified as
  forbidden the day after D01 ran. The re-run is needed because the archived
  CSVs assert severities the code no longer produces. **Scope is fixed at
  `ADR-0014` §D2 — four items, nothing more; do not re-author fixtures to
  pass.** D01 is at its ceiling and everything still holding it down is
  `design_authority`-owned; that is a healthy state, not a defect to work
  off.

### Recommendation — A0, A1, A2, R01, R02 done and verified. A3 engineering done; **A3 done-evidence NOT met** (session 8).

> **Session 8 correction:** `tests/integration/` is still a placeholder
> (`assert True`). A3's done-evidence requires integration tests for
> repository rollback, process restart and malformed-workbook import; none
> exist. Engineering is sound and re-verified (259 unit / 91% / 17 contract /
> clean); the gate evidence is not.

- 259 unit tests, 91% branch coverage, 17 contract tests,
  `mypy --strict`/Ruff clean.
- `Product` now carries `overview: str | None` (ADR-0007), consumed by
  real `RuleOnlyEncoder`/`TfidfEncoder`/`MiniLMEncoder` adapters behind
  the existing `FeatureEncoder` port (fake adapter untouched, still used
  elsewhere). New `evaluation/` package: vocabulary extraction, pool
  selection, brief construction, the freeze mechanism, label derivation,
  metrics (P@5, NDCG, prevalence baseline, shuffled-label control,
  supplier-proxy guard).
- Session 4 added `api/application_services.py` and `api/mappers.py`, and
  switched catalogue import, recommendation ranking, and bundle creation
  off canned fixtures and onto application services. It also tightened the
  fake bundle composer so products individually over the profile budget are
  not selected, preserving the existing infeasible-low-budget contract.
- Session 5 added SQLite persistence, repository-backed substitutions,
  seeded synthetic snapshot persistence, rule-version persistence, and a
  real uvicorn-backed `run-api` bootstrap.
- **R03: DECIDED — formal no-go, `ADR-0013`.** No longer a queued item and
  **not to be re-queued as an investigation.** Bundle composition may
  proceed logic-only against labelled-synthetic fixtures under `ADR-0013`
  §D2's four binding conditions (dispatch-table item 13). **G2 is not
  reached** and nothing downstream may claim it. The no-go rests on two
  independent grounds — the catalogue gap *and* four unbuilt validation
  arms blocked on `OQ-002`/`OQ-004`/`OQ-007`/`OQ-009` — so **a better
  catalogue alone does not unblock R03.** Reversal needs both halves.
- A4 suite participation is covered by the root suite runner as of
  session 7.

### Variants — A0, A1, A2 done and verified. A3 engineering done; **A3 done-evidence NOT met** (session 8).

> **Session 8 correction:** `tests/integration/` is still a placeholder
> (`assert True`). Of A3's six mandatory job-lifecycle tests, three are
> covered in the unit suite (fencing, idempotency-409, restart) and the rest
> are not: lease expiry, worker-dies-after-claim, cancellation-racing-
> completion, asset-write-succeeds-but-DB-commit-fails. The `lease_expired`
> branch at `api/sqlite_store.py:287` is untested. Engineering is sound and
> re-verified (71 unit / 89% / 27 contract / 2 worker / clean).

- **Superseded 2026-09-14 by `ADR-0008`, then by `ADR-0012`** — the "no real
  product photos" blocker is retired, and the methodology blocker that
  replaced it is now **also cleared**. `ADR-0012` is V01's reference-free
  evaluation design and V01 is **dispatchable**. Read it in full before
  touching V01; its metric set deliberately demotes two of the three
  properties `ADR-0008` suggested, and its corpus figures supersede
  `ADR-0008`'s (95 usable product images across 26 folders, not 163 across
  41; 19 admitted webp are swatches, not products). V02 stays blocked
  behind V01.
- Session 4 added `curalina_variants.api.app.create_app()`, FastAPI/httpx
  dependency declarations, and HTTP contract/unit tests.
- Session 6 added SQLite persistence, default SQLite-backed API storage,
  durable idempotency, worker leasing/fencing, worker completion via the
  fake A2 generation path, and uvicorn-backed `run-api`/one-pass
  `run-worker` bootstrap.
- Verification: 71 unit tests, 89% branch coverage; 27 contract tests; 2
  worker tests; `mypy --strict`/Ruff clean.

### Rooms — A0, A1, A2 done; ADR-0002 real HTTP wrapper done.

- Session 4 added `curalina_rooms.api.app.create_app()`, FastAPI/httpx
  dependency declarations, and HTTP contract/unit tests. The app wraps the
  existing fixture-backed `RoomsContractService`; durable persistence and
  worker execution are still pending.
- **Superseded 2026-09-14 (session 8) by `ADR-0011`.** G01 was investigated
  and it **does** have the hidden problem: its five measured room scenes do
  not exist anywhere and no available imagery is an admissible substitute
  (stock photos and AI-generated style boards are both explicitly ruled out —
  read `ADR-0011` before reaching for `attached_assets/stock_images/`).
  **G01 is blocked on `OQ-010`; do not dispatch it.**
- **Rooms' remaining A3 engineering is NOT blocked** — durable job
  storage, worker with claim/lease/fencing, checkpointing between staged
  insertions, bounded attempt counts, and process-level serving. This uses
  the fake `ImageEditor` adapter and needs no room scenes. Earlier revisions
  of this document conflated this with G01; they are separate and only G01 is
  blocked. This is dispatch item 1.

### Contracts & suite steward — A0, A1, and available-service A4 done.

- Root `make -C ai_services run-suite` starts recommendation and variants,
  runs the HTTP fixture flow, executes one variants worker pass, verifies
  IDs/revisions/content hash, and names rooms as deferred.
- Add rooms to the suite after rooms reaches full A3 (dispatch item 8). Do
  not submit room renders before the catalogue image set and room A3 work
  are ready.

### UI adapter — not started. Correctly not started.

## "What to pick up next" as written at session 6 — fully superseded

> **Superseded by the operational reference at the top of this file.** This
> list is session-6-era history. Its items 3 (design rules doorway positions)
> and 5 (V01) have moved, and its framing of rooms' next step conflates G01
> with A3 engineering. Retained only to show what the queue looked like
> before session 8's sweep.

Units of work, roughly in priority order (as of session 6):

1. **Rooms full A3 or G01 investigation** — for A3, rooms still needs
   durable job storage, worker/process bootstraps, lease/fencing semantics,
   and replacement of fixture-only paths. For G01, consider a short
   investigation pass first (similar to what caught R02's
   missing-evaluation-set and missing-`overview`-field problems) before
   assuming it's pure engineering with no hidden methodology gap.
   *(The investigation happened in session 8 → `ADR-0011`. It did have a
   hidden methodology gap.)*
2. **Design rules**: source doorway/functional-zone positions for
   `evaluate_spatial_layout` — still just queued, not investigated.
   *(Investigated in session 8 → `ADR-0010`. They do not exist.)*
3. **Recommendation R03** — likely a documented no-go given the catalogue
   gaps, but that's `ai-ml-lead`'s call to make formally, not an
   assumption to skip past. *(Ruled in session 8 → `ADR-0013`.)*
4. **Variants V01** — no longer a photo-sourcing gap (`ADR-0008` admitted
   the ATRIANI corpus). Next step is **`ai-ml-lead`, not an engineer**:
   a written reference-free V01 evaluation design. Do not dispatch a
   notebook packet before that exists. *(Delivered in session 8 →
   `ADR-0012`. V01 is now dispatchable.)*
