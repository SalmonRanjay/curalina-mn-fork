# Curalina AI - Interior Design Platform

## Overview
Curalina AI is an AI-powered interior design platform offering hybrid AI-generated room rendering and an e-commerce marketplace for furniture. It aims to provide a seamless design and shopping experience, from inspiration to purchase, using multimodal AI for personalized visual designs. Key capabilities include intelligent image analysis, AI-powered rendering (text-to-image and image-to-image), structured product placement, hybrid image compositing, and context-aware design generation. The platform also features smart product selection, data quality transparency for recommendations, a complete e-commerce journey with a design quiz and checkout, and a training data system for continuous AI improvement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript and Vite.
- **UI Component Strategy**: shadcn/ui (Radix UI primitives), Tailwind CSS for styling, React Dropzone and Uppy for file uploads.
- **Design System**: Inter font, light green selection highlights, neutral backgrounds, animated transitions.
- **State Management**: React Query for server state, Local Storage for anonymous session IDs.
- **Routing**: Wouter for client-side routing.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript.
- **API Structure**: Dedicated routes for file uploads, product management, quiz submission, AI rendering, cart, and order processing.
- **Validation & Error Handling**: Zod for schema validation.
- **Data Access Layer**: `ICuralinaStorage` interface using Drizzle ORM with PostgreSQL.
- **Authentication System**: Passport.js Local Strategy (email/password), session-based with PostgreSQL store, bcrypt for password hashing, HttpOnly/Secure cookies. Replit OIDC for external authentication.
- **Access Control**: Role-based access (Admin, Regular User, Anonymous).
- **Image Processing Pipeline**: Sharp library for basic image compositing, with future plans for advanced features.
- **Direct Browser-to-S3 Upload Optimization**: Uses a presigned URL flow for direct, secure, and faster browser-to-S3 uploads, including duplicate detection.
- **Render Ingestion Pipeline**: Production-ready pipeline with staged lifecycle events, atomic snapshots, performance optimization, SKU coverage validation, metadata enrichment, and idempotency for robust render data processing.
- **S3 Image Renaming Job System**: Persistent background job queue for normalizing S3 image filenames (replacing spaces, +, % with dashes). Features include:
  - **Persistent Job Queue**: Jobs survive app restarts and resume automatically from last checkpoint
  - **Checkpoint Saves**: Progress saved every 10 products to prevent data loss
  - **Priority Queuing**: High-priority jobs processed first, with automatic retry logic (max 3 retries)
  - **Recursive URL Decoding**: Handles all encoding variants (spaces, +, %20, %2B) to find actual S3 objects
  - **Dry Run Mode**: Preview changes without executing renames
  - **Database Tracking**: Full audit trail with per-product status, old/new URLs, and rename counts
  - **Auto-Resume on Startup**: Interrupted jobs automatically continue where they left off
- **Zone-Based Placement System**: Configurable room zones with `ROOM_ZONES` definitions, `assignItemsToZones()` for product-to-zone assignment based on functional categories and design rules, and `generateZoneBasedPlacementMatrix()` to create explicit spatial instructions for AI prompts.
- **Professional Room Composition Templates**: Based on analysis of professional interior design packages (PDF), each room type has templates defining essential and complementary furniture with min/max counts:
  - **Living Room (9 zones)**: 1 sofa (wall), 1 coffee table (centered), 1-2 accent chairs (flanking at 90°), 0-1 side table, 0-1 storage, 0-1 floor/table lamp, 0-1 rug/art
  - **Bedroom (7 zones)**: 1 bed (anchor), 1-2 nightstands (symmetric), 1-2 table lamps (surface), 0-1 dresser, 0-1 storage, 0-1 seating, 0-1 rug/art
  - **Dining Room (6 zones)**: 1 table (centered), 4-8 matching chairs, 1 chandelier (ceiling), 0-1 sideboard, 0-1 rug/art
  - **Home Office (7 zones)**: 1 desk (wall), 1 office chair, 1-2 storage, 1 task lamp (surface), 0-1 guest seating, 0-1 rug/art
  - **Zone Height Tiers**: floor (rugs, furniture), surface (table lamps on surfaces), wall (art, ceiling fixtures)
  - **Template Enforcement**: Selection function respects min/max constraints with priority-based ordering
- **Budget Allocation Framework**: Consistent percentage-based budget distribution across room types with anchor piece emphasis:
  - **Living Room**: Sofa 40% (anchor), Accent Chairs 20%, Tables 15%, Lighting 15%, Rug/Decor 10%
  - **Bedroom**: Bed 40% (anchor), Nightstands 20%, Dresser/Storage 15%, Lighting 15%, Decor/Bedding 10%
  - **Dining Room**: Dining Table 35% (anchor), Dining Chairs 25%, Sideboard/Storage 10%, Lighting 15%, Rug 10%, Decor/Styling 5%
  - **Home Office**: Desk 35% (anchor), Seating 30%, Storage 20%, Lighting 10%, Decor 5%
  - **Category Mapping**: Context-aware product-to-budget mapping ensures products resolve to valid categories per room type
- **Product Fidelity System**: Multi-modal approach combining text and visual inputs for AI generation:
  - **Condensed Descriptions**: 40-50 token generation-ready prompts (vs 300-400 word paragraphs) extracting key visual attributes
  - **Real-World Scale**: Automatic dimension extraction and enforcement, comparative ratios between products, human-scale references
  - **Multi-Modal Generation**: Product catalog images (Front View priority) passed to both Gemini and Stability AI as visual references
  - **Layout Mask System**: Zone-based placements converted to visual masks for ControlNet-guided furniture placement
  - **Balanced Post-Render QA with Auto-Regeneration**: 
    - **Structured JSON Validation**: Gemini Vision generates structured JSON output for reliable parsing (not text regex)
    - **Balanced Quality Thresholds**: Appearance≥82, Scale≥78, Dimensions≥72, Overall≥78, ColorMatch REQUIRED (STRICT)
    - **Auto-Regeneration Loop**: Up to 3 attempts (1 initial + 2 retries) to meet quality standards
    - **Best Attempt Tracking**: Tracks highest QA score across attempts, uses best if all fail thresholds
    - **Quality Status Tracking**: Renders tagged as 'passed' (meets all thresholds), 'warning' (below thresholds), or 'unknown'
    - **Zero-Tolerance Color Matching**: colorMatch defaults to false unless Gemini explicitly confirms match (STRICT for e-commerce accuracy)
    - **Missing Product Protection**: Products absent from Gemini response automatically marked as failed
    - **Enhanced QA Prompt**: "SIDE-BY-SIDE COMPARISON" emphasis for exact product matching with reference images
    - **Comprehensive Logging**: Full audit trail with warnings for below-threshold renders and manual review recommendations
    - **Rationale**: Thresholds lowered by ~3 points to improve pass rates while maintaining quality; color matching remains strict to ensure product accuracy
  - **Refinement Pipeline**: Three-tier Stability AI QC (ControlNet mask → product images → structure-only) with graceful fallbacks
  - **Comprehensive Product Specifications**: All database fields passed to AI prompts including:
    - Materials (deduplicated, filter falsy values)
    - Colors (deduplicated, filter falsy values)
    - All dimension fields (w, d, h, armWidth, seatDepth, etc.) with units
    - Seating capacity
    - Weight (with unit normalization)
    - Trade and retail prices (Drizzle decimal handling)
    - Shipping metadata (delivery options, location, policy, cost, ETA) with deep serialization to prevent [object Object]
    - Tags (deduplicated, trimmed)
  - **Deep Serialization Helper**: `serializeValue()` function recursively serializes nested objects/arrays to prevent [object Object] in prompts, with JSON.stringify fallback for very deep structures (depth > 5)
- **Dimension Validation System**: Three-stage pipeline preventing furniture purchases that won't fit:
  - **Natural Language Room Parser**: Gemini AI extracts structured dimensions from descriptions like "15x12 feet living room with 32-inch doorway, 8-foot ceilings"
  - **Spatial Fit Validator**: Validates products against room envelope (dual-orientation checking), doorway delivery (diagonal Pythagorean calculations), and clearance requirements
  - **Validation Tiers**: BLOCK (oversized), WARNING (tight fit 15-18" clearance), OK (comfortable >18" clearance)
  - **Database Schema**: `roomDescription` (text) and `parsedRoomData` (JSONB) fields in `quiz_responses` table for persistence
  - **Pre-Render Filtering**: Hard-blocks oversized products before AI selection to prevent showing unavailable furniture
  - **Confirmation UI**: Shows parsed dimensions with confidence scores, allows editing, requires user acknowledgment
  - **Graceful Degradation**: If parsing fails or confidence low, system continues without blocking but logs warnings
  - **Known Limitations**: Clearance assumes centered placement (not wall-adjacent), warnings logged server-side but limited UI surfacing, simplified confidence scoring

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless driver using Drizzle ORM.
- **Curalina AI Schema Design**: Includes tables for categories, suppliers, products (with multiple visual description fields for AI analysis), quiz responses, renders, cart items, orders, order items, and AI training data.
- **Object Storage**: Google Cloud Storage for user uploads, AWS S3 for product images.

## External Dependencies

- **Authentication Services**:
    - Replit OIDC provider
- **Database**:
    - Neon serverless PostgreSQL
- **Object Storage**:
    - Google Cloud Storage
    - AWS S3
- **AI/ML**:
    - Stability AI SDXL (for structure-preserving image-to-image rendering)
    - Google Gemini 2.5 Flash via Replit AI Integrations (for text-to-image generation, AI image matching)
    - Google Gemini Vision via Replit AI Integrations (for multi-modal image analysis)
    - **Note**: Uses Replit AI Integrations for Gemini access (no API key required, billed to Replit credits)
- **Image Processing**:
    - Sharp
- **Payment Processing**:
    - Stripe
- **UI Libraries**:
    - Radix UI primitives (via shadcn/ui)
    - Uppy (file upload UI)
    - Lucide React (icons)
- **Styling**:
    - Tailwind CSS