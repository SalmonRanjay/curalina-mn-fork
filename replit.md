# Curalina AI - Interior Design Platform

## Overview
Curalina AI is a full-stack AI-powered interior design platform that integrates hybrid AI-generated room rendering with an e-commerce marketplace for furniture. The platform provides a seamless interior design and shopping experience, from inspiration to purchase, leveraging multimodal AI for highly personalized and contextually appropriate visual experiences.

Key capabilities include:
- **Intelligent Image Analysis**: AI analysis of room photos, floor plans, vibe images, and product images (using Gemini Vision and OpenAI GPT-5 Vision) to extract spatial information, user preferences, and detailed visual product descriptions.
- **AI-Powered Rendering**: Generates creative room designs from scratch (text-to-image) or redesigns existing spaces while preserving architectural features (image-to-image) using Gemini 2.5 Flash.
- **Hybrid Image Compositing**: Aims for exact product matching by compositing real product images onto AI-generated rooms.
- **Context-Aware Design Generation**: AI prompts are enhanced with analyzed room context and detailed product visual descriptions for more accurate and relevant designs. Visual descriptions are prioritized: Front View → Gemini Vision → OpenAI Vision → Legacy, ensuring the highest-quality product information is used.
- **Smart Product Selection**: Filters and prioritizes products based on image quality, visibility in renders, and user preferences, with a focus on displaying "Front View" images.
- **Data Quality Transparency**: Shop the Look product cards display visual description source badges (Front View, Gemini Vision, OpenAI Vision, or Legacy) to show users which AI analysis method was used for each product recommendation, providing insight into recommendation quality and data provenance.
- **Complete E-commerce Journey**: Features a 7-step design quiz, AI-powered product selection, shopping cart, and Stripe checkout integration.
- **Training Data System**: Admin-managed data for continuously improving AI performance.
- **Quiz Mapping Analysis**: Dashboard for analyzing how quiz questions map to product recommendations, identifying data quality gaps and normalization opportunities.

## User Preferences
Preferred communication style: Simple, everyday language.

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