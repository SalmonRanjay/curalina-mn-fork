# Architecture decision record

ID: ADR-0015 — synthetic/default-dimension room mode may unblock E2E progress,
but does not unblock G01
Status: **accepted.** Product/architecture scope ruling.
Owner and reviewer: `tech-lead`
Date: 2026-09-15

## Context

`ADR-0011` correctly keeps G01 blocked on `OQ-010`: G01 is an evidence gate
for grounded room generation against real measured room scenes. A single
uploaded room photo or render can provide visual context, but it cannot certify
physical room dimensions, door/window positions, camera pose, or scale by
itself. That is why G01 needs measured scenes or floorplans with dimensions.

The client-facing product still needs to make progress before G01. The user
has approved a flag-based approach:

- Keep G01 blocked as a final/evidence deliverable.
- Do not let G01 block demo/E2E progress.
- Add known default dimensions per room/home category when dimensions are not
  supplied.
- Let the UI ask for dimensions explicitly.
- Allow synthetic room renders based on the rules engine, product imagery, and
  declared default dimensions.
- Make product image roots configurable: local development may use
  `/Users/rjsalmon/Downloads/Supplier Images`; production will later use an
  object-store-backed source such as S3, with storage/reference design still
  open.

## Options

**(a) Keep rooms entirely blocked until G01.** Rejected. It is correct for
evidence but unnecessarily blocks A4/E2E engineering, demo scaffolding, Docker
runtime work, UI flow discovery, and API contract iteration.

**(b) Treat inferred dimensions from a user-provided render/photo as G01
evidence.** Rejected. This would collapse advisory extraction into measured
truth. A render/photo without explicit dimensions or a scaled floorplan cannot
support the G01 claim that image-space placement matches planned millimetres.

**(c) (chosen) Add explicit room-input provenance modes and allow
synthetic/default-dimension rendering for E2E/demo progress.** This preserves
the integrity of G01 while allowing the system pipeline to move.

## Decision and rationale

Rooms will support explicit input provenance modes:

| Mode | Meaning | May support E2E/demo | May support G01 |
|---|---|---:|---:|
| `measured` | User/client supplied measured room dimensions, openings and ceiling height | yes | yes, if corpus/review requirements are met |
| `floorplan` | Geometry is extracted from or entered against a scaled floorplan | yes | likely, after method/tolerance ruling |
| `inferred_from_image` | Approximate geometry extracted from a room photo/render | yes | no |
| `synthetic_defaults` | Known default dimensions by room/home category drive a generated room | yes | no |

When explicit dimensions or a floorplan are absent, room generation may use
`synthetic_defaults`. Those defaults are product behavior, not evidence. Every
request, job, candidate, manifest, suite result, and UI copy must carry the
mode/provenance so synthetic output cannot be mistaken for grounded evidence.

The rules engine can guide the synthetic mode: room designation and default
dimensions establish the room geometry; product images imported through public
asset APIs become candidate references; render-plan construction places
instances according to deterministic rules and returns `needs_input` for any
rule whose required input is undefined. This is compatible with the standing
invariant that undefined means blocked for evidence, not that all engineering
must stop.

Product image sources must be configurable:

- Local development: `CURALINA_SOURCE_ASSETS_DIR=/Users/rjsalmon/Downloads/Supplier Images`
- Production later: an object-store asset provider, likely S3, with references
  persisted as asset IDs/content hashes rather than local filesystem paths.

The storage provider choice, bucket layout, CDN strategy, and ECR deployment
shape are deferred. The near-term engineering goal is a locally runnable,
Docker-compatible E2E path with clean service boundaries.

## Consequences and reversal

Consequences:

- `OQ-010` remains open and blocking for G01/G02/G03 evidence.
- Rooms A4 and E2E suite work may proceed with `synthetic_defaults` or
  `inferred_from_image` explicitly labelled.
- UI-adapter work should add explicit room dimension/floorplan inputs and show
  whether geometry is measured, floorplan-derived, inferred, or synthetic.
- The suite runner may exercise room rendering with synthetic/default geometry,
  but must not report G01/G02/G03 progress from that run.
- Docker work should be split per app: each service remains runnable alone from
  IntelliJ and may also participate in a root compose setup. Compose files may
  use separate service-specific files plus a shared include for common
  environment defaults.

Rejected claims:

- "G01 unblocked"
- "room generation meets acceptance thresholds"
- "image-derived dimensions are measured"
- "synthetic defaults validate grounded rendering"

Permitted phrasing:

> Room generation E2E may run in `synthetic_defaults` or
> `inferred_from_image` mode for demo/development. G01 remains blocked until a
> measured room-scene or accepted floorplan-derived corpus exists.

Reversal:

- This ADR does not need reversal when measured room data arrives. It remains
  the demo/E2E mode decision. G01 becomes dispatchable separately when
  `OQ-010` receives measured scenes or an accepted floorplan protocol.

## Verification

- User decision recorded on 2026-09-15: keep G01 blocked, but do not let it
  block progress; proceed with synthetic room render defaults and later UI
  dimension capture.
- `ADR-0011` reviewed: G01 remains blocked because measured dimensions are the
  evidence reference, not because the model merely lacks context.
- `agentic_flow/open_questions.yaml` reviewed: `OQ-010` remains open and
  blocking for room geometry source.
- `agentic_flow/room_generator_workflow.md` reviewed: A3/A4 engineering and
  fake/synthetic flows are separable from G01/G02/G03 evidence gates.
