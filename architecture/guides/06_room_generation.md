# Room generation architecture

## Problem and proof boundary

Visualize a specified bundle in a customer's room while retaining approved architecture and recognizable product identity. A plausible room with visually different furniture fails catalogue grounding. The renderer consumes a selection; it cannot substitute items to make an image easier to generate.

## Notebook sequence

G01 validates room images, physical measurements, protected areas and image-space placement annotations. G02 tests insertion of one catalogue product before increasing to two or three references. G03 measures full pilot composition, intentional quantities, occlusion and identity, then chooses a pipeline or records that grounded rendering remains unproven.

Begin with five approved room photos, manual masks and one hero product per scene. Later add two to three hero products and a bounded complete bundle only after the earlier gate. Keep at least two room scenes held out. Do not tune on the final room set. Insufficient references should reduce the experiment scope rather than produce imaginary furniture.

## Proposed generation approaches

A: controlled compositing of available product cutouts plus masked harmonization with SDXL. This is a baseline with limited viewpoint flexibility. Artwork can use a planar placement transform; the same method is not a 3D furniture reconstruction technique.

B: Qwen multi-image editing with the room and one or two product references per pass. Treat product consistency as a hypothesis to benchmark. Sequential insertion can damage previous items, so validate all earlier products after every pass and checkpoint accepted stages. Do not feed an unlimited catalogue contact sheet and assume distinct identities are preserved.

C: optional spatial conditioning after A/B establish a useful baseline. Add depth/edge controls only when a compatible model/pipeline/checkpoint is verified. A relative depth map does not establish metres or guarantee furniture fits. Manual image-space layout is the initial fallback.

Do not claim SDXL inpainting alone understands reference product identity. Reference conditioning requires an explicitly compatible adapter, or retained composited product pixels. No unverified adapter combination is mandated by this pack.

## Pipeline

1. Import immutable room asset, product references and accepted variant export records into room-service storage.
2. Validate bundle snapshot, supported room, layout version, expected quantities and required images. Require reviewed variant assets for final-candidate mode; research mode remains labelled.
3. Preserve doors, windows and retained objects through explicit protected masks. Confirm image-space placements and viewing geometry. If missing, return needs-input rather than estimating exact geometry silently.
4. Build a render plan containing ordered insertions, source IDs, masks and model-specific controls. Record prompt version and negative constraints; prompts are guidance, not validators.
5. Execute bounded attempts and checkpoint intermediate images. After each stage evaluate preservation and previously inserted products.
6. Save candidates, comparison crops and validation results. Review requires identity, count, colour, perspective and room-preservation checks. If none pass, return a failed quality outcome with evidence.

## Modules and contracts

Domain: RenderPlan, Placement, ProductReference, ExpectedObject, Candidate and Review. Application: ValidateRenderRequest, PlanRendering, GenerateRoom, EvaluateRoom, ReviewRoom. Ports: ImageEditor, AssetStore, JobRepository, RoomValidator and Clock. Adapters hold model pipelines and image processing. No domain imports torch, web frameworks or SQL libraries.

The physical layout comes from recommendation or an explicit manual fixture. Store an image-space bounding region per line item separately from physical coordinates. One product may have multiple expected instances; enumerate instance IDs to support intentional duplication. Record visible, occluded and out-of-frame expectations; hero items required to be visible cannot be excused after generation.

## Agent build order

1. Implement render request validation, imported asset references and immutable input snapshots.
2. Implement render-plan construction with explicit instance IDs, expected quantities and protected room regions.
3. Implement durable job storage and a fake ImageEditor adapter that records the plan and returns deterministic artifacts.
4. Add API endpoints and worker lifecycle using the fake adapter.
5. Implement evaluation records for missing, extra, wrong identity, wrong colour, distorted geometry and altered architecture.
6. Add one-product real-model experiments only after G01/G02 notebook evidence exists.
7. Add bounded multi-product rendering only after one-product identity preservation passes the gate.
8. Add UI adapter support for room uploads, bundle revisions and render candidate/review IDs.

The renderer must not replace selected products, silently drop expected instances, or relabel a plausible concept image as catalogue-grounded. If grounding cannot be proven, the service should return a failed quality outcome with evidence.

## Evaluation and tests

Use designer side-by-side crops of each reference and rendered instance. Record absent, extra, wrong identity, wrong colour, distorted geometry, implausible scale and altered architecture separately. Automated embeddings may assist triage but cannot certify exact identity. Generic detector count is also insufficient for catalogue identity.

Unit tests cover missing reference, mismatched variant parent, unsupported schema, invalid mask coordinates, protected opening overlap, intentional quantity two, duplicate instance IDs, rejected variant import, stale bundle revision, maximum attempts and immutable input snapshots.

Integration tests use fake generation to verify queued lifecycle, partial artifacts on failure, reference import/hash checks, timeout, cancellation and restart. GPU evaluation tests use reviewed scenes and run outside fast CI. Record distributions across seeds; exact bitwise image reproduction is not promised across hardware/library changes.

If neither approach preserves required hero products, stop promotion of grounded rendering. Deliver the measured limitation and use a reviewed compositing prototype or obtain additional product angles/3D assets as a separately scoped path. An appealing concept image is not an acceptable replacement for the agreed grounded deliverable.
