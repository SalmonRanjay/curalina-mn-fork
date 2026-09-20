# Product variant architecture

## Problem and scope

Given one supported product photograph and target colour, alter an approved surface while preserving geometry, texture, perspective and protected pixels. Start with upholstery or painted finishes. The artwork workbook provides no suitable upholstery images; obtain approved product photos before visual experiments. Do not recolour artwork content as a substitute for demonstrating furniture variants.

## Notebook sequence

V01 establishes source-image normalization, manually reviewed masks and a deterministic colour-transfer baseline. V02 compares that baseline with masked SDXL refinement and a Qwen editing candidate. V03 evaluates colour fidelity, protected regions, structural drift and reviewer agreement, then records the selected strategy and failure policy.

Propose 10 products covering light/dark upholstery, fine texture and difficult boundaries, each with three target colours. Split by parent product into six development and four held-out products before tuning. Add transparent, corrupt and very large inputs as negative tests. Small-set results are pilot evidence only.

## Processing specification

Validate MIME from decoded content, pixel limits and ownership. Apply EXIF orientation and convert a derived copy to sRGB. Preserve originals and hashes. Require a product ID and known image licence/provenance.

Obtain an editable-region mask using manual annotation first; optionally test promptable SAM segmentation. A product-wide mask is insufficient if legs, hardware and background must stay unchanged. Save mask revision, coordinate size, protected subregions and human corrections.

Baseline: transform colour inside the mask in a colour space that separates lightness from chroma, preserving shading as far as possible. Assess clipping and dark-to-light failure explicitly. This may be the final implementation for supported products if it outperforms generation.

Diffusion experiment: run SDXL inpainting on a precoloured image with controlled strength and approved mask. Compare to reference-based Qwen edits. Do not assume Qwen exposes the same mask API as SDXL: its adapter must declare supported controls and enforce protected pixels via explicit output compositing where appropriate. Reject shape changes inside the mask; compositing alone cannot restore altered product details.

Composite the original outside the approved mask, allowing only a defined feather band. Save lossless PNG for exact protected-pixel checks. Colour previews are screen approximations, not physical fabric certification.

Create separate candidate records for each colour and attempt. Review approval creates an exportable visual variant, not a new supplier SKU. Failed quality checks leave the candidate rejected or needing review.

## Models and resource boundary

See model selection guide for verified candidates and licences. Use model adapters with `generate(request)` and capability metadata rather than exposing library-specific kwargs through the public API. Load weights once in the worker, pin revisions, and run one job at a time initially. No model download occurs in unit tests or on each request.

## Proposed modules

| Layer | Responsibility |
|---|---|
| Domain | ColourSpec, MaskSpec, VariantCandidate, review and commercial-status invariants |
| Application | ImportAsset, PrepareMask, GenerateVariants, EvaluateCandidate, ReviewCandidate, ExportVariant |
| Ports | Segmenter, ColourTransformer, ImageEditor, AssetStore, JobRepository, ReviewRepository |
| Adapters | Pillow/colour operations, optional SAM, selected diffusion pipeline, filesystem/SQLite |
| Worker | Claims, heartbeats, inference execution, cancellation checks and fenced completion |

Segmentation, recolouring and evaluation remain internal modules, not separate network services. GPU API/worker separation protects request responsiveness without fragmenting domain ownership.

## Agent build order

1. Implement asset import, content hashing, MIME validation, pixel limits and derived sRGB copies.
2. Implement mask records and deterministic mask validation with synthetic images.
3. Implement a pure colour-transfer baseline and protected-pixel checks before diffusion.
4. Implement durable job storage and a fake ImageEditor adapter that returns deterministic tiny images.
5. Add API endpoints and worker lifecycle using the fake adapter.
6. Add manual-review records, export rules and commercial-status invariants.
7. Add optional SAM/diffusion/Qwen adapters only after model selection and hardware gates are recorded.
8. Add UI adapter support for uploaded product assets and reviewed variant IDs.

No agent should treat a generated candidate as approved or purchasable merely because generation succeeded. Approval and commercial availability remain separate state transitions.

## Quality and tests

Measure protected-region changed-pixel fraction outside the feather band, edge/silhouette drift, target-colour error in agreed midtone patches and reviewer ratings for identity and texture. Delta E comparisons require consistent colour conversion and sampled regions; a whole shaded product need not equal a flat swatch. Record target error without claiming a universal perceptual threshold.

Unit tests use synthetic images to verify mask inversion, source/mask size mismatch, alpha behaviour, protected pixel preservation, bad colour codes, all-zero masks, all-one masks when protected regions exist, and parent/variant relationship checks. Mock inference with a fake editor at the port. GPU tests operate separately on fixed real assets.

Service acceptance includes idempotent retry, three requested colours producing distinct linked candidates, missing-asset rejection, worker restart recovery, rejected review preventing approved export, and unchanged upstream commercial status. Never accept a candidate solely because the endpoint returned 200.
