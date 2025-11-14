# Curalina AI - Interior Design Platform

## Overview
Curalina AI is a full-stack AI-powered interior design platform that integrates hybrid AI-generated room rendering with an e-commerce marketplace for furniture. The platform provides a seamless interior design and shopping experience, from inspiration to purchase, leveraging multimodal AI for highly personalized and contextually appropriate visual experiences.

Key capabilities include:
- **Intelligent Image Analysis**: AI analysis of room photos, floor plans, vibe images, and product images (using Gemini Vision and OpenAI GPT-5 Vision) to extract spatial information, user preferences, and detailed visual product descriptions. Enhanced Front View detection automatically treats single-image products as Front View images, ensuring they receive the highest-priority AI analysis.
- **AI-Powered Rendering**: Generates creative room designs from scratch (text-to-image) or redesigns existing spaces while preserving architectural features (image-to-image) using Gemini 2.5 Flash.
- **Structured Placement Matrix**: AI prompts include explicit spatial instructions for each product with anchor zones, positioning rules, clearance requirements, and adjacency relationships. Uses functional categories and priority hierarchies from the selection ledger to ensure proper furniture placement (essentials → complementary → decor).
- **Hybrid Image Compositing**: Aims for exact product matching by compositing real product images onto AI-generated rooms.
- **Context-Aware Design Generation**: AI prompts are enhanced with analyzed room context, detailed product visual descriptions, and structured placement instructions for more accurate and functional room layouts. Visual descriptions are prioritized: Front View → Gemini Vision → OpenAI Vision → Legacy, ensuring the highest-quality product information is used.
- **Smart Product Selection**: Filters and prioritizes products based on image quality, visibility in renders, and user preferences, with a focus on displaying "Front View" images.
- **Data Quality Transparency**: Shop the Look product cards display visual description source badges (Front View, Gemini Vision, OpenAI Vision, or Legacy) to show users which AI analysis method was used for each product recommendation, providing insight into recommendation quality and data provenance.
- **Complete E-commerce Journey**: Features a 7-step design quiz, AI-powered product selection, shopping cart, and Stripe checkout integration.
- **Training Data System**: Admin-managed data for continuously improving AI performance.
- **Quiz Mapping Analysis**: Dashboard for analyzing how quiz questions map to product recommendations, identifying data quality gaps and normalization opportunities.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 14, 2025
**Zone-Based Placement System Implementation**
1. **Zone Configuration System**: Created ROOM_ZONES configurations for each room type (Living Room, Bedroom, Dining Room, Home Office) with detailed ZoneBlueprint definitions including bounds, allowed categories, capacity limits, clearances, and orientation preferences.
2. **Product Zone Assignment**: Implemented assignItemsToZones() function that:
   - Assigns products to appropriate zones based on functional categories
   - Enforces interior design rules (max 1 floor lamp per room, table lamps only on surfaces)
   - Calculates normalized positions (0-1 room coordinates), orientations, and spacing
   - Scores placement confidence based on zone fitness
3. **Structured Placement Matrix**: Created generateZoneBasedPlacementMatrix() to convert PlacementInstruction data into explicit spatial instructions for AI prompts, grouped by zone with position coordinates, anchor points, orientations, and clearance values.
4. **End-to-End Data Flow**: Integrated zone-based placements through the entire pipeline from selectProductsWithComposition → selectProductsWithAI → routes → buildPromptFromQuiz → generatePlacementMatrix → final AI prompt, with graceful fallback to legacy placement logic when placements unavailable.

**Critical Bug Fixes - Product Selection & AI Authentication**
1. **Fixed Product Image Validation**: Updated `hasValidImages()` to accept local asset paths (`/images/`, `/assets/`) in addition to external URLs and object storage paths. This resolved the issue where sofas and other essential furniture with local image paths were being excluded from the candidate pool.
2. **Fixed Gemini API Authentication**: Switched from Replit AI Integrations (which was returning 401 errors) to direct Google Gemini API using user's own `GEMINI_API_KEY`. This enables reliable AI-powered room rendering.
3. **Enhanced Product Filtering**: Improved filterProductsByQuiz to check both `designStyle` column AND `styleTags` array for style matching, with 5-level sequential fallback system for better product coverage.
4. **Added Multi-Provider AI Image Generation**: Implemented support for both Gemini 2.5 Flash and OpenAI DALL-E 3 image generation engines, enabling side-by-side quality comparisons. Both providers use identical quiz data, product selections, and Gemini Vision descriptions to ensure fair comparison. API route accepts optional `aiProvider` parameter ('gemini' or 'openai', defaults to 'gemini').

**Living Room Training Data Import**
1. **Design Examples**: Imported 6 professionally curated Living Room packages covering diverse room sizes (11.5x10 to 17.5x14.5 feet) and styles (contemporary, modern, executive, compact, multi-purpose). Each example includes room dimensions, style tags, design reasoning, and principles.
2. **Product Packages**: Created 6 product package records documenting proven furniture combinations with 12 existing products from the database (Kent Sofa, Rialto Sofa, Mitchell Sofa, Melle Sofa, Colome Floor Lamp, Fordham Floor Lamp, Chameau Side Table, Dusk Accent Table, Bridger Pillow, Raffael Bar Cabinet, Ferris Dining Chair, Sierra Tapestry).
3. **Placement Guidelines**: Established 8 spatial relationship rules for Living Rooms covering sofa positioning (12-18" wall clearance), coffee table distance (14-18" from sofa), side table height matching, floor lamp placement (max 1 per room), sectional usage in compact spaces, storage integration, multi-purpose zoning, and furniture scale appropriateness.
4. **Coverage**: Successfully matched 12 of 27 products from PDF to existing database. Training data now available for AI prompt generation to improve furniture placement accuracy and design quality.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript, Vite.
- **UI Component Strategy**: shadcn/ui (Radix UI primitives), Tailwind CSS for styling, React Dropzone and Uppy for file uploads.
- **Design System**: Inter font, light green selection highlights, neutral backgrounds, animated transitions.
- **State Management**: React Query for server state, Local Storage for anonymous session IDs.
- **Routing**: Wouter for client-side routing across key user flows.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript.
- **API Structure**: Dedicated routes for file uploads, product management, quiz submission, AI rendering, cart, and order processing.
- **Validation & Error Handling**: Zod for schema validation.
- **Data Access Layer**: `ICuralinaStorage` interface implemented using Drizzle ORM for type-safe operations with PostgreSQL.
- **Authentication System**: Passport.js Local Strategy (email/password), session-based with PostgreSQL store, bcrypt for password hashing, HttpOnly/Secure cookies. Replit OIDC for external authentication.
- **Access Control**: Role-based access for Admin, Regular User, and Anonymous states.
- **Image Processing Pipeline**: Sharp library for basic image compositing. Roadmap includes background removal integration, scene-aware positioning, and realistic shadows.
- **Direct Browser-to-S3 Upload Optimization**: Uses a 3-step presigned URL flow to enable direct, secure, and faster browser-to-S3 uploads, bypassing server memory bottlenecks and including duplicate detection.

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless driver using Drizzle ORM.
- **Curalina AI Schema Design**: Includes tables for categories, suppliers, products (with multiple visual description fields for AI analysis), quiz responses, renders, cart items, orders, order items, and AI training data (design examples, product packages, placement guidelines, design rules).
- **Object Storage**: Google Cloud Storage for user uploads (floorplans, vibe images, AI renders), AWS S3 for product images.

## External Dependencies

- **Authentication Services**:
    - Replit OIDC provider (Google, GitHub login)
- **Database**:
    - Neon serverless PostgreSQL
- **Object Storage**:
    - Google Cloud Storage
    - AWS S3
- **AI/ML**:
    - Stability AI SDXL (for structure-preserving image-to-image room rendering)
    - Google Gemini 2.5 Flash (for text-to-image generation, AI image matching)
    - Google Gemini Vision (for multi-modal image analysis of rooms, floor plans, and products)
    - OpenAI GPT-5 Vision (for parallel product image analysis)
- **Image Processing**:
    - Sharp (image compositing, resizing)
- **Payment Processing**:
    - Stripe
- **UI Libraries**:
    - Radix UI primitives (via shadcn/ui)
    - Uppy (file upload UI)
    - Lucide React (icons)
- **Styling**:
    - Tailwind CSS