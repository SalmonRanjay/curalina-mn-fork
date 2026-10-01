# Architecture decision record

ID: ADR-0023
Status: **accepted** for topology, the CI/CD design and the Terraform
layout delta. Applying anything is still blocked on owner inputs **B1** and
**B2**. CI is also blocked on the new input **B8**, and production on
**B3**, **B6** and **B7** (see "Blocking inputs"). Rooms and variants on
Cloud Run additionally depend on the in-flight Postgres migration landing,
plus packets P0d and P0e.
Owner and reviewer: `tech-lead` (decision). Raised by the project owner,
who gave three directives on 2026-09-30: (1) move every service to Cloud
Run now that SQLite is being removed; (2) keep custom infrastructure
minimal and deploy from GitHub, with a direct answer on whether a GitHub
runner VM is needed; (3) a model build pipeline, which is decided
separately in `ADR-0024`. Review: `code-reviewer`.
Date: 2026-09-30

**Relationship to `ADR-0022`.** That ADR was accepted earlier the same day,
and none of it has been implemented. Following this repo's convention
(`ADR-0021` superseding `ADR-0018` §D1, and `ADR-0012` superseding figures
in `ADR-0008` without rewriting it), this ADR **supersedes these named
parts of `ADR-0022`** and leaves the rest standing:

| `ADR-0022` section | Status after this ADR |
|---|---|
| C1–C6 (evidence) | **Kept** as the record of the pre-migration state. C2 (the SQLite constraint) no longer drives topology. See C1–C2 here |
| D1 (hybrid VM) | **Superseded** by D1 |
| D2 (placement table) | **Superseded** by D2. The `app` and `composite_renderer` rows are unchanged in substance |
| D3 (region `us-east4`), D4 (two projects) | **Kept** unchanged |
| D5 (VPC, firewall, IAP, NAT) | **Superseded** by D5. There is no VPC in the default path |
| D6 (secret containers in Terraform, values never) | **Kept**. The secret list is extended in D4 and D6 |
| D7 (SD 1.5 out of v1, GPU module disabled) | **Kept**. `ADR-0024` adds the LoRA artifact path for when it is enabled |
| D8 ("Terraform owns deploys", digests in a committed tfvars) | **Reversed** by D7. Reasons given there |
| D9 (future VM exit) | **Moot**. The exit happens now, by owner directive |
| Terraform layout | Modules `network` and `ai_host_vm`, `images.auto.tfvars.json` and the push script are **removed**. See "Terraform layout delta" |
| Operator flow, phased plan, cost table, B1–B7 | **Superseded** by the versions in this ADR |
| P0a, P0b, P0c, P4, P6a, P6b | **Kept** as specified, renumbered into the new phase table |

## Context

All of the following was re-derived from the tree on `RJ-001` at
`b856f5c` this session.

### C1 — The Postgres migration is in flight, not landed

At commit `b856f5c`, `grep` finds no `psycopg` and no `postgresql://`
under `ai_services/`. **While this ADR was being written, the uncommitted
working tree changed** (read only, not touched):

- **recommendation:** migrated. `psycopg` 3, SQLAlchemy and Alembic were
  added (`pyproject.toml`). `db/migrator.py` runs `alembic upgrade head`
  **at container start** (`bootstrap.py`). The repository opens **one
  `psycopg.connect` per operation, with no pool** (`api/repository.py:285`).
- **variants:** `db/` and `migrations/` exist. Its store was still named
  `sqlite_store.py`.
- **rooms:** nothing yet.
- Local database names are `curalina_recommendation`, `curalina_variants`
  and `curalina_rooms`, one each inside the shared local instance
  (`ai_services/docker-compose.common.yml` header).
- The migrator passes the URL through `configparser`, where `%` is an
  interpolation marker (`db/migrator.py`, `_sqlalchemy_url` docstring).
  It appends `options=-csearch_path=…` using `&` when the URL already has a
  `?`, so a socket URL with `?host=` composes correctly.

This ADR designs for **the state after the migration**, as instructed:
each service has its own database and keeps its existing store interface,
and job claims use `FOR UPDATE SKIP LOCKED` (`ADR-0022` option E). The
packets below that depend on the migration say so. D4 states the four
properties the migration must have for Cloud Run.

### C2 — What Postgres removes, and what it does not

The VM existed for one reason: each API and its worker shared one SQLite
file and one asset directory (`ADR-0022` C2). Checked per service:

- **variants: fully disk-free after migration.** Asset bytes are already
  stored as a `BLOB` column in its own database
  (`curalina_variants/api/sqlite_store.py:101-104`, inserts at `:161-164`
  and `:479-482`). Postgres `bytea` carries this over.
- **recommendation: disk-free after migration.** It has no worker. It holds
  the bundle writes (`repository.py` `save_bundle`) and nothing else.
- **rooms: NOT disk-free after migration.** Rendered PNGs go through
  `FilesystemAssetStore(settings.curalina_data_dir / "assets")` in **both**
  the API (`api/app.py:35-37`) and the worker (`workers/runner.py:89`). On
  Cloud Run the worker writes a PNG onto its own instance, and the API that
  serves `GET /v1/assets/{id}/content` runs on a different instance and
  cannot see it. **Moving the job rows to Postgres alone does not make rooms
  deployable on Cloud Run.** See P0d.
- **Worker identity is not unique.** Both `run_worker_once` functions
  default to `worker_id="worker_local"` (`curalina_rooms/workers/runner.py`,
  `curalina_variants/workers/runner.py:183`). Lease ownership is checked by
  comparing `lease_owner` to that ID (`curalina_rooms/api/sqlite_store.py:409`,
  `:505`). Two worker instances therefore share one identity. If a lease
  expires and the job is re-leased by the second instance, the first
  instance's heartbeat and completion still pass the ownership check. This
  is harmless with exactly one worker, and becomes a correctness bug the
  moment there are two, **including the brief overlap during a rolling
  deploy**. See P0e and D3.
- **Per-iteration setup in the worker loop.** Each `run_worker_once` call,
  which happens about once a second, constructs the store and runs
  `initialize()` and `seed_from_fixtures()` (`curalina_rooms/workers/runner.py`,
  last function). Against SQLite that is cheap. Against Postgres it is a new
  connection plus `CREATE TABLE IF NOT EXISTS` DDL every second, from every
  worker, contending with the API's startup DDL. **This is handed to the
  migration's owner (`python-services-engineer`) as a finding**: hoist store
  construction and initialization out of the loop. It is not ruled on here
  beyond being a P3 check.
- Workers are `while True` poll loops with no HTTP port (`bootstrap.py` in
  both services). The images use `ENTRYPOINT python3 -m <pkg>.bootstrap`
  with `CMD ["api"]` (`room_generator/Dockerfile:59-60`,
  `variant_generator/Dockerfile:59-60`). The worker is the same image
  started with the argument `worker`.

### C3 — How the app calls the AI services today

There are about ten raw `fetch` calls in `server/services/ai-adapter/`:
`recommendation-client.ts:126`, `render-job-client.ts:76, 147, 212, 263, 298`,
and `asset-import.ts:125, 341, 398`. There is also
`service-availability.ts`. None of them attaches credentials, and
`asset-import.ts:125` fetches "whatever URL is actually stored", which may
not be an AI service. Base URLs come from `server/config/ai-services.ts:95-97`.
`google-auth-library` is present in `node_modules` only as a transitive
dependency of `@google-cloud/storage`.

### C4 — The existing `cloudbuild.yaml`, now with provenance

`git log -- cloudbuild.yaml`: **created and edited on 2026-02-28 by GitHub
user `Design44inc`**, using GitHub's web-editor default commit messages
("Create cloudbuild.yaml", "Update cloudbuild.yaml"), in `origin` =
`CuralinaTech/curalina`. It builds one image, the root `Dockerfile`, to
`gcr.io/$PROJECT_ID/curalina:$COMMIT_SHA` (a mutable tag on the legacy
Container Registry host). It has no test step, and runs
`gcloud run services update curalina-git-2 --region=us-central1`.

The likely reading, though not verified, since nobody here can see that
project: **a Cloud Build trigger in a GCP project controlled by
`Design44inc` is connected to `CuralinaTech/curalina` and fires on pushes to
some branch, probably `main`.** If so, merges to that branch may be
deploying the root `Dockerfile` to `curalina-git-2` today.

### C5 — The app's CI gate is limited by what exists

`package.json` has no `test` script and no test runner dependency. The
`*.test.ts` files under `server/services/ai-adapter/` have no runner wired
in `package.json`. `npx tsc --noEmit` reports 171 errors (`STATUS.md`
session 21). **The only gate available for the app today is
`npm ci && npm run build`**, which the `Dockerfile` already runs.

### C6 — Images would bake tracked junk

`ai_services/` has no `.dockerignore`, and the three Python images
`COPY <service>/` wholesale. A CI build clones only tracked files, and
**`recommendation/data/curalina_recommendation.sqlite3` and
`room_generator/data/curalina_rooms.sqlite3` are tracked in git**, so they
would ship inside the images. That is harmless after the migration, but it
is dead weight and an unreviewed data path. Folded into C1 below.

## Options

### Where the two workers run

| | Option | Verdict |
|---|---|---|
| W1 | **Cloud Run worker pool**, one per worker, fixed at 1 instance | **Chosen** (D3) |
| W2 | Cloud Run job on a Cloud Scheduler cron that drains the queue | Rejected. Adds up to one schedule interval plus a cold start to every job. Crash recovery still needs lease expiry, and the latency floor shows up in the user-visible "generating" state |
| W3 | Cloud Run job **triggered by the API at enqueue time** (Run Admin API `jobs.run`) | Rejected for v1, and kept as the reversal path. It scales to zero, which is real, but it puts a GCP control-plane call into the API's enqueue path (a new port, an adapter and IAM). It still needs a periodic sweeper to re-trigger jobs whose lease expired, so it is two mechanisms where W1 is one. The queue stays in Postgres either way, so switching later changes no data model |
| W4 | Cloud Run **service** running the poll loop, min = max = 1, instance-based billing | Rejected as primary, kept as the fallback if W1 is unavailable (R1). A service must listen on `$PORT`, so this needs a dummy health listener in the worker, which is the hack worker pools exist to remove |
| W5 | Worker as a **sidecar container** in its API's service | Rejected. Worker count would follow API autoscaling: zero workers at API min 0, N workers (C2 identity bug) at API max N |
| W6 | **Cloud Tasks** pushing each job to an HTTP worker service | Rejected. Adds a queue product on top of the durable queue we already have in Postgres. The task dispatch deadline is also close to the 1500 s SD render timeout |

### Where the three AI databases live

| | Option | Verdict |
|---|---|---|
| **Cloud SQL for PostgreSQL 16**, one instance per environment, one database plus one role per service | **Chosen** (D4) |
| Neon (a new project, three databases) | Rejected, narrowly. It is zero GCP infrastructure and connects with a plain URL from every compute type, which is attractive. But **Neon has no Canadian region**, so if B6 rules for Canadian residency, all three AI databases would have to move a second time. Polling workers also keep a serverless compute permanently awake, so Neon's scale-to-zero advantage does not apply here |
| Three Cloud SQL instances | Rejected. Triples the cost floor for no isolation that roles plus credential partitioning do not already give |
| Shared database with per-service schemas | Rejected. Violates "separate local databases" in `CLAUDE.md` |

### How the app authenticates to the AI services

- **IAM-required Cloud Run invocation with Google-signed ID tokens**
  (ingress `all`, no `allUsers`). **Chosen** (D5). This is the same
  mechanism `ADR-0022` P0c already specified for rooms → renderer, so one
  auth mechanism is used everywhere.
- `internal` ingress, which needs a VPC plus Direct VPC egress on every
  caller. Rejected. It reintroduces the network module this ADR deletes,
  and it authenticates nothing on its own.

### CI: what builds and deploys on merge

| | Option | Verdict |
|---|---|---|
| **Cloud Build**, with a GitHub repository connection (2nd gen / Developer Connect) | **Chosen** (D6) |
| GitHub Actions on GitHub-hosted runners, authenticating with Workload Identity Federation | Viable, also needs **no VM**. Rejected only on consolidation: it is a second CI system, a WIF pool and provider to manage, and logs outside GCP. It is a fully acceptable substitute if the owner prefers PR-native checks (reversal below) |
| Self-hosted GitHub runner on a VM | Rejected. Needed only for special hardware or private-network reach, and we need neither |
| Cloud Run console "continuous deployment" wizard (probably how `curalina-git-2` was made) | Rejected. One click-configured trigger per service, outside Terraform, and not reproducible |

### Who owns the running image

- **Terraform applies in CI on every merge**, with digests passed as
  variables. Rejected. CI would need near-owner IAM and Terraform state
  access. Every merge, including infrastructure edits, would auto-apply
  with no human reading the plan, which is a poor default for a first-time
  Terraform operator. Digests would need a home that both laptop and CI
  applies agree on, or a laptop apply silently reverts images.
- **Terraform owns every setting except the image, and CI owns the image**,
  via `lifecycle.ignore_changes`. **Chosen** (D7).

## Decision and rationale

### D1 — Everything runs on Cloud Run. There is no VM and no VPC.

Nothing left in the system needs a persistent POSIX disk, a long-lived
host, or a private network once C2's rooms gap (P0d) is closed:

- job rows and asset bytes live in each service's own Postgres database;
- supplier images reach the composite renderer through a read-only Cloud
  Run GCS volume (unchanged from `ADR-0022` D2);
- every cross-service call is HTTPS with an ID token (D5);
- Cloud SQL is reached through Cloud Run's built-in Cloud SQL connection,
  which needs no VPC (D4).

The `network` module (VPC, subnet, Cloud Router, Cloud NAT, firewall rules,
IAP SSH) and the `ai_host_vm` module (VM, data disk, snapshot policy,
startup script, compose template) are deleted from the plan.

### D2 — Workload placement

| Workload | GCP resource | Who may invoke | Scaling (dev / prod start) | Billing | State |
|---|---|---|---|---|---|
| `app` | Cloud Run service `curalina-app` | `allUsers` (public) | min 1, max 2 | **instance-based** (reconciler, `ADR-0022` C3.3) | Neon, unchanged |
| `recommendation_api` | Cloud Run service `curalina-recommendation` | `sa-app` only | min 0, max 2, **concurrency ≤ 4** (D4) | request-based | Cloud SQL db `curalina_recommendation` |
| `variants_api` | Cloud Run service `curalina-variants` | `sa-app` only | min 0, max 2, concurrency ≤ 4 | request-based | Cloud SQL db `curalina_variants` |
| `variants_worker` | **Cloud Run worker pool** `curalina-variants-worker` | nobody (no endpoint) | **exactly 1** | instance lifetime | Cloud SQL db `curalina_variants` |
| `rooms_api` | Cloud Run service `curalina-rooms` | `sa-app` only | min 0, max 2, concurrency ≤ 4 | request-based | Cloud SQL db `curalina_rooms` (rows **and** asset bytes, after P0d) |
| `rooms_worker` | **Cloud Run worker pool** `curalina-rooms-worker` | nobody | **exactly 1** | instance lifetime | Cloud SQL db `curalina_rooms`. Calls renderers with an ID token |
| `composite_renderer` | Cloud Run service `curalina-composite-renderer` | `sa-rooms` only | min 0, max 3, concurrency 4 | request-based | none. GCS volume, read-only |
| `sd15_renderer` (GPU) | `gpu_renderer` module, **`enabled = false`** (`ADR-0022` D7 kept) | `sa-rooms` only | min 0, max 1 | instance-based | none. Weights and LoRA baked in (`ADR-0024`) |
| AI databases | Cloud SQL instance `curalina-ai-pg` (D4) | per-service role | — | — | — |

Service accounts, one per business service (an API and its worker share
one, because they own the same database): `sa-app`, `sa-recommendation`,
`sa-variants`, `sa-rooms`, `sa-composite`, `sa-gpu-renderer`, plus
`sa-deployer` for CI (D6). Every API and worker that shares an image
**deploys from the same digest in the same build**, so an API and its
worker never run different code against one schema.

**Schema-change rule (this is new with independent rollouts).** For a few
seconds during a deploy, an old and a new revision of the API and worker
run against the same database. Schema changes must therefore be
**expand-then-contract**: additive in one deploy, with removal in a later
deploy. This is the migration owner's convention to adopt, and P3 checks it.

### D3 — Both workers run on Cloud Run worker pools, fixed at one instance

This is the concrete answer to "worker pools, jobs, or a polling service".
`ADR-0022` said worker pools were right once Postgres landed. With the C2
evidence, that holds with two conditions attached.

**Why worker pools fit:**

1. The code needs **zero change**. A worker pool runs the existing image
   with the argument `worker` and the existing infinite poll loop, against
   the durable queue that already lives in the service's own database.
   Nothing about the job lifecycle, the lease semantics or the three-state
   separation moves.
2. It is the Cloud Run primitive built for exactly this: always-on,
   pull-based, no HTTP endpoint, no request-driven autoscaling. Option W4
   exists only to fake that with a dummy port.
3. No inference runs in it. The rooms worker waits on an HTTP renderer
   call, and the variants worker does CPU colour transfer. The invariant
   that inference runs in workers, never in request handlers, holds as
   before.

**Why exactly one instance, enforced in Terraform:**

- **Correctness** (C2): with a shared `worker_id`, two instances can both
  complete one job. The pool is pinned to 1 (`min = max = 1`, or the
  worker-pool manual instance count of 1, per R1) **until P0e lands**.
  After P0e, the count becomes a sizing variable.
- **Need**: one worker per service matches today's local topology and the
  demo load. Job throughput is not a v1 problem.

**Why not jobs (W2/W3):** spelled out in Options. The short version: W3 is
the only serious rival. It saves the idle cost of two small always-on
instances, and costs a new port, a GCP API call in the enqueue path, IAM,
and a separate sweeper for lease-expiry recovery. At this team's size, that
trade favours W1. **The cost of the decision is stated, not hidden**: we
pay for two small always-on instances (see Cost) so that we do not have to
write and operate a trigger plus sweeper.

**Shutdown behaviour accepted:** Cloud Run sends `SIGTERM`, then kills the
instance after a short grace period (R1). A worker killed mid-job leaves
its lease to expire. The job is then re-leased, as the existing
worker-dies-after-claim tests cover. For rooms that can delay one render by
up to `CURALINA_JOB_TIMEOUT_SECONDS` (1800 s) **when a deploy lands
mid-render**. An optional later packet (P8) releases the lease on `SIGTERM`.

**Fallback if R1 fails** (worker pools unavailable in the region, or
unsupported by the pinned Terraform provider, or unable to use the Cloud SQL
connection): W4, which needs a tiny health-listener packet. No other part of
this ADR changes.

### D4 — AI databases: one Cloud SQL for PostgreSQL 16 instance per environment, three databases, three roles

- **Instance** `curalina-ai-pg`, in the `foundation` root (stateful,
  rarely changed). `database_version = POSTGRES_16`, which matches the
  local `postgres:16-alpine`. **`edition = "ENTERPRISE"` set explicitly**,
  because new PostgreSQL 16 instances may default to Enterprise Plus, which
  has no shared-core tiers and a much higher floor (R1). Tier is a variable:
  `db-f1-micro` in dev and `db-g1-small` in prod as starting points.
  Automated daily backups on, `deletion_protection = true`, and
  `lifecycle { prevent_destroy = true }`. Public IP with **zero authorized
  networks** and `ssl_mode = ENCRYPTED_ONLY`. The only way in is the Cloud
  SQL connector path, which is IAM-gated (`roles/cloudsql.client`).
- **Connectivity**: each service and worker pool mounts the instance
  through Cloud Run's built-in Cloud SQL connection (a Unix socket at
  `/cloudsql/<project>:<region>:curalina-ai-pg`). The service's
  `CURALINA_DATABASE_URL` is a libpq URL using `host=` for the socket:
  `postgresql://rooms:<pw>@/curalina_rooms?host=/cloudsql/<conn>`. Database
  names match the migration's local names (C1). **The migration's store
  must accept that URL form.** The recommendation migrator's `?`/`&`
  handling suggests it does, and P3 verifies it. **The fallback if
  worker pools cannot mount Cloud SQL (R1):** a private IP plus Private
  Service Access, with Direct VPC egress on the two worker pools only. That
  brings back about four network resources and no code change.
- **Isolation is "separate databases", enforced in three layers, not a
  shared database.** One instance is a hosting fact, exactly as the VM was
  in `ADR-0022`.
  1. Each role owns only its own database (role `recommendation` owns
     `curalina_recommendation`, and so on), and
     `REVOKE CONNECT ON DATABASE <db> FROM PUBLIC` is applied to all three.
  2. Roles are created **with SQL as `postgres`, not with
     `gcloud sql users create`**. Users created through the Cloud SQL API
     join `cloudsqlsuperuser`, which would defeat layer 1 (R1).
  3. Each service's full connection URL is its own Secret Manager secret
     (`recommendation-database-url`, `variants-database-url`,
     `rooms-database-url`). Accessor rights are granted **only** to that
     service's account. `sa-rooms` cannot read the variants password.
- **Passwords never enter Terraform state** (`ADR-0022` D6 kept). Terraform
  creates the instance and the empty secret containers. A one-time script,
  `infra/scripts/bootstrap_ai_databases.sh`, run by the operator from Cloud
  Shell, does the following for each of `recommendation`, `variants` and
  `rooms`: generate a password with **`openssl rand -hex 32`** (hex only:
  no `%`, which the migrator's `configparser` treats as interpolation, and
  no URL-special characters); run, via `gcloud sql connect … --user=postgres`,
  `CREATE ROLE <svc> LOGIN PASSWORD '…'; CREATE DATABASE curalina_<svc> OWNER <svc>; REVOKE CONNECT ON DATABASE curalina_<svc> FROM PUBLIC;`;
  and pipe the full URL into `gcloud secrets versions add <svc>-database-url --data-file=-`.
  Nothing is echoed. The `postgres` admin password is set once with
  `gcloud sql users set-password postgres --prompt-for-password` and stored
  in the secret `ai-pg-admin-password`, which only the owner can read (B7).
- **Connection budget, a hard constraint P3 must verify.** Recommendation
  opens one connection per operation with no pool (C1). So **the number of
  connections an API instance holds is bounded by its Cloud Run request
  concurrency**, and Cloud Run's default concurrency is far above what a
  shared-core Cloud SQL tier admits. The rule is: Σ over the three APIs of
  (`max_instances` × `concurrency`), plus 1 per worker (plus 1 for a
  migration at startup), must stay below the tier's `max_connections` minus
  Cloud SQL's reserved connections (R1). D2 starts at concurrency ≤ 4 with
  max 2. **Concurrency is the lever**, and it is a Terraform variable. If a
  later store adds a pool, the pool's maximum must be settable by
  environment variable and is counted in the same sum.
- **Startup migrations must be serialized.** `alembic upgrade head` runs in
  every container start (C1). On Cloud Run, two API instances, or an API
  and its worker, can start together on a deploy or scale-out and race on
  one migration. **Required of M0:** take a Postgres advisory lock (a
  constant per service) around `run_migrations`, so concurrent starts
  serialize and later starters find the schema already at head. The
  alternative, a pre-deploy migration step in CI, is heavier, and is not
  chosen unless the lock proves insufficient.

### D5 — Service-to-service authentication: IAM plus ID tokens everywhere

- The AI APIs and renderers have ingress `all`, **no `allUsers`**, and
  `roles/run.invoker` granted to exactly the callers in D2's "Who may
  invoke" column. An unauthenticated request gets a 403 from Google's front
  end before it reaches our code. That is **strictly stronger than
  `ADR-0022` D5**, where the AI services had no authentication and a
  firewall was the only boundary.
- **App side (new packet P0f):** one wrapper, for example
  `aiServiceFetch(url, init)`, replaces the raw `fetch` calls in C3. When
  `CURALINA_AI_AUTH=gcp_id_token`, it attaches
  `Authorization: Bearer <ID token>` with audience = the target service's
  origin, using `google-auth-library` (added as a direct dependency). The
  default is `none`, so local compose behaviour is unchanged. **A token is
  attached only when the request's origin exactly equals one of the three
  configured AI service origins.** `asset-import.ts:125` fetches arbitrary
  stored URLs, and a Google identity token sent to S3 or any third party
  would be a credential leak.
- **Rooms worker → renderers:** `ADR-0022` P0c, unchanged. The worker
  pool's identity is `sa-rooms`, which holds invoker on the composite and
  GPU renderers.

### D6 — CI/CD: Cloud Build with its native GitHub connection. No runner, no VM.

**The owner's question, answered directly.** Cloud Build connects to
GitHub natively. You install Google's Cloud Build GitHub App on the
repository once (an OAuth click-through in the console, which needs a
GitHub org admin; see B8), and the GCP project gets a repository connection.
Current GCP calls these "2nd-gen repositories", built on Developer Connect;
exact product naming is per R1. **Builds then run on Google-managed
workers in Cloud Build's default pool. There is no self-hosted runner, no
VM, nothing to patch, and nothing billed while idle.** The connection's
GitHub token is stored for you in Secret Manager by the connection itself.
A Cloud Build *private pool* exists, but it is only needed for builds that
must reach a private network, and nothing here does. (For completeness:
GitHub Actions on GitHub-hosted runners would also need no VM. See
Options.)

**Pipelines (all files new, under `infra/cloudbuild/`; see D9 for why not
the root file):**

| Trigger (dev project) | Fires on | `included_files` filter | Config | Deploys |
|---|---|---|---|---|
| `pr-checks` | pull request targeting `main` | everything | `pr-checks.yaml` | nothing. Tests and build checks only |
| `deploy-app` | push to `main` | `client/**`, `server/**`, `shared/**`, `public/**`, `package.json`, `package-lock.json`, `Dockerfile`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `drizzle.config.ts`, `migrations/**` | `deploy.yaml` (`_IMAGE=app`) | `curalina-app` |
| `deploy-recommendation` | push to `main` | `ai_services/recommendation/**`, `ai_services/design_rules/**` | `deploy.yaml` | `curalina-recommendation` |
| `deploy-variants` | push to `main` | `ai_services/variant_generator/**`, `ai_services/design_rules/**` | `deploy.yaml` | `curalina-variants` + worker pool `curalina-variants-worker` |
| `deploy-rooms` | push to `main` | `ai_services/room_generator/**`, `ai_services/design_rules/**` | `deploy.yaml` | `curalina-rooms` + worker pool `curalina-rooms-worker` |
| `deploy-composite` | push to `main` | `ai_services/renderers/composite/**` | `deploy.yaml` | `curalina-composite-renderer` |
| `deploy-gpu-renderer` | push to `main`, **created only when `gpu_renderer.enabled`** | `ai_services/renderers/sd15/**`, `infra/models/sd15_lora.json` | `deploy-gpu.yaml` (`ADR-0024` D4) | `curalina-gpu-renderer` |
| `deploy-all` | **manual** | — | runs every `deploy-*` for `main` HEAD | all (first deploy, and after a workloads recreate) |

Path filters must list **every directory an image's build context
copies**. The three Python Dockerfiles copy `design_rules/` plus their own
directory (`room_generator/Dockerfile:17,21` and the equivalents), so a
rules-engine change redeploys all three. If a Dockerfile starts copying
something new, its trigger's filter must change in the same PR. The
reviewer checks this.

**`deploy.yaml` steps, parameterised by substitutions** (`_IMAGE`,
`_DOCKERFILE`, `_CONTEXT`, `_SERVICES`, `_WORKER_POOLS`, `_REGION`, `_REPO`):

1. **Test.** For Python images: in a `python:<version from that service's
   Dockerfile>` step, run
   `pip install ./ai_services/design_rules "./ai_services/<svc>[dev]" && pytest -m "not gpu"`
   (the fast suite, which by `CLAUDE.md` needs no GPU, internet, cloud
   account or model download). For the app: `npm ci && npm run build`. That
   is the only available gate (C5), and adding a test runner is a separate
   app packet.
2. **Build.** `docker build -f $_DOCKERFILE -t $_REPO/$_IMAGE:$COMMIT_SHA $_CONTEXT`.
3. **Push**, then **resolve the digest**
   (`gcloud artifacts docker images describe $_REPO/$_IMAGE:$COMMIT_SHA --format='value(image_summary.digest)'`).
4. **Deploy by digest** to each target:
   `gcloud run services update <svc> --image=$_REPO/$_IMAGE@<digest> --region=$_REGION`,
   and the worker-pool equivalent (R1) for each pool. `update`, not
   `deploy`: it changes only the image and leaves every Terraform-owned
   setting alone.
5. **No separate smoke step.** Cloud Run does not move traffic to a revision
   that fails its startup probe, and the build fails. Every service already
   has a cheap health endpoint (`/healthz`, `/openapi.json`) to use as the
   startup probe.

`pr-checks.yaml` runs step 1 for every component, plus a Docker **build
without push** for each image, so a broken Dockerfile fails before merge.

**CI never runs database migrations.** The app's `migrations/*.sql` files
are hand-reviewed and are never applied with `drizzle-kit push`
(`STATUS.md` item 28). They stay a human step, applied to that
environment's Neon database **before** merging the code that needs them.
`migrations/**` is in `deploy-app`'s filter only so that the app image
redeploys alongside them. The AI services create their schemas from their
own startup code (M0), under the expand-then-contract rule (D2).

**Artifact Registry:** repository `curalina` with **immutable tags** on,
so `:$COMMIT_SHA` always means one digest. That property is what makes
promotion (D8) deterministic. The `ADR-0022` cleanup policy is kept (keep
the newest 10 versions per image; delete untagged images after 14 days).

**CI identity:** every trigger runs as a user-managed `sa-deployer`, set
explicitly on the trigger and never the project's default build or Compute
account. Its grants are: `artifactregistry.writer` on the repository;
`run.developer` on the project; `iam.serviceAccountUser` on **the
runtime service accounts only** (which is needed to deploy a revision that
runs as them); and `logging.logWriter`. In the dev project only, it also
gets `storage.objectViewer` on the model-artifacts bucket (`ADR-0024`).
**It has no Terraform state access and no IAM-admin rights.**

**Repository hygiene, folded into packet C1:** add `ai_services/.dockerignore`
excluding `**/data/*.sqlite3`, `**/notebooks/**`, `**/runs/**`, `**/tests/**`
and `**/__pycache__` (C6). The renderers build from their own directories
and need their own `.dockerignore` only if they grow junk.

### D7 — Terraform owns configuration, CI owns the image (reverses `ADR-0022` D8)

Every `google_cloud_run_v2_service` and worker-pool resource carries:

```
lifecycle {
  ignore_changes = [
    template[0].containers[0].image,
    client, client_version,          # set by gcloud on each CI deploy
  ]
}
```

These resources are created with a public placeholder image
(`us-docker.pkg.dev/cloudrun/container/hello`) through a module variable.
**Terraform owns every other setting** (CPU, memory, scaling, env vars,
secret version pins, invoker IAM and Cloud SQL mounts), and changes to
those still go through `terraform plan` and `apply` by a human.

**Why `ADR-0022` D8 is reversed.** D8 assumed a laptop deploy, where "push,
then apply with the new digest" is one person's two commands. With CI on
every merge, keeping D8 means either (a) CI runs `terraform apply`, with the
costs given in Options, or (b) CI commits digests back to `main`, which is
bot commits that retrigger builds. The property given up is narrow: **the
image field alone** is not in Terraform state. Its record is just as good,
in three places: Cloud Run revision history (each revision pins its
digest), Cloud Build history (commit → digest) and immutable
`:$COMMIT_SHA` tags. `images.auto.tfvars.json` and the `ADR-0022` push
script are dropped.

**Recreating workloads** after `terraform destroy`/`apply` leaves
placeholder images until `deploy-all` runs. That is one manual trigger run,
written into the runbook and into P3's done-evidence.

### D8 — Production is promoted by digest from a GitHub release tag, with approval

- The **prod project** has its own GitHub connection (a second one-time
  console authorization) and one trigger, `promote-to-prod`. It fires on
  pushing a tag matching `^release-.*$`, and has
  **`approval_config.approval_required = true`**. The build waits in the
  Cloud Build console until a person holding Cloud Build approver rights
  approves it.
- `promote.yaml` **never builds.** For each image it resolves
  `dev-registry/<image>:$COMMIT_SHA`. **It fails closed if that tag does
  not exist**, because a release tag must point at a commit that `main`
  already built and deployed to dev. It then copies the image by digest
  into the prod registry and runs the same `services update` and
  worker-pool update by digest against prod. So prod runs the exact bytes
  that ran in dev, as `ADR-0022` required. The copy tool (`crane cp`, or a
  `gcloud artifacts` equivalent) is per R1.
- The prod `sa-deployer` gets `artifactregistry.reader` on the **dev**
  repository, and nothing else in dev.
- Prod promotion of a GPU image with a baked LoRA additionally requires the
  sign-off label from `ADR-0024` D4. That is one check in `promote.yaml`.

### D9 — The root `cloudbuild.yaml` is replaced, not adapted, and left untouched until B1 is answered

**Replaced**, because none of it survives: the wrong registry (`gcr.io` /
Container Registry, R1), the wrong region (`us-central1`, vs `us-east4`),
the wrong service (`curalina-git-2`), a mutable tag, one image out of
seven, no tests, and `services update` on a service Terraform does not
manage.

**Not edited, renamed or deleted yet**, for a reason that is sharper than
in `ADR-0022`: C4 says a trigger in a project we cannot see very probably
reads **this exact path**. Editing it would change what that unknown
project builds and deploys on its next push. Deleting it would break that
pipeline without its owner knowing. **All new pipeline files therefore live
under `infra/cloudbuild/`**, a path no existing trigger can be reading. The
sequence is: B1 identifies the project → its owner disables or deletes the
`curalina-git-2` trigger → a PR deletes the root `cloudbuild.yaml`.

### D10 — Kept from `ADR-0022` without change

Region `us-east4` (D3, overridable by B6). Separate dev and prod projects
(D4). Secret containers in Terraform and values never (D6). SD 1.5 not
deployed in v1, with the GPU module disabled (D7). App on instance-based
billing with min 1, because of the reconciler (C3.3). Packets P0a (quiz
upload → GCS), P0b (`SESSION_SECRET` fails closed), P0c (renderer ID
token), P4 (route enumeration, two-instance reconciler test), P6a/P6b
(CUDA image, GPU enable).

## Target architecture

```
                            GitHub: <repo per B8>
                 PR ─► pr-checks      merge to main ─► deploy-<image>      tag release-* ─► promote-to-prod
                                              │ (Cloud Build, Google-managed workers, no VM)     │ (prod project, approval)
                                              ▼                                                  ▼
   ┌──────────────────────── GCP project curalina-<env>, region us-east4 ─────────────────────────────────┐
   │  Artifact Registry  us-east4-docker.pkg.dev/<project>/curalina/<image>:<sha>  (immutable tags)        │
   │                                                                                                       │
   │  Internet ─► Cloud Run curalina-app (public, min 1, CPU always allocated) ──► Neon (AWS us-east-1)    │
   │                 │  ID token (aud = target)                                     S3 product images      │
   │                 ├──► Cloud Run curalina-recommendation (IAM: sa-app) ─┐                               │
   │                 ├──► Cloud Run curalina-variants       (IAM: sa-app) ─┤  unix socket, per-svc role    │
   │                 └──► Cloud Run curalina-rooms          (IAM: sa-app) ─┤                               │
   │                                                                        ▼                              │
   │  Worker pool curalina-variants-worker (1) ──────────────────► Cloud SQL curalina-ai-pg (PG 16)        │
   │  Worker pool curalina-rooms-worker   (1) ──────────────────►   curalina_{recommendation,variants,rooms}
   │        │ ID token                                                                                     │
   │        ├──► Cloud Run curalina-composite-renderer (IAM: sa-rooms, scale to 0)                         │
   │        │       └─ GCS volume (ro) ◄── <env>-curalina-supplier-images                                  │
   │        └──► [disabled] Cloud Run + L4 curalina-gpu-renderer (gpu_region; LoRA baked, ADR-0024)        │
   │                                                                                                       │
   │  Secret Manager · GCS <env>-curalina-uploads · Cloud Logging · Billing budget                         │
   │  (dev only) GCS <dev>-curalina-model-artifacts  ◄── Colab / promote script (ADR-0024)                 │
   └───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Terraform layout delta (against `ADR-0022` §"Terraform layout")

Same top-level `infra/terraform/`, same `bootstrap/`, and the same two
roots per environment (`foundation` and `workloads`), with the same state
handling.

**Removed modules:** `network`, `ai_host_vm`. **Removed files:**
`workloads/images.auto.tfvars.json`, `infra/scripts/push_images.sh`.

**Changed modules:**

- `project_services`: drop `compute` and `iap`. Add `sqladmin`,
  `cloudbuild`, `developerconnect` (R1) and `run` (already present).
- `service_accounts`: the accounts listed in D2, plus `sa-deployer`. Add
  `roles/cloudsql.client` for `sa-recommendation`, `sa-variants` and
  `sa-rooms`; `logging.logWriter` for all runtime accounts; and
  `sa-deployer` grants as in D6.
- `secrets`: add `recommendation-database-url`, `variants-database-url`,
  `rooms-database-url` (accessor = that service's account only) and
  `ai-pg-admin-password` (accessor = the owner principal only, B7).
- `storage`: unchanged for `uploads` and `supplier_images`. In **dev only**,
  add `model_artifacts` (specified in `ADR-0024` D1).
- `cloud_run_service`: add optional `cloudsql_instances` (list → a Cloud SQL
  volume mounted at `/cloudsql`), a `startup_probe` path, a
  `placeholder_image` default and the D7 `ignore_changes`. Remove
  `vpc_access`.

**New modules:**

```
cloud_sql_ai/        google_sql_database_instance "curalina-ai-pg":
                       database_version POSTGRES_16, settings.edition ENTERPRISE,
                       tier var.tier, disk autoresize on, backup_configuration enabled,
                       ip_configuration { ipv4_enabled = true, ssl_mode = ENCRYPTED_ONLY,
                                          no authorized_networks },
                       deletion_protection = true, lifecycle { prevent_destroy = true }
                     NO google_sql_user / google_sql_database (D4: created by SQL,
                       passwords never in state)
                     outputs: connection_name
cloud_run_worker_pool/
                     google_cloud_run_v2_worker_pool (provider per R1):
                       image = placeholder + D7 ignore_changes, args = ["worker"],
                       instance count = var.instances (validation: == 1 until P0e
                         is merged; the validation is removed in P0e's PR),
                       cpu, memory, service_account, env, secret_env,
                       cloudsql_instances
ci/                  (in foundation, count = var.ci_enabled ? 1 : 0; flipped
                       after the one-time console GitHub authorization, B8)
                     repository link resource on the existing connection (R1)
                     google_cloudbuild_trigger for_each over the D6 table
                       (dev) or the single promote trigger (prod), each with
                       service_account = sa-deployer, included_files,
                       substitutions; prod trigger has approval_config
```

**`workloads` root:** module instances `composite`, `gpu` (disabled),
`recommendation`, `variants_api`, `variants_worker`, `rooms_api`,
`rooms_worker` and `app`. The ordering is derived from references:
composite → rooms (needs the renderer URL and the invoker grant) → app
(needs all three API URLs and their invoker grants). There is no VM IP and
no network output.

**Sizing starting points** (variables, not Design Manual numbers):

| Workload | dev | prod |
|---|---|---|
| `curalina-app` | 1 vCPU / 1 GiB, min 1, max 2 | same |
| each AI API | 1 vCPU / 512 MiB, min 0, max 2, concurrency 4 | 1 vCPU / 1 GiB, min 0, max 2, concurrency 4 |
| each worker pool | smallest CPU and memory worker pools accept (R1), 1 instance | same |
| composite renderer | 1 vCPU / 1 GiB, min 0, max 2 | 1 vCPU / 2 GiB, min 0, max 3 |
| Cloud SQL | `db-f1-micro`, 10 GB SSD | `db-g1-small`, 10 GB SSD |

Raise an AI API's `min` to 1 **only if** P3 measures a cold start longer
than the app's client timeout for that service. That is a measured change,
not a default.

## Operator flow (the `infra/terraform/README.md` runbook covers exactly this)

**Tooling:** none is needed on a laptop. **Cloud Shell** (the terminal icon
in the console) already has `gcloud`, `terraform`, `git` and `psql`
(R1), so a first-time operator can run everything below from the browser.

First time, per environment:

1. The owner creates the project and links billing (B1).
2. `bootstrap/` apply, which creates the state bucket. This is unchanged
   from `ADR-0022`.
3. `foundation` apply with `ci_enabled = false`. This creates the APIs,
   registry, service accounts, secret containers, buckets, budget and the
   Cloud SQL instance.
4. `infra/scripts/bootstrap_ai_databases.sh` (D4), then add the other secret
   values (`DATABASE_URL`, `SESSION_SECRET`, `AWS_*`) as in `ADR-0022` step 4.
   Record the version numbers in `terraform.tfvars`.
5. Upload the supplier images as in `ADR-0022` step 5. For prod, only after
   B3.
6. **Console, once:** Cloud Build → Repositories → connect GitHub and
   install the Cloud Build GitHub App on the B8 repository (this needs a
   GitHub org admin). Then `foundation` apply with `ci_enabled = true`,
   which creates the repository link and the triggers.
7. `workloads` apply, which creates services and pools on the placeholder
   image.
8. Run the `deploy-all` trigger once (`gcloud builds triggers run deploy-all --branch=main`).

**Every code change afterwards: merge to `main`. Nothing else.** Every
configuration change: edit the tfvars or module, open a PR, and after merge
run `terraform plan` and `apply` from Cloud Shell. **Release to prod:**
`git tag release-YYYYMMDD-n <sha> && git push --tags`, then approve the
build in the prod project's Cloud Build console.

## Phased build plan (replaces `ADR-0022` §"Phased build plan")

The `infra/**` owner is still **unassigned** in `AGENTS.md`. The
recommendation is unchanged (`python-services-engineer`, reviewed by
`code-reviewer`), and that edit is still the owner's to make **before** P1.

| Phase | Work | Owner | Depends on | Done-evidence |
|---|---|---|---|---|
| **M0** *(in flight)* | SQLite → Postgres for recommendation, variants and rooms | `python-services-engineer` | — | its own packet. **Plus, checked here:** (1) accepts the D4 socket URL form; (2) connections per process bounded and counted (D4); (3) worker store setup and migrations run once per process, not per loop iteration (C2); (4) startup migrations hold an advisory lock (D4); (5) migrations are expand-then-contract (D2) |
| **P0a**, **P0b** | as `ADR-0022` | `typescript-app-engineer` | — | as `ADR-0022` |
| **P0c** | as `ADR-0022` (renderer ID token) | `python-services-engineer` | — | as `ADR-0022` |
| **P0d** *(new)* | Rooms asset bytes leave the filesystem. **Decided: store them in rooms' own database**, following the variants precedent (C2), through a Postgres-backed `AssetStore` adapter behind the existing port (`curalina_rooms/ports/asset_store.py`). `FilesystemAssetStore` stays for nothing but tests and local use, if at all | `python-services-engineer` | M0 | an API instance serves an asset written by a separate worker process, with no shared volume, in an integration test against Postgres. The existing `AssetStore` port tests pass for the new adapter |
| **P0e** *(new)* | Unique worker identity per process: `worker_id = f"{hostname}-{pid}-{random suffix}"` at worker start, in both services. The `== 1` Terraform validation is removed in the same PR | `python-services-engineer` | M0 | a test where two workers with different IDs race one expired lease: exactly one terminal write |
| **P0f** *(new)* | App `aiServiceFetch` wrapper, D5 (ID token, origin allow-list, `CURALINA_AI_AUTH=none\|gcp_id_token`), adopted at every C3 call site. `google-auth-library` becomes a direct dependency | `typescript-app-engineer` | — | unit tests: token attached for each configured AI origin, **never** for another origin (S3 URL case), none in `none` mode |
| **P1** | `bootstrap/` plus `envs/dev/foundation` with the changed and new modules (`ci_enabled = false`) and `bootstrap_ai_databases.sh` | infra owner | B1, B2 | apply succeeds, and a second `plan` shows no changes. As `postgres`, `\l` shows `curalina_recommendation`, `curalina_variants` and `curalina_rooms`, owned by three roles. Logged in as `rooms`, connecting to `curalina_variants` is refused |
| **C1** | `infra/cloudbuild/{pr-checks,deploy,promote}.yaml`, the `ci` module, `ai_services/.dockerignore` | infra owner | P1, B8 | a PR runs `pr-checks`, and a deliberately failing test blocks it. A merge touching only `ai_services/renderers/composite/**` builds and deploys only the composite renderer |
| **P3** | `envs/dev/workloads` plus `deploy-all` | infra owner | P0a-f, M0, C1 | (1) quiz → concept render (composite) end to end at the dev URL. (2) A second `plan` shows no changes, **even after a CI deploy**, which proves D7's `ignore_changes` is complete. (3) **Destroy and recreate:** `terraform destroy` workloads, then `apply` + `deploy-all`. A render created before is still fetchable, so state lives in Cloud SQL. (4) An unauthenticated `curl` to each AI API and renderer returns 403. (5) The connection budget (D4) holds at every service's max instances. (6) Cold start per AI API vs the app timeout is recorded. (7) An expand-then-contract schema change survives a deploy |
| **P4** | as `ADR-0022` (route enumeration, two-instance reconciler) | `typescript-app-engineer` | P3 | as `ADR-0022` |
| **P5** | `envs/prod/*`, prod GitHub connection, `promote-to-prod` | infra owner | B1-B3, B6, B7 | a `release-*` tag promotes the dev digests after approval. A tag on an unbuilt commit fails closed |
| **P6a/P6b** *(optional)* | as `ADR-0022`, extended by `ADR-0024` M5 (LoRA baked) | as `ADR-0022` | B5 | as `ADR-0022` |
| **P8** *(optional)* | Release the lease on `SIGTERM` in both workers | `python-services-engineer` | M0 | a test that `SIGTERM` mid-job returns the job to `queued` |

## Blocking inputs (owner and client), replacing `ADR-0022`'s table

| ID | Question | Blocks | Change since `ADR-0022` |
|---|---|---|---|
| **B1** | Which GCP projects? **Sharpened:** who is GitHub user `Design44inc` (author of `cloudbuild.yaml`, C4)? Which GCP project hosts `curalina-git-2`, which branch of `CuralinaTech/curalina` does its trigger watch, is it still live and billing, and does it hold user data (`*.appspot.com` bucket, Firebase site)? That trigger must be disabled by its owner before the root `cloudbuild.yaml` is removed (D9). Which billing account do we use? | P1 | sharpened with authorship evidence |
| **B2** | Monthly budget per environment | P1 | the cost profile changed (see Cost) |
| **B3** | Supplier-image usage rights for a **public** prod. **Extended by `ADR-0024`:** rights to **train a model** on them, and to show that model's outputs publicly | P5 (prod images), and prod LoRA activation | scope extended |
| **B4** | Custom domain | nothing in v1 | unchanged |
| **B5** | GPU funding plus L4 quota | P6b | unchanged |
| **B6** | Data residency | P5, and possibly region | **partly de-risked.** The AI databases are Cloud SQL and follow the region variable. Only the app's Neon database would still need to move if Canada is required |
| **B7** | Who holds and enters prod secrets? **Now also:** who holds `ai-pg-admin-password`, and who may approve `promote-to-prod` builds | P5 | scope extended |
| **B8** *(new)* | Which GitHub repository and branch is the deploy source: `CuralinaTech/curalina` `main` (`origin`) or the `SalmonRanjay/curalina-mn-fork` fork (`upstream`, where `RJ-001` is pushed)? A **GitHub org admin** of that repository's owner must approve the Cloud Build GitHub App installation | C1 (not P1) | new |

**No longer blocking anything:** `ADR-0022` R1 items on `internal` ingress
via Private Google Access, Direct VPC egress network tags, and VM
startup-script replacement. Those resources no longer exist.

## Rough monthly cost, per environment

**These are order-of-magnitude list-price estimates from memory, not
quotes. Re-price them for `us-east4` before setting B2.** Neon and S3 are
billed separately and are unchanged.

| Item | Estimate |
|---|---|
| Cloud Run `app`, 1 vCPU / 1 GiB always allocated, min 1 | ~$45–65 |
| Two worker pools, 1 small instance each, always on | ~$15–60 total, which depends mainly on the smallest CPU allocation worker pools accept (R1) |
| Cloud SQL `db-f1-micro` (dev) / `db-g1-small` (prod), plus storage and backups | ~$10–15 / ~$30–40 |
| AI APIs and composite renderer (scale to zero), at demo traffic | ~$0–10 |
| Cloud Build (default pool free tier, R1), Artifact Registry storage, Secret Manager, GCS, Logging | ~$1–10 |
| **Baseline** | **~$70–150 dev, ~$90–175 prod** |
| GPU renderer, if enabled | about $1/hour **while warm**, $0 when scaled to zero |
| *Removed vs `ADR-0022`:* VM, persistent disk and snapshots, Cloud NAT | *-$30–75* |

This is about the same money as the VM design. **The gain is operational,
not financial**: no OS patching, no disk, no SSH and no single host. Dev can
set both worker pools to 0 instances and keep AI API min at 0 when idle,
which brings it close to app plus Cloud SQL.

## Consequences and reversal

**Costs accepted.**

- **Two always-on worker instances** (D3) are paid for in exchange for not
  building a trigger plus sweeper.
- **A deploy that lands mid-render delays that render** by up to the lease
  timeout (D3), until P8.
- **The image is the one setting outside Terraform state** (D7).
  `ignore_changes` must stay exactly as written. If it is widened, the
  property degrades silently.
- **One Cloud SQL instance is a shared failure domain** for three services
  (not a shared database). An instance outage stops all three, and the app
  fails closed with `ai_services_unreachable` (`ADR-0016`). That is the
  same blast radius the VM had, minus the OS.
- **Six new small packets (M0 checks, P0d-P0f, C1)** sit between today and
  a working dev deploy. P0d and P0e are real correctness work, not polish.
- **Path filters can drift from Dockerfiles** (D6). If they do, a change
  ships without its image being rebuilt. `deploy-all` is the recovery, and
  the reviewer check is the prevention.

**Reversal.**

- **D3 (worker pools)** → W3 (jobs on enqueue) if the idle worker cost
  becomes material against B2. That is an adapter, IAM and a sweeper. The
  data model is unchanged. → W4 if R1 fails.
- **D4 (Cloud SQL)** → Neon by changing three secret values and removing
  the Cloud SQL mounts. The store code is untouched, because the URL is
  the interface. That is only sensible if B6 settles on US residency.
- **D5 (ID tokens)** → there is no weaker fallback worth naming. If token
  minting fails at P3, fix the client rather than open the services.
- **D6 (Cloud Build)** → GitHub Actions + Workload Identity Federation. Port
  the three YAML files to workflow files. `sa-deployer`'s grants stay the
  same and are bound to the WIF principal instead. No runtime change.
- **D7 (CI owns the image)** → back to `ADR-0022` D8 by removing
  `ignore_changes` and having CI run `terraform apply`. That needs CI to
  hold state access and broader IAM.
- **D9** completes itself once B1 is answered.

**What would prove this decision wrong.**

- **If P3 item (2) shows a perpetual diff after a CI deploy**, D7's
  `ignore_changes` list is incomplete (for example, gcloud setting
  annotations). Extend it narrowly. If the diff is in a field that matters,
  D7 is wrong and the D8 reversal applies.
- **If worker pools cannot mount Cloud SQL or reach the metadata server
  for ID tokens** (R1), D3 falls back to W4, or D4 to private IP. The
  design survives, but a premise was false.
- **If the connection budget (P3 item 5) cannot be met on the chosen tier**
  without throttling the APIs, the tier is wrong, not the topology.
- **If a rooms render's bytes cannot be served by an API instance other
  than the worker's** after P0d, P0d is incomplete. That is exactly the
  failure C2 predicts without it.
- **If `Design44inc`'s trigger turns out to watch the branch we merge to**
  and has been deploying, B1 is more urgent than "blocks P1": that is a live
  deployment of this repository that nobody here controls.

**What I am explicitly not deciding.**

- **Anything about models** (`ADR-0024`), and whether any model output is
  acceptable, which belongs to `ai-ml-lead`.
- **Moving the app off Neon.** It is unchanged here. B6 may force it.
- **The Postgres migration's internals** (M0) beyond the four interface
  facts D4 and C2 require of it.
- **An app test runner** (C5). That is a separate app packet. Until then the
  app's CI gate is "it builds".
- **The `AGENTS.md` roster change for `infra/**`**, which is the owner's.

## R1 — Cloud-product facts to re-verify at packet time

Stated from current knowledge, not from this repository. **The packet that
first depends on each one must check current Google documentation before
relying on this ADR's sentence.**

- **Cloud Run worker pools:** GA vs preview; availability in `us-east4`;
  Terraform resource name and provider (`google_cloud_run_v2_worker_pool`,
  possibly `google-beta`); `gcloud` command group (`gcloud [beta] run worker-pools`)
  and whether `update --image` exists; how the instance count is set;
  minimum CPU and memory; support for **Cloud SQL connections**, Secret
  Manager env vars and the metadata-server ID token; `SIGTERM` grace period.
  (C1, P3)
- Cloud Run built-in Cloud SQL connection on v2 services (the
  `cloud_sql_instance` volume) and the socket path form. (P3)
- That new Cloud SQL PostgreSQL 16 instances may default to Enterprise Plus,
  and that `edition = "ENTERPRISE"` admits shared-core tiers. `db-f1-micro`
  / `db-g1-small` `max_connections` defaults. Whether API-created users join
  `cloudsqlsuperuser`. `gcloud sql connect` behaviour against a public-IP
  instance with no authorized networks. (P1)
- Cloud Build: the current name and Terraform resources for GitHub
  repository connections (`google_cloudbuildv2_connection` /
  `_repository`, or `google_developer_connect_*`); whether the connection
  must be authorized in the console first; trigger `approval_config`;
  default-pool free-tier minutes; and whether the default pool's disk is
  large enough for the GPU image (`ADR-0024` M5). (C1)
- Artifact Registry immutable tags and the cross-registry copy tool. (C1, P5)
- The state of `gcr.io` / Container Registry (D9, B1 cleanup).
- Cloud Shell's preinstalled `terraform` and `psql`. (operator flow)
- Every price in the cost table.

## Verification

Read this session, from source:

- `git log`, `git status`, and `grep` for Postgres drivers under
  `ai_services/` (C1: not in `b856f5c`). The uncommitted in-flight
  migration was **read, not modified**: `recommendation/pyproject.toml`,
  `settings.py`, `bootstrap.py`, `db/migrator.py`,
  `api/repository.py:285` (connection per operation), `migrations/env.py`
  (`NullPool`), `ai_services/docker-compose.common.yml` header, and the
  presence of `variant_generator/src/curalina_variants/{db,migrations}/`.
- `curalina_variants/api/sqlite_store.py:53-188, 398-482` (asset bytes as
  `BLOB`). `curalina_rooms/api/app.py:35-37` and `workers/runner.py:60-100`
  (filesystem assets, per-iteration store setup, `worker_id="worker_local"`).
  `curalina_rooms/api/sqlite_store.py:120, 350-409, 486-579` (lease-owner
  checks). `curalina_variants/workers/runner.py:60-190`.
  `curalina_rooms/settings.py` (lease 1800 s > render timeout 1500 s).
  `bootstrap.py` in both services.
- `ai_services/{recommendation,variant_generator,room_generator}/Dockerfile`
  (build context, `COPY design_rules/`, `ENTRYPOINT`/`CMD`).
  `ai_services/renderers/{docker-compose.yml, sd15/Dockerfile}`.
  `ai_services/docker-compose.common.yml`.
- `git ls-files` for tracked `*.sqlite3` (C6). There is no
  `ai_services/.dockerignore`.
- `server/services/ai-adapter/*.ts` `fetch` call sites and
  `server/config/ai-services.ts:95-97` (C3). `package.json` scripts and
  dependencies (C5).
- `cloudbuild.yaml` and `git log -- cloudbuild.yaml` (C4). `git remote -v`
  (B8).
- `ADR-0022` in full, plus `ADR-0016`, `ADR-0020` §D3/§D6, and the
  `ADR-0012`/`ADR-0021` supersession conventions.

No `.tf` file, script, pipeline file or service source was written or
changed by this ruling. The consequential work is carried by
`agent_instructions/STATUS.md` dispatch item 37.
