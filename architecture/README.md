# Curalina standalone AI services architecture

Version 1.0 · 11 September 2026 · Status: proposed implementation blueprint

Build evidence in notebooks first, then promote validated logic into standalone Python services. This pack specifies work for teams; it does not implement the services or claim that models have passed evaluation. Notebook files are experiment workbooks with implementation slots, not finished model demos. One catalogue-audit notebook includes executable inspection code.

## Read in this order

1. [System architecture](guides/01_system_architecture.md)
2. [Local setup and repository conventions](guides/02_local_setup.md)
3. [Catalogue and shared contracts](guides/03_data_contracts.md)
4. [Recommendation](guides/04_recommendation.md)
5. [Product variants](guides/05_variants.md)
6. [Room generation](guides/06_room_generation.md)
7. [Model selection](guides/07_model_selection.md)
8. [Clean architecture and testing](guides/08_engineering_and_tests.md)
9. [Promotion and delivery](guides/09_delivery_gates.md)
10. [Source audit and open decisions](guides/10_source_audit.md)
11. [Agentic implementation plan](guides/11_agentic_implementation_plan.md)

Each workstream owns three numbered notebooks under `notebooks/`. Run them in order within that workstream. Use the shared templates under `templates/` to capture decisions and results. The JSON files are illustrative contract fixtures; they are not runnable server configuration or formally validated JSON Schemas.

## Boundaries

The initial scope remains one living-room pilot, three styles, colour-only product variants and a partial catalogue. Supplied data permits artwork ranking experiments now; complete furniture composition and upholstery variation need more assets. Standalone service contracts require no knowledge of the current Node/React application. Docker workflow, cloud topology and deployment strategy are deferred. Local durable jobs, clean dependency boundaries and explicit runtime configuration prepare services for those later decisions.

Implementation agents must treat this pack as the source of architectural intent. They may create service source, tests, fixtures and local scripts only after the relevant phase gate is satisfied. They must not collapse the three service boundaries, bypass notebook evidence for model-backed behaviour, or make the current UI the owner of recommendation, variant or rendering business rules.

## What success means

A fresh local checkout can repeat the selected experiments and their evaluations. A subsequent service implementation can execute the same validated use cases through HTTP without changing their business meaning. No performance, image-fidelity or production-readiness claim is made by this documentation alone.

The later implementation succeeds when each AI service can be installed, tested and run independently, and when a local suite can start the services together behind stable HTTP contracts for the existing UI to call. Suite integration proves transport, IDs, revisions and failure handling; it does not replace each service's own tests or model evaluation.
