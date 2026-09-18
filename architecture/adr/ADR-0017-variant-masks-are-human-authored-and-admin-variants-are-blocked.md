# Architecture decision record

ID: ADR-0017
Status: accepted
Owner and reviewer: `tech-lead` (decision); raised by `delivery-coordinator`
while scoping the `/admin/product` feature in the existing monolith
Date: 2026-09-15

## Context

A new admin-only page `/admin/product` is requested in the existing
Express/React monolith: an admin uploads a product photo, the app calls the
variant generator (`8102`) to produce colour variants, the admin reviews and
picks one, and "Accept" persists the chosen image into `products`
(`shared/schema.ts`).

Scoping hit a wall at `POST /v1/jobs`, which requires a `mask_id` that no
endpoint in the service produces. The question raised was "how should the
admin UI obtain a mask." Reading the code answers a different and larger
question first, so the evidence is recorded before the ruling.

**Finding 1 — the design already answers where masks come from, and the
answer is not "generate them".** `agentic_flow/variant_generator_workflow.md`
§2 (Segment, lines 27–45) specifies manual annotation first (`labelme` or a
notebook polygon tool), a per-region `MaskSpec` carrying
`protected_subregions`, `feather_px`, `human_corrected` and `revision`, and
states plainly: *"A product-wide mask is insufficient — legs, hardware,
piping and background must stay unchanged."* SAM 2.1 hiera-small is named as
an *optional accelerator* **after** the manual baseline works, *"and its
output is always human-correctable."* `agentic_flow/variant_generator_workflow.md:49`
gates any SAM adapter behind V01/V02 notebook evidence and the
`architecture/guides/07_model_selection.md` freeze procedure.

So there is no design intent, anywhere, for request-time automatic mask
generation. Masks are a human-authored artefact that enters the service from
outside. The missing runtime capability is therefore **mask ingestion**, not
mask generation.

**Finding 2 — no tracked open question covers this.**
`agentic_flow/open_questions.yaml` contains `OQ-001` through `OQ-013`; none
mentions masks or segmentation (grep for `mask`/`segment` returns zero hits
in that file). `agentic_flow/AMENDMENTS.md` mentions masking only in prose
about what "improving the model" means (line 108) and in the ControlNet row
of the stack table (line 115) — neither is an amendment to mask scope.
`architecture/guides/03_data_contracts.md:30,32` defines the `mask_id` field
on `VisualVariant` and the `Mask` record shape (source asset, dimensions,
1 = editable / 0 = protected, explicit feathering policy) but never says who
creates one. This is an internal engineering gap, not a Design Manual gap.
`OQ-xxx` IDs are reserved for questions owned by the client or the design
authority; minting one here would misfile an internal debt as a client
blocker.

**Finding 3 — `mask_id` is unvalidated and unresolved today.** In
`ai_services/variant_generator/src/curalina_variants/api/schemas.py:137` it is
`mask_id: str = Field(min_length=1)`. `api/store.py:55,216` and
`api/sqlite_store.py:60,402` store it and echo it back. Nothing resolves it
to a `Mask`. `POST /v1/jobs` will accept `mask_id: "x"` and succeed. There is
no mask repository, no `ports/` entry for one (`ports/` contains only
`colour_transfer.py` and `diffusion_refinement.py`), and no
`application/prepare_mask.py` — all three are in the design's module layout
at `agentic_flow/15_variant_generation_technical_design.md:137-142` and none
were built.

**Finding 4 — decisive, and larger than the mask.** The worker does not
recolour anything at all.
`ai_services/variant_generator/src/curalina_variants/workers/runner.py`
imports only `JobRecord`, `SQLiteJobStore` and `Settings`. A repo-wide grep
for `generate_variants` outside its own module returns exactly one hit:
`tests/unit/test_generate_variants.py`. The real LAB colour-transfer use case
at `application/generate_variants.py` — the one that takes a `Mask` and
produces a recoloured image — is reachable **only from its unit test**. The
A3 worker produces a labelled-fake output asset.

The consequence is that the missing mask is not the binding constraint. Even
with a perfect mask supplied, `/admin/product` today would show an admin a
fake output asset and invite them to persist it into `products.images` as a
real product photo. That is the fabricated-success failure mode `ADR-0016`
rejected, relocated from the render path to the admin path.

## Options

1. **Build a heuristic mask adapter** (full-frame or auto bounding box) and
   treat it as new in-scope capability with an ADR.
2. **Ship with an explicitly labelled placeholder mask** ("whole photo is
   editable, no real segmentation") citing an `OQ-xxx`.
3. **Block variant generation in `/admin/product`** until a real mask path
   exists, shipping the rest of the page with the feature visibly disabled.
4. **Block now (as 3), and specify the two packets that unblock it**: mask
   *ingestion* (not generation) plus wiring `generate_variants` into the
   worker.

## Decision and rationale

**Option 4.** `/admin/product` ships with upload, product listing and the
existing image-management path working, and with variant generation visibly
disabled and labelled as not yet available. No placeholder mask, no
heuristic mask, no `OQ-xxx` citation.

Why not option 1. A full-frame or bounding-box mask is not a simplification
of the specified mask, it is the specific thing the design names as wrong:
legs, hardware, piping and background must stay unchanged, and a whole-frame
editable mask recolours all of them. The output would be a known-incorrect
image presented to an admin as a variant candidate. Separately, building a
segmenter is gated behind V01/V02 evidence
(`agentic_flow/variant_generator_workflow.md:49`), and V01 closed at `revise`
under `ADR-0012` — the gate is not open. A heuristic adapter would also not
help, because of Finding 4: the worker would still not call it.

Why not option 2. Two independent grounds. First, there is no `OQ-xxx` to
cite (Finding 2), and inventing one to satisfy the citation discipline
inverts that discipline's purpose. Second, a label on the mask does not make
the output honest — Finding 4 means the reviewed image is a fake asset
regardless of the mask, so the label would describe the wrong defect while
concealing the larger one. "Honest about what it's doing" is not achievable
by labelling one of two fabrications.

Why option 4 over bare option 3. Option 3 leaves the feature blocked on
nothing in particular. The two pieces of work are known, small, and neither
requires a model, a gate, or client data:

- **`VAR-A2-03` — mask ingestion.** `POST /v1/masks` accepting a
  human-authored mask (source asset ref, dimensions matching the source
  exactly, editable array, protected subregions, `feather_px`,
  `human_corrected`, `revision`) per `architecture/guides/03_data_contracts.md:32`
  and the `MaskSpec` at `agentic_flow/variant_generator_workflow.md:35-46`;
  a mask repository behind a port; and `POST /v1/jobs` resolving `mask_id`
  against it, returning the contract's not-found error instead of accepting
  any non-empty string. The mandatory mask unit tests at
  `agentic_flow/variant_generator_workflow.md:45,51` (inverted, size
  mismatch, alpha, empty, all-one-when-protected-regions-exist) are validation
  for exactly this endpoint and are currently validating nothing reachable
  over HTTP. This is **additive** — a new endpoint plus tightening a field
  that was never satisfiable — so minor, no major version bump.
- **`VAR-A3-03` — wire `generate_variants` into `workers/runner.py`** against
  the real `LabColourTransformer`, replacing the labelled-fake output asset
  on the success path. `agentic_flow/15_variant_generation_technical_design.md`
  states the LAB transformer *"implements `ColourTransformer` with no model
  dependency at all"* and is fully unit-testable on synthetic images, on CPU,
  in CI — so this needs no model, no GPU, and no `OQ-011` furniture
  photographs. `OQ-011` blocks V01 *evidence claims*, not the code path.

Order: `VAR-A2-03` then `VAR-A3-03`, then re-scope `/admin/product`'s
generation flow.

Three further constraints on whoever builds the admin page later, so they
are not re-litigated:

- **One job per colour.** `POST /v1/jobs` takes a single `target_colour` and
  there is no batch endpoint. N colour options is N jobs plus N polls. This
  is a UI concern; it is not a reason to add a batch endpoint to the service.
- **"Accept" is two writes, not one.**
  `POST /v1/candidates/{id}/reviews` records a review decision inside the
  variants service; persisting the image into `products` is a separate write
  in the monolith. Job success, candidate approval, and the image being live
  on a product are three states and must stay three. An admin approving a
  candidate does not make it commercially available — `commercial_status`
  (`architecture/guides/03_data_contracts.md:30`) is a fourth, untouched axis.
- **No mask authoring UI is authorised by this ADR.** `VAR-A2-03` ingests a
  mask; where the admin gets one from is a separate, unscoped question. If
  the answer turns out to be "an in-app annotation tool", that is its own
  ADR.

## Consequences and reversal

Cost: `/admin/product` ships materially thinner than requested — upload and
review exist, colour variants do not. Two packets of variants work land
before the feature is complete. Anyone wanting variants sooner will read this
as the architecture blocking a product ask.

What is bought: `products.images` cannot receive a fabricated image, and the
`Mask` contract stops being decorative.

**Reversal.** If `VAR-A2-03` and `VAR-A3-03` both land and variant generation
in `/admin/product` is enabled, this ADR is superseded by that fact and needs
no further record. Reversal of the *ruling itself* — shipping a heuristic or
placeholder mask — requires evidence that a whole-frame recolour does not
damage legs, hardware, piping or background on the actual product photos in
use. That evidence is a V-series notebook run and is `ai-ml-lead`'s call, not
mine. If such a run showed the damage is acceptable for the admin *preview*
path specifically, this ADR should be amended rather than ignored.

**What would prove this decision wrong:**

- A mask-producing endpoint or a worker call into `generate_variants` exists
  somewhere I did not find. Refuted by: `grep -rn generate_variants
  ai_services/variant_generator --include="*.py"` returning hits outside
  `application/generate_variants.py` and `tests/unit/test_generate_variants.py`;
  or a route other than the six in `api/app.py` (`/v1/assets`,
  `/v1/assets/{id}/content`, `/v1/jobs`, `/v1/jobs/{id}`,
  `/v1/jobs/{id}/cancel`, `/v1/candidates/{id}/reviews`).
- An `OQ-xxx` or an `AMENDMENTS.md` entry does cover mask provenance and I
  missed it.
- The admin path's requirement is *not* a product-accurate image — e.g. it is
  an internal mood/exploration tool whose output never reaches
  `products.images`. That is a different feature and this ruling would not
  apply to it. Whoever asserts that must say where the output is stored.

## Verification

Evidence gathered this session, reproducible:

- `grep -rn -i "mask\|segment" agentic_flow/open_questions.yaml` → zero hits.
- `grep -rn -i "mask\|segment" agentic_flow/AMENDMENTS.md` → lines 108 and
  115 only, neither a scope amendment.
- `grep -rn -i mask architecture/guides/03_data_contracts.md` → lines 30 and
  32; record shape defined, provenance not.
- `find ai_services/variant_generator -name "*.py" | grep -iE "segment|mask"`
  → `domain/mask_spec.py`, `evaluation/human_masks.py` and their two tests.
  `evaluation/human_masks.py` is offline evaluation tooling.
- `ls ai_services/variant_generator/src/curalina_variants/ports/` →
  `colour_transfer.py`, `diffusion_refinement.py`. No segmenter, no mask
  repository.
- `grep -rn "generate_variants" ai_services/variant_generator --include="*.py"`
  outside its own module → one hit, `tests/unit/test_generate_variants.py`.
- `api/fixtures/create_variant_job_request.json` carries
  `"mask_id": "mask_000001"` — a fixture string, confirming the field was
  contract-shaped in A1 and never backed by a producer.

Acceptance for the unblock, to be checked before `/admin/product`'s
generation flow is re-scoped:

1. `POST /v1/jobs` with an unknown `mask_id` returns the contract's
   not-found error, not `202`.
2. A job submitted with a real ingested mask produces an output asset whose
   pixels differ from the source **inside** the editable region and are
   byte-identical **outside** it — the hard-composite guarantee at
   `agentic_flow/variant_generator_workflow.md:92`.
3. The mandatory mask unit tests
   (`agentic_flow/variant_generator_workflow.md:51`) run against the ingestion
   path, not only against `domain/mask_spec.py` in isolation.
