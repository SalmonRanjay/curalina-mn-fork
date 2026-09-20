# Catalogue and shared contracts

## Source mapping

The supplied workbook contains 62 populated artwork records on ARTWORK with 24 columns. Worksheet dimensions include blank/formatted rows; do not use max_row as a product count. Preserve the workbook as a source snapshot.

| Source | Canonical representation | Validation |
|---|---|---|
| SKU and Supplier | supplier_id plus supplier_sku; stable internal product_id | Normalize Unicode whitespace; retain original SKU; reject duplicate compound keys unless explicit variant relationship |
| Product Name and Artwork Series | name and collection_id/name | Collection can define grouped evaluation splits |
| Trade Price and Retail Price | separate decimal monetary amounts | Currency required separately; never infer it from dollar symbols or Canadian context |
| Room Type | list of canonical room codes | Split semicolon-delimited values and trim |
| Design Style | reviewed style tags | Map to organic_modern, mid_century_scandinavian, contemporary_luxe |
| Atmosphere | canonical atmosphere code | bright_airy, warm_balanced, dark_moody |
| Width and Height in inches | dimensions with explicit source units and normalized mm | Multiply by 25.4; preserve precision; positive numeric values |
| Overall Dimensions | original descriptive dimensions | Cross-check structured values; do not assume diptych size is per panel |
| Substrate and Frame fields | category-specific artwork attributes | Do not map these to upholstery attributes |
| Best Placement | placement hints | Hints are not measured wall coordinates |
| Product Overview | source description | Exclude target labels from classifier input when evaluating label prediction |
| Product Image | asset ingestion status | All 62 extracted cells currently show #VALUE!; do not treat as URLs |
| Existing URL | supplier page URL | A webpage URL is not a validated image asset |
| Lead Time | original text and reviewed min/max days | Do not equate lead time with stock availability |

Delivery options, delivery location, return policy and SEO keywords are blank. There is no explicit currency or inventory field. Missing critical commercial facts produce `unknown`, not `available`. Catalogue-only experiments can run in explicitly labelled research mode; shoppable bundle acceptance must require verified eligibility.

## Core records

Product: schema_version, product_id, supplier_id, supplier_sku, category, collection_id, name, attributes, dimensions, retail_price, trade_price, availability, asset_refs, source_snapshot_id and review status. Keep trade prices out of customer-facing response contracts.

VisualVariant: variant_id, parent_product_id, source_asset_id, output_asset_id, target_colour, mask_id, review_status, commercial_status, optional supplier_variant_sku and generation manifest. `review_status` is pending/approved/rejected. `commercial_status` is conceptual/custom_order/supplier_confirmed. Approval alone never creates a purchasable variant. Custom-order items additionally require a confirmed quote and fulfillment eligibility.

Asset: local asset_id, upstream identity if any, content hash, media type, dimensions, owner_id, provenance, original filename and storage-adapter key. Storage keys are internal. Mask records reference their source asset and image dimensions; 1 means editable and 0 protected, with an explicit feathering policy.

DesignProfile: room_type, style, atmosphere, pattern_level, lifestyle requirements, furniture_budget, budget_inclusions, room_geometry, retained_items and preference/hard-constraint distinctions. Pattern choices map to solids/accents/forward. Lifestyle fields are typed requirements, not one free-text string.

Geometry: measured room envelope in mm, coordinate origin, axis directions, openings and retained object footprints, clearances and measurement confirmation. Recommendation owns physical 2D placements. Room generation owns the mapping from physical positions to image positions; without camera calibration this mapping is approximate and separately reviewed.

Bundle: immutable bundle_id/revision, profile snapshot, catalogue snapshot, rule version, line items including quantity and chosen variant, per-line and total costs, completeness, violations, warnings and layout. A chair quantity of two is intentional repetition; visual checks compare quantities rather than requiring every SKU exactly once.

## Contract rules

Use semantic string codes, ISO timestamps in UTC and explicit units. Serialize money amounts as decimal strings or integer minor units; never binary float totals. Required unknowns trigger structured failure. Optional unsupported attributes remain null with provenance. Preserve IDs across export/import; never derive identity from a mutable product name.

Use `/v1` HTTP paths and `schema_version=1.0` payloads. Additive optional fields may be compatible; removed fields, altered units or changed semantics require a new major version. Producers and consumers test shared fixtures independently. Reject unsupported major versions with 422.

## HTTP surface for implementation

| Service | Endpoint | Semantics |
|---|---|---|
| Recommendation | POST /v1/catalogue/imports | Local curated import; returns report and immutable snapshot ID |
| Recommendation | POST /v1/recommendations | Category ranking; 200 with scores and reasons |
| Recommendation | POST /v1/bundles | Bundle/layout result; 200 including feasible=false for legitimate no-solution |
| Recommendation | POST /v1/bundles/{id}/substitutions | New candidate revision, preserving original |
| Each image service | POST /v1/assets | Multipart upload with ownership and size checks; 201 asset metadata |
| Variants | POST /v1/variant-jobs | 202 persisted job and Location header |
| Rooms | POST /v1/render-jobs | 202 persisted job and Location header |
| Each image service | GET /v1/jobs/{id} | State and structured failure/result refs |
| Each image service | POST /v1/jobs/{id}/cancel | Cooperative cancellation; does not guarantee interrupting a GPU kernel |
| Each image service | POST /v1/candidates/{id}/reviews | Version-checked review record; candidate existence required |
| Each image service | GET /v1/assets/{id}/content | Authorized bytes; no arbitrary filesystem path access |

The future consumer uploads/imports approved references into the room service before submitting its job. There is no implicit globally accessible local filesystem. JSON request fixtures in templates illustrate this distinction.

Errors use code, message, details, retryable, request_id. Use 400 malformed input, 401/403 identity/access errors, 404 unknown owned resource, 409 idempotency/revision conflict, 413 oversized upload, 422 invalid semantics, 429 capacity rejection and 503 unavailable runtime. Never return internal paths or raw stack traces.

## Durable job behaviour

queued -> running -> succeeded/failed/cancelled. Success means a candidate was produced, not designer approval. Candidate review has its own state. A rejection does not rewrite job history. Retry produces an attempt record with bounded count; validation failures are not retried.

An idempotency key is scoped to owner, endpoint and canonical request hash. Same key and same payload returns the original job; changed payload returns 409. SQLite job row and enqueue intent are committed together; the local worker polls the durable table. Claim under transaction with a lease and fencing token. Commit completion only when the token still matches. Expired jobs are recovered after restart; atomic temp-file rename and deterministic output keys prevent duplicate accepted outputs. Later queue adapters need an outbox or equivalent atomicity mechanism.

## Existing application adapter contract

The current Node/React application is a contract consumer. It may supply source data from `quizResponses`, `products`, `renders`, `renderProducts` and `selectionLedger`, but AI services must receive those facts as explicit request documents or uploaded assets. Services do not connect to the application database and the UI does not connect to service-local databases.

Required adapter mappings:

| Current app concept | AI-service contract concept | Rule |
|---|---|---|
| quiz response | DesignProfile | Preserve selected room, styles, colour/palette, functional needs, budget and uploaded asset references; unsupported fields become null with provenance |
| product row | Product plus Asset refs | Preserve SKU, supplier, dimensions, price, availability, image URLs and visual descriptions; do not expose trade price to customer-facing service responses |
| product image URL or upload | Asset import | Import or upload bytes into the owning service and persist returned asset_id/content hash |
| render record | Render job/result | Store service job ID, status, schema_version, bundle_id/revision and candidate/review IDs |
| selection ledger | Bundle explanation/provenance | Keep scores, rejected reasons and rule versions traceable to the immutable bundle revision |

The adapter must be deterministic and tested with fixtures. If a required service field cannot be mapped from the current app, the adapter must return a structured `needs_input` or validation error rather than inventing data. Agent tasks that add adapter fields must update both the contract fixture and the UI persistence plan.
