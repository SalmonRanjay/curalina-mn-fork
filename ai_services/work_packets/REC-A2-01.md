# Agent work packet

## Task

Service: `curalina_recommendation`
Phase: A2 — package use cases (fake-adapter scope only)
Owner: `python-services-engineer`
Reviewer: `code-reviewer`

## Objective

Deliver workflow step 1 in full (typed domain records: `Product`,
`Profile`, `Bundle`, `Money`, dimension/clearance value objects,
eligibility reasons) and the fake-adapter shape for steps 2, 3, 4 and 5
(`CatalogueImporter`, `FeatureEncoder`, `BundleComposer` ports, each with a
clearly-labelled fake adapter), wired into `application/` at a level
testable now. No real importer, ranking, or composition logic — those
steps' real-logic extraction is blocked on notebooks (R01/R02/R03) that
have not been run.

## Context

Required guides:

- `architecture/guides/01_system_architecture.md`
- `architecture/guides/02_local_setup.md`
- `architecture/guides/03_data_contracts.md`
- `architecture/guides/08_engineering_and_tests.md`
- `architecture/guides/09_delivery_gates.md`
- `architecture/guides/11_agentic_implementation_plan.md`

Additional workstream guides:

- `agent_instructions/01_recommendation_service.md`
- `agentic_flow/recommendation_workflow.md` (A2 section — the authoritative
  phase scope; its 5-step sequence and gate table are what this packet
  executes)
- `agentic_flow/00_agentic_workflow_overview.md` (gate legend: A-phases vs.
  R/G notebook and stage gates)
- `ai_services/work_packets/REC-A1-01.md` (house style; its tech-lead note
  records ADR-0002, the A1/A3 HTTP-wiring boundary ruling — informational
  context only, does not change this packet's scope)
- `ai_services/design_rules/src/curalina_design_rules/api.py` (read-only —
  the future call target for the real `BundleComposer`; not imported by
  anything in this packet)

Input data, fixtures or decisions:

- R01 (catalogue-audit notebook), R02 (ranking-baseline notebook), R03
  (bundle-and-substitutions notebook) have **not been run**. Per
  `agentic_flow/00_agentic_workflow_overview.md`, A0/A1 and the
  fake-adapter parts of A2 do not wait on any of them — this packet is
  exactly that fake-adapter scope.
- `curalina_design_rules` (A0-A3 complete, consumer API at
  `ai_services/design_rules/src/curalina_design_rules/api.py`) is ready as
  a dependency but is not imported anywhere in this packet — only
  documented as the future call target inside
  `ports/bundle_composer.py`'s docstring.

## Allowed files

- `ai_services/recommendation/src/curalina_recommendation/domain/`
- `ai_services/recommendation/src/curalina_recommendation/ports/`
- `ai_services/recommendation/src/curalina_recommendation/adapters/`
- `ai_services/recommendation/src/curalina_recommendation/application/`
- `ai_services/recommendation/tests/`
- `ai_services/work_packets/REC-A2-01.md`

## Do not change

- `ai_services/recommendation/src/curalina_recommendation/api/` (A1's
  contract shapes are frozen; not touched by this packet — see "API
  wiring decision" below)
- `ai_services/recommendation/src/curalina_recommendation/bootstrap.py`,
  `settings.py` (A0, out of scope)
- `ai_services/design_rules/**` (dependency, not modified)
- Other service packages
- `agentic_flow/**`, `architecture/**`, `agent_instructions/**`

## Deliverables

- Domain/application code:
  - `domain/money.py` — `Money` (`decimal.Decimal` amount + ISO 4217
    currency), `sum_money`.
  - `domain/dimensions.py` — `Millimetres`, `inches_to_mm` (25.4 exact
    multiply, single rounding boundary), `Dimensions.from_inches`,
    `Clearance`.
  - `domain/eligibility.py` — `Availability` (available/unavailable/unknown),
    `EligibilityReason` closed vocabulary.
  - `domain/errors.py` — `DomainError`, `CurrencyMismatchError`,
    `InvalidSkuError`, `DuplicateProductKeyError`,
    `MissingRequiredFactError`.
  - `domain/product.py` — `ProductKey` (Unicode-whitespace-normalized
    identity, original SKU retained, equality/hash exclude `raw_sku`),
    `Product` (enforces "available implies price and dimensions present").
  - `domain/profile.py` — `Profile`.
  - `domain/catalogue.py` — `CatalogueImportReport`, `CatalogueSnapshot`
    (rejects duplicate `ProductKey`s on construction).
  - `domain/ranking.py` — `RankedCandidate`.
  - `domain/bundle.py` — `BundleLineItem` (`line_total`), `Bundle`
    (`total` via `sum_money`, `total_quantity`; invariant: feasible bundles
    carry no violations).
  - `ports/catalogue_importer.py`, `ports/feature_encoder.py`,
    `ports/bundle_composer.py` — `Protocol` interfaces, each docstring
    naming the exact blocked workflow step and notebook gate, and (for
    `BundleComposer`) the exact `curalina_design_rules.api` calls the real
    implementation will make.
  - `adapters/fake_catalogue_importer.py`,
    `adapters/fake_feature_encoder.py`,
    `adapters/fake_bundle_composer.py` — deterministic fake
    implementations, each module docstring labelled "FAKE ADAPTER" with
    an explicit list of what real logic it does *not* perform.
  - `application/catalogue_service.py`, `application/ranking_service.py`,
    `application/bundle_service.py` — constructor-injected orchestration
    over the ports above; `RankingService` owns budget filtering
    (inclusive boundary, currency-mismatch propagation as a typed error).
- Tests: `tests/unit/domain/{test_money,test_dimensions,test_product,test_profile,test_catalogue,test_bundle}.py`,
  `tests/unit/application/{test_ranking_service,test_catalogue_service,test_bundle_service}.py`,
  `tests/unit/adapters/test_fake_adapters.py` — 48 tests total (see
  "Mandatory named tests" below for which ones map to the workflow doc's
  required list).
- Docs/report/ADR: this packet.

## API wiring decision

Per the task's instruction to "wire these into `application/` at a level
that's testable now," `application/` is fully wired to the fake adapters
and covered by tests. `api/` was **not** touched: A1's four routes return
fixture-backed responses selected by canned JSON, not by calling
`application/`, and connecting them now would require a DTO<->domain
translation layer (request schema -> `Profile`/`Product`, `Bundle` ->
response schema) that is itself new design work, not a "small, natural"
connection — and it risks silently changing A1's frozen fixture-selection
behaviour (e.g. the `feasible=false` budget-threshold fixture selector).
That translation belongs to A3 ("expose the A2 use cases over loopback
HTTP"), which is explicitly a separate, not-yet-started phase.

## Local commands

Required before completion:

```bash
make -C ai_services/recommendation test
make -C ai_services/recommendation test-contract
make -C ai_services/recommendation test-integration
make -C ai_services/recommendation lint
make -C ai_services/recommendation typecheck
```

Optional slow commands:

```bash
pending (none for this phase; no hypothesis property tests were specified
for A2 by the workflow doc or service brief)
```

## Acceptance criteria

- Typed domain records for `Product`, `Profile`, `Bundle`, `Money`,
  dimension/clearance value objects and eligibility reasons exist as pure
  dataclasses in `domain/` — no framework imports, no I/O, no pandas.
- `CatalogueImporter`, `FeatureEncoder`, `BundleComposer` ports exist as
  `Protocol`s, each documenting exactly which workflow step and notebook
  gate blocks its real implementation.
- Each port has exactly one fake adapter, clearly labelled, deterministic,
  and performing no real importer/ranking/composition logic.
- `application/` orchestrates all three ports through constructor
  injection and is covered by tests using the fake adapters.
- The mandatory named tests that are testable against typed records alone
  (see below) pass; the ones requiring real ranking/composition logic are
  explicitly listed as deferred, not faked.
- `mypy --strict` and Ruff are clean on `src/`.
- `api/` is unmodified; A1's 14 contract tests still pass unchanged.

## Mandatory named tests — status

In scope and implemented (from `agentic_flow/recommendation_workflow.md`
and `08_engineering_and_tests.md`, testable against typed domain/
application code alone):

| Named test | Where |
|---|---|
| Exact budget boundary | `tests/unit/domain/test_bundle.py::test_bundle_total_at_exact_budget_boundary_is_feasible`; `tests/unit/application/test_ranking_service.py::test_product_priced_exactly_at_budget_is_included` and `::test_product_one_minor_unit_under_budget_is_included` |
| Currency mismatch | `tests/unit/domain/test_money.py::test_currency_mismatch_on_addition_raises`, `::test_currency_mismatch_on_comparison_raises`, `::test_currency_mismatch_on_sum_money_raises`; `tests/unit/application/test_ranking_service.py::test_currency_mismatch_between_product_and_profile_budget_raises` |
| Whitespace SKU | `tests/unit/domain/test_product.py::test_whitespace_only_sku_is_rejected`, `::test_sku_whitespace_is_normalized_but_original_retained` |
| Missing required facts | `tests/unit/domain/test_product.py::test_available_product_missing_price_raises_missing_required_fact`, `::test_available_product_missing_dimensions_raises_missing_required_fact`, `::test_unknown_availability_permits_missing_price_and_dimensions` |
| Duplicate keys | `tests/unit/domain/test_catalogue.py::test_duplicate_compound_key_is_rejected`, `::test_duplicate_key_detection_uses_normalized_sku`, `::test_different_supplier_same_sku_is_not_a_duplicate` |
| Unit conversion (in/mm) | `tests/unit/domain/test_dimensions.py::test_inches_to_mm_exact_multiplication`, `::test_dimensions_from_inches_converts_all_axes` |
| Quantity totals | `tests/unit/domain/test_bundle.py::test_quantity_totals_multiply_unit_price_by_quantity`, `::test_bundle_total_sums_all_line_totals` |

Deferred — require real ranking/composition logic that does not exist yet
(explicitly out of scope for this packet, not faked):

| Named test | Blocked on |
|---|---|
| Incompatible pair | Real bundle-composition logic (workflow step 5, blocked on R03 + `curalina_design_rules` wiring) |
| Impossible clearance | Same — needs the real `Placement`/`RoomGeometry` mapping and `evaluate_spatial_layout` call described in `ports/bundle_composer.py` |
| Insufficient categories | Needs a real composition algorithm's category-fill decision, not `FakeBundleComposer`'s single deterministic pick (which does exercise an infeasible/insufficient-categories *path*, in `tests/unit/adapters/test_fake_adapters.py::test_fake_bundle_composer_reports_insufficient_categories_as_infeasible`, but that is fake-adapter coverage, not the named test's real-logic claim) |
| Equal-score deterministic tie-breaking | Needs the real rule-only ranking algorithm (workflow step 3, blocked on R02) to produce meaningful ties from actual scoring; `FakeFeatureEncoder` sorts deterministically as an implementation-quality choice, but a single category-match indicator cannot produce the tie the named test is meant to prove |
| Substitution that breaks a previously valid layout | Needs the real composer's full-revalidation behaviour (workflow step 5, blocked on R03); `FakeBundleComposer.substitute` explicitly performs no such revalidation (see its docstring and the `fake_bundle_composer_no_layout_revalidation` warning it attaches) |

## Known blockers

Per-workflow-step status (`agentic_flow/recommendation_workflow.md`'s A2
5-step sequence):

1. **Typed domain records — done, no blocker.** Fully in scope, delivered
   this packet.
2. **Workbook/audit importer — not started, blocked on R01.** Only the
   `CatalogueImporter` port and `FakeCatalogueImporter` (a fake returning
   a fixed in-memory product list, not reading any workbook) exist.
3. **Rule-only ranking — not started, blocked on R02's fixed baseline.**
   Only the `FeatureEncoder` port and `FakeFeatureEncoder` (a single
   category-match indicator, no rule weights, no style/atmosphere
   scoring) exist.
4. **Embedding-based ranking (MiniLM) — not started, blocked on R02's
   held-out gate + ADR**, which is itself blocked on step 3's baseline
   existing first. No adapter, no dependency added.
5. **Bundle composition — not started, blocked on R03's go/no-go
   record.** `curalina_design_rules` is ready as a dependency but is not
   imported by anything in this packet. Only the `BundleComposer` port
   (documenting the exact future `curalina_design_rules.api` calls) and
   `FakeBundleComposer` (a single deterministic category pick, no
   spatial reasoning, no `curalina_design_rules` import) exist.

No `OQ-xxx` was hit directly by this packet's scope (typed records and
fake adapters do not need the blocked CMR formula or anchor hex library);
`OQ-001`/`OQ-007`/`OQ-011` remain blockers for the real-logic work in
steps 2-5 once their notebooks clear.

## Completion evidence

Files changed (all new, under the allowed-files list):

- `domain/money.py`, `domain/dimensions.py`, `domain/eligibility.py`,
  `domain/errors.py`, `domain/product.py`, `domain/profile.py`,
  `domain/catalogue.py`, `domain/ranking.py`, `domain/bundle.py`,
  `domain/__init__.py` (updated to export the new public surface).
- `ports/catalogue_importer.py`, `ports/feature_encoder.py`,
  `ports/bundle_composer.py`, `ports/__init__.py` (updated).
- `adapters/fake_catalogue_importer.py`, `adapters/fake_feature_encoder.py`,
  `adapters/fake_bundle_composer.py`, `adapters/__init__.py` (updated).
- `application/catalogue_service.py`, `application/ranking_service.py`,
  `application/bundle_service.py`, `application/__init__.py` (updated).
- `tests/unit/domain/test_{money,dimensions,product,profile,catalogue,bundle}.py`,
  `tests/unit/application/test_{ranking_service,catalogue_service,bundle_service}.py`,
  `tests/unit/adapters/test_fake_adapters.py`.
- No changes to `api/`, `bootstrap.py`, `settings.py`, `pyproject.toml`,
  or any file outside the allowed list. No new third-party dependency was
  added (domain/ports/adapters/application use only the standard library).

Commands run and their real results (this session, from
`ai_services/recommendation/`, `python3` — the shell has no `python`):

```
$ make test
...
TOTAL                                                               583     56     68     9    89%
48 passed in 1.06s
```

Branch-coverage floor check on `domain/`, `application/`, `ports/`,
`adapters/` specifically (>=85% required, not a substitute for the named
tests above):

```
$ PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/unit -p no:cacheprovider \
    --cov=curalina_recommendation.domain --cov=curalina_recommendation.application \
    --cov=curalina_recommendation.ports --cov=curalina_recommendation.adapters \
    --cov-branch --cov-report=term-missing -q
```
Per-file branch coverage: `domain/money.py` 100%, `domain/profile.py`
100%, `domain/eligibility.py` 100%, `domain/errors.py` 100%,
`domain/bundle.py` 96%, `domain/product.py` 93%, `domain/dimensions.py`
92%, `domain/catalogue.py` 90%, `domain/ranking.py` 86%; `application/*`
100% each; `ports/*` 100% each (Protocol stubs); `adapters/fake_bundle_composer.py`
88%, `adapters/fake_catalogue_importer.py` 100%, `adapters/fake_feature_encoder.py`
100%. Every touched file is >=85%.

```
$ make test-contract
14 passed, 2 warnings in 0.85s
```
Unchanged from `REC-A1-01`'s 14/14 — confirms `api/` was not touched and
its behaviour did not regress.

```
$ make test-integration
1 passed in 0.18s
```
Unchanged scaffold placeholder — A3 (real API/worker wiring) has not
started.

```
$ make lint
python3 -m ruff check --no-cache .
All checks passed!

$ make typecheck
python3 -m mypy --strict --cache-dir=/tmp/curalina_recommendation_mypy_cache src/curalina_recommendation
Success: no issues found in 29 source files
```

A2 done-evidence status (`agentic_flow/recommendation_workflow.md`):

- "Unit + contract tests pass without GPU/Internet/current-app DB
  access" — met for the fake-adapter scope; 48 unit + 14 contract tests,
  all local, no network/GPU/model downloads.
- "Import->snapshot->rank works end to end locally" — met at the
  fake-adapter level: `CatalogueService` -> `CatalogueSnapshot` ->
  `RankingService` -> `RankedCandidate` is exercised end to end in
  `tests/unit/application/test_ranking_service.py` and
  `test_catalogue_service.py`, entirely through fakes; this is not a claim
  that catalogue import or ranking themselves are accepted.
  `BundleService` -> `Bundle` -> `substitute` is likewise exercised
  end to end through `FakeBundleComposer` in `test_bundle_service.py`.
- "Any step whose upstream notebook gate hasn't cleared is left with a
  written limitation instead of a shipped 'accepted' claim" — met; see
  "Known blockers" above, itemized per workflow step, and every fake
  adapter's module docstring states what real logic it does not perform.

Limitations / follow-up:

- Steps 2-5's real logic remain fully unstarted, per design — this packet
  does not "get ahead" on any of them beyond the port/fake shape the task
  explicitly asked for.
- `api/` was deliberately left unconnected to `application/`; see "API
  wiring decision" above. A3 is the correct phase for that translation
  layer.
- No hypothesis property tests were added; neither
  `agentic_flow/recommendation_workflow.md`'s A2 section nor
  `agent_instructions/01_recommendation_service.md` names a property-based
  test requirement for this phase, and the task's "fast tests only"
  instruction argues against adding speculative ones.
- `requirements.lock` and `README.md` were not touched (A0 concerns,
  unaffected by this phase).
