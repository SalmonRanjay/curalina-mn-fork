# Investigating a slow or stuck render

This is a practice runbook: the exact commands used to diagnose why a
specific render was stuck on 2026-10-01/02 (root cause: both background
workers had silently crashed 12 hours earlier and never restarted), written
up so you can run the same steps yourself next time something feels slow.

Everything here assumes the dev stack is running via `docker compose` from
the repo root.

## 1. Is it actually stuck, or just slow?

SD1.5 renders on CPU take **5-8 minutes**, genuinely. Before assuming
something is broken, check how long it's actually been:

```bash
# Replace with your render id from the URL (?renderId=...)
curl -s "http://localhost:8080/api/render/<renderId>" | python3 -m json.tool
```

Look at `status` and `createdAt`. `"status": "generating"` for 2-3 minutes
is normal. `"generating"` for 15+ minutes, or a `createdAt` from hours ago,
is not.

## 2. Are the containers actually up?

```bash
docker compose ps --format "table {{.Service}}\t{{.Status}}"
```

A service missing from this list (not just "unhealthy" — *absent*) usually
means it exited and didn't restart. Confirm with `-a` to see stopped
containers too:

```bash
docker compose ps -a --format "table {{.Service}}\t{{.Status}}\t{{.Name}}"
```

`Exited (1) 12 hours ago` on `rooms_worker` or `variants_worker` is exactly
what caused this incident — the API containers (`rooms_api`,
`variants_api`) stayed healthy and kept *accepting* new render requests the
whole time, so nothing about submitting a render failed. The jobs just sat
in the queue forever because nothing was polling for them.

## 3. If a worker is down, read why before restarting it

```bash
docker compose logs rooms_worker 2>&1 | tail -40
docker compose logs variants_worker 2>&1 | tail -40
```

A traceback ending in something like
`psycopg.OperationalError: connection failed: ... server closed the
connection unexpectedly` means a transient Postgres connection drop killed
the process. As of this fix, both workers now retry transient errors with
backoff instead of dying (see "What changed" below) — so if you see a
worker down *after* that fix landed, treat it as a real finding, not
routine.

## 4. Look at the actual job queue, not just the app's view

The app's `/api/render/:id` only tells you what the app's own `renders`
table thinks. The ground truth for whether a job is queued, running,
leased, or stuck is in the room/variant service's own Postgres database.

```bash
# Rooms jobs
docker compose exec -T postgres psql -U curalina -d curalina_rooms -c \
  "SELECT job_id, lease_owner, leased_until, substring(record_json from 1 for 60) FROM jobs ORDER BY job_id DESC LIMIT 10;"

# Variants jobs (same idea, different db/table shape - check with \d jobs first if unsure)
docker compose exec -T postgres psql -U curalina -d curalina_variants -c \
  "SELECT job_id, lease_owner, leased_until FROM jobs ORDER BY job_id DESC LIMIT 10;"
```

What to look for:
- `lease_owner` empty + status `queued` → nobody has ever picked this job
  up. If this persists for more than a few seconds while a worker is
  healthy, something is wrong with the worker's polling loop.
- `lease_owner` set + status `running`, and `leased_until` **in the past**
  → an abandoned lease (the process that held it died or was killed before
  finishing — e.g. the container was restarted mid-render). This is
  expected to self-heal: `lease_next_job()` treats an expired lease as
  available again, so the next worker poll reclaims it. Check how far in
  the future `leased_until` is before assuming you need to intervene.
- `lease_owner` set + status `running`, `leased_until` **in the future** →
  genuinely being worked on right now. Confirm with the CPU check below.

## 5. Confirm a renderer is actually computing (not just "leased and stuck")

A job can be leased without the actual GPU/CPU work happening yet (e.g. the
worker is still waiting on something else). Check real resource usage:

```bash
docker stats --no-stream curalina_rooms_worker curalina_sd15_renderer curalina_composite_renderer
```

For an SD1.5 render in progress, you should see `sd15_renderer` pinned at
very high CPU (multiple hundred percent — it's multi-threaded) and
`rooms_worker` near 0% (it's just blocked waiting on the HTTP response, not
doing the compute itself). If `sd15_renderer`'s CPU is near 0% while a job
shows as `running`, that render is not actually progressing.

## 6. Manually un-stick an abandoned lease, if you don't want to wait for self-heal

Only do this if you've confirmed (step 4) the lease is genuinely expired
and nothing is actively working on it. This mirrors exactly what the
reclaim logic already does on the next poll — you're just not waiting for
it:

```bash
docker compose exec -T postgres psql -U curalina -d curalina_rooms -c \
  "UPDATE jobs SET leased_until = (now() - interval '1 second')::text WHERE job_id = '<job_id>';"
```

The next worker poll (within ~1 second, per its idle-poll interval) will
pick it back up.

## 7. Watching a render live, start to finish

Once the logging fix below is in place, this is the easy way to just watch
it happen rather than repeatedly querying the database:

```bash
docker compose logs -f rooms_worker
```

You should see, per job: a "leased job ... (renderer=...)" line when it
picks one up, then (several minutes later for sd15) a "job ... -> completed
in N.Ns" line. Silence in between is normal — that's the actual render
happening inside `sd15_renderer`, which you can watch separately with
`docker compose logs -f sd15_renderer` (mostly healthz noise unless you
filter) or the `docker stats` check from step 5.

## What changed because of this incident

1. **`restart: unless-stopped`** on both `rooms_worker` and
   `variants_worker` (they were `restart: "no"`, which is why a crashed
   worker just stayed dead — Docker never brought it back on its own).
2. **Retry with backoff on transient errors**, inside the worker loop
   itself (`bootstrap.py::run_worker`) — so a dropped DB connection no
   longer kills the process at all; it logs, waits (2s, backing off to a
   30s cap), and keeps polling. The restart policy above is now a second
   line of defense, not the only one.
3. **Real logging**, where there was previously none at all: job
   pickup, completion (with elapsed seconds), and failures now log at
   INFO/WARNING in both `rooms_worker` and `variants_worker`. See
   `ai_services/room_generator/src/curalina_rooms/workers/runner.py` and
   the equivalent in `variant_generator`.
4. **A second bug found while verifying #3**: Alembic's `env.py` (in all
   three Python services) called `fileConfig(...)` with its default
   `disable_existing_loggers=True`, which — because `store.initialize()`
   runs migrations on *every* worker poll, not just once at startup —
   silently disabled the worker's own application logger after its very
   first poll. The new logging appeared to not work at all until this was
   found and fixed (`disable_existing_loggers=False`). If you ever add
   logging to one of these services and it mysteriously stops appearing
   after the first log line, this is the first thing to check.

## A gap this did NOT fix (known, not acted on)

`store.initialize()` — which includes re-running Alembic's migration
check and `seed_from_fixtures()` — runs on **every single worker poll**,
not once at startup. On an idle queue that's a Postgres round-trip every
second, forever. It's harmless today at this traffic volume, but is worth
moving to run once at worker startup instead, the next time someone is in
this code.
