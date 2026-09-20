# Curalina Project Map and Understanding

**Version:** 1.0
**Last Updated:** September 12, 2026
**Status:** Active Development - Transitioning to Standalone AI Services

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State: Production Monolith](#current-state-production-monolith)
3. [Future State: Standalone AI Services](#future-state-standalone-ai-services)
4. [Gap Analysis](#gap-analysis)
5. [Migration Strategy](#migration-strategy)
6. [Implementation Phases (A0-A6)](#implementation-phases-a0-a6)
7. [Notebook Evidence Gates](#notebook-evidence-gates)
8. [Technical Decisions](#technical-decisions)
9. [Quick Reference](#quick-reference)
10. [Work Assignment Guide](#work-assignment-guide)

---

## Executive Summary

### Current Reality
Curalina is a **production-ready TypeScript/Node.js monolith** with comprehensive AI-powered interior design capabilities. The platform includes:
- Full product catalog management (35+ database tables)
- Multi-step design quiz with context persistence
- AI rendering via Gemini, OpenAI, and Stability AI
- E-commerce with shopping cart and order management
- Extensive admin tooling (20+ pages)
- 27+ specialized service modules

### Future Vision
Transition to **three independent Python AI services** with:
- `recommendation` - Product selection and room composition (CPU-focused)
- `variant_generator` - Color/material variants via image manipulation (GPU)
- `room_generator` - Photorealistic room rendering (GPU)

Each service will be independently deployable, testable, and scalable, with the current TypeScript UI becoming a contract consumer.

### Critical Constraint
**Notebook evidence gates all model-backed claims.** No service may implement a production AI path until its corresponding notebook (R01-R03, V01-V03, G01-G03) has produced reviewed evidence. This discipline prevents shipping unvalidated AI behavior.

---

## Current State: Production Monolith

### Architecture Overview

```
curalina/
├── server/                  # Express.js backend (TypeScript)
│   ├── index.ts            # App factory with Firebase Functions support
│   ├── routes.ts           # Main route registration
│   ├── routes-curalina.ts  # AI-specific routes (5 LSP errors here)
│   ├── db.ts               # Drizzle ORM + Neon PostgreSQL
│   ├── storage-curalina.ts # 1,487 lines of data access (80+ methods)
│   ├── localAuth.ts        # Passport.js authentication
│   └── services/           # 27+ business logic modules
│       ├── gemini-ai.ts                    # Product selection algorithms
│       ├── gemini-image-only-render.ts     # Image-only rendering
│       ├── openai-render.ts                # DALL-E integration
│       ├── stability-ai-render.ts          # Stable Diffusion
│       ├── stability-inpainting-render.ts  # Product swap inpainting
│       ├── hybrid-compositing.ts           # Multi-modal rendering
│       ├── enhanced-product-analysis.ts    # AI product analysis
│       ├── room-composition-service.ts     # Spatial layout
│       ├── selection-ledger-service.ts     # Selection caching
│       ├── spatial-fit-validator.ts        # Dimension checking
│       ├── shared-prompt-builder.ts        # Prompt generation
│       └── ... (17 more services)
│
├── client/src/              # React frontend (TypeScript)
│   ├── pages/              # 30+ page components
│   │   ├── Home.tsx, Quiz.tsx, Results.tsx
│   │   ├── admin/          # 20+ admin pages
│   │   └── portal/         # User dashboard pages
│   ├── components/
│   │   ├── quiz/           # Multi-step quiz components (V1 and V2)
│   │   ├── home/           # Landing page sections
│   │   └── ui/             # 50+ shadcn/ui components
│   ├── hooks/
│   │   ├── useAuth.tsx     # React Query auth hook
│   │   └── use-toast.ts    # Toast notifications
│   └── lib/
│       └── queryClient.ts  # Centralized API request logic
│
├── shared/                  # Shared TypeScript types
│   ├── schema.ts           # Base schema (users, sessions, content)
│   └── schema-curalina.ts  # AI-specific schema (products, renders, etc.)
│
├── functions/               # Firebase Cloud Functions wrapper
│   └── src/index.ts
│
└── migrations/              # Drizzle database migrations
```

### Database Schema (PostgreSQL via Neon)

**35+ Tables Organized by Domain:**

**Product Catalog (6 tables):**
- `categories` - Room types and furniture categories
- `suppliers` - Furniture suppliers with contact info
- `products` - **Core table** with:
  - SKU, pricing (trade/retail), dimensions, materials, colors
  - `roomType[]`, `designStyle[]`, `styleTags[]`, `keyFeatures[]`
  - `images[]`, `asset3dUrl` (unused)
  - `visualDescription`, `visualDescriptionGemini`, `visualDescriptionOpenAI`, `visualDescriptionFrontView`
  - `structuredAnalysis` (JSON), `structuredAnalysisQuality`
  - `imageHealth`, `lastValidatedAt`
  - Inventory, availability, shipping
- `product_functional_categories` - Functional groupings

**Quiz & Rendering (8 tables):**
- `quiz_responses` - User preferences from 7-step quiz
- `renders` - AI-generated room designs with status tracking
- `comparison_renders` - Side-by-side AI service comparisons
- `render_products` - Products featured in renders (snapshot)
- `render_events` - Lifecycle tracking (created, viewed, products_added_to_cart)
- `selection_ledger` - **Critical caching table** - stores product selection rationale to avoid re-computation

**E-Commerce (3 tables):**
- `cart_items` - Session-based shopping cart
- `orders` - Purchase orders with Stripe payment intent ID
- `order_items` - Order line items with price snapshots

**AI Training Data (4 tables):**
- `design_examples` - Good/bad design examples for training
- `product_packages` - Curated product bundles
- `placement_guidelines` - Room-specific placement rules
- `design_rules` - Design principles and constraints

**Job Management (12 tables):**
- `upload_jobs` / `upload_job_files` - Bulk product uploads
- `visual_analysis_jobs` / `visual_analysis_products` - AI analysis queues
- `s3_renaming_jobs` / `s3_renaming_products` - S3 file renaming
- `visual_description_jobs` / `visual_description_products` - Description generation

**Auth & Content (4 tables):**
- `users` - User accounts with role-based access (admin/user)
- `sessions` - PostgreSQL session store for Passport.js
- `content` - CMS content
- `documentation_sections` / `documentation_comments` - Internal docs

### Current AI Integration Flow

```
1. User completes quiz
   ↓
2. POST /api/quiz - Store quiz_responses
   ↓
3. Navigate to loading page
   ↓
4. POST /api/render (PLACEHOLDER - returns immediate success)
   ↓
5. Background (not yet wired):
   - room-parser-service.ts extracts requirements
   - gemini-ai.ts selects products (style matching, visual similarity)
   - budget-allocation.ts distributes budget
   - room-composition-service.ts validates spatial layout
   - shared-prompt-builder.ts generates AI prompt
   - gemini-image-only-render.ts OR openai-render.ts OR stability-ai-render.ts
   - render-ingestion.ts processes result
   - selection-ledger-service.ts caches decisions
   ↓
6. Loading page polls /api/render/latest?sessionId=X
   ↓
7. Results page displays render + products
```

**Gap:** Steps 5 are implemented as services but not fully orchestrated end-to-end.

### Key Features Implemented ✅

**Quiz System:**
- 7-step quiz with conditional logic (room type determines feature options)
- localStorage persistence via QuizContext
- Image uploads: vibe board (up to 3) + room photo/floor plan (1)
- Multi-select: styles (up to 2), color palettes (up to 2)
- Gemini Vision analysis of uploaded images (color/material/texture extraction)

**Product Management:**
- Full CRUD with advanced filters
- Bulk CSV/Excel import with AI folder matching
- Multi-angle product image analysis (Gemini + OpenAI)
- Visual description generation (3 variants: Gemini, OpenAI, Front View)
- Image health monitoring with auto-repair workflows
- S3 direct uploads with presigned URLs

**AI Services:**
- **Product Selection Algorithm** (gemini-ai.ts):
  - Style matching with synonym expansion ("midcentury" = "mid-century" = "mcm")
  - Visual similarity scoring (40% color, 35% material, 25% texture)
  - Budget-aware filtering (currently disabled per design decision)
  - Dimension parsing and validation
  - Category balancing (avoid 5 lamps and no seating)
- **Comparison Rendering** (comparison_renders table):
  - Generate same brief with Gemini vs OpenAI vs Stability
  - Side-by-side quality comparison
- **Selection Ledger** (deduplication):
  - Cache product selections by quiz hash + catalog snapshot
  - Avoid re-running expensive selection logic

**E-Commerce:**
- Session-based cart (works for anonymous users)
- Order creation with product price snapshots
- Stripe payment intent field (integration incomplete)

**Admin Tools:**
- 20+ admin pages covering all aspects of platform management
- Mapping analysis (style coverage, color palette gaps, room composition)
- Selection ledger auditing (see decision rationale for each render)
- Render storage with lifecycle events
- Job queue monitoring (uploads, analysis, renaming)

### Current Limitations ⚠️

**Incomplete Features:**
1. **Render Generation Pipeline** - Services exist but not orchestrated
2. **Stripe Checkout** - Order tables exist, integration missing
3. **Email Notifications** - No email service configured
4. **TypeScript Errors** - 5 LSP diagnostics in `routes-curalina.ts`

**Design Decisions:**
- Budget enforcement disabled (prioritize quality over budget constraints)
- Image compositing is MVP (Sharp library, no background removal or shadows)
- Some quiz steps have V1/V2 variants (refactoring in progress)

### Technology Stack

**Backend:**
- Node.js 20 + TypeScript 5.6
- Express.js 4.21
- Drizzle ORM 0.39 + Neon PostgreSQL
- Passport.js (Local + OIDC strategies)
- Session storage: PostgreSQL via `connect-pg-simple`
- AI: `@google/genai` 1.30, `openai` 6.9
- Image: `sharp` 0.34, AWS S3 SDK v3, Google Cloud Storage

**Frontend:**
- React 18 + TypeScript
- Vite 5.4 build system
- TanStack Query 5.60 (React Query)
- Wouter 3.3 (routing)
- Tailwind CSS 3.4 + shadcn/ui (Radix UI primitives)
- Zod 3.24 for validation

**Deployment:**
- Firebase Functions (Cloud Run via `functions/src/index.ts`)
- Environment detection: `process.env.K_SERVICE` for Cloud Run
- `cloudbuild.yaml` for Google Cloud Build

---

## Future State: Standalone AI Services

### Target Architecture

```
ai_services/                    # New Python services root
├── contracts/v1/              # Shared HTTP contract fixtures
│   ├── design_profile.json
│   ├── render_request.json
│   ├── variant_request.json
│   └── experiment_manifest.json
│
├── recommendation/            # CPU-focused service (port 8101)
│   ├── pyproject.toml
│   ├── requirements.lock
│   ├── notebooks/            # Jupyter notebooks R01-R03
│   │   ├── R01_catalogue_audit.ipynb
│   │   ├── R02_ranking_baseline.ipynb
│   │   └── R03_room_composition.ipynb
│   ├── src/curalina_recommendation/
│   │   ├── domain/           # Product, Profile, Bundle, Money
│   │   ├── application/      # ImportCatalogue, RankProducts, ComposeRoom
│   │   ├── ports/            # CatalogueRepository, FeatureEncoder
│   │   ├── adapters/         # SQLite, sklearn, sentence-transformers
│   │   ├── api/              # FastAPI/Flask endpoints
│   │   └── bootstrap.py      # App factory with settings injection
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── contract/
│   ├── evaluation/           # Held-out test results
│   └── Makefile              # setup, test, run-api
│
├── variant_generator/         # GPU service (port 8102)
│   ├── notebooks/            # V01-V03
│   │   ├── V01_asset_import.ipynb
│   │   ├── V02_color_transfer.ipynb
│   │   └── V03_mask_quality.ipynb
│   ├── src/curalina_variants/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── ports/
│   │   ├── adapters/
│   │   ├── api/              # Job submission endpoints
│   │   ├── workers/          # GPU inference workers
│   │   └── bootstrap.py
│   ├── tests/
│   └── Makefile              # setup, test, run-api, run-worker
│
├── room_generator/            # GPU service (port 8103)
│   ├── notebooks/            # G01-G03
│   │   ├── G01_render_plan.ipynb
│   │   ├── G02_scene_composition.ipynb
│   │   └── G03_visual_quality.ipynb
│   ├── src/curalina_rooms/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── ports/
│   │   ├── adapters/
│   │   ├── api/
│   │   ├── workers/
│   │   └── bootstrap.py
│   ├── tests/
│   └── Makefile
│
└── Makefile                   # Suite-level: setup-all, test-all, run-suite
```

### Service Boundaries

| Service | Owns | Does NOT Own |
|---------|------|--------------|
| **recommendation** | Catalogue import, feature indexing, ranking, bundle composition, layout validation | Image pixels, customer accounts, payment processing |
| **variant_generator** | Source image imports, masks, color transforms, variant jobs, candidate review | Supplier pricing, purchasable SKU creation |
| **room_generator** | Room asset imports, render jobs, scene composition, visual validation | Product selection (receives bundle from recommendation) |

**Critical Rule:** No service imports another's Python internals or accesses its database directly. All communication via HTTP contracts or exported fixtures.

### Clean Architecture Pattern

Each service follows the same structure:

**Domain Layer:**
- Pure business logic with zero framework dependencies
- Value objects (Money, Dimensions, ColorSpace)
- Entities (Product, DesignProfile, Bundle, Job)
- Domain services (validation rules, invariants)

**Application Layer:**
- Use cases (ImportCatalogue, RankProducts, ComposeRoom, SubmitRenderJob)
- Orchestrates domain logic and ports
- Transaction boundaries

**Ports:**
- Interfaces that domain/application depend on (not implementations)
- Examples: CatalogueRepository, FeatureEncoder, BundleSolver, JobQueue, ModelInference

**Adapters:**
- Concrete implementations of ports
- SQLite, PostgreSQL, S3, filesystem, sklearn, sentence-transformers, Stability API
- Can be swapped without changing domain/application

**API:**
- HTTP layer (FastAPI recommended)
- Request/response DTOs separate from domain entities
- Error translation to HTTP status codes
- Version checking (reject major version mismatches)

**Bootstrap:**
- App factory that wires adapters to ports
- Immutable Settings object (validated at startup)
- Dependency injection (no global state)

### HTTP Contracts

**Recommendation Service (Port 8101):**
- `POST /v1/catalogue/imports` - Import product catalogue → snapshot ID
- `POST /v1/recommendations` - Rank products by category → scored list
- `POST /v1/bundles` - Compose full room → Bundle with feasible=true/false
- `POST /v1/bundles/{id}/substitutions` - Swap product → new bundle revision

**Variant Generator Service (Port 8102):**
- `POST /v1/assets` - Upload product image → asset metadata
- `POST /v1/variant-jobs` - Submit color/material variant → 202 + job ID
- `GET /v1/jobs/{id}` - Poll job status → queued/running/succeeded/failed
- `POST /v1/jobs/{id}/cancel` - Cancel job (cooperative)
- `POST /v1/candidates/{id}/reviews` - Approve/reject variant
- `GET /v1/assets/{id}/content` - Download asset (authorized)

**Room Generator Service (Port 8103):**
- `POST /v1/assets` - Upload room photo/floor plan
- `POST /v1/render-jobs` - Submit render request → 202 + job ID
- `GET /v1/jobs/{id}` - Poll job status
- `POST /v1/jobs/{id}/cancel` - Cancel job
- `POST /v1/candidates/{id}/reviews` - Approve/reject render
- `GET /v1/assets/{id}/content` - Download render

**Contract Rules:**
- Semantic string codes (not magic numbers)
- ISO timestamps in UTC
- Explicit units (mm for dimensions, minor currency units or decimal strings)
- Never binary float for money
- Schema version in payload (`schema_version=1.0`)
- Reject unsupported major version with 422
- Error format: `{ code, message, details, retryable, request_id }`

### Durable Job Behavior

**State Machine:**
```
queued → running → succeeded | failed | cancelled
```

**Idempotency:**
- Key scoped to: owner + endpoint + canonical request hash
- Same key + same payload → return original job
- Same key + different payload → 409 Conflict

**Implementation:**
- SQLite job table committed atomically with enqueue
- Worker polls durable table (no in-memory queue initially)
- Lease-based claim with fencing token
- Commit completion only if token still valid
- Temp-file rename for atomic output creation
- Expired jobs recovered after restart

**Why SQLite:**
- Simple local baseline, no infrastructure
- Sufficient for single-worker-per-service initially
- Can migrate to Redis/RabbitMQ later via JobQueue port

### UI Integration Contract

**TypeScript App Becomes Consumer:**

```typescript
// Feature flag
CURALINA_AI_SERVICES_ENABLED=false  // Use legacy path
CURALINA_RECOMMENDATION_URL=http://127.0.0.1:8101
CURALINA_VARIANTS_URL=http://127.0.0.1:8102
CURALINA_ROOMS_URL=http://127.0.0.1:8103
CURALINA_AI_CONTRACT_VERSION=1.0
```

**Adapter Responsibilities:**
1. Convert quiz responses → DesignProfile contract
2. Import product catalogue snapshots via recommendation service
3. Store bundle IDs, revisions, explanations
4. Upload assets to owning services
5. Store job IDs, candidate IDs, review IDs
6. Display structured failures (not generic "generation failed")

**Adapter Must NOT:**
- Connect to AI service databases
- Expose AI service filesystem paths
- Invent data to fill contract fields (return needs_input error instead)
- Make AI services aware of current app's database schema

---

## Gap Analysis

### What Must Be Built 🔨

**Infrastructure:**
- [ ] `ai_services/` directory structure
- [ ] Python 3.11 virtual environments (3 separate)
- [ ] Makefile targets for each service (setup, test, run-api, run-worker)
- [ ] Suite-level Makefile (setup-all, test-all, run-suite)
- [ ] Contract fixture library in `contracts/v1/`
- [ ] Jupyter notebook infrastructure (3 kernels)

**Recommendation Service:**
- [ ] Domain: Product, Profile, Bundle, Money value objects
- [ ] Application: ImportCatalogue, RankProducts, ComposeRoom use cases
- [ ] Ports: CatalogueRepository, FeatureEncoder, BundleSolver
- [ ] Adapters: SQLite catalogue, sklearn baseline, sentence-transformers
- [ ] API: FastAPI endpoints with contract validation
- [ ] Tests: Unit (20+ cases), contract, integration
- [ ] Notebooks: R01 (audit), R02 (ranking), R03 (composition)

**Variant Generator Service:**
- [ ] Domain: Asset, VariantJob, Mask, ColorSpace
- [ ] Application: SubmitVariantJob, ProcessVariant, ReviewCandidate
- [ ] Ports: AssetRepository, JobQueue, ModelInference
- [ ] Adapters: SQLite jobs, filesystem assets, color transfer model
- [ ] API: Job submission, polling, cancellation
- [ ] Workers: GPU inference loop with lease management
- [ ] Tests: Worker lifecycle, retry, cancellation
- [ ] Notebooks: V01 (import), V02 (color transfer), V03 (masks)

**Room Generator Service:**
- [ ] Domain: RenderJob, Scene, RenderPlan
- [ ] Application: SubmitRenderJob, ProcessRender, ReviewCandidate
- [ ] Ports: AssetRepository, JobQueue, ModelInference
- [ ] Adapters: SQLite jobs, filesystem assets, Stable Diffusion/Gemini
- [ ] API: Job submission, polling, cancellation
- [ ] Workers: GPU inference loop
- [ ] Tests: Worker lifecycle, scene analysis
- [ ] Notebooks: G01 (plan), G02 (composition), G03 (quality)

**UI Adapter:**
- [ ] TypeScript adapter module: `server/adapters/ai-services/`
- [ ] Quiz response → DesignProfile mapper
- [ ] Product row → Product contract mapper
- [ ] Render record → Job tracking
- [ ] Feature flag logic
- [ ] Adapter fixture tests

**Contracts & Suite:**
- [ ] Shared contract fixtures (JSON files)
- [ ] Contract validation tests (each service)
- [ ] Suite runner script
- [ ] Health check endpoints
- [ ] Cross-service smoke tests

### What Can Be Preserved ✅

**Current TypeScript App:**
- ✅ User authentication (sessions, roles)
- ✅ Product catalog database tables (will export to recommendation)
- ✅ Quiz flow UI (will send to adapter)
- ✅ Results page (will receive from room service)
- ✅ Shopping cart & orders
- ✅ Admin panel (may add AI service monitoring)
- ✅ S3 image uploads

**Current Services (Legacy Path):**
- ✅ Keep as fallback behind feature flag
- ✅ `gemini-ai.ts`, `openai-render.ts`, etc. still callable
- ✅ Allows gradual migration

### What Must Be Adapted 🔄

**Quiz to DesignProfile:**
```typescript
// Current: quizResponses table
{
  roomType: 'living_room',
  styles: ['organic_modern'],
  colorPalettes: ['warm_neutrals'],
  keyFeatures: ['storage_solutions', 'workspace'],
  budgetRange: '3000-5000',
  vibeImages: ['gs://...'],
  roomPhoto: 'gs://...',
  preferences: {...}
}

// Future: DesignProfile contract
{
  schema_version: '1.0',
  room_type: 'living_room',
  styles: ['organic_modern'],
  atmosphere: 'warm_balanced',
  pattern_level: 'moderate',
  lifestyle_requirements: {
    storage: true,
    workspace: true,
    pet_friendly: false
  },
  furniture_budget: {
    amount: '4000.00',
    currency: 'CAD',
    inclusions: ['furniture', 'lighting', 'textiles']
  },
  room_geometry: {
    envelope_mm: { width: 4500, depth: 6000, height: 2700 },
    // ... from floor plan analysis
  },
  vibe_asset_ids: ['variant-svc-asset-001', 'variant-svc-asset-002']
}
```

**Render Pipeline:**
```
Current (Placeholder):
quiz → /api/render → immediate success

Future (Job-Based):
quiz → adapter → DesignProfile
  ↓
recommendation:/v1/bundles → Bundle
  ↓
adapter uploads product images → variant:/v1/assets
  ↓
adapter uploads room photo → room:/v1/assets
  ↓
room:/v1/render-jobs → 202 + job_id
  ↓
UI polls room:/v1/jobs/{id}
  ↓
queued → running → succeeded
  ↓
adapter stores job_id, bundle_revision, candidate_id
  ↓
results page displays render + bundle products
```

**Product Export:**
```typescript
// Current: products table (PostgreSQL)
// Future: recommendation service imports via /v1/catalogue/imports

// Adapter periodically syncs:
const products = await db.select().from(productsTable);
const catalogueSnapshot = {
  schema_version: '1.0',
  products: products.map(p => ({
    product_id: p.id,
    supplier_id: p.supplierId,
    supplier_sku: p.sku,
    category: p.category,
    name: p.name,
    dimensions: {
      width_mm: p.dimensions.w * 25.4,
      depth_mm: p.dimensions.d * 25.4,
      height_mm: p.dimensions.h * 25.4
    },
    retail_price: { amount: p.price, currency: 'CAD' },
    // ... map all fields
  }))
};

const response = await fetch('http://localhost:8101/v1/catalogue/imports', {
  method: 'POST',
  body: JSON.stringify(catalogueSnapshot)
});

const { snapshot_id } = await response.json();
// Store snapshot_id for traceability
```

---

## Migration Strategy

### Phase 1: Parallel Implementation (Weeks 1-8)

**Objective:** Build AI services alongside current app without disruption.

**Activities:**
- Create `ai_services/` directory structure
- Implement notebook R01-R03, V01-V03, G01-G03 in parallel
- Build Python services against contract fixtures
- Keep feature flag OFF (`CURALINA_AI_SERVICES_ENABLED=false`)
- Current app continues using legacy render path

**Outcome:** Three standalone services running locally, proven via suite tests.

### Phase 2: UI Adapter Integration (Weeks 9-10)

**Objective:** Wire TypeScript app to call Python services.

**Activities:**
- Implement adapter module (`server/adapters/ai-services/`)
- Add feature flag toggle in admin settings
- Test adapter with fixture contracts
- Enable flag for internal testing only

**Outcome:** App can route to either legacy or AI services.

### Phase 3: Gradual Rollout (Weeks 11-12)

**Objective:** Shift traffic to AI services.

**Activities:**
- Enable flag for 10% of users (A/B test)
- Monitor error rates, latency, quality
- Compare AI service renders vs legacy renders
- Fix bugs discovered in production-like conditions

**Outcome:** Confidence in AI services at scale.

### Phase 4: Legacy Deprecation (Week 13+)

**Objective:** Remove old code paths.

**Activities:**
- Enable flag for 100% of users
- Deprecate `server/services/gemini-ai.ts`, `openai-render.ts`, etc.
- Remove fallback logic after 2 weeks of stability
- Update documentation

**Outcome:** Clean codebase with single AI path.

### Rollback Plan

**If AI services fail:**
1. Set `CURALINA_AI_SERVICES_ENABLED=false` (instant rollback)
2. Traffic routes to legacy path
3. Fix issues in AI services
4. Re-enable flag

**This is why feature flags are mandatory.**

---

## Implementation Phases (A0-A6)

### Phase Overview

| Phase | Focus | Deliverables | Can Start Before Notebooks? |
|-------|-------|--------------|------------------------------|
| A0 | Scaffold | Project structure, settings, READMEs, Makefiles | ✅ Yes |
| A1 | Contracts | JSON fixtures, DTOs, error vocabulary | ✅ Yes |
| A2 | Use Cases | Domain logic, ports, fake adapters first | ⚠️ Fake adapters yes, real logic needs notebooks |
| A3 | APIs & Workers | HTTP endpoints, job queues, SQLite | ✅ Yes (with fake adapters) |
| A4 | Suite | Cross-service smoke tests | ✅ Yes (with fixtures) |
| A5 | UI Adapter | TypeScript adapter code | ✅ Yes (against contract fixtures) |
| A6 | Evaluation | Notebook results, ADRs, promotion decision | ❌ No - requires notebook gates |

**Key Insight:** Phases A0-A5 can proceed with fake/fixture data while notebooks are in progress. This parallelizes work. Only A6 (claiming model quality) requires notebook evidence.

### A0: Scaffold (All Services)

**Objective:** Create project skeletons with no business logic.

**Deliverables Per Service:**
- `pyproject.toml` with Python 3.11, dependencies
- `requirements.lock` (exact versions)
- Directory structure: `src/{service}/domain/application/ports/adapters/api/`
- `bootstrap.py` - app factory
- Immutable `Settings` object:
  ```python
  @dataclass(frozen=True)
  class Settings:
      env: str  # local/staging/production
      data_dir: Path
      database_url: str
      model_cache: Path | None
      device: str  # cpu/cuda/mps
      max_image_pixels: int
      job_timeout_seconds: int

      @classmethod
      def from_env(cls) -> Settings:
          # Validate required values, fail fast
          # Never read env vars from domain code
  ```
- Makefile targets (may be no-ops initially):
  ```makefile
  setup:
      python3.11 -m venv .venv
      .venv/bin/pip install -e .

  test:
      .venv/bin/pytest tests/unit tests/contract

  test-integration:
      .venv/bin/pytest tests/integration

  run-api:
      .venv/bin/python -m curalina_recommendation.api
  ```
- `.gitignore` additions:
  ```
  .venv/
  __pycache__/
  *.pyc
  data/raw/
  data/curated/
  runs/
  model_cache/
  *.db
  *.db-journal
  ```

**Exit Criteria:**
- `make setup` completes on fresh checkout
- `make test` runs (even if no tests yet)
- README documents local setup

### A1: Contracts (All Services)

**Objective:** Freeze request/response meaning before implementing logic.

**Deliverables:**
- JSON fixtures in `contracts/v1/`:
  - `design_profile.json` - Sample profile
  - `bundle_request.json` - Bundle request
  - `bundle_response_success.json` - Feasible bundle
  - `bundle_response_no_solution.json` - Infeasible with reasons
  - `variant_request.json` - Variant job submission
  - `render_request.json` - Render job submission
  - `error_invalid_input.json` - 400 error
  - `error_unsupported_version.json` - 422 error
- Typed DTOs (Pydantic recommended):
  ```python
  from pydantic import BaseModel, Field

  class DesignProfile(BaseModel):
      schema_version: str = Field(..., pattern=r'^\d+\.\d+$')
      room_type: str
      styles: list[str]
      atmosphere: str | None = None
      # ...

  class BundleRequest(BaseModel):
      profile: DesignProfile
      catalogue_snapshot_id: str
      rules_version: str = '1.0'

  class BundleResponse(BaseModel):
      bundle_id: str
      revision: int
      feasible: bool
      line_items: list[LineItem]
      total_cost: Money
      violations: list[str]
      # ...
  ```
- Contract tests:
  ```python
  def test_bundle_rejects_unsupported_major_version():
      request = load_fixture('bundle_request.json')
      request['profile']['schema_version'] = '2.0'
      response = client.post('/v1/bundles', json=request)
      assert response.status_code == 422
      assert response.json()['code'] == 'UNSUPPORTED_VERSION'

  def test_bundle_rejects_missing_required_field():
      request = load_fixture('bundle_request.json')
      del request['profile']['room_type']
      response = client.post('/v1/bundles', json=request)
      assert response.status_code == 400
  ```

**Exit Criteria:**
- All endpoints defined with fixture responses
- Version checking works (reject major mismatch)
- Invalid input rejected with structured errors (not 500)

### A2: Use Cases (Service-Specific)

**Recommendation Service:**

**Domain Layer:**
```python
# domain/product.py
@dataclass(frozen=True)
class ProductId:
    value: str

@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str

    def __add__(self, other: Money) -> Money:
        if self.currency != other.currency:
            raise ValueError(f"Currency mismatch: {self.currency} vs {other.currency}")
        return Money(self.amount + other.amount, self.currency)

@dataclass
class Product:
    id: ProductId
    supplier_sku: str
    category: str
    name: str
    dimensions_mm: Dimensions
    retail_price: Money
    attributes: dict

    def is_eligible_for_shoppable(self) -> tuple[bool, list[str]]:
        reasons = []
        if not self.dimensions_mm.is_valid():
            reasons.append("Missing dimensions")
        # ... more checks
        return (len(reasons) == 0, reasons)
```

**Application Layer:**
```python
# application/rank_products.py
class RankProducts:
    def __init__(
        self,
        catalogue_repo: CatalogueRepository,
        feature_encoder: FeatureEncoder,
        rules: RulesProvider
    ):
        self.catalogue = catalogue_repo
        self.encoder = feature_encoder
        self.rules = rules

    def execute(self, profile: DesignProfile, snapshot_id: str) -> list[ScoredProduct]:
        # 1. Pin catalogue snapshot
        products = self.catalogue.get_snapshot(snapshot_id)

        # 2. Apply hard filters
        eligible = [p for p in products if self._is_eligible(p, profile)]

        # 3. Compute embeddings (cached by content hash)
        profile_vec = self.encoder.encode_profile(profile)
        product_vecs = [self.encoder.encode_product(p) for p in eligible]

        # 4. Score and rank
        scores = [self._score(profile_vec, prod_vec, profile, prod)
                  for prod_vec, prod in zip(product_vecs, eligible)]

        # 5. Deterministic tie-breaking
        ranked = sorted(zip(eligible, scores),
                       key=lambda x: (x[1], x[0].id.value),
                       reverse=True)

        return [ScoredProduct(p, s) for p, s in ranked]
```

**Ports:**
```python
# ports/catalogue_repository.py
class CatalogueRepository(Protocol):
    def import_snapshot(self, products: list[Product]) -> str:
        """Returns immutable snapshot_id"""
        ...

    def get_snapshot(self, snapshot_id: str) -> list[Product]:
        ...

# ports/feature_encoder.py
class FeatureEncoder(Protocol):
    def encode_profile(self, profile: DesignProfile) -> np.ndarray:
        ...

    def encode_product(self, product: Product) -> np.ndarray:
        ...
```

**Adapters (Fake First, Real After Notebooks):**
```python
# adapters/fake_encoder.py
class FakeEncoder:
    """Rule-only baseline for A2/A3 testing before R02 proves embeddings"""
    def encode_profile(self, profile: DesignProfile) -> np.ndarray:
        # Return zero vector - forces rule-only ranking
        return np.zeros(384)

    def encode_product(self, product: Product) -> np.ndarray:
        return np.zeros(384)

# adapters/sentence_transformer_encoder.py (only after R02)
class SentenceTransformerEncoder:
    """Real embeddings - requires notebook R02 approval"""
    def __init__(self, model_name: str, cache_dir: Path):
        self.model = SentenceTransformer(model_name, cache_folder=cache_dir)

    def encode_profile(self, profile: DesignProfile) -> np.ndarray:
        text = self._profile_to_text(profile)
        return self.model.encode(text, normalize_embeddings=True)
```

**Tests:**
```python
# tests/unit/test_money.py
def test_money_addition_same_currency():
    a = Money(Decimal('10.50'), 'CAD')
    b = Money(Decimal('5.25'), 'CAD')
    assert a + b == Money(Decimal('15.75'), 'CAD')

def test_money_addition_different_currency_raises():
    a = Money(Decimal('10.50'), 'CAD')
    b = Money(Decimal('5.25'), 'USD')
    with pytest.raises(ValueError, match="Currency mismatch"):
        a + b

# tests/unit/test_rank_products.py
def test_rank_products_deterministic_tie_breaking():
    # Two products with identical scores must sort by ID
    p1 = make_product(id='product-001', name='Chair A')
    p2 = make_product(id='product-002', name='Chair B')
    # ... configure fake encoder to return same score
    ranked = use_case.execute(profile, snapshot_id)
    assert ranked[0].product.id.value == 'product-001'
    assert ranked[1].product.id.value == 'product-002'
```

**Exit Criteria:**
- Unit tests cover all mandatory cases (budget boundary, currency mismatch, dimension conversion, tie-breaking, etc.)
- Domain logic has zero framework dependencies (can import without Flask/FastAPI)
- Integration tests prove import→snapshot→rank flow
- Any model-backed path not yet approved has a written limitation

### A3: APIs & Workers

**Recommendation API (No Worker):**
```python
# api/main.py
from fastapi import FastAPI, HTTPException, status
from .dtos import BundleRequest, BundleResponse, ErrorResponse

app = FastAPI(title="Curalina Recommendation Service", version="1.0")

@app.post("/v1/bundles", response_model=BundleResponse, status_code=200)
def create_bundle(request: BundleRequest):
    # Version check
    if not is_compatible_version(request.profile.schema_version):
        raise HTTPException(
            status_code=422,
            detail=ErrorResponse(
                code='UNSUPPORTED_VERSION',
                message=f"Schema version {request.profile.schema_version} not supported",
                retryable=False
            ).dict()
        )

    # Execute use case
    try:
        bundle = compose_room_use_case.execute(request.profile, request.catalogue_snapshot_id)
        return BundleResponse.from_domain(bundle)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.to_error_response())
    except InfeasibleBundleError as e:
        # This is NOT an error - legitimate no-solution
        return BundleResponse(
            bundle_id=e.bundle_id,
            feasible=False,
            violations=e.reasons,
            # ... rest of fields
        )
```

**Room Generator Worker:**
```python
# workers/render_worker.py
import time
from datetime import datetime, timedelta

def run_worker(settings: Settings):
    while True:
        # 1. Claim job with lease
        job = claim_next_job(
            lease_duration=timedelta(minutes=10),
            fencing_token=generate_token()
        )

        if job is None:
            time.sleep(5)
            continue

        try:
            # 2. Update status
            update_job_status(job.id, 'running', job.fencing_token)

            # 3. Execute
            result = process_render_job(job, settings)

            # 4. Commit only if token still valid
            commit_result(job.id, result, job.fencing_token)

        except TimeoutError:
            mark_job_failed(job.id, 'timeout', job.fencing_token)
        except ModelError as e:
            mark_job_failed(job.id, str(e), job.fencing_token)
        except Exception as e:
            logger.exception("Unexpected error")
            mark_job_failed(job.id, 'internal_error', job.fencing_token)

def claim_next_job(lease_duration, fencing_token):
    with db.transaction():
        job = db.query("""
            SELECT * FROM jobs
            WHERE status = 'queued'
              OR (status = 'running' AND lease_expires_at < ?)
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE
        """, [datetime.utcnow()])

        if job:
            db.execute("""
                UPDATE jobs
                SET status = 'running',
                    lease_expires_at = ?,
                    fencing_token = ?
                WHERE id = ?
            """, [datetime.utcnow() + lease_duration, fencing_token, job.id])

        return job
```

**Tests:**
```python
# tests/integration/test_job_lifecycle.py
def test_job_success_flow():
    # Submit job
    response = client.post('/v1/render-jobs', json=make_render_request())
    assert response.status_code == 202
    job_id = response.json()['job_id']

    # Poll until complete
    for _ in range(60):
        status_response = client.get(f'/v1/jobs/{job_id}')
        job = status_response.json()
        if job['status'] in ['succeeded', 'failed']:
            break
        time.sleep(1)

    assert job['status'] == 'succeeded'
    assert 'candidate_id' in job['result']

def test_job_cancellation():
    job_id = submit_job()
    cancel_response = client.post(f'/v1/jobs/{job_id}/cancel')
    assert cancel_response.status_code == 200

    # Wait for worker to acknowledge
    time.sleep(2)
    status = client.get(f'/v1/jobs/{job_id}').json()
    assert status['status'] == 'cancelled'

def test_expired_job_recovered_after_restart():
    # Simulate worker crash
    job_id = submit_job()
    wait_for_status(job_id, 'running')
    kill_worker()

    # Wait for lease expiration
    time.sleep(11)  # lease_duration + 1

    # Restart worker
    start_worker()

    # Job should be reclaimed
    wait_for_status(job_id, 'succeeded', timeout=30)
```

**Exit Criteria:**
- Integration tests cover full lifecycle (submit → poll → complete)
- Worker can recover expired jobs after restart
- Cancellation works cooperatively
- Idempotency prevents duplicate job creation
- Contract tests still pass

### A4: Suite Integration

**Suite Runner:**
```bash
# ai_services/Makefile
.PHONY: setup-all test-all run-suite

setup-all:
    cd recommendation && $(MAKE) setup
    cd variant_generator && $(MAKE) setup
    cd room_generator && $(MAKE) setup

test-all:
    cd recommendation && $(MAKE) test
    cd variant_generator && $(MAKE) test
    cd room_generator && $(MAKE) test

test-contracts:
    cd recommendation && $(MAKE) test-contract
    cd variant_generator && $(MAKE) test-contract
    cd room_generator && $(MAKE) test-contract

run-suite:
    ./scripts/run_local_suite.sh
```

**Suite Script:**
```bash
#!/bin/bash
# scripts/run_local_suite.sh

set -e

# Check ports available
for port in 8101 8102 8103; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        echo "Error: Port $port already in use"
        exit 1
    fi
done

# Start services in background
cd recommendation && make run-api &
RECOMMENDATION_PID=$!

cd ../variant_generator && make run-api &
VARIANT_API_PID=$!
make run-worker &
VARIANT_WORKER_PID=$!

cd ../room_generator && make run-api &
ROOM_API_PID=$!
make run-worker &
ROOM_WORKER_PID=$!

# Cleanup on exit
trap "kill $RECOMMENDATION_PID $VARIANT_API_PID $VARIANT_WORKER_PID $ROOM_API_PID $ROOM_WORKER_PID" EXIT

# Wait for health
for port in 8101 8102 8103; do
    timeout 30 bash -c "until curl -f http://localhost:$port/health; do sleep 1; done"
done

# Run fixture flow
python scripts/suite_fixture_flow.py
```

**Fixture Flow:**
```python
# scripts/suite_fixture_flow.py
import requests
import time

def main():
    # 1. Import catalogue
    with open('contracts/v1/catalogue_snapshot.json') as f:
        catalogue = json.load(f)

    response = requests.post('http://localhost:8101/v1/catalogue/imports', json=catalogue)
    assert response.status_code == 200
    snapshot_id = response.json()['snapshot_id']

    # 2. Compose bundle
    with open('contracts/v1/bundle_request.json') as f:
        bundle_request = json.load(f)
    bundle_request['catalogue_snapshot_id'] = snapshot_id

    response = requests.post('http://localhost:8101/v1/bundles', json=bundle_request)
    assert response.status_code == 200
    bundle = response.json()
    assert bundle['feasible'] == True

    # 3. Upload assets to variant service
    for product in bundle['line_items']:
        # Upload product image
        response = requests.post(
            'http://localhost:8102/v1/assets',
            files={'file': open(f'fixtures/images/{product["product_id"]}.jpg', 'rb')}
        )
        assert response.status_code == 201

    # 4. Submit render job
    with open('contracts/v1/render_request.json') as f:
        render_request = json.load(f)
    render_request['bundle_id'] = bundle['bundle_id']

    response = requests.post('http://localhost:8103/v1/render-jobs', json=render_request)
    assert response.status_code == 202
    job_id = response.json()['job_id']

    # 5. Poll until complete
    for _ in range(120):
        response = requests.get(f'http://localhost:8103/v1/jobs/{job_id}')
        job = response.json()
        print(f"Job status: {job['status']}")
        if job['status'] in ['succeeded', 'failed', 'cancelled']:
            break
        time.sleep(2)

    assert job['status'] == 'succeeded'
    print(f"✅ Suite fixture flow passed!")

if __name__ == '__main__':
    main()
```

**Exit Criteria:**
- All three services start cleanly under `make run-suite`
- Health checks pass
- Fixture flow completes end-to-end
- No shared filesystem paths or database access
- Content hashes match across export/import

### A5: UI Adapter

**TypeScript Adapter Module:**
```typescript
// server/adapters/ai-services/index.ts
import { quizResponses, products, renders } from '@db/schema';

export class AiServiceAdapter {
  private recommendationUrl: string;
  private variantsUrl: string;
  private roomsUrl: string;
  private contractVersion: string;

  constructor(config: AiServiceConfig) {
    this.recommendationUrl = config.recommendationUrl;
    this.variantsUrl = config.variantsUrl;
    this.roomsUrl = config.roomsUrl;
    this.contractVersion = config.contractVersion;
  }

  async generateRender(quizResponseId: number): Promise<RenderResult> {
    // 1. Map quiz to DesignProfile
    const quiz = await db.query.quizResponses.findFirst({
      where: eq(quizResponses.id, quizResponseId)
    });

    const profile = this.mapQuizToProfile(quiz);

    // 2. Export catalogue to recommendation service
    const snapshotId = await this.exportCatalogue();

    // 3. Request bundle
    const bundle = await this.requestBundle(profile, snapshotId);

    if (!bundle.feasible) {
      throw new InfeasibleBundleError(bundle.violations);
    }

    // 4. Upload product images to variant service
    const assetIds = await this.uploadProductImages(bundle.line_items);

    // 5. Upload room photo if provided
    let roomAssetId: string | null = null;
    if (quiz.roomPhoto) {
      roomAssetId = await this.uploadRoomPhoto(quiz.roomPhoto);
    }

    // 6. Submit render job
    const jobId = await this.submitRenderJob({
      bundle_id: bundle.bundle_id,
      bundle_revision: bundle.revision,
      room_asset_id: roomAssetId,
      product_asset_ids: assetIds
    });

    // 7. Store tracking info
    await db.insert(renders).values({
      quizResponseId,
      aiServiceJobId: jobId,
      bundleId: bundle.bundle_id,
      bundleRevision: bundle.revision,
      schemaVersion: this.contractVersion,
      status: 'queued'
    });

    return { jobId, bundleId: bundle.bundle_id };
  }

  private mapQuizToProfile(quiz: QuizResponse): DesignProfile {
    // Validate all required fields exist
    if (!quiz.roomType) {
      throw new ValidationError('room_type is required');
    }

    return {
      schema_version: this.contractVersion,
      room_type: quiz.roomType,
      styles: quiz.styles || [],
      atmosphere: this.mapColorPaletteToAtmosphere(quiz.colorPalettes),
      lifestyle_requirements: {
        storage: quiz.keyFeatures?.includes('storage_solutions'),
        workspace: quiz.keyFeatures?.includes('workspace'),
        pet_friendly: quiz.keyFeatures?.includes('pet_friendly')
      },
      furniture_budget: {
        amount: this.parseBudgetAmount(quiz.budgetRange),
        currency: 'CAD',
        inclusions: ['furniture', 'lighting', 'textiles']
      },
      // ... map other fields
    };
  }
}
```

**Adapter Tests:**
```typescript
// server/adapters/ai-services/adapter.test.ts
import { AiServiceAdapter } from './index';
import { mockFetch } from '@test/helpers';

describe('AiServiceAdapter', () => {
  it('maps quiz response to DesignProfile contract', () => {
    const quiz = makeQuizResponse({
      roomType: 'living_room',
      styles: ['organic_modern'],
      colorPalettes: ['warm_neutrals'],
      keyFeatures: ['storage_solutions', 'workspace'],
      budgetRange: '3000-5000'
    });

    const adapter = new AiServiceAdapter(testConfig);
    const profile = adapter['mapQuizToProfile'](quiz);

    expect(profile.schema_version).toBe('1.0');
    expect(profile.room_type).toBe('living_room');
    expect(profile.styles).toEqual(['organic_modern']);
    expect(profile.lifestyle_requirements.storage).toBe(true);
    expect(profile.furniture_budget.amount).toBe('4000.00'); // midpoint
  });

  it('throws ValidationError if required field missing', () => {
    const quiz = makeQuizResponse({ roomType: null });
    const adapter = new AiServiceAdapter(testConfig);

    expect(() => adapter['mapQuizToProfile'](quiz))
      .toThrow('room_type is required');
  });

  it('generates render via AI services', async () => {
    mockFetch('http://localhost:8101/v1/catalogue/imports', {
      status: 200,
      json: { snapshot_id: 'snapshot-001' }
    });

    mockFetch('http://localhost:8101/v1/bundles', {
      status: 200,
      json: loadFixture('bundle_response_success.json')
    });

    mockFetch('http://localhost:8103/v1/render-jobs', {
      status: 202,
      json: { job_id: 'job-001' }
    });

    const adapter = new AiServiceAdapter(testConfig);
    const result = await adapter.generateRender(123);

    expect(result.jobId).toBe('job-001');
  });
});
```

**Exit Criteria:**
- Adapter fixture tests pass against all three services
- Quiz → DesignProfile mapping handles all field types
- Missing required fields return structured errors (not invented data)
- Legacy render path still callable when flag OFF

### A6: Evaluation Handoff

**Objective:** Decide if model-backed paths are accepted.

**Deliverables:**

**Experiment Report (Per Service):**
```markdown
# Recommendation Service Evaluation Report

**Date:** 2026-09-15
**Notebook:** R02_ranking_baseline.ipynb
**Evaluator:** [Designer Name]
**Status:** ✅ APPROVED

## Evaluation Setup
- **Briefs:** 12 design profiles (3 styles × 3 atmospheres + 2 edge cases)
- **Methods:** Rule-only baseline vs. MiniLM sentence-transformers
- **Held-out:** Briefs 9-12 (not used during dev)
- **Catalogue:** Celadon artwork snapshot-001 (62 products)
- **Relevance Labels:** 0=unsuitable, 1=acceptable, 2=strong

## Results

| Brief | Method | P@5 | NDCG@5 | Coverage | Runtime |
|-------|--------|-----|--------|----------|---------|
| 1     | Rule   | 0.6 | 0.71   | 5/5      | 12ms    |
| 1     | MiniLM | 0.8 | 0.89   | 5/5      | 45ms    |
| ...   | ...    | ... | ...    | ...      | ...     |
| **Avg** | Rule | 0.54 | 0.63 | 92%    | 10ms    |
| **Avg** | MiniLM | 0.71 | 0.81 | 96%  | 38ms    |

## Analysis
- MiniLM shows **31% improvement in P@5** over rule-only baseline
- Semantic matching handles synonym variations better ("mid-century" vs "midcentury")
- Edge cases (restrictive budget) still fall back to rules correctly
- No hard-constraint violations in any test
- Runtime acceptable for synchronous API (<50ms)

## Decision
✅ **APPROVE** MiniLM as accepted ranking method.
- Benefits outweigh complexity cost
- Fallback to rules when embeddings unavailable (proven in tests)
- Ready for A6 promotion

## Limitations
- Artwork-only evaluation (furniture pending)
- Small catalogue (62 products)
- 3-style coverage only (6 styles in production)

## Next Steps
- Expand evaluation to furniture catalogue when available
- Test on production-scale catalogue (1000+ products)
```

**Architecture Decision Record (ADR):**
```markdown
# ADR-003: Use Sentence-Transformers for Product Ranking

**Status:** Accepted
**Date:** 2026-09-15
**Deciders:** [Team]

## Context
Rule-only ranking uses explicit style matching and attribute filters. It's deterministic but misses semantic similarity (e.g., "modern" vs "contemporary").

## Decision
Use `sentence-transformers/all-MiniLM-L6-v2` for semantic product ranking, with rule-only fallback when embeddings unavailable.

## Rationale
- Notebook R02 shows 31% improvement in P@5 (0.54 → 0.71)
- Model is small (80MB), fast (38ms), CPU-compatible
- Embeddings cached by content hash (avoids recomputation)
- Graceful degradation to rules if model missing

## Consequences
**Positive:**
- Better semantic matching
- Handles synonyms and paraphrases
- Improves user satisfaction (projected)

**Negative:**
- 80MB model weight to ship
- 3-4x slower than rules (10ms → 38ms, still acceptable)
- Requires cache invalidation logic

**Mitigation:**
- Pin model revision in requirements.lock
- Lazy-load model (not at startup)
- Monitor cache hit rate in production
```

**Exit Criteria:**
- Stage gate G2 signed (held-out evaluation complete)
- Experiment report documents:
  - P@5, NDCG@5 on held-out briefs
  - Hard-constraint violation count (must be zero)
  - Runtime, coverage, failure cases
- ADR records decision (approved/revised/rejected)
- If rejected: service remains at fake-adapter or limited scope
- If approved: model-backed path ships to production

---

## Notebook Evidence Gates

### Gate System Overview

**Two Independent Systems:**

1. **Notebook Gates (R/V/G series):** Prove capability works
2. **Agent Phases (A0-A6):** Build service infrastructure

**They interact like this:**
- A0-A1 and fake adapters in A2 **don't need notebooks** (can start immediately)
- Real model logic in A2 **requires notebook approval**
- A6 (claiming quality) **requires stage gate G2**

### Recommendation Notebooks

**R01: Catalogue Audit**
- **Objective:** Validate source data quality
- **Deliverables:**
  - Import report (62 products, missingness analysis, category coverage)
  - Reviewed canonical sample (10 products with full metadata)
  - Image availability check (currently all #VALUE!)
- **Blockers:** Missing product images prevents visual features
- **Decision:** Document as limitation, proceed with text-only ranking
- **Gates:** Enables A2 import logic (not blocked on images)

**R02: Ranking Baseline**
- **Objective:** Compare rule-only vs semantic ranking
- **Deliverables:**
  - 12 fixed design briefs (3 styles × 3 atmospheres + edge cases)
  - Designer relevance labels (0/1/2) for pooled results
  - P@5 and NDCG@5 per method
  - Error analysis and tie-breaking validation
- **Methods:**
  - Baseline: Rule-only (style tags + category + budget)
  - Candidate: MiniLM sentence-transformers
- **Acceptance:** Semantic method must outperform baseline on held-out briefs
- **Gates:** Enables A2 embedding adapter (if approved)

**R03: Room Composition**
- **Objective:** Validate bundle constraints
- **Deliverables:**
  - Feasible bundle examples (all constraints met)
  - Infeasible examples with explicit no-solution reasons
  - Substitution validation (swap preserves feasibility)
  - Dimension/clearance rule checks
- **Data:** May use synthetic fixtures if real furniture unavailable
- **Limitation:** Synthetic data proves logic only, not recommendation quality
- **Gates:** Enables A2 bundle composition logic

### Variant Generator Notebooks

**V01: Asset Import**
- **Objective:** Validate product image quality
- **Deliverables:**
  - Image format validation (JPEG/PNG/WebP)
  - Dimension extraction (width/height)
  - Color space analysis (RGB/sRGB)
  - Mask compatibility check
- **Gates:** Enables A2 asset ingestion logic

**V02: Color Transfer**
- **Objective:** Prove color variant generation works
- **Deliverables:**
  - 10 products with target color swaps
  - Visual quality assessment (designer review)
  - Perceptual similarity score
  - Edge case handling (white → black, etc.)
- **Methods:** Test multiple (e.g., color transfer neural nets, classical approaches)
- **Acceptance:** 80% of variants rated acceptable by designer
- **Gates:** Enables A2 color transfer adapter (if approved)

**V03: Mask Quality**
- **Objective:** Validate segmentation masks
- **Deliverables:**
  - Mask accuracy on 10 products (IoU score)
  - Edge feathering quality
  - Failure case analysis
- **Gates:** Enables A2 mask generation logic

### Room Generator Notebooks

**G01: Render Plan**
- **Objective:** Validate render planning logic
- **Deliverables:**
  - Scene composition rules (product placement, camera angle)
  - Lighting analysis (warm/cool/natural)
  - Spatial layout validation
- **Gates:** Enables A2 render planning logic

**G02: Scene Composition**
- **Objective:** Prove photorealistic rendering works
- **Deliverables:**
  - 12 renders (matching R02 briefs)
  - Visual quality assessment (designer review)
  - Product recognition check (can identify products in render?)
  - Failure case analysis
- **Methods:** Test Gemini vs Stability AI vs hybrid
- **Acceptance:** 80% of renders rated acceptable
- **Gates:** Enables A2 rendering adapter (if approved)

**G03: Visual Quality**
- **Objective:** Held-out quality evaluation
- **Deliverables:**
  - Held-out renders (briefs not used in dev)
  - Quality metrics (sharpness, color accuracy, spatial coherence)
  - User testing results (if available)
- **Gates:** Required for A6 stage gate G2

### Stage Gates (From 09_delivery_gates.md)

**G0: Planning Gate**
- Experiment manifest complete
- Data sources identified
- Hardware confirmed available (or limitation documented)

**G1: Feasibility Gate**
- Proof-of-concept works on ≥1 example
- Limitations documented
- Go/no-go decision recorded

**G2: Held-Out Decision**
- Evaluation on held-out data (not used during dev)
- Acceptance thresholds met (or decision to lower scope)
- ADR recorded

**G3: Repeatability Gate**
- Fresh checkout can reproduce results
- Dependencies locked
- Instructions tested by second person

**G4: Promotion Gate**
- Package functions produce notebook results
- Service tests pass
- Ready for HTTP exposure

**G5: Acceptance Gate**
- All hard constraints validated
- Performance acceptable
- Promotion to production approved

---

## Technical Decisions

### Why Python for AI Services?

**Rationale:**
1. **Model Ecosystem:** PyTorch, TensorFlow, sentence-transformers, Stable Diffusion all Python-first
2. **Notebook → Production:** Direct path from Jupyter experiments to service code
3. **Scientific Libraries:** NumPy, Pandas, scikit-learn for data processing
4. **Typing Support:** Python 3.11+ with type hints comparable to TypeScript
5. **Team Expertise:** AI/ML engineers familiar with Python

**Trade-offs:**
- ❌ TypeScript team needs to learn Python (mitigated by clean architecture)
- ❌ Separate deployment pipeline (mitigated by Docker standardization)
- ✅ Better AI library support
- ✅ Easier model integration

### Why Separate Services?

**Rationale:**
1. **Independent Scaling:** Recommendation is CPU-light, room generation is GPU-heavy
2. **Technology Choices:** Recommendation may use classical ML, rendering needs deep learning
3. **Failure Isolation:** Variant service crash doesn't affect recommendation
4. **Team Ownership:** Different teams can own different services
5. **Deployment Flexibility:** Can deploy recommendation to cheap CPU instances, rendering to GPU instances

**Trade-offs:**
- ❌ More deployment complexity (mitigated by Kubernetes/Cloud Run)
- ❌ Network latency between services (mitigated by async jobs)
- ✅ Clear boundaries prevent coupling
- ✅ Easier testing (each service independently testable)

### Why HTTP Contracts (Not gRPC)?

**Rationale:**
1. **Debuggability:** Can test with curl/Postman
2. **Browser Compatible:** UI can call directly (CORS permitting)
3. **Documentation:** OpenAPI/Swagger auto-generation
4. **Simplicity:** JSON is human-readable
5. **Flexibility:** Easier to version and evolve

**Trade-offs:**
- ❌ Larger payload size than gRPC (mitigated by compression)
- ❌ Slower than binary protocols (acceptable for async jobs)
- ✅ Simpler to debug
- ✅ No protobuf compilation step

### Why SQLite for Local Development?

**Rationale:**
1. **Zero Configuration:** No database server to install
2. **File-Based:** Easy to reset (just delete .db file)
3. **ACID Transactions:** Full SQL support for job queues
4. **Portable:** Can copy .db file for debugging
5. **Sufficient Performance:** Single-worker-per-service doesn't need distributed queue

**Trade-offs:**
- ❌ Not suitable for multi-process workers (mitigated by single-worker constraint)
- ❌ Will need migration to PostgreSQL/Redis for production (planned via JobQueue port)
- ✅ Simplest possible local setup
- ✅ No infrastructure dependencies

### Why Notebook Evidence Gates?

**Rationale:**
1. **Prevents Shipping Unvalidated AI:** No "looks good to me" AI code reviews
2. **Reproducibility:** Notebook forces documented methodology
3. **Designer Involvement:** Non-engineers can review notebook outputs
4. **Risk Management:** Expensive mistakes caught before production
5. **Audit Trail:** Notebooks + ADRs document why decisions were made

**Trade-offs:**
- ❌ Slower iteration (can't ship model immediately)
- ❌ Requires discipline (agents must respect gates)
- ✅ Higher quality AI
- ✅ Explainable decisions

---

## Quick Reference

### Port Assignments

| Service | API Port | Purpose |
|---------|----------|---------|
| Recommendation | 8101 | Product selection, bundle composition |
| Variant Generator | 8102 | Color/material variants |
| Room Generator | 8103 | Photorealistic rendering |
| Current TypeScript App | 8080 | Existing UI (legacy + adapter) |

### Environment Variables

**Recommendation Service:**
```bash
CURALINA_ENV=local                                    # local/staging/production
CURALINA_DATA_DIR=/path/to/ai_services/recommendation/data
CURALINA_DATABASE_URL=sqlite:///catalogue.db
CURALINA_MODEL_CACHE=/path/to/model_cache             # For sentence-transformers
```

**Variant/Room Services:**
```bash
CURALINA_ENV=local
CURALINA_DATA_DIR=/path/to/ai_services/variant_generator/data
CURALINA_DATABASE_URL=sqlite:///variants.db
CURALINA_MODEL_CACHE=/path/to/model_cache
CURALINA_DEVICE=cuda                                  # cuda/cpu/mps
CURALINA_MAX_IMAGE_PIXELS=25000000                    # PIL decompression bomb limit
CURALINA_JOB_TIMEOUT_SECONDS=300                      # 5 minutes
```

**TypeScript App (AI Services Integration):**
```bash
CURALINA_AI_SERVICES_ENABLED=false                    # Feature flag
CURALINA_RECOMMENDATION_URL=http://127.0.0.1:8101
CURALINA_VARIANTS_URL=http://127.0.0.1:8102
CURALINA_ROOMS_URL=http://127.0.0.1:8103
CURALINA_AI_CONTRACT_VERSION=1.0
```

### Make Targets (Every Service)

```bash
make setup              # Create venv, install dependencies
make test               # Run fast unit + contract tests (no GPU/Internet)
make test-contract      # Run contract tests only
make test-integration   # Run integration tests (SQLite, filesystem)
make run-api            # Start API on assigned port (loopback only)
```

**Additional for Image Services:**
```bash
make run-worker         # Start GPU inference worker
make test-worker        # Test worker lifecycle
```

**Suite Level (ai_services/):**
```bash
make setup-all          # Setup all services
make test-all           # Run all service tests
make test-contracts     # Run all contract tests
make run-suite          # Start all services + fixture flow
```

### Directory Convention

**Every Service:**
```
{service}/
├── pyproject.toml              # Python 3.11, dependencies
├── requirements.lock           # Exact versions (reproducibility)
├── README.md                   # Local setup, tested commands
├── Makefile                    # Standard targets
├── notebooks/                  # Jupyter notebooks (R/V/G series)
├── src/curalina_{service}/     # Package root
│   ├── domain/                 # Pure business logic (no frameworks)
│   ├── application/            # Use cases
│   ├── ports/                  # Interfaces (protocols)
│   ├── adapters/               # Implementations (SQLite, sklearn, S3)
│   ├── api/                    # HTTP layer (FastAPI)
│   ├── workers/                # GPU inference loops (image services only)
│   └── bootstrap.py            # App factory
├── tests/
│   ├── unit/                   # Fast, no external dependencies
│   ├── integration/            # SQLite, filesystem
│   └── contract/               # Fixture validation
├── evaluation/                 # Held-out test results
├── data/                       # Gitignored
│   ├── raw/                    # Celadon workbook, original assets
│   ├── curated/                # Processed data
│   └── runs/                   # Experiment outputs
└── .gitignore                  # Ignore .venv, data, model_cache, *.db
```

### Contract Version Checking

```python
# Every service checks incoming schema_version
SUPPORTED_MAJOR_VERSION = 1

def validate_version(request_version: str):
    major, minor = map(int, request_version.split('.'))
    if major != SUPPORTED_MAJOR_VERSION:
        raise UnsupportedVersionError(
            f"Schema version {request_version} not supported. "
            f"This service supports {SUPPORTED_MAJOR_VERSION}.x"
        )
    # Minor version differences are compatible (additive only)
```

### Testing Hierarchy

```
1. Domain Unit Tests
   - Pure logic, no I/O
   - Example: Money addition, dimension conversion
   - Run every commit

2. Application Unit Tests
   - Use cases with fake adapters
   - Example: RankProducts with FakeEncoder
   - Run every commit

3. Contract Tests
   - Validate fixture format
   - Example: Bundle response has required fields
   - Run every commit

4. Integration Tests
   - Real adapters (SQLite, filesystem)
   - Example: Import → snapshot → rank flow
   - Run before push

5. Worker Tests
   - Job lifecycle (claim, execute, commit)
   - Example: Expired job recovery
   - Run before push

6. Suite Tests
   - Cross-service flows
   - Example: Catalogue → bundle → render
   - Run before release

7. Evaluation Tests
   - Held-out data, acceptance thresholds
   - Example: P@5 on briefs 9-12
   - Run before promotion
```

---

## Work Assignment Guide

### Using the Agent Work Packet Template

**Location:** `/architecture/templates/agent_work_packet.md`

**Example Packet:**

```markdown
# Agent Work Packet: Recommendation Service A2 - Domain Layer

**Service:** recommendation
**Phase:** A2
**Assigned To:** [Agent Name]
**Date:** 2026-09-16

## Inputs
- `architecture/guides/04_recommendation.md` (domain requirements)
- `architecture/guides/03_data_contracts.md` (Product schema)
- `architecture/guides/08_engineering_and_tests.md` (test requirements)
- `architecture/templates/design_profile.json` (DesignProfile contract)

## Allowed Files
- `ai_services/recommendation/src/curalina_recommendation/domain/**`
- `ai_services/recommendation/tests/unit/**`

## Deliverables
1. Typed domain records:
   - `ProductId` (value object)
   - `Money` (value object with currency checking)
   - `Dimensions` (value object with mm units)
   - `Product` (entity)
   - `DesignProfile` (entity)
   - `Bundle` (entity)
2. Domain services:
   - `EligibilityChecker` (validate shoppable requirements)
   - `BudgetValidator` (check budget constraints)
3. Unit tests covering:
   - Money addition (same currency)
   - Money addition (currency mismatch raises)
   - Dimension conversion (inches → mm)
   - Whitespace SKU normalization
   - Duplicate product ID detection

## Local Commands
```bash
cd ai_services/recommendation
make setup
make test  # Must pass with no failures
```

## Boundaries
- NO pandas DataFrames in domain code
- NO framework dependencies (Flask, FastAPI, SQLAlchemy)
- NO direct file I/O (use ports)
- NO environment variable reads (use injected Settings)

## Done Evidence
- All unit tests pass (`make test`)
- Coverage ≥90% on domain package
- Type checking passes (`mypy src/`)
- No framework imports in `domain/**`
```

### Assignment Rules

**Don't Assign:**
- "Build the AI service" (too vague)
- "Implement recommendation" (spans multiple phases)

**Do Assign:**
- "Recommendation A2 - Domain layer only"
- "Variant generator A3 - API endpoints only"
- "Room generator A1 - Contract fixtures only"

**One Packet = One Service + One Phase + One Measurable Result**

### Dependency Tracking

**Before Assigning:**

1. Check notebook gates:
   - A2 real logic → requires R02 (for recommendation)
   - A6 promotion → requires G2 stage gate

2. Check phase dependencies:
   - A1 → requires A0 (scaffold must exist)
   - A2 → requires A1 (contracts must be stable)
   - A3 → requires A2 (use cases must exist)
   - A4 → requires A3 (APIs must be running)
   - A5 → requires A1 (needs contract fixtures)
   - A6 → requires A3 + notebook gates

3. Check cross-service dependencies:
   - Room generator A4 → requires recommendation A3 (needs bundle endpoint)
   - UI adapter A5 → requires all services A1 (needs all contracts)

**Parallelization Opportunities:**

Can work in parallel:
- ✅ All services A0 (scaffolding is independent)
- ✅ All services A1 (contracts define boundaries)
- ✅ All services A2 fake adapters (notebook work happens separately)
- ✅ All services A3 (each has own database)
- ✅ UI adapter A5 + service A2/A3 (adapter uses contract fixtures)

Must be sequential:
- ❌ Service A3 before A2 (APIs need use cases)
- ❌ Service A6 before notebook gates (no shortcuts on evidence)

---

## Success Criteria

### Phase Completion

**A0 Complete:** All services have:
- ✅ `make setup` works on fresh checkout
- ✅ `make test` runs (even if no tests yet)
- ✅ README documents commands
- ✅ Settings object validated at startup

**A1 Complete:** All services have:
- ✅ Contract fixtures (success + error cases)
- ✅ Typed DTOs (Pydantic recommended)
- ✅ Version checking (reject major mismatch)
- ✅ Contract tests pass

**A2 Complete:** All services have:
- ✅ Domain logic with zero framework dependencies
- ✅ Use cases callable from notebooks
- ✅ Ports defined (interfaces only)
- ✅ Fake adapters for testing
- ✅ Mandatory unit tests pass
- ✅ Limitations documented if notebooks not cleared

**A3 Complete:** All services have:
- ✅ HTTP endpoints responding
- ✅ SQLite persistence working
- ✅ Workers claiming/processing jobs (image services)
- ✅ Integration tests covering lifecycle
- ✅ Contract tests still pass

**A4 Complete:**
- ✅ `make run-suite` starts all services
- ✅ Health checks pass
- ✅ Fixture flow completes end-to-end
- ✅ No shared paths/databases

**A5 Complete:**
- ✅ TypeScript adapter maps quiz → contracts
- ✅ Adapter tests pass against all services
- ✅ Feature flag toggles between legacy/AI paths
- ✅ Missing fields return structured errors

**A6 Complete:**
- ✅ Notebook evidence reviewed
- ✅ Held-out evaluation meets thresholds
- ✅ ADR documents decision
- ✅ Limitations documented
- ✅ Stage gate G2 signed (or no-go recorded)

### Production Readiness

**Before Production Deployment:**
- ✅ All A0-A6 phases complete
- ✅ All notebook gates cleared
- ✅ Stage gate G5 (acceptance) signed
- ✅ Monitoring configured (error rates, latency)
- ✅ Alerting set up (critical errors)
- ✅ Deployment pipeline tested (CI/CD)
- ✅ Rollback plan documented
- ✅ Load testing complete (expected traffic + 2x)
- ✅ Security review complete (auth, input validation)
- ✅ Documentation updated (API docs, runbooks)

---

## Appendix: Current vs Future Side-by-Side

| Aspect | Current (Monolith) | Future (Microservices) |
|--------|-------------------|------------------------|
| **Language** | TypeScript/Node.js | Python 3.11 (AI) + TypeScript (UI) |
| **Architecture** | Express monolith | 3 independent services |
| **Database** | Single PostgreSQL | 3 SQLite (local) → 3 PostgreSQL (prod) |
| **AI Integration** | Direct SDK calls in routes | Service-owned inference |
| **Render Flow** | Placeholder (immediate return) | Job-based async (queued → running → succeeded) |
| **Product Selection** | `gemini-ai.ts` service | Recommendation service |
| **Testing** | Ad-hoc | Notebook evidence gates |
| **Deployment** | Firebase Functions | Docker → Cloud Run |
| **Scaling** | Vertical (bigger instance) | Horizontal (more instances per service) |
| **Failure Isolation** | All or nothing | Service-level |
| **Technology Choice** | Locked to Node.js | Per-service (Python for AI, Node for UI) |
| **Local Setup** | `npm install && npm run dev` | `make run-suite` (3 services + workers) |
| **Contract Versioning** | Implicit (shared codebase) | Explicit (v1 HTTP contracts) |
| **Model Evidence** | None (direct integration) | Notebook R/V/G + stage gates |

---

**End of Project Map**

This document will evolve as implementation progresses. Update sections as decisions are made and architecture evolves.

**Next Steps:**
1. Review this document with team
2. Assign first work packets (A0 scaffolding for all services)
3. Set up notebook infrastructure (Jupyter kernels)
4. Begin R01 catalogue audit notebook
