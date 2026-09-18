# Architecture decision record

ID: ADR-0020
Status: accepted
Owner and reviewer: `tech-lead` (decision); raised by the project owner
directly ("scope real photorealistic room generation as its own initiative,
decoupled and trackable — should we use Qwen or something else?")
Date: 2026-09-17

## Context

`ADR-0018` §C2 established that rooms produces no pixels at all:
`FakeGroundedGenerationAdapter.generate`
(`ai_services/room_generator/src/curalina_rooms/adapters/fake_grounded_generation.py`)
returns `asset_fake_{digest}` for an asset that was never written, and the
live worker never calls the adapter in the first place. `ADR-0011` keeps
G01/G02/G03 blocked on client-owned `OQ-010`. `ADR-0015` permitted
synthetic-geometry rendering as *product behaviour* but, in its own words,
"does not create a renderer."

The owner now wants the renderer scoped as an independently trackable
initiative. This ADR decides **which model, which adapter shape, what is
buildable today without `OQ-010`, and what is not.** Everything below was
re-derived from current source this session.

### C1 — `OQ-010` blocks `RoomPrepAdapter`, not `GroundedGenerationAdapter`

This is the finding that makes the initiative dispatchable, and it is
visible in the code rather than argued from the documents.

`RenderPlan` (`domain/render_plan.py:46-61`) hands the generation adapter
`insertions: tuple[PlannedInsertion, ...]`, and each `PlannedInsertion`
already carries `image_space_box: BoundingBox` (`:27-34`) — normalized
image-space coordinates, computed upstream. It also carries
`protected_regions`, `styled_room`, `prompt_version`,
`negative_constraints` and `rules_version`.

So the mm→pixel projection has already happened before the generation
adapter is called. `OQ-010` is about whether that projection corresponds to
a *real measured room*. It is a blocker on the geometry producer
(`ports/room_prep.py`, whose fake already supports `synthetic_defaults` and
structurally pins `measurement_certified=False`), and on the G-series
evidence that scores image-space placement against planned millimetres. It
is **not** a blocker on the code that turns image-space boxes into pixels.

`14_room_generation_technical_design.md:108-124` reads as though the
generation path owns the homography. In the shipped code it does not; A2
drew the seam in the right place. That seam is what this ADR builds on.

### C2 — Two modes, and collapsing them is the failure this ADR exists to prevent

| Mode | Backplate | Projection | Needs `OQ-010`? | May carry a G-series claim? |
|---|---|---|---:|---:|
| **S — `synthetic_scene`** | authored by us | **known by construction** — we choose the camera | no | **no** |
| **G — `grounded_photo`** | a real photograph of a real room | estimated from annotated corners against measured dimensions | **yes** | yes, at G01+ |

Mode S is not "grounded generation with weaker evidence." It is a different
claim: *this is an invented room rendered to declared default dimensions,
containing real catalogue product pixels.* `measurement_certified` stays
`False` in mode S because the **room** is invented — not because the
projection is uncertain. Under `ADR-0015`'s table it is the
`synthetic_defaults` provenance mode, which that ADR already permits for
product and forbids as evidence.

### C3 — Three hard prerequisites that are CPU-only and currently unowned

1. **Rooms cannot store bytes.** `AssetContentResponse`
   (`api/schemas.py:95-107`) returns a `content_ref` string and its own
   docstring says it "describes the authorized content reference rather
   than serving raw bytes." There is no `AssetStore` port — `ports/`
   contains `clock.py`, `grounded_generation.py`, `room_prep.py` and
   nothing else.
2. **The worker never calls the adapter.** `process_one_job`
   (`workers/runner.py`) leases a job and calls `complete_leased_job`
   directly. No generation is attempted, and the job is marked succeeded.
3. **No cutouts exist.** Stage 3 below needs alpha-matted product cutouts.
   `/Users/rjsalmon/Downloads/Supplier Images` confirmed this session:
   `ATRIANI` 312 files, `LUXUS` 131, `LAZZONI` 33, `CELADON` 63. Per
   `ADR-0008`, ATRIANI and LUXUS are white-background *product*
   photography, so cutouts are derivable on CPU — but `ADR-0008` left usage
   rights unresolved and `OQ-011` records that the only *supplied
   catalogue* is 62 artwork records.

None of the three needs a GPU, a model, or client data. All three must land
before any model work is worth starting.

### C4 — The parallel interim compositing preview is not this

A separately scoped, explicitly-labelled synthetic compositing preview is
being built elsewhere in this session at the owner's request. This ADR
neither authorizes nor evaluates it, and **no quality or G-series claim
transfers between them in either direction.** If that work produces a
deterministic compositor, D4's phase P2 should absorb it rather than write
a second one; that is a code-reuse note, not an acceptance.

## Options

**On the model.**

- **(A) SDXL inpainting** (`diffusers/stable-diffusion-xl-1.0-inpainting-0.1`,
  OpenRAIL++-M). ~10–12 GB VRAM fp16 at 1024px. Native `mask_image` +
  `strength` API, seeded generator, largest ControlNet/IP-Adapter ecosystem.
  Already the standing choice in `00_AUDIT_AND_STACK_DECISIONS.md` Part 3
  and `14_room_generation_technical_design.md:32`.
- **(B) Qwen-Image-Edit-2509** (Apache 2.0). Cleanest licence of the
  candidates and a genuinely strong instruction-following editor with
  multi-image input. ~20B parameters → roughly 40 GB of weights at
  2 bytes/param before activations, which `00_AUDIT` Part 3 already costed
  and ruled "cloud-rental-only and out of scope unless a sponsor supplies
  hardware." Community quantizations reach 24 GB at a cost to determinism.
  Architecturally decisive: it is an *instruction* editor with no mask +
  denoise-strength API, so protected pixels can only be enforced by our own
  output compositing — which is exactly what
  `15_variant_generation_technical_design.md:101-103` already requires of a
  Qwen adapter on the variants side.
- **(C) FLUX.1 Kontext [dev]** (~12B, ~24 GB). Excellent at instructed edits
  and object consistency. The `dev` weights ship under the FLUX.1 [dev]
  **Non-Commercial** License; commercial use means BFL's hosted API
  (`[pro]`/`[max]`) or a purchased self-host licence. Curalina is a
  commercial product.
- **(D) SD 1.5 inpainting.** Runs in 6–8 GB. Materially weaker on interiors.
- **(E) A hosted image API** (Google Gemini 2.5 Flash Image, OpenAI
  `gpt-image-1`). No GPU operations at all, strong at multi-image
  composition, per-image cost. Weak or absent denoise-strength control, no
  reproducible seed, and sending customer room photographs to a third party
  needs the same privacy/rights answer nobody has given for
  `quiz_responses.roomPhoto` (`ADR-0011`). `ADR-0018` §C2/§D7 already ruled
  the monolith's orphaned Gemini/Stability stack off the future-state path.

**On the adapter shape.**

- **(F) A new sibling GPU service.** Honest about the resource profile, but
  it would own a job lifecycle and a candidate record, making it a fourth
  business service and splitting the three-state invariant across a network
  boundary.
- **(G) One in-process adapter with `torch` in the base install.** Simplest,
  and it puts a GPU dependency in fast CI. Violates `CLAUDE.md`.
- **(H) An adapter package plus a second, narrower port for the model call,
  with a stateless inference sidecar as the remote-GPU deployment.**

## Decision and rationale

**D1 — The primary backend is SDXL inpainting (option A), and the model is
deliberately made the *least* load-bearing decision in the design.**

Grounding comes from compositing, not from the model. Real product pixels
are pasted at `image_space_box` and hard-composited back after the model
runs, so catalogue identity is preserved **by construction**, exactly as
`14_room_generation_technical_design.md:49-80` argues for approach A and as
variants' `hard_composite` already proves with a pixel-level test
(dispatch item 16 / `VAR-A3-03`).

SDXL wins here not on image quality but on **API shape**: it is the only
candidate that natively exposes `mask_image` + `strength` + a seeded
generator, which is precisely the dial a low-denoise seam harmonization
needs. A model without a strength dial cannot be asked to blend a seam; it
can only be asked to redraw a region and hoped at.

**D2 — Qwen-Image-Edit-2509 is the comparison arm, not the primary, and the
reason is hardware and API shape, not quality.** ~40 GB of weights against
no funded GPU, and no mask/strength API, so protected-pixel preservation
would rest entirely on our own compositing with no way to ask for a *partial*
edit. It is admitted behind the same port in phase P6 if a sponsor funds
hardware or a rented GPU hour is budgeted. This re-affirms `00_AUDIT` Part 3
and `14_...md:35` with a current reason rather than overturning them.

**D3 — FLUX.1 Kontext [dev] is rejected on licence, and SD 1.5 and hosted
APIs are admitted only in narrow roles.**

- FLUX.1 Kontext [dev]: non-commercial weights, commercial product. Rejected
  as a self-hosted backend. **The packet that would first depend on this must
  re-read the licence file on the model repository before relying on this
  sentence** — licences change, and a wrong licence claim is the kind of
  thing this project has been bitten by. If the owner buys a BFL commercial
  licence, it re-enters as a backend with zero architecture change.
- SD 1.5 inpainting: permitted as a low-VRAM developer fallback only. Never
  the shipping backend.
- Hosted APIs: permitted **only** as a time-boxed comparison arm on the
  shell-generation stage, where no customer imagery is involved. Rejected as
  the grounding mechanism and forbidden on any path carrying a customer room
  photograph until a privacy/rights answer exists.

**D4 — The adapter is option (H): a package behind the existing
`GroundedGenerationAdapter` port, with the model call isolated behind a new,
narrower `ImageDiffusionBackend` port. No new business service.**

```
ai_services/room_generator/src/curalina_rooms/
  ports/
    grounded_generation.py      # unchanged — the existing seam
    diffusion_backend.py        # NEW: ImageDiffusionBackend + BackendCapabilities
    asset_store.py              # NEW (C3.1)
  adapters/
    grounded/
      __init__.py               # GroundedCompositeAdapter: implements
                                #   GroundedGenerationAdapter, orchestrates 1-3
      backplate.py              # stage 1 — CPU, deterministic, no model
      compositor.py             # stage 3 paste + seam mask + hard composite — CPU
      manifest.py               # seed, strength, band widths, prompt_version
    diffusion/
      fake_backend.py           # CPU, deterministic, the CI default
      sdxl_inpaint_backend.py   # GPU, behind the [gpu] extra
      http_backend.py           # talks to the inference sidecar
```

Three stages. **Only the middle one needs a GPU.**

1. **Backplate — CPU, deterministic, no model.** Project the `RoomGeometry`
   already present on `NormalizedRoom` (millimetres) through a chosen pinhole
   camera to produce (a) a flat-shaded RGB shell using the rules engine's
   palette, (b) a depth/line control map, and (c) the exact 3×3 floor
   homography. In mode S we choose the camera, so the homography is an output
   of our own arithmetic, not an estimate. Fully unit-testable with numpy
   assertions.
2. **Photoreal shell — GPU.** One `ImageDiffusionBackend.generate` call at
   high denoise over the whole shell, conditioned on the control map from
   stage 1, **with no products present**. Geometry is enforced by the control
   map, never by the prompt. Prompts remain guidance, never validators
   (`14_...md:167-168`).
3. **Composite and harmonize — CPU paste, GPU seam pass, CPU hard composite.**
   Paste cutouts at each `image_space_box` in depth order; build
   `seam_mask = dilate(product_mask, D) & ~erode(product_mask, E)`; one
   low-strength backend call over **the seam band only**; then hard-composite
   the product interiors back from the cutouts and restore
   `plan.protected_regions` outside the feather band.

**The invariant that makes this design worth having, and it is CPU-testable
against `FakeDiffusionBackend` with no GPU in CI:**

> Every pixel strictly inside `erode(product_mask, E)` is byte-identical to
> the pasted cutout, and every pixel inside a `ProtectedRegion` outside the
> feather band is byte-identical to the backplate — for any backend.

That is what makes the model swappable and the catalogue-grounding claim
structural rather than hopeful. It is the same guarantee variants already
enforces, and it is the test that must exist before any GPU work starts.

**D5 — `BackendCapabilities` is declarative and enforced, not documented.**
`supports_mask`, `supports_strength`, `supports_control`, `max_px`,
`deterministic_seed`. A backend whose `supports_mask` is `False` **may not be
selected for stage 3** and the adapter raises rather than silently running a
whole-image edit. This is how a future Qwen backend is structurally prevented
from skipping protected-pixel enforcement, instead of being warned against in
a comment.

**D6 — When the GPU is not local, `HttpDiffusionBackend` calls a stateless
inference sidecar over public HTTP, and that sidecar is infrastructure, not a
fourth business service.** Same status as the suite runner per `CLAUDE.md`. It
owns no job table, no candidate record, no review state and no domain
vocabulary; it accepts bytes plus parameters and returns bytes. Rooms remains
the sole owner of the job lifecycle and of the three-state separation. This is
the direct answer to "should this be a new service": **no** — but the GPU may
live elsewhere.

**D7 — `torch`/`diffusers` live in an optional `[gpu]` extra, never in the
base install.** GPU tests are marked `@pytest.mark.gpu` and deselected by
default. Fast tests continue to require no GPU, no internet, no model
downloads (`CLAUDE.md`).

**D8 — Phased build plan. One packet at a time (`AGENTS.md` §9).**

| Phase | Work | Owner | GPU | Needs `OQ-010` |
|---|---|---|---:|---:|
| **P1** | `AssetStore` port + filesystem adapter; `GET /v1/assets/{id}/content` serves real bytes; worker calls `GroundedGenerationAdapter` and **classifies** failures (never a silent succeeded-with-phantom-asset); fake adapter writes a real, explicitly-labelled placeholder PNG | `python-services-engineer` | no | no |
| **P2** | Stage 1 + stage 3 CPU pipeline: projection, control map, cutout paste, seam mask, hard composite, protected-region restore. D4's byte-exactness invariant tested for real | `python-services-engineer` | no | no |
| **P3** | `ImageDiffusionBackend` port, `FakeDiffusionBackend`, D5 capability enforcement, manifest records seed/strength/band widths/`prompt_version` | `python-services-engineer` | no | no |
| **P4** | `SdxlInpaintBackend` behind `[gpu]`; first real photorealism | `python-services-engineer` | **yes** | no |
| **P5** | Labelled synthetic-scene evaluation run — **not G01/G02/G03** | `ml-notebook-engineer`; methodology and accept/reject owned by `ai-ml-lead` | yes | no |
| **P6** | Qwen-Image-Edit-2509 comparison arm behind the same port | `python-services-engineer` | **yes, ~40 GB class** | no |

P1–P3 are ordinary CPU engineering and produce a real image file with real
product pixels in a flat-shaded room before a single model weight is
downloaded. Mode G is **not** in this plan; it resumes at G01 when `OQ-010`
is answered, and needs no rework of P1–P4 because only the backplate source
and the homography origin change.

**D9 — A product with no cutout returns `needs_input` citing `OQ-011`.** Not
a substitute product, not a grey box, not a stock image. Artwork composites
cleanly at any angle because it is planar (`14_...md:78-80`), and artwork is
the only fully-catalogued category, so P2's first honest demonstrable output
is realistically **artwork on a synthetic wall**. That is a smaller claim than
"a rendered living room" and it is the true one.

**D10 — Band widths (`D`, `E`), feather pixels and denoise strengths are
declared engineering policy, not Design Manual rules.** They are recorded in
the manifest and versioned alongside `prompt_version`; they are not invented
silently and they **may not be tuned to make an evaluation pass**. This mirrors
variants' `feather_px` "explicit policy, default 3"
(`15_...md:43`). No `OQ-xxx` is minted for them, because the Design Manual
does not purport to define them — there is no gap to escalate.

## Consequences and reversal

**Costs accepted.**

- P1 makes rooms write files. Rooms has never persisted bytes; this is new
  operational surface (disk, cleanup, content hashing) in a service that has
  so far only held rows.
- Mode S produces convincing pictures of rooms that do not exist. Every
  request, job, candidate, manifest, suite result and UI string must carry
  the provenance mode, per `ADR-0015`. The more photoreal P4 gets, the more
  load that labelling carries — this is the principal risk of the whole
  initiative and it is a product-copy risk, not an engineering one.
- D4 adds a second port inside a service that already has an adapter seam.
  Two seams for one capability is more indirection than a reader expects, and
  it is justified only by D5's enforcement and the model-swap requirement. If
  the backend never changes, this was over-built.
- D6's sidecar means a deployment topology with a GPU box nobody has funded
  yet. P1–P3 deliberately do not depend on it.
- P6 may never be affordable. The port is designed so that this costs nothing
  beyond an unused adapter file.

**Reversal.**

- D1 reverses by writing a different `ImageDiffusionBackend` — one file, no
  change to `GroundedGenerationAdapter`, the application layer, the contract
  or the job lifecycle. That is the entire point of D4.
- D3's FLUX rejection reverses the day a commercial licence is purchased.
- D6 reverses to an in-process GPU adapter by selecting `SdxlInpaintBackend`
  instead of `HttpDiffusionBackend` in the composition root.
- D8's phase order reverses only backwards: P4 without P2's byte-exactness
  test is explicitly not permitted, because then the grounding claim rests on
  the model again.

**What would prove this decision wrong.**

- **D1/D4:** if the seam-harmonize pass at low strength cannot make a pasted
  cutout read as lit by the scene — the known weakness of approach A, flagged
  at `14_...md:76-80` as "a front-on product photo pasted into an oblique room
  reads wrong" — then composite-then-harmonize is the wrong primary and
  approach B (generate from a control map, hold identity with reference
  conditioning) has to be measured rather than assumed. In mode S we control
  the camera and can choose near-frontal angles, which is a real mitigation
  and also a real limit on how many room views the product can offer. **This
  is the most likely way D1 is wrong**, and P5 is where it shows up.
- **D2:** if Qwen-Image-Edit-2509 at a community quantization runs
  deterministically in 24 GB and preserves protected pixels under our own
  compositing as well as SDXL does under a mask, the hardware objection
  weakens and the licence advantage (Apache 2.0 vs OpenRAIL++-M's use
  restrictions) starts to matter. Measurable at P6, not assertable now.
- **D9:** if the ATRIANI/LUXUS white-background photography does not actually
  join to the SKUs recommendation returns (`ADR-0018` §D3's
  `supplier_id`/`supplier_sku` work, dispatch item 19), then there are no
  cutouts for any furniture item and mode S is an artwork-only capability
  indefinitely. **This is unverified** and the P2 packet must check the join
  before writing the cutout loader.
- **C1:** if a future change moves projection into the generation adapter, the
  `OQ-010`-independence of mode S evaporates. The seam at
  `PlannedInsertion.image_space_box` is load-bearing and should be defended.

**What I am explicitly not deciding.**

- **Whether any output of this pipeline is acceptable.** Accept/reject
  thresholds, metric selection, held-out discipline and the evaluation
  methodology for P5 are `ai-ml-lead`'s, via the notebook gates
  (`AGENTS.md` roster). I am ruling on which model to *try* and how the code
  is *shaped*; only `ai-ml-lead` can say a model is proven.
- **Whether the P5 synthetic-scene run is worth doing at all.** `ADR-0011`
  §Options (b) already reserved that judgement for `ai-ml-lead`. I am ruling
  only that it may not be *called* G01, G02 or G03, and that it carries no
  G-series claim.
- **Any G01/G02/G03 status.** `OQ-010` remains open and blocking. Mode G is
  untouched by this ADR.
- **Whether GPU hardware gets funded.** That is an owner/commercial decision.
  It is raised as a concrete ask in `agent_instructions/STATUS.md`, not minted
  as an `OQ-xxx`, because it is not a Design Manual gap.
- **The fate of the orphaned legacy Gemini/Stability stack.** `ADR-0018`
  already left that open for the owner; nothing here changes it, and nothing
  here revives it.

## Verification

Read in full this session, from current source rather than from
`agent_instructions/STATUS.md`:

- `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` — Part 3 room-service stack
  table (SDXL + ControlNet primary, Qwen "higher resource"), Part 3 Hardware
  (SDXL 10–12 GB; Qwen ~40 GB, "cloud-rental-only"), Part 2's
  deterministic-rules-engine correction.
- `agentic_flow/14_room_generation_technical_design.md` — model stack table
  (`:30-36`), approaches A/B/C (`:44-106`), the homography section
  (`:108-124`), post-render validation (`:126-157`), the G01–G03 gate table
  (`:198-210`).
- `agentic_flow/15_variant_generation_technical_design.md` — why the sibling
  service chose a **no-model** primary (LAB chroma substitution preserving
  L\*, `:50-81`), `hard_composite` as non-optional (`:92-99`), and the
  standing rule that a Qwen adapter "does not expose SDXL's mask API and
  protected pixels must be enforced by explicit output compositing"
  (`:101-103`).
- `architecture/adr/ADR-0011`, `ADR-0015`, `ADR-0016` (header/fail-closed
  framing), `ADR-0018` (format exemplar and §C2/§D6/§D7 constraints).
- `agentic_flow/open_questions.yaml:132-158` — `OQ-010`
  (`ROOM_GEOMETRY_SOURCE`, blocking, `design_authority + client`) and
  `OQ-011` (`FURNITURE_CATALOGUE_EXISTENCE`, blocking, `client`, blocks
  "all room generation").

Source facts confirmed by reading the code, not by citing a document:

- `ports/grounded_generation.py` — `generate(self, plan: RenderPlan) ->
  GenerationOutcome`; the port's own docstring names composite-then-harmonize
  as the eventual implementation.
- `domain/render_plan.py:27-34, 46-61` — `PlannedInsertion.image_space_box`
  and `RenderPlan.protected_regions` are already image-space. This is C1's
  evidence.
- `domain/generation_outcome.py` — `__post_init__` already forbids a
  succeeded outcome without `candidate_asset_id` and a failed one without
  `failure_reason`; P1's failure classification has an enforced shape to
  target.
- `workers/runner.py` — `process_one_job` leases and calls
  `complete_leased_job`; the adapter is never invoked. C3.2 confirmed.
- `api/schemas.py:95-107` — `AssetContentResponse` returns `content_ref`,
  serves no bytes; `ports/` has no `asset_store.py`. C3.1 confirmed.
- `adapters/fake_room_prep.py` — already branches on
  `geometry_source_mode == "synthetic_defaults"` and returns
  `measurement_certified=False` with `source=RoomPrepSource.FAKE_FIXTURE`.
  Mode S has a geometry producer today.
- `/Users/rjsalmon/Downloads/Supplier Images` re-counted this session:
  ATRIANI 312, LUXUS 131, LAZZONI 33, CELADON 63 — consistent with
  `ADR-0008`'s inventory.

Licence claims in D1/D3 are stated to the best of current knowledge and are
**explicitly flagged for re-verification at packet time** (P4 for
OpenRAIL++-M, P6 for Apache 2.0, and any future FLUX packet for the
non-commercial term). No packet may rely on a licence sentence in this ADR
without re-reading the model repository's licence file.

Consequential work authorized by this ADR is carried by
`agent_instructions/STATUS.md` dispatch item 27, not by this ADR. No
`curalina_rooms` source is changed by this ruling.
