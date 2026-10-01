# Google Cloud: a five-minute orientation for Curalina

This is a map, not a manual. It lists only the Google Cloud (GCP) services
that Curalina's deployment uses, what each one is, and where to click.
For the real engineering plan, see
`architecture/adr/ADR-0023-all-cloud-run-topology-and-github-cloud-build-cicd.md`
(it supersedes parts of `ADR-0022`). For how trained model files reach
the app, see `architecture/adr/ADR-0024-model-artifact-pipeline-colab-to-cloud-run.md`.

**Finding things in the console:** open <https://console.cloud.google.com>
and pick your project in the dropdown at the top. Everything is under the
**Navigation menu (☰, top left)**. Google rearranges that menu from time
to time. If a path below doesn't match, type the service name into the
**search bar at the top**. That always works. Click the pin icon next to
anything you use often.

## The services we use

| Service | What it does, in one line | Where to find it |
|---|---|---|
| **Cloud Run: services** | Runs a container and gives it a web address. It adds copies under load and can shrink to zero when idle. The app, the three AI APIs and the renderer all run this way | ☰ → **Cloud Run** → Services |
| **Cloud Run: worker pools** | Runs a container that has no web address and just keeps working: our two background job workers (variants, rooms) | ☰ → **Cloud Run** → Worker pools |
| **Cloud SQL** | Managed Postgres. One server holding three separate databases, one each for recommendation, variants and rooms | ☰ → **SQL** |
| **Artifact Registry** | Private storage for our Docker images | ☰ → **Artifact Registry** → Repositories |
| **Cloud Build** | Google's build robot. On every merge to `main` in GitHub it tests, builds and deploys the changed parts. **No server or "runner" of ours is involved** | ☰ → **Cloud Build** → History / Triggers |
| **Secret Manager** | Stores passwords and keys (database URLs, session secret, AWS keys) so they never sit in code | ☰ → **Security** → **Secret Manager** |
| **Cloud Storage** | File buckets: user uploads, supplier images, trained model files (dev only), and Terraform's state file | ☰ → **Cloud Storage** → Buckets |
| **IAM & service accounts** | Who and what may do what. Each of our workloads runs under its own "service account" identity, and that is also how the services prove who they are to each other | ☰ → **IAM & Admin** → IAM / Service Accounts |
| **Cloud Shell** | A terminal in your browser with `gcloud` and `terraform` already installed. Nothing to install on your laptop | the **>_** icon, top right of the console |
| **Cloud Logging** | Every container's logs in one searchable place | ☰ → **Logging** → Logs Explorer |
| **Billing budgets** | Emails you when spending crosses a threshold | ☰ → **Billing** → Budgets & alerts |
| **APIs & Services** | The on/off switches for each GCP service in a project. Terraform flips them for you | ☰ → **APIs & Services** → Enabled APIs & services |

Not GCP, but part of the picture: **Neon** (the app's own Postgres
database) stays exactly where it is. **Terraform** is the tool (run from
Cloud Shell or your laptop) that creates all of the above from text files,
so the setup can be rebuilt identically. **There are no virtual machines to
look after.**

## How it fits together

```
 GitHub merge to main ──► Cloud Build ──► Artifact Registry ──► Cloud Run (new version)

 Users ──► Cloud Run "curalina-app" ──► Neon (app database, unchanged)
                   │  (signed requests)
                   ├──► Cloud Run "recommendation" ─┐
                   ├──► Cloud Run "variants" ───────┼──► Cloud SQL (three separate databases)
                   └──► Cloud Run "rooms" ──────────┘
       worker pools "variants-worker", "rooms-worker" ──► Cloud SQL
                   rooms-worker ──► Cloud Run "composite-renderer" (draws the room images)
```

## Three pipelines, three different jobs

| What changes | How it reaches production |
|---|---|
| **Code** | Merge to `main` deploys to dev automatically. Pushing a `release-…` tag and clicking **Approve** in Cloud Build copies the same images to prod |
| **Infrastructure settings** (sizes, env vars, permissions) | Edit the Terraform files, open a PR, then run `terraform apply` in Cloud Shell |
| **A trained model file** (today, only the room renderer's LoRA) | Train in Colab, run the notebook's "publish" cell (it uploads to a bucket), run the promote script, then change one line in `infra/models/sd15_lora.json` in a PR |

## Your AWS mental model, translated

| You know (AWS) | GCP equivalent | Note |
|---|---|---|
| **ECR** (container registry) | **Artifact Registry** | Same idea: you push images, then services pull them |
| **ECS** on Fargate (run containers) | **Cloud Run** | No cluster to manage. Each container is a "service" with its own HTTPS URL |
| ECS service with no load balancer (queue consumer) | **Cloud Run worker pool** | Always-on container with no web address |
| ECS on EC2 / **EC2** | **Compute Engine** | Ordinary virtual machines. **We do not use any** |
| **RDS** (managed database) | **Cloud SQL** | Used for the three AI services' databases. The app's own database stays on **Neon** |
| **CodeBuild / CodePipeline** | **Cloud Build** (with its GitHub connection) | Google runs the build machines. You never manage a runner |
| Secrets Manager | Secret Manager | Almost identical |
| S3 | Cloud Storage | Buckets and objects, same concepts |
| IAM roles for services | Service accounts | A workload's identity, with permissions attached |
| VPC / security groups | VPC network / firewall rules | **Not used by us.** Our services protect each other with IAM ("only the app's identity may call this"), not with network rules |
| CloudWatch Logs | Cloud Logging | |
| AWS Budgets | Billing → Budgets & alerts | |
| EKS | GKE | Kubernetes. We deliberately **don't** use it |

## Three GCP-specific things worth knowing

1. **Projects are the main boundary.** One GCP project is roughly one AWS
   account for our purposes. We will have two: dev and prod.
2. **Regions are named differently.** We use `us-east4` (Northern
   Virginia), because that is next to where our Neon database runs.
3. **You will not normally create things by clicking.** Use the console to
   *look* (logs, status, costs) and to approve prod releases. Make changes
   through Terraform. Anything created by hand gets out of sync with the
   Terraform files, which defeats the point of using them. The two
   exceptions, each done once, are connecting GitHub to Cloud Build and
   creating the project itself.
