# Agent instructions — how to use this folder

This folder exists so that one person can hand one file to one coding agent
and get a complete, tested, notebook-proven slice of a future-state AI
service back — without that agent having to independently reverse-engineer
`architecture/`, `docs/`, and `agentic_flow/` first.

Each numbered file below is **self-contained**: it names, in read order,
every other document the agent needs, and it will not skip a step because
the agent "should already know" something from a different file. Give an
agent exactly one of these files as its brief.

## Why `agentic_flow/` is the source of truth, not `architecture/`

`architecture/` (Sept 11) is the original design pack. `agentic_flow/`
(Sept 12) is a same-project audit pack that corrects a load-bearing mistake
in the original (this is a deterministic rules engine with a few
inference-only model calls, not a trained ML system — see
`agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`), fills in designs the
original left out (the design-rules engine, all three technical designs,
the notebook standard), and formally supersedes
`architecture/guides/11_agentic_implementation_plan.md` with per-service
workflow docs. `agentic_flow/AMENDMENTS.md` lists every targeted correction
to apply on top of the `architecture/guides/0X_*.md` files. Every file in
this folder tells the agent to read the amendment before the guide it
corrects — do not remove that step even if it looks redundant.

`docs/` describes the **existing production TypeScript/Express app**
(current state). It is only relevant as the thing the UI adapter maps
*from* — never as a spec for the new services.

Note: `agentic_flow/` is listed in `.gitignore` (`/agentic_flow/`) — it
stays local, not committed. That's intentional and pre-dates this folder;
these instruction files simply point into it by path. If you ever regenerate
or move `agentic_flow/`, keep the same relative paths or update the numbered
files below.

## Build order

The design-rules engine has no client-input or GPU dependency and unblocks
the other two model-bearing services (both recommendation's bundle
composition and room generation's conditioning consume it, pinned by
`rules_version`). Everything else can start in parallel after that, subject
to each service's own A0–A3 vs. real-logic gating (see the gate legend
below).

1. **[00_design_rules_engine.md](00_design_rules_engine.md)** — shared
   `curalina_design_rules` library. Start first; no external blockers on A0–A2b.
2. **[01_recommendation_service.md](01_recommendation_service.md)** — can
   start in parallel with (1); its bundle-composition step (A2 step 5)
   depends on (1) being at least at A2.
3. **[02_variant_generator_service.md](02_variant_generator_service.md)** —
   can start in parallel; A0–A3 have no dependency on product photos, but
   V01 (and anything claiming real-model accuracy) is blocked until real
   upholstery images are supplied.
4. **[03_room_generator_service.md](03_room_generator_service.md)** — can
   start in parallel; depends on (1) for conditioning and consumes (2) and
   (3)'s exports only over HTTP, never shared storage.
5. **[04_contracts_suite_and_ui_adapter.md](04_contracts_suite_and_ui_adapter.md)**
   — contracts stewardship and the local suite runner start week 1 and run
   continuously; the UI adapter section only starts once recommendation
   reaches A3/A4 and all three services' A1 contracts are stable.

## The two gate systems — read before assigning any phase

Every file below repeats this because conflating the two is the single
easiest mistake to make:

| System | Measures | Defined in |
|---|---|---|
| Notebook/stage gates: `R01–R03`, `V01–V03`, `G01–G03`, plus stage evidence `G0–G5` | Whether a *capability* is proven with real or clearly-labelled-synthetic evidence | `agentic_flow/16_notebook_standard.md`, `architecture/guides/09_delivery_gates.md` |
| Agent phases `A0–A6` (`A2b` added for the rules engine) | Whether a *service* is built to a level of completeness | the per-service `agentic_flow/*_workflow.md` files, `agentic_flow/AMENDMENTS.md` A7 |

A0/A1 and the fake-adapter parts of A2 need no notebook evidence and start
immediately. Real-logic extraction in A2 requires its matching notebook to
be frozen and reviewed first. A3 only needs the fake-adapter version of A2.
A6, or any claim that a real checkpoint "meets acceptance thresholds",
requires the matching stage gate (G1/G2) — no agent phase substitutes for a
missing stage gate. If a phase's done-evidence asks for a gate that hasn't
been reached, the correct move is to say so and stop, not lower the bar.

## Non-negotiable invariants (apply to every file in this folder)

- Recommendation, variants, and room generation stay separate services:
  separate packages, separate local databases, separate tests. No shared
  Python package except `curalina_design_rules`.
- Shared contracts are versioned documents/schemas, never a shared mutable
  database or common business-logic package.
- Fast tests never require GPU, internet, cloud accounts, model downloads,
  or customer data.
- Image APIs enqueue durable jobs; inference runs in workers, never in the
  API request handler.
- Job success, candidate review, and commercial availability are three
  separate states — never collapse them.
- When a rule, threshold, or input is undefined, the code returns
  `needs_input` and cites the blocking `OQ-xxx` ID from
  `agentic_flow/open_questions.yaml`. Never invent a default, never
  fabricate data to make a demo look complete.
- A notebook cell may contain narrative, a plot, or a call into the
  package — never business logic. Logic goes into the package first; the
  notebook only ever calls it (`agentic_flow/16_notebook_standard.md`).

## The packet skeleton every phase must be filled against

`architecture/templates/agent_work_packet.md` is the literal form to copy
per phase (Task / Objective / Context / Allowed files / Do not change /
Deliverables / Local commands / Acceptance criteria / Known blockers /
Completion evidence). `agentic_flow/EXAMPLE_work_packet_rules_engine.md` is
the calibration example — it shows what "full context" actually looks like:
exact source paths, allowed files enumerated, blocked items called out by
`OQ-xxx` ID with the required `needs_input` behavior, tests named
individually rather than as a coverage percentage, and completion evidence
that's checkable without re-deriving the work.

## What "one file, whole service" means concretely

Each numbered file below will walk the agent through, in order: scaffold →
contracts → domain/application logic with tests → API/worker → suite
participation → notebook-backed evaluation → handoff decision. By the end
of following one file, the agent should have produced: a working package,
a full unit/contract/property test suite, filled-in notebooks with decision
records, and an honest statement of which gates are met versus blocked.
