# Recommendation and room composition architecture

## Problem and first proof

Determine which catalogue items match a customer's brief and which combination is physically and commercially valid. Start with category-scoped artwork ranking using the supplied 62 records. This proves ingestion and relevance ranking; it does not demonstrate complete-room composition or a furniture-trained model.

## Notebook sequence

R01 audits source data, identifiers, missingness, category coverage and image availability. Deliver an import report and reviewed canonical sample.

R02 compares a rule-only ranking baseline, TF-IDF cosine ranking and pretrained text embeddings on fixed briefs. Deliver ranked lists, error analysis and designer relevance labels. Keep fitting/preprocessing decisions out of the held-out evaluation.

R03 evaluates room composition using additional real furniture data, or clearly synthetic contract fixtures to test constraints. Deliver feasible and infeasible examples, substitution checks and a go/no-go record. Synthetic products prove logic only, never recommendation relevance.

## Selection pipeline

1. Validate profile and budget meaning; reject unsupported room/style or unconfirmed required dimensions.
2. Pin catalogue snapshot and rules version. Verify required category coverage.
3. Apply hard filters before scoring. Unknown required availability, durability or measurements fail eligibility for shoppable mode.
4. Build candidate text from permitted source fields. Compute embeddings once per content hash/model revision; normalize vectors consistently.
5. Rank within each category using semantic similarity plus explicit style/atmosphere preferences. Similarity is not a probability. Keep component scores and rule reasons.
6. Search combinations with category counts, quantity-adjusted costs, dimensions, clearances and pair compatibility. Start with bounded beam search or deterministic backtracking on a small pilot, with timeout and candidate caps. If using optimization later, keep it behind a BundleSolver port.
7. Validate layout and total again after selection. Return no feasible bundle plus reasons when constraints cannot be satisfied. Never relax a hard constraint silently.
8. For substitution, freeze other items, adjust remaining budget, preserve required capacity and revalidate the entire new bundle/layout revision.

Ranking weights and aesthetic compatibility rules are design hypotheses, not trained facts. Keep them in versioned configuration with provenance and review. The full design manual remains needed before claiming compliance with all its rules.

## Learning and evaluation

Use designer relevance labels 0 unsuitable, 1 acceptable, 2 strong. Propose 12 briefs spanning three styles and three atmospheres plus restrictive budget/size cases. Designers judge a pooled set across methods so the winning method does not define its own truth. Fix which profiles are development and held-out before tuning.

Group related artworks by series to reduce near-duplicate leakage when evaluating a classifier. For style classification, exclude Design Style from features and inspect descriptions for explicit target names. With only 62 records, class counts may not support reliable held-out classification. Prefer semantic retrieval initially; do not manufacture classifier labels or behavioural outcomes.

Report Precision@5 and NDCG@5 per brief and averaged, category coverage, no-result rate, hard-constraint violations and runtime. Define relevance for Precision as label >=1. Use a fixed candidate universe. If fewer than five items are returned, missing slots count as nonrelevant for Precision@5; disclose insufficient eligible inventory separately. Mark NDCG undefined for profiles with no relevant labelled item and report their count. Recall requires sufficiently complete relevance judgements.

## Service modules

| Layer | Proposed responsibilities |
|---|---|
| Domain | Product, Profile, Bundle, Money, dimension/clearance rules and eligibility reasons |
| Application | ImportCatalogue, RankProducts, ComposeRoom, SuggestSubstitutions |
| Ports | CatalogueRepository, FeatureEncoder, BundleSolver, RulesProvider, EvaluationStore |
| Adapters | Workbook reader, SQLite catalogue, sklearn baseline, sentence-transformer encoder, local JSON rules |
| API | Typed request/response mapping and error translation |

No pandas DataFrame crosses into domain code. Translate rows into typed records at ingestion. Keep offline feature preparation out of request handlers. Cache invalidation keys include catalogue content, encoder revision, normalization and schema version.

## Agent build order

1. Create contract fixtures for catalogue import, profile ranking, bundle success, no-solution and substitution. Use fake products when real furniture data is missing, and label them as synthetic.
2. Implement typed domain records, money/dimension rules and import validation before ranking.
3. Implement the workbook/audit importer and immutable snapshot creation.
4. Implement rule-only ranking and deterministic tie-breaking before embedding adapters.
5. Add embedding/semantic ranking only after the baseline has fixed evaluation cases.
6. Implement bundle composition and substitutions with full revalidation.
7. Expose HTTP endpoints only after package use cases have unit and contract coverage.
8. Add the existing-app adapter after service contract fixtures are stable.

An agent may stop at any numbered step if the required source data is missing, but it must leave passing tests and a written limitation. It must not use final fallback products to fabricate a valid recommendation in shoppable mode.

## Mandatory tests and acceptance

Unit cases: exact budget boundary; currency mismatch; whitespace SKU; missing required facts; duplicate keys; unit conversion; quantity totals; incompatible pair; impossible clearance; insufficient categories; equal-score deterministic tie-breaking; and substitution that breaks a previously valid layout.

Integration cases: import->snapshot->rank; index built for wrong snapshot; process restart; malformed workbook; repository rollback. Contract cases: no-solution response, provenance, trade-price exclusion and version errors.

Promotion requires a reviewed import report, reproducible baseline comparison, zero hard-rule violations in fixed valid cases, explicit no-solution behaviour, and clean package functions producing the notebook's selected results. Relevance thresholds are proposed in the delivery guide and require designer review before use as acceptance gates.
