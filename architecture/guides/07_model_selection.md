# Model selection and experiment constraints

Candidate list verified against official model cards on 11 September 2026. This is a bounded shortlist, not a claim to identify the latest or universally best model. Checkpoint revision hashes and installed library versions must be recorded by the team during its first successful local run; no weights were downloaded or benchmarked for this architecture pack.

| Candidate | Proposed role | Verified licence label | Decision |
|---|---|---|---|
| sentence-transformers/all-MiniLM-L6-v2 | Text retrieval comparison against TF-IDF | Apache 2.0 | Initial recommendation embedding candidate |
| facebook/sam2.1-hiera-small | Promptable mask preparation | Apache 2.0 | Optional after manually annotated baseline |
| diffusers/stable-diffusion-xl-1.0-inpainting-0.1 | Masked variant refinement and room harmonization | OpenRAIL++ | First bounded diffusion baseline |
| Qwen/Qwen-Image-Edit-2509 | Product editing and room/reference experiments | Apache 2.0 | Higher-resource comparison candidate |

The Qwen card describes multi-image editing and product consistency improvements, with optimal performance reported for one to three input images. It lists a 20B model. These are publisher statements, not validated Curalina results. Our proposal to use staged insertions is an architectural inference and must be tested.

SDXL's card documents mask-based inpainting. It does not establish exact catalogue-product reproduction. SAM produces masks, not recoloured images or guaranteed material labels. MiniLM supplies semantic representations; its similarity values are not calibrated acceptance probabilities.

## Hardware planning

Run catalogue baselines on CPU. Test segmentation on available hardware separately. For SDXL, budget an NVIDIA GPU experiment environment and start at a modest supported resolution/batch size one; measure actual memory before enlarging. Do not promise compatibility with a particular laptop or GPU memory size without a run.

For a 20B parameter component, 2 bytes per parameter implies roughly 40 GB of weights alone before other components and runtime memory. This is arithmetic, not a measured total VRAM requirement. Qwen may need substantial accelerator/host memory or offloading/quantization. Quantization and offloading are separate experiments with quality and latency measurements. A successful small CPU notebook does not demonstrate local diffusion feasibility.

## Freeze procedure

Record upstream repository, immutable checkpoint revision, licence file hash, dependency lock hash, pipeline class, hardware, precision, quantization, image size, scheduler, steps, guidance, seed and controls. Pin companion encoders/adapters too. Compare models on identical held-out assets and report rejection rate and latency as well as accepted examples. Retain failures to avoid cherry-picking.

Open weights do not mean unrestricted use. Review the selected checkpoint licence and every companion adapter before adopting it; do not assume all models from one publisher share terms. New or substituted candidates require an architecture decision record and the same benchmark.

## Agent model-work rules

Agents may add model adapter interfaces, fake adapters, configuration objects and tests before hardware is available. They may not add a real checkpoint as an accepted implementation until the experiment report records revision, licence, dependency lock, hardware, memory, latency, failure cases and reviewer decision.

A model change is a product decision as well as a code change. Any new candidate must include an ADR, a held-out comparison plan and a rollback path to the previous baseline. Unit and contract tests must continue to run without downloading weights or importing GPU-only libraries at module import time.

## Official references

- [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [SAM 2.1 Small model card](https://huggingface.co/facebook/sam2.1-hiera-small)
- [SDXL inpainting model card](https://huggingface.co/diffusers/stable-diffusion-xl-1.0-inpainting-0.1)
- [Qwen Image Edit 2509 model card](https://huggingface.co/Qwen/Qwen-Image-Edit-2509)

No optional ControlNet, depth estimator or reference adapter is approved merely by mentioning its model family. Verify exact checkpoint compatibility, licence and load path before extending the benchmark.
