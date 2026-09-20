# REC-A2-02 — logic-only bundle composition after R03 no-go

## Task

Service: recommendation  
Phase: A2 step 5, reduced scope under `ADR-0013`  
Owner: python-services-engineer  
Reviewer: primary agent

## Objective

Replace recommendation's HTTP-wired bundle composer with deterministic
logic-only composition and substitution over labelled-synthetic fixtures,
without claiming R03 acceptance, G2, or real furniture-data quality.

## Context

Read:

- `agent_instructions/STATUS.md`, dispatch item 13
- `architecture/adr/ADR-0013-r03-no-go-on-real-furniture-data.md`
- `agentic_flow/recommendation_workflow.md`, A2 step 5 and gate table
- Existing recommendation domain/application/API files

Binding constraints:

- Synthetic provenance must live in the data structure, not in comments.
- Validation arms that do not exist must surface as `needs_input` with
  `OQ-002`, `OQ-004`, `OQ-007`, `OQ-009`, and catalogue scope `OQ-011`.
- No output may claim composition acceptance, acceptance thresholds, R03
  completion, or G2.

## Allowed Files

- `ai_services/recommendation/src/curalina_recommendation/domain/product.py`
- `ai_services/recommendation/src/curalina_recommendation/adapters/`
- `ai_services/recommendation/src/curalina_recommendation/api/`
- `ai_services/recommendation/tests/`
- `ai_services/recommendation/Makefile`
- `ai_services/recommendation/README.md`
- `ai_services/suite_client.py`
- `ai_services/tests/test_suite_client.py`
- this packet
- `agent_instructions/STATUS.md`

## Do Not Change

Do not edit contracts, open questions, notebooks, model/evaluation claims, or
other services. Do not add real catalogue rows or synthetic products without
the synthetic label travelling as data.

## Deliverables

- Domain/application code: `Product.fixture_label` added and persisted through
  SQLite snapshot round trips.
- API/worker code: recommendation composition root now wires
  `LogicOnlyBundleComposer` for bundle endpoints; recommendation still has no
  worker.
- Tests: unit coverage for deterministic selection, budget behavior,
  synthetic-label enforcement, substitution revision/revalidation, repository
  persistence, and updated HTTP contract expectations.
- Docs/report/ADR: this packet, README wording, and status update.

## Local Commands

Required before completion:

```bash
make -C ai_services/recommendation test
make -C ai_services/recommendation test-contract
make -C ai_services/recommendation test-integration
make -C ai_services/recommendation lint
make -C ai_services/recommendation typecheck
python3 -m pytest tests/test_suite_client.py -p no:cacheprovider
make -C ai_services test-contracts
```

## Acceptance Criteria

- Bundle composition deterministically selects one priced product per requested
  category from labelled-synthetic fixtures and respects the budget.
- Every bundle and substitution is revalidated and remains `feasible=false`
  while missing validation arms return explicit `needs_input` violations.
- Substitution produces a new revision and flags category-breaking swaps.
- Unlabelled products cannot be silently treated as real composition evidence.
- The root suite no longer requires recommendation bundles to claim
  feasibility under ADR-0013 logic-only scope.

## Completion Evidence

Completed on 2026-09-15.

Files changed:

- `ai_services/recommendation/src/curalina_recommendation/domain/product.py`
- `ai_services/recommendation/src/curalina_recommendation/adapters/__init__.py`
- `ai_services/recommendation/src/curalina_recommendation/adapters/logic_only_bundle_composer.py`
- `ai_services/recommendation/src/curalina_recommendation/api/application_services.py`
- `ai_services/recommendation/src/curalina_recommendation/api/repository.py`
- `ai_services/recommendation/pyproject.toml`
- `ai_services/recommendation/Makefile`
- `ai_services/recommendation/README.md`
- recommendation unit/contract/integration tests listed by git diff
- `ai_services/suite_client.py`
- this packet
- `agent_instructions/STATUS.md`

Commands run and actual results:

- `make -C ai_services/recommendation test` — passed: 264 unit tests, 91%
  aggregate branch coverage; `logic_only_bundle_composer.py` at 84%.
- `make -C ai_services/recommendation test-contract` — passed: 17 tests.
- `make -C ai_services/recommendation test-integration` — passed: 4 tests.
- `make -C ai_services/recommendation lint` — passed: Ruff reports all checks
  passed.
- `make -C ai_services/recommendation typecheck` — passed: mypy strict reports
  no issues in 55 source files.
- `python3 -m pytest tests/test_suite_client.py -p no:cacheprovider` from
  `ai_services` — passed: 5 tests.
- `make -C ai_services test-contracts` — passed: 7 tests.

Limitations:

- This is not R03 acceptance, not a G2 sign-off, and not evidence that bundle
  composition meets acceptance thresholds. It is the ADR-0013 permitted phrase:
  R03 no-go on real furniture data; composition logic exercised against
  labelled-synthetic fixtures only.
