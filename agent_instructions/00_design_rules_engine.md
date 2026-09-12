# Build brief: `curalina_design_rules` (shared design-rules engine)

Give this file to one agent. It is the only file that agent needs to
scope, build, test, and prove this service end to end. Follow the reading
order below before writing any code — do not skip to the technical design
without the framing documents first, and do not substitute your own
judgment for an undefined rule (see "Blocked inputs" below).

## What you are building

A shared, pure-Python library, `curalina_design_rules`, that encodes the
Curalina design/style/spatial rulebook as frozen, versioned data structures
and pure functions. It is the one documented exception to "no shared Python
package" in this project: both the recommendation service and the room
generator consume it, pinning a `rules_version`. It has no HTTP API of its
own, no database, no GPU dependency, and no client-input blocker — it can
start on day one and should be the first service built.

## Required reading, in this order

1. This file.
2. `architecture/templates/agent_work_packet.md` — the packet skeleton you fill per phase.
3. `agentic_flow/EXAMPLE_work_packet_rules_engine.md` — a fully worked example packet (`RULES-A2b-01`) for *this exact service*. Treat its structure, level of detail, and closing checklist as the bar every packet you write must clear.
4. `agentic_flow/00_agentic_workflow_overview.md` — the two gate systems, non-negotiable invariants, and work-packet discipline.
5. `agentic_flow/AMENDMENTS.md` — read amendment A1 and A2 specifically (they define this service's existence and boundary; the original `architecture/` pack does not have it).
6. `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` — ADR-0001: confirms this is a deterministic rules engine, not an ML system, and pins the shared stack (Pydantic v2, `decimal.Decimal` money, integer-mm units, YAML rules compiled to frozen dataclasses, pytest + hypothesis, Ruff + mypy strict).
7. `agentic_flow/12_design_rules_engine.md` — the actual technical design: types, module map, the pipeline-ordering invariant, the spatial engine, rule tables, and build order. This is your primary spec.
8. `agentic_flow/style_constitution.yaml` — encoded style rules (constitution §1, §3, §7).
9. `agentic_flow/spatial_rules.yaml` — encoded spatial/clearance rules (§9, §6.6).
10. `agentic_flow/open_questions.yaml` — the 12 blocking gaps in the rulebook (OQ-001 through OQ-012). Read all of them now, not as you hit each one.
11. `agentic_flow/16_notebook_standard.md` — required 7-section structure and manifest cell for any notebook you create.
12. `architecture/guides/08_engineering_and_tests.md` and `09_delivery_gates.md` — general test matrix, coverage target, and the gate legend context.

## Non-negotiable invariants for this service specifically

- A blocked or undefined rule returns a `Violation`/`needs_input` result citing the exact `OQ-xxx` ID — it never returns a guessed threshold or silently passes. OQ-001 (CMR formula undefined) and OQ-007 (anchor hex library missing) are the two most likely to be hit first; expect to hit them in your first packet.
- Every rule output must be traceable to a `source_section` in the constitution/spatial YAML — no rule fires without a citation.
- No pandas DataFrame, no I/O, no framework import anywhere in the rules engine itself — pure functions over frozen dataclasses only, so both recommendation and room-generation can call it synchronously with no adapter.
- Consumers pin an exact `rules_version`; a version bump here is a breaking-change event for both consumers and must be flagged as such.

## Phase-by-phase build (fill one `agent_work_packet.md` per phase)

There is no single `design_rules_engine_workflow.md` covering every phase —
`agentic_flow/12_design_rules_engine.md`'s build order plus the example
packet's `A2b` are your two sources for phase content. Structure your work
as:

- **A0 — Scaffold:** package skeleton (`pyproject.toml`, `src/curalina_design_rules/{types,constitution,spatial,pipeline}/`), no rule logic yet, `make setup` and `make test` pass clean on an empty package.
- **A1 — Contracts:** frozen dataclass/Pydantic types for every entity the rulebook references (per the type map in `12_design_rules_engine.md`), with fixtures — no rule evaluation logic yet.
- **A2 — Constitution + spatial rule loaders:** parse `style_constitution.yaml` and `spatial_rules.yaml` into the frozen structures from A1; unit test every parsed rule against the source YAML section it claims to represent.
- **A2b — Rule evaluation (this is the gate named in `agentic_flow/AMENDMENTS.md` A7):** implement the evaluation pipeline in the order specified by `12_design_rules_engine.md`'s pipeline-ordering invariant. Use `EXAMPLE_work_packet_rules_engine.md` as your literal template for this packet — it already specifies ~15 named unit tests plus 2 hypothesis property tests, a `make test` budget under 30s CPU-only, `mypy --strict` clean, and the exact `needs_input` behavior for OQ-001. Reuse those test names; do not invent a different test list.
- **A3 — Consumer-facing API surface (in-process, not HTTP):** the stable Python entry points recommendation and room-generation will import, plus a golden-scenario fixture set.
- **A6-equivalent — Conformance notebook and handoff:** notebook `D01_rules_conformance` (see `16_notebook_standard.md`'s inventory table) reproduces the four golden scenarios described in `12_design_rules_engine.md` §8 and ends with a decision record (accept / accept-with-limitations / no-go, listing every unresolved `OQ-xxx`).

## Tests you must produce

Named unit tests per rule family (style, spatial/clearance, pipeline
ordering), plus the hypothesis property tests specified in
`EXAMPLE_work_packet_rules_engine.md`. Coverage target ≥85% branch on the
whole package (`architecture/guides/08_engineering_and_tests.md`). No test
requires GPU, internet, or external services.

## Blocked inputs — do not paper over these

Enumerate every `OQ-xxx` your implementation actually touches in the
packet's "Known blockers" section, with the concrete behavior (`needs_input`
+ citation) your code exercises for each. At minimum expect: OQ-001 (CMR
formula), OQ-007 (anchor hex library), OQ-009 (catalogue attributes) if your
rules reference catalogue data, OQ-011 (no furniture catalogue) and OQ-012
(millwork scope) if in scope for your current packet.

## Definition of done for this file

- `make test` passes with every mandatory named unit test present and
  green, hypothesis property tests included.
- `mypy --strict` and Ruff are clean.
- `D01_rules_conformance` notebook exists, follows the 7-section standard,
  and ends in a written decision record.
- Every blocked rule path returns `needs_input` with a correct `OQ-xxx`
  citation — verified by a dedicated test per blocker, not just observed
  once.
- Completion evidence names exact files changed, exact commands run and
  their results, and which gate (A2b) is or is not met, honestly.
