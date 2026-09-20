# Agentic implementation plan

## Purpose

This guide turns the architecture pack into implementation instructions for agents. It defines the order of work, required evidence, local run expectations and UI integration boundary. It does not authorize skipping the notebook and evaluation gates in the earlier guides.

The end state is three independently runnable AI services plus a local suite runner. The current TypeScript UI integrates through HTTP adapters and feature flags. Each service remains testable alone, and the suite proves that contracts, IDs, revisions, assets and failure states move correctly across boundaries.

## Non-negotiable invariants

- Recommendation, variant generation and room generation remain separate services with separate packages, local databases and tests.
- Shared contracts are versioned documents or schemas, not a shared mutable database or common business-logic package.
- The existing UI is a consumer and orchestrator. It does not own AI service business rules.
- Notebooks prove model-backed behaviour before services make model-backed claims.
- Fast tests do not require GPU, Internet, cloud accounts, model downloads or customer data.
- Image APIs enqueue durable jobs; model inference runs in workers, not API request handlers.
- Job success, candidate review and commercial availability are separate states.
- Fallback fixtures may preserve integration, but they must be labelled and never presented as evidence of model quality.

## Agent work packet format

Every task assigned to an agent should include:

| Field | Required content |
|---|---|
| Service | recommendation, variant_generator, room_generator, contracts, suite or ui_adapter |
| Phase | A0 through A6 from the delivery gates |
| Inputs | guide files, templates, fixtures, source data and decisions the agent may rely on |
| Allowed files | directories the agent may edit |
| Deliverables | code, docs, fixtures, reports or tests expected |
| Local commands | exact commands that must pass before completion |
| Boundaries | files, services or behaviours the agent must not change |
| Done evidence | test output, generated report path, ADR, limitation or blocked reason |

Do not assign an open-ended "build the AI" task. Assign one service, one phase and one measurable result.

Use the template at `../templates/agent_work_packet.md` when creating an implementation task.

## Phased build sequence

| Phase | Objective | Main outputs | Exit criteria |
|---|---|---|---|
| A0 Scaffold | Create local service skeletons and command surface | `ai_services/` layout, READMEs, Makefiles, settings objects, fake app entry points | `make setup-all` and service `make test` commands exist and document optional missing assets |
| A1 Contracts | Freeze request/response meaning before business logic | DTOs or schemas, JSON fixtures, error vocabulary, version checks | contract tests pass and reject unsupported major versions |
| A2 Package use cases | Implement framework-neutral domain/application logic | typed domain, use cases, ports, fake adapters, unit tests | service-local fast tests pass without external systems |
| A3 APIs and workers | Expose use cases through loopback HTTP and durable jobs | APIs, SQLite repositories, workers, idempotency, cancellation, restart recovery | integration tests cover lifecycle and sanitized failures |
| A4 Suite integration | Prove services work together over HTTP | suite runner, fixture client, import/export flow, content-hash checks | local suite passes without shared paths or shared DB access |
| A5 UI adapter | Connect current app through feature-flagged HTTP adapters | TypeScript adapter layer, env settings, persistence of service IDs/revisions | adapter fixture tests pass and legacy path remains switchable |
| A6 Evaluation handoff | Decide whether model-backed capability is accepted | experiment reports, ADRs, held-out results, known limitations | reviewer decision is adopt, revise, reject or insufficient evidence |

Phases are cumulative. A model adapter can be scaffolded in A2, but cannot become an accepted path until A6 records evidence.

## Workstream responsibilities

Recommendation agents build catalogue import, canonical product records, design profiles, ranking, bundle composition, substitutions and explanation output. They own no image pixels and must return explicit no-solution responses when constraints cannot be met.

Variant agents build asset import, masks, colour transformation, durable variant jobs, candidate review and export. They own no supplier pricing or purchasable SKU creation.

Room-generation agents build room asset import, render request validation, render planning, durable render jobs, candidate evaluation and review. They cannot select substitute products to make rendering easier.

Suite agents build shared fixtures, local start/check scripts and cross-service smoke tests. They do not create business rules.

UI-adapter agents map current app records to service contracts and persist returned service state. They do not connect services directly to the app database.

## Local run contract

Each service must run alone from its directory:

```bash
make setup
make test
make test-contract
make test-integration
make run-api
```

Image services also run:

```bash
make run-worker
make test-worker
```

The suite must run from `ai_services/`:

```bash
make setup-all
make test-all
make test-contracts
make run-suite
```

`run-suite` starts APIs on 8101, 8102 and 8103 unless overridden. It should print the effective settings, health-check each service, run a fixture flow and exit non-zero on contract mismatch. Long-running workers must have clear shutdown behaviour.

## UI integration path

Use feature flags and URLs:

```bash
CURALINA_AI_SERVICES_ENABLED=false
CURALINA_RECOMMENDATION_URL=http://127.0.0.1:8101
CURALINA_VARIANTS_URL=http://127.0.0.1:8102
CURALINA_ROOMS_URL=http://127.0.0.1:8103
CURALINA_AI_CONTRACT_VERSION=1.0
```

When enabled, the app adapter should:

1. Convert quiz responses into a DesignProfile.
2. Import or reference product catalogue snapshots through the recommendation contract.
3. Store bundle IDs, revisions and explanation summaries on render-related records.
4. Upload/import product and room assets into the owning image services.
5. Store variant/render job IDs, candidate IDs, review IDs and service schema versions.
6. Display structured failure states instead of generic generation failures.

The adapter should remain thin. If mapping requires a business decision, add the decision to the service contract or an ADR rather than hiding it in UI code.

## Testing ladder

Agents should add tests in this order:

1. Domain unit tests for invariants and edge cases.
2. Contract tests for request/response fixtures, errors and versioning.
3. Adapter integration tests for local SQLite/filesystem behaviour.
4. Worker lifecycle tests for claim, lease, cancellation, retry and restart.
5. Suite tests for HTTP import/export between services.
6. UI adapter fixture tests for current app mapping.
7. Model smoke and evaluation tests only in marked slow groups.

Coverage targets apply to domain/application packages, but every hard constraint and failure transition must have named tests even if coverage is already above the threshold.

## Blocked-work handling

If an agent lacks product assets, designer labels, hardware, credentials or a required decision, it should:

1. Keep contract and fake-adapter tests passing.
2. Record the blocker in the relevant experiment report or ADR.
3. Return a structured no-go or needs-input result.
4. Avoid weakening acceptance criteria or presenting fixtures as real model evidence.

Blocked model work does not block local service scaffolding, contract tests or UI adapter fixture work.
