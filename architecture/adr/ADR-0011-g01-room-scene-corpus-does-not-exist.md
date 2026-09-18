# Architecture decision record

ID: ADR-0011 — G01's five room scenes do not exist; no available imagery is an admissible substitute
Status: **accepted.** Input-availability ruling. G01 stays blocked, on `OQ-010`.
Owner and reviewer: `tech-lead`
Date: 2026-09-14

## Context

`agent_instructions/STATUS.md` has carried G01 (room-prep / homography
notebook) as queued for three sessions with the note that it was "still not
investigated for real blockers the way R02 turned out to have one". Twice now
a pre-dispatch investigation has found that a notebook's assumed input does
not exist — R02's 12-brief labelled evaluation set (which triggered the whole
`ADR-0006` methodology chain) and V01's ground-truth colour-variant pairs
(`ADR-0008`, 2 of 42 folders matched). G01 was never checked. This ADR checks
it.

### What G01 assumes exists

Three documents agree on the prerequisite, and it is specific:

- `architecture/notebooks/room_generator/01_room_inputs.ipynb`, Prerequisites
  cell: "**Five approved room scenes, confirmed measurements and reviewed
  product references.**"
- `agentic_flow/16_notebook_standard.md:112`: `G01_room_prep` — "Homography,
  masks, placement" — inputs "**Room photos, measurements (OQ-010)**".
- `agentic_flow/14_room_generation_technical_design.md:201`: G01's pass
  criterion is "**Image-space placement matches planned mm within tolerance
  on 5 scenes**".

So a G01 scene is not a photo. It is a tuple: a room photograph, **true
physical measurements of that room**, manually annotated floor corners for
the homography, and a planned placement in millimetres to compare the
image-space result against. The notebook's own promotion-decision cell states
the constraint that makes this irreducible: "**Do not infer exact real-world
measurements from image pixels.**"

### What actually exists

I searched the repository and every external corpus known to this project.

**Nothing in the repository.** There is no room-scene directory. The nearest
candidates are both in `attached_assets/` and both are disqualified:

- `attached_assets/generated_images/` — 20 files. The directory name is
  accurate: `contemporary_luxe_living_room.png`,
  `organic_modern_living_room.png`, `light_neutrals_interior_palette.png`.
  These are **AI-generated style boards for the quiz UI**. Synthetic rooms
  have no true measurements to be right or wrong about, so a homography
  cannot be scored against them at all.
- `attached_assets/stock_images/` — 24 files
  (`beautiful_modern_liv_cc3ef764.jpg`, `bedroom_interior_des_4257c07c.jpg`,
  …). Stock interior photography. Real photographs of real rooms, and
  **completely useless for G01**: no measurements, no camera pose, no scale
  reference, no known product placements, no rights to annotate them as
  Curalina reference scenes.
- The `attached_assets/render-*.png` files are the existing app's own AI
  render outputs — outputs of the system, not inputs to validating it.

**Nothing in the external supplier corpus.** `ADR-0008` already ruled on
`/Users/rjsalmon/Downloads/Supplier Images`: `ATRIANI` and `LUXUS` are
white-background **product** photography; `CELADON` is 62 framed artwork
prints; `LAZZONI` is lifestyle/in-situ photography — staged rooms, sometimes
with people, and **no measurements, no camera pose, no scale reference**.
`ADR-0008` stated this conclusion in advance and this investigation confirms
it: "**G01 is exactly as blocked as before.**"

**Nothing in the production app.** `quiz_responses.roomPhoto` and
`quiz_responses.floorplanUrl` (`shared/schema.ts:308-309`) are columns that
would hold *customer* uploads at runtime. They are a future data source, not
a dataset, and customer room photos are not usable as a development corpus
without a rights and privacy answer nobody has given.

### Why this is a harder blocker than V01's was

`ADR-0008` retired V01's blocker because real imagery turned up and the
problem became *methodology* — what to measure without ground truth. **G01
cannot follow that path.** Its pass criterion is a comparison against
measured millimetres. There is no reference-free reformulation of "image-space
placement matches planned mm" because the millimetres *are* the reference.
A room photo without measurements is not a partial G01 input; it is not a
G01 input.

This is `OQ-010` (`ROOM_GEOMETRY_SOURCE`, `blocking`, owner
`design_authority + client`). Per `ADR-0009`, the Design Manual's §10 STEP 2
(p162) mandates extracting room boundaries, windows, doors and estimated
ceiling height from an uploaded photo or floorplan but specifies **no method,
no accuracy requirement, no coordinate frame and no scale reference** — so
the manual does not resolve it either.

## Options

**(a) Dispatch G01 against stock or generated imagery.** Would produce a
notebook that runs, plots, and proves nothing — a homography fitted to
invented corners, scored against invented millimetres. This is the failure
mode the project has avoided three times; it is the worst option and it is
the most tempting one because the images are right there.

**(b) Dispatch G01 with synthetic, explicitly-labelled room fixtures.** A
legitimate pattern elsewhere in this project — `agentic_flow`'s gate tables
allow labelled-synthetic outcomes, and recommendation's A2 uses labelled fake
adapters. It fails here for a specific reason: a synthetic room has an exactly
known ground truth, so the homography is being validated against the same
generative model that produced it. It would validate the *arithmetic*, not the
*method*. That has some value, but it must not be called G01, because G01's
claim is about real scenes.

**(c) (chosen) Record the input as unavailable, keep G01 blocked on
`OQ-010`, and escalate the data need to the client as a concrete ask.**

**(d) Have someone photograph and measure five real rooms.** Actually the
correct long-run answer and the cheapest real unblock — five rooms, a tape
measure, and a corner-annotation pass. It is not a decision I can take: it
needs a person, rights, and a client-agreed measurement protocol. Named here
so it is on the table as a concrete request rather than an abstract blocker.

## Decision and rationale

**Option (c).** G01 is **blocked on `OQ-010`** and is not dispatchable. The
blocker is **data acquisition, not methodology and not engineering**.

Explicitly ruled inadmissible as G01 inputs:

1. `attached_assets/generated_images/**` — AI-generated, no true geometry.
2. `attached_assets/stock_images/**` — no measurements, pose, scale, or
   rights.
3. `attached_assets/render-*.png` — system outputs, not validation inputs.
4. `LAZZONI` in-situ photography — already excluded by `ADR-0008`; no
   measurements.
5. Customer `roomPhoto` / `floorplanUrl` uploads — no rights or privacy
   answer.

This list exists because the *tempting* substitute is the dangerous one. A
future session that finds `stock_images/modern_living_room_i_79b08ae6.jpg`
will reasonably think "real room photo, this might work". It does not, and it
should not have to re-derive why.

**Engineering that is not blocked.** G01 gates rooms' *model-backed* render
path. It does **not** gate rooms' remaining A3 engineering — durable job
storage, worker with claim/lease/fencing, checkpointing between staged
insertions, bounded attempt counts, and process-level serving
(`agentic_flow/room_generator_workflow.md:65-69`). That work uses the fake
`ImageEditor` adapter, needs no room scenes, and is dispatchable today. The
two have been conflated in the status doc's "rooms next steps"; they are
separate and only one is blocked.

**Concrete ask for the client** (`OQ-010`), stated as a shopping list rather
than a question, because "what is the room geometry source" has been open
without motion:

> Five real rooms. For each: photographs from the intended capture angle;
> measured floor dimensions; measured positions of every door and window
> opening along the walls; ceiling height; and — if available — the actual
> furniture present with its catalogue identity and measured position. Plus
> written permission to use them as a development and evaluation corpus.

The last clause is not boilerplate. `ADR-0008` raised unresolved usage rights
on the supplier imagery; acquiring a second corpus with the same gap would
repeat a known mistake.

## Consequences and reversal

Consequences:

- G01, G02 and G03 stay blocked, in that order — G02's prerequisite cell
  (`architecture/notebooks/room_generator/02_grounded_generation.ipynb`)
  names "G01 validated inputs", and `room_generator_workflow.md:23-26` makes
  the chain sequential.
- Rooms cannot reach A6. Its A3 and A4 are unaffected.
- `ADR-0008`'s downstream chain is untouched and remains the one real link
  between the product imagery and rooms:
  `ATRIANI base image → V01 colour transfer → cutout → rooms composite`
  (`agentic_flow/14_room_generation_technical_design.md:58`). That is
  downstream of G01 and does not advance it.
- No `curalina_rooms` code changes follow from this ADR.
- `agentic_flow/open_questions.yaml` is **not edited**. `OQ-010` is already
  `open` and `blocking` with the right owners; nothing to add.

**What would prove this decision wrong:**

- A measured room-scene set turns up somewhere I did not look. Given
  `ADR-0008` found the single most important file in the image corpus only on
  a second pass, this is a live possibility. The specific thing to look for
  is **measurements**, not photos — photos are common and worthless here.
- The client states G01's tolerance may be evaluated against floorplan
  drawings rather than photographs. Floorplans carry dimensions natively and
  `quiz_responses.floorplanUrl` already exists, which would change the
  problem substantially. This is worth asking directly as part of `OQ-010`.
- `ai-ml-lead` rules that a synthetic-room arithmetic check (option (b)),
  clearly labelled as not-G01, is worth running as a precursor. That is their
  call on evidence sufficiency, not mine — I am ruling only that it cannot be
  *called* G01.

**Reversal:** this ADR adds no code. It is reversed by the arrival of a
measured room-scene corpus, at which point G01 becomes dispatchable with no
rework — the notebook skeleton, the `curalina_rooms.domain.room_prep` and
`adapters.fake_room_prep` scaffolding all already exist and are untouched by
this ruling.

## Verification

- `architecture/notebooks/room_generator/01_room_inputs.ipynb` read in full
  (15 cells): Prerequisites cell names "Five approved room scenes, confirmed
  measurements and reviewed product references"; the four Step cells are
  **empty** (no code written); promotion-decision cell says "Do not infer
  exact real-world measurements from image pixels".
- `agentic_flow/16_notebook_standard.md:112` and
  `agentic_flow/14_room_generation_technical_design.md:201` read for G01's
  inputs and pass criterion.
- `agentic_flow/room_generator_workflow.md:19-31, 65-69` read for the gate
  chain and for A3's remaining engineering scope.
- Repository-wide search for room-scene directories: only
  `ai_services/room_generator` and `architecture/notebooks/room_generator`
  (code, not data).
- `attached_assets/generated_images/` — 20 files, listed and inspected by
  name. `attached_assets/stock_images/` — 24 files, same. Neither has any
  accompanying measurement file.
- `/Users/rjsalmon/Downloads/Supplier Images` — four directories confirmed
  (`ATRIANI`, `CELADON`, `LAZZONI`, `LUXUS`), matching `ADR-0008`'s inventory.
  No room-measurement data in any of them.
- `shared/schema.ts:292-323` read: `quiz_responses` has `roomPhoto` and
  `floorplanUrl` columns; `parsedRoomData` holds no positions (see
  `ADR-0010`).
- Design Manual §10 STEP 2 (p162), per `ADR-0009`'s admitted copy: mandates
  door/window extraction, specifies no method or accuracy. `OQ-010` unresolved.
