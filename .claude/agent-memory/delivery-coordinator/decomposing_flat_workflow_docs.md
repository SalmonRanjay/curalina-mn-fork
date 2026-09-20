---
name: decomposing-flat-workflow-docs-into-packets
description: How to split a workflow doc that describes one flat phase with multiple deliverables into properly scoped sequential packets
metadata:
  type: feedback
---

When a `agentic_flow/*_workflow.md` phase (e.g. A5 "UI adapter") is written
as one flat phase with several deliverables and no `A0`-`A6` sub-breakdown
— unlike every other service's workflow doc in this project — do not
dispatch it whole. Split along its own required-mappings/deliverables
table into 2-4 sequential packets, each satisfying the same six-point bar
`agentic_flow/EXAMPLE_work_packet_rules_engine.md` sets for every other
packet (exact sources, exact allowed files, `OQ-xxx`-cited blockers, named
tests, checkable done-evidence, a stop condition).

**Why:** `AGENTS.md` §9's one-service/one-phase/one-measurable-result
discipline applies regardless of whether the source workflow doc itself
drew phase boundaries. A flat phase description is a gap in that doc, not
permission to dispatch an open-ended "build the whole thing" task.

**How to apply:** find the natural dependency chain inside the flat
phase's own deliverables/mapping table (in A5's case: scaffold+flag first,
since everything else needs it; then per-mapping-row slices grouped by
which real backend API surface they call). Make later packets depend
explicitly on earlier ones in the dispatch table. Before writing "the
service's real API accepts X", read the actual route/schema file (Pydantic
models, FastAPI decorators) rather than trusting the workflow doc's
mapping-table prose — in this project's recommendation service, the
"product row → Product + Asset refs" mapping row turned out to have no
real endpoint to call yet (`Product` domain deliberately omits
`asset_refs`, no per-asset import endpoint exists on recommendation),
which reshaped the packet split rather than being papered over.

See [[monolith-structure-gotchas]] for the specific facts this surfaced in
the UI-adapter decomposition.
