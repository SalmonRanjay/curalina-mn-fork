# Architecture decision record

ID: ADR-0019
Status: accepted
Owner and reviewer: `tech-lead` (decision); raised by the project owner
directly ("At this point do we even need the express web app layer.")
Date: 2026-09-17

## Context

The project owner asked, in plain terms, whether the Express web app layer
is still needed now that three separate Python AI services exist. The
question is reasonable on its face — a lot of new capability now lives
outside Express, and it is worth periodically asking whether an older
layer has become a pass-through that could be deleted.

This ADR answers that question from what the code actually does today,
not from what the AI services *could* eventually absorb. It also records,
as documentation only, what a decommissioning path would look like if the
answer ever changes. **Per the project owner's explicit instruction, none
of the "if we ever did this" material below is authorization to execute
any part of it.** The owner was explicit: reach a stable, fully-working
state first, and only then revisit this question with real usage data.

## Decision

**No. Express is not a pass-through layer and cannot be removed today.**
It owns three things none of the three Python services replicate or are
designed to replicate:

### 1. Authentication and session state

`server/localAuth.ts` is the only place a user's identity exists. Passport
local strategy, bcrypt password hashing, and session storage in
`connect-pg-simple` (backed by the real Neon Postgres `sessions` table) all
live here. None of `recommendation` (8101), `variant_generator` (8102), or
`room_generator` (8103) has a concept of a user, a login, a password, or a
session — each is a stateless-per-request domain service scoped to its own
job/catalogue/mask data (`architecture/` and `agentic_flow/` are explicit
that these are meant to stay narrow domain services, not become the
product's identity provider — see "Cross-cutting rules" in
[`CLAUDE.md`](../../CLAUDE.md): "separate packages, separate local
databases, separate tests").

### 2. The actual product, user, cart, and order data

`shared/schema.ts` / Drizzle / the real Neon Postgres database is the
system of record for `users`, `products`, `carts`, `orders`,
`quizResponses`, and `renders`. The three Python services each have their
own narrow local database (SQLite in the current fake/demo adapters) scoped
to their own domain — a recommendation bundle, a variant job, a room job —
and hold **no** durable concept of "this customer," "this cart," or "this
order." Moving that data model into one of the AI services would break the
"separate services, separate databases" invariant this project has
enforced since `agentic_flow`'s audit pack, and there is no service among
the three whose domain that data naturally belongs to — it is
e-commerce/account data, not recommendation, variant, or room-generation
domain data.

### 3. Orchestration between the AI services, and between them and the
   real data

`server/services/ai-adapter/render-orchestrator.ts` is the only code that
turns "a user submitted a quiz" into "call recommendation, thread its
`bundle_id` into a room job, persist the result against that user's
`renders` row, poll for completion, and let the results page read it back
via a stable `render.id`." None of the three Python services calls another
one — each only exposes its own `/v1` surface and expects a caller to
sequence them. That caller is Express (`ADR-0018` traced the full chain:
`Quiz.tsx` → `POST /api/render` → `orchestrateAiRender` → recommendation →
rooms → `Loading.tsx` → `Results.tsx`). Deleting Express without replacing
this orchestration would strand three services that all speak public HTTP
but have no shared caller.

### What the AI services do *not* need Express for

To be precise about scope: the AI services do not call Express, do not
import Express code, and do not depend on Express being up to serve their
own contract tests or `make -C ai_services run-suite`. They are
independently deployable and independently correct. The dependency runs
one direction only — Express depends on them as an HTTP client
(`server/services/ai-adapter/*-client.ts`), never the reverse. That
asymmetry is exactly why the question is worth asking periodically as
those services grow, and exactly why the answer today is still "no."

## What would have to be true before revisiting this

None of the following exists today; each is a real project, not a
refactor:

1. **A replacement identity/session layer.** Whatever fronts the client
   (a BFF, an API gateway, a serverless function set) would need to own
   auth, sessions, and password handling exactly as `localAuth.ts` does now
   — this is not optional surface area, it is a security-relevant rewrite
   with its own review burden.
2. **A replacement system of record for e-commerce/account data**, either
   as a fourth narrow service (violating the "one shared package is
   `curalina_design_rules`, nothing else is shared" rule unless
   deliberately revised) or folded into one of the three existing services
   in a way that changes their charter.
3. **A replacement orchestrator** — something has to sequence
   recommendation → rooms, thread `bundle_id`/provenance/job IDs between
   them, poll for completion, and persist results against a durable user
   record. This is `render-orchestrator.ts`'s entire job today.
4. **A decision about where the SPA is served from** — `server/index.ts`
   currently serves the Vite build's static output directly in the Docker
   Compose / standalone deployment (`dist/public`), separate from the
   Firebase Hosting CDN path used in that deployment target. Both paths
   would need an equivalent.

## Documented decommissioning path (reference only — not authorized)

If, after reaching the stable working state the project owner asked for
and after real usage data justifies it, the direction changes, the shape
of that work would be:

1. Stand up a thin BFF/gateway service (could be a new, small, separately
   reviewed Node service, or a serverless function set) that owns exactly
   what `server/localAuth.ts` owns today: registration, login, session
   issuance/validation, logout. Nothing else.
2. Move `shared/schema.ts` and the Drizzle-backed e-commerce/account tables
   to sit behind that gateway (or a dedicated data-access service), keeping
   them out of any of the three AI services' domains.
3. Reimplement `render-orchestrator.ts`'s sequencing logic — recommendation
   call → rooms call → persistence → completion polling — in the gateway,
   preserving `ADR-0016`'s fail-closed behavior (no fabricated `completed`
   state when an AI service is unreachable) and `ADR-0018`'s traced chain
   exactly, since that chain is the actual product flow today.
4. Move static asset serving to a CDN/static host for every deployment
   target, not just Firebase Hosting, retiring `server/index.ts`'s
   `express.static` fallback (`server/index.ts:44`).
5. Delete `server/` only after 1-4 are independently verified against the
   same live-browser E2E walkthrough this session used to verify the
   current dashboard flow — register → quiz → render → dashboard → detail
   view — with no regression in any of the honesty/fail-closed invariants
   (`ADR-0016`, `ADR-0017`) that `server/` currently enforces.

Each of those five steps is its own work packet under this project's
one-packet-at-a-time discipline (`AGENTS.md` §9) — this is not a
weekend refactor, and nothing above should be read as a recommendation to
do it. The recommendation is the opposite: Express is load-bearing today,
removing it would be a multi-service rewrite of the identity, data, and
orchestration layers, and the honest next step is finishing the stable
working state already in progress (`agent_instructions/STATUS.md` items
19-24), not shrinking the surface area that currently makes the demo work.

## Consequences

- No code changes from this ADR. It is a documentation-only ruling.
- `agent_instructions/STATUS.md` cross-references this decision under
  "Read this first" so the question does not get re-asked cold in a future
  session without this analysis being read.
- If the project owner wants to revisit this after the stable-state goal is
  met, the four prerequisites and five-step path above are the starting
  point, not a fresh investigation.
