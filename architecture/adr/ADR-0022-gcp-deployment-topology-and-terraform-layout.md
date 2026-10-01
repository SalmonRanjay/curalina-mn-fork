# Architecture decision record

ID: ADR-0022
Status: accepted for topology and Terraform layout. Applying anything is
blocked on owner inputs B1 and B2, and production exposure also on B3
(see "Blocking inputs").
Owner and reviewer: `tech-lead` (decision). Raised by the project owner
directly: deploy the stack to Google Cloud with Terraform "for
reproducibility". The owner has never used GCP or Terraform and thinks in
AWS terms (ECR → ECS → RDS). Review: `code-reviewer`.
Date: 2026-09-30

Companion beginner doc, kept deliberately short and separate:
`docs/GCP_ORIENTATION.md`.

## Context

This ADR decides **where each container runs on GCP, how the pieces reach
each other, and how Terraform is laid out** so an engineer can implement it
one packet at a time. It is not Terraform code. No `.tf` files are written
and nothing is provisioned by this ruling.

All of the following was re-derived from the current tree on `RJ-001` this
session rather than taken from the brief.

### C1 — What actually ships today (`docker-compose.yml` + includes)

| Container | Port | Kind | State it holds | Verified at |
|---|---|---|---|---|
| `app` | 8080 | Express + built Vite client, Node 20 | none on disk (see C3 for the exceptions) | `Dockerfile`, `server/index.ts:128-148` |
| `recommendation_api` | 8101 | FastAPI | **SQLite** `/data/recommendation.sqlite3`, writes bundles at runtime (`save_bundle`, `repository.py:243-260`) | `ai_services/recommendation/docker-compose.yml` |
| `variants_api` + `variants_worker` | 8102 | FastAPI + poll loop, **same image, same volume** | **SQLite** `/data/variants.sqlite3` plus asset files, shared by both processes | `ai_services/variant_generator/docker-compose.yml`, `bootstrap.py:20-25` |
| `rooms_api` + `rooms_worker` | 8103 | FastAPI + poll loop, **same image, same volume** | **SQLite** `/data/rooms.sqlite3` plus rendered PNGs under `/data/assets` (`adapters/filesystem_asset_store.py`), shared by both processes | `ai_services/room_generator/docker-compose.yml`, `bootstrap.py:19-25` |
| `sd15_renderer` | 8104 | FastAPI, `diffusers` SD 1.5 | HF weight cache (~4 GB) in a volume, plus an optional LoRA bind mount | `ai_services/renderers/docker-compose.yml`, `sd15/Dockerfile` |
| `composite_renderer` | 8105 | FastAPI, Pillow, no model | read-only bind mount of supplier images from the host | same |
| `postgres` | 5432 | stock container | **wired to nothing** (its own header says so) | `ai_services/docker-compose.common.yml` |

Both workers are `while True: run_worker_once(); sleep(1)` loops against
their service's SQLite file (`curalina_rooms/bootstrap.py:19-25`,
`curalina_variants/bootstrap.py:20-25`). They are not HTTP servers and
expose no port.

The three AI services use the raw `sqlite3` module (`api/sqlite_store.py`:
744 lines for rooms, 642 for variants; `repository.py`: 287 lines for
recommendation). There is no SQLAlchemy layer, so pointing
`CURALINA_DATABASE_URL` at Postgres would **not** just work.

### C2 — The constraint that decides most of the topology

**Each API and its worker share one SQLite file and one asset directory on
one filesystem.** On GCP, that excludes every option where the API and the
worker are separate instances without a shared POSIX disk:

- Cloud Run instances have an in-memory, per-instance, ephemeral
  filesystem. Two Cloud Run services cannot see the same file, and one
  service's data disappears on every redeploy or instance recycle.
- Cloud Storage FUSE volumes do not provide the file locking SQLite needs.
- Cloud Run NFS volumes (Filestore) are the wrong tool for SQLite's
  locking, and Filestore's smallest tier costs far more than this whole
  deployment.

The "durable job" invariant (`CLAUDE.md`: image APIs enqueue durable jobs)
rules out any design where job rows are lost on redeploy. So the stateful
trio is either (a) co-located on a machine with a persistent disk, or (b)
migrated off SQLite first. That is the main decision below.

### C3 — The app is already shaped for Cloud Run, with four gaps

Already ready:

- `server/index.ts:131` detects Cloud Run by `K_SERVICE` and binds
  `0.0.0.0:$PORT`.
- Sessions are stored in Postgres (`connect-pg-simple`, `localAuth.ts:31-38`),
  so they survive multiple instances. `trust proxy` is set (`:63`), and the
  cookie uses `secure: "auto"`, which is correct behind Cloud Run's TLS
  front end.
- User-object storage already uses `@google-cloud/storage` with Application
  Default Credentials (`server/objectStorage.ts:6`). That picks up a Cloud
  Run service account with no key file.
- The database is Neon over `@neondatabase/serverless` (WebSocket on 443,
  `server/db.ts`), so it needs only plain outbound internet.

Gaps that matter on Cloud Run:

1. **The quiz room-photo and floorplan upload writes to local disk.**
   `Quiz.tsx:164-186` posts to `/upload`. `routes.ts:25` uses
   `multer({ dest: "uploads/" })` and returns `/uploads/<name>`. **No static
   route serves `/uploads`**, so the returned URL is already broken
   locally. On Cloud Run it would also count against instance memory and
   vanish on recycle. This is a pre-existing defect, which the deployment
   makes worse.
2. **`STORAGE_BUCKET` must be set explicitly.** It falls back to
   `${GCLOUD_PROJECT}.appspot.com` (`objectStorage.ts:9`). Firebase injects
   `GCLOUD_PROJECT`; Cloud Run does not.
3. **The render reconciler is a background `setInterval`**
   (`render-reconciler.ts`, started at `index.ts:139-141`). With Cloud Run's
   default request-based billing, CPU is throttled between requests, so the
   reconciler would stall. A render would sit at `generating` until
   unrelated traffic arrived.
4. **`SESSION_SECRET` falls back to `"default_dev_secret"`**
   (`localAuth.ts:42`). A missing secret fails open to a publicly known
   value. This is a security defect independent of GCP.

### C4 — The renderers

- `sd15_renderer` installs the **CPU** PyTorch wheel (`sd15/Dockerfile`:
  `--index-url .../whl/cpu`). Its pipeline switches to CUDA when one is
  present (`pipeline.py:111-112`), but this image has no CUDA runtime.
  **A GPU deployment needs a different image**, not just a GPU attached.
  It downloads ~4 GB of weights on first render into a volume. On Cloud
  Run, with no persistent cache, that download would repeat on every cold
  start.
- **`ADR-0020` §D3: "SD 1.5 inpainting: permitted as a low-VRAM developer
  fallback only. Never the shipping backend."** `STATUS.md` session 21 calls
  `sd15_renderer` the "primary" *concept-render demo* backend. Those two
  statements are compatible only if SD 1.5 stays a demo or dev capability.
  A cloud deployment is not allowed to quietly promote it to the production
  renderer.
- `composite_renderer` is stateless and cheap (~1.5 s/render). It needs
  read access to the supplier image directory
  (`SUPPLIER_IMAGES_DIR`, `catalogue.py:51-58` uses `iterdir()`), and binds
  `0.0.0.0` (`main.py:14`).

### C5 — There is already a GCP footprint of unknown ownership

- `cloudbuild.yaml` builds `gcr.io/$PROJECT_ID/curalina:$COMMIT_SHA` and
  runs `gcloud run services update curalina-git-2 --region=us-central1`.
  Some GCP project has already hosted this app on Cloud Run.
- `firebase.json` configures Firebase Hosting with `/api/**` rewritten to a
  Function, and `server/db.ts` imports `firebase-functions`. `STATUS.md`
  item 36 records "owner decision pending on whether it is a live Firebase
  target".
- The owner says they have never used GCP. **So it is unknown who owns the
  existing project, whether it holds live data (the `*.appspot.com` upload
  bucket), and whether it is still billing.** See blocking input B1.

### C6 — Neon's region, read from the real connection strings

I parsed `.env`'s `DATABASE_URL` and `PRODUCTION_DATABASE_URL`, printing
only the host suffix and no credentials. **Both are `*.us-east-1.aws.neon.tech`
pooler endpoints, on different hosts.** So the database lives in AWS
N. Virginia, and dev and prod databases are already separate. Every app
request that touches the database crosses from GCP to that region.

## Options

### Stateless HTTP services (`app`, `composite_renderer`)

- **Cloud Run service.** This is the closest analogue to ECS Fargate:
  managed, scales to zero, HTTPS endpoint, IAM-gated invocation. It fits
  directly, and the app already detects it.
- Compute Engine VM. It would work, but it is pure operational overhead for
  services that hold no state.
- GKE Autopilot. Kubernetes concepts and a cluster fee for two stateless
  containers is not justified.

### The SQLite-bound trio (recommendation, variants + worker, rooms + worker)

- **(A) Cloud Run with SQLite on the ephemeral filesystem.** Breaks C2. The
  API and worker cannot share a file, and data is lost on redeploy.
  Rejected.
- **(B) Cloud Run with SQLite on a GCS FUSE or Filestore NFS volume.** No
  reliable locking, and Filestore's cost floor. Rejected.
- **(C) One Cloud Run service per business service, with the worker as a
  sidecar container sharing an in-memory volume, pinned min=max=1.** The
  shared file works, but it is still lost on every deploy, which breaks the
  durable-jobs invariant. Rejected.
- **(D) One Compute Engine VM running the trio under Docker Compose, on a
  separate persistent data disk.** This is the same topology, images and
  SQLite code as the tested local stack. It is a single point of failure,
  and the VM must be operated (patching, restarts).
- **(E) Migrate each AI service to Postgres first** (its own database per
  service: Neon or Cloud SQL), move assets to GCS through the existing
  `AssetStore` port, then run the APIs on Cloud Run and the workers on
  Cloud Run worker pools. This is the right end state. It means three new
  store adapters (~1,700 lines of SQLite code to port), lease and claim
  semantics rewritten for `SELECT … FOR UPDATE SKIP LOCKED`, and re-running
  all of the job-lifecycle integration tests
  (`variant_generator_workflow.md:61` six mandatory cases, and the rooms
  equivalents) against Postgres.
- **(F) GKE Autopilot**, with each API and its worker in one pod on a
  ReadWriteOnce persistent volume. Technically sound, but it adds a
  Kubernetes learning curve on top of GCP and Terraform for a first-time
  operator, plus a cluster fee.

### Workers specifically

- **Cloud Run jobs** run batch tasks to completion. Draining the queue on a
  per-minute schedule would add up to a minute of latency plus a cold start
  per job, and would rely on lease expiry for crash recovery. That is a
  poor fit for a poll loop. Rejected.
- **Cloud Run worker pools** are built for exactly this: long-running,
  non-HTTP, always-on. They are the target **once (E) lands**. Until then a
  worker cannot share its API's SQLite file, so this is not available in
  v1.
- **Compute Engine, co-located with the API**, as in (D).

### SD 1.5 renderer

- **Cloud Run on CPU.** Possible: the request timeout allows up to 60 min,
  and memory up to 32 GiB. But each render ties up a large always-billed
  instance for ~7 min, and the 4 GB weight download repeats on cold start.
  Rejected.
- **Cloud Run with an NVIDIA L4 GPU.** The right GPU shape for a stateless
  inference sidecar: it scales to zero, and SD 1.5 renders take seconds
  rather than minutes. It needs a CUDA image, a GPU quota, and a funding
  decision.
- **Compute Engine GPU VM.** Billed whenever it is running, with no scale to
  zero. Justified only for models too large for Cloud Run GPUs (the
  Qwen-class ~40 GB arm in `ADR-0020` §D2).
- **Out of v1.**

## Decision and rationale

**D1 — v1 is a hybrid: Cloud Run for everything stateless, and one
Compute Engine VM for the SQLite-bound trio, as an explicitly interim
host.**

Deploy what has been tested. Option (D) runs the same images, the same
SQLite stores and the same job-lifecycle code whose integration tests pass
today. Option (E) is the correct destination, but going to the cloud and
changing the persistence layer at the same time would leave two
simultaneous unknowns, and a failure could not be traced to either one.
(D)'s single point of failure is accepted for v1 and has a written exit
(D9).

**D2 — Workload placement.**

| Container | GCP compute | Ingress | Scaling | Billing mode | Notes |
|---|---|---|---|---|---|
| `app` | Cloud Run service `curalina-app` | public (`allUsers` invoker) | min 1, max `var` (start at 2) | **instance-based** ("CPU always allocated") | C3.3: the reconciler needs CPU between requests. Direct VPC egress, private ranges only, to reach the VM |
| `composite_renderer` | Cloud Run service `curalina-composite-renderer` | **internal**, IAM-required (no `allUsers`) | min 0, max 3, concurrency 4 | request-based | gen2 execution environment; supplier images mounted **read-only** from a private GCS bucket via a Cloud Run GCS volume |
| `recommendation_api` | VM `curalina-ai-host` (Compose) | VM internal IP only, `:8101` | 1 | VM | SQLite on the data disk |
| `variants_api` + `variants_worker` | same VM | `:8102` | 1 + 1 | VM | shared SQLite and assets on the data disk |
| `rooms_api` + `rooms_worker` | same VM | `:8103` | 1 + 1 | VM | `CURALINA_ROOM_RENDERER=composite`; calls the composite renderer over HTTPS with an ID token (D5) |
| `sd15_renderer` | **not deployed in v1**. Optional module `gpu_renderer` (Cloud Run + L4), `enabled = false` by default | internal, IAM-required | min 0, max 1, concurrency 1 | instance-based (required for GPU) | D7 |
| `postgres` (compose) | **not deployed**, since it is wired to nothing | — | — | — | — |
| Neon (app DB) | **stays at Neon**, unchanged | — | — | — | reached over the internet with `DATABASE_URL` from Secret Manager. Cloud SQL is not adopted |

**D3 — Region: `us-east4` (N. Virginia), chosen from evidence.** C6 shows
Neon in AWS `us-east-1`. `us-east4` is the GCP region in the same metro,
so every app↔DB round trip stays local. The region is a single Terraform
variable per environment. **This is overridden if B6 (data residency)
requires a Canadian region.** In that case Neon must move too, or every
query crosses a border and ~10–20 ms of WAN latency. The GPU module takes
its own `gpu_region` variable, because Cloud Run GPU is offered in a
subset of regions. A render every few seconds can tolerate a cross-region
call.

**D4 — Two GCP projects, `dev` and `prod`, each fully separate.** Each has
its own registry, secrets, Terraform state bucket, service accounts and VM.
This mirrors the two Neon endpoints that already exist (C6). Project IDs
are globally unique and are chosen by the owner at creation (B1).

**D5 — Networking and service-to-service auth.**

- One custom-mode VPC `curalina-vpc` per project, with one regional subnet
  (`10.10.0.0/24`), **Private Google Access on**.
- **The VM has no external IP.** SSH goes only through IAP TCP forwarding
  (firewall: `tcp:22` from `35.235.240.0/20` to tag `ai-host`). A Cloud
  Router + Cloud NAT gives the VM outbound internet for OS and Docker
  packages. Artifact Registry and `*.run.app` are reached through Private
  Google Access.
- The VM gets a **reserved static internal IP**, so the app's
  `CURALINA_*_URL` values are stable. A private Cloud DNS zone is not
  needed for one host.
- **App → VM:** the app uses Cloud Run Direct VPC egress into the subnet
  with `egress = PRIVATE_RANGES_ONLY`. Only `10.x` traffic enters the VPC,
  while Neon, S3 and OpenAI traffic goes straight out without paying for
  NAT. A firewall rule allows `tcp:8101-8103` to tag `ai-host` **only from
  the app's network tag** (Direct VPC egress supports network tags; the
  fallback is the subnet CIDR). The AI services have no authentication of
  their own. That is a known v1 property: the firewall is the boundary.
- **VM → composite renderer (and the GPU renderer, if enabled):** ingress
  `internal` **and** IAM-required. The VM's service account holds
  `roles/run.invoker` on that one service. The rooms worker attaches a
  Google-signed ID token, fetched from the metadata server, with the
  renderer URL as audience. That is a small code change: P0c. **If
  `internal` ingress turns out not to admit VM traffic arriving via
  Private Google Access** (see R1), fall back to ingress `all` plus IAM.
  IAM is the real control, and ingress is defence in depth.
- Every cross-service call stays plain HTTP(S) between public contracts. No
  service reads another's disk (`CLAUDE.md`). The VM co-locates three
  services, but each keeps its own subdirectory, SQLite file and container.
  Co-location is a hosting fact, not a shared database.

**D6 — Secrets: Terraform creates the secret *containers* and IAM, and
never the values.** It manages `google_secret_manager_secret` and
`…_iam_member`, never `google_secret_manager_secret_version`. The owner
adds values once with `gcloud secrets versions add`. **Secret values
therefore never appear in Terraform state or in git**, which is what makes
committing the state configuration safe. Cloud Run mounts secrets as
environment variables pinned to a version number. The pin is deliberate:
`latest` would let a secret change take effect on the next cold start
instead of on a reviewed deploy.

| Secret | Consumer | Required |
|---|---|---|
| `DATABASE_URL` | app | yes (that environment's Neon pooler URL) |
| `SESSION_SECRET` | app | yes. P0b makes the app refuse to start without it |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | app (`server/s3.ts`, product images in S3) | yes while product images stay in S3 |
| `OPENAI_API_KEY`, `STABILITY_API_KEY`, `AI_INTEGRATIONS_*` | legacy paths | **only if P4's route enumeration shows a registered route reaches them.** Many `server/services/*` files are orphaned (`ADR-0018` §C2). Do not provision keys for dead code |

The VM needs **no secrets** in v1, because the trio uses SQLite and calls
no external API. Plain configuration (`CURALINA_*`, `STORAGE_BUCKET`,
`AWS_REGION`, `NODE_ENV`, `APP_URL`) is ordinary environment variables in
Terraform.

**D7 — SD 1.5 is out of v1. The GPU path exists only as a disabled
module.**

- The cloud default is `CURALINA_ROOM_RENDERER=composite` (set on both the
  app and rooms, as compose does today).
- `modules/gpu_renderer` is specified (below) with `enabled = false`.
  Turning it on requires all of: an owner funding decision (`ADR-0020`
  §"not deciding"), a GPU quota grant (B5), a CUDA image variant of
  `sd15_renderer` with weights baked in (P6a), and acceptance that this is
  **a demo capability under `ADR-0020` §D3, not the shipping renderer**.
  The same module is the intended home for the SDXL backend (`ADR-0020`
  §D1/§D6). SDXL's 10–12 GB fits an L4's 24 GB, so turning SDXL on later is
  a new image tag, not a new architecture. Qwen-class (~40 GB) does not fit
  and stays out of scope, per `ADR-0020` §D2.
- Why not CPU SD 1.5 on Cloud Run: C4. It is slow, always billed, and
  re-downloads 4 GB on cold start.

**D8 — Terraform owns the configuration. A deploy is "push image, then
`terraform apply` with the new digest".** Images are referenced **by digest**
(`…/app@sha256:…`). Nothing runs `gcloud run deploy` out of band, so the
state never drifts from reality. The existing `cloudbuild.yaml` (C5) is
**superseded** by this ADR. It is left untouched until B1 is answered,
because deleting it before knowing which project it deploys to would remove
the only record of that project. It must not be used against a
Terraform-managed project.

**D9 — Exit from the VM is a separate, future ADR with a named trigger.**
The trigger is any one of: more than one replica needed for an AI
service; zero-downtime deploys required; or VM operations (patching,
restarts, disk) becoming a recurring cost. The exit is option (E). It
includes the Neon-vs-Cloud-SQL choice for the AI services' databases, which
is deliberately **not** made here. The two invariants it must respect:
**one database per service, never a shared one**, and workers move to Cloud
Run worker pools.

## Target architecture

```
                          Internet (users)
                                │ HTTPS
                                ▼
   ┌────────────────── GCP project curalina-<env>, region us-east4 ─────────────────┐
   │                                                                                │
   │  Cloud Run: curalina-app (public, min 1, CPU always allocated)                 │
   │     │  secrets ◄── Secret Manager (DATABASE_URL, SESSION_SECRET, AWS_*)        │
   │     │  objects ◄─► GCS bucket  <env>-curalina-uploads (private)                │
   │     │                                                                          │
   │     │ Direct VPC egress (private ranges only)          ┌──────────► Internet ──┼─► Neon (AWS us-east-1)
   │     ▼                                                  │  (non-10.x traffic)   │   S3 product images
   │  VPC curalina-vpc / subnet 10.10.0.0/24 (Private Google Access on)             │
   │     │ tcp 8101-8103, only from app's network tag                               │
   │     ▼                                                                          │
   │  Compute Engine VM curalina-ai-host (no external IP, static internal IP)       │
   │    Docker Compose:  recommendation_api :8101                                   │
   │                     variants_api :8102 + variants_worker                       │
   │                     rooms_api    :8103 + rooms_worker ──────┐                  │
   │    Data disk (persistent, snapshotted daily)                │ HTTPS + ID token │
   │      /mnt/disks/data/{recommendation,variants,rooms}/       │ via Private      │
   │                                                             │ Google Access    │
   │                                                             ▼                  │
   │  Cloud Run: curalina-composite-renderer (internal, IAM-only, scale to 0)       │
   │     └─ GCS volume (read-only) ◄── bucket <env>-curalina-supplier-images        │
   │                                                                                │
   │  [disabled] Cloud Run + L4 GPU: curalina-gpu-renderer (gpu_region)             │
   │                                                                                │
   │  Artifact Registry  us-east4-docker.pkg.dev/<project>/curalina/*  ◄── images   │
   │  Cloud NAT (VM outbound only)   Cloud Logging   Billing budget alerts          │
   └────────────────────────────────────────────────────────────────────────────────┘
```

## Terraform layout

New top-level directory **`infra/terraform/`**. It does not belong under
`ai_services/` (it spans the app too) or under `architecture/` (that holds
specs, not code).

### Root modules and state

Each environment has **two root modules with separate state**, so the
foundation (which rarely changes) is never re-planned by a routine image
deploy, and registry and secrets exist before anything references them:

```
infra/terraform/
  README.md                        # operator runbook (see "Operator flow")
  .gitignore additions (repo root): .terraform/  *.tfstate  *.tfstate.*  *.tfplan
                                    # .terraform.lock.hcl IS committed
  bootstrap/                       # root #0, LOCAL state, run once per project
    main.tf      google_project_service: storage, serviceusage, cloudresourcemanager
                 google_storage_bucket "tfstate":
                   name = "<project_id>-tfstate", location = var.region,
                   versioning on, uniform_bucket_level_access = true,
                   public_access_prevention = "enforced",
                   lifecycle: keep 20 noncurrent versions,
                   lifecycle { prevent_destroy = true }
    variables.tf project_id, region
    outputs.tf   state_bucket
  modules/
    project_services/   google_project_service for_each over:
                          run, artifactregistry, secretmanager, compute, iam,
                          iamcredentials, iap, logging, monitoring,
                          billingbudgets, cloudresourcemanager
                        disable_on_destroy = false
    network/            google_compute_network (auto_create_subnetworks=false)
                        google_compute_subnetwork (10.10.0.0/24, private_ip_google_access=true)
                        google_compute_router + google_compute_router_nat (AUTO_ONLY IPs,
                          source = subnet; serves the VM only. Cloud Run egress is private-ranges-only)
                        google_compute_firewall "allow-app-to-ai-host":
                          tcp 8101-8103, source_tags=[app_tag] (fallback: subnet CIDR),
                          target_tags=["ai-host"]
                        google_compute_firewall "allow-iap-ssh":
                          tcp 22, source 35.235.240.0/20, target_tags=["ai-host"]
                        outputs: network_id, subnet_id, subnet_cidr
    artifact_registry/  google_artifact_registry_repository "curalina" (format DOCKER, region)
                        cleanup_policies: KEEP most recent 10 versions;
                          DELETE untagged older than 14d
                        outputs: repo_url  (us-east4-docker.pkg.dev/<project>/curalina)
    service_accounts/   google_service_account: sa-app, sa-ai-host, sa-composite, sa-gpu-renderer
                        project-level IAM (google_project_iam_member, never *_policy):
                          sa-ai-host: artifactregistry.reader, logging.logWriter,
                                      monitoring.metricWriter
                          sa-app, sa-composite, sa-gpu-renderer: logging.logWriter
                        outputs: emails
    secrets/            google_secret_manager_secret for_each over var.secret_ids
                          (replication: user_managed in var.region)
                        google_secret_manager_secret_iam_member: secretAccessor -> sa-app,
                          per secret, never project-wide
                        NO google_secret_manager_secret_version (D6)
    storage/            google_storage_bucket "uploads"          (private, UBLA, PAP enforced)
                        google_storage_bucket "supplier_images"  (private, UBLA, PAP enforced)
                        google_storage_bucket_iam_member: uploads -> sa-app objectAdmin;
                          supplier_images -> sa-composite objectViewer
    budget/             google_billing_budget (billing_account, amount = var.monthly_budget,
                          thresholds 0.5/0.9/1.0 actual + 1.0 forecast,
                          scoped to this project)
                        amount has NO default; it is blocking input B2
    cloud_run_service/  generic, reused for app / composite / gpu renderer:
                        google_cloud_run_v2_service:
                          image (digest), container_port, cpu, memory,
                          min/max instances, max_instance_request_concurrency,
                          cpu_idle (false = instance-based billing), timeout,
                          ingress, execution_environment (GEN2 when volumes used),
                          service_account, env (map), secret_env (map name -> {secret, version}),
                          optional vpc_access { network_interfaces { network, subnetwork, tags },
                                                egress = PRIVATE_RANGES_ONLY },
                          optional gcs volume { bucket, read_only = true, mount_path },
                          optional gpu { type, count } + node_selector, gpu_zonal_redundancy_disabled
                        google_cloud_run_v2_service_iam_member:
                          public ? allUsers : var.invoker_members, role run.invoker
                        outputs: uri, name
    ai_host_vm/         google_compute_address        internal, static, in subnet
                        google_compute_disk "data"    pd-balanced, var.data_disk_gb,
                                                      lifecycle { prevent_destroy = true }
                        google_compute_resource_policy snapshot_schedule_policy:
                                                      daily, retain var.snapshot_retention_days
                        google_compute_disk_resource_policy_attachment
                        google_compute_instance:
                          machine_type = var.machine_type, Debian 12 boot image,
                          no access_config (no external IP), tags ["ai-host"],
                          shielded_instance_config all on,
                          service_account sa-ai-host scopes ["cloud-platform"],
                          attached_disk = data disk (device_name "curalina-data"),
                          metadata_startup_script = templatefile("startup.sh.tftpl", …)
                          metadata enable-oslogin = TRUE
                        templates/startup.sh.tftpl     (idempotent; see below)
                        templates/compose.yaml.tftpl   (see below)
                        outputs: internal_ip, instance_name
    gpu_renderer/       wraps cloud_run_service with count = var.enabled ? 1 : 0;
                        region = var.gpu_region; gpu nvidia-l4 x1; cpu 4; memory 16Gi;
                        cpu_idle false; min 0; max 1; concurrency 1; timeout 600s;
                        invoker = sa-ai-host only
  envs/
    dev/
      foundation/  backend.tf  (gcs, bucket=<dev tfstate>, prefix="curalina/dev/foundation")
                   versions.tf (required_version and hashicorp/google pinned to the
                                current major at packet time, ~> X.0)
                   main.tf     project_services, network, artifact_registry,
                               service_accounts, secrets, storage, budget
                   outputs.tf  everything workloads needs
                   terraform.tfvars   project_id, region, billing_account, monthly_budget,
                                      secret_ids. Committed; contains NO secret values
      workloads/   backend.tf  (prefix="curalina/dev/workloads")
                   main.tf     data "terraform_remote_state" "foundation" (gcs)
                               module "composite"  (cloud_run_service)
                               module "ai_host"    (ai_host_vm; gets composite.uri)
                               module "app"        (cloud_run_service; gets ai_host.internal_ip)
                               module "gpu"        (gpu_renderer, enabled=false)
                   images.auto.tfvars.json   generated by the push script, committed:
                                             the deploy record { app, recommendation, variants,
                                             rooms, composite, sd15 } -> full digest refs
                   terraform.tfvars          sizes, scaling, plain env values
    prod/          identical shape; differs only in tfvars
```

Ordering inside `workloads`: composite comes first, because the VM's
compose file needs its URL. The VM is next, because the app needs its IP.
The app is last. Terraform derives this order from the references, so no
`depends_on` is needed.

### `ai_host_vm` templates, specified exactly enough to implement

`startup.sh.tftpl` (runs as root on every boot, and must be idempotent):

1. Format the data disk **only if it has no filesystem**
   (`/dev/disk/by-id/google-curalina-data`, check with `blkid` first). Mount
   it at `/mnt/disks/data`, and add it to `/etc/fstab` by UUID with
   `nofail`. **Never run `mkfs` unconditionally.** That one line is the
   difference between a reproducible rebuild and wiping production.
2. `mkdir -p /mnt/disks/data/{recommendation,variants,rooms}`.
3. Install Docker Engine and the compose plugin from Docker's apt
   repository if they are absent. Configure
   `gcloud auth configure-docker us-east4-docker.pkg.dev` (or
   `docker-credential-gcr`), so pulls authenticate as `sa-ai-host`.
4. Write `/opt/curalina/compose.yaml` from the rendered template, then run
   `docker compose -f … pull && docker compose -f … up -d --remove-orphans`.

`compose.yaml.tftpl` (rendered by Terraform with digests, IP and URLs):

- Five services: `recommendation_api`, `variants_api`, `variants_worker`,
  `rooms_api`, `rooms_worker`. Images are **by digest** from the registry.
- **`command:` holds arguments only (`["api"]` / `["worker"]`)**. The image
  `ENTRYPOINT` is `python3 -m <pkg>.bootstrap`. `STATUS.md` session 21 bug 1
  is what happens otherwise: the worker silently runs as an API and jobs
  stay `queued` forever.
- **`restart: unless-stopped` on all five, including the workers.** Today's
  compose has `restart: "no"` on both workers, and its comment says they
  "run once and exit". The code loops forever (`bootstrap.py`), so a
  crashed worker would stay dead on a VM with nobody watching. This
  correction applies to the cloud template. Whether to also change the local
  compose is a separate, optional packet.
- Ports bound to the internal IP only: `"${internal_ip}:8101:8101"`, and so
  on.
- Volumes are bind mounts: `/mnt/disks/data/<service>:/data`. Each API and
  its worker share their own service's directory and nothing else.
- Environment is the same as today's per-service compose, except
  `CURALINA_ROOM_RENDERER=composite`,
  `CURALINA_RENDERER_COMPOSITE_URL=${composite_uri}`,
  `CURALINA_RENDERER_AUTH=gcp_id_token` (after P0c), and
  `CURALINA_RENDERER_SD15_URL=${gpu_uri or ""}`.
- `logging: { driver: gcplogs }`, so container logs land in Cloud Logging
  under the VM.

**A deploy to the VM replaces the VM.** Changing `metadata_startup_script`
forces instance replacement in the Google provider (R1). The data disk is a
separate resource with `prevent_destroy`, so it is detached and reattached.
SQLite files and assets survive, and the deploy costs ~1–2 min of trio
downtime. This is chosen over an in-place SSH re-run because it needs no
manual step and is therefore reproducible. Consequence: a render job leased
at the moment of replacement is recovered by lease expiry, up to
`CURALINA_JOB_TIMEOUT_SECONDS` = 1800 s later. That path is already
covered by the existing worker-dies-after-claim tests.

### Sizing defaults (variables, with these as starting values)

| Workload | dev | prod |
|---|---|---|
| `curalina-app` | 1 vCPU / 1 GiB, min 1, max 2 | 1 vCPU / 1 GiB, min 1, max 2 (raise only after the reconciler check in P4) |
| `curalina-composite-renderer` | 1 vCPU / 1 GiB, min 0, max 2 | 1 vCPU / 2 GiB, min 0, max 3 |
| `curalina-ai-host` | `e2-medium` (2 shared vCPU / 4 GB), 30 GB data disk | `e2-standard-2` (2 vCPU / 8 GB), 50 GB data disk |
| snapshots | 7 days | 14 days |

These are engineering starting points, not Design Manual numbers, and are
sized from five light Python processes plus Node. They are variables
precisely so they can be changed without an ADR.

### Operator flow (the `infra/terraform/README.md` runbook must cover exactly this)

First time, per environment:

1. The owner creates the GCP project and links billing (console, B1).
   Then on the laptop: install `gcloud` and Terraform, run
   `gcloud auth login` and `gcloud auth application-default login`.
2. `terraform -chdir=infra/terraform/bootstrap init && apply -var project_id=… -var region=us-east4`.
   Record the bucket name in both `backend.tf` files.
3. `terraform -chdir=infra/terraform/envs/<env>/foundation init && apply`.
4. Add the secret values: `gcloud secrets versions add DATABASE_URL --data-file=-`
   (and the same for each secret). Note the version numbers in `terraform.tfvars`.
5. Upload the supplier images: `gcloud storage cp -r "<local Supplier Images>" gs://<env>-curalina-supplier-images/`.
   For prod, only after B3.
6. Run the push script (P2): build every image with `--platform linux/amd64`,
   tag with the git SHA, push, and write the digests to
   `images.auto.tfvars.json`.
7. `terraform -chdir=infra/terraform/envs/<env>/workloads init && apply`.

Every deploy afterwards: step 6, then step 7. **Promotion to prod copies
the exact dev digests** into the prod registry
(`gcloud artifacts docker images copy` or `crane cp`, both by digest)
rather than rebuilding, so prod runs the bytes that were tested in dev.

Tear down dev when idle: `terraform destroy` on `workloads` only. The
foundation, data-disk snapshots and secrets survive. Recreating it is
step 7. **This is the reproducibility payoff the owner asked for, and P3
must prove it** (see the phase table).

## Phased build plan — one packet at a time (`AGENTS.md` §9)

`infra/**` has **no owning role** in the `AGENTS.md` roster today. I
recommend assigning it to `python-services-engineer`, who already owns the
Dockerfiles and compose files, with `code-reviewer` reviewing. Because
`CLAUDE.md` requires `AGENTS.md` to be updated first when a role's
responsibilities change, **that roster edit is the owner's call and must
land before P1 is dispatched.** I am not making it here.

| Phase | Work | Owner | Blocks | Done-evidence |
|---|---|---|---|---|
| **P0a** | Quiz upload → GCS. `/upload` and `/api/upload` write to `STORAGE_BUCKET` through the existing `ObjectStorageService` and return a URL that an authenticated route actually serves. `multer` uses memory storage with a size cap | `typescript-app-engineer` | prod (P5) | an upload made through the quiz can be fetched back, and a test proves nothing is written under `uploads/` |
| **P0b** | `SESSION_SECRET` fails closed when `NODE_ENV=production`: startup error, no default | `typescript-app-engineer` | P3 | a unit test on `getSession()` |
| **P0c** | Rooms renderer HTTP client: `CURALINA_RENDERER_AUTH = none \| gcp_id_token` (default `none`). When it is `gcp_id_token`, attach `Authorization: Bearer <ID token>` with audience = renderer base URL, from a `TokenProvider` port. In tests the provider is a fake, so no network and no GCP are needed in fast tests | `python-services-engineer` | P3 | unit tests for both modes. With the setting at `none`, local compose behaviour is unchanged |
| **P1** | `bootstrap/` plus `envs/dev/foundation` and its modules | infra owner (above) | — | `terraform apply` succeeds, then a second `terraform plan` shows **no changes**. Resource list attached |
| **P2** | Push script (`infra/scripts/push_images.sh`) plus `images.auto.tfvars.json` generation | infra owner | P3 | all six images in the dev registry, by digest |
| **P3** | `envs/dev/workloads`: composite, VM and app | infra owner | P4 | (1) quiz → concept render (composite) works end to end at the dev `run.app` URL. (2) A second `plan` shows no changes. (3) **Destroy-and-recreate test:** `terraform destroy` workloads, then `apply`. A render created before the destroy is still fetchable afterwards. This proves that the data disk, not the VM, holds state. (4) `curl` to the composite URL from outside GCP returns 403 or 404. (5) From the VM, a request with no ID token is rejected and one with a token succeeds |
| **P4** | App verification on Cloud Run: enumerate the routes actually registered and the legacy keys they reach (finalizes D6's optional secrets). Verify that the render reconciler converges with **two** app instances (no double-terminal writes, no conflicting states). If it does not, pin `max_instances = 1` and record that | `typescript-app-engineer` | P5 | written finding plus a two-instance test or log evidence |
| **P5** | `envs/prod/*`: same shape, prod tfvars, promotion by digest | infra owner | — | P3 evidence repeated on prod, with B1–B3 answered |
| **P6a** *(optional)* | CUDA image variant of `sd15_renderer` with weights baked in at build time | `python-services-engineer` | P6b | the image runs on an L4 and renders in seconds |
| **P6b** *(optional)* | `gpu_renderer.enabled = true` in dev | infra owner | — | rooms with `CURALINA_ROOM_RENDERER=sd15` completes a render through the GPU service. Demo only (`ADR-0020` §D3) |
| **P7** *(future)* | Exit from the VM: separate ADR (D9) | `tech-lead` | — | — |

## Blocking inputs (owner and client)

These are not `OQ-xxx` items. None is a Design Manual gap, so, following
`ADR-0020`'s precedent, they go into `STATUS.md` as concrete asks. None of
them has a default that I am willing to invent.

| ID | Question | Blocks | Why it cannot be defaulted |
|---|---|---|---|
| **B1** | Which GCP project(s)? Create new `curalina-dev` / `curalina-prod`, or adopt the project behind `cloudbuild.yaml`'s `curalina-git-2` (C5)? Who owns that project, does it hold live data (the `*.appspot.com` upload bucket, a live Firebase site), and is it still billing? Which billing account? | P1 | Applying Terraform into a project with hand-made resources causes collisions. Ignoring it may leave an orphaned, billing deployment or user data behind |
| **B2** | Monthly budget per environment, for the budget alerts | P1 (`budget` module has no default) | Spending limits are an owner decision |
| **B3** | Supplier-image usage rights for a **publicly reachable** prod. `ADR-0008` left the rights unresolved, and the client owns the answer | prod upload of supplier images (P5 step 5) | A private dev environment is equivalent to the laptop. A public site rendering supplier marketing imagery is commercial use |
| **B4** | Custom domain? v1 serves at the `*.run.app` URL | nothing in v1 | A domain needs either Cloud Run domain mapping or a global HTTPS load balancer (with its own monthly cost). The choice depends on the domain |
| **B5** | GPU: fund it? If so, request L4 quota in `gpu_region` | P6b only | Commercial decision (`ADR-0020`), plus a quota grant that is outside our control |
| **B6** | Data residency: is a US region acceptable for customer data (sessions, quiz answers and, after P0a, room photos)? | P5, and possibly overrides D3 | The client appears to be Canadian (CAD default). If Canadian residency is required, Neon must move as well, and D3 changes. This is a legal or commercial question, not a technical one |
| **B7** | Who holds and enters prod secret values (step 4)? | P5 | Credential custody |

## Rough monthly cost, per environment

**These are order-of-magnitude list-price estimates from memory, not
quotes. Re-price them in the GCP Pricing Calculator for `us-east4` before
setting B2.** Neon and AWS S3 are billed separately and are unchanged by
this work.

| Item | Estimate |
|---|---|
| Cloud Run `app`, 1 vCPU / 1 GiB always allocated, min 1 | ~$45–65 |
| Compute Engine `e2-standard-2` (prod) / `e2-medium` (dev) | ~$50–60 / ~$25–30 |
| Persistent disk plus snapshots | ~$5–10 |
| Cloud NAT (one VM) plus small egress | ~$2–5 |
| Composite renderer (scale to zero), Artifact Registry, Secret Manager, GCS, Logging within free tiers | ~$1–10 |
| **Baseline** | **~$80–100 dev, ~$110–150 prod** |
| GPU renderer, if enabled | about $1/hour **while an instance is warm** (L4 plus 4 vCPU / 16 GiB), $0 when scaled to zero |

Destroying dev's `workloads` when idle reduces dev to snapshots plus a few
dollars.

## Consequences and reversal

**Costs accepted.**

- **A single VM is a single point of failure** for recommendation,
  variants and rooms. A VM outage stops all three, and the app fails closed
  with `ai_services_unreachable` under `ADR-0016`, which is the designed
  behaviour. Every deploy of the trio costs ~1–2 min of downtime.
- **A VM is operational surface the owner did not ask for**: OS patching
  (unattended-upgrades in the startup script), disk growth, and Docker
  daemon health. This is the price of not migrating persistence in the same
  step as the cloud move.
- **The app's minimum instance is always billed** because of the
  reconciler (C3.3). Moving the reconciler to a Cloud Scheduler → internal
  endpoint call would allow scale to zero. That is a deliberate future
  option, not v1 scope.
- **The AI services have no authentication of their own**, and the firewall
  is their only boundary (D5). Anything later placed in that subnet with the
  app's network tag can call them.
- **Two Terraform roots per environment** is more structure than a
  beginner expects. It is justified because the alternative, `-target`
  applies to get the registry created before images exist, is the habit
  that most often breaks Terraform reproducibility.
- **Three small code packets (P0a–P0c) come before go-live.** P0a fixes a
  defect that exists today regardless of the cloud.

**Reversal.**

- **D1 (VM for the trio)** reverses through D9/option (E). Because the
  boundary is HTTP and each service owns its own data, moving one service
  off the VM changes one URL in the app's environment and nothing else.
  The services can move one at a time, and recommendation (stateless apart
  from bundles) should go first.
- **D3 (region)** reverses by changing one variable and re-applying into a
  fresh project. Neon's region has to move with it, or the latency
  argument flips.
- **D5 (ID-token auth)** reverses by setting `CURALINA_RENDERER_AUTH=none`
  and granting `allUsers` invoker on an internal-only service. That is
  weaker, and should only be done if P0c proves unworkable.
- **D7 (no SD 1.5 in v1)** reverses by enabling the `gpu_renderer` module
  once B5 and P6a are done. No architecture change is needed.
- **D8 (Terraform owns deploys)** reverses to `gcloud run deploy` from CI
  only by adding `lifecycle { ignore_changes = [template[0].containers[0].image] }`.
  That gives up the "state equals reality" property and is not
  recommended.

**What would prove this decision wrong.**

- **If the P3 destroy-and-recreate test loses data**, the data-disk design
  is wrong. The fix belongs in the template, not in procedure.
- **If the VM's measured operational burden in the first month is
  material** (manual SSH interventions, disk incidents), D9's trigger is
  met earlier than planned, and option (E) should be scheduled
  immediately rather than left as "future".
- **If the reconciler does not converge with two app instances (P4)**, the
  app is pinned to one instance. That is a scaling ceiling, and D2's
  `max = 2` default was wrong.
- **If app↔Neon latency from `us-east4` is not materially better than
  from, for example, `northamerica-northeast2`**, measured at P3 with a
  timed query loop, then D3's evidence was weaker than assumed, and
  residency (B6) can decide the region at no cost.
- **If `internal` ingress rejects VM traffic arriving through Private
  Google Access**, D5's ingress setting falls back to `all` + IAM, as
  already stated. This does not invalidate the design.

**What I am explicitly not deciding.**

- **Whether SD 1.5, or any model output, is acceptable.** That belongs to
  `ai-ml-lead` through the gates. D7 decides only where the GPU would run.
- **Neon vs Cloud SQL for the AI services' future databases.** That is
  deferred to the D9 ADR.
- **The `server/functions/` / Firebase question** (`STATUS.md` item 36).
  This deployment targets Cloud Run and does not use Firebase. Whether the
  Firebase target is live is part of B1.
- **CI/CD automation** (Cloud Build triggers, GitHub Actions with Workload
  Identity Federation). v1 deploys from the operator's laptop through
  Terraform. CI is a later packet layered on D8, not a change to it.
- **The `AGENTS.md` roster change for `infra/**`.** I make the
  recommendation above; the change is the owner's.

## R1 — Cloud-product facts to re-verify at packet time

The following are stated from current knowledge of GCP, not from this
repository. GCP changes them. **The packet that first depends on each one
must check current Google documentation before relying on this ADR's
sentence**, as `ADR-0020` requires for licences.

- Cloud Run GPU: L4 availability in `gpu_region`, default quota or quota
  request process, minimum 4 vCPU / 16 GiB, the instance-based billing
  requirement, and zonal-redundancy pricing (P6b).
- Whether Cloud Run `internal` ingress admits Compute Engine traffic that
  reaches `*.run.app` through Private Google Access in the same project
  (P3, item 5).
- Direct VPC egress support for network tags, and its subnet IP-consumption
  ratio (P3).
- Whether changing `metadata_startup_script` on `google_compute_instance`
  still forces replacement in the pinned provider version (P3). If it no
  longer does, add `replace_triggered_by` on the rendered template's hash.
- Cloud Run worker pools: GA status and Terraform resource name (D9 only).
- The state of `gcr.io` / Container Registry, which `cloudbuild.yaml` still
  targets (B1 cleanup).
- Every price in the cost table.

## Verification

Read this session, from source:

- `docker-compose.yml`, `ai_services/docker-compose.common.yml`,
  `ai_services/{recommendation,variant_generator,room_generator,renderers}/docker-compose.yml`:
  the topology, volumes, worker `restart: "no"`, renderer URLs and timeouts,
  and the unused Postgres container.
- `ai_services/room_generator/Dockerfile` (`ENTRYPOINT` with `CMD`
  arguments), `ai_services/renderers/sd15/Dockerfile` (CPU torch wheel),
  `composite/Dockerfile`, and the root `Dockerfile`.
- `curalina_rooms/bootstrap.py:19-25` and `curalina_variants/bootstrap.py:20-25`:
  infinite poll loops. `curalina_rooms/settings.py`: lease must outlast
  render timeout. `adapters/filesystem_asset_store.py`: assets on local
  disk.
- `api/sqlite_store.py` (rooms 744 lines, variants 642) and
  `recommendation/api/repository.py` (287 lines, `save_bundle`): raw
  `sqlite3`, with runtime writes in all three.
- `sd15/src/curalina_sd15/pipeline.py:111-131` (CUDA auto-select),
  `composite/.../main.py:14`, `catalogue.py:51-58`.
- `server/index.ts:128-148`, `server/localAuth.ts:25-66`,
  `server/objectStorage.ts:1-10`, `server/db.ts:1-35`,
  `server/routes.ts:25, 595-626`, `client/src/pages/Quiz.tsx:164-186`,
  `server/services/ai-adapter/render-reconciler.ts:1-60`.
- `cloudbuild.yaml`, `firebase.json`, `.env.example`.
- `.env`: **only the host suffix** of the two Neon URLs was printed (C6). No
  credential was read into this record.
- `ADR-0020` (§D3, §D6, §"not deciding"), `ADR-0016`, `ADR-0018` §C2,
  `ADR-0008`, and `STATUS.md` session 21 plus item 36.

No `.tf` file, script or service source was written or changed by this
ruling. The consequential work is carried by `agent_instructions/STATUS.md`
dispatch item 37.
