# Curalina AI - Interior Design Platform

## Overview
Curalina AI is a full-stack AI-powered interior design platform that integrates hybrid AI-generated room rendering with an e-commerce marketplace for furniture. Built with React, Express, and PostgreSQL, the platform features:

- **Intelligent Image Analysis**: 
  - **Room & Floor Plan Analysis**: Gemini Vision automatically analyzes uploaded room photos and floor plans to extract detailed spatial information, architectural features, existing furniture, and design elements
  - **Product Visual Analysis**: Multi-angle Gemini Vision analysis of all product images to generate comprehensive visual descriptions (color, material, style, form, design details), stored in database for AI prompt enhancement
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
  - Budget-Aware Selection: Total combined cost of products never exceeds user's budget, with validation and adjustment
  - Image Quality Filter: Comprehensive validation checks for broken/invalid images (placeholders, missing URLs, invalid formats)
  - Visibility Filtering: Gemini Vision analyzes generated images to show only products actually visible in the final render
- **Complete E-commerce Journey**: 7-step design quiz, AI-powered product selection, shopping cart, Stripe checkout integration
- **Training Data System**: Admin-managed design examples, product packages, placement guidelines, and design rules to continuously improve AI performance

The platform provides a seamless interior design and shopping experience, from inspiration to purchase, leveraging multimodal AI for highly personalized and contextually appropriate visual experiences.

## User Preferences
Preferred communication style: Simple, everyday language.

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

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless driver using Drizzle ORM for schema management.
- **Curalina AI Schema Design**:
    - `categories`: Product categorization.
    - `suppliers`: Furniture suppliers.
    - `products`: Full product catalog including SKU, pricing, images, 3D assets, and `visualDescription` field (comprehensive Gemini Vision analysis of all product angles for AI prompt enhancement).
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
      - Batch product image analysis (comprehensive visual descriptions from all angles for AI prompt enhancement)
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