# Local setup and repository conventions

## Starting point

This archive is documentation and notebook templates. It intentionally contains no service source tree, Docker files or application implementation. The following is the target layout teams should create after the experiment gates.

```text
ai_services/
  contracts/v1/
  recommendation/
    pyproject.toml
    requirements.lock
    notebooks/
    src/curalina_recommendation/
      domain/
      application/
      ports/
      adapters/
      api/
      bootstrap.py
    tests/unit/
    tests/integration/
    tests/contract/
    evaluation/
  variant_generator/
    pyproject.toml
    requirements.lock
    notebooks/
    src/curalina_variants/
      domain/
      application/
      ports/
      adapters/
      api/
      workers/
      bootstrap.py
    tests/
    evaluation/
  room_generator/
    pyproject.toml
    requirements.lock
    notebooks/
    src/curalina_rooms/
      domain/
      application/
      ports/
      adapters/
      api/
      workers/
      bootstrap.py
    tests/
    evaluation/
```

Use `domain`, `application`, `ports`, `adapters`, `api` and `bootstrap` consistently in all projects. Both image projects use the same test categories as recommendation. Shared contracts are documents/JSON schemas, not a common Python dependency that forces simultaneous releases.

## Notebook environment now

Use Python 3.11 as the proposed compatibility baseline. Verify it against the selected model library revisions before locking the image environments. The following commands run from the extracted architecture-pack root on macOS/Linux and install only the inspection/notebook tools, not model weights.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install jupyterlab ipykernel nbformat pandas openpyxl numpy matplotlib scikit-learn pillow
python -m ipykernel install --user --name curalina-architecture --display-name 'Curalina Architecture'
python -m jupyterlab
```

Windows PowerShell: replace the activation command with `.venv\Scripts\Activate.ps1` and use an installed Python 3.11 interpreter. These are discovery installs, not a reproducible release environment. After proving compatibility, record exact resolved packages and OS/Python details in each experiment manifest. Teams must produce a locked dependency set before the repeatability gate.

Keep a separate environment/kernel for each future service, especially the two image projects. Install PyTorch for the actual hardware using its official installation instructions; do not copy a CUDA wheel command onto an Apple laptop. CPU is sufficient for catalogue inspection, classical ranking and fake-adapter tests. CUDA hardware is the default target for image feasibility experiments; Apple MPS is optional and must be validated. CPU image inference is not a practical latency promise.

## Data and artifacts

Create ignored local directories `data/raw`, `data/curated`, `assets`, `runs`, and `model_cache`. Copy the supplied workbook unchanged into `data/raw/Celadon-CSV-Programmer-Handoff.xlsx`. The audit notebook searches for this exact relative location. Do not commit customer photos, raw supplier assets, credentials, model weights or notebook image outputs.

A run directory contains manifest.json, metrics.json, review.csv, candidate images and failure records. Relative artifact references resolve within that run. Hash source files before transformation. Preserve original images; normalize orientation/colour in derived copies.

## Service-stage local setup contract

Each team's README must provide tested commands to create its environment, install its package in editable mode, initialize its own database, import sample assets, run unit tests, launch its API and launch its worker where applicable. Those commands cannot be supplied as runnable service commands until the package exists.

Proposed local ports are 8101 for recommendation, 8102 for variants and 8103 for rooms. Proposed settings: `CURALINA_ENV=local`, `CURALINA_DATA_DIR`, `CURALINA_DATABASE_URL`, `CURALINA_MODEL_CACHE`, `CURALINA_DEVICE`, `CURALINA_MODEL_REVISION`, `CURALINA_MAX_IMAGE_PIXELS`, `CURALINA_JOB_TIMEOUT_SECONDS`. Validate required values at startup. Keep settings objects immutable and inject them at bootstrap; domain code must never fetch environment variables.

The initial image setup must benchmark one small supported inference request before running grids. Record peak device memory, host RAM, load time, latency and failure mode. A lack of suitable GPU hardware blocks diffusion evaluation only; it does not block CPU work or local service tests.

Sources: [Python virtual environments](https://docs.python.org/3/library/venv.html), [PyTorch installation](https://pytorch.org/get-started/locally/).

## Agent-ready local command contract

After the service scaffold phase, each service must provide the same local command surface from its own directory:

```bash
make setup
make test
make test-contract
make test-integration
make run-api
```

The two image services must also provide:

```bash
make run-worker
make test-worker
```

These targets may wrap Python commands, but their meanings are fixed. `setup` creates or validates the local environment without downloading model weights unless explicitly documented. `test` runs fast unit and contract tests without GPU, Internet, cloud accounts or customer data. `test-integration` may use local SQLite and filesystem assets. `run-api` starts a loopback-only HTTP server on the documented port. `run-worker` starts one local worker for the owning service.

At the future `ai_services/` root, provide a suite command layer:

```bash
make setup-all
make test-all
make test-contracts
make run-suite
```

`run-suite` starts all available APIs, required workers and a local fixture client. It must fail clearly when a service is missing, a port is occupied, a required setting is absent, or a contract fixture cannot be loaded. Docker may be added later, but the first suite runner must work directly on a local checkout so agents can debug without a cloud dependency.

## Existing UI integration settings

The current TypeScript application should call the standalone services only through configuration. Proposed local settings are:

```bash
CURALINA_AI_SERVICES_ENABLED=false
CURALINA_RECOMMENDATION_URL=http://127.0.0.1:8101
CURALINA_VARIANTS_URL=http://127.0.0.1:8102
CURALINA_ROOMS_URL=http://127.0.0.1:8103
CURALINA_AI_CONTRACT_VERSION=1.0
```

When the feature flag is off, the existing application may use its legacy path. When it is on, adapter code must translate current app records into service contracts and persist returned service IDs/revisions for traceability. The UI must not depend on service-local filesystem paths or SQLite row IDs.
