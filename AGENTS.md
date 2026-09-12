# AGENTS.md — Curalina agent operating model

Root instruction file for agentic coding tools. Codex and other `AGENTS.md`-
aware tools load this automatically. Claude Code loads `CLAUDE.md`, which
points here for the roster and coordination model so the two never drift.

## 1. What this repository is

Two halves, routinely confused — keep them apart.

**The existing product.** A TypeScript/React + Vite client with an
Express/Drizzle (PostgreSQL) server and Firebase functions. Quiz-driven room
design, product scoring, AI image generation, cart and checkout, auth, admin
tooling. It runs today. Documented in `docs/` — `PLATFORM_GUIDE.md`
(exhaustive: schema, routes, env vars, generation pipeline), `replit.md`
(orientation), `CURALINA_FULL_DOCUMENTATION.md` (legacy health-check
report), plus design, migration, sync, and logging guides.

**The future state.** Separate Python services — recommendation (`8101`),
variant generation (`8102`), room generation (`8103`) — plus one shared pure-
Python library, `curalina_design_rules`. Specified in `architecture/` and
`agentic_flow/`. Not yet built.

`docs/` describes what exists. It is **not** a specification for the new
services. Its only role in future-state work is telling the UI adapter what
it is mapping *from*.

## 2. Which pack is authoritative

`architecture/` (Sept 11) is the original design pack. `agentic_flow/`
(Sept 12) is a superseding audit pack that corrects it, fills in what it
omitted, and replaces `architecture/guides/11_agentic_implementation_plan.md`
with five per-service workflow docs.

**When the two disagree, `agentic_flow/` wins.**
`agentic_flow/AMENDMENTS.md` lists every targeted correction to apply on top
of the `architecture/guides/0X_*.md` files. Read the amendment before
trusting the guide.

The load-bearing correction: **Curalina is a deterministic rules engine with
a small number of inference-only model calls — not a trained ML system**
(`agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`). When a rule can express a
behavior deterministically, it does. The burden of proof sits on any
proposal to use a model instead.

Note: `agentic_flow/` is gitignored. It is intentionally local, present in
every working checkout, and treated as authoritative content — not scratch.

## 3. Building a service

Do not start from the packs cold. `agent_instructions/` holds one self-
contained brief per service, each naming every document to read, in order,
plus phase scope, mandatory tests, notebook requirements, and known blockers:

| Brief | Covers |
|---|---|
| `agent_instructions/00_design_rules_engine.md` | `curalina_design_rules` — build first |
| `agent_instructions/01_recommendation_service.md` | recommendation (`8101`) |
| `agent_instructions/02_variant_generator_service.md` | variants (`8102`) |
| `agent_instructions/03_room_generator_service.md` | rooms (`8103`) |
| `agent_instructions/04_contracts_suite_and_ui_adapter.md` | contracts, suite runner, UI adapter |

## 4. The agent roster

Nine reusable roles. Claude Code discovers them automatically from
`.claude/agents/`. Codex equivalents live in `.codex/agents/` and are invoked
explicitly — see `.codex/README.md`.

| Agent | Tier | Owns |
|---|---|---|
| `tech-lead` | Opus | Architecture, service boundaries, contract arbitration, build order, ADRs |
| `ai-ml-lead` | Opus | Model selection, evaluation methodology, **all gate sign-offs** |
| `delivery-coordinator` | Opus | Work-packet decomposition, routing, phase and gate status |
| `code-reviewer` | Opus | Review of code, architecture, and documents. Read-only |
| `python-services-engineer` | Sonnet | `ai_services/**` — domain logic, FastAPI, workers, tests |
| `typescript-app-engineer` | Sonnet | `client/`, `server/`, `functions/`, and the UI adapter (A5) |
| `ml-notebook-engineer` | Sonnet | R/V/G/D notebooks, evaluation runs, notebook-to-package extraction |
| `contracts-qa-steward` | Sonnet | `contracts/v1`, suite runner, cross-service consistency |
| `research-scout` | Haiku | Fast read-only retrieval across the doc set, with citations |

**Why these tiers.** Opus where a wrong call is expensive and hard to detect
— architecture, gate decisions, review, decomposition. Sonnet for
implementation volume, where the specification is already written down and
tests catch errors. Haiku for retrieval, which is high-frequency and
verifiable on sight; routing lookups here keeps expensive agents' context
free for judgment.

## 5. How work flows

```
architecture settled
  └─ tech-lead ratifies design, writes ADR
       └─ delivery-coordinator decomposes into work packets (one service, one phase, one result)
            ├─ python-services-engineer   ─┐
            ├─ typescript-app-engineer     ├─ implement against the packet's allowed-files list
            ├─ ml-notebook-engineer        │
            └─ contracts-qa-steward       ─┘
                 └─ code-reviewer reviews before the packet is marked done
                      └─ ai-ml-lead signs the stage gate (or declines)
                           └─ delivery-coordinator updates status
```

Escalation: engineer → `tech-lead` for a design question a packet does not
answer; `contracts-qa-steward` → `tech-lead` for cross-service conflicts
(never resolved unilaterally); anyone → `ai-ml-lead` before claiming a model
result. `research-scout` is called by anyone, at any point, for lookups.

## 6. The two gate systems — do not conflate them

| System | Measures | Defined in |
|---|---|---|
| `R01-R03`, `V01-V03`, `G01-G03`, `D01`, plus stage evidence `G0-G5` | Whether a **capability is proven** | `agentic_flow/16_notebook_standard.md`, `architecture/guides/09_delivery_gates.md` |
| `A0-A6` (plus `A2b` for the rules engine) | Whether a **service is built** | the per-service `agentic_flow/*_workflow.md` |

A0, A1, and the fake-adapter half of A2 need no notebook evidence and start
immediately. Real-logic extraction in A2 waits for its notebook to be frozen
and reviewed. A3 needs only the fake-adapter A2 — a service can have a fully
working API and worker months before its model is approved, and that is a
healthy state. A6, or any claim that something "meets acceptance
thresholds," requires the matching stage gate.

**No agent phase substitutes for a missing stage gate.** If a phase's
done-evidence asks for a gate that has not been signed, say so and stop.
Only `ai-ml-lead` signs.

## 7. Invariants — every agent, every task

- Recommendation, variants, and rooms stay separate: separate packages,
  separate local databases, separate tests. The only shared Python package is
  `curalina_design_rules`, consumed with a pinned `rules_version`.
- Shared contracts are versioned documents and schemas — never a shared
  mutable database, never a common business-logic package.
- Cross-service traffic goes over public HTTP. No service opens another's
  SQLite file or reads its filesystem asset paths. The suite runner is an
  orchestration convenience, not a fourth business service.
- Image APIs enqueue durable jobs; inference runs in workers, never in a
  request handler.
- Job success, candidate review, and commercial availability are three
  separate states. Never collapsed.
- Money is `decimal.Decimal`. Dimensions are integer millimetres.
- Fast tests never require GPU, internet, model downloads, cloud accounts, or
  customer data.
- A notebook cell may hold narrative, a plot, or a call into the package —
  never business logic.
- Fallback and synthetic fixtures may preserve an integration. They are never
  evidence of model quality, and the label travels with every number derived
  from them.
- **Undefined means blocked.** When a rule, threshold, or input is not
  defined, return `needs_input` citing the `OQ-xxx` from
  `agentic_flow/open_questions.yaml`. Never invent a default, never fabricate
  data so a demo completes. `OQ-001` (CMR formula) and `OQ-007` (anchor hex
  library) are the two you will hit first.
- Work is assigned one packet at a time via
  `architecture/templates/agent_work_packet.md` — never as an open-ended
  "build the service" task. Calibrate against
  `agentic_flow/EXAMPLE_work_packet_rules_engine.md`.

## 8. Current blockers

`agentic_flow/open_questions.yaml` holds 12 open questions. Those gating real
work now: `OQ-001` CMR formula undefined; `OQ-007` anchor hex library
missing; `OQ-009` catalogue attributes; `OQ-010` room geometry and
measurement source (a single photo cannot certify dimensions); `OQ-011` no
furniture catalogue — blocks recommendation R03 and variants' V01 imagery;
`OQ-012` millwork scope.

## 9. Repository conventions

- Never commit secrets. `.env`, `.env.development`, and Firebase credentials
  stay out of commits and logs.
- Follow existing patterns in the file you are editing before introducing a
  new one.
- Default to no comments; write one only when the *why* is non-obvious.
- Report what you actually ran and what it actually returned. If you could
  not verify something — a UI change you could not load, a test you could not
  run — say so explicitly rather than implying success.
