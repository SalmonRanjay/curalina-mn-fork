---
name: feedback-minimal-managed-infra
description: Owner repeatedly asks for minimal custom infrastructure on GCP — prefer managed/serverless primitives, no VMs/K8s/MLOps platforms; decide proportionally and state the cost of the simpler choice
metadata:
  type: feedback
---

The project owner has said several times that they want **as little custom
infrastructure as possible**. They are new to GCP and Terraform and think
in AWS terms. Default to Cloud Run (services and worker pools), Cloud SQL,
GCS, Artifact Registry, Secret Manager and Cloud Build. A VM, VPC, NAT,
GKE, Vertex Pipelines or MLflow needs a stated reason that a managed
primitive cannot meet.

**Why:** on 2026-09-30 the owner overrode my own same-day `ADR-0022`
(hybrid design with a VM) with "move everything to Cloud Run … minimal
custom infra … do I need a VM for a GitHub runner?". The answer was
`ADR-0023` (all Cloud Run, Cloud Build GitHub connection, no VPC) and
`ADR-0024` (model pipeline = one bucket, two scripts, a pin file, a bake
step).

**How to apply:**
- When a simpler managed option costs money (for example, always-on worker
  pools instead of jobs plus a sweeper), say so in dollars and pick the one
  with less code and fewer operations. Name the reversal trigger.
- Answer the owner's literal question directly ("no runner, no VM") before
  the design.
- Do not invent pipeline scope for a service that has no artifact. Saying
  "recommendation needs no model pipeline" was the proportionate answer.
- Put a beginner-facing summary in `docs/GCP_ORIENTATION.md` whenever the
  topology changes.

See also [[feedback-verify-before-ruling]], [[scope-owner-initiatives-as-standalone-trackables]].
