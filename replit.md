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
- **Product Selection Pipeline (Space → Fit → Preference → Budget)**: A four-step prioritization system:
    1. **Space Analysis**: Extracts room dimensions and identifies placement zones.
    2. **Fit Validation**: Filters products based on physical fit within designated zones using `validateProductFitForZone()` and `filterByPhysicalFit()`.
    3. **Style Matching**: Scores remaining products against user preferences (style, color, texture, line, pattern, visual description quality).
    4. **Smart Budget Enforcement**: Uses intelligent substitution based on a quality tier system and visual impact priority, only removing items if no suitable substitutes are found.
- **Budget Allocation Framework**: Consistent percentage-based budget distribution across room types, emphasizing anchor pieces and context-aware category mapping.
- **Product Fidelity System**: A multi-modal approach combining text and visual inputs for AI generation, including condensed descriptions, real-world scale enforcement, multi-modal generation with product catalog images, and a layout mask system for ControlNet-guided placement.
- **Balanced Post-Render QA with Auto-Regeneration**: Structured JSON validation from Gemini Vision, balanced quality thresholds (Appearance, Scale, Dimensions, Overall, strict ColorMatch), and an auto-regeneration loop (up to 3 attempts) to meet quality standards. Includes zero-tolerance color matching and protection against missing products.
- **Refinement Pipeline**: A three-tier Stability AI QC process with graceful fallbacks.
- **Comprehensive Product Specifications**: All relevant database fields (materials, colors, dimensions, prices, shipping metadata, tags) are deeply serialized and passed to AI prompts.
- **Dimension Validation System**: A three-stage pipeline that uses Gemini AI to parse natural language room descriptions, a spatial fit validator to check products against room envelopes and clearance requirements, and confirmation UI for user acknowledgment. It blocks oversized products pre-render and provides warnings for tight fits.

### Data Storage
PostgreSQL via Neon serverless driver using Drizzle ORM is the primary database, with Google Cloud Storage for user uploads and AWS S3 for product images.

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