# Google Cloud: a five-minute orientation for Curalina

This is a map, not a manual. It lists only the Google Cloud (GCP) services
that Curalina's deployment uses, what each one is, and where to click.
For the real engineering plan, see
`architecture/adr/ADR-0022-gcp-deployment-topology-and-terraform-layout.md`.

**Finding things in the console:** open <https://console.cloud.google.com>
and pick your project in the dropdown at the top. Everything is under the
**Navigation menu (☰, top left)**. Google rearranges that menu from time
to time. If a path below doesn't match, type the service name into the
**search bar at the top**. That always works. Click the pin icon next to
anything you use often.

## The services we use

| Service | What it does, in one line | Where to find it |
|---|---|---|
| **Cloud Run** | Runs a container and gives it a web address. It adds copies under load and can shrink to zero when idle | ☰ → **Cloud Run** → Services |
| **Compute Engine** | A plain virtual machine you control. We use one to host the three AI services that keep data on disk | ☰ → **Compute Engine** → VM instances |
| **Persistent Disk / Snapshots** | The VM's hard drive (our AI data lives here) and its daily backups | ☰ → **Compute Engine** → Storage → Disks / Snapshots |
| **Artifact Registry** | Private storage for our Docker images | ☰ → **Artifact Registry** → Repositories |
| **Secret Manager** | Stores passwords and keys (database URL, session secret, AWS keys) so they never sit in code | ☰ → **Security** → **Secret Manager** |
| **Cloud Storage** | File buckets: user uploads, supplier images, and Terraform's state file | ☰ → **Cloud Storage** → Buckets |
| **VPC network** | The private network the app and the VM talk over, plus its firewall rules | ☰ → **VPC network** → VPC networks / Firewall |
| **Cloud NAT** | Lets the VM reach the internet (for software updates) without being reachable from it | ☰ → **Network services** → Cloud NAT |
| **IAM & service accounts** | Who and what may do what. Each of our workloads runs under its own "service account" identity | ☰ → **IAM & Admin** → IAM / Service Accounts |
| **Cloud Logging** | Every container's logs in one searchable place | ☰ → **Logging** → Logs Explorer |
| **Billing budgets** | Emails you when spending crosses a threshold | ☰ → **Billing** → Budgets & alerts |
| **APIs & Services** | The on/off switches for each GCP service in a project. Terraform flips them for you | ☰ → **APIs & Services** → Enabled APIs & services |

Not GCP, but part of the picture: **Neon** (our Postgres database) stays
exactly where it is. **Terraform** is the tool on your laptop that creates
all of the above from text files, so the setup can be rebuilt identically.

## How it fits together

```
 Users ──► Cloud Run "curalina-app" ──► Neon (database, unchanged)
                   │
                   ▼ private network
           Compute Engine VM ── recommendation, variants, rooms (+ their workers)
                   │
                   ▼
           Cloud Run "composite-renderer" (draws the room images)
```

## Your AWS mental model, translated

| You know (AWS) | GCP equivalent | Note |
|---|---|---|
| **ECR** (container registry) | **Artifact Registry** | Same idea: you push images, then services pull them |
| **ECS** on Fargate (run containers) | **Cloud Run** | No cluster to manage. Each container is a "service" with its own HTTPS URL |
| ECS on EC2 / **EC2** | **Compute Engine** | Ordinary virtual machines |
| **RDS** (managed database) | **Cloud SQL** | **Analogy only, not an action item.** Our database is **Neon**, which is already managed, serverless Postgres. It is not being moved or replaced |
| Secrets Manager | Secret Manager | Almost identical |
| S3 | Cloud Storage | Buckets and objects, same concepts |
| IAM roles for services | Service accounts | A workload's identity, with permissions attached |
| VPC / security groups | VPC network / firewall rules | GCP firewall rules apply network-wide and target VMs by "tag" |
| CloudWatch Logs | Cloud Logging | |
| AWS Budgets | Billing → Budgets & alerts | |
| EKS | GKE | Kubernetes. We deliberately **don't** use it |

## Three GCP-specific things worth knowing

1. **Projects are the main boundary.** One GCP project is roughly one AWS
   account for our purposes. We will have two: dev and prod.
2. **Regions are named differently.** We use `us-east4` (Northern
   Virginia), because that is next to where our Neon database runs.
3. **You will not normally create things by clicking.** Use the console to
   *look* (logs, status, costs). Make changes through Terraform. Anything
   created by hand gets out of sync with the Terraform files, which defeats
   the point of using them.
