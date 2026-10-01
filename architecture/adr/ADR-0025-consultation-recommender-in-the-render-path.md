# Architecture decision record

ID: ADR-0025
Status: **accepted (owner decision, 2026-09-30).** Built on branch
`feature/consultation-recommender`.
Owner: the project owner (decision). Raised in session 23: "update the
recommender service so it uses this and works properly", choosing **"Trained
model now"** over the rule-only default when shown `ADR-0024` D6.
Overrides: `ADR-0024` D6.3 (ship the rule, not the model) and `ADR-0021` §D1
(materiality stored, not ranked). Leaves in place: `ADR-0006`, `ADR-0013`,
`ADR-0016` (fail closed), `ADR-0021` §D4 (unknown enum = 422) and §D5
(categories from the Design Manual), which this ADR satisfies.
Date: 2026-10-01

## Context

- Session 22's two-tower model
  (`notebooks/learning/pytorch_recommendation_matching_demo.ipynb`) scores
  every supplier-handoff product against the live Consultation-1 quiz. Its
  labels are rule-derived (`is_match` over supplier tags). On held-out
  products it reaches an NDCG@10 of 0.970, against 1.0 for a perfect ranking.
- The running recommendation service returned canned JSON fixtures from
  `api/routes.py`. No real ranking path existed in the HTTP surface.
- The renders UI ("Shop the Look") fetched `/api/render/:id/products`, which
  had never existed. The cart routes the cart page calls
  (`GET /api/cart/:sessionId`, `PATCH`/`DELETE /api/cart/:id`) did not exist
  either, and `POST /api/cart` never set the required `session_id`.

## Decision

**D1: Recommendation serves the trained model.**
`POST /v1/consultation/recommendations` (additive, schema 1.x) does the
following:
1. Loads the Celadon / Lazzoni / Luxus workbooks in place from
   `CURALINA_SUPPLIER_DATA_DIR`. They are never copied (item 35).
2. Scores all 910 products with the model.
3. Fills the room's slots.

The model runs as a **numpy forward pass**, so torch is not a runtime
dependency. The artifact is packaged in `consultation/model/`, pinned by the
SHA-256 in `manifest.json`. The service refuses to load mismatched weights.
`parity.json` proves the port is exact: every product's score matches the
notebook for both demo answer sets (`tests/integration/test_consultation_parity.py`).

**D2: Every score ships with `rule_match`,** the labelling rule's verdict.
The response also counts the model/rule disagreements, so a model error is
visible in the API, the render row and the UI. It is never silent.

**D3: Room composition comes from Design Manual §4.2 "The Object Hierarchy"
(p.96-97).** This satisfies `ADR-0021` §D5.

| Room | Foundation | Bridge | Accent |
|---|---|---|---|
| Living Room | Sofa or sectional (credenza = `Sideboard` only if no sofa qualifies) | Accent chair, coffee table, side table | Ottoman |
| Dining Room | Dining table | Dining chairs | — |
| Bedroom | Bed | Nightstands ×2 (§9.4.1 matched pair), bench | Art (`Wall Art`) |

Pieces the catalogue does not carry (rugs, lamps, cushions, centrepieces) are
listed as `not_in_catalogue`. Dining chairs take the seating answer, then the
table's own seat count, then 1 with a note. Slots are filled foundation-first,
and each takes the best-scoring priced product scoring at least 0.5 that fits
the remaining budget. The budget is the top of the investment band;
`$66,000+` has no ceiling.

**D4: The app recommends before it renders.** This applies in concept mode
when `CURALINA_RECOMMENDATION_IN_RENDER=true` (default `false`, on in
docker-compose). The orchestrator:
1. maps the quiz row to the service's answers;
2. creates or updates each placed product in the app's `products` table
   (`sku` = recommendation `product_id`), so the existing cart can take it;
3. sends the pieces in the rooms `render_brief.products`;
4. stores them in `renders.productPlacements`, with a summary in
   `renders.aiServiceRef.recommendation`.

`needs_input` creates a `needs_input` render row. An unreachable service or a
service error fails closed (`ADR-0016`).

**D5: Renderers use the pieces.** The composite renderer places **only** the
requested products. It reports pieces without a cutout in `X-Missing-Pieces`
(all of Lazzoni, which ships PDFs only) and never substitutes another piece.
SD 1.5 names them in its prompt.

**D6: The UI shows and sells them.** `GET /api/render/:id/products` now
exists. The Results page has a "Products placed in this room" table: piece,
product, supplier, quantity, price, match score, a rule-disagreement badge,
add-to-cart per row and for all. The cart is session-based, and every
item-level change must name its owning session.

## Assumptions the client should confirm

1. A product matches if it carries the aesthetic **or** the materiality style.
   This is the model's training label, and it overrides `ADR-0021` §D1.
2. Bedroom "Refined space for hosting guests" = catalogue "…hosting and
   socializing".
3. Manual wording → catalogue type: "Statement Credenza" = `Sideboard`,
   "Art" = `Wall Art`.
4. The budget ceiling is the top of the band. The live `design-profile-mapper`
   uses the midpoint for its own, separate profile.
5. Catalogue prices are CAD (`CURALINA_CATALOGUE_CURRENCY`, owner default per
   item 20). The workbooks carry no currency.

## Consequences

- **No `ai-ml-lead` sign-off exists.** The model is in the ranking path by
  owner decision. Its own evidence says it mostly reproduces the rule
  (tags-hidden NDCG@10 0.297). Reverting is one setting: turn
  `CURALINA_RECOMMENDATION_IN_RENDER` off, or swap `TwoTowerScorer` for a
  rule scorer behind the same `ConsultationRecommender`.
- **Writes to the app database.** Each recommendation upserts supplier,
  category and product rows into the app's `products` table, which is the
  shared Neon dev database in docker-compose.
- **Known data gaps the room plan surfaces:**
  - Lazzoni has no images, so its pieces never appear in a composite render.
  - For some answers no coffee or side table matches. Example: Mid-Century
    Scandinavian + Warm & Balanced + pet-friendly. The tables don't carry
    those touch tags; the rule finds zero matches, and the model correctly
    scores them near 0.
- **Retraining** = re-run the notebook, then copy `model_weights.npz`,
  `feature_space.json`, `quiz_schema.json`, `metrics.json` and `parity.json`
  into `consultation/model/`, and update `manifest.json`'s `run_id` and
  `weights_sha256`. The parity test then proves the new artifact against the
  workbooks.
