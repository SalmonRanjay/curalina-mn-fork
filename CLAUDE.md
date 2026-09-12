# Curalina — project guide for coding agents

## What this repository contains

1. **The existing product** — a TypeScript/React + Express monolith
   (Drizzle/PostgreSQL) implementing quiz-based room design recommendations
   and AI image generation today. This is the current, running system.
   Documented in `docs/` (`replit.md` for a quick overview,
   `PLATFORM_GUIDE.md` for the exhaustive feature/schema/API reference,
   `CURALINA_FULL_DOCUMENTATION.md` for a legacy health-check/fine-tuning
   report on that same monolith). `design_guidelines.md`,
   `DATA_MIGRATION_GUIDE.md`, `DATABASE_SYNC.md`, and `LOGGING_GUIDE.md` are
   operational references for that existing system only.
2. **The future-state design** — a set of new, separate Python AI services
   (recommendation, variant generation, room generation) plus a shared
   design-rules engine, meant to replace the ad hoc logic in the existing
   app's AI paths. This is planning/spec material, not yet built.
   Documented in `architecture/` and `agentic_flow/` (see below).

Do not conflate the two: `docs/` describes what exists; `architecture/` and
`agentic_flow/` describe what to build next.

## `architecture/` vs. `agentic_flow/` — which one is authoritative

`architecture/` (dated Sept 11) is the original future-state design pack:
system architecture, data contracts, per-service guides, delivery gates,
templates, and notebook skeletons.

`agentic_flow/` (dated Sept 12, one day later) is a **superseding audit
pack** on the same design. It corrects a load-bearing mistake in the
original — this is a deterministic rules engine with a few inference-only
model calls, not a trained ML system (`agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`)
— fills in designs the original left out entirely (the shared design-rules
engine, all three services' technical designs, a real notebook standard),
and replaces the single monolithic
`architecture/guides/11_agentic_implementation_plan.md` with five
self-contained per-service workflow docs.
`agentic_flow/AMENDMENTS.md` lists every targeted correction to apply on
top of the `architecture/guides/0X_*.md` files.

**Rule: when the two packs disagree, `agentic_flow/` wins.** Read the
relevant `agentic_flow/AMENDMENTS.md` entry before trusting an
`architecture/guides/` file at face value.

Note: `agentic_flow/` is listed in `.gitignore` — it is intentionally not
committed to this repository, but it exists in every local checkout that
does this work and is treated as authoritative content, not a scratch
folder. Do not delete it or assume its absence means it's unused.

## Building a future-state service

Don't start from `architecture/` or `agentic_flow/` cold. Use
**[agent_instructions/](agent_instructions/README.md)** — it contains one
self-contained build brief per service, each naming every other document to
read, in order, plus phase-by-phase scope, mandatory tests, notebook
requirements, and known blockers:

- [agent_instructions/00_design_rules_engine.md](agent_instructions/00_design_rules_engine.md) — shared `curalina_design_rules` library (build first)
- [agent_instructions/01_recommendation_service.md](agent_instructions/01_recommendation_service.md)
- [agent_instructions/02_variant_generator_service.md](agent_instructions/02_variant_generator_service.md)
- [agent_instructions/03_room_generator_service.md](agent_instructions/03_room_generator_service.md)
- [agent_instructions/04_contracts_suite_and_ui_adapter.md](agent_instructions/04_contracts_suite_and_ui_adapter.md) — shared contracts, local suite runner, and the existing app's feature-flagged adapter

Hand one of these files to an agent as its entire brief for that service.

## Cross-cutting rules that apply everywhere in this repo

- Recommendation, variants, and room generation are separate services:
  separate packages, separate local databases, separate tests. The only
  shared Python package is `curalina_design_rules`.
- Fast tests never require GPU, internet, cloud accounts, model downloads,
  or customer data.
- Image-generation APIs enqueue durable jobs; inference runs in workers,
  never in the request handler.
- Job success, candidate review, and commercial availability are three
  separate states — never collapse them.
- When a rule, threshold, or input is undefined, code returns `needs_input`
  and cites the blocking `OQ-xxx` ID from `agentic_flow/open_questions.yaml`.
  Never invent a default or fabricate data to make something look done.
- A notebook cell may contain narrative, a plot, or a call into a package —
  never business logic. See `agentic_flow/16_notebook_standard.md`.
- Work is assigned and completed one packet at a time via
  `architecture/templates/agent_work_packet.md`, filled per phase — not as
  an open-ended "build the service" task.
