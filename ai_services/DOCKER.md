# Docker Compose Setup for Curalina

This document explains the Docker Compose infrastructure for running the
full Curalina stack locally in containers — the existing TypeScript/Express
`app` plus the three AI services (recommendation, variants, rooms).

## Overview

The Docker Compose setup consists of five key files:

1. **Per-service compose files** (`ai_services/{service}/docker-compose.yml`)
   - Standalone definitions for each of the three AI services
   - Can be run independently or included in the root orchestrator

2. **Shared infrastructure** (`ai_services/docker-compose.common.yml`)
   - PostgreSQL container for future use (see "Data Persistence" below) —
     **not** what `app` connects to; see the `app` service note below.

3. **Root orchestrator** (`docker-compose.yml` at repository root)
   - Uses Docker Compose `include:` directive to bring in the three AI
     services' compose files and the shared infrastructure file
   - Defines the `app` service directly (it isn't in a per-service
     subdirectory the way the Python services are — its `Dockerfile`
     predates this compose setup and lives at the repo root)
   - Single entry point to start everything together

### The `app` service and the database it actually uses

`app` is the existing product — the one described in `docs/replit.md` and
`CLAUDE.md`, not a new service. It's wired to talk to the three AI services
over the shared Docker network (`CURALINA_AI_SERVICES_ENABLED=true`,
service URLs using container hostnames like `http://recommendation_api:8101`,
not `127.0.0.1` — that only resolves for processes sharing a host, not
separate containers).

**Its actual database is not the Postgres container in this compose
setup.** `server/db.ts` uses `@neondatabase/serverless`, which speaks
Neon's own WebSocket/HTTP protocol — a plain `postgres:16-alpine` container
cannot serve it without a Neon-compatible local proxy, which is not set up
here. `app`'s container reads `DATABASE_URL` from your existing `.env`
file via `env_file`, pointing at whatever real Neon database you already
use for `npm run dev` locally. The same is true for AWS S3 (product
images), Google Cloud Storage (user uploads), and the OpenAI/Stability
keys the legacy in-app image path needs — all real external services,
passed through from `.env`, never fabricated or stubbed by Docker.

## Quick Start

### Start the entire stack from the repository root:

```bash
cd /Users/rjsalmon/Documents/Humber/curalina
docker compose build
docker compose up
```

The app, all three AI services, and the (currently unused-by-anything)
shared Postgres infrastructure all start together. Access them at:
- **App**: `http://localhost:8080`
- Recommendation: `http://localhost:8101/docs`
- Variants: `http://localhost:8102/docs`
- Rooms: `http://localhost:8103/docs`
- Postgres (future use): `localhost:5432` (user: `curalina`, password: `curalina_dev_password`)

A working `.env` file at the repository root is required before `app` will
start successfully — it needs at minimum `DATABASE_URL` and
`SESSION_SECRET`; AWS/GCS/OpenAI/Stability keys are needed for the features
that call those services, not for the app to boot.

### Start the AI services only, without the app:

```bash
docker compose up recommendation_api variants_api rooms_api
```

### Start one AI service independently:

```bash
cd ai_services/recommendation
docker compose build
docker compose up
```

The service starts with its own database on its designated port.

## Service Details

### Recommendation Service
- **Image**: Built from `ai_services/recommendation/Dockerfile`
- **Port**: 8101
- **Compose file**: `ai_services/recommendation/docker-compose.yml`
- **Process**: API only (no worker)
- **Database**: SQLite at `/data/recommendation.sqlite3` (mounted volume)
- **Boot command**: `python3 -m curalina_recommendation.bootstrap`

### Variants Service
- **Image**: Built from `ai_services/variant_generator/Dockerfile`
- **Port (API)**: 8102
- **Compose file**: `ai_services/variant_generator/docker-compose.yml`
- **Processes**: Two containers from the same image
  - `api`: FastAPI server on port 8102
  - `worker`: One-pass job processor (exits after processing jobs)
- **Database**: SQLite at `/data/variants.sqlite3` (shared mounted volume)
- **Boot commands**:
  - API: `python3 -m curalina_variants.bootstrap api`
  - Worker: `python3 -m curalina_variants.bootstrap worker`

### Rooms Service
- **Image**: Built from `ai_services/room_generator/Dockerfile`
- **Port (API)**: 8103
- **Compose file**: `ai_services/room_generator/docker-compose.yml`
- **Processes**: Two containers from the same image
  - `api`: FastAPI server on port 8103
  - `worker`: One-pass job processor (exits after processing jobs)
- **Database**: SQLite at `/data/rooms.sqlite3` (shared mounted volume)
- **Boot commands**:
  - API: `python3 -m curalina_rooms.bootstrap api`
  - Worker: `python3 -m curalina_rooms.bootstrap worker`

## Data Persistence

### SQLite (Current)

All three services use SQLite for persistence:
- **Recommendation**: stored in Docker named volume `recommendation_data`
- **Variants**: stored in Docker named volume `variants_data`
- **Rooms**: stored in Docker named volume `rooms_data`

These volumes are mounted at `/data` inside each container and persist across container restarts. This matches the services' hand-written SQLite schema and literal `sqlite:///` connection string format.

**No changes to service code or database connection strings are needed.** The services read `CURALINA_DATABASE_URL` from the environment (set in docker-compose), which points to the persistent volume.

### PostgreSQL (Future Infrastructure)

A PostgreSQL 16 container is provisioned in `docker-compose.common.yml`:
- **Container name**: `curalina_postgres`
- **User**: `curalina`
- **Password**: `curalina_dev_password` (change in production)
- **Port**: 5432
- **Database**: `curalina`
- **Data volume**: `postgres_data` (mounted at `/var/lib/postgresql/data`)

**This Postgres is NOT wired to any service today.** The recommendation, variants, and rooms services continue to use SQLite. Migration to Postgres is a separate backend engineering task (new drivers, SQL dialect changes, ORM/abstraction layers) and is out of scope for this Docker setup.

Postgres is available as infrastructure for a future migration. It has its own named volume and persists data independently. To use it, a separate migration packet would:
1. Refactor services to use a database abstraction layer (SQLAlchemy ORM or similar)
2. Test against Postgres
3. Provide production connection strings
4. Migrate existing SQLite data if needed

**This is not implemented and is not a blocker for running the services in Docker.**

## Environment Variables

Each service reads these environment variables at startup:

| Variable | Purpose | Value (Docker) | Notes |
|---|---|---|---|
| `CURALINA_ENV` | Environment identifier | `docker` | Differentiates from local/test runs |
| `CURALINA_DATA_DIR` | SQLite database directory | `/data` | Inside container; volume-mounted for persistence |
| `CURALINA_DATABASE_URL` | SQLite connection string | `sqlite:////data/{service}.sqlite3` | File path inside container |
| `SERVICE_HOST` | Bind address | `0.0.0.0` | Listen on all interfaces (required in container) |
| `SERVICE_PORT` | API server port | `8101`/`8102`/`8103` | Set per service |
| `PYTHONDONTWRITEBYTECODE` | Suppress `.pyc` generation | `1` | Cleaner container filesystem |
| `PYTHONUNBUFFERED` | Unbuffered logging | `1` | Logs appear immediately in `docker logs` |

The `CURALINA_DATABASE_URL` uses `sqlite:///` syntax (three slashes = absolute path). Inside the container, `/data/` is a volume-mounted directory, so `sqlite:////data/filename.sqlite3` (four slashes total) resolves to the mounted volume.

## Dockerfile Strategy

Each service has a two-stage Dockerfile:

1. **Builder stage**: Installs system build dependencies, copies source code, installs Python packages via pip
2. **Runtime stage**: Minimal Python image, copies only compiled packages and source code, no build tools

This reduces final image size significantly while keeping builds reproducible and secure.

### Build Flow

```dockerfile
# Builder stage
FROM python:3.14-slim as builder
  → Install build-essential
  → Copy design_rules/
  → pip install -e ../design_rules
  → Copy service/
  → pip install -e ./service

# Runtime stage
FROM python:3.14-slim
  → Copy installed packages from builder
  → Copy source code from builder
  → Set env vars
  → ENTRYPOINT and CMD
```

All packages (design_rules, recommendation, variants, rooms) are installed as editable (development) installs so changes to source code inside the container are reflected immediately (useful for debugging).

## Network Configuration

All services communicate via a custom Docker network named `curalina`:

```yaml
networks:
  curalina:
    driver: bridge
    name: curalina
```

This allows services to reach each other by hostname (e.g., `http://curalina_variants_api:8102` from another container). The network is defined in both per-service and root compose files for consistency.

Today, the three services do not call each other directly — cross-service traffic is orchestrated via `ai_services/suite_client.py`, which talks over public HTTP from the host. In a future integration scenario, this network would enable inter-service communication.

## Running the Suite Test

The existing local suite runner (`ai_services/suite_client.py`) starts services as subprocesses with temporary databases. To verify all three services work together in Docker:

```bash
# From the repository root, with services running:
docker exec -it curalina_recommendation_api python3 -m pytest tests/contract
docker exec -it curalina_variants_api python3 -m pytest tests/contract
docker exec -it curalina_rooms_api python3 -m pytest tests/contract
```

Or run the full suite test against the dockerized services:

```bash
# Run the integration suite over HTTP (services must be running)
python3 ai_services/suite_client.py  # Requires `make -C ai_services setup-all` locally
```

The suite test reads from each service's `/v1` HTTP endpoints (recommendation, variants, rooms) and exercises the full workflow: import catalogue → generate bundle → create variant job → process variant → create room render job → process render.

## Building and Caching

First build takes ~5–10 minutes (downloads Python image, installs all dependencies). Subsequent builds are faster due to Docker layer caching.

To rebuild without cache:

```bash
docker compose build --no-cache
```

To view build logs:

```bash
docker compose build --verbose
```

## Troubleshooting

### Port already in use

If you get "port 8101/8102/8103 already in use", stop conflicting containers:

```bash
docker compose down
```

Or specify a different port mapping:

```bash
docker compose -f docker-compose.yml up --scale recommendation=0  # Skip recommendation
```

### Services fail to start

Check logs:

```bash
docker compose logs -f recommendation_api
docker compose logs -f variants_api
docker compose logs -f rooms_api
```

Common issues:
- Missing `design_rules` package: The Dockerfile copies from `../design_rules/`. Ensure the directory exists at `ai_services/design_rules/`.
- Python version mismatch: Dockerfile uses `python:3.14-slim`. If local testing was on Python 3.11, reinstall dependencies.

### Database corruption

SQLite databases are stored in named volumes. To reset a service's database:

```bash
docker volume rm recommendation_data
docker compose up -d recommendation  # Creates new volume, empty database
```

### Run a one-off worker process

To process a single job queue without keeping the worker running:

```bash
docker compose run --rm variants_worker
docker compose run --rm rooms_worker
```

## File Structure

```
/Users/rjsalmon/Documents/Humber/curalina/
├── docker-compose.yml                      # Root orchestrator (uses include:)
├── ai_services/
│   ├── DOCKER.md                           # This file
│   ├── docker-compose.common.yml            # Postgres + shared infrastructure
│   ├── recommendation/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── src/
│   │   ├── tests/
│   │   └── pyproject.toml
│   ├── variant_generator/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── src/
│   │   ├── tests/
│   │   └── pyproject.toml
│   ├── room_generator/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── src/
│   │   ├── tests/
│   │   └── pyproject.toml
│   └── design_rules/
│       ├── src/
│       ├── tests/
│       └── pyproject.toml
```

## Command Reference

| Command | Effect |
|---|---|
| `docker compose build` | Build all service images |
| `docker compose up` | Start all services (stays attached) |
| `docker compose up -d` | Start all services in background |
| `docker compose down` | Stop and remove all containers (volumes persist) |
| `docker compose down -v` | Stop and remove containers AND volumes (data loss) |
| `docker compose logs -f` | Stream logs from all services |
| `docker compose logs -f recommendation_api` | Stream logs from one service |
| `docker compose ps` | List running containers |
| `docker compose exec <service> <cmd>` | Run a command inside a running container |
| `docker compose run --rm <service> <cmd>` | Start a one-off container and run a command |
| `docker compose config` | Validate and print resolved compose configuration |

## Testing

To run tests inside a running container:

```bash
# Unit tests for one service
docker compose exec recommendation_api python3 -m pytest tests/unit -v

# All tests for one service
docker compose exec variants_api python3 -m pytest tests/ -v

# Lint and type checking
docker compose exec rooms_api python3 -m ruff check src/
docker compose exec rooms_api python3 -m mypy --strict src/curalina_rooms
```

## Production Notes

This Docker Compose setup is intended for **local development and testing**, not production. For production:

1. **Security**: Don't use the default Postgres password; use secrets management (Docker Secrets, Kubernetes Secrets, etc.)
2. **Resource limits**: Add `resources.limits` and `resources.requests` to each service definition
3. **Persistent volumes**: Switch from local driver to a remote storage backend (NFS, object storage, etc.)
4. **Logging**: Configure log drivers (e.g., `driver: json-file` with rotation, or send to a log aggregator)
5. **Networking**: Use a reverse proxy (nginx, Traefik) in front of services
6. **Database migration**: Migrate from SQLite to Postgres with proper schema versioning and data migration
7. **Health checks**: Customize HEALTHCHECK probes for production workloads and timeouts

## References

- Docker Compose documentation: https://docs.docker.com/compose/
- Compose file specification (v3.8+): https://docs.docker.com/compose/compose-file/
- `include:` directive (Compose 2.20+): https://docs.docker.com/compose/compose-file/#include
