# Running and testing the Curalina AI services — a walkthrough

Three independent Python services, one shared library, three ways to start
them, and a full curl-based test of each. Read top to bottom the first
time; after that, jump to whichever section you need.

| Service | Port | What it does |
|---|---|---|
| `curalina_recommendation` | `8101` | Catalogue import, product ranking, bundle composition (logic-only — see `agent_instructions/STATUS.md`) |
| `curalina_variants` | `8102` | Colour-transfer job queue: submit a product photo + target colour, a worker produces a variant |
| `curalina_rooms` | `8103` | Room-render job queue: submit a room photo + bundle, a worker produces a render |

`curalina_design_rules` is the fourth package — not a service, no port, a
shared library the other three import.

All three services persist to a local SQLite file by default. All three
use a **durable job queue** for anything that runs a worker: you `POST` a
job, get a `queued` status back immediately, then a separate worker
process picks it up. This is deliberate — inference never runs inside a
request handler in this project. If a job looks stuck at `queued`, you
forgot to run the worker; that's section 5.

---

## 1. One-time setup

```bash
cd /Users/rjsalmon/Documents/Humber/curalina/ai_services
make -C design_rules setup
make -C recommendation setup
make -C variant_generator setup
make -C room_generator setup
```

Each `setup` installs the shared `curalina_design_rules` package (editable)
plus that service's own package. Everything installs into your system
`python3` — there's no per-service virtualenv in this project. Confirm
you're on the right interpreter:

```bash
python3 --version        # 3.14.x
python3 -c "import curalina_recommendation; print('ok')"
```

If the import fails, `make setup` didn't run against the `python3` your
shell resolves to — check `which python3` matches what you expect.

---

## 2. Three ways to start the services

Pick whichever fits how you work. They're not mutually exclusive — you can
use Make one day and Docker the next, same services underneath.

### 2a. Make — one terminal tab per process

The most direct option, no extra tooling. Each command blocks (runs in the
foreground), so open a separate terminal tab per service:

```bash
# Tab 1
cd ai_services/recommendation && make run-api      # http://127.0.0.1:8101

# Tab 2
cd ai_services/variant_generator && make run-api   # http://127.0.0.1:8102

# Tab 3
cd ai_services/room_generator && make run-api      # http://127.0.0.1:8103

# Tab 4 — only needed when you submit a variants job (section 4)
cd ai_services/variant_generator && make run-worker

# Tab 5 — only needed when you submit a rooms job (section 4)
cd ai_services/room_generator && make run-worker
```

Recommendation has no worker — it's synchronous request/response, no job
queue. Variants' and rooms' `run-worker` processes **one job and exits** —
it's not a loop. Re-run it each time you want it to pick up the next
queued job (or leave a small shell loop running: `while true; do make
run-worker; sleep 1; done`).

### 2b. The built-in local orchestrator — one command, one flow

`ai_services/suite_client.py` starts all three services as real subprocess
uvicorn servers, runs one worker pass each, and exercises a full
catalogue→recommendation→bundle→variant→room flow end to end, then shuts
everything down. This is the fastest way to confirm "does the whole thing
actually work" without touching curl yourself:

```bash
cd ai_services
make run-suite
```

Expect a line like:

```
suite: recommendation->variants->rooms flow passed (snapshot=snap_a3fixture0001, bundle=bundle_logic_0001@1, variant_job=job_000001, variant_candidate=cand_000001, room_job=job_000001, room_candidate=cand_000001)
```

This is a smoke test, not a long-running server — it exits when the flow
finishes. Use section 2a or 2c if you want the services to stay up so you
can poke at them yourself.

### 2c. Docker Compose — the whole stack, one command

Requires Docker Desktop running (`docker info` should not say "Cannot
connect to the Docker daemon").

**Everything — the app plus all three AI services — from the repo root:**

```bash
cd /Users/rjsalmon/Documents/Humber/curalina
docker compose build     # first time, or after a dependency change
docker compose up
```

This is the closest thing to a real end-to-end environment: the app
container talks to the three AI service containers over the Docker
network (not `127.0.0.1` — that's the localhost-only address section 2a
uses), with `CURALINA_AI_SERVICES_ENABLED=true` already set. Once it's up:

- **App**: `http://localhost:8080` — go through the actual quiz flow in a
  browser; a real render submission now calls through to recommendation
  and rooms instead of the old hardcoded placeholder.
- Recommendation / Variants / Rooms: same ports and `/docs` pages as
  section 3 below.

**One thing Docker can't do for you**: `app` needs a working `.env` at the
repo root with `DATABASE_URL` (a real Neon Postgres — the app's database
driver doesn't work against a plain local Postgres container) and
`SESSION_SECRET` at minimum. This compose setup passes your existing
`.env` through to the container; it doesn't manufacture working
credentials for external services you don't already have configured
locally. If `app`'s container exits immediately, check its logs
(`docker compose logs app`) — a missing `.env` value is the most likely
cause.

**Just the AI services, no app:**

```bash
docker compose up recommendation_api variants_api rooms_api
```

**One service on its own:**

```bash
cd ai_services/recommendation && docker compose up
cd ai_services/variant_generator && docker compose up   # brings up both api + worker containers
cd ai_services/room_generator && docker compose up
```

**Run a worker once** (containers don't loop, same as `make run-worker`):

```bash
docker compose run --rm variants_worker
docker compose run --rm rooms_worker
```

Each service persists to SQLite inside a named Docker volume (survives
`docker compose down`, not `docker compose down -v`). A Postgres 16
container is also defined (`ai_services/docker-compose.common.yml`) —
**it exists as infrastructure for a future migration and nothing uses it
yet.** All three services read and write SQLite today, in the container
exactly as they do locally. Full detail: `ai_services/DOCKER.md`.

### 2d. PyCharm / IntelliJ run configurations

Already checked into `.idea/runConfigurations/` — open the project and
they'll show up in the run-configuration dropdown:

- **Recommendation - API**
- **Variants - API** / **Variants - Worker**
- **Rooms - API** / **Rooms - Worker**
- **All Services - API** (compound — starts all three with one click)

First time you open the project, the IDE may prompt you to confirm the
Python interpreter — point it at `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
(the project's previously-configured interpreter reference was stale and
has been fixed, but the IDE still needs to register it once per machine).

---

## 3. Confirm each service actually came up

Every service is a FastAPI app — each one serves interactive API docs and
a machine-readable schema for free:

```bash
curl -s http://127.0.0.1:8101/openapi.json | python3 -m json.tool | head -5
curl -s http://127.0.0.1:8102/openapi.json | python3 -m json.tool | head -5
curl -s http://127.0.0.1:8103/openapi.json | python3 -m json.tool | head -5
```

Or open in a browser for the interactive version: `http://127.0.0.1:8101/docs`,
`:8102/docs`, `:8103/docs`.

A refused connection means the service isn't up yet (or crashed on
startup — check that terminal tab's output). A JSON response means it's
alive and every module it needs actually imported successfully.

---

## 4. Test each service with curl — real request shapes

These are the exact payloads `suite_client.py` sends — not simplified
examples, the real contract shapes. Run them against services already
started via any of section 2's methods.

### 4a. Recommendation (`8101`) — import a catalogue, get recommendations, compose a bundle

```bash
# 1. Import a catalogue snapshot
curl -s -X POST http://127.0.0.1:8101/v1/catalogue/imports \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "1.0",
    "source_uri": "manual-test://my-catalogue",
    "supplier_id": "supplier_curated_001"
  }' | python3 -m json.tool
```

Copy the returned `snapshot_id` (starts with `snap_`) for the next calls.

```bash
# 2. Get ranked recommendations for a design profile
curl -s -X POST http://127.0.0.1:8101/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "1.0",
    "catalogue_snapshot_id": "snap_XXXXXXXXXX",
    "profile": {
      "room_type": "living_room",
      "style": "organic_modern",
      "atmosphere": "warm_balanced",
      "categories": ["sofa", "wall_art"],
      "furniture_budget_minor_units": 200000,
      "currency": "CAD"
    }
  }' | python3 -m json.tool
```

```bash
# 3. Compose a bundle from that same profile
curl -s -X POST http://127.0.0.1:8101/v1/bundles \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "1.0",
    "catalogue_snapshot_id": "snap_XXXXXXXXXX",
    "rules_version": "rules_2024_01",
    "profile": {
      "room_type": "living_room",
      "style": "organic_modern",
      "atmosphere": "warm_balanced",
      "categories": ["sofa", "wall_art"],
      "furniture_budget_minor_units": 200000,
      "currency": "CAD"
    }
  }' | python3 -m json.tool
```

Read the response's `feasible` field honestly — per `ADR-0013`, bundle
composition here is logic-only against labelled-synthetic data and is
expected to surface `needs_input` violations, not claim a real feasible
recommendation. That's correct behavior, not a bug.

### 4b. Variants (`8102`) — import an asset, submit a job, run the worker, review the result

```bash
# 1. Import a source image (content_bytes is the raw file content as a string —
#    real image bytes would be far larger; this is a fixture-sized example)
curl -s -X POST http://127.0.0.1:8102/v1/assets \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: req-manual-asset" \
  -d '{
    "schema_version": "1.0",
    "owner_id": "manual_test_user",
    "original_filename": "test-product.png",
    "media_type": "image/png",
    "content_bytes": "not-real-image-bytes-just-a-test-string"
  }' | python3 -m json.tool
```

Copy the returned `asset_id` (starts with `asset_`).

```bash
# 2. Submit a colour-transfer job
curl -s -X POST http://127.0.0.1:8102/v1/jobs \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: manual-test-job-1" \
  -H "X-Request-ID: req-manual-job" \
  -d '{
    "schema_version": "1.0",
    "parent_product_id": "product_test_001",
    "source_asset_id": "asset_XXXXXXXXXX",
    "mask_id": "mask_manual_000001",
    "target_colour": "#1B4D3E",
    "owner_id": "manual_test_user"
  }' | python3 -m json.tool
```

Copy the returned `job_id` (starts with `job_`) — status will be `queued`.

```bash
# 3. Run the worker (processes exactly one queued job, then exits)
cd ai_services/variant_generator && make run-worker
```

```bash
# 4. Check the job — status should now be "succeeded"
curl -s http://127.0.0.1:8102/v1/jobs/job_XXXXXXXXXX | python3 -m json.tool
```

Copy the returned `candidate_id` (starts with `cand_`).

```bash
# 5. Review the candidate
curl -s -X POST http://127.0.0.1:8102/v1/candidates/cand_XXXXXXXXXX/reviews \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: req-manual-review" \
  -d '{
    "schema_version": "1.0",
    "reviewer_id": "manual_reviewer",
    "decision": "approved",
    "expected_revision": 1
  }' | python3 -m json.tool
```

### 4c. Rooms (`8103`) — import assets, submit a render job, run the worker

```bash
# 1. Import a room photo
curl -s -X POST http://127.0.0.1:8103/v1/assets \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: req-manual-room-asset" \
  -d '{
    "schema_version": "1.0",
    "owner_id": "manual_test_user",
    "original_filename": "test-room.jpg",
    "media_type": "image/jpeg",
    "content_length": 4096,
    "provenance": "customer_upload"
  }' | python3 -m json.tool
```

Copy that `asset_id` as your room photo's asset ID, then import a second
asset for the hero product image the same way (use
`"provenance": "variant_export:cand_XXXXXXXXXX"`, referencing the variant
candidate from 4b if you have one — or just `"manual_test"` if not).

```bash
# 2. Submit a render job
#    bundle_liv001 / rev_002 is a fixture bundle the rooms service seeds
#    for exactly this kind of manual/local testing — it always exists.
curl -s -X POST http://127.0.0.1:8103/v1/render-jobs \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: req-manual-render-job" \
  -d '{
    "schema_version": "1.0",
    "bundle": {
      "bundle_id": "bundle_liv001",
      "bundle_revision": "rev_002"
    },
    "room_type": "living_room",
    "layout_version": "layout_v3",
    "instances": [
      {
        "instance_id": "inst_manual_1",
        "product_id": "product_test_001",
        "quantity": 1
      }
    ],
    "reference_images": [
      {"asset_id": "asset_XXXXXXXXXX", "role": "room_photo"},
      {"asset_id": "asset_YYYYYYYYYY", "role": "hero_product"}
    ],
    "idempotency_key": "manual-render-job-1"
  }' | python3 -m json.tool
```

Copy the returned `job_id` — status will be `queued`.

```bash
# 3. Run the worker (one job, then exits)
cd ai_services/room_generator && make run-worker
```

```bash
# 4. Check the job
curl -s http://127.0.0.1:8103/v1/jobs/job_XXXXXXXXXX | python3 -m json.tool
```

This produces a **fake, labelled-synthetic render** — rooms' actual
model-backed generation is not built (`G01` is blocked on missing client
data; see `agent_instructions/STATUS.md`). The job/worker/review mechanics
above are real; the image content is not.

---

## 5. Common problems

**"Connection refused" on any port.** The service isn't running, or
crashed on startup. Check that terminal tab / `docker compose logs
<service>` for a stack trace — most commonly a missing dependency (re-run
`make setup`) or a port already in use by a previous run that didn't shut
down cleanly.

**A job stays `queued` forever.** You haven't run the worker. Variants and
rooms both need a separate `make run-worker` (or `docker compose run --rm
<service>_worker`) call per job — it's not automatic and doesn't loop.

**PyCharm shows an interpreter warning on first open.** The project's
configured SDK name is `Python 3.14` but the IDE hasn't registered that
interpreter on your machine yet. File → Project Structure → SDKs → Add →
point it at `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`,
name it `Python 3.14` to match, and the checked-in run configurations will
resolve automatically.

**Docker: "Cannot connect to the Docker daemon."** Docker Desktop isn't
running. Start it, wait for it to report ready, then retry.

**Recommendation's bundle response says `feasible: false` / lists
`needs_input` violations.** This is correct, not a bug — see `ADR-0013` in
`architecture/adr/`. Bundle composition here is intentionally logic-only.

---

## 6. Where to go next

- `agent_instructions/STATUS.md` — the single source of truth for what's
  built, what's verified, and what's still blocked, updated every session.
- `ai_services/DOCKER.md` — full detail on the container setup.
- `architecture/adr/` — every architecture decision, numbered, each with
  its own reasoning and reversal conditions.
