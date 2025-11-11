# Curalina AI - Interior Design Platform

## Overview
Curalina AI is a full-stack AI-powered interior design platform that integrates hybrid AI-generated room rendering with an e-commerce marketplace for furniture. Built with React, Express, and PostgreSQL, the platform features:

- **Intelligent Image Analysis**: 
  - **Room & Floor Plan Analysis**: Gemini Vision automatically analyzes uploaded room photos and floor plans to extract detailed spatial information, architectural features, existing furniture, and design elements
  - **Vibe Image Analysis** (NEW): Gemini Vision analyzes user-uploaded inspiration images to extract detailed visual preferences - color palette (5-8 specific colors with hex codes), materials (wood, metal, fabric, etc.), textures (smooth, rough, glossy, etc.), lighting tone (warm/cool/natural/dramatic), and density (minimal/moderate/layered). This creates a rich preference profile for semantic product matching.
  - **Product Visual Analysis** (DUAL AI PROVIDER): 
    - **Gemini 2.5 Flash Vision**: Multi-angle product image analysis generating comprehensive visual descriptions (color, material, style, form, design details)
    - **OpenAI GPT-5 Vision**: Parallel analysis with identical prompts for quality comparison and cross-platform experimentation
    - **Front View Prioritization**: Both analyzers automatically detect and prioritize images with "Front View" in filename (case-insensitive: "front view", "front_view", "frontview") for primary analysis, falling back to multi-image analysis if not found or if analysis fails
    - **Resilient Analysis**: Uses Promise.allSettled to ensure partial failures don't abort batch - if one provider fails, the other's result is still saved
    - **Flexible Active Description**: Gemini prioritized by default with OpenAI fallback, stored separately to enable testing either description with any AI rendering provider
    - **Admin UI**: Side-by-side comparison view showing both analyses with color-coded panels (blue for Gemini, green for OpenAI, amber for legacy single-provider data)
- **AI-Powered Rendering**: 
  - **Text-to-Image Mode** (no room photo): Gemini 2.5 Flash generates creative room designs from scratch based on quiz preferences
  - **Image-to-Image Mode** (room photo uploaded): Gemini 2.5 Flash sees and preserves the actual uploaded space while redesigning furniture and decor - ensures architectural features, dimensions, and layout match the real room
- **Hybrid Image Compositing** (⚠️ CURRENT LIMITATION - v1 MVP): 
  - **Intent**: Two-stage rendering to composite real product images onto AI-generated rooms for exact product matching
  - **Current State**: Basic implementation shows products overlaid on rooms, but with visible backgrounds (product images are JPEGs, not transparent PNGs)
  - **Known Issues**: Simple grid placement without scene analysis, no background removal, products appear as overlaid thumbnails
  - **Next Steps**: Implement background removal API (remove.bg/ClipDrop), scene-aware placement using Gemini Vision depth analysis, perspective-matched scaling
- **Context-Aware Design Generation**: 
  - AI prompts enhanced with analyzed room context (architectural features, dimensions, spatial constraints)
  - Product visual descriptions from Gemini Vision prioritized over text-based product data for more accurate AI generation
  - Ensures base AI-generated rooms better match actual product appearance before compositing
- **Smart Product Selection**:
  - **Strict Image Validation**: Products MUST have valid, working images to be used in AI generation - visual descriptions alone are not sufficient
  - **Focus on Quality**: Budget constraints are NOT enforced during product filtering - prioritizes best matching products for high-quality renders
  - **Front View Display Priority**: Results page automatically reorders product image arrays to display Front View images first in Shop the Look carousel
  - Image Quality Filter: Comprehensive validation checks for broken/invalid images (placeholders, missing URLs, invalid formats)
  - Visibility Filtering: Gemini Vision analyzes generated images to show only products actually visible in the final render
- **Complete E-commerce Journey**: 7-step design quiz, AI-powered product selection, shopping cart, Stripe checkout integration
- **Training Data System**: Admin-managed design examples, product packages, placement guidelines, and design rules to continuously improve AI performance

The platform provides a seamless interior design and shopping experience, from inspiration to purchase, leveraging multimodal AI for highly personalized and contextually appropriate visual experiences.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (November 11, 2025)
- **Visual Analysis Job System**: Implemented a robust job-based queue system for AI-powered visual product analysis
  - Database schema with `visualAnalysisJobs` and `visualAnalysisProducts` tables
  - Unique constraint on (jobId, productId) for data integrity
  - Full storage interface with 13 methods following repository pattern
  - Batch processing (20 products per batch) with 8-second delays to prevent API rate limiting
  - Auto-trigger visual analysis after upload job completion
  - Real-time progress tracking UI with React Query polling (3-second intervals)
  - Dual AI provider support with resilient Promise.allSettled for independent failure handling
  - Front view image detection and prioritization

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript, Vite for bundling and HMR.
- **UI Component Strategy**: shadcn/ui (Radix UI primitives), Tailwind CSS for styling, React Dropzone and Uppy for file uploads.
- **Design System**: Inter font, light green selection highlights, neutral backgrounds, animated transitions (Framer Motion, typewriter effects).
- **State Management**: React Query for server state, Local Storage for anonymous session IDs.
- **Routing**: Wouter for client-side routing across key user flows: landing, quiz, loading, results, cart, checkout, and user dashboard.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript.
- **API Structure**: Dedicated routes for file uploads, product management (including bulk CSV import and AI image matching), quiz submission, AI rendering, cart management, and order processing.
- **Validation & Error Handling**: Zod for schema validation on all mutations, providing detailed error messages.
- **Data Access Layer**: `ICuralinaStorage` interface implemented using Drizzle ORM, ensuring type-safe operations with shared schema types.
- **Authentication System**: Passport.js Local Strategy for email/password, session-based authentication with PostgreSQL-backed store, bcrypt for password hashing, HttpOnly and Secure cookies. Replit OIDC for external authentication (Google, GitHub).
- **Access Control**: Role-based access for Admin, Regular User, and Anonymous states, with distinct navigation and dashboard access.
- **Image Processing Pipeline**: 
  - **Current**: Sharp library for basic image compositing with multi-angle image selection
  - **Limitations**: Products have opaque backgrounds (JPEG format), shadows disabled, simple grid placement
  - **Roadmap**: Background removal integration, scene-aware positioning, perspective-matched scaling, realistic floor-plane shadows
- **Direct Browser-to-S3 Upload Optimization** (NEW): 
  - **Architecture**: 3-step presigned URL flow bypasses server memory bottleneck for dramatically faster uploads
  - **Flow**: (1) Frontend requests presigned URL from backend → (2) Browser uploads directly to S3 → (3) Backend confirms and updates product record
  - **Security**: AWS SDK presigned POST with constraints (10MB max file size, 1hr expiry, content-type validation)
  - **Performance**: Eliminates server RAM buffering, enables parallel uploads, reduces latency by ~70-80% vs traditional relay uploads
  - **Duplicate Detection**: Before generating presigned URL, backend checks S3 using HeadObject to detect existing files by filename - skips redundant uploads, saves storage costs, prevents multi-angle image duplicates (Front View, Side View, etc.)

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless driver using Drizzle ORM for schema management.
- **Curalina AI Schema Design**:
    - `categories`: Product categorization.
    - `suppliers`: Furniture suppliers.
    - `products`: Full product catalog including SKU, pricing, images, 3D assets, and three visual description fields:
      - `visualDescription`: Active description (backward compatibility - automatically set to Gemini with OpenAI fallback)
      - `visualDescriptionGemini`: Gemini 2.5 Flash Vision analysis
      - `visualDescriptionOpenAI`: OpenAI GPT-5 Vision analysis
    - `quizResponses`: User design preferences, including floorplans and vibe images.
    - `renders`: AI-generated room designs with associated products.
    - `cartItems`: Shopping cart items per session.
    - `orders`: Purchase orders with customer and shipping details.
    - `orderItems`: Individual items within orders.
    - **AI Training Data**:
      - `designExamples`: Good and bad design references for AI learning.
      - `productPackages`: Pre-curated product combinations that work well together.
      - `placementGuidelines`: Rules for where products should be placed in rooms.
      - `designRules`: General design principles and rules for AI to follow.
- **Object Storage**: Google Cloud Storage for user uploads (floorplans, vibe images, AI renders), AWS S3 for product images.

## External Dependencies

- **Authentication Services**:
    - Replit OIDC provider (Google, GitHub login)
- **Database**:
    - Neon serverless PostgreSQL
- **Object Storage**:
    - Google Cloud Storage (via Replit sidecar endpoint for credentials)
    - AWS S3 (for product images, bucket "curalina")
- **AI/ML**:
    - Stability AI SDXL (for structure-preserving image-to-image room rendering)
    - Google Gemini 2.5 Flash (for text-to-image creative generation, AI image matching in product import)
    - Google Gemini Vision (for multi-modal image analysis):
      - Room photo and floor plan analysis (spatial information, architectural features, design elements)
      - Product image analysis (comprehensive visual descriptions from all angles for AI prompt enhancement)
    - OpenAI GPT-5 Vision (for dual-provider product visual analysis):
      - Parallel product image analysis with identical prompts as Gemini for quality comparison
      - Enables cross-platform experimentation (using Gemini description with OpenAI rendering and vice versa)
- **Image Processing**:
    - Sharp (high-performance image compositing, resizing, transparency handling, shadow generation)
- **Payment Processing**:
    - Stripe (ready for API key integration)
- **UI Libraries**:
    - Radix UI primitives (via shadcn/ui)
    - Uppy (advanced file upload UI)
    - Lucide React (icons)
- **Styling**:
    - Tailwind CSS