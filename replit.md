# Curalina AI - Interior Design Platform

## Overview
Curalina AI is a full-stack AI-powered interior design platform that integrates AI-generated room rendering (using Stability AI SDXL) with an e-commerce marketplace for furniture. Built with React, Express, and PostgreSQL, the platform allows users to take a design quiz, generate AI renders, and purchase products through a complete shopping and checkout experience. It supports anonymous user tracking and includes object storage for user uploads and AI-generated renders. The project aims to provide a seamless interior design and shopping journey, from inspiration to purchase, leveraging AI for personalized visual experiences.

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

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless driver using Drizzle ORM for schema management.
- **Curalina AI Schema Design**:
    - `categories`: Product categorization.
    - `suppliers`: Furniture suppliers.
    - `products`: Full product catalog including SKU, pricing, images, 3D assets.
    - `quizResponses`: User design preferences, including floorplans and vibe images.
    - `renders`: AI-generated room designs with associated products.
    - `cartItems`: Shopping cart items per session.
    - `orders`: Purchase orders with customer and shipping details.
    - `orderItems`: Individual items within orders.
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
    - Stability AI SDXL (for AI room rendering)
    - Google Gemini 2.5 Flash (for AI image matching in product import)
- **Payment Processing**:
    - Stripe (ready for API key integration)
- **UI Libraries**:
    - Radix UI primitives (via shadcn/ui)
    - Uppy (advanced file upload UI)
    - Lucide React (icons)
- **Styling**:
    - Tailwind CSS