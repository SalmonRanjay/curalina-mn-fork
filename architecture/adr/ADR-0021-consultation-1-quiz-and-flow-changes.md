# Architecture decision record

ID: ADR-0021
Status: accepted
Owner and reviewer: `tech-lead` (decision); raised by the project owner
directly ("the client's Consultation 1 changes the quiz questions, look and
feel, and implies changes to the recommender and backend. Analyse the impact
and write it into the ADRs/STATUS so the work can be replicated later from
those documents alone.")
Date: 2026-09-24

## Context

### C0 — What the document is, and what this ADR is for

"Consultation 1" is a 22-page PDF of client-authored UI mockups for the
end-to-end customer journey, with red annotations addressed to the
programmer. It is a **design direction from the client**, not a
specification: it has no data definitions, no API, and several internal
inconsistencies (see C6). It covers the whole journey, from choosing a room
to buying furniture and booking a concierge call:

| Pages | Surface |
|---|---|
| p1-p10 | Quiz: room, aesthetic, auth, materiality, atmosphere, pattern density, room-scoped practical touches (with dining seating and bedroom bed size), investment |
| p11-p12 | Verify + Refine gate before generation |
| p13 | Environmental Context (room photo and/or floorplan upload) |
| p14 | "Synthesizing Your Curation" loading screen |
| p15-p17 | Package paywall ($1,499 / $4,100), cart, payment |
| p18-p21 | Design reveal, AI-generated "About Your Design", curated selections, refine up to 3x with re-render, fabric samples ($35), concierge call |
| p22 | Product detail page with an AI-generated "From the Curator" note |

Artefacts (untracked, in this checkout):

- `docs/consultation-1/pages/page-01.jpg` ... `page-22.jpg`: the page
  images, the primary source for everything below.
- `docs/consultation-1/EXTRACTION.md`: a page-by-page extraction the
  orchestrating session verified against the images. An earlier automated
  extraction was discarded for invented content (see its provenance note).
  **Do not trust any other extraction.**

This ADR decides what the consultation changes in the architecture. It
separates what is built now from what is deferred, and it records enough
detail (option strings, vocabulary, look-and-feel tokens) that the quiz and
its downstream contract can be rebuilt from this file plus the page images.
Everything below was re-derived this session from source, the page images
and the supplier workbooks, not from summaries.

**Page images re-verified by `tech-lead` this session:** p2, p4, p8, p9, p10,
p12, p14, p22. EXTRACTION.md is accurate on all eight, with the minor
corrections listed in Verification.

### C1 — The consultation matches the client's supplier workbooks 3 x 3 x 3, not the vocabulary recommendation runs on today

The supplier "Programmer Handoff" workbooks are now at
`/Users/rjsalmon/Documents/Humber/misc.curalina/Supplier CSV Files/`. They
were previously in `~/Downloads` and are **not in the repo**. They were
measured this session with `openpyxl`, over every row:

| Workbook (sha256 prefix) | Rows | `Room Type` | `Design Style` | `Atmosphere` |
|---|---:|---|---|---|
| `Celadon CSV Programmer Handoff.xlsx` (`4f89885f`) | 62 | Living Room / Dining Room / Bedroom | Organic Modern 21, Mid-Century Scandinavian 19, Contemporary Luxe 22 | Bright & Airy 21, Warm & Balanced 18, Dark & Moody 23 |
| `Lazzoni CSV Programmer Handoff.xlsx` (`83ca4b3f`) | 159 | same three, `; `-delimited multi-values | Organic Modern 68, Contemporary Luxe 91 | Bright & Airy 70, Warm & Balanced 56, Dark & Moody 33 |
| `Luxus Programmer Handoff.xlsx` (`ad4e0fee`) | 689 | same three, `; `-delimited multi-values | Mid-Century Scandinavian 270, Contemporary Luxe 217, Organic Modern 209 | Bright & Airy 198, Warm & Balanced 292, Dark & Moody 199, **`Birght & Airy` 3 (typo)** |

The consultation's three rooms, three personas (via the p4 "Represents:"
annotations) and three atmospheres are **exactly** these values. The Design
Manual uses the same atmosphere triad as its tonality axis (STATUS "What
needs the client" item 11: "OM/MCS/CL x Bright & Airy / Warm & Balanced /
Dark & Moody"). The shared rules engine already has exactly these three
rooms (`ai_services/design_rules/src/curalina_design_rules/types/primitives.py:12-15`,
`RoomType = living_room | dining_room | bedroom`) and three style codes
(`StyleCode = OM | MS | CL`, `:6-9`).

What recommendation currently runs against **does not match**:
`ai_services/recommendation/src/curalina_recommendation/evaluation/vocabulary_map_v1.yaml`
was built from the older Four Hands / Moe's workbook (`ADR-0005`/`ADR-0007`).
Its `canonical_rooms` include `Home office`, `Nursery` and `Entryway`. Its
`canonical_styles` spell `Contemporary Lux` and `Mid-Century Scandi`. Its
`canonical_tags` contain `Dark & Moody` but **neither `Bright & Airy` nor
`Warm & Balanced`**.

**Admission gap:** no ADR has admitted the three handoff workbooks as a
catalogue source. `ADR-0005`/`ADR-0007` admitted the Four Hands / Moe's
workbook. `ADR-0008` admitted the supplier *images*, not these data sheets.
Other data defects measured here: 97 of 689 Luxus rows have `Retail Price`
= 0. `Return Policy` and `Delivery Options` are the literal `None` on
**every** row of all three workbooks. `Lead Time` is `None` on every
Lazzoni and Luxus row and `3-4 Weeks` on every Celadon row. No workbook has
a currency column.

### C2 — The workbooks already carry the consultation's "practical touches", verbatim

Lazzoni and Luxus have a `Practical Touches` column. Its values are
`; `-separated. Splitting on commas is wrong because the first option
contains a comma. The option strings are exactly the consultation's:

| Consultation option (p7-p9) | Catalogue rows (Lazzoni + Luxus) | Notes |
|---|---:|---|
| `Cozy, relaxing space for everyday comfort` | 108 + 408 | |
| `Pet friendly and durable fabrics` | 70 + 334 | |
| `Refined space for hosting and socializing` | 128 + 574 | p9's bedroom wording `Refined space for hosting guests` occurs in **0** rows |
| `Storage to keep everything tidy` | 44 + 122 | |
| `Dedicated media area for television` (p7, living only) | **0** | see `OQ-012` |
| `An architectural fireplace to anchor the room` (p7, living only) | **0** | see `OQ-012` |
| `Seating: 4/6/8/10/12` (p8) | 2 + 77 | Luxus: on Dining Table 62 times, also on 6 sofas and 9 coffee tables |
| `Double/Queen/King Size Bed` (p9) | 16 + 60 | Lazzoni: only on `Bed`. Luxus: `Bed` 26, plus sofa beds, sofas and sectionals |

So the client has already tagged the catalogue with the quiz's answers. This
is strong evidence for assumptions A2 and A3 (D2): seating is a
dining-table attribute and bed size is a bed attribute. It also shows the
tags are noisy (seating counts on coffee tables, bed sizes on sectionals).

The two options with zero catalogue rows are exactly what `OQ-012` covers:
Design Manual section 6.6 requires fireplace and media units to be
*generated* architecture, "No Standalone Catalog Pulls".

### C3 — Three vocabularies are on the wire today, and none is enforced

- **Snake-case codes:** `architecture/guides/03_data_contracts.md:12-14`
  ("Room Type: list of canonical room codes"; "Design Style: map to
  organic_modern, mid_century_scandinavian, contemporary_luxe";
  "Atmosphere: bright_airy, warm_balanced, dark_moody"). The suite already
  sends these: `ai_services/suite_client.py:286-288` has
  `"room_type": "living_room", "style": "organic_modern", "atmosphere": "warm_balanced"`.
  So does the rules engine's `RoomType`.
- **Four Hands-derived evaluation tags:** `vocabulary_map_v1.yaml`, which
  `ADR-0018` §D1 made the atmosphere authority.
- **Workbook display strings:** sent by the app. The in-flight
  `design-profile-mapper.ts` passes `quizResponse.roomType` verbatim and
  validates `atmosphere` against `["Bright & Airy", "Warm & Balanced", "Dark & Moody"]`.

`DesignProfileIn`
(`ai_services/recommendation/src/curalina_recommendation/api/schemas.py:55-69`)
types `room_type`, `style` and `atmosphere` as `str` with `min_length=1`,
so any spelling is accepted and nothing downstream detects a mismatch. It
also has `extra="forbid"`: the app **cannot send a new field until
recommendation accepts it**.

### C4 — `categories` has never had an honest source, and the new quiz makes that visible

`DesignProfileIn.categories` is required (`min_length=1`) and means product
categories: the suite sends `["sofa", "wall_art"]`. The mapper fills it from
`quizResponses.keyFeatures` (`design-profile-mapper.ts:169-172`). Under the
old quiz, `keyFeatures` held lifestyle feature ids like `Storage Solutions`
and `Comfortable Seat` (`FeaturesStepV2.tsx:46-73`), not product categories.
Under the new quiz it holds practical-touch sentences. `ADR-0018` traced
four chain breaks and missed this one, because the mapper never got past
`atmosphere`. As soon as `atmosphere` and `currency` resolve, the chain
sends sentences as product categories. Recommendation matches none of them
and returns an empty or insufficient bundle that looks like a catalogue gap
when it is actually a mapping bug.

`03_data_contracts.md:34` already names the right shape: "DesignProfile:
room_type, style, atmosphere, pattern_level, lifestyle requirements, ...
Pattern choices map to solids/accents/forward. Lifestyle fields are typed
requirements, not one free-text string."

### C5 — Most of the flow after the quiz assumes capabilities that do not exist

- **"See this in your space"** (p13 upload, p14 "dissolves into the final
  room render", p21 "Confirm and see this in your space"). This is a render
  of the customer's own room: `ADR-0020` mode G, blocked on `OQ-010`. Mode
  S (P1-P3 of dispatch item 27) renders an invented room and may not be
  described as "your space". Rooms currently produces **no pixels at all**
  (`ADR-0018` §C2).
- **Payment before reveal** (p15-p17). There is no payment processor,
  package model, tax logic, or returns policy text. The workbooks'
  `Return Policy` column is `None` everywhere, and p20's own annotation
  says the client has not decided whether returns are accepted.
- **Delivery promises** ("Get it Fri Jun 18 - Jun 20", p19; "8 - 16 weeks",
  p22). No data source: `Lead Time` is `None` for Lazzoni and Luxus, and
  `ADR-0013` records zero availability data anywhere.
- **AI-generated copy** (p18 "This is autogenerated from our AI"; p22
  "Maybe we should have the AI generate this message too? They aren't aware
  but the curator would be Genius"). No design, no model and no grounding.
  The p22 annotation raises a disclosure question (D10).
- **The p14 loading screen's own concept line** (on the image, omitted from
  EXTRACTION.md): "The loading state should feel like a bespoke piece of
  furniture being 'built' by the AI in real-time." The checklist ends
  "Finalizing room design" and dissolves "into the final room render". Both
  are claims the system cannot make today (D9).

### C6 — Internal inconsistencies in the document

- **Budget:** p10's bands run $20,000-$66,000+, p12's refine bands run
  $12,000-$31,000+, and p11's verify card shows $12,000-$15,000, which is
  not a p10 option.
- **Pattern wording:** p6 (`Just Solids / Patterned Accents / Pattern Forward`)
  differs from p12 (`Mostly Solids / A touch of pattern / Embrace pattern`).
- **Room label:** p8 has none. p9 changes "hosting and socializing" to
  "hosting guests".
- **Auth vs greeting:** sign-up (p3) collects no name, yet the reveal (p18)
  greets "{Customer's Name}" and the header shows initials ("KD").

### C7 — Work running in parallel this session

A `typescript-app-engineer` packet (dispatch item 28) is building the quiz
flow, auth page and loading screen. It adds four nullable columns to
`quizResponses` (`atmosphere`, `materiality`, `seatingCapacity`, `bedSize`),
with the hand-reviewed migration `migrations/0004_modern_wither.sql`
(exactly four `ADD COLUMN` statements). It also updates
`design-profile-mapper.ts` for `atmosphere` and the new budget bands. This
ADR does not re-decide that packet's scope. Where a decision below changes
something it touches, the change is assigned to a **later** packet (items
20, 29, 30) and is not applied mid-flight.

## Options

**On the wire vocabulary for `room_type` / `style` / `atmosphere`.**

- **(A) Workbook display strings on the wire** (`"Living Room"`,
  `"Contemporary Luxe"`, `"Bright & Airy"`). This is what the in-flight
  mapper does. Easy to read, but it contradicts `03_data_contracts.md` and
  the suite, and every typo in the catalogue (`Birght & Airy`) becomes a
  wire-level mismatch.
- **(B) Snake-case codes on the wire, display strings stored in the app**,
  with an exact closed lookup table in the mapper and the same
  normalisation in recommendation's importer. Matches the data contract,
  the suite and the rules engine.
- **(C) Keep `canonical_tags` as the authority** (`ADR-0018` §D1). Rejects
  2 of the 3 atmospheres the client actually uses. Not viable.

**On aesthetic (p2) vs materiality (p4)** (A1).

- **(A) One step.** Contradicted by the mockups: both screens exist, with
  different headings and interactions.
- **(B) Two steps; aesthetic drives `style`; materiality is stored only.**
- **(C) Two steps, both drive ranking.** Needs a combination rule for when
  they disagree (aesthetic = Organic Modern, materiality = Contemporary
  Luxe). The client has not given one, and inventing it is a business rule.

**On `categories`.**

- **(A) Keep sending `keyFeatures`.** Sends sentences as product categories.
  Rejected.
- **(B) Derive a room's required categories from a Design Manual room
  composition rule**, with `needs_input` if the Manual defines none.
- **(C) Hardcode a room-to-category list in the app.** This is business
  logic in the monolith, it is invented, and it is outside the rules
  engine. Rejected.

## Decision and rationale

**D1 — Aesthetic and materiality are two separate quiz steps (A1, option B).
`aesthetic` alone drives `style`. `materiality` is stored and not used for
filtering or ranking until the client confirms what it means.**

p11/p12 summarise only "YOUR AESTHETIC" using p2's captions, so p2 is the
screen the client treats as the style answer. p4's "Represents:"
annotations are the only written persona-to-style mapping, and they apply
to p4. p2's order is inferred from p4, because p2 caption 1 and p4 card 1
share "natural materials". The inference is recorded as such and is a
client ask (STATUS client item 15).

`materiality` goes into `quizResponses.materiality` as one of the three
catalogue style strings. It is **not sent to recommendation**, not even as
an optional field, because once a field is on the wire someone will rank on
it. Reversal: add it to `DesignProfileIn` (additive, minor) once the client
says what it means.

**D2 — Assumptions A2 and A3.** The unlabelled p8 screen is the **Dining
Room**. Seating (`4, 6, 8, 10, 12`) is asked **only** for Dining Room and
is single-select. Bed size (`Double Size Bed`, `Queen Size Bed`,
`King Size Bed`) is asked **only** for Bedroom and is single-select.
Neither is asked for Living Room.

C2 supports this beyond the mockup: the catalogue's `Seating: N` tags sit
mostly on dining tables, and its bed-size tags sit on beds. Both remain
assumptions until the client confirms (client items 16, 17). The in-flight
UI (`client/src/components/quiz/consultationOptions.ts:67-92`) already
implements this.

**D3 — The wire vocabulary is snake-case codes (option B). The app stores
the workbook display strings, and the mapper converts them with an exact,
closed lookup table.** No fuzzy matching, no case folding, no synonyms. An
unmapped value produces `needs_input` naming the field. The full tables are
in "How to replicate", §R3.

Rationale: one wire vocabulary, and it is the one the data contract, the
suite (`suite_client.py:286-288`) and the rules engine (`RoomType`) already
use. Recommendation's importer normalises the catalogue's display strings
to the same codes, as `03_data_contracts.md:12-14` already requires. The
`Birght & Airy` typo then becomes a counted importer rejection instead of a
wire mismatch.

This **supersedes `ADR-0018` §D1** (atmosphere from
`quizResponses.colorPalettes`, matched against `canonical_tags`). The new
quiz has a dedicated atmosphere step, `colorPalettes` is no longer written,
and `canonical_tags` lacks two of the three values. It also **withdraws
`ADR-0018`'s required amendment** to `03_data_contracts.md:14`. That row was
right all along. The amendment now needed is narrower and additive: see D12.

The in-flight mapper (item 28) validates display strings and sends them
verbatim. That is correct for its scope, because nothing reaches
recommendation yet (`currency` still fails closed). The code translation
lands in item 29 alongside the contract change, not mid-flight.

**D4 — `DesignProfileIn` changes, and the change is major.**

| Field | Change | Values |
|---|---|---|
| `room_type` | `str` becomes a closed enum | `living_room`, `dining_room`, `bedroom` |
| `style` | `str` becomes a closed enum | `organic_modern`, `contemporary_luxe`, `mid_century_scandinavian` |
| `atmosphere` | `str` becomes a closed enum | `bright_airy`, `warm_balanced`, `dark_moody` |
| `pattern_level` | **new**, optional | `solids`, `accents`, `forward` |
| `lifestyle_requirements` | **new**, optional list, no duplicates | `everyday_comfort`, `pet_friendly_durable`, `hosting`, `storage`, `media_area`, `fireplace` |
| `seating_capacity` | **new**, optional int | one of `4, 6, 8, 10, 12`; allowed only when `room_type = dining_room` |
| `bed_size` | **new**, optional | `double`, `queen`, `king`; allowed only when `room_type = bedroom` |
| `categories` | meaning unchanged (product categories) | see D5 |

Adding optional fields is additive. **Narrowing three `str` fields to closed
enums is breaking**, because a request that validates today can be rejected
tomorrow. So this is a **major version bump for recommendation's request
contract** (`ai_services/contracts/v1/CONTRIBUTING.md:3-5`). I am accepting
the break on the same reasoning as `ADR-0018` §D4: the failure it prevents,
a silently empty bundle from a misspelt room or style, is exactly what an
unvalidated string invites.

Consumers: the app (`design-profile-mapper.ts` / `recommendation-client.ts`)
and `ai_services/suite_client.py`, both in this repo. Both update in the
same sequence. Order is **recommendation first**, because `extra="forbid"`
would 422 any new field the app sent early.

An unknown enum value is a **contract error** (`422`, shared error
envelope), not `needs_input`. `needs_input` is for undefined *rules*. A
misspelt code is a caller bug.

**D5 — Practical touches are `lifestyle_requirements`, never `categories`
(option B for categories).** The mapper stops forwarding `keyFeatures` as
`categories` (C4). Recommendation derives a room's required categories from
`room_type` using a composition rule, which must come from the Design
Manual (`13_recommendation_technical_design.md:111` "pick one product per
required category" comes from section 9 and `04_recommendation.md`).

**I have not verified that the Manual defines a per-room category set.**
Item 29 must check the pinned PDF (`ADR-0009`) first:

- If the Manual defines the set, cite the page and encode it in
  `curalina_design_rules`.
- If it does not, recommendation returns `needs_input` for `categories`.
  Because no `OQ-xxx` covers this and ADRs do not edit
  `open_questions.yaml`, the gap is raised as a `design_authority` client ask
  (STATUS client item 27), and the `needs_input` detail names that ask until
  an `OQ` is minted.

**No hardcoded room-to-category list anywhere.** In the meantime, `categories`
keeps its current wire shape so item 28 is not disrupted. Its **source**
changes in item 29.

**D6 — What recommendation may and may not do with the new inputs.** The
`ADR-0006` §D2 leakage firewall keeps `Room Type`, `Design Style` and
`Tags` off `Product` and out of any `FeatureEncoder`. The consultation
makes the same fields the customer's primary query. This is allowed: a
query input is not a label leak. Using the *catalogue's* copies of those
tags to filter or rank is a different question.

| Use | Allowed now? | Why |
|---|---|---|
| Accept, validate and persist every new profile field; echo it in bundle provenance | **Yes** | Contract plumbing, no ranking claim |
| Use profile `style`/`atmosphere` as query text for existing encoders (`tfidf_encoder.py:33`, `minilm_encoder.py:66` build `f"{style} {atmosphere}"`) | **Yes, unchanged** | Already the case; query side only |
| Put catalogue `Room Type` / `Design Style` / `Atmosphere` / `Practical Touches` on `Product`, or anywhere a `FeatureEncoder` can reach | **No, pending `ai-ml-lead`** | Reverses `ADR-0006` §D2's structural firewall |
| Filter or rank candidates by catalogue tag equality (e.g. `Design Style == profile.style`) | **No, pending `ai-ml-lead`** | Same. See my recommendation below |
| Filter by `seating_capacity` / `bed_size` against catalogue `Seating: N` / `* Size Bed` tags | **No, pending `ai-ml-lead` and catalogue admission (item 35)** | These look like physical facts, but they live in a column with taste tags, and C2 shows they are noisy |
| Derive bed size or seating from product dimensions | **No** | Needs bed-width or per-seat numbers the Design Manual does not define. That is a blocked input, not a threshold to invent |
| `media_area` / `fireplace` requirements | **Returned as unmet with `needs_input` citing `OQ-012`**, per requirement, in the bundle's violations. The bundle is still returned | `ADR-0013` §D2.3: a validator that does not exist surfaces as `needs_input`, never a silent pass |
| Any statement that the bundle matches the customer's style/atmosphere or meets design rules | **No** | `ADR-0013` §D3 phrasing prohibitions remain binding |

My recommendation to `ai-ml-lead`, stated as an architecture view and not a
ruling on evidence: the client hand-tagged every product on exactly the
quiz's axes. **Tag-equality filtering is the deterministic, rules-first
answer this project's audit prefers** over any learned similarity. The
clean way to admit it is a separate `ProductTags` record that the Layer-1
filter can read and no `FeatureEncoder` can import. Any future R02-style
evaluation would then need labels that are not derived from these columns.
Whether that is acceptable, and what it does to the `insufficient_evidence`
ceiling, is `ai-ml-lead`'s call. It is escalated in STATUS item 29.

**D7 — Investment uses the p10 bands everywhere (A4). Refine (p12) reuses
the same five bands. The p11 and p12 figures are treated as mock
inconsistencies.** Stored `quizResponses.budgetRange` values use ASCII
hyphen-minus (U+002D) with no spaces:
`$20,000-$30,000`, `$31,000-$40,000`, `$41,000-$50,000`, `$51,000-$65,000`, `$66,000+`.
Display labels may use spaced hyphens or dashes. The mapper regex
(`design-profile-mapper.ts:112`) accepts only `-`, so a stored en dash
returns `needs_input("budgetRange")`.

Band to `furniture_budget_minor_units`: closed bands use the midpoint, and
`$66,000+` uses its lower bound (the item-28 mapper, `:119-129`). **This is
declared engineering policy, not a Design Manual rule**, in the same sense
as `ADR-0020` §D10. It is versioned with the mapper, recorded here, and
**not** tuned to make any output look better. What the investment covers
is unanswered: furniture only, or also the $1,499/$4,100 engagement fee,
delivery and tax (`03_data_contracts.md:34` `budget_inclusions`). Also
unanswered: whether a Harmonized package's budget is per room or total.
Both are client asks (items 18, 19). Until answered, the band is treated as
the **furniture budget for the one selected room**.

**D8 — Currency is CAD by default and configurable (A6, owner
instruction).** This is an **owner decision**, not an inference from p17's
Toronto address. `03_data_contracts.md:11` forbids inferring currency "from
dollar symbols or Canadian context", and that rule is respected: the owner
stated it.

Implementation (item 20): a new app setting `CURALINA_CURRENCY`, default
`CAD`, validated as a 3-letter uppercase ISO-4217 code. Invalid values fail
closed at startup, following the `CURALINA_CATALOGUE_SNAPSHOT_ID`
precedent. The mapper sends it instead of the hardcoded `"USD"`
(`design-profile-mapper.ts:194-205`). Recommendation's fixtures are already
CAD (`api/application_services.py:43`).

This closes the currency half of `ADR-0018` §D2. It does **not** establish
that the supplier workbooks' prices are CAD: no workbook has a currency
column, and Lazzoni is a Turkish manufacturer. That is a separate,
non-blocking client ask (item 26). If the answer is a different currency,
the importer converts it or rejects the rows. It never relabels them.

**D9 — Honesty rules for the in-scope screens (binding on item 28 and every
later packet).**

1. **Loading screen (p14).** Checklist ticks are bound to real state
   transitions, or they stop at the last state actually reached:
   - "Calibrating stylistic alignment": quiz saved and profile mapped.
   - "Optimizing procurement parameters" / "Curating Furniture & Finishes":
     recommendation returned a bundle.
   - "Finalizing room design": a render job reached a terminal state.

   "Finalizing room design" **never shows as checked** while rooms produces
   no image. The "dissolve into the final room render" ends instead in the
   render's real terminal state: today, `Results.tsx`'s honest
   `needs_input` / `failed` state. **No placeholder, stock or AI-generated
   stand-in render**, per `ADR-0018` §D7.3. The wireframe-chair animation
   and the timing directives are decorative and allowed.
2. **Verify card (p11)** shows the customer's actual stored answers,
   including their real investment band (never p11's `$12,000 - $15,000`).
   "Your design protocol has been generated" is replaced with neutral
   wording until something has been generated.
3. **Header initials (p4).** Initials come from real `firstName`/`lastName`
   only. Without a stored name the person icon stays. Initials are **never**
   derived from the email address.
4. **Reveal greeting (p18, deferred)** omits the name when none is stored.
   It never falls back to an email local-part.
5. **Quiz tile imagery.** The in-flight UI uses repo images under
   `@assets/generated_images/`. They are illustrative option tiles, not
   renders, which is acceptable. The client's own mockup photography is not
   supplied as assets; that is a rights/assets ask (client item 25).

**D10 — AI-generated copy (p18 "About Your Design", p22 "From the Curator")
is deferred. When built, it is deterministic first, fail-closed, and
disclosed.**

- **Default source, no model.** "From the Curator" uses the supplier's own
  `Product Overview` text verbatim; the column exists in all three
  workbooks. "About Your Design" uses a deterministic template filled only
  from stored profile fields and the actual bundle's catalogue attributes
  (style, atmosphere, named materials from `Structure` / `Upholstery` /
  `Fabric Composition`).
- **An LLM path** needs its own design: grounding set, prompt versioning,
  and a check that every material, product or claim in the output exists in
  the bundle. It is admitted only if `ai-ml-lead` accepts it through the
  gates. I am not persuaded a model adds enough over the template to be
  worth it. The burden of proof is on the model.
- **Fail-closed state** (`ADR-0016` reasoning). If generation fails, times
  out or fails grounding, the section is **omitted**: no heading and no
  canned "lorem" paragraph. The failure is logged. **No fabricated prose,
  no generic fallback paragraph presented as personalised.**
- **Disclosure.** The p22 annotation ("They aren't aware but the curator
  would be Genius") could mean the customer should not know the text is
  machine-written. **Machine-generated text may not be presented as the
  words of a human curator.** Whether "Genius" is a named AI persona, and
  how AI authorship is disclosed, is an owner/client decision (client
  item 22), not an engineering one.

**D11 — Payments, packages and the post-quiz journey are out of current
scope.** Why and what each needs is under "In scope now vs deferred". In
short, every one of them either reveals a render that cannot exist yet, or
needs client business facts nobody has given (processor, tax, returns,
package-to-room semantics). Building any of them now would mean fabricating
content or policy.

**D12 — Contract documents.** Two amendments are required. They are owned
by `contracts-qa-steward` in item 30 and are not made by this ADR. Both
follow the `agentic_flow/AMENDMENTS.md` targeted-correction pattern.

1. `architecture/guides/03_data_contracts.md:12` (Room Type) names the
   closed room code set `living_room, dining_room, bedroom`. Home office is
   out of scope for the quiz.
2. `03_data_contracts.md:34` (DesignProfile) names the D4 field codes for
   `pattern_level`, `lifestyle_requirements`, `seating_capacity`,
   `bed_size`.

## Impact matrix

| Component | Change | Additive / breaking | Owner / item | State |
|---|---|---|---|---|
| **Client UI** (`client/src/pages/Quiz.tsx`, `client/src/components/quiz/*`, auth page, `Loading.tsx`) | 7-step quiz becomes: room, aesthetic, materiality, atmosphere, pattern, practical touches (+ seating / bed size), investment, verify/refine, environmental context, loading. Home Office dropped. Styles go from 5 to 3. Light theme. Auth becomes email-first with progressive disclosure | UI only | `typescript-app-engineer`, item 28 | **In progress this session** |
| **`shared/schema.ts` + migration** | Four nullable columns on `quizResponses`: `atmosphere text`, `materiality text`, `seating_capacity integer`, `bed_size text`. Existing columns reused: `roomType`, `styles` (exactly one element), `patternPreference`, `keyFeatures` (practical touches), `budgetRange`, `roomPhoto`/floorplan | Additive | item 28 | In progress. Migration `migrations/0004_modern_wither.sql` |
| **Migration policy** | **Never `drizzle-kit push`**: it would drop 11 live columns absent from `schema.ts` (`renders.rating`/`rating_feedback`/`rated_at`, `users.duo_*`, five `documentation_sections` columns; STATUS session 18). Use `drizzle-kit generate`, read the SQL, confirm it contains only the intended `ADD COLUMN`s, then apply it by hand | Process | every schema packet | Binding |
| **Server adapter: `design-profile-mapper.ts`** | Item 28: `atmosphere` from `quizResponses.atmosphere` (exact three strings), p10 bands parse. Item 20: currency from `CURALINA_CURRENCY` (D8). Item 29: display-string to code lookup (D3), stop sending `keyFeatures` as `categories` (D5), new optional fields (D4) | App-internal | items 28, 20, 29 | Split across three packets on purpose |
| **Server adapter: `render-orchestrator.ts`** | Passes `profile.room_type` to rooms (`:383`). After D3 this is a code (`living_room`), which matches `curalina_design_rules.RoomType`. Harmonized (3 rooms) would be 3 render rows / 3 jobs, never one multi-room job. That is deferred (A5) | None now | item 29 (verify only) | No change in item 28 |
| **Recommendation service** | D4 contract (major bump). Importer normalises handoff workbook strings to codes and counts rejects such as `Birght & Airy`. Per-requirement `needs_input` for `media_area`/`fireplace` citing `OQ-012`. Categories from a Manual-sourced rule or `needs_input` (D5). Tag filtering pending `ai-ml-lead` (D6). A new evaluation vocabulary for the handoff workbooks replaces `vocabulary_map_v1.yaml` for any future run, and v1 stays pinned for R02's record | **Breaking (major)** | `python-services-engineer` + `contracts-qa-steward`, item 29 | Not started |
| **Catalogue admission** | Admit the Celadon/Lazzoni/Luxus handoff workbooks by provenance ADR, read in place and pinned by sha256 (hashes in C1), never copied into the repo (`ADR-0005`/`ADR-0009` pattern). Record the data defects | Provenance | `tech-lead`, item 35 | Not started. Gates item 24 against these workbooks |
| **Variants** | **No change.** The consultation has no customer-facing colourway selection. "Refine" swaps whole products (p21: Stella / Turner / Maho), which is recommendation substitution plus a rooms re-render, not recolouring. Fabric samples are physical fulfilment. `ADR-0017`'s admin-only scope stands | none | — | — |
| **Rooms** | **No change to item 27 P1-P3.** The refine-3x loop and per-package rendering need item 27 P1-P4 (real pixels). "In your space" needs mode G, which is blocked on `OQ-010`. Mode S output must never be labelled as the customer's room (`ADR-0015`, `ADR-0020` §C2). p13's floorplan guidance ("Label the length and width of walls in feet or inches") partly informs `OQ-010`, which is not closed by our reading | none | — | — |
| **Contracts suite** | `suite_client.py:285-292` profile already uses codes, so it keeps working after the major bump. Add optional D4 fields to one suite case. New contract test: the mapper's lookup tables and recommendation's enums are identical sets (replaces `ADR-0018` §D1's palette-vs-`canonical_tags` test, which is now moot). There is no `design_profile.schema.json` in `ai_services/contracts/v1/schemas/`: the profile is recommendation-owned, so the test lives in the suite, not a new shared schema. D12 amendments | Test + docs | `contracts-qa-steward`, item 30 | After 29 |
| **AI-generated copy** | D10 | New capability | item 33 | Deferred |
| **Payments / packages** | D11 | New capability | item 31 | Deferred |

## Contradictions with earlier ADRs, and how each is resolved

| ADR | Contradiction | Resolution |
|---|---|---|
| `ADR-0018` §D1 | Atmosphere from `colorPalettes` via `canonical_tags` | **Superseded by D3.** The quiz has a dedicated atmosphere field. `canonical_tags` lacks 2 of 3 values. The amendment `ADR-0018` required for `03_data_contracts.md:14` is withdrawn |
| `ADR-0018` §D2 | Currency `needs_input` until the client confirms | **Resolved by owner instruction (D8)**: CAD default, configurable. Workbook price currency is still a non-blocking client ask |
| `ADR-0018` §D7 | Demo scope: no payment, room render shown as job lifecycle with no image | **Stands.** p14's "dissolve into render", p15's blurred render and p18's reveal all assume an image. D9 binds the loading screen to real state |
| `ADR-0018` §C1 | Four chain breaks | **A fifth is added (C4)**: `keyFeatures` sent as `categories`. Resolved by D5 in item 29 |
| `ADR-0013` §D2.3 / `OQ-012` | Living-room "media area" and "fireplace" options have no catalogue products, and the Manual forbids catalogue pulls for them | Per-requirement `needs_input` citing `OQ-012`. The options stay on screen because they are genuine preferences worth recording |
| `ADR-0013` §D3 | Consultation copy asserts curated, validated design ("Principal-Curated Specification", "Each piece has been chosen to support the overall design") | Stands. Such copy is allowed only on deferred surfaces and only once a human curator review state exists (see item 32). No bundle-quality claim anywhere |
| `ADR-0006` §D2 | The new quiz is aligned with catalogue label fields; the client clearly intends tag matching | **Escalated to `ai-ml-lead`** with my recommendation (D6). Not ruled here |
| `ADR-0016` | AI copy and every post-quiz surface need a failure state | D10's omit-and-log state. `ADR-0016`'s fail-closed and no-fabrication reasoning applies |
| `ADR-0020` / `ADR-0011` | "See this in your space" = mode G | Mode G stays blocked on `OQ-010`. The refine re-render depends on item 27 P1-P4 and, for the customer's own room, on `OQ-010`. No G-series claim. Customer photos from p13 are product inputs, not an evaluation corpus, without written permission (`ADR-0011`) |
| `ADR-0019` | — | Consistent. Auth, packages, cart, payment and entitlements all belong in the Express monolith. No Python service gains commercial state |
| `ADR-0005` / `ADR-0007` | Recommendation's admitted catalogue is Four Hands / Moe's; the consultation aligns with the handoff workbooks | Item 35 admission ADR. Item 24 re-scoped to name which workbook set it imports |

## In scope now vs deferred

**In scope now (items 28, 20, 29, 30, 35):** the quiz (p1-p10), verify and
refine (p11-p12), environmental context upload (p13, stored as today with
no parsing), the loading screen (p14) under D9, the auth page (p3),
schema/migration, the mapper, currency, the recommendation profile
contract, contract tests, and catalogue admission.

**Deferred, each its own future work item:**

| FW | Feature (pages) | Why deferred | Needs before it can start | STATUS item |
|---|---|---|---|---|
| FW-1 | **Package paywall** (p15): Singular $1,499 / Harmonized $4,100, "Unlock" to reveal | Nothing to reveal: rooms produces no pixels. Taking payment for a render that does not exist is the fabricated-success failure in commercial form. Package-to-room semantics unknown (A5) | Item 27 P1-P4; client items 19 (package vs rooms), 23 (processor, refunds). Payment must require render job succeeded **and** curator review approved, never job success alone (three-state invariant) | 31 |
| FW-2 | **Cart, checkout, payment** (p16-p17): cards / PayPal / Apple Pay, bill-to address, taxes | No processor, tax rules, returns text or order model for packages (the product cart exists at `/cart` and is product-based) | Client item 23; a PCI-scoped processor decision (hosted checkout, card data never touching Express); a tax provider decision. Monolith only (`ADR-0019`) | 31 |
| FW-3 | **Reveal page** (p18) | Needs a real render (item 27) and a curator review state. "Principal-Curated" implies a human reviews before the customer sees it | Item 27 P1-P4; a review workflow that keeps job success, candidate review and commercial availability separate; D9.4 greeting rule | 32 |
| FW-4 | **Curated selections + refine up to 3x** (p19-p21) | Each refine = recommendation substitution (`04_recommendation.md` step 8: freeze others, re-budget, revalidate) **plus** a new rooms render job. The "3 refinements" is a client-given number; the entitlement counter lives in the monolith (commercial state), never in recommendation. "Per environment" for Harmonized (p15) | FW-3; item 21 (alternatives endpoint); item 27; `OQ-010` for "in your space" | 32 |
| FW-5 | **AI narrative copy** ("About Your Design" p18, "From the Curator" p22) | No design; D10 constraints | D10 design; `ai-ml-lead` acceptance if a model is used; client item 22 (disclosure) | 33 |
| FW-6 | **Fabric samples $35** (p21) | No fulfilment process, SKU or shipping | Client item 23 (fulfilment); a monolith add-on product | 34 |
| FW-7 | **Concierge / design support** (p18-p21 "Request a walkthrough", "Schedule your 15-Minute Call") | Cheap (the p21 annotation says it is an email-capture to the client's inbox) but not in the owner's scope this session | Destination inbox, consent/privacy wording (client item 23). No scheduling integration | 34 |
| FW-8 | **Product detail page** (p22) | Depends on catalogue admission and honest delivery data. The "Production Timeline" and "Get it ..." dates have **no source** (C5) and must show nothing, or `Lead Time` verbatim where present, never an invented date | Item 35; client item 23 (delivery-date logic); dimensions displayed in in and cm from mm internally | 32 (with selections) |
| FW-9 | **Harmonized multi-room quiz** (A5) | Whether the quiz runs once per room is unknown | Client item 19 | 31 |

## How to replicate from this ADR alone

Page images: `docs/consultation-1/pages/page-NN.jpg` (NN = 01-22).
Extraction: `docs/consultation-1/EXTRACTION.md`. Both are untracked. If
they are lost, the original is the client's `Consultation 1.pdf`.

### R1 — Build order

1. Schema: add the four nullable `quizResponses` columns (impact matrix).
   `drizzle-kit generate`, review the SQL, apply by hand. **Never
   `drizzle-kit push`.**
2. Quiz UI with the exact strings in R2, stored values in R3, look and feel
   in R4, honesty rules in D9.
3. Mapper: atmosphere and bands (item 28), then currency (item 20).
4. Catalogue admission ADR (item 35).
5. Recommendation contract major bump (D4) with code enums, new optional
   fields, importer normalisation, `OQ-012` per-requirement `needs_input`,
   and the Manual check for categories (D5). Then the app mapper switches to
   codes and a `lifestyle_requirements` source (item 29).
6. Contract test and amendments (item 30).
7. Deferred items 31-34 only after their dependencies are met.

### R2 — Screens and verbatim option strings

Every question step has **Previous** (left) and **Proceed** (right), except
where noted.

| # | Page | Heading (verbatim) | Options (verbatim; stored value in R3) | Select |
|---|---|---|---|---|
| 1 | p1 | Select the space you will be elevating | LIVING ROOM · DINING ROOM · BEDROOM (image tiles). Button: **Initiate the Refinement** | single |
| 2 | p2 | Identify Your Aesthetic | (1) Soft forms, natural materials, composed calm · (2) Sculptural silhouettes with polished, statement finishes · (3) Warm minimalism with timeless & clean proportion (full-width photos; click the image) | single |
| 3 | p3 | Project Portfolio | Sign In: Email, Password, "Sign In", "Forgot Password". Sign Up: Email, Password, Verify Password, "Agree and Continue". Legal line: "By signing in or clicking 'Agree and Continue,' you agree to our Terms of Service. Please read our Privacy Policy." Progressive disclosure: email first, then password fades in, then the button | — |
| 4 | p4 | Define the materiality and depth of the environment | Card 1: "I love natural materials like light wood, soft fabrics and earthy stone. Nothing overly glossy or ornate." / "Cream, sand, taupe, olive, clay, and softly aged metal accents". Card 2: "I'm drawn to rich, luxurious textures — velvets, statement stone, and metal accents that feel refined and intentional." / "Ivory, charcoal, black, brass, polished metal finishes, and deep tonal accents". Card 3: "I'm drawn to inviting textures paired with clean, modern lines — soft fabrics, natural wood, and subtle black details." / "Crisp whites, matte metals, soft greys, khaki, denim blue, and muted mustard accents". Each card: large photo + 3x3 image grid + **Select** button | single |
| 5 | p5 | Determine the tonality of your atmosphere | Bright & Airy · Warm & Balanced · Dark & Moody | single |
| 6 | p6 | Specify pattern density | **Just Solids**: "You love clean lines, calm energy, and a timeless, uncluttered look. Solids keep your space feeling serene and easy." · **Patterned Accents**: "You enjoy a touch of personality and flair. A patterned pillow, or rug is just enough." · **Pattern Forward**: "You embrace a layered aesthetic, skillfully navigating the intersection of complex prints" | single |
| 7 | p7/p8/p9 | Select all practical touches that make living effortless | **Living (p7):** Cozy, relaxing space for everyday comfort · Pet friendly and durable fabrics · Refined space for hosting and socializing · Dedicated media area for television · Storage to keep everything tidy · An architectural fireplace to anchor the room. **Dining (p8, assumed):** first four minus media/fireplace, i.e. Cozy, relaxing space for everyday comfort · Pet friendly and durable fabrics · Refined space for hosting and socializing · Storage to keep everything tidy; plus a row **Seating: 4 6 8 10 12**. **Bedroom (p9):** Cozy, relaxing space for everyday comfort · Pet friendly and durable fabrics · Refined space for hosting guests · Storage to keep everything tidy; plus a row **Double Size Bed · Queen Size Bed · King Size Bed** | touches multi; seating single; bed single |
| 8 | p10 | Define your investment | $20,000 - $30,000 · $31,000 - $40,000 · $41,000 - $50,000 · $51,000 - $65,000 · $66,000+ | single |
| 9 | p11 | Verify System Parameters | "Your design protocol has been generated based on the following architectural snapshot:" (replace per D9.2). Rows: YOUR AESTHETIC / ATMOSPHERE / VISUAL LAYERING / INVESTMENT showing the stored answers. **Authorize**; link "Refine your selection" | — |
| 10 | p12 | Refine Design Parameters | "Adjust the foundational logic if necessary to align with your final vision." Radio groups: YOUR AESTHETIC (the three p2 captions); ATMOSPHERE (Bright and airy / Warm and balanced / Dark and moody); VISUAL LAYERING (Mostly Solids / A touch of pattern / Embrace pattern); INVESTMENT (**the five p10 bands**, per D7). **Update**; link "Maintain Original" | single per group |
| 11 | p13 | Environmental Context | "Provide photo(s) and/or floorplan to synchronize our design logic with your physical space." "Upload your photo(s)" [Add Photo] "See Example"; "Upload your floorplan" [Add Plan] "See Example". **Generate Design**. Both optional. Photo Example modal: "Eliminate Clutter" (Make sure the room is free of clutter. The less furniture the better), "Capture a Wide View" (Step back to show the whole space), "Let There Be Light" (Take photos during the day for good lighting). Plan Example modal: "Keep it Simple" (Use plain paper and a black pen), "Basic Measurements" (Label the length and width of walls in feet or inches), "Include Door and Windows" (Mark where doors and windows are located so we know how furniture should flow.) | — |
| 12 | p14 | Synthesizing Your Curation | "Synchronizing your spatial data and investment parameters with our design logic to realize your vision." Checklist: Calibrating stylistic alignment · Optimizing procurement parameters · Curating Furniture & Finishes · Finalizing room design (bound per D9.1) | — |

Source text normalisations applied above: p13's "furntiure" is corrected
to "furniture", and p2 caption 3's double space before "&" is collapsed.
The p12 refine labels are **display only** and map back to the p5/p6 stored
values.

### R3 — Stored values (app) and wire codes (recommendation)

| Axis | Stored in `quizResponses` (display string, verbatim) | Wire code (D3/D4) |
|---|---|---|
| Room (`roomType`) | `Living Room` / `Dining Room` / `Bedroom` | `living_room` / `dining_room` / `bedroom` |
| Aesthetic, persona 1/2/3 (`styles`, exactly one element) | `Organic Modern` / `Contemporary Luxe` / `Mid-Century Scandinavian` | `organic_modern` / `contemporary_luxe` / `mid_century_scandinavian` |
| Materiality, card 1/2/3 (`materiality`) | same three strings as aesthetic | **not sent** (D1) |
| Atmosphere (`atmosphere`) | `Bright & Airy` / `Warm & Balanced` / `Dark & Moody` | `bright_airy` / `warm_balanced` / `dark_moody` |
| Pattern (`patternPreference`) | `Just Solids` / `Patterned Accents` / `Pattern Forward` | `solids` / `accents` / `forward` |
| Practical touches (`keyFeatures`) | the option sentences verbatim, as displayed | `Cozy, relaxing space for everyday comfort` → `everyday_comfort`; `Pet friendly and durable fabrics` → `pet_friendly_durable`; `Refined space for hosting and socializing` **and** `Refined space for hosting guests` → `hosting`; `Storage to keep everything tidy` → `storage`; `Dedicated media area for television` → `media_area`; `An architectural fireplace to anchor the room` → `fireplace` |
| Seating (`seatingCapacity`, Dining only) | integer `4`/`6`/`8`/`10`/`12` | `seating_capacity` same integer |
| Bed size (`bedSize`, Bedroom only) | `Double Size Bed` / `Queen Size Bed` / `King Size Bed` | `double` / `queen` / `king` |
| Investment (`budgetRange`) | `$20,000-$30,000` / `$31,000-$40,000` / `$41,000-$50,000` / `$51,000-$65,000` / `$66,000+` (ASCII `-`) | `furniture_budget_minor_units` per D7; `currency` per D8 |

Persona to catalogue style: persona 1 = Organic Modern, 2 = Contemporary
Luxe, 3 = Mid-Century Scandinavian. p4's annotations are authoritative for
the materiality cards, and p2's order is inferred (client item 15). p4's
annotation spells "Midcentury Scandinavian". The stored value follows the
workbooks: `Mid-Century Scandinavian`.

Catalogue strings the recommender's importer must recognise (display to
code; everything else counted and rejected, never fuzzy-matched):
`Room Type` ∈ {`Living Room`, `Dining Room`, `Bedroom`}, multi-valued and
split on `; `. `Design Style` ∈ {`Organic Modern`, `Contemporary Luxe`,
`Mid-Century Scandinavian`}. `Atmosphere` ∈ {`Bright & Airy`,
`Warm & Balanced`, `Dark & Moody`}; `Birght & Airy` is rejected and
counted. `Practical Touches` is split on `; ` against the R3 sentences and
`Seating: N`.

### R4 — Look and feel

Colours are sampled from the mockup images. They are approximations, not
client brand tokens; request the real palette (client item 25).

| Token | Value |
|---|---|
| Page background | `#ffffff` |
| Panel background | `~#f4f6f5` (pale grey-green) |
| Header bar, primary buttons, body ink | `~#231f20` (near-black) |
| **Selected state** | fill `~#7f807a` (khaki / grey-olive), text white |
| Refine radio (checked) | dark olive filled circle with white check |
| Unselected option | white or panel fill, thin grey outline, dark text |

- **Selected-state rule (annotations p1, p2, p6, p7):** image options darken
  with a khaki overlay on selection. Text options get a khaki fill and the
  font turns white.
- **Interaction directive (annotation, verbatim, p7-p10):** "Update design to
  include affects and to be more tech-forward (i.e. soften the line
  thickness, lighten the font colour — and have the lines darken and box
  change colour as each is selecte[d])". For auth (p3): "Can we remove the
  boxes or lighten the weight of the lines? Once they input their email,
  password fades in, then the sign in button?"
- **Header:** near-black bar. Hamburger on the left. Centred script
  wordmark **"Curalina & Co."**. On the right, a person icon before sign-in,
  then a circle with the customer's initials (p4 annotation: "Initials
  switches to customer initials upon sign-in"), subject to D9.3.
- **Footer (every page):** circular "CC" monogram.
  - **Company**: About · Partner · Contact.
  - **Support**: Delivery & Shipping · Returns & Exchanges · FAQ.
  - **Explore**: Design Styles · Before & After · Pricing.
  - **Stay Connected**: "Receive occasional updates, new releases, and
    design insights." + email field + Instagram + Pinterest.
  - Bottom bar: "Terms & Conditions · Privacy Policy" and "Curalina & Co.
    All rights reserved."
  - Later pages use "About us / Partner with Us / Contact Us" and
    "© 2026 Curalina & Co."
- **Typography:** high-contrast display serif (Didone/Bodoni-like) for
  headings; light humanist sans for body. Exact families are not supplied
  (client item 25).
- **Buttons:** rectangular, near-black fill, white text.
- **Loading motion (p14):** wireframe chair fades in and pulses. Bullets
  check off one by one with a soft gold glow, bound to real state per D9.1.
  The cushion fades in at bullet 3. Motion is "Slow, fluid, and 'heavy.'
  Avoid fast or snappy transitions". Black background.

## Consequences and reversal

**Costs accepted.**

- D4 is a major bump on recommendation's request contract, arriving while
  `ADR-0018` §D3's minor one (item 19) is still unshipped. Both consumers
  are in-repo, so the cost is sequencing, not coordination. Item 19 and
  item 29 should land in that order in one sequence.
- D5 can make `categories` a `needs_input` wall the moment `atmosphere` and
  `currency` clear, if the Manual has no per-room set. That is the correct
  failure direction, and it is honest: the chain currently only *looks*
  closer to working than that.
- D3 splits the atmosphere fix across items 28 and 29: display strings are
  validated now, and codes go on the wire later. For one packet interval,
  the in-flight mapper and the data contract disagree on spelling. Nothing
  crosses the wire in that interval, because `currency` fails closed until
  item 20.
- D1 stores an answer (materiality) that nothing uses. A customer may
  reasonably expect it to matter. That is a product-copy risk to raise with
  the client, not a reason to invent a combination rule.
- D9 will make the loading screen look less magical than the mockup. That
  is deliberate, for the same reason as `ADR-0018` §D7.3.

**Reversal.**

- D1: add `materiality` to `DesignProfileIn` (additive) once the client
  defines it. Trigger: client item 15's answer.
- D2: if p8 is not Dining, move the seating row. It is one UI mapping, plus
  the `seating_capacity`/`room_type` cross-validation in D4.
- D3: reverting to display strings on the wire means dropping the lookup
  table and changing recommendation's enums. Trigger: a second consumer
  outside this repo that cannot carry a lookup.
- D4's enum narrowing reverses only with another major bump. That is
  expensive, and deliberately so.
- D7: the midpoint/lower-bound policy is one function
  (`parseBudgetRangeToMinorUnits`). Trigger: client items 18/19.
- D8: change `CURALINA_CURRENCY`. No code change.
- D10: the deterministic-first rule reverses only via `ai-ml-lead`
  acceptance of a model path.

**What would prove this decision wrong.**

- **D3/D4:** if the client reissues the workbooks with different tag
  spellings, the importer's reject count spikes. That is the designed
  signal, not a bug. If rejects are routinely non-trivial, the vocabulary is
  not stable enough for closed enums and the client needs a controlled tag
  list.
- **D5:** if the Design Manual turns out to define room composition in terms
  that do not map to catalogue `Product Type` values (`Sectional / Modular
  Sofa`, `Dining Table`, ... measured in C2), the "derive categories from
  room" rule needs its own mapping ruling. **Unverified.** Item 29 must
  check first.
- **D2:** the catalogue evidence for dining-only seating is strong on Luxus
  but thin on Lazzoni (2 rows), and seating tags also sit on sofas and
  coffee tables. A client answer that seating applies to living rooms too
  would contradict D2, and the catalogue would neither confirm nor refute it.
- **D1:** if the client says p2 and p4 were alternative drafts of one screen
  (A1), materiality disappears and one step is removed. No contract change
  results. That is the cheap direction, which is why D1 keeps materiality
  off the wire.
- **D6's recommendation:** if `ai-ml-lead` finds tag-equality filtering on
  these columns makes the only available evaluation labels meaningless and
  no alternative label source exists, then the deterministic route has no
  way to be evaluated. The client would need to supply held-out
  human-judged relevance labels.

**What I am explicitly not deciding.**

- **Whether catalogue tags may be used for filtering or ranking** (D6).
  That is `ai-ml-lead`'s, via `ADR-0006`'s firewall.
- **Any evaluation claim, gate status or G-series claim.** None is created.
- **Pricing, packages, refunds, returns, tax and the payment processor.**
  These are owner/client business facts.
- **Whether AI authorship is disclosed and how** (D10). That is an
  owner/client product-ethics decision, raised as client item 22. I rule
  only that machine text may not be attributed to a human curator.
- **`OQ-010`/`OQ-012` status.** Both stay open. `open_questions.yaml` is not
  edited by this ADR.

## Verification

Read or measured this session, not taken from summaries:

- Page images p2, p4, p8, p9, p10, p12, p14, p22 viewed directly.
  EXTRACTION.md confirmed accurate on each. Corrections and additions:
  - p14 carries a "The Concept: ... being 'built' by the AI in real-time"
    line and a 4-step "Materialization Sequence" note that EXTRACTION
    summarises but does not quote. That line bears on D9.
  - p10's image uses spaced hyphens ("$20,000 - $30,000"), not en dashes.
  - p2 caption 3 has a double space before "&".
  - p8's "4" is rendered lighter grey italic. Whether that means selected
    or disabled is not stated.
- Supplier workbooks measured with `openpyxl` over every row. Tag counts,
  `Practical Touches` delimiter and counts, product types, `Return Policy`,
  `Lead Time` and `Delivery Options`, and sha256 hashes are all given in
  C1/C2.
- `ai_services/recommendation/src/curalina_recommendation/api/schemas.py:55-79`:
  `DesignProfileIn` (`extra="forbid"`, free `str` fields) and
  `BundleLineItem` (still without `supplier_id`/`supplier_sku`; item 19
  open).
- `ai_services/recommendation/src/curalina_recommendation/evaluation/vocabulary_map_v1.yaml`:
  `canonical_rooms/styles/tags` as stated in C1.
- `ai_services/design_rules/src/curalina_design_rules/types/primitives.py:6-15`:
  `StyleCode`, `RoomType`.
- `ai_services/suite_client.py:285-292`: snake-case profile.
- `architecture/guides/03_data_contracts.md:11-14, 34`.
- `server/services/ai-adapter/design-profile-mapper.ts` (in-flight working
  copy): `CANONICAL_ATMOSPHERES`, the `keyFeatures`-as-`categories` line,
  the `$66,000+` lower-bound branch, and the hardcoded `"USD"`.
- `client/src/components/quiz/consultationOptions.ts` (in-flight): stored
  values match R3's display column.
- `migrations/0004_modern_wither.sql`: exactly four `ADD COLUMN`
  statements.
- `agentic_flow/open_questions.yaml`: `OQ-009` to `OQ-013` read. No `OQ`
  covers per-room categories, currency, or bed/seating semantics.

Consequential work authorized by this ADR is carried by
`agent_instructions/STATUS.md`: item 20 (currency half), and new items 28
(quiz/UI, dispatched this session), 29 (recommendation profile contract),
30 (contracts suite + amendments), 31-34 (deferred features) and 35
(handoff workbook admission). No production code is changed by this ADR.
