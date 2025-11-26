# Curalina AI - Interior Design Platform

## Overview
Curalina AI is an AI-powered interior design platform that offers hybrid AI-generated room rendering and an e-commerce marketplace for furniture. Its main purpose is to provide a seamless design and shopping experience, from inspiration to purchase, utilizing multimodal AI for personalized visual designs. Key capabilities include intelligent image analysis, AI-powered rendering (text-to-image and image-to-image), structured product placement, hybrid image compositing, and context-aware design generation. The platform also supports smart product selection, data quality transparency for recommendations, a complete e-commerce journey with a design quiz and checkout, and a training data system for continuous AI improvement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript and Vite, leveraging shadcn/ui (Radix UI primitives) and Tailwind CSS for styling. State management is handled by React Query for server state and Local Storage for anonymous session IDs, with Wouter for routing.

### Backend
The backend is built with Express.js and TypeScript, featuring dedicated routes for various functionalities (file uploads, product management, AI rendering, e-commerce). Zod is used for validation and Drizzle ORM with PostgreSQL for data access. Authentication is managed via Passport.js (Local Strategy and Replit OIDC), supporting role-based access control. The system includes an image processing pipeline using Sharp, direct browser-to-S3 uploads with presigned URLs, and a robust render ingestion pipeline with atomic snapshots and idempotency. A persistent background job system handles S3 image renaming.

Core architectural decisions include:
- **Zone-Based Placement System**: Configurable room zones (`ROOM_ZONES`) and functions (`assignItemsToZones()`, `generateZoneBasedPlacementMatrix()`) to guide AI prompts for structured product placement based on functional categories and design rules.
- **Professional Room Composition Templates**: Predefined templates for various room types (Living Room, Bedroom, Dining Room, Home Office) specify essential and complementary furniture with min/max counts and zone height tiers to ensure design consistency.
- **Product Selection Pipeline (Space → Fit → Preference)**: A quality-first prioritization system:
    1. **Space Analysis**: Extracts room dimensions and identifies placement zones. Calculates space tier (Small/Medium/Large/XL) based on detected room size.
    2. **Dynamic Template Adjustment**: Room templates are adjusted based on space tier. Small rooms (<180 sq ft) get 5 products max, medium (180-320 sq ft) get 7, large (320-480 sq ft) get 8 with optional dual seating when width ≥16ft, XL (>480 sq ft) get 8 with dual sofas.
    3. **Fit Validation**: Filters products based on physical fit within designated zones using `validateProductFitForZone()` and `filterByPhysicalFit()`.
    4. **Style Matching**: Scores remaining products against user preferences (style, color, texture, line, pattern, visual description quality).
    5. **Quality-First Mode**: Budget enforcement is disabled to prioritize render quality and visual harmony over cost constraints.
- **Budget Allocation Framework**: Consistent percentage-based budget distribution across room types, emphasizing anchor pieces and context-aware category mapping.
- **Product Fidelity System**: A multi-modal approach combining text and visual inputs for AI generation, including condensed descriptions, real-world scale enforcement, multi-modal generation with product catalog images, and a layout mask system for ControlNet-guided placement.
- **Balanced Post-Render QA with Auto-Regeneration**: Structured JSON validation from Gemini Vision, balanced quality thresholds (Appearance, Scale, Dimensions, Overall, strict ColorMatch), and an auto-regeneration loop (up to 3 attempts) to meet quality standards. Includes zero-tolerance color matching and protection against missing products.
- **Refinement Pipeline**: A three-tier Stability AI QC process with graceful fallbacks.
- **Comprehensive Product Specifications**: All relevant database fields (materials, colors, dimensions, prices, shipping metadata, tags) are deeply serialized and passed to AI prompts.
- **Dimension Validation System**: A three-stage pipeline that uses Gemini AI to parse natural language room descriptions, a spatial fit validator to check products against room envelopes and clearance requirements, and confirmation UI for user acknowledgment. It blocks oversized products pre-render and provides warnings for tight fits.

### Data Storage
PostgreSQL via Neon serverless driver using Drizzle ORM is the primary database, with Google Cloud Storage for user uploads and AWS S3 for product images.

### Object Storage Configuration
The application uses Replit's Object Storage (backed by Google Cloud Storage) for user-uploaded images (room photos, floorplans, inspiration images). Key configuration:
- **Health Check Endpoint**: `GET /api/health/storage` - Returns storage configuration status and connection test results
- **Upload Endpoint**: `POST /api/upload` - Handles file uploads with detailed error logging
- **Public Assets**: Served via `/public-objects/:filePath` route
- **Environment Variables Required**: `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`

**Production Considerations**: The object storage uses Replit's sidecar authentication (`http://127.0.0.1:1106`). If uploads fail in production with permission errors, verify that:
1. The deployment has proper access to the storage bucket
2. Environment variables are correctly set in the production environment
3. Check `/api/health/storage` endpoint for diagnostic information

### Quiz System
- Quiz always starts at step 1 when entering the quiz page (preserves data but resets step)
- Quiz data (preferences, room type, styles) is persisted in localStorage for convenience
- Step restoration was removed to ensure fresh quiz starts for returning users
- **Migration Pattern**: The `migrateQuizData()` function merges loaded localStorage data with `INITIAL_QUIZ_DATA` defaults and ensures all array fields (styles, colorPalettes, textures, keyFeatures, vibeImages) are properly initialized. This prevents "Cannot read properties of undefined" errors when loading old localStorage data that may be missing newer fields.

### Render Session Management
- Render ID and session ID are passed through URL params from Quiz → Loading → Results pages
- This ensures the correct render is displayed even if the localStorage session changes between pages
- The flow is: Quiz creates render → passes `?renderId=X&sessionId=Y` to Loading → Loading passes same params to Results
- Fallback to localStorage session if URL params are not present (backwards compatibility)

### Render Quality System
- **Auto-Regeneration**: When validation score is below 75/100, the system automatically retries up to 2 times, keeping the best result
- **Quality Status**: Renders are marked as 'passed' (score >= threshold) or 'warning' (below threshold) based on Gemini Vision validation
- **Room Dimension Parsing**: Enhanced parser handles various formats (18' x 14', "18 feet long", "approximately 18ft by 14ft") with strict patterns to avoid false positives
- **Zone Placement Consistency**: Product selection runs once; placements are reused after floor plan analysis to prevent mismatch between selected products and zone assignments

## External Dependencies

- **Authentication**: Replit OIDC provider
- **Database**: Neon serverless PostgreSQL
- **Object Storage**: Google Cloud Storage, AWS S3
- **AI/ML**:
    - Stability AI SDXL (structure-preserving image-to-image rendering)
    - Google Gemini 2.5 Flash (text-to-image generation, AI image matching)
    - Google Gemini Vision (multi-modal image analysis)
    - OpenAI gpt-image-1 (final alignment/compositing pass - experimental)
    *(Note: Gemini and OpenAI access via Replit AI Integrations)*
- **Image Processing**: Sharp
- **Payment Processing**: Stripe
- **UI Libraries**: Radix UI primitives (via shadcn/ui), Uppy (file upload UI), Lucide React (icons)
- **Styling**: Tailwind CSS