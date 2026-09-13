# Architecture decision record

ID: ADR-0005 — Provenance and admissibility of the Four Hands / Moe's
combined product workbook found in `attached_assets/` (OQ-011, OQ-009)
Status: **accepted as a scoped, reversible admissibility ruling.** It
resolves OQ-011 **partially and for R01 only**. It does **not** resolve
OQ-011 for R03, and does **not** touch OQ-009. Neither `OQ-011` nor
`OQ-009` is closed by this ADR; both stay `open` with their existing
owners (`client` and `design_authority` respectively).
Owner and reviewer: `tech-lead` (admissibility call). **`client` owns the
provenance confirmation described under "What would make this
authoritative"; `design_authority` owns OQ-009.**
Date: 2026-09-13

## Context

### What was found, and where

`attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`
(and two near-identical siblings, `…_1762332689675.xlsx` and
`…_1762391359242.xlsx`) is a single-sheet workbook of **385 non-empty data
rows × 36 columns** of real furniture product records from two suppliers
(Four Hands, 271 rows; Moe's Home, 114 rows), stitched together from 11
named supplier source sheets.

Two further files in the same folder are directly relevant:

- `attached_assets/Quiz and Product Mapper file instruction_1762400632880.xlsx`
  — a **designer-authored controlled vocabulary** (sheets `SUB-CATEGORIES`,
  `Design Style Definitions`, `Tags`) enumerating the canonical Rooms (6),
  Design Styles (6), Storage Solutions (7), functional Key Features (18),
  Furniture Categories (31) and Tags (26). This is the taxonomy the
  product workbook is evidently *meant* to conform to.
- `attached_assets/Four Hands Accent Chairs_1763831596643.xlsx` — a
  separate 28-column single-supplier sheet, not merged into the combined
  workbook.

I inspected the combined workbook directly with `openpyxl` rather than
relying on the discovering agent's summary. That summary was accurate as
far as it went; the material findings below are ones it did not surface.

### Location is the problem

`attached_assets/` is the **existing TypeScript/Express monolith's upload
and attachment folder**, not a sanctioned input path for the new Python AI
services. Its neighbours are a Replit-style scrape of a working session:
compressed homepage PDFs, screenshots, dozens of `Pasted-*.txt` files
containing raw server logs, stack traces and ChatGPT-style prompt drafts.
Every file carries a millisecond upload-timestamp suffix. Nothing in
`architecture/` or `agentic_flow/` names this folder as an input. **All
files in it share an `Aug 10 11:34` mtime** (a bulk copy), so filesystem
metadata carries no information about when the workbook was actually
produced or by whom — the embedded timestamps (Nov 2025) are the only
dating signal, and they are client-side upload times, not authorship.

That is the entire provenance basis available: a real-looking workbook in
a scratch folder, with no accompanying submission note, no version marker,
and no statement of whether it is the live product set, a stale export, or
working material.

### What the data actually looks like

Positives — this is unambiguously real furniture, not synthetic fixture
data:

- Real categories relevant to the living-room pilot: Sofa ×21,
  Sectional ×7, Dining Chairs ×94, End Table ×84, Nightstand ×84,
  Dresser ×47, Console Table ×41, Dining Table ×37, Bed ×32.
- `Retail Price` filled on 385/385 (integer dollars); `Trade Price` filled
  on 385/385 once the two supplier-specific trade-price columns are
  unioned (109 + 276).
- A width×depth×height string present on **385/385** rows, all parsing to
  at least three numerics, once the two supplier-specific dimension
  columns are unioned (Moe's col 11, 84 rows; Four Hands / remaining Moe's
  col 29, 301 rows).
- `Inventory` integer on 385/385; `Supplier`, `SKU`, `Product Name`,
  `Overview`, `Furniture Category`, `Room Type`, `Design Style`,
  `Storage Solutions`, `Tags` filled on 385/385.

Defects — every one of these is exactly what an R01 catalogue audit exists
to find, and they are severe enough that this workbook cannot be treated
as a clean import source:

1. **The merge is unnormalized.** Six header names occur twice, because
   two supplier schemas were concatenated side by side rather than
   reconciled: `Trade Price` (cols 4, 28), the dimension column (11, 29),
   `Weight (lbs)` (17, 30), `Key Features` (9, 34), `Colour` (18, 35), and
   three separate material columns (`Product Material` 19, `Material` 31,
   `Product Materials` 33). Fill counts are complementary by supplier, so
   the union is recoverable — but only by a supplier-aware reader.
2. **42 duplicate `(supplier, SKU)` compound keys.** All 42 are Moe's
   Home rows appearing twice. Diffing a duplicate pair shows the rows are
   byte-identical **except for `Source File`** — one copy labelled
   `Four Hands Coffee Tables.xlsx`, the other
   `Moes Home Accent and Side Tables.xlsx`. So the true distinct-product
   count is ~343, not 385, and the merge double-ingested one Moe's sheet.
3. **`Source File` is unreliable provenance metadata.** 42 Moe's Home
   products are labelled as sourced from `Four Hands Coffee Tables.xlsx`,
   and `Four Hands_Moes Home Beds.xlsx` mixes both suppliers. The column
   cannot be used to attribute a row to a supplier or to a snapshot.
4. **The workbook violates its own accompanying taxonomy.** `Coffee
   Table` is a canonical category in the mapper file; **zero rows use
   it.** All 42 rows whose `Source File` says "Coffee Tables" are
   categorised `End Table, Nightstand`. Free-text drift is pervasive
   elsewhere: `Room Type` contains `Living room`/`Living Room`,
   `Home office`/`Home Office`, `entryway`; `Design Style` contains
   `Warm Transittional`, `Midcentury Scandi`, `Mid-Century Scandinavian`
   and `Contemporary Lux`/`Contemporary Luxe` as distinct strings, plus
   room names and category names leaking into the style column; `Tags`
   contains `Everyday Elegence/Gracious`, `Everyday Elegiance/Gracious`,
   `I love patters`, `Family Gatherinegs/ Humble`, and rows where the
   whole tag list is one semicolon-delimited string rather than
   comma-delimited.
5. **At least one junk row.** `Miri Large Shelf Brown` (`ER-1073-03`) has
   `Furniture Category` = `Final CSV-Ready Summary` — a spreadsheet
   artefact written into a data cell.
6. **`LEAD Time` is not a lead time.** It holds `datetime` values
   (e.g. 2025-11-03) on only 65/385 rows — a date, not a duration.
7. **`Delivery Options`, `Delivery Location`, `Delivery Policy` are
   0/385 empty.** Commercial availability cannot be derived from this
   workbook.
8. **No image, photo or asset URL column exists** in any of the 36
   headers. This workbook is silent on variants' photo blocker; that
   blocker is untouched.
9. **No rugs and no lighting.** Zero rows in any lighting category,
   despite the mapper taxonomy defining `Table Lamp`, `Floor Lamp`,
   `Pendant Light`, `Chandelier Light`, `Light Sconce`. Zero rugs — the
   taxonomy does not even define a rug category. No `Accent Chair`,
   `Ottoman` or `Swivel Chair` rows either (the unmerged
   `Four Hands Accent Chairs` sheet exists separately).

### Why this needs an ADR rather than an engineer proceeding

`OQ-011` (`rule_blocked: FURNITURE_CATALOGUE_EXISTENCE`, `owner: client`,
`status: open`) states "The only supplied catalogue is 62 artwork
records" and blocks `[R03 composition, all room generation]`. If this
workbook counts as a supplied furniture catalogue, that statement is
factually stale and a blocking question changes state — which is a
client-owned decision, not an engineer's. But the workbook's location and
defects mean it cannot simply be waved through either. The honest answer
is different for R01 and R03, which is precisely why this is a ruling and
not a status update.

## Options

**Option A — Treat the workbook as a supplied furniture catalogue.**
Declare OQ-011 satisfied, unblock R01 and R03, build the real importer
against it. Cheapest. Wrong: it silently promotes a file from the legacy
app's scratch folder to authoritative client input, and it would let R03
compose bundles against a set with no rugs, no lighting, no accent chairs
and a ~11% duplicate rate. If the workbook later turns out to be a stale
or partial export, every R03 finding built on it is invalidated with no
marker saying which.

**Option B — Treat it as non-existent until the client confirms.**
Keep OQ-011 fully blocking; R01 waits. Safest-sounding, and wrong for a
different reason: R01's entire job is to audit a real supplier workbook
and enumerate its gaps. Refusing to audit the one real workbook in the
repo because its provenance is unconfirmed produces no evidence at all,
and the audit is itself the artefact that would let the client answer the
provenance question quickly. It also violates the project's own posture —
the correct output of an undefined input is a documented blocked-input
escalation with evidence attached, not indefinite silence.

**Option C (chosen) — Split the ruling by what each consumer needs.**
Admit the workbook as a **labelled real-but-unconfirmed-provenance input
for R01 only**, because R01 consumes a catalogue *as an object of audit*
and its output is a findings document, not a product decision. Keep R03
blocked, because R03 consumes a catalogue *as a source of truth about what
can be bought and placed*, and this workbook demonstrably cannot bear
that weight (no lighting, no rugs, no delivery data, unreliable source
attribution).

## Decision and rationale

### OQ-011, for R01 (catalogue audit notebook): **satisfied for the
purpose of proceeding. R01 may proceed against this workbook now.**

R01's deliverable is an audit: what does a real supplier workbook contain,
what is missing, what must be normalized, what cannot be derived. That
deliverable is *more* valuable, not less, against a workbook with the
defects catalogued above — a clean file would teach the importer nothing.
Provenance uncertainty degrades a *decision* built on the data; it does
not degrade a *description* of the data, provided the description says
plainly what it was describing and that its provenance is unconfirmed.

R01 proceeds under two conditions, both mandatory:

- Every R01 finding is scoped to "the workbook at
  `attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`,
  md5 prefix `3ad1f5d7`, 385 rows × 36 cols", never to "the Curalina
  catalogue".
- R01's own decision record carries the provenance caveat specified
  below, verbatim in substance.

Use the `…_1762391396825.xlsx` copy. `…_1762391359242.xlsx` is
byte-identical to it; `…_1762332689675.xlsx` differs in bytes but its
cell contents are identical (same 386-row value hash), so it is an
earlier save of the same data and choosing between them is immaterial —
but pin one and record the hash so a later re-run is comparable.

### OQ-011, for R03 (bundle composition): **not satisfied. R03 stays
blocked, and `OQ-011` stays `open`.**

OQ-011 names "sofas, tables, beds, rugs and lighting". Sofas, tables and
beds are present. **Rugs and lighting are entirely absent — zero rows,
despite lighting being a defined category in the client's own taxonomy.**
A bundle composer that cannot place a rug or a light source in a living
room is not exercising material ratios or the spatial engine on real
data; it is exercising them on a subset chosen by whichever supplier
sheets happened to get merged. Add the missing delivery/availability
columns and the unreliable `Source File` attribution, and R03 would be
composing commercially unbuyable bundles from an unattributable set.
This is the "invent a number rather than escalate" failure mode in
catalogue form, and the answer is no.

R03 remains blocked on OQ-011 exactly as recorded. The finding to
communicate to the client is narrower and more actionable than before,
which is the real value of this ADR: OQ-011 is no longer "we have no
furniture at all", it is **"we have ~343 distinct case goods, seating and
tables across two suppliers; we have zero rugs, zero lighting, zero
accent chairs, and zero delivery/availability data."**

### OQ-009 (attribute completeness): **unchanged. Not resolved, not
advanced.**

I checked this independently rather than accepting the referring agent's
inference, and confirm it. None of OQ-009's six named attributes appears
as a column in the workbook's 36 headers, and none appears as a defined
term in the mapper file's controlled vocabulary either:

| OQ-009 attribute | In workbook? | In mapper taxonomy? |
| --- | --- | --- |
| Edge geometry (curved vs straight) | No | No |
| Leg style and height | No | No |
| Material class (anchor / feature / comfort) | No | No |
| Gloss level | No | No |
| Undertone temperature | No | No |
| Performance-fabric flag | No | No |

The nearest signals are traps, and R01 should name them as such: the
`Tags` vocabulary contains material-flavoured tokens
(`Velvet/Brass/Smoked Glass`, `White Oak/Linen/Travertine`,
`Satin/Metallics`) but these are **style-tag bundles applied at product
level, not per-product material attributes** — a product tagged
`Velvet/Brass/Smoked Glass` is not thereby known to be velvet. Likewise
the three free-text material columns (`Solid Walnut`, `Oak Veneer`,
`50% Recycled Polyester, 50% Polyester, Iron, Solid Ash`) are supplier
marketing strings, not a material *class* in the anchor/feature/comfort
sense the rules engine needs. Inferring `material_class` or
`undertone_temperature` from them would be exactly the guessed default the
project forbids.

So OQ-009 stays `open`, `owner: design_authority`, severity `blocking`,
and every style rule that filters on product attributes stays blocked
regardless of what happens to OQ-011.

### What would make this authoritative

A `client` confirmation must establish all five of the following before
this workbook is treated as an authoritative catalogue input rather than
an audit subject:

1. **Identity.** Is this the live product set Curalina is selling from,
   a point-in-time export, or working/test material a developer was using
   to exercise the legacy importer? The legacy-app log files in the same
   folder reference catalogue import errors, which is consistent with
   either reading.
2. **Currency.** As of what date are prices, inventory counts and
   supplier ranges accurate? `Inventory` is an integer on every row with
   no timestamp; treating it as current is unsafe.
3. **Completeness of intent.** Were rugs, lighting and accent chairs
   deliberately out of scope for this merge, or lost in it? The separate
   unmerged `Four Hands Accent Chairs` sheet suggests the latter is at
   least possible.
4. **Sanctioned path.** Where will catalogue workbooks be delivered for
   the new services? `attached_assets/` must not become that path by
   default. Until a path is named, the importer has no stable contract.
5. **Duplicate semantics.** Are the 42 repeated `(supplier, SKU)` pairs a
   merge error (my reading, given the rows differ only in `Source File`)
   or an intended variant relationship? `03_data_contracts.md` rejects
   duplicate compound keys "unless explicit variant relationship", so the
   importer's behaviour depends on this answer.

Items 1, 3 and 5 are the ones that would change an R01 finding. Item 4 is
the one that changes the importer's design.

## Consequences and reversal

### Consequences

- R01 may start now; it is no longer blocked. STATUS.md's note that R01
  "may be blocked" is superseded for R01 specifically.
- R03 is unchanged and still blocked. Do not let R01 completing be read
  as R03 unblocking.
- Room generation is still blocked by OQ-011 as written (`blocks:`
  includes "all room generation"), for the same rug/lighting/availability
  reasons.
- Variants' photo blocker is untouched. This workbook has no image column
  of any kind; nobody should cite it as progress there.
- **A structural mismatch surfaces for the importer, which R01 must
  report and which I am not deciding here:**
  `CatalogueSnapshot` in
  `ai_services/recommendation/src/curalina_recommendation/domain/catalogue.py`
  carries a single `supplier_id` for the whole snapshot, but this workbook
  is two suppliers in one file. Either the importer emits one snapshot
  per supplier (my expected answer, and it costs nothing today), or
  `CatalogueSnapshot` needs an additive change. R01 should state which,
  with evidence; a contract change would then come back to me.
- `agentic_flow/open_questions.yaml` is deliberately **not edited by this
  ADR.** OQ-011 is `owner: client` and I do not close client-owned
  questions. When the client confirms items 1–5, the appropriate edit is
  to OQ-011's `question:` text — replacing the now-stale "the only
  supplied catalogue is 62 artwork records" with the accurate gap
  statement above — while leaving `status: open` until rugs, lighting and
  availability data actually arrive. Whoever implements next should make
  that edit pointing at this ADR, not close the question.

### Reversal

This ruling is cheap to reverse in either direction and both directions
are pre-specified:

- **If the client says this is test/stale data**: R01's findings are
  retained as an audit of *a* supplier export (still useful — the merge
  and taxonomy-drift defects are almost certainly properties of the
  export pipeline, not of this one file), but no importer behaviour may
  be derived from its specific values. Nothing else needs unwinding,
  because the caveat below is attached to every finding.
- **If the client confirms this is the live set and supplies rugs +
  lighting + availability**: R03 unblocks by a second ADR or by OQ-011
  being closed by its owner. No R01 work is wasted.

### What would prove this decision wrong

- Evidence that `attached_assets/` *is* a sanctioned client submission
  path (a client-facing upload feature in the legacy app writing here
  would establish that) — then Option A was closer to right, and R03's
  block rests on the rug/lighting gap alone rather than on provenance
  plus the gap.
- Evidence that rugs and lighting were never in MVP scope — then R03's
  block on this workbook is weaker than stated and should be re-argued.
  Note this interacts with OQ-012 (`GENERATED_ARCHITECTURE_SCOPE`), which
  is also open and also client-owned.

## Verification

### Column-to-field mapping R01 must audit against

R01 should verify the following mapping and report every place it fails,
rather than assume it holds. Columns are zero-indexed on `Sheet1`.
Note `Product` currently has no field for the style/tag/feature columns —
that is correct for today (OQ-009 blocks them) and R01 should record them
as *present in source but deliberately unmapped*, not as unused.

| `Product` / `CatalogueSnapshot` field | Source column(s) | Transform and hazard |
| --- | --- | --- |
| `key.supplier_id` | 2 `Supplier` | Two values only (`Four Hands`, `Moes Home`). **Do not use col 27 `Source File`** — it misattributes 42 rows. |
| `key.raw_sku` / `normalized_sku` | 3 `SKU` | 343 distinct of 385; NFKC + whitespace normalization already handled by `ProductKey.build`. 42 duplicate compound keys will raise `DuplicateProductKeyError` — this is correct behaviour and R01 must report the count, not suppress it. |
| `product_id` | derived | Not in source. Importer must mint it; R01 should state the scheme it recommends. |
| `name` | 0 `Product Name` | 385/385; 342 distinct (duplicate-row artefact). |
| `category` | 6 `Furniture Category` | Comma-delimited multi-value, so a row maps to *several* categories — `Product.category` is a single string, so the importer needs a primary-category rule. **Unresolved by the data**: zero rows use `Coffee Table` despite the taxonomy defining it. One junk value (`Final CSV-Ready Summary`). Two rows blank → `__post_init__` will raise. R01 must recommend a rule; it must not invent a default silently. |
| `price` (`Money`, `Decimal`) | 5 `Retail Price`; trade = union of 4 and 28 | Integers, no currency column and no decimal component. Assume CAD only if the client confirms; otherwise this is a `needs_input`. Convert via `Decimal(str(v))`, never `float`. |
| `dimensions` (integer mm) | union of 11 and 29 | Two mutually exclusive supplier formats, both inches: col 11 `20.5” W X 18.5” D X 22.7” H` (curly quotes, uppercase `X`), col 29 `78.75"w x 15.00"d x 30.75"h` (straight quotes, lowercase). All 385 rows yield ≥3 numerics. Convert inches → integer millimetres with an explicit, stated rounding rule. |
| `availability` | — | **Not derivable.** Cols 23–25 (`Delivery Options`/`Location`/`Policy`) are 0/385 empty; col 21 `LEAD Time` is a date on 65 rows, not a duration; col 22 `Inventory` is an undated integer. R01 must recommend `Availability.UNKNOWN` for every row and say so explicitly — which, per `Product.__post_init__`, is also what permits rows with missing price/dimensions to exist at all. |
| `source_snapshot_id` | — | Mint per import run and record the file hash. Do **not** derive from col 27. |
| `CatalogueSnapshot.supplier_id` | 2 | One snapshot per supplier — see the structural mismatch above. |
| *(unmapped, present in source)* | 7, 8, 9/34, 10, 26 | `Room Type`, `Design Style`, `Key Features`, `Storage Solutions`, `Tags`. Real designer-labelled signal, heavy free-text drift, blocked from use by OQ-009 having no attribute contract. R01 should tabulate their observed vocabularies against the mapper file's canonical lists and report the delta — that delta is the most useful single input the client could receive toward answering OQ-009. |
| *(unmapped, supplier text)* | 19, 31, 33 | Three material columns. **Not** `material_class`. See OQ-009 above. |

### Provenance caveat R01's decision record must carry

R01's notebook decision record must state, in substance:

> The workbook audited here
> (`attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`,
> 385 rows × 36 columns, md5 prefix `3ad1f5d7`) was found in the existing
> TypeScript application's upload/attachment folder. That folder is not a
> sanctioned input path for the AI services in either `architecture/` or
> `agentic_flow/`, and the file arrived with no submission note, version
> marker or accompanying statement. It has **not** been confirmed by the
> client as the live product set; it may equally be a stale export or
> developer test material (see ADR-0005 for the five points a client
> confirmation must establish). Every finding in this notebook therefore
> describes *this file*, not "the Curalina catalogue", and no importer
> default, threshold or business rule may be derived from its specific
> values until provenance is confirmed. This notebook does **not** close
> `OQ-011`, which remains `open` and `owner: client`; it does not bear on
> `OQ-009` at all; and it has no bearing on the separate
> product-photo blocker, since the workbook contains no image or asset
> column of any kind.

### Checks that verify this ADR's factual claims

All reproducible with `openpyxl` (`read_only=True, data_only=True`) on
`Sheet1` of the pinned file:

- 385 non-empty data rows; 36 headers; 6 header names duplicated.
- `Supplier` distribution: Four Hands 271, Moe's Home 114.
- 42 duplicate `(Supplier, SKU)` pairs, each differing only in col 27.
- 11 distinct `Source File` values; `Moes Home` rows labelled
  `Four Hands Coffee Tables.xlsx` = 42.
- Cols 23, 24, 25 empty on all 385 rows.
- Zero rows whose category or name matches
  `rug|lamp|light|pendant|sconce`.
- Zero rows using category `Coffee Table`.
- A width/depth/height string resolvable on 385/385 rows from
  `col 11 or col 29`.
- None of OQ-009's six attributes present as a header in this workbook or
  as a term in `SUB-CATEGORIES` of
  `attached_assets/Quiz and Product Mapper file instruction_1762400632880.xlsx`.

No approval record exists for this ADR; it is a tech-lead admissibility
call pending the client confirmation described above.
