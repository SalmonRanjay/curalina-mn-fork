# Architecture decision record

ID: ADR-0003 — Rooms' local asset/review DTOs align to the shared v1 schemas
Status: accepted (code change applied)
Owner and reviewer: `tech-lead` (decision and alignment fix);
`contracts-qa-steward` (shared schemas), `python-services-engineer` (rooms)
as affected parties. Variants is **not** affected — no shared schema changed.
Date: 2026-09-13

## Context

Variants contributed six shared JSON Schemas to
`ai_services/contracts/v1/schemas/` during its A1. Rooms, in parallel,
defined its own transport DTOs in
`ai_services/room_generator/src/curalina_rooms/api/schemas.py` for two of
the same concepts. `POST /v1/assets` is the one endpoint in
`03_data_contracts.md`'s HTTP surface table owned by more than one service,
so two shapes for one concept is a real, not theoretical, drift risk.

Four divergences were found and escalated (`agent_instructions/STATUS.md`,
rooms section):

| # | Shared v1 schema | Rooms' A1 DTO |
|---|---|---|
| 1 | `asset.provenance` is `string`, `minLength 1` | `dict[str, Any]`, defaulting `{}` |
| 2 | no `storage_key`; `additionalProperties: false`; description says storage keys are never serialized | `storage_key: str`, returned to callers |
| 3 | `review.decision` enum is `approved` / `rejected` | `approved` / `rejected` / `needs_changes` |
| 4 | `review.revision` (integer ≥ 1), plus `reviewer_id` and `created_at` | `review_version`, `reviewed_at`, no `reviewer_id` |

`ai_services/contracts/v1/CONTRIBUTING.md` already states the going-forward
rule (a shared-endpoint concept's shape belongs in the shared folder during
A1). This ADR resolves the **existing** divergence: for each of the four,
does rooms need something the shared schema lacks?

## Options

**(a) Extend the shared schemas to rooms' shape.** Would require:
`provenance` widened from `string` to `object` (a *type change*, therefore
breaking, therefore a v2 and sign-off from variants per CONTRIBUTING);
`storage_key` added to a public view that explicitly forbids it; a third
review outcome added to a two-valued enum (a state-machine change, also
breaking). Cost: a major version bump on `/v1` before any service has
reached A3, plus rework in variants, to gain nothing rooms currently uses.

**(b) Align rooms to the shared schemas.** Mechanical: rooms' A1 code is a
fixture-backed fake with no consumer of any of these fields' internals.

**(c) Split the difference — align 2/3/4, extend for `provenance`.** The
only genuinely arguable one. Rejected below.

## Decision and rationale

**Option (b): rooms aligns. No shared schema changes; variants is
unaffected and needs no sign-off.** Per divergence:

1. **`provenance` → `str`.** This is the only divergence with a real
   argument behind it: rooms' fixtures carried structure
   (`{"source": "variant_export", "variant_id": "variant_sofa001"}`) that a
   flat string flattens. But (i) no rooms code reads a key of it — it is
   opaque pass-through; (ii) `03_data_contracts.md` line 32 lists
   provenance as one Asset field among peers with no structure implied, and
   `05_variants.md` line 15 speaks of "a known image licence/provenance",
   which is descriptive, not a record; (iii) `string` → `object` is a type
   change and therefore breaking, and we do not spend a major version on a
   field no one reads. The structured information is preserved losslessly
   enough for A1 as a prefixed string (`variant_export:variant_sofa001`).
   **If a structured provenance is genuinely needed later, the additive
   path is a new optional object field (e.g. `provenance_details`) beside
   the string, or a v2 — never a silent widening of `provenance`'s type.**
2. **`storage_key` removed.** This one is not a matter of preference.
   `03_data_contracts.md` line 32: "Storage keys are internal." Rooms was
   leaking a storage-adapter key across a service boundary, which is also
   the invariant "no service reads another's SQLite file or filesystem
   asset paths" one step from being violated by a consumer that starts
   parsing it. `GET /v1/assets/{id}/content` now derives its `content_ref`
   from the public `asset_id` alone.
3. **`needs_changes` removed.** `03_data_contracts.md` line 30 pins the
   vocabulary: "`review_status` is pending/approved/rejected." A third
   terminal outcome is a change to the review state machine, not a label.
   It is also unnecessary: "needs changes" is `rejected` plus `notes`,
   which the request DTO already carries. Keeping it would have quietly
   given rooms a candidate state variants cannot represent, on a concept
   both services will eventually exchange.
4. **`review_version` → `revision`, `reviewed_at` → `created_at`,
   `reviewer_id` added.** Pure naming/field-set alignment. `revision` is
   also the repo-wide convention (`id_versioning.md`: revision IDs, bundle
   revisions).

One recorded, deliberate gap remains: the shared schema **requires**
`width_px` and `height_px` as non-null integers; rooms' DTO keeps them
nullable. Rooms' A1 fake does not decode image bytes, so it cannot know an
imported asset's pixel dimensions — and the standing invariant is that an
unknown required fact produces a structured gap, never a guessed number.
Fabricating dimensions to satisfy a schema would be exactly the failure
mode that invariant exists to prevent. This closes at rooms' A2, when a
real importer decodes the upload; until then it is asserted as a *bounded*
exception by `test_the_only_nullability_gap_is_the_recorded_one`, so it
cannot quietly grow to other fields. Seeded fixture assets already carry
real dimensions; only the import path is affected.

## Consequences and reversal

Applied (rooms only — no variants file, no shared schema, no
`agentic_flow/` file was touched):

- `ai_services/room_generator/src/curalina_rooms/api/schemas.py` —
  `ReviewDecision` narrowed to two outcomes; `AssetImportRequest.provenance`
  and `AssetResponse.provenance` are non-empty `str`; `AssetResponse` drops
  `storage_key` and gains `upstream_asset_id` (optional in the shared
  schema, previously accepted on import and then discarded);
  `CandidateReviewRequest.expected_review_version` → `expected_revision`;
  `CandidateReviewResponse` now `reviewer_id` / `revision` / `created_at`.
- `ai_services/room_generator/src/curalina_rooms/api/service.py` —
  `content_ref` derived from `asset_id`; review response built from the new
  field names; `upstream_asset_id` echoed through.
- Fixtures `seed_assets.json`, `asset_import_request.json`,
  `seed_candidates.json`, `candidate_review_request.json` updated to match.
- `tests/contract/test_candidate_reviews_contract.py` renamed field
  assertions; new `tests/contract/test_shared_schema_alignment_contract.py`
  (6 tests) reads the shared JSON Schemas directly and fails if rooms' DTOs
  drift again — a document read, sanctioned by "producers and consumers test
  shared fixtures independently" (`03_data_contracts.md` line 44), not a
  cross-service code dependency.

Deliberately **not** changed: the error code `review_version_conflict` in
`ai_services/room_generator/src/curalina_rooms/api/errors.py` and its
`details` keys. That is rooms-local error vocabulary, not a shared field
name; renaming an error code is itself a contract change for consumers and
is out of this ADR's mandate. It is cosmetic debt, worth folding into rooms'
A3 if anything else in that file is touched.

Reversal trigger / what would prove this wrong:

- A concrete consumer requirement to read a *field* of provenance (rather
  than display or log it whole) would justify revisiting divergence 1 — via
  an additive `provenance_details` object, not a type widening.
- If designer review genuinely needs a distinct non-terminal "changes
  requested" state that `rejected` + `notes` cannot express (e.g. a
  candidate that must stay in a re-render queue rather than exit it), that
  is a real state-machine question and belongs to the client/design
  authority, not to a DTO. It would be a `/v2` review contract with variants
  sign-off. Raise it as an open question before writing code.
- Rooms' A2 must flip `width_px`/`height_px` to required once the importer
  decodes bytes; if A2 discovers a legitimate asset kind with no pixel
  dimensions (a PDF spec sheet, say), the shared schema — not rooms — is
  what needs an additive fix, and that is a steward task with variants
  sign-off.

## Verification

Real output, run from `ai_services/room_generator` after the change:

```
$ make test-contract
collected 32 items
tests/contract/test_assets_contract.py .......                           [ 21%]
tests/contract/test_candidate_reviews_contract.py .....                  [ 37%]
tests/contract/test_contract_scaffold.py ..                              [ 43%]
tests/contract/test_id_and_version_conventions_contract.py ...           [ 53%]
tests/contract/test_render_jobs_contract.py .........                    [ 81%]
tests/contract/test_shared_schema_alignment_contract.py ......           [100%]
============================== 32 passed in 0.46s ==============================

$ make lint
python3 -m ruff check --no-cache .
All checks passed!

$ make typecheck
python3 -m mypy --strict --cache-dir=/tmp/curalina_rooms_mypy_cache src/curalina_rooms
Success: no issues found in 13 source files

$ make test            # unit, unaffected
4 passed in 0.49s      (coverage 59% overall; api/schemas.py 100%)

$ make test-integration # scaffold, unaffected
1 passed in 0.19s
```

Contract test count went 26 → 32: the six added are the anti-drift guards,
no existing assertion was weakened or deleted.
