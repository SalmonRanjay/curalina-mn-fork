# Architecture decision record

ID: ADR-0009 — The Design Manual primary source exists and is admitted; what it settles and what it does not
Status: **accepted.** Provenance and admissibility ruling.
Owner and reviewer: `tech-lead`
Date: 2026-09-14

## Context

For seven sessions this project has treated the Curalina Design Manual as an
absent artifact. It is named as the authority behind every `OQ-xxx` in
`agentic_flow/open_questions.yaml` and behind the derived rule specs in
`agentic_flow/12_design_rules_engine.md`, but no copy was in the repository
and none was recorded as reachable. `ADR-0004` states this explicitly at line
180 — §8's worked examples are "**not in this repo** (the other blocker on
D01's clean accept)" — and names §9.1's body text and §8's examples as the
two pieces of evidence that would settle `OQ-013` one way or the other.

**The manual is reachable.** It is at
`/Users/rjsalmon/Downloads/Training Doc 1 - Design Manual.pdf` — 169 pages,
titled "Curalina Design 101 Manual — Technical Handbook for AI, Engineering,
and Product Teams", sha256
`7d450d28facc0ff87c40e7e6f5c33bbbb7f7d13e653aec6be07ced79b4c65cca`, mtime
2026-09-12 11:37. It is **outside version control**, on one machine, in
`~/Downloads` — the same unsanctioned delivery path `ADR-0008` flagged for
the supplier image corpus.

This is a different category of find from `ADR-0008`. That ADR admitted new
*data*. This one admits the **primary specification** every derived document
in `agentic_flow/` is a secondary reading of.

### Provenance — is this the document the pack was derived from?

Three independent checks, all positive:

1. **Blank-value match.** `OQ-005` records that "Section 3.5 Nodal Sampling
   says 'apply a random variance of [blank] to HSL values'". Page 81 of this
   PDF reads, verbatim: "2. Apply Delta (): Apply a random variance of  to
   the Hue, Saturation, and Lightness (HSL) values." The value is literally
   absent in the source. `OQ-005` transcribed a real gap in this exact file.
2. **Numeric match.** §9.1's table (p152) gives condo 32", mid 36", large
   48"–60" walkways; §9.2.1 (p152) gives OM 15"–16", MS 17", CL 18"–20"
   sofa-to-table. These are precisely the numbers `OQ-013` and `ADR-0004`
   quote.
3. **Date match.** mtime 2026-09-12 is the day the `agentic_flow/` pack was
   authored.

I treat the document as authentic and as the pack's source. I did **not**
verify it is the *latest* revision the client holds; nothing in the file
carries a version or revision marker, which is itself a finding.

### What §9.1 actually says — the `OQ-013` question

`ADR-0004` adopted an interim reachability reading of §9.1 `MIN_WALKWAY`
because the derived pseudocode in `agentic_flow/12_design_rules_engine.md`
(lines 151–160) specifies a morphological opening over the *entire* free
floor polygon, which is unsatisfiable in combination with §9.2.1's 15–20"
furniture spacings. `ADR-0004` named its own falsifier: "a passage in the
Design Manual's §9.1 body (not the derived pseudocode) that names the whole
floor area".

I searched all 169 pages for every occurrence of `walkway`, `Walkway`,
`circulation path`, `access path` and `dead zone`. **There is no such
passage.** Every occurrence is path/corridor language, and several are
actively incompatible with a whole-floor reading:

- **p151** (§9 preamble) lists "Clearance & Circulation Requirements
  (**minimum walkways, access paths, and functional spacing**)" as three
  distinct things. §9.2.1's sofa-to-table gap is *functional spacing*, not a
  walkway. The manual itself separates the two categories `OQ-013` reports
  as colliding.
- **p151**: "No object may be placed if ... it causes **circulation breaks or
  dead zones**." A break is a severed path, not a narrow region.
- **p154** (§9.3.1): "Allocate 44" if there is **a primary walkway** behind
  the chair." Walkways are discrete, localised, conditionally present. A
  whole-floor predicate cannot be conditionally present.
- **p157** (§9.4.2/§9.4.4): "a clear 36" **path** to the Walk-in Closet"; "if
  the addition of a Retreat Zone reduces **any primary walkway** to <36"".
- **p153** (§9.2.2): "a minimum 30" '**behind-sofa**' **circulation path**."
- **p152** (§9.1): the table's own column is headed "The 'Void' Rule" with
  intents "Prioritize **Circulation Flow**" / "Prioritize **The Gallery
  Walk**".

§9.1 is titled "The Scaling Hierarchy (Home Size Categories)". Its body is a
three-row table of walkway minima with intent labels. It contains no
predicate at all. **The whole-free-floor opening test is an artifact of the
derived pseudocode, not of the manual.**

### What §8 actually is

`ADR-0004`'s second named falsifier was §8's worked examples "showing a
compliant composition whose free floor *is* walkway-width everywhere". §8
(pp147–150, "Generative Scenario Validation") contains four scenarios —
8.1 OM, 8.2 CL, 8.3 CL, 8.4 MS. **All four are colour, material and tectonic
layering proofs. None contains a floor plan, a dimension, a placement, or any
spatial content whatsoever.** §8 cannot confirm or falsify `ADR-0004`; it is
silent on space planning. That falsification route is closed, not passed.

§8 is, separately, worth something else entirely: it is four **client-authored
quiz-input → expected-composition pairs**, stated as "a 'Test Run' of these
specific quiz combinations must result in the architectural compositions
described below". That is the only client-authored ground truth found
anywhere in this project. It is an `ai-ml-lead` question whether four
narrative cases constitute an evaluation set; it is not a `tech-lead` one.

### What the manual does NOT settle

The manual is the source of the `OQ-xxx` blanks, not their resolution.
Confirmed by direct search:

- **`OQ-001` (CMR).** "Circulation-to-Mass Ratio" appears exactly twice
  (p151, p164), both times as a bare name in a list of things to validate.
  **No formula, no threshold, no definition.** `check_cmr_validation`'s
  unconditional `needs_input` is correct and stays.
- **`OQ-005`.** The variance value is physically absent from the page.
- **`OQ-010`.** §10 STEP 2 (p162) mandates extracting "Room boundaries /
  Windows / doors / Ceiling height (estimated) / Fixed architectural
  elements" from an uploaded photo or floorplan, and gives **no method, no
  accuracy requirement, no coordinate frame and no scale reference**. See
  `ADR-0010`.
- `OQ-002`, `OQ-003`, `OQ-004`, `OQ-006`, `OQ-007`, `OQ-008`, `OQ-009`,
  `OQ-011`, `OQ-012` — not re-examined in this ruling. Do not assume the
  manual resolves any of them because it resolved a scope question for
  `OQ-013`. Each needs its own targeted read.

## Options

**(a) Ignore it — it is outside the repo and unsanctioned.** Consistent with
treating `~/Downloads` as not a delivery path. Absurd here: the entire
`agentic_flow/` pack is a secondary reading of this document, and we have
been reasoning about §9.1's intent from a paraphrase while the original was
one directory away.

**(b) Copy it into the repository and treat it as a project artifact.**
Tempting and wrong. Licensing/ownership of the client's training material is
not established (same open question `ADR-0008` raised for the image corpus),
and committing a 1.3 MB binary specification whose revision status is unknown
creates a second source of truth that will silently drift from the client's.

**(c) (chosen) Admit it as the authoritative primary source, by hash, read
in place, without copying it in.** Derived documents in `agentic_flow/`
remain the working specification; where a derived document and the manual
disagree on a *quotation*, the manual wins and the disagreement is recorded
as an amendment.

**(d) Admit it and close `OQ-013` outright.** Over-reach. `OQ-013`'s owner is
`design_authority`. Closing a client-owned open question on the strength of
my own reading of their document is exactly the informal-winner-picking this
role is supposed to prevent.

## Decision and rationale

**Option (c).** The manual is admitted as the authoritative primary source
for all Design Manual references, read in place at the path and hash above,
never copied into the repository.

Consequent rulings:

1. **`agentic_flow/12_design_rules_engine.md` lines 151–160 are a derived
   over-specification, not a quotation of §9.1.** The manual contains no
   whole-free-floor predicate. Any future reader comparing the two should
   trust the manual.

2. **`ADR-0004`'s interim reading is corroborated, and its status is upgraded
   from "interim, unevidenced" to "interim, corroborated by the primary
   source, pending design-authority confirmation".** Both of `ADR-0004`'s own
   named falsifiers have now been tested: §9.1's body does not name the whole
   floor, and §8 is silent. It remains interim because confirming an
   interpretation of the client's document is still the client's act, not
   mine.

3. **`ADR-0004`'s endpoint set is too narrow and this is now a known defect,
   not an unknown.** The manual names walkways that are neither
   doorway↔doorway nor doorway↔functional-zone: the 30" behind-sofa
   circulation path (§9.2.2), the 36"/44" dining Pull-Back Zone (§9.3.1), the
   48" Credenza Buffer (§9.3.1). The manual's model is **a small set of
   named, rule-specific paths each with its own minimum**, plus §9.1's
   category-wide default. `ADR-0004`'s two-endpoint-class rule is a strict
   subset and will under-report. It is still safe in the same direction
   `ADR-0004` argued (it can accept a layout the client would reject, never
   the reverse), so it stands as the interim reading, but the residual
   uncertainty is now *precisely located*: not "is the predicate whole-floor
   or path-based" (settled: path-based) but "what is the complete set of
   required paths".

4. **`OQ-013` is not closed. It is narrowed.** Recommend to
   `design_authority` that its text be reduced to the surviving question in
   (3). I am **not** editing `agentic_flow/open_questions.yaml`; owner and
   status are the client's.

5. **`~/Downloads` is not a sanctioned delivery path.** Same finding as
   `ADR-0008`. Two load-bearing client artifacts have now been found there by
   accident. This is a process failure to raise with the client, not a
   convention to adopt.

## Consequences and reversal

Consequences:

- Every future question of the form "what does the Design Manual say about
  X" is now answerable by reading it, and must be answered that way rather
  than from `agentic_flow/`'s paraphrase. The cheap version is a
  `research-scout` pass over the pinned PDF.
- The `OQ-xxx` set is confirmed to be a faithful record of real gaps in the
  source — the pack's authors did not invent blockers. That materially
  raises confidence in `open_questions.yaml` generally.
- D01's conformance record is affected: `ADR-0004` line 180 lists the
  missing §8 as one of two blockers on a clean accept. §8 is no longer
  missing; it is *inapplicable*. Whether that changes D01's
  accept-with-limitations status is `ai-ml-lead`'s call, not mine.
- The manual can change under us silently. It is pinned by hash for exactly
  this reason.
- No code changes follow from this ADR. `ADR-0010` carries the code change.

**What would prove this decision wrong:**

- The client produces a **different or later revision** of the manual whose
  §9.1 does contain a whole-floor clause, or whose §8 does contain spatial
  worked examples. The file carries no revision marker, so this is a live
  risk, not a theoretical one. Ask before building anything expensive on it.
- The sha256 above stops matching. Then every finding here is about a
  document that no longer exists and must be re-derived.
- The client states the manual is not licensed for this use. Then it is
  inadmissible regardless of what it says, and `ADR-0004` reverts to
  uncorroborated interim.

**Reversal:** this ADR adds no code and no dependency. Reversing it means
deleting the reference and returning `ADR-0004` to its prior uncorroborated
status. `ADR-0010`'s code change is independent of whether the manual is
admitted — it is driven by `OQ-010`, which the manual does not resolve.

## Verification

- `shasum -a 256 "/Users/rjsalmon/Downloads/Training Doc 1 - Design Manual.pdf"`
  → `7d450d28facc0ff87c40e7e6f5c33bbbb7f7d13e653aec6be07ced79b4c65cca`;
  169 pages via `pypdf`.
- Section index read (p2): sections 1–10 as named, §8 "AI Logic Execution
  Examples", §9 "Space Planning", §10 "Conclusion Summary".
- pp147–155, 161–164 read in full (Sections 8, 9.1–9.4.1, 10.0 STEP 1–5).
- Exhaustive full-document search for `walkway`, `Walkway`,
  `circulation path`, `access path`, `dead zone` — **9 hits total, all on
  pp151–160 and p164, all path/corridor language, zero whole-floor
  language.**
- Exhaustive search for `Circulation-to-Mass` / `CMR` — 2 hits (p151, p164),
  both bare names, no formula. `OQ-001` stands.
- Exhaustive search for `random variance` — 1 hit (p81) with the value
  physically absent. `OQ-005` stands and provenance is confirmed.
- `agentic_flow/open_questions.yaml` **not edited**.
- Manual **not copied** into the repository.

### Caveat that must travel with any citation of this ADR

Scope every claim to *this file at this hash*. The correct phrasing is "the
Design Manual copy at sha256 `7d450d28…`, as of 2026-09-14", never "the
Design Manual says". The revision status of this file relative to what the
client holds is **unknown and unverified**.
