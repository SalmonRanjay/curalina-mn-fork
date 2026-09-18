# Architecture decision record

ID: ADR-0008 — Provenance and admissibility of the local supplier image
corpus at `/Users/rjsalmon/Downloads/Supplier Images`, and what it does and
does not unblock for V01
Status: **accepted as a scoped, reversible admissibility ruling.** It
partially unblocks **V01 for variants only**. It does **not** unblock V02,
V03, G01, `OQ-010`, `OQ-011` or `OQ-009`. It does **not** certify the
corpus as a client-supplied asset set.
Owner and reviewer: `tech-lead` (admissibility and boundary call).
**`client` owns the provenance/rights confirmation in "What would make this
authoritative". `ai-ml-lead` owns the V01 methodology reframing this ruling
forces — see "Handed over, not ruled on".**
Date: 2026-09-14

## Context

### What was found, and where

A local, out-of-repo directory `/Users/rjsalmon/Downloads/Supplier Images`
contains four supplier folders. It is not part of this repository, is not
named as an input in `architecture/` or `agentic_flow/`, and will not be
added to the repository. I inspected it directly rather than relying on the
`research-scout` summary, and several of that summary's load-bearing claims
did not survive the check.

Verified inventory:

| Folder | Structure | Verified counts |
| --- | --- | --- |
| `ATRIANI` | 42 product subfolders + `Design 44.xlsx` at folder root | 197 webp, 62 png, 46 jpg, 5 avif |
| `CELADON` | **exactly 62** subfolders, one artwork each | 62 png |
| `LAZZONI` | 33 flat PDFs, no subfolders | 33 pdf |
| `LUXUS` | `Product Images/` → **105** product subfolders | 129 png |

Three corrections to the scan that reached me, each of which changes an
engineering decision:

1. The `.xlsx` is **`ATRIANI/Design 44.xlsx` at the ATRIANI root**, not
   inside `Artigiano Dining Chair`. It was reported as out of scope and
   unread. It is in fact the most important single file in the corpus
   (below).
2. `LUXUS` has **105** product folders, not "~65".
3. **The "per-product folder has a base photo plus matching ground-truth
   swatches" pattern does not generalise.** See "The claim I could not
   confirm".

### `ATRIANI/Design 44.xlsx` — the product-option manifest

One sheet, `design 44 product development`, 128 data rows, 10 columns:
`Name`, `Linl to pictures ` (sic), `Deficiency`, `Finish`, `Price`,
`Overall Length`, `Overall Depth`, `Overall Height`, `Seat Height`,
`Seat Depth`.

The `Linl to pictures` column links rows to image folders, and the linkage
is **exact and total**: 42 distinct values, **42/42 match a real ATRIANI
subfolder byte-for-byte, and all 42 subfolders have at least one row.**
Zero orphans in either direction. This is not an inferred correspondence;
it is a designer-authored manifest of the image tree.

Fill counts across the 128 rows: `Price` 126, `Finish` 123, `Name` 111,
`Overall Length` 111, `Overall Height` 111, `Overall Depth` 109,
`Seat Height`/`Seat Depth` 33 each (seating only), `Deficiency` 26.

Defects, all of which an audit must report rather than silently repair:

- **`Name` is blank on 17 rows** while `Price`/`Finish` are populated —
  the sheet carries multi-option products whose option rows inherit a name
  from a preceding row implicitly.
- **Repeated header rows are embedded in the data.** Several rows literally
  read `Name | Deficiency`, i.e. the sheet has in-band section headers.
- **`Deficiency` is not a deficiency column.** On 11 rows it holds product
  variant names (`Forma 110" Right Hand Sofa`, `Chaise with Left Arm`,
  `59" Organica Coffee Table`). The column name cannot be trusted.
- **Dimensions are decimal inches, not millimetres**, and `/` is used as
  the not-applicable marker. Conversion to the project's integer-millimetre
  invariant needs a stated rounding rule.
- **`Finish` is free text with embedded swatch codes**, e.g.
  `Wing and Headrest: L64, Headboard: ...`, `Top: Spring Falls honed: STQ37`,
  `L92, Rose stainless steel`. There is no delimiter contract. Parsing it
  into `(part, swatch_code)` pairs is not a deterministic operation on this
  data.

### The claim I could not confirm, and actively falsified

The scan reached me arguing that ATRIANI folders pair **a clean base photo
with real ground-truth swatches for that same product**, making them
supervised before/after pairs for colour transfer. That was extrapolated
from one folder (`Artigiano Dining Chair`). I tested it across all 42.

**Test 1 — do image filename codes match sibling swatch filenames?**
3 of 42 folders.

**Test 2 — do image filename codes match the `Finish` codes the manifest
specifies for that product?** **2 of 42 folders** (`Ducci Bed` via `BZ11`;
`Ducci Nightstand` via `L64`). Every other folder's image codes and finish
codes are disjoint, or one side is empty.

Separately, **89 of 197 ATRIANI webp files do not follow the
`{codes}-WB-{n}-{W|P}-{size}.webp` pattern at all** — they are named in
Portuguese by view (`CADEIRA-CIELO-FRONTAL`, `POLTRONA-CIELO-LATERAL`,
`BUFFET-ELIO-VISTA-POSTERIOR`), carrying no finish code whatsoever.

**Conclusion: the corpus supplies real base images to transform. It does
not supply labelled colour-variant pairs.** The product-level mapping
(folder ↔ product ↔ 128 named options ↔ price ↔ dimensions) is complete and
authoritative. The image-level mapping (which *file* shows which colourway)
is absent at 40/42. Any V01 design that assumes supervised pairs is
building on a two-folder sample.

This is the R02 failure mode repeating in a new domain: a reference
methodology assuming a labelled evaluation set that does not exist. Catching
it before dispatch rather than after is the entire point of doing this check.

### Synthetic-image contamination

Filename screening across the whole corpus found two files that are not
supplier photography:

- `ATRIANI/Curva King Bed/ChatGPT-Image-Dec-1-2025-04_28_27-PM.webp`
- `ATRIANI/Bench J/Screenshot-2025-12-04-at-12.46.18-PM.webp`

I opened the first one. **It is an AI-generated image of an upholstered bed
on a near-white background, and at a glance it is not distinguishable from
the genuine studio assets in the neighbouring folders.** It is the only
image in `Curva King Bed` matching the `.webp` extension. A V01 notebook
that globbed `*.webp` would have ingested a generated image as real source
material without any signal that it had done so.

**Filename screening is necessary but not sufficient.** A renamed generated
image is undetectable by the check I ran. I cannot certify that the corpus
is free of synthetic content, and nobody should claim otherwise.

### What the genuine ATRIANI assets actually look like

I opened `ATRIANI/Ducci Bed/BDU1.L25.BZ11.L25-WB-1-W-scaled.webp` (2560×2560)
and `…-WB-2-P-2048x2048.webp` (2048×2048). Both are clean, full-product,
pure-white-background studio assets; `-W-` is the front elevation and `-P-`
a perspective view of the same product and finish. Background is uniform
enough that an alpha matte is obtainable by thresholding, with no
segmentation model required.

They read as high-quality CGI renders rather than camera photographs
(uniform lighting, no sensor noise, geometrically perfect edges). I am not
certain of that and it is not decisive for admissibility, but it is decisive
for a claim nobody should make: **evidence that a colour-transfer baseline
works on these assets is not by itself evidence that it works on camera
photographs.** If the shipping product ever ingests real photos, V01's
result has to be re-established on real photos.

### Why this is a WordPress media-library shape, and why that matters

The suffixes present across the corpus are `-scaled` (42 files),
`-2048x2048` (102), `-150x150` (32), `-1536x1536` (1), `-768x768` (1).
These are WordPress's generated thumbnail sizes, not a photographer's
delivery convention. Combined with the Portuguese view-name filenames, the
most economical reading is that this is a **scrape or export of a supplier's
public website media library**, not an asset pack delivered to Curalina.

That reading is unconfirmed, and it is not mine to confirm. But it is what
makes the usage-rights question in this ADR a real question rather than a
formality, and it is why the 32 `-150x150` files exist at all — they are
thumbnails of images already present at full size, and are worthless for
colour work.

### The other three folders

- **CELADON — excluded.** Exactly **62** subfolders, each a framed
  decorative print. The count matches `OQ-011`'s "the only supplied
  catalogue is 62 artwork records" precisely. This is near-certainly that
  already-known artwork set resurfacing, not new data. Not furniture, not
  upholstery, no bearing on V01.
- **LAZZONI — not cleared for V01.** 33 flat PDFs. The embedded photography
  is lifestyle/in-situ (staged rooms, sometimes with people), which is the
  wrong background condition for colour transfer. The structured spec
  content (dimensions, materials, model numbers) is a *recommendation*-side
  question about `OQ-009`, not a variants question, and is out of this
  ADR's scope.
- **LUXUS — admitted, but deferred.** 105 product folders, 129 images:
  **90 products have exactly one image**, 9 have two, 4 have three, 1 has
  four, 1 has five. Real studio-background photography, but one appearance
  per product — a breadth pool of distinct products, not a colourway set,
  and with no manifest equivalent to `Design 44.xlsx`.

## Options

**Option A — Admit the whole corpus as supplied product photography and
start V01 against all of it.** Cheapest, and wrong twice over. It would
promote a locally-downloaded directory of what look like supplier marketing
assets to sanctioned client input with no rights position, and it would
ingest at least one known AI-generated image as real source material. The
second failure is unrecoverable after the fact: a V01 decision record citing
a generated bed as evidence cannot be repaired by later noticing.

**Option B — Treat the corpus as non-existent until the client confirms
identity and rights.** V01 stays fully blocked as it has been since the
pack was written. Safest-sounding and wrong for the same reason Option B was
wrong in `ADR-0005`: V01's blocker is "no real product photos exist
anywhere". Real, usable, white-background product assets demonstrably now
exist on this machine. Refusing to run the baseline produces no evidence,
and the run itself is the artefact that tells the client what a confirmed
asset delivery would need to contain.

**Option C — Admit the corpus as a client-supplied catalogue, using
`Design 44.xlsx` as a third supplier's product data.** Rejected, out of
scope, and a boundary violation: this is a variants admissibility question,
and `OQ-011` is `owner: client`. `Design 44.xlsx` being a third supplier
outside the Four Hands / Moe's workbook is a genuine finding for
recommendation, and it is handed over below rather than ruled on here.

**Option D (chosen) — Split by what the data can actually bear, exactly as
`ADR-0005` split R01 from R03.** Admit ATRIANI as an **unlabelled base-image
source** for a first V01 run, under a named exclusion list and a pinned
manifest. Reject the supervised-pair claim outright. Keep V02, V03 and
everything room-side blocked.

## Decision and rationale

### 1. V01 may proceed against ATRIANI, as an unlabelled base-image source. Approved.

`agent_instructions/02_variant_generator_service.md` lines 64–72 block V01
on "no upholstery/product images" and forbid substituting stock or
placeholder imagery. That blocker is now **partially retired, on evidence**:
real, full-product, uniform-white-background furniture assets at 2048–2560px
exist for ~42 products across 42 folders, with a complete
manifest-to-folder linkage.

V01 proceeds under five mandatory conditions:

1. **Scope every finding to the corpus, never to "Curalina's product
   photos"** — same discipline `ADR-0005` imposed on R01. The wording is in
   "Provenance caveat" below.
2. **Explicit allowlist, never a glob.** The notebook constructs its input
   set from `ATRIANI/Design 44.xlsx`'s `Linl to pictures` column, then
   filters files. It must not `glob("**/*.webp")`.
3. **Hard exclusions, enforced in code and reported as counts:**
   - `ATRIANI/Curva King Bed/ChatGPT-Image-Dec-1-2025-04_28_27-PM.webp`
   - `ATRIANI/Bench J/Screenshot-2025-12-04-at-12.46.18-PM.webp`
   - every file whose name matches `-150x150` (32 files; thumbnails)
   - any file matching `(?i)chatgpt|screenshot|midjourney|dall-?e|generated`
   Note that `Curva King Bed` has no other webp; **excluding the generated
   file drops the folder entirely**, and the notebook must report that as a
   dropped product rather than substituting a different file.
4. **Every input image is eyeballed before use.** With 42 folders this is
   feasible and it is the only control that catches a *renamed* generated
   image. The notebook records a per-file accept/reject with a human
   reviewer, not an automated pass. This is a deliberate manual gate, not a
   process failure.
5. **Pin the corpus.** Record the sha256 of `Design 44.xlsx` and of every
   admitted image in the run manifest. The directory is outside version
   control on one machine and can change without a trace; without hashes
   a second run is not comparable to the first.

### 2. The supervised-pair claim is rejected. V01 gets no ground-truth colour variants.

2 of 42 folders is a coincidence, not a pattern. No V01 artefact may
describe this corpus as providing before/after pairs, reference variants,
or ground truth for colour accuracy. The manifest's `Finish` column
describes **which colourways the product is offered in**; it does not
describe **which colourway any given image depicts**, and 89 of 197 ATRIANI
webp files carry no finish code at all.

Two consequences follow and both are binding:

- A V01 metric of the form "how close is our generated variant to the true
  variant" **cannot be computed on this corpus.** Any notebook reporting
  such a number has fabricated the reference.
- The swatch files (`BZ11.jpg`, `L64.png`, …) are a legitimate source of
  **target colours to transfer toward**. They are not a source of **target
  renderings to compare against**. Those are different things and the
  distinction is the whole ruling.

### 3. LUXUS is admitted but deferred. LAZZONI and CELADON are not cleared.

LUXUS's value is breadth — 105 distinct products, 90 with exactly one image
— which makes it a good **held-out generalisation set** for a baseline
already established on ATRIANI, and a poor starting set (no manifest, no
swatches, one appearance per product). Do not use it in the first V01 run.
Its admissibility for a second run is pre-approved under the same five
conditions above, with the exclusion list re-derived rather than reused.

LAZZONI is not cleared for V01: lifestyle backgrounds are the wrong input
condition, and nothing in this ADR authorises extracting its spec data.
CELADON is excluded outright.

### 4. Boundary: this corpus is notebook-scope input, not service-runtime input.

**The variants service must not read this directory at runtime, and must
not gain a setting that points at it.**

`CURALINA_DATA_DIR` already exists in all three services
(`ai_services/variant_generator/src/curalina_variants/settings.py:11`,
and the recommendation and rooms equivalents) and `ai_services/suite_client.py:150`
sets it per-service. It denotes the **service's own mutable working
directory** — the SQLite file lives under it. Pointing it at a read-only
external supplier corpus would conflate service-owned state with external
source data and give the deployed service a filesystem dependency that
appears in no contract. The variants HTTP API already takes asset bytes on
upload; that is the sanctioned path for images to enter the service.

If the V01 notebook needs a configurable root, it introduces its own
**notebook-scope** variable — `CURALINA_SOURCE_ASSETS_DIR` — resolved in
the notebook, never read by `curalina_variants` runtime code, and never
added to `Settings`. No file is copied into the repository.

### Handed over, not ruled on

Three findings belong to other roles. I am recording them and gating the
dependent work on them; I am not deciding them.

- **`ai-ml-lead` — V01's evaluation methodology must be reframed before the
  run, not after.** With no ground-truth variants, "V01 established,
  protected-pixel checks pass" (`agentic_flow/variant_generator_workflow.md:13`)
  has to rest on properties computable without a reference: protected-pixel
  invariance, geometry/texture preservation outside the mask, and whether
  the transferred region lands on the intended swatch colour in LAB. Whether
  that constitutes an accepted baseline is `ai-ml-lead`'s call under the
  stage gates, not mine. **V01 must not be dispatched until that reframing
  exists in writing** — this is the same pre-dispatch discipline that
  produced the `ADR-0006` chain.
- **`client` / `OQ-011` — `Design 44.xlsx` is a third supplier's product
  data.** 42 products, 128 options, prices, and dimensions for a supplier
  absent from the Four Hands / Moe's workbook `ADR-0005` ruled on. It
  contains no rugs and no lighting either, so it does not change `OQ-011`'s
  substance, but it does mean the client's supplier set is wider than the
  project currently records. `OQ-011` stays `open`, `owner: client`.
- **`ai-ml-lead` / `design_authority` — `OQ-009` is untouched.** The
  `Finish` free text is supplier finish naming, not `material_class`,
  `gloss_level` or `undertone_temperature`. Inferring those from
  `Spring Falls honed: STQ37` would be exactly the guessed default the
  project forbids.

### What would make this authoritative

A `client` confirmation must establish all five before this corpus is
treated as a sanctioned asset set rather than found material:

1. **Identity.** Is this the current supplier photo set, a point-in-time
   download, or working material? The WordPress thumbnail suffixes and
   Portuguese view names suggest a website export; confirm or correct that.
2. **Usage rights.** These appear to be *supplier marketing assets*, not
   Curalina-owned or customer-owned photography. Confirm Curalina may
   derive, store and display transformed versions. This is the question
   with the longest tail: a V01 result is cheap to redo, a shipped feature
   built on unlicensed imagery is not.
3. **Synthetic content.** Was any AI-generated imagery deliberately placed
   in these folders, and if so which files? I found two by filename and
   cannot certify there are no others. Only the client can answer this
   definitively.
4. **Colourway coverage.** Does a per-image colourway label exist anywhere
   (a supplier PIM, a filename convention I have not decoded, a second
   sheet)? If yes, the supervised-pair rejection above reverses and V01's
   methodology improves substantially.
5. **Sanctioned delivery path.** Where will product assets be delivered for
   the new services? `~/Downloads` must not become that path by default,
   the way `attached_assets/` must not (`ADR-0005`, item 4).

Items 2 and 3 are the ones that could invalidate a V01 run outright. Item 4
is the one that would change its methodology.

## Consequences and reversal

### Consequences

- V01 is no longer blocked on image availability. It is now blocked on
  `ai-ml-lead`'s reference-free evaluation design. That is a different and
  more tractable blocker, and that substitution is the main value of this
  ADR.
- **V02 and V03 stay blocked.** V02 compares diffusion refinement against a
  V01 baseline that does not yet exist; V03 depends on V02. Nothing here
  touches them.
- **Room generation is untouched and the framing must be corrected wherever
  it appears.** This corpus is furniture **product** photography. G01 is
  room prep and homography from a **customer room** photograph, and
  `OQ-010` (`ROOM_GEOMETRY_SOURCE`, `owner: design_authority + client`,
  `status: open`) blocks certified room-scale claims. Product photos supply
  no room geometry, no camera pose and no scale reference. **G01 is exactly
  as blocked today as it was yesterday.**
- **There is, separately, a real downstream connection to rooms, and it is
  not a substitute for the above.**
  `agentic_flow/14_room_generation_technical_design.md:58` calls
  `load_cutout(placement.variant_id or placement.product_id)` — the
  composite-then-harmonize path needs a per-product cutout, optionally the
  *variant* output of the variants service. ATRIANI's uniform white
  backgrounds are the best cutout source in the project so far, and
  thresholding gets an alpha matte without a segmentation model. That is a
  genuine future dependency in the chain
  `ATRIANI base image → V01 colour transfer → cutout → rooms composite`.
  It is downstream of G01 and does not advance it.
- The `-150x150` exclusion costs 32 files; the synthetic exclusion costs
  2 files and one whole product folder (`Curva King Bed`). Working set is
  roughly 163 ATRIANI images across 41 folders before manual review.
- No repository file gains a dependency on an absolute path under
  `/Users/rjsalmon/Downloads`. If the directory disappears, nothing in the
  repository breaks; only the V01 run becomes unreproducible, which is why
  hashes are mandatory.
- `agentic_flow/open_questions.yaml` is **not edited by this ADR.** V01's
  photo gap was never an `OQ-xxx` — it is a data-sourcing blocker tracked in
  `agent_instructions/STATUS.md`, and that is where its state change is
  recorded.

### Reversal

- **If the client says this is unlicensed or not the current set:** the V01
  run is retained as a methodology artefact — the reference-free evaluation
  design transfers to any future corpus — but no V01 acceptance claim
  survives, and no derived image may be stored or shown. Cost is one
  notebook run. The scoping caveat below is what makes this cheap.
- **If the client supplies per-image colourway labels:** the supervised-pair
  rejection in section 2 reverses. Re-run V01 with reference-based metrics
  and supersede this ADR's section 2 with an amendment naming it, not a
  rewrite.
- **If more synthetic images are found among the admitted set:** every V01
  finding computed over the contaminated set is void and the run repeats.
  This is why condition 4 (manual per-file review) is mandatory rather than
  advisory.

### What would prove this decision wrong

- **A per-image colourway label source turning up** — then rejecting the
  supervised-pair framing was over-cautious, though rejecting the
  *two-folder inference* still was not.
- **Evidence these are camera photographs, not renders** — then the
  render/photo caveat is unnecessary and V01's result generalises further
  than I have allowed.
- **Evidence the corpus was delivered through a sanctioned client channel**
  (a supplier portal, a signed asset-transfer note) — then Option A was
  closer to right, and the remaining constraint is the synthetic-content
  exclusion alone.
- **A V01 run that passes protected-pixel checks on ATRIANI and fails on
  LUXUS** would show the ATRIANI assets' uniformity was doing the work, and
  that the baseline is not established at all. This is the single cheapest
  falsification available and is why LUXUS is pre-approved as a held-out
  set rather than discarded.

## Verification

### Provenance caveat V01's decision record must carry

> The image corpus used here is `/Users/rjsalmon/Downloads/Supplier Images`,
> a local out-of-repository directory. It is not named as an input in
> `architecture/` or `agentic_flow/`, arrived with no submission note,
> version marker or rights statement, and has **not** been confirmed by the
> client as the current supplier asset set (see ADR-0008 for the five points
> a client confirmation must establish, of which usage rights and synthetic
> content are the two that could void this run). Its file-naming carries
> WordPress thumbnail suffixes and Portuguese view names, consistent with a
> website media-library export rather than a delivered asset pack. **At
> least one AI-generated image was found inside it** and excluded by name;
> filename screening cannot certify that no others remain, so every admitted
> image in this run was additionally reviewed by a human and logged. The
> corpus provides **unlabelled base images only** — the folder-to-product
> manifest is complete (42/42), but image-to-colourway labelling exists for
> 2 of 42 folders, so no reference-based colour-accuracy metric is
> computable and none is reported. The admitted assets read as CGI renders;
> results here do not transfer to camera photography without re-establishment.
> Every finding describes *this corpus*, not "Curalina's product photos".
> This notebook does not bear on `OQ-009`, `OQ-010` or `OQ-011`, none of
> which it changes, and it does not unblock V02, V03 or G01.

### Checks that verify this ADR's factual claims

All reproducible against `/Users/rjsalmon/Downloads/Supplier Images`;
`Design 44.xlsx` checks via `openpyxl(read_only=True, data_only=True)`.

- `ATRIANI` has 42 product subfolders plus `Design 44.xlsx` at its root.
- `Design 44.xlsx` sheet `design 44 product development`: 128 data rows,
  10 columns, header on row 2.
- `Linl to pictures ` has 42 distinct values; **42 match an ATRIANI
  subfolder exactly; 0 orphans in either direction.**
- Fill counts: `Price` 126, `Finish` 123, `Name` 111, `Overall Length` 111,
  `Overall Height` 111, `Overall Depth` 109, `Seat Height` 33,
  `Seat Depth` 33, `Deficiency` 26.
- 197 ATRIANI webp; **89 do not match `^(.*?)-WB-(\d+)-([A-Z]+)-`**; of
  those that do, 92 carry `-W-` and 16 `-P-`.
- **Image-filename finish codes intersect the manifest's `Finish` codes in
  2 of 42 folders** (`Ducci Bed`/`BZ11`, `Ducci Nightstand`/`L64`).
- **Image-filename codes intersect sibling swatch filenames in 3 of 42
  folders.**
- Corpus-wide WordPress size suffixes: `-2048x2048` 102, `-scaled` 42,
  `-150x150` 32, `-1536x1536` 1, `-768x768` 1.
- Filename regex `(?i)chatgpt|screenshot|midjourney|dall-?e|generated`
  matches exactly 2 files, both under `ATRIANI`.
- `CELADON` has exactly **62** subfolders.
- `LUXUS/Product Images` has **105** subfolders and 129 images;
  images-per-product distribution `{1: 90, 2: 9, 3: 4, 4: 1, 5: 1}`.
- `LAZZONI` is 33 flat PDFs with no subfolders.
- `curalina_data_dir` is declared at
  `ai_services/variant_generator/src/curalina_variants/settings.py:11` and
  set per-service at `ai_services/suite_client.py:150`; no
  `CURALINA_SOURCE_ASSETS_DIR` exists anywhere in the repository today, and
  this ADR does not add one.
- `agentic_flow/14_room_generation_technical_design.md:58` contains
  `cutout = load_cutout(placement.variant_id or placement.product_id)`.

No approval record exists for this ADR; it is a `tech-lead` admissibility
and boundary call pending the client confirmation above, and pending
`ai-ml-lead`'s V01 methodology reframing before any V01 dispatch.
