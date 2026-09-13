# Architecture decision record

ID: ADR-0002 — Recommendation's A1 FastAPI app and the A1/A3 phase boundary
Status: accepted
Owner and reviewer: `tech-lead` (decision); `delivery-coordinator` (packet
trail), `python-services-engineer` (recommendation) as affected parties.
Date: 2026-09-13

Numbering note: ADR-0001 is the stack/"deterministic rules engine, not ML"
decision recorded in `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` Part 3.
It is not a file in this folder; this folder starts at 0002.

## Context

`ai_services/recommendation/src/curalina_recommendation/api/routes.py`
defines `create_app()`, a real FastAPI application with four registered
`POST` routes and a `RequestValidationError` handler, and
`ai_services/recommendation/pyproject.toml` gained `fastapi` (core) and
`httpx` (dev) during phase A1.
`agentic_flow/recommendation_workflow.md`'s A3 section is titled "API (no
worker)" and is the section that names HTTP exposure; its A1 section names
only DTOs, fixtures and contract tests. Variants and rooms both built
plain-callable A1 fakes instead (`curalina_variants` `handlers.py`,
`curalina_rooms.api.service.RoomsContractService`, the latter returning a
`ContractResult(http_status=..., body=..., headers=...)` value object that
a later transport is expected to translate).

`agent_instructions/STATUS.md` flags this as an unresolved phase-boundary
inconsistency to be ruled on before recommendation starts A2.

Evidence that bears on the ruling, all of it already in the repo:

1. The A1 section's own **Allowed files** line is
   `ai_services/recommendation/src/curalina_recommendation/api/` plus
   `ai_services/contracts/v1/` — `api/` is exactly where `routes.py` lives.
   A1 did not write outside its sanctioned area.
2. A1's **Done evidence** is stated in HTTP terms: "a request using an
   unsupported major version returns `422`; a request missing a required
   field is rejected with a structured error, not a 500." A status code is
   a property of a transport. Nothing below a transport can produce that
   evidence directly; a plain callable can only assert an *intended* status.
3. `architecture/guides/08_engineering_and_tests.md` (line 44) is explicit:
   "Contract tests must use a real in-process HTTP client with fake
   application dependencies and validate the shared fixtures." Recommendation's
   `tests/contract/test_contract_scaffold.py` uses
   `fastapi.testclient.TestClient(create_app())` — in-process, no socket, no
   bound port. That is the literal instruction, and `httpx` is a transitive
   requirement of obeying it.
4. A3's actual deliverables are "loopback-only API on `8101`; catalogue
   import, ranking, bundle, and substitution endpoints backed by real (or
   fixture-labelled) A2 logic; SQLite persistence for snapshots and rule
   versions", with done-evidence "integration tests cover repository
   rollback, process restart, and malformed-workbook import". **None of
   those four deliverables exist.** There is no uvicorn bind, no `Settings`
   injection through `bootstrap.py` into the app, no repository, no
   SQLite, and `routes.py` imports nothing from `domain/`, `application/`,
   `ports/` or `adapters/`. Its own module docstring says so.

So the question is not "did recommendation do A3 work early" in the sense
of A3's deliverables. It is "does declaring routes belong to A1 or A3".

## Options

**(a) Declare A1 to have also completed A3's HTTP-wiring step, and amend
the packet trail to say so; A3 shrinks to hardening plus persistence plus
business logic.**
Zero code cost, matches the framing STATUS.md offers. But it records
something false in the durable trail: a later reader of
`ai_services/work_packets/REC-A1-01.md` would reasonably conclude the
service is HTTP-serving on `8101`, that bootstrap/`Settings` wiring is
done, and that a restart-safe store exists. None of that is true. It also
makes A3's remaining scope *look* small when its expensive parts —
persistence, rollback and restart integration tests — are entirely
untouched. Of the two available accuracy errors this is the worse one: it
overstates completion.

**(b) Keep the FastAPI app but re-scope recommendation's A3 downward as a
special case for this service.**
Also honest about the code, but it makes A3 mean something different for
recommendation than for the other two services, which is the exact
legibility loss we are trying to avoid. And it is unnecessary: A3's
deliverable list is already accurate as written.

**(c) (chosen) Rule that route declaration belongs to A1 wherever A1's
done-evidence is stated in HTTP status codes, and that "API"/"HTTP wiring"
in A3 means *process-level* serving — port binding, bootstrap/`Settings`
injection, persistence, and real logic behind the handlers.**
No phase is retroactively re-labelled. Recommendation's A1 is A1-complete
and compliant; its A3 keeps its full deliverable list minus one line item
(declaring the four routes, already done). Variants and rooms are not
declared wrong either, but the cost their choice defers is named and
scheduled rather than left to be rediscovered.

**(d) Require recommendation to delete `create_app()` and rebuild a
plain-callable fake for symmetry.**
Rejected without much deliberation: it would destroy working, tested,
type-clean code and would put recommendation's contract tests in
*violation* of `08_engineering_and_tests.md` line 44 in order to match two
services that are arguably the ones out of step with it.

## Decision and rationale

Option (c).

1. **Recommendation's A1 stands as A1, complete and correct.** No
   retroactive re-labelling, no claim that any part of A3 is done. The
   `fastapi`/`httpx` dependency additions were pre-authorised in
   `REC-A1-01.md`'s own allowed-files list and are not a deviation.
2. **The A1/A3 boundary is hereby defined by behaviour and durability,
   not by the existence of a routing object.** An artefact belongs to A3
   when it (i) binds a port or is launched as a process, (ii) reads
   `Settings` through `bootstrap.py`, (iii) persists anything, or (iv)
   puts real `domain`/`application` logic behind a handler. An in-process
   ASGI application object whose handlers return canned fixtures is a
   *contract-test harness*, and belongs to A1. This is the reading that
   makes A1's own done-evidence obtainable and `08_engineering_and_tests.md`
   line 44 satisfiable at the same time.
3. **Variants' and rooms' plain-callable fakes are accepted as delivered**,
   not reworked now. Their A1 evidence was expressed as
   `ContractResult.http_status` assertions, which is a reasonable way to
   freeze contract *intent*. But that is intent, not observation: their
   suites do not yet prove that a real transport produces those codes,
   those headers (rooms' `Location` on 202) or that structured error body.
4. **Therefore each of variants and rooms carries one explicit added A3
   line item**: re-run the existing A1 contract suite through a real
   in-process HTTP client against the new ASGI app, unchanged in its
   assertions, and make that a named piece of A3 done-evidence. This is
   translation work, not new engineering, but it is not free and it is
   where transport-level surprises (status-code mapping, exception-handler
   registration, header emission) will actually surface.
5. **Recommendation's remaining A3 scope is unchanged from the workflow
   doc**, minus route declaration: real A2-backed logic behind the four
   handlers; SQLite persistence for catalogue snapshots and rule versions;
   loopback-only binding on `8101` wired through `bootstrap.py`/`Settings`;
   integration tests for repository rollback, process restart and
   malformed-workbook import; A1's contract tests still green against the
   same fixtures. That is the large majority of A3 by effort.

Rationale in one line: the phase gate exists to make "what is actually
built" legible, and the honest statement is "the routes are declared and
nothing is behind them" — which is precisely what A1 is supposed to mean.
Option (a) would trade a real accuracy loss for a cosmetic consistency gain.

## Consequences and reversal

Consequences:

- `agentic_flow/recommendation_workflow.md` A1/A3 wording is now ambiguous
  against this ruling. It is not edited here (the workflow pack is owned
  elsewhere and is gitignored); the correction belongs in
  `agentic_flow/AMENDMENTS.md` as a targeted amendment naming
  `recommendation_workflow.md` A3 ("API (no worker)") and the corresponding
  A3 sections of `variant_generator_workflow.md` and
  `room_generator_workflow.md`, stating the A1/A3 test in point 2 above.
  Whoever owns that pack should add it; this ADR is the source.
- `ai_services/work_packets/REC-A1-01.md` gets a short reviewer's note
  recording this ruling — that A1 is accepted as-is and that **no** A3
  deliverable is claimed. (Added alongside this ADR.)
- Variants' and rooms' A3 packets, when written, must carry the
  contract-suite-through-real-transport line item from point 4.
- Recommendation may start A2 immediately; this ruling blocks nothing.
- One asymmetry survives on purpose: recommendation's contract tests
  observe HTTP, the other two assert intended HTTP. That asymmetry closes
  at their A3 and is now written down rather than latent.

Reversal trigger / what would prove this wrong:

- If, at recommendation's A3, wiring `Settings` and real repositories into
  `create_app()` forces a **substantial rewrite of the route handlers
  themselves** (not just adding dependencies), then declaring routes before
  the dependency-injection shape was known was premature, and the next
  service should defer route declaration to A3. Record that outcome in the
  A3 packet.
- If, conversely, variants' or rooms' A3 transport translation turns up
  contract drift their plain-callable tests could not have caught (a status
  code that cannot actually be produced, a header that cannot be emitted,
  an error body the framework reshapes), that is evidence the in-process
  ASGI harness should have been *required* at A1 for all three, and the
  rule in point 2 should be strengthened from "permitted" to "required".
- This ADR is cheap to reverse: it changes no code. It changes what future
  packets are allowed to claim.

## Verification

- Claims 1 and 4 above were verified by reading
  `ai_services/recommendation/src/curalina_recommendation/api/routes.py`
  in full (105 lines; no import from `domain`/`application`/`ports`/
  `adapters`, all four handlers load canned JSON via `importlib.resources`)
  and `agentic_flow/recommendation_workflow.md` A1 and A3 sections in full.
- Claim 3 verified at `architecture/guides/08_engineering_and_tests.md`
  line 44, and against
  `ai_services/recommendation/tests/contract/test_contract_scaffold.py`
  (`TestClient(create_app())`, 14 tests).
- No re-run of the suites was required for this decision; the last recorded
  run (`REC-A1-01.md`) is 3 unit + 14 contract + 1 integration passing,
  Ruff clean, `mypy --strict` clean on 11 source files.
- Future verification: the recommendation A3 packet must show the four A3
  deliverables in point 5 individually evidenced, and the reversal triggers
  above answered one way or the other.
