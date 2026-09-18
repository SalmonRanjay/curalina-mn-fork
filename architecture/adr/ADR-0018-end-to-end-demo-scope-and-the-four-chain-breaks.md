# Architecture decision record

ID: ADR-0018
Status: accepted
Owner and reviewer: `tech-lead` (decision); raised by the project owner
directly ("what tasks are left to get me to an end-to-end demo... we've
built a lot of the skeleton and scaffolding but I'm not seeing the
product yet")
Date: 2026-09-16

## Context

This ADR rules on five things at once because they are one question:
**what can this system honestly demonstrate, and what is physically
between here and that demo.** Splitting them into five ADRs would let the
demo-scope question be answered without the contract questions that
determine whether the demo can exist.

Everything below was re-derived from the current source this session, not
taken from `agent_instructions/STATUS.md` or from the session that
requested this ruling. Where the requesting summary was wrong, it is
corrected explicitly.

### C1 — The quiz → recommendation → room → results chain has four
independent hard breaks, each of which alone stops the flow

Traced `client/src/pages/Quiz.tsx:80-130` → `POST /api/quiz` →
`POST /api/render` (`server/routes.ts:762-808`) →
`orchestrateAiRender` (`server/services/ai-adapter/render-orchestrator.ts`)
→ recommendation `8101` → rooms `8103` → `client/src/pages/Loading.tsx` →
`client/src/pages/Results.tsx`.

**Break 1 — the AI path cannot get past its own first step.**
`server/services/ai-adapter/design-profile-mapper.ts:160-166` sets
`const atmosphere: string | null = null;` unconditionally and returns
`needsInput("atmosphere")`. `orchestrateAiRender` step 2 therefore
persists a `needs_input` render row and returns `201` on **every** request,
with the flag on. Recommendation is never called. Two lines further on,
`currencyConfirmedUsdOnly = false` is also hardcoded
(`design-profile-mapper.ts:177-180`), so `currency` becomes the next hard
stop the moment `atmosphere` is fixed.

The stated justification — *"`atmosphere` has no source field anywhere on
`quizResponses` today"* — is **wrong**, and this is the single most
consequential correction in this ADR. The live quiz step
(`client/src/components/quiz/ColorMaterialsStepV2.tsx:16-58`) offers
exactly these eight palette ids: `Warm Neutrals`, `Earth & Stone`,
`Coastal Calm`, `Soft Contrast`, `Monochrome Luxe`, `Artful Contrast`,
`Heritage Warmth`, `Dark & Moody`. All eight are verbatim members of
recommendation's own `canonical_tags` list
(`ai_services/recommendation/src/curalina_recommendation/evaluation/vocabulary_map_v1.yaml:14-40`),
and `briefs_v1.json` uses precisely these strings as `atmosphere` values
(`"Earth & Stone"`, `"Monochrome Luxe"`, `"Heritage Warmth"`). The values
are stored on `quizResponses.colorPalettes` (`shared/schema.ts:298`).
This is a field-name mismatch, not a missing input, and it is verifiable
by string equality rather than by a guessed semantic mapping.

Two dead-code traps to avoid here: `ColorPaletteStepV2.tsx` offers a
*different*, non-canonical set (`Light Neutrals`, `Warm & Cozy`,
`Colourful Accent`) and is **not** imported by `Quiz.tsx` — only
`ColorMaterialsStepV2` is (`Quiz.tsx:23`). And
`architecture/guides/03_data_contracts.md:14` names a third vocabulary
(`bright_airy`, `warm_balanced`, `dark_moody`) which the running service
does not use. See D1.

**Break 2 — even past break 1, every request 500s on product identity.**
`orchestrateAiRender` step 5a calls
`storage.getProduct(lineItem.product_id)` and raises
`ProductMappingMismatchError` → `500 product_mapping_mismatch` when it
misses. It always misses. Recommendation's runtime catalogue is four
hardcoded fixtures with ids `prod_sofa_0001`, `prod_sofa_0002`,
`prod_wall_art_0001`, `prod_coffee_table_0001`
(`ai_services/recommendation/src/curalina_recommendation/api/application_services.py:51-63`),
priced in **CAD** (`:43`). The app's `products.id` is
`varchar ... default gen_random_uuid()` (`shared/schema.ts:165`). These
are not the same identifier space and never will be.

This is not a fixture problem that goes away once the real catalogue is
imported. It is a **contract gap**: `BundleLineItem`
(`ai_services/recommendation/src/curalina_recommendation/api/schemas.py:72-79`)
carries `product_id`, `category`, `quantity`, `unit_price_minor_units`,
`currency` — and nothing else. `architecture/guides/03_data_contracts.md:9`
is explicit that `product_id` is a *"stable internal product_id"*, distinct
from the `supplier_id` + `supplier_sku` compound key. The app has no
internal recommendation ids and cannot acquire them. The only shared
identifier both sides can derive from the same supplier workbook is the
SKU, and the app already has `getProductBySku`
(`server/storage-curalina.ts:372`) — but the wire contract does not carry
it.

**Break 3 — nothing moves a render row out of `generating`.** Confirmed as
reported; `render-orchestrator.ts:42-47` documents its own gap. `GET
/api/render/:id` returns the stored row unchanged.

**Break 4 — `Loading.tsx` has no `needs_input` branch.** *Partial
correction to the requesting summary:* `Loading.tsx:120-128` **does** have
terminal-state handling — for `completed` and `failed`. It is
`needs_input` that is unhandled. Since break 1 means `needs_input` is the
*only* status the AI path currently produces, the observed behaviour today
is an infinite spinner, exactly as reported, but for a narrower reason
than "no terminal-state handling at all".

### C2 — Rooms produces no pixels, and this is deeper than G01

Confirmed and worse than the requesting summary stated.
`FakeGroundedGenerationAdapter.generate`
(`ai_services/room_generator/src/curalina_rooms/adapters/fake_grounded_generation.py:24-40`)
returns `candidate_asset_id = f"asset_fake_{digest}"` — a synthesised
identifier for an asset that **was never written**. No image bytes exist
anywhere in the rooms service. A successful rooms job today yields an
asset id that `GET /v1/assets/{asset_id}/content` cannot serve.

So the limitation is not only "we have no client room photographs to
evaluate against" (`ADR-0011`, `OQ-010`). It is that **no image-producing
code path exists in the rooms service at all**, fake or real.
`fake_room_prep.py` produces placeholder geometry; `fake_grounded_generation.py`
produces a placeholder *string*. `ADR-0015`'s `synthetic_defaults` mode
makes the *geometry inputs* honest; it does not create a renderer.

Separately confirmed: the monolith contains a full legacy image-generation
stack — `server/services/openai-render.ts`, `stability-ai-render.ts`,
`stability-inpainting-render.ts`, `gemini-image-only-render.ts`,
`hybrid-compositing.ts`, `room-composite-service.ts`, `render-qa.ts`,
`spatial-fit-validator.ts`. **None of it is imported by anything in the
live server tree.** Grepped across `server/`, `client/`, `shared/`: the
only references are two comments in `asset-import.ts`. The compiled copies
under `server/functions/lib/` are build output of an older tree, and that
tree's own `routes.js` has no render-generation route either. This code is
orphaned, not a shortcut.

### C3 — The Results page fetches four endpoints that do not exist

`client/src/pages/Results.tsx` calls `/api/render/:id/products` (`:115`),
`/api/render/:id/ledger` (`:127`), `/api/products/:id` (`:158`) and
`/api/products/alternatives/:id` (`:198`). Enumerating every route
registered in `server/routes.ts`, `server/routes-curalina.ts` and
`server/routes-mapping-analysis.ts`: **none of the four exist.** They do
not exist in the older compiled tree under `server/functions/lib/` either.
`Results.tsx:140-143` additionally fetches `/api/quiz-response/:id`, which
is registered behind `isAuthenticated` (`server/routes.ts:740`) but is
fetched without credentials from an anonymous quiz flow.

The storage layer behind all four is already complete and tested:
`getRenderProductsByRender` (`server/storage-curalina.ts:1304`),
`getSelectionLedgerByRender` (`:617`), `getProduct` (`:367`),
`getProductAlternatives` (`:377`). What is missing is roughly five thin
Express handlers. This is the cheapest high-value work in the entire
backlog and it has never been on the dispatch table, because every packet
so far has been scoped to the future-state services.

One further defect found in the same pass: `GET /api/render/latest` is
registered at `server/routes.ts:825`, **after** `GET /api/render/:id` at
`:811`. Express matches in registration order, so `/api/render/latest`
always binds `:id = "latest"` and returns `404 Render not found`. The
route is dead. `Loading.tsx:63` and `Results.tsx:97` both use it as their
no-`renderId` fallback.

### C4 — Two escalations left open by `UI-A5-04`

(1) Rooms' `RenderJobRequest`
(`ai_services/room_generator/src/curalina_rooms/api/schemas.py:131-139`)
has no field for `ADR-0015`'s `provenance_mode`; only the internal domain
type carries it (`domain/render_request.py:131`, defaulting to
`MEASURED`). Confirmed exactly as escalated. (2) `layout_version` is a
required field on the same request with no configured source;
`render-orchestrator.ts:384` passes `CURALINA_RULES_VERSION` as a flagged
simplification.

### C5 — Catalogue and type-checking state

Recommendation's runtime uses `FakeCatalogueImporter` and
`FakeFeatureEncoder` (`application_services.py:121-127`);
`adapters/xlsx_workbook_reader.py` exists and is wired to nothing in the
composition root. On the app side, `server/seed.ts` is **not imported by
any module** (grepped) and has no npm script — correcting the requesting
summary's "seeded by `server/seed.ts`"; neither seeding path runs
automatically. `scripts/import-products.ts` reads
`attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762332689675.xlsx`
(confirmed present) and upserts by SKU (`:51-52`).

`tsconfig.json`'s `include` is
`["server/functions/**/*.ts", "client/src/**/*.ts", "client/src/**/*.tsx", "types/**/*.d.ts"]`.
`server/functions/` is a build-output mirror. The live `server/` tree —
`routes.ts`, `storage-curalina.ts`, all of `server/services/` — has never
been type-checked by `npm run check`.

## Options

**On demo scope.**
- **(A) Wait for G01.** Honest, and indefinitely blocked on client-owned
  `OQ-010`. Produces nothing the owner can click.
- **(B) Build a naive deterministic compositor** — paste product cutouts
  onto `quizResponses.roomPhoto`. Produces pixels with no model and no GPU,
  but it is a generation quality claim made with zero evaluation evidence,
  in a service whose entire G-series is gated. Rejected.
- **(C) Reuse the orphaned legacy Gemini/Stability path** to fill the room
  image. Produces a real-looking image today. Rejected: it routes around
  every gate the `agentic_flow/` pack exists to enforce, and it would let a
  demo of "the new system" be carried by code the new system does not own.
- **(D) Demo the two halves that genuinely produce real output, and show
  the third as an explicitly labelled job lifecycle with no image.**

**On product identity across the boundary.**
- **(A) `product_id` is the app's uuid.** Requires the app to push ids into
  recommendation; inverts ownership; breaks on re-import.
- **(B) Redefine `product_id` as the supplier SKU.** Contradicts
  `03_data_contracts.md:9`, which deliberately separates internal id from
  compound natural key.
- **(C) Add `supplier_id` + `supplier_sku` to `BundleLineItem`.** Additive,
  matches the contract's own compound-key rule, resolvable by the app with
  a method it already has.
- **(D) A mapping table.** A third store of truth for an identity both
  sides already derive from the same workbook.

## Decision and rationale

**D1 — `atmosphere` is sourced from `quizResponses.colorPalettes`, by
exact string match against recommendation's `canonical_tags`, with
`needs_input` on ambiguity.** When `colorPalettes` holds exactly one value
and that value is a member of `canonical_tags`, it is the `atmosphere`. Two
values → `needsInput("colorPalettes")`, mirroring the multi-style rule
already accepted in `UI-A5-02`. Zero values or a non-member value →
`needsInput`. No fuzzy matching, no synonym table, no ranking of the two
selections. This is admissible precisely because it is an identity check
against a vocabulary the running service already defines, not a semantic
mapping someone invented.

`architecture/guides/03_data_contracts.md:14`'s
`bright_airy`/`warm_balanced`/`dark_moody` triad is **superseded** for the
`atmosphere` field: the running service's vocabulary is the client
workbook's tag set, admitted under `ADR-0007`. An amendment naming this is
consequential work of this ADR (see Verification).

**D2 — `currency` is `needs_input` until the client confirms it, and the
confirmation is now a named client ask, not a code comment.** I will not
rule USD by inference from supplier nationality. But note the contradiction
this exposes and do not paper over it: recommendation's own fixtures price
in **CAD** (`application_services.py:43`) while the mapper would send
`USD`. One of those is wrong. Until answered, the mapper keeps failing
closed — which means **D1 alone does not open the chain**; D2's answer is
required too, and it is a one-line client question, not engineering.

**D3 — `BundleLineItem` gains `supplier_id` and `supplier_sku`. This is an
additive, minor change (option C).** Optional on first ship so no consumer
breaks; the app resolves line items via `getProductBySku` and treats a miss
as `product_mapping_mismatch` exactly as today. `product_id` keeps its
contract meaning as recommendation's internal identifier and is **not**
redefined. Rationale: `03_data_contracts.md:9` already names
`supplier_id` + `supplier_sku` as *the* compound identity; the wire
contract simply failed to carry what the data contract already specified.
Every other option creates a second identity authority.

Consuming services: the app (`recommendation-client.ts`) is the only
consumer of `BundleLineItem` today, so "sign-off from every consuming
service" is satisfied by the app-side packet in the same sequence. Rooms
receives `product_id` on `RenderInstanceRequirement` and is unaffected.

**D4 — Rooms' `RenderJobRequest` gains a required `provenance_mode` field
with no default.** Enumerated to `ADR-0015`'s four modes. **No default**,
because a default is how `MEASURED` silently became the effective mode on
the internal type. A request that does not declare its provenance is
rejected with a contract error. This is a **breaking (major)** change to
the rooms request contract — it is the one place in this ADR where I accept
a break rather than an additive field, because an optional
`provenance_mode` reintroduces exactly the failure `ADR-0015` structurally
eliminated on `RoomPrepResult`. Rooms has two consumers: the app's
`render-job-client.ts` and `ai_services/suite_client.py`; both are in this
repo and both are updated in the same sequence.

**D5 — `layout_version` gets its own setting,
`CURALINA_ROOMS_LAYOUT_VERSION`, and stops borrowing
`CURALINA_RULES_VERSION`.** The rules version identifies
`curalina_design_rules`' rule set; the layout version identifies rooms'
own spatial layout algorithm. They are owned by different packages and
will drift. Fails closed if unset, following `UI-A5-04`'s precedent for
`CURALINA_CATALOGUE_SNAPSHOT_ID`.

**D6 — Job-completion reconciliation is done by app-side polling in a
background reconciler, not by a callback from the services.** The app polls
`GET /v1/jobs/{job_id}` for render rows in `generating`, using the
`aiServiceRef` jsonb column added in `UI-A5-03`. Rejected alternatives:
webhooks from rooms into the app (would make a Python service a client of
the monolith, inverting the dependency direction and giving rooms a reason
to know app URLs) and reconciling inside the `GET /api/render/:id` request
handler (puts an outbound network call on a 2-second polling path and makes
read latency a function of service health).

Mandatory, per `ADR-0016`'s reasoning applied client-side: the reconciler
maps job terminal states to render states **without collapsing them**. A
rooms job that succeeds sets the render to `completed` **only if a
retrievable output asset exists**; a job that succeeds with an asset the
service cannot serve — which is every job today, per C2 — sets `failed`
with an explicit reason. Job success is not a render result. Writing
`completed` against `asset_fake_*` would be precisely the fabricated-success
failure this project has now rejected three times (`ADR-0016`, dispatch
item 16's `except Exception: pass`, and here).

**D7 — the honest end-to-end demo is option (D), and it has three
surfaces, one of which shows no image.**

1. **Quiz → recommendation → Results, with real products.** Real quiz
   input, real catalogue from the supplier workbook, a real ranked bundle,
   real products rendered on the Results page with real prices and images
   from the app's own S3 assets. This is genuinely achievable with no model,
   no GPU and no client data. It is also, in my judgment, most of what the
   owner means by "the product".
2. **`/admin/product`: upload → mask → recolour → review → accept.** Real
   uploaded photograph, real human-authored mask, real LAB colour transfer
   producing real pixels that differ inside the mask and are byte-identical
   outside it (dispatch item 16, `VAR-A3-03`). Real three-state separation:
   job succeeded ≠ candidate approved ≠ commercially available. This is the
   only path in the system that produces a real generated image today, and
   it is finished on the service side.
3. **Room render: job lifecycle only, labelled, with no image.** The
   Results page shows the render job's real state transitions
   (`generating` → terminal) and says plainly that room image generation is
   not built and is blocked on `OQ-010`. **No placeholder image, no stock
   photo, no synthetic room picture.** The existing hardcoded Pexels URL on
   the legacy path (`server/routes.ts:792-793`) is removed as part of this,
   because a stock photograph presented as a render is the fabrication this
   whole ruling is against.

What this demo explicitly does **not** claim: any G-series acceptance, any
V01/V02 colour-fidelity claim, any recommendation accuracy or feasibility
claim (`ADR-0013` §D3 phrasing prohibitions remain binding — the bundle is
logic-only), and `measurement_certified` stays `False`.

**D8 — `tsconfig.json`'s `include` is widened to cover `server/**/*.ts`,
and this is in scope for the demo push.** It is not adjacent cleanup. Four
of the breaks above are in `server/` files the type checker has never seen,
and the next three packets all edit `server/routes.ts`. Shipping a demo on
a 3,000-line untyped request-handling layer is a worse risk than whatever
errors widening surfaces. Expect it to surface pre-existing errors in files
nobody has touched; the packet fixes or explicitly `// @ts-expect-error`-
annotates them with a reason, and does not narrow the glob back to make the
build pass.

## Consequences and reversal

**Costs accepted.**
- D3 and D4 both touch shipped wire contracts. D4 is a major bump for
  rooms; every rooms consumer in this repo is updated in the same sequence
  before the bump lands.
- D1 makes the app depend on recommendation's tag vocabulary being stable.
  If the client reissues the workbook with different tag strings, the quiz
  options and the service vocabulary drift silently and every request
  becomes `needs_input`. That is the correct failure direction, but it
  needs a contract test asserting the two lists agree — specified as part
  of the D1 packet, not left as a hope.
- D7.3 will read as a regression to anyone who saw the Pexels placeholder
  and believed it. That conversation is the point.
- D6's poller adds a background process to the monolith, which has not had
  one before (`image-health-worker.ts` exists but is orphaned).

**Reversal.**
- D1 reverses by returning `needsInput("atmosphere")` unconditionally —
  one constant. Trigger: the client states the palette tags are *not* the
  atmosphere axis, or `ai-ml-lead` finds the conflation distorts ranking.
- D3 reverses by dropping two optional fields; nothing depends on them
  structurally.
- D4 is the expensive reversal: making `provenance_mode` optional again
  requires re-auditing every caller. Trigger for revisiting: a second
  consumer outside this repo appears before the field ships.
- D7 reverses the moment `OQ-010` is answered and G01 becomes reachable —
  surface 3 gains a real image and the label comes off. Nothing in D7 is
  designed to be permanent.

**What would prove this decision wrong.**
- D1: a single live quiz submission whose `colorPalettes` value is not a
  `canonical_tags` member. I checked the option list, not production data —
  if `quiz_responses` rows exist from an earlier quiz version using the
  dead `ColorPaletteStepV2` vocabulary (`Light Neutrals`, `Warm & Cozy`,
  `Colourful Accent`), D1 yields `needs_input` for those rows and the
  packet needs a migration decision. **This is unverified and is the most
  likely way D1 is wrong.** The D1 packet must query the real table before
  writing the mapper.
- D3: evidence that recommendation's real importer does not preserve the
  workbook SKU verbatim, or that the app's `products.sku` was rewritten on
  import (`scripts/import-products.ts:51` substitutes a generated SKU when
  `row.SKU` is absent — how often that fires is **unmeasured**, and if it
  is common, SKU is not a reliable join key and option (D)'s mapping table
  comes back).
- D6: if rooms gains a real renderer that writes assets, the "succeeded but
  no retrievable asset → failed" rule should fire zero times; if it still
  fires, the asset-write path is broken and the rule is load-bearing rather
  than transitional.
- D7: if the client supplies room imagery and permission, D7.3 is obsolete
  within one packet.

**What I am explicitly not deciding.** Whether the orphaned legacy
generation stack should be deleted, revived, or left in place — that is a
question about the *existing* product's roadmap and it needs the owner's
intent, not an architecture ruling. I am only ruling that it is not part of
the future-state demo path.

## Verification

Consequential implementation authorized by this ADR, to be carried by the
packets in `agent_instructions/STATUS.md` dispatch items 18-25, not by this
ADR:

- D1/D2 → item 20. Contract test asserting the quiz palette option list and
  recommendation's `canonical_tags` agree.
- D3 → item 19. Additive schema change plus recommendation contract tests.
- D4/D5 → item 18. Rooms contract tests must reject a request with no
  `provenance_mode`.
- D6 → item 22. Must include a test that a succeeded job with an
  unretrievable asset yields `failed`, not `completed`.
- D7 → items 21, 23, 24.
- D8 → item 25.

Amendment required as a direct consequence of D1, following
`agentic_flow/AMENDMENTS.md`'s targeted-correction pattern:
`architecture/guides/03_data_contracts.md:14`'s Atmosphere row names an
enumeration the running recommendation service does not use. The row must
be corrected to name the `canonical_tags` vocabulary and cite `ADR-0007`,
or the two vocabularies must be reconciled deliberately. Not done in this
ADR because it is a contracts-document edit owned by
`contracts-qa-steward`, gated on this decision.

Independently verified this session by reading source, not by trusting the
requesting summary. Three of the requesting session's claims were
corrected: `Loading.tsx` does handle `completed`/`failed`;
`server/seed.ts` is not wired in at all; and rooms' problem is the absence
of any image-producing path, not only the absence of client imagery.
Three defects were found that no prior session had recorded: the four
missing Results-page endpoints (C3), the shadowed `/api/render/latest`
route (C3), and the product-identity contract gap (C1 break 2).
