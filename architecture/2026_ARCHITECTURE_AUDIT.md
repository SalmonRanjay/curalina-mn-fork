# Curalina architecture audit — 2026

**Audit date:** 2026-09-16  
**Audience:** Curalina technical lead and project owner  
**Scope:** `agent_instructions/STATUS.md`, `architecture/`,
`agent_instructions/`, the authoritative superseding material in
`agentic_flow/`, and the implementation under `ai_services/`. The existing
TypeScript application was sampled where it participates in orchestration.
**Nature of review:** read-only architecture and implementation audit. This
document is not a stage-gate sign-off, security certification, production
approval, or model-quality approval.

## Executive assessment

The **intended architecture is fundamentally sound and well aligned with 2026
engineering practice for a local-first, evidence-driven build**. Its strongest
choices are the deterministic rules core, strict service ownership, public
HTTP boundaries, versioned contracts, durable image-job semantics, explicit
synthetic-data labels, and separation of service construction from capability
acceptance. The architecture is unusually disciplined about refusing to turn
missing inputs or weak evidence into product claims.

The **current checkout does not reliably implement the state described by the
operational status document**. This is the audit's most serious finding. The
status says all three services run and participate in the HTTP suite, but the
checked-out service bootstraps still print `scaffold ready` and exit. The
standard suite command fails before recommendation becomes ready. Several
recent implementation files exist only as untracked files, while tracked
composition roots and exports are older revisions. Git reflog records two
`reset --hard` events, and the status document itself records recovery from
that data-loss incident. The repository therefore lacks a trustworthy,
reproducible relationship between documented completion, committed source,
and executable behavior.

The **feature-orchestration design is appropriate, but the complete customer
flow is not yet operational**. The Python suite's HTTP-only orchestration is a
good design, and ADR-0018 correctly identifies four separate breaks in the
quiz-to-results chain. Current executable verification reveals an earlier
break: the Python APIs do not start through their declared entrypoints in this
checkout. Room image generation also remains deliberately unimplemented and
blocked on authoritative room inputs.

The build is therefore best classified as:

| Area | Assessment | Meaning |
|---|---|---|
| Intended service architecture | **Acceptable with targeted improvements** | Sound boundaries and evidence model; suitable foundation |
| Development method and governance | **Strong design, weak configuration control** | Excellent packet/gate discipline is undermined by uncommitted state and destructive resets |
| Service implementation | **Inconsistent checkout** | Valuable domain, persistence, worker and test code exists, but executable composition is partially reverted |
| Feature orchestration | **Designed and partially implemented** | HTTP suite and UI adapter concepts are sound; current suite and live product chain are not working |
| Local development deployment | **Partial** | Compose structure exists but is not self-contained or reliably health-checked |
| Production readiness | **Not ready** | Security, observability, supply-chain, migration, deployment and operational controls remain incomplete |
| Capability/model readiness | **Explicitly limited** | V01 is `revise`; R03 is no-go; G01 and room imagery remain blocked |

## 1. Audit method and authority order

The review applied the repository's own authority rules:

1. `agentic_flow/` supersedes conflicting material in `architecture/`.
2. `agentic_flow/AMENDMENTS.md` was considered with the original guides.
3. `agent_instructions/STATUS.md` was treated as the operational claim set.
4. Executable source and command results were treated as evidence of the
   current checkout.
5. Documentation claims were not treated as proof when current commands or
   source contradicted them.

The external 2026 comparison baseline was:

- [NIST SP 800-218, Secure Software Development Framework 1.1](https://csrc.nist.gov/pubs/sp/800/218/final), especially controlled development, protected software, verified releases, and vulnerability response.
- [OWASP Application Security Verification Standard 5.0.0](https://owasp.org/projects/asvs), as a requirements baseline for web/API security verification.
- [SLSA specification 1.2](https://slsa.dev/spec/v1.2/), for build provenance and software supply-chain integrity.
- [OpenTelemetry signals and correlation model](https://opentelemetry.io/docs/concepts/signals/), for logs, metrics, traces and cross-service context.
- Current container practices: immutable/reproducible images, explicit
  readiness, least privilege, dependency pinning, secrets isolation, SBOM and
  signed provenance.

No claim is made that Curalina formally conforms to any of these standards.
They are used as review lenses.

## 2. Development architecture

### 2.1 What aligns well with 2026 practice

#### Deterministic-first product logic

The decision to make Curalina a deterministic rules engine with a small number
of inference-only adapters is appropriate. It improves explainability,
testability, cost control and failure diagnosis. Model use carries an explicit
burden of proof rather than becoming the default implementation mechanism.
This is stated in `agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md` and reinforced
by the amendments and gate system.

This is particularly suitable for money, dimensions, eligibility,
compatibility, spatial rules and commercial state, where deterministic logic
is both safer and easier to audit than learned behavior.

#### Service and data ownership

The intended separation is coherent:

- recommendation, variants and rooms are separate services;
- each owns its package, database and tests;
- only `curalina_design_rules` is a shared business package;
- cross-service traffic uses public HTTP;
- the suite runner orchestrates but does not become a fourth business service;
- image APIs enqueue jobs and workers perform image work.

These boundaries reduce accidental coupling and match modern modular-service
practice. The local SQLite-per-service choice is reasonable for the current
development stage because it is explicitly limited and paired with durable
leasing, fencing and restart tests.

#### Contracts and state semantics

The architecture correctly distinguishes:

- job execution state;
- candidate review state;
- commercial availability;
- synthetic/demo provenance;
- measurement certification;
- service build phases from model/capability gates.

Versioned `/v1` contracts, additive-minor/breaking-major rules, uniform error
shapes, idempotency, content hashes, rules versions and snapshot identifiers
are appropriate foundations. The fail-closed `needs_input` behavior is one of
the design's strongest features.

#### Verification and decision governance

The work-packet structure, named tests, allowed-file boundaries, ADRs,
open-question ownership and notebook standards create a strong audit trail in
principle. The notebook rules—frozen manifests, retained failures, package
logic rather than notebook business logic, explicit seeds and honest claim
ceilings—are stronger than typical exploratory ML workflows.

The project also records negative results rather than hiding them: R03 is a
no-go, V01 is `revise`, D01 is accepted with limitations, and G01 remains
blocked. This aligns with rigorous 2026 evaluation practice.

### 2.2 Development architecture gaps

#### Critical: documented completion is not tied to committed executable state

The operational status claims that all three services have complete A3
evidence and participate in `make -C ai_services run-suite`
(`agent_instructions/STATUS.md:82-101`). Current source contradicts that:

- `ai_services/recommendation/src/curalina_recommendation/bootstrap.py:8-14`
  prints a scaffold message and exits;
- `ai_services/variant_generator/src/curalina_variants/bootstrap.py:8-14`
  does the same;
- `ai_services/room_generator/src/curalina_rooms/bootstrap.py:8-14` does the
  same;
- `ai_services/variant_generator/src/curalina_variants/api/__init__.py` does
  not export `create_app`, although current tests import it;
- recommendation's tracked `api/routes.py:1-105` is still fixture-backed A1
  routing even though newer A3 repository/application modules exist as
  untracked files.

Observed on 2026-09-16:

```text
$ make -C ai_services run-suite
suite: starting recommendation, variants and rooms
suite error: recommendation exited before health check; stderr=''
make: *** [run-suite] Error 2
```

Git status shows a large volume of untracked source, tests, work packets,
ADRs, Docker files and orchestration files. Git reflog shows two
`reset: moving to HEAD` events on 2026-09-15 and 2026-09-16. The latest
commits explicitly describe recovery from silent `git reset --hard` data
loss. This violates the configuration-management intent of NIST SSDF and
prevents a reviewer from reconstructing a trusted release from version
control.

**Tech-lead decision required:** define the repository recovery baseline,
review every untracked implementation artifact, commit or discard it
deliberately, and prohibit destructive resets in shared-agent workflows.
Until that happens, `STATUS.md` cannot be treated as verified build state.

#### High: test evidence is fragmented and currently red

Current package checks do not reproduce the status counts:

- design rules: 80 tests pass at 91% branch coverage, while status reports 83
  at 92%;
- recommendation: 257 pass and 6 fail in the unit target; failures show newer
  tests expecting fields absent from the tracked domain model;
- variants: unit collection fails because `curalina_variants.api.create_app`
  is not exported;
- rooms: unit, contract, integration and worker targets pass, but the bootstrap
  remains a scaffold and is not covered by a start-the-real-process test;
- root contracts/suite-client tests: 10 pass, yet the actual suite command
  fails.

Passing unit/contract tests therefore do not establish deployable service
composition. The build needs a release-level verification command that starts
the exact committed artifacts through their production entrypoints.

#### High: dependency and build reproducibility is not established

All Python `requirements.lock` files are placeholders. Runtime dependencies
use open lower bounds such as `fastapi>=0.111`; Docker installs directly from
package metadata; base images use mutable tags such as `python:3.14-slim`;
there are no recorded image digests, SBOMs, signatures or build attestations.
Package versions remain `0.0.0`, and the shared rules package dependency is
not pinned to a release/version in `room_generator/pyproject.toml:16-23`.

This falls below normal 2026 supply-chain expectations and provides no SLSA
provenance claim. The notebook manifests partially address experiment
reproducibility, but they do not replace release dependency locking.

#### Medium: the process is strong on review roles but weak on automated policy

Many defects were caught by independent re-verification, which validates the
review model. The recurring pattern—incorrect green claims, files outside the
TypeScript compiler scope, bare exception fall-through, incomplete test runs,
and destructive resets—also shows that critical safeguards remain social
rather than automated.

No repository CI workflow was found that enforces full package tests, lint,
strict typing, contract compatibility, suite startup, secret scanning,
dependency audit, container build, SBOM generation or provenance capture.

## 3. Feature orchestration

### 3.1 What aligns well

`ai_services/suite_client.py:1-6` has the correct role: start isolated
services, communicate only over public HTTP, and avoid reading their databases
or local asset paths. It uses explicit ports, per-run temporary data, bounded
HTTP/startup timeouts, content-hash checks and named mismatch failures. Root
contract tests cover orchestration helpers and prior process-cleanup defects.

The UI adapter is also conceptually well bounded: feature-flagged, explicit
DTO mapping, no service database access, asset bytes imported through service
APIs, and provenance carried into the monolith. ADR-0016's fail-closed stance
is correct: an unavailable AI service must not silently produce a fabricated
successful render.

ADR-0018 is a good architecture artifact because it traces the actual customer
flow rather than assuming completed components compose automatically. Its
four chain breaks are precise and actionable:

1. profile mapping always returns `needs_input` for atmosphere;
2. recommendation identifiers cannot resolve to monolith products;
3. no reconciliation advances render rows from `generating` to terminal;
4. the UI does not handle `needs_input` as a terminal state.

It also correctly records that room generation currently returns an asset
identifier without producing image bytes.

### 3.2 Orchestration gaps

#### Critical: the declared suite cannot start the current services

The suite-client design is acceptable; the composition roots it launches are
not. This is more immediate than ADR-0018's browser-chain breaks. A process
smoke test that invokes each declared module would have caught the regression.

#### High: green infrastructure is not green customer behavior

`docker compose up` and root contract tests validate component availability
and selected contract flows. They do not prove quiz → recommendation → room →
results. `STATUS.md:124-146` acknowledges this distinction. The project needs
separate, machine-readable checks for:

- container/process readiness;
- service contract flow;
- customer journey flow;
- capability/model evidence.

Those checks must use different names and must never be collapsed into one
“green” status.

#### High: worker orchestration is development-only

Variants and rooms use one-pass workers. Compose can restart them, but there
is no explicit production queue topology, autoscaling policy, back-pressure,
dead-letter policy, worker heartbeat monitoring, job-age SLO or operational
recovery runbook. SQLite leases and fencing are good local semantics; they are
not a distributed deployment design.

#### High: readiness checks are unsafe

The variants and rooms Dockerfiles append `|| exit 0` to their health checks
(`variant_generator/Dockerfile:50-52`,
`room_generator/Dockerfile:50-52`). These containers report healthy even when
their API is dead. Root Compose also uses `condition: service_started` rather
than healthy/readiness conditions (`docker-compose.yml:73-79`). OpenAPI
availability is used as a health check rather than distinct liveness and
readiness endpoints.

#### Medium: the local environment is not self-contained

The monolith requires external Neon, S3, GCS and legacy model-provider
credentials (`docker-compose.yml:24-42`). The included Postgres service is
unused by both the monolith and current AI services. This is acceptable when
described as a connected development environment, but it is not a hermetic
local stack or reproducible CI environment.

## 4. Entire-build assessment against 2026 standards

### 4.1 Security and privacy

The architecture mentions loopback binding, sanitized errors and later
deployment gates, but the current Python APIs expose no authentication or
authorization layer. There is no reviewed threat model, trust-boundary
diagram, data-classification policy, retention/deletion policy, rate-limit
policy, tenant isolation design or concrete ASVS verification profile.

Compose imports the repository `.env` into the app container. This is common
for local development but should not become the production secret-delivery
pattern. Container definitions do not declare a non-root user, read-only root
filesystem, dropped capabilities, resource limits or network egress policy.

**Assessment:** acceptable for explicitly local, trusted development only;
not sufficient for any public or multi-user deployment.

### 4.2 Reliability and data management

Strengths include idempotency, leases, fencing, atomic transaction tests,
restart recovery and fail-closed behavior. Gaps include schema migrations,
backup/restore tests, disaster recovery objectives, multi-instance semantics,
object-storage lifecycle, queue durability and production database selection.
Tables are generally created imperatively at startup rather than through a
versioned migration chain.

### 4.3 Observability and operations

Request IDs exist in contracts, but no complete implementation of correlated
structured logs, metrics and traces across app → API → worker was found.
There are no declared SLOs, alert thresholds, dashboards, incident runbooks or
job-lifecycle operational metrics. In 2026, a distributed workflow should at
minimum correlate HTTP request IDs, job IDs, bundle/revision IDs, asset hashes
and worker attempts across logs and traces, with metrics for latency, queue
age, failure class and stuck jobs.

OpenTelemetry is a suitable standard, but this audit does not prescribe a
vendor or require every signal at once.

### 4.4 CI/CD and supply chain

No enforceable CI/CD or release promotion design was found. The project lacks:

- immutable dependency resolution;
- automated compatibility/migration checks;
- container vulnerability scanning;
- SBOM publication;
- signed artifacts and provenance;
- environment promotion and rollback policy;
- release/version policy for the four Python packages;
- a protected, reproducible source-to-artifact path.

This is the largest gap relative to NIST SSDF and SLSA after repository state
recovery.

### 4.5 Performance and scalability

The current local architecture is deliberately modest. There is no load model,
capacity plan, concurrency test, memory/GPU budget enforcement, queue-depth
target, cache policy or performance SLO. That is acceptable before a
deployment target and usage forecast exist, but it prevents production
acceptance.

### 4.6 Capability completeness

The build must not be described as a complete AI room-design platform yet:

- room image production is absent and G01 is blocked on `OQ-010`;
- recommendation still uses fixture/fake composition in the tracked runtime;
- R03 is a no-go for real-data acceptance;
- V01's result is `revise`, not pass;
- client-owned design-rule inputs remain unresolved;
- currency is unresolved between the app and recommendation service;
- items 19-24 in the current dispatch table remain material to the live flow.

These limitations are generally documented honestly. The main problem is that
the documentation currently overstates executable completion after source
loss.

## 5. Standards alignment matrix

| 2026 expectation | Evidence present | Material gap | Rating |
|---|---|---|---|
| Modular boundaries and ownership | Separate services/DBs/tests; HTTP-only suite; one shared pure rules package | Current composition roots reverted | Partial |
| Deterministic, explainable core | Rules-first decisions, `needs_input`, Decimal/mm invariants | Several rules blocked on client authority | Strong |
| Versioned contracts | `/v1`, schemas, fixtures, error envelope, additive/breaking policy | Code/schema generation or automated drift detection absent | Good |
| Durable async jobs | Leases, fencing, cancellation, recovery tests | Production queue and multi-instance design absent | Good for local |
| Honest AI evaluation | Separate gates, frozen runs, retained failures, claim ceilings | Several gates blocked or revise/no-go | Strong governance |
| Reproducible source and builds | ADRs, packets, manifests | Uncommitted source, destructive resets, placeholder locks, mutable images | Critical gap |
| Automated verification | Extensive unit/contract/property/integration tests | Current standard targets red; no CI/release gate | Critical gap |
| Application security | Sanitized errors, local binding intent | No authz/threat model/ASVS profile/rate limits/tenant policy | Major gap |
| Supply-chain security | Some package metadata and notebook manifests | No lock enforcement, SBOM, signing, attestations, digest-pinned images | Major gap |
| Observability | Request IDs and diagnostic intent | No correlated logs/metrics/traces/SLOs/alerts | Major gap |
| Deployment readiness | Compose and Dockerfiles | False health checks, external dependencies, root containers, no production target | Major gap |
| End-to-end orchestration | Suite-client and UI adapter architecture | Suite currently fails; ADR-0018 chain remains incomplete | Critical gap |

## 6. Proposed tech-lead review agenda

The later tech-lead review should make explicit decisions in this order:

1. **Repository recovery and source-of-truth decision.** Identify the intended
   post-reset implementation, review untracked files, commit a coherent
   baseline, and reconcile `STATUS.md` to commands run from that commit.
2. **Definition of green.** Establish separate required checks for source
   integrity, package tests, process startup, contract suite, customer E2E,
   and capability gates.
3. **CI and release policy.** Choose dependency locking, package/version
   promotion, image digest policy, SBOM/provenance generation, security scans
   and protected branch rules.
4. **Deployment target.** Decide whether the first supported target is a
   single trusted host, managed containers, Kubernetes, or another platform;
   then design persistence, workers, secrets, readiness and scaling for that
   target.
5. **Security profile.** Select an ASVS verification level/profile and define
   identity, authorization, tenant boundaries, TLS, rate limits, retention and
   privacy requirements.
6. **Observability contract.** Define correlated identifiers, structured log
   fields, metrics, traces, SLOs and runbooks across app/services/workers.
7. **Contract authority.** Decide whether JSON Schema/OpenAPI is generated from
   one source or checked bidirectionally to prevent DTO drift.
8. **Dead-code disposition.** Delete, quarantine or revive the legacy render
   stack and make type-check scope match the supported runtime graph.
9. **Customer-flow completion.** Resolve dispatch items 19-24 and keep room
   imagery visibly unavailable until `OQ-010` has authoritative input.
10. **Capability claims.** Preserve the current honest ceilings: no R03, V01,
    G01 or G-series acceptance language without their signed evidence.

## 7. Recommended acceptance position

A tech lead could reasonably **accept the architectural direction** while
withholding acceptance of the present build.

Acceptance of the direction should be conditional on preserving:

- deterministic-first behavior;
- service/database ownership;
- HTTP-only cross-service communication;
- durable worker semantics;
- explicit provenance and `needs_input` outcomes;
- separate build and capability gates;
- independent verification before closing packets.

Acceptance of the build should wait until:

- repository state is recovered and committed;
- standard test/lint/type/startup/suite commands are green from a clean clone;
- STATUS is generated or verified against that exact revision;
- dependency locks and container builds are reproducible;
- the supported customer flow has an executable E2E test;
- production claims are bounded to a defined deployment/security profile.

## Appendix A — commands executed during this audit

Commands were run against the working tree as found; no source was changed by
the audit except this document.

| Command | Result |
|---|---|
| `make -C ai_services test-contracts` | **Pass:** 10 tests |
| `make -C ai_services run-suite` | **Fail:** recommendation exits before readiness |
| `make test` in `design_rules` | **Pass:** 80 tests, 91% branch coverage |
| recommendation `make test` | **Fail:** 257 passed, 6 failed |
| variants `make test` | **Fail during collection:** `create_app` export missing |
| rooms unit/contract/integration/worker targets | **Pass:** 95/34/11/2 tests; unit aggregate 82% in this checkout |
| Ruff and mypy for rooms/design rules | **Pass** |
| `git status --short` | Large tracked-dirty and untracked implementation set |
| `git reflog -15 --date=iso` | Two reset-to-HEAD events and later recovery commits |

The audit did not run GPU inference, download models, use client data, change
external services, or claim model quality.

## Appendix B — evidence that should remain visible to reviewers

- `agent_instructions/STATUS.md:25-31` — services/app not joined.
- `agent_instructions/STATUS.md:49-62` — room image path absent and stock-photo
  behavior considered dishonest.
- `agent_instructions/STATUS.md:82-101` — documented green service state that
  current commands do not reproduce.
- `agent_instructions/STATUS.md:124-146` — Compose availability explicitly
  distinguished from working customer flow.
- `agent_instructions/STATUS.md:196-206` — repeated independent verification
  findings, remaining live-flow work and type-check gaps.
- `architecture/adr/ADR-0018-end-to-end-demo-scope-and-the-four-chain-breaks.md`
  — customer-flow trace and capability limitations.
- `ai_services/suite_client.py:1-6` — correct HTTP-only orchestration boundary.
- `ai_services/Makefile:12-22` — declared aggregate test and suite commands.
- `docker-compose.yml:24-42` — external dependencies and non-hermetic local
  environment.
- `docker-compose.yml:73-79` — service-started rather than readiness ordering.
- `ai_services/variant_generator/Dockerfile:50-52` and
  `ai_services/room_generator/Dockerfile:50-52` — health failures masked as
  success.
- `ai_services/*/requirements.lock` — placeholder lock policy.

