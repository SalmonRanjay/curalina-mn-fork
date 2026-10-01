# Architecture decision record

ID: ADR-0024
Status: **accepted.** Artifact-store layout, promotion and activation
mechanism, and the scope finding for each service. Building M1 is blocked
only on `ADR-0023` P1 (the dev project must exist). Live activation in the
cloud also requires the GPU renderer to be enabled (`ADR-0022` D7, B5).
Prod activation of any LoRA requires an `ai-ml-lead` sign-off and B3.
Owner and reviewer: `tech-lead` (decision). Raised by the project owner on
2026-09-30: "We'll need a model build pipeline for the Recommender and the
Room Generator … for testing notebooks we'll just copy those into Colab
notebook sessions, but ultimately there'll need to be a pipeline for
building the model and deploying it into the app." Review:
`code-reviewer`. Model-quality questions are `ai-ml-lead`'s.
Date: 2026-09-30

Companion to `ADR-0023`, which deploys **code**. This ADR moves **trained
artifacts** from the place they are trained into a running service. The two
are kept separate on purpose. They converge only at the last step (D4),
where a pinned artifact is baked into an image built by the code pipeline.

## Context

### C1 — What is actually trained, per service (verified, not assumed)

| Service | Trained artifact a running service consumes today? | Evidence |
|---|---|---|
| **Room generator** (via the `sd15_renderer` sidecar) | **Yes, one: an SD 1.5 LoRA** (`pytorch_lora_weights.safetensors`, a few MB), trained in Colab and optional at runtime | `renderers/sd15/src/curalina_sd15/pipeline.py:17-32, 122-127`; notebook `room_generator/notebooks/learning/sd15_lora_products_in_rooms_colab.ipynb` |
| **Recommendation** | **No.** The running service ranks with `FakeFeatureEncoder`, a category-match indicator, over **four hardcoded synthetic fixture products** | `recommendation/api/application_services.py:103-130` (`ranking=RankingService(encoder=FakeFeatureEncoder())` at `:126`). The adapter's own docstring: "FAKE ADAPTER, not rule-only or embedding ranking" |
| **Variants** | **No.** Colour transfer is deterministic LAB arithmetic. The diffusion refinement adapter is a fake. Masks are human-authored (`ADR-0017`) | `variant_generator/src/curalina_variants/adapters/` |

So the owner's premise holds for one of the two services they named, not
both.

### C2 — The LoRA path today, and its gaps

**Training.** The Colab notebook fine-tunes a rank-8 LoRA on the UNet
attention projections (`to_k/q/v/out.0`) over supplier product cutouts
pasted into procedural rooms, captioned from folder names, with trigger
word `crlnstyle`. It writes `final/pytorch_lora_weights.safetensors` and a
`.zip` to `/content/drive/MyDrive/curalina_lora_output/`. The owner then
downloads it, unzips it into `ai_services/renderers/sd15/lora/` (gitignored
by `sd15/lora/.gitignore`), and sets `SD15_LORA_PATH=/lora`. That is
hand-carrying through local disk.

**Gaps found reading the code:**

1. **The base model is not pinned to a revision on either side.** The
   notebook uses `BASE_MODEL_ID = "stable-diffusion-v1-5/stable-diffusion-v1-5"`,
   and the service calls `StableDiffusionPipeline.from_pretrained(settings.model_id, …)`
   with no `revision=` (`pipeline.py:113-121`). If the upstream repository
   changes, a LoRA can silently be applied to a base model other than the
   one it was trained on.
2. **There is no artifact identity at runtime.** `model_label()` returns
   `model_id + "+lora"` (`pipeline.py:37`). Rooms records that string as
   `model_id` from the `X-Model-Id` header
   (`curalina_rooms/adapters/http_render_backend.py:100`, set at `sd15/app.py:83`).
   **Every render made with any LoRA is recorded identically**, so a
   render cannot be traced to the weights that produced it.
3. **The training environment is unpinned.** The owner's own copy
   (`room_generator/notebooks/sd15_lora_products_in_rooms_colab.ipynb`,
   cell 11) runs `pip install --upgrade torchao peft diffusers transformers accelerate`.
   That is fine for interactive work, but it means the versions must be
   **recorded**, because they cannot be assumed.
4. **Loading is lazy.** `/healthz` returns 200 immediately with
   `"ready": false` until the first render loads the model
   (`sd15/app.py:44-51`). A LoRA that fails to load is discovered by the
   first customer render, not by the deploy.
5. `load_lora_weights` plus `fuse_lora` failing closed on a missing path
   (`pipeline.py:124-125`) is already correct. Keep it.

### C3 — Constraints that bound this design

- **`ADR-0020` §D3: SD 1.5 is "a low-VRAM developer fallback only. Never the
  shipping backend."** `ADR-0022` D7 (kept by `ADR-0023`) does not deploy
  SD 1.5 in v1. **So the cloud last mile of this pipeline runs only once
  the GPU renderer is enabled (B5), and then only as a demo capability.**
  The pipeline is still worth building now. It ends hand-carrying for local
  use (D5), and it is renderer-agnostic, so an SDXL LoRA (`ADR-0020` §D1)
  uses it unchanged under a new family name.
- **`agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`:** "A LoRA fine-tune on
  Curalina's own accepted renders is a legitimate **post-MVP** item." The
  current LoRA trains on **supplier photos pasted into synthetic rooms**,
  not on accepted renders. That makes it a different dataset with a
  different rights question.
- **`ADR-0008` left supplier-image rights unresolved.** A model trained on
  those images is a derivative of them. `ADR-0023` B3 is extended to cover
  **training** and **public display of outputs**.
- **The owner's standing constraint:** minimal custom infrastructure, a
  small team, and no MLOps platform.

### C4 — The recommendation side in detail

- **Shipping today:** `FakeFeatureEncoder` (C1). The rule-only baseline
  and the MiniLM embedding arm are both blocked on R02 (`ADR-0006`).
- **MiniLM** (`adapters/minilm_encoder.py`) is a **pretrained, frozen**
  sentence-transformer pinned to a commit SHA (`MODEL_REVISION`). It is an
  `eval` extra, never a runtime dependency (`pyproject.toml`), and
  explicitly "exists to *measure*, not to be adopted". **Nothing in it is
  trained.** If it were ever accepted, deploying it means installing a
  pinned dependency and pinned weights at image build. That is a code
  pipeline concern (`ADR-0023`), not a model pipeline. Its `.npy` embedding
  cache (`00_AUDIT` line 94) would also need to move off the local disk,
  because Cloud Run disks are ephemeral: compute it at image build, or store
  it in recommendation's own database.
- **Session 22's PyTorch two-tower model**
  (`recommendation/notebooks/learning/pytorch_recommendation_matching_demo.ipynb`,
  uncommitted; outputs `model.pt`, `feature_space.json` and
  `quiz_schema.json` under the gitignored `recommender_runs/`) is the one
  real trained artifact on the recommendation side. It is **not wired into
  the service** and has no `ai-ml-lead` decision. Its own write-up in
  `STATUS.md` session 22 says: "**Labels are rule-derived, not
  behavioural.** … `is_match()` in the notebook is the label". With tags
  visible, "the model mostly reproduces the rule". The only learned
  behaviour with a claim is the tags-hidden row: inferring
  room/style/atmosphere from category, price, size and supplier.
- **What recommendation does need to get into production is data, not a
  model:** the real supplier catalogue. That is `STATUS.md` dispatch item 24
  ("Wire the real catalogue into recommendation's runtime", **Ready**).

## Options

**Where trained artifacts are stored**

| Option | Verdict |
|---|---|
| **A private GCS bucket with an immutable `releases/` prefix** | **Chosen** (D1). The simplest durable, IAM-controlled store. Colab can write to it directly. It costs cents |
| Google Drive as the system of record | Rejected. There is no immutability and no service-account-friendly access, and it is a personal account's storage. Drive stays the notebook's working directory |
| Vertex AI Model Registry / Vertex AI Pipelines | Rejected. A platform built for teams that retrain on a schedule. We train by hand, rarely, one small file |
| Artifact Registry generic repository | Viable, but rejected. Clumsier to write from Colab, with no gain over GCS for one file |
| Hugging Face private repository | Rejected. A second vendor, with credentials outside GCP, holding a derivative of rights-unresolved images |
| Git LFS in this repository | Rejected. Puts a rights-unresolved derivative into every clone |

**How a running service gets the artifact**

| Option | Verdict |
|---|---|
| **Bake it into the GPU image at build time, from a pin file in git** | **Chosen** (D4). The image digest fully determines the weights. The existing `SD15_LORA_PATH` code path is unchanged. No runtime GCS dependency, no extra cold-start download. Rollback is a Cloud Run revision |
| Download from GCS at startup, by a URI env var | Rejected as primary. The env var would be owned by CI or by Terraform. `ADR-0023` D7 gives Terraform the env vars and CI the image, so this needs a second deploy path or drift. It also adds a GCS client and auth to the sidecar's startup |
| Mount the bucket as a GCS volume | Rejected. Same ownership problem, plus FUSE reads on the cold-start path |
| A mutable `active.json` pointer read at startup | Rejected. Instances started before and after a pointer change run different weights within one revision. Not reproducible |

**How the artifact leaves Colab**

| Option | Verdict |
|---|---|
| **Upload straight from the Colab session to the bucket's `candidates/` prefix** | **Chosen** (D2). One cell, the user's own Google identity, and no laptop in the path |
| Download to a laptop, then upload | Rejected. This is today's hand-carry |
| Storage Transfer from Drive | Rejected. A managed service configured for something that is one `cp` |

## Decision and rationale

### D1 — One private artifact bucket, in the dev project only

`gs://<dev-project-id>-curalina-model-artifacts`, in the `storage` module of
`envs/dev/foundation` (`ADR-0023` Terraform delta). It is created in dev
only because prod never reads it: prod runs the dev-built image that
already has the weights baked in (`ADR-0023` D8).

```
<family>/candidates/<run_id>/        # written from Colab; scratch; any content
    final/pytorch_lora_weights.safetensors
    training_config.json
    samples/…                        # the notebook's comparison images
<family>/releases/<release_id>/      # written ONLY by promote; never overwritten
    pytorch_lora_weights.safetensors
    manifest.json
    evidence/…                       # training_config.json, samples, copied from the candidate
```

- `family` is `sd15-lora` today. A later `sdxl-lora` (or any accepted
  family) reuses the same layout with no design change.
- **Bucket settings:** uniform bucket-level access, public access prevention
  enforced, **object versioning on** (so a deleted release can be
  recovered), and a lifecycle rule deleting `*/candidates/**` objects after
  `var.candidate_retention_days`. That is an engineering variable, not a
  Design Manual number.
- **IAM:** the owner's Google identity (or a group, B7) gets
  `roles/storage.objectCreator`. That allows creating objects, not
  overwriting or deleting them, so Colab can add candidates but cannot
  clobber a release. Whoever runs promote gets `roles/storage.objectAdmin`,
  scoped to the bucket. Dev `sa-deployer` gets `roles/storage.objectViewer`
  so the GPU image build can read releases. **No runtime service account
  has any access.**

### D2 — Colab writes a `training_config.json` and uploads the run to `candidates/`

Changes to `notebooks/learning/sd15_lora_products_in_rooms_colab.ipynb`
(packet M2). They are IO and recording only, with no business logic in
cells (`agentic_flow/16_notebook_standard.md`):

1. The CONFIG cell gains `BASE_MODEL_REVISION = "<40-hex commit SHA>"` and
   `ARTIFACT_BUCKET = "gs://<dev-project-id>-curalina-model-artifacts"`. All
   `from_pretrained(BASE_MODEL_ID, …)` calls pass `revision=BASE_MODEL_REVISION`.
   **The packet chooses the SHA by reading the model repository's current
   commit, and records which commit it chose and why.** No SHA is invented
   here.
2. After training, the notebook writes `training_config.json` beside
   `final/`. It contains every CONFIG value, `BASE_MODEL_ID` and
   `BASE_MODEL_REVISION`, the installed versions of `torch`, `diffusers`,
   `peft`, `transformers` and `accelerate` (read from
   `importlib.metadata`), the GPU name, the count of training images, and a
   dataset fingerprint: SHA-256 over the sorted list of
   `(relative path, byte size)` of the images actually used.
3. A final cell, **"Publish this run as a candidate"**:
   `from google.colab import auth; auth.authenticate_user()`, then
   `!gcloud storage cp -r {OUTPUT_DIR}/final {OUTPUT_DIR}/training_config.json {OUTPUT_DIR}/samples {ARTIFACT_BUCKET}/sd15-lora/candidates/{RUN_ID}/`,
   where `RUN_ID` is the UTC timestamp the notebook already uses for its
   output folder. `gcloud` is preinstalled in Colab (R1). It prints the
   candidate URI to paste into the promote command.

Drive remains the notebook's working output, and nothing reads it
afterwards. **This answers "uploaded to the same Drive, then what?":
nothing, because the candidate goes straight from the Colab session to the
bucket.** The owner's own copy of the notebook (out of scope for edits per
`STATUS.md` session 21) can adopt the same three cells by copy and paste.

### D3 — Promotion verifies and freezes a candidate. It does not activate it.

`infra/scripts/promote_model_artifact.py <candidate-uri>` (packet M3). It
needs Python 3.11+, `gcloud`, and the `safetensors` header format, which is
parsed with the standard library (an 8-byte length plus a JSON header), so
there are no ML dependencies and no model download. It runs from Cloud
Shell or a laptop. It **fails closed** on any of these:

- `final/pytorch_lora_weights.safetensors` or `training_config.json` missing;
- a header that does not parse, an empty tensor list, or any tensor key that
  is not a UNet LoRA key (`unet.` prefix and a `lora` component), because
  only UNet layers are trained;
- `training_config.json` missing `BASE_MODEL_ID`, or missing a
  `BASE_MODEL_REVISION` that is a 40-hex SHA. **No revision means no
  release. Promote never guesses which base a LoRA was trained against.**

On success it computes the weights' SHA-256 and sets
`release_id = <UTC yyyymmddThhmmssZ>-<first 12 hex of sha256>`. It copies
the weights and evidence to `releases/<release_id>/` with **no-clobber**
semantics (it refuses if any object exists there), then writes
`manifest.json` last. **A release exists if and only if its manifest
exists.**

`manifest.json`, schema version 1, with every field required unless shown
nullable:

```json
{
  "schema_version": 1,
  "family": "sd15-lora",
  "release_id": "20261001T143000Z-3f9c2a1b7d4e",
  "weights": { "file": "pytorch_lora_weights.safetensors", "sha256": "<64 hex>", "bytes": 0 },
  "base_model": { "id": "stable-diffusion-v1-5/stable-diffusion-v1-5", "revision": "<40 hex>" },
  "trigger": "crlnstyle",
  "training": { "rank": 8, "steps": 1200, "batch_size": 2, "learning_rate": 0.0001,
                "resolution": 512, "seed": 42, "p_room_background": 0.8, "limit_images": null },
  "dataset": { "image_count": 0, "fingerprint_sha256": "<64 hex>" },
  "environment": { "torch": "…", "diffusers": "…", "peft": "…", "transformers": "…",
                   "accelerate": "…", "gpu": "…" },
  "source_candidate": "gs://…/sd15-lora/candidates/<run_id>/",
  "promoted_by": "<gcloud account>",
  "promoted_at": "<ISO-8601 UTC>"
}
```

The values shown under `training` are the current notebook defaults,
included only as an example. Promote copies whatever the candidate
recorded. **Promotion is a provenance step, not a quality judgment.** A
release is "frozen and traceable", never "good".

### D4 — Activation is a reviewed one-line change to a pin file, baked into the GPU image by CI

**The pin file** is `infra/models/sd15_lora.json`, committed, initially:

```json
{ "family": "sd15-lora", "release_id": null, "sha256": null, "scale": 1.0, "signoff": null }
```

- **Activating a release** is a PR that sets `release_id`, `sha256` (copied
  from the manifest) and optionally `scale`. Git history is the activation
  log, and code review is the change control.
- **`signoff`** is the reference to `ai-ml-lead`'s recorded acceptance of
  that release, for example an ADR or `STATUS.md` item ID. It may be `null`
  in dev. **Prod promotion refuses a GPU image whose baked LoRA has a
  `null` sign-off** (`ADR-0023` D8). That is one check against an image
  label. This makes the `ai-ml-lead` gate structural rather than a
  convention, in the spirit of `ADR-0020` §D5. **Whether a LoRA deserves a
  sign-off is not this ADR's call.**

**The GPU image build** (`infra/cloudbuild/deploy-gpu.yaml`, packet M5,
built on `ADR-0022` P6a's CUDA image with base weights baked in):

1. Read the pin. If `release_id` is not null:
   `gcloud storage cp gs://…/sd15-lora/releases/<release_id>/{pytorch_lora_weights.safetensors,manifest.json} ./ai_services/renderers/sd15/lora_baked/`.
2. **Fail the build unless** the file's SHA-256 equals both
   `pin.sha256` and `manifest.weights.sha256`, **and**
   `manifest.base_model.revision` equals the `SD15_MODEL_REVISION` build
   argument the image bakes its base weights from. A LoRA trained against a
   different base revision never ships.
3. `docker build` with the LoRA `COPY`'d into `/models/lora/` in **the last
   layer**, so a LoRA-only change rebuilds only that layer. The build sets
   `ENV SD15_LORA_PATH=/models/lora SD15_LORA_RELEASE=<release_id> SD15_LORA_SCALE=<scale>`
   and labels `curalina.lora.release`, `curalina.lora.sha256`,
   `curalina.lora.signoff` and `curalina.base.revision`.
4. Deploy by digest, exactly as every other image (`ADR-0023` D6).

The `deploy-gpu-renderer` trigger's path filter includes
`infra/models/sd15_lora.json` (`ADR-0023` D6), so **merging the pin PR is
the deploy**.

**Sidecar changes that make a bad LoRA un-deployable** (packet M4,
`python-services-engineer`, fast tests with the existing fake factory and
no torch):

- `SD15_MODEL_REVISION` setting, passed as
  `from_pretrained(model_id, revision=…)`. Unset keeps today's local
  behaviour.
- `model_label()` returns `<model_id>@<revision[:12]>+lora:<release_id>`,
  or `<model_id>@<revision[:12]>` without a LoRA. Rooms already records
  this header (C2), so **every render becomes traceable to exact weights
  with no rooms change**.
- `SD15_EAGER_LOAD=true` loads the pipeline at startup, and a new `/readyz`
  returns 503 until it is loaded. `/healthz` keeps its current semantics
  for local compose. Cloud Run's startup probe points at `/readyz`, so **a
  revision whose LoRA fails to load never receives traffic**. The deploy
  fails and the previous revision keeps serving.

**Rollback:** immediately, with
`gcloud run services update-traffic curalina-gpu-renderer --to-revisions=<previous>=100`.
Durably, revert the pin PR.

### D5 — Local use pulls releases too, ending the hand-carry everywhere

`infra/scripts/fetch_model_release.sh <family> <release_id>` (packet M3)
downloads a release into `ai_services/renderers/sd15/lora/` (already
gitignored) and verifies the SHA-256 against the manifest. Local compose
then works exactly as today (`SD15_LORA_PATH=/lora`). This is useful **as
soon as M1–M3 land, before any GPU is funded.**

### D6 — Recommendation gets no model pipeline. This is a finding, not a deferral.

Stated plainly for the owner: **the recommendation service has no trained
artifact to deploy, and building a pipeline for one would create scope it
does not need.**

1. **What ships** (C1/C4) is a fake encoder over four fixtures. The next
   real step is **item 24, wiring the real catalogue**. That is **data**,
   and it travels with code (importer plus workbook snapshot) through
   `ADR-0023`'s pipeline or recommendation's own import path. Item 24's
   packet must not assume a host filesystem path. In the cloud, the workbook
   reaches recommendation either baked into its image or through its own
   import endpoint, persisted in its own database. Both fit this ADR, and
   the choice is item 24's.
2. **MiniLM, if ever accepted, is pretrained and frozen.** There is nothing
   to train, so it is installed at image build at a pinned revision, like
   any dependency (C4).
3. **The session-22 two-tower model is the case the audit warns about.**
   Its training labels *are* a rule (`is_match()`). Where a rule fully
   defines the target, the architecture position is: **ship the rule.** It
   is deterministic, reviewable by a designer, and needs no artifact,
   retraining or drift monitoring. The one behaviour the model adds beyond
   the rule is **inferring missing tags** (the tags-hidden row). If that is
   pursued, the proportionate shape is an **offline batch whose output is
   reviewed catalogue tags**: data written into recommendation's own
   database through the catalogue path, **not** an online model in the
   ranking path. **Whether that inference is good enough to use is
   `ai-ml-lead`'s call** (`ADR-0006` still governs ranking evidence). This
   paragraph sets only the architectural default, consistent with
   `00_AUDIT`'s position that this is a rules engine with inference-only
   model calls: when a rule could express the behaviour, the burden of proof
   is on the model.
4. **If `ai-ml-lead` later accepts a trained recommendation artifact
   anyway,** it reuses D1–D4 unchanged: family `recommendation-<name>`, a
   pin file, and baking at image build. **No new design is needed, and none
   is built now.**

### D7 — Variants gets no model pipeline

Nothing is trained (C1). If the SDXL refinement arm is ever accepted, it is
inference-only with frozen weights (`00_AUDIT` table), which is a code and
image concern.

### D8 — What is deliberately not built

No Vertex AI (Pipelines, Training, Model Registry or Endpoints), no
MLflow or other experiment tracker, no training inside CI, no GPU in CI, no
scheduled retraining, no feature store. **Training stays in Colab**, which
suits a hand-run, rare job on a free or cheap T4. The pipeline is **two
small scripts, one bucket, one pin file and one build step.**

**Triggers to revisit:** training becomes scheduled or frequent; more than
one person trains concurrently and candidate collisions occur; or a model
needs more than Colab's GPU. In each case, the next step up is a Cloud Run
**job** with a GPU, or a Vertex custom training job, writing to the same
`candidates/` prefix. D1–D4 are unchanged.

## Phased build plan

| Phase | Work | Owner | Depends on | Done-evidence |
|---|---|---|---|---|
| **M1** | `model_artifacts` bucket and IAM in `envs/dev/foundation` | infra owner (`ADR-0023`) | `ADR-0023` P1 | second `plan` shows no changes. An `objectCreator` identity can add an object but cannot overwrite it |
| **M2** | Notebook: `BASE_MODEL_REVISION`, `training_config.json`, publish cell (D2), in `notebooks/learning/` | `ml-notebook-engineer` | M1 | a real Colab run produces a candidate prefix with all three items. No business logic was added to cells |
| **M3** | `promote_model_artifact.py`, `fetch_model_release.sh`, plus fast tests (synthetic safetensors headers; no network, GPU or `gcloud`, using a fake storage boundary) | infra owner, or `python-services-engineer` until `AGENTS.md` assigns `infra/**` | — (tests); M1 (real use) | tests for each fail-closed case in D3. A real candidate is promoted once and the second promote of the same release is refused. `fetch` into local compose renders with the LoRA |
| **M4** | sd15 sidecar: `SD15_MODEL_REVISION`, release-aware `model_label()`, `SD15_EAGER_LOAD`, `/readyz` | `python-services-engineer` | — | fast tests with the fake factory: label formats; `/readyz` 503 → 200; a missing LoRA path keeps the revision unready |
| **M5** | `deploy-gpu.yaml` bake step, pin file, prod sign-off check in `promote.yaml` | infra owner | `ADR-0022` P6a, `ADR-0023` C1, M3, M4 | a pin PR deploys a GPU revision whose `X-Model-Id` carries the release ID. A SHA mismatch fails the build. A base-revision mismatch fails the build. Prod promotion with `signoff: null` and a baked LoRA fails |

M1–M4 are useful without a GPU and can proceed as soon as the dev project
exists. M5 waits for the GPU decision.

## Consequences and reversal

**Costs accepted.**

- **A LoRA change rebuilds the GPU image.** Because the LoRA sits in the
  last layer, only that layer is new. Build time is dominated by the base
  image (R1: Cloud Build disk and timeout for a multi-GB image).
- **Base-model pinning becomes mandatory** for any LoRA release. Today's
  unpinned behaviour remains only for local runs without a revision set.
- **The owner gains two habits:** run the publish cell, then run promote.
  Each is one command.
- **Training is not bit-reproducible** (C2.3). The manifest makes a run
  *explainable* (versions, data fingerprint, seed), not re-runnable to
  identical weights. That is proportionate to a hand-run demo LoRA.

**Reversal.**

- **D4 (bake)** → startup download by URI, if images become too large or
  LoRA swaps too frequent. That needs a GCS client in the sidecar and
  env-var ownership resolved against `ADR-0023` D7. The bucket and manifest
  are unchanged.
- **D1 (GCS)** → Vertex Model Registry, if the D8 triggers fire. Releases
  copy over with their manifests.
- **D6** is reversed only by an `ai-ml-lead` acceptance of a trained
  recommendation artifact, which then uses D1–D4 as written.

**What would prove this decision wrong.**

- **If two LoRA releases with different SHA-256s render identically** at
  fixed seed and prompt, the bake step or `fuse_lora` is not doing what D4
  assumes. Test this once in M5.
- **If `/readyz` passes while renders fail on the LoRA,** eager load is not
  exercising the same path as rendering, and M4 is incomplete.
- **If the owner still ends up downloading zips** after M1–M3, D2's
  ergonomics failed. Find out why rather than adding a second path.
- **If `ai-ml-lead` judges the tags-hidden inference valuable and the
  offline-tags shape cannot carry it** (for example, because tags must be
  inferred per request from user-supplied data), D6.3's default is wrong
  for that case, and a ranking-path model returns as a question for a new
  ADR.

**What I am explicitly not deciding.**

- **Whether any LoRA, or the two-tower model, is good enough.** That is
  `ai-ml-lead`'s, through the gates. D4's `signoff` field only records it.
- **Whether SD 1.5 may ship.** `ADR-0020` §D3 already says it may not, except
  as a demo. This ADR does not touch that.
- **The sidecar's disabled safety checker** (`pipeline.py:116-120`, a
  documented local/demo choice). Before any **public** GPU deployment (P6b
  in prod), whether to re-enable it is a product-safety question **handed
  over to `ai-ml-lead` and the owner**, and is not ruled on here.
- **Item 24's catalogue-ingest mechanism** (D6.1).
- **Supplier-image rights for training** (B3, client).

## R1 — Facts to re-verify at packet time

- `gcloud` preinstalled in Colab, and `google.colab.auth.authenticate_user()`
  granting it the user's credentials. (M2)
- `roles/storage.objectCreator` preventing overwrite of existing objects,
  and the no-clobber flag on `gcloud storage cp`. (M1, M3)
- The safetensors header format (an 8-byte little-endian length, then
  JSON). (M3)
- `diffusers` `from_pretrained(revision=…)` and `load_lora_weights` key
  naming for PEFT-saved UNet LoRAs in the pinned `diffusers` version. (M3
  key check, M4)
- Cloud Build default-pool disk size and the maximum build timeout for a
  multi-GB CUDA image. (M5)

## Verification

Read this session, from source:

- `ai_services/renderers/sd15/src/curalina_sd15/pipeline.py` (`Settings`
  fields `:14-32`, `model_label` `:37`, `DiffusersPipelineFactory.build`
  `:100-131`), `app.py` (`/healthz` `:44-51`, `X-Model-Id` `:83`).
  `sd15/Dockerfile` and `renderers/docker-compose.yml` (LoRA bind mount and
  env vars). `sd15/lora/.gitignore`.
- `ai_services/room_generator/src/curalina_rooms/adapters/http_render_backend.py:92-101`
  (records `X-Model-Id`).
- Both copies of the LoRA notebook, extracted by script: CONFIG, training
  loop, save, zip, the "Using the result later" cell, and the owner copy's
  `pip install --upgrade` cell.
- `ai_services/recommendation/api/application_services.py` (full),
  `adapters/fake_feature_encoder.py`, `adapters/minilm_encoder.py` header,
  `pyproject.toml` (the `eval` extra), `bootstrap.py`, `settings.py`, and
  the `recommender_runs/` listing plus its `.gitignore`.
- `agent_instructions/STATUS.md` session 22 (uncommitted working-tree
  text), session 21, and dispatch item 24.
- `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md:28-63`. `ADR-0020` §D1–§D8.

No notebook, script, pipeline file or service source was written or changed
by this ruling. The consequential work is carried by
`agent_instructions/STATUS.md` dispatch item 38.
