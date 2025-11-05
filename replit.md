# Curalina AI - Interior Design Platform

## Overview

Curalina AI is a full-stack AI-powered interior design platform built with React, Express, and PostgreSQL. The platform combines AI-generated room rendering (using Stability AI SDXL) with an e-commerce marketplace for furniture products, design quiz workflow, and complete shopping/checkout experience.

The application follows a monorepo structure with client-side React code, server-side Express API, and shared TypeScript schemas. It features session-based anonymous user tracking, allowing users to complete the design quiz, generate AI renders, and purchase products without mandatory authentication. The platform includes object storage for user uploads (floorplans, vibe images) and AI-generated renders.

## User Preferences

Preferred communication style: Simple, everyday language.

## Product Data

**Current Inventory**: 351 products from premium furniture suppliers
- **Four Hands**: 271 products (luxury modern furniture)
- **Moes Home**: 66 products (contemporary home furnishings)
- **Other suppliers**: 14 products

**Categories** (23 total):
- Dining Chairs (94), Dresser (47), Console Table (41), Dining Table (37)
- End Table (36), Bed (32), Sofa (23), Shelving Unit (7), and more

**Product Import Script**: `scripts/import-products.ts`
- Reads Excel files with product catalog data
- Auto-creates categories and suppliers
- Parses dimensions, colors, materials, style tags
- Handles duplicate SKUs and inventory status
- Run with: `npx tsx scripts/import-products.ts`

## Curalina AI Features

### Core User Journey
1. **7-Step Design Quiz**: Capture user preferences (room type, style, features, budget, vibe images, floorplan)
2. **AI Room Rendering**: Generate photorealistic interior designs using Stability AI SDXL
3. **Product Shopping**: Browse featured furniture products from the AI render
4. **Cart & Checkout**: Add products to cart, complete purchase with Stripe payment
5. **Order Management**: Track orders from pending to delivered

### Key Capabilities
- **User Authentication**: Replit OIDC login with Google, GitHub, email/password support
- **Role-Based Access**: Admin dashboard for platform management, user portal for customers
- **Anonymous Sessions**: Session-based tracking without forced authentication (quiz, cart, orders)
- **User Dashboard**: View design history, order tracking, and quick actions
- **AI Image Generation**: Text-to-image and image-to-image (with floorplan) rendering
- **Product Catalog**: Full e-commerce with SKUs, categories, suppliers, pricing, 3D assets
- **Product Swapping**: Replace items in AI renders with alternative products
- **File Uploads**: Support for floorplans and reference "vibe" images
- **Stripe Integration**: Payment processing (ready for API keys)

### Authentication & Access Control
**Authentication System**:
- Traditional username/password authentication using Passport.js Local Strategy
- Login page at `/login` with email/password form
- Registration page at `/register` with email, password, first name, last name
- Session-based authentication with PostgreSQL-backed session store
- Password hashing with bcrypt (10 salt rounds)
- Session regeneration on login to prevent session fixation attacks
- Session destruction on logout with cookie clearing

**Security Features**:
- Zod validation for registration and login inputs
- Minimum 8-character password requirement
- Passwords never sent to client (excluded from API responses)
- HttpOnly cookies in production
- Secure flag enabled in production
- Graceful handling of stale/missing user sessions

**User Roles**:
- **Admin**: Full access to admin dashboard (`/admin`) for managing categories, suppliers, products, orders, renders, quiz responses
- **Regular User**: Access to user portal (`/portal`) for viewing designs and orders
- **Anonymous**: Can complete quiz, generate renders, add to cart without logging in

**Navigation UI**:
- **Unauthenticated**: "Login" and "Register" buttons
- **Authenticated Users**: User first name + "Account" button + "Logout" button
- **Admin Users**: Additional "Admin" button for dashboard access

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR support
- Client-side routing using Wouter for quiz, loading, results, cart, checkout pages
- React Query (TanStack Query) for server state management and caching
- Framer Motion for animations (cascade effects, bouncing dots, transitions)

**UI Component Strategy**
- shadcn/ui component library for pre-built, accessible Radix UI primitives
- Tailwind CSS for utility-first styling
- React Dropzone for file upload handling (floorplans, vibe images)
- Uppy for advanced file upload UI with progress tracking

**Design System**
- Typography: Inter font family
- Color scheme: Light green selection highlights, neutral backgrounds
- Animations: Typewriter text effects, bouncing dots, cascade reveals
- Responsive mobile-first design

**State Management**
- React Query for async server state
- Local Storage for anonymous session ID persistence (`curalina_session_id`)
- Session utility functions: `getOrCreateSessionId()`, `getSessionId()`, `clearSession()`

**Routing Structure**
- `/` - Landing page with hero, features, how-it-works, and style carousel
- `/quiz` - 7-step design questionnaire with animations
- `/loading` - 8-second loading animation with facts
- `/results` - AI render display with product shopping
- `/cart` - Shopping cart with quantity controls
- `/checkout` - Payment and shipping forms
- `/dashboard` - User dashboard with designs, orders, and quick actions

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for type-safe API development
- Multer middleware for file upload handling (memory storage)
- JSON body parsing with Zod schema validation
- Session-based anonymous user tracking

**API Structure - Curalina AI Routes** (`server/routes-curalina.ts`)
- **File Upload**: `POST /api/upload` - Upload floorplans/vibe images to object storage
- **S3 Product Images**: 
  - `POST /api/admin/products/:id/upload-image` - Upload product images to AWS S3 (admin-only)
  - Max file size: 10MB
  - Allowed types: JPEG, PNG, WebP, GIF
  - Returns 400 for validation errors with descriptive messages
- **Products**: 
  - `GET /api/products` - List all products with optional filters (category, styleTags)
  - `GET /api/products/:id` - Get single product details
  - `GET /api/products/alternatives/:id` - Get alternative products for swapping (6 max, same category/style)
- **Quiz**: `POST /api/quiz` - Submit 7-step quiz responses
- **Rendering**:
  - `POST /api/render` - Create AI render (async generation with Stability AI)
  - `GET /api/render/latest?sessionId=xyz` - Get most recent render for session
  - `GET /api/render/:id` - Get render by ID
- **Cart**:
  - `GET /api/cart/:sessionId` - Get cart items with product details
  - `POST /api/cart` - Add item to cart (auto-merges quantities if exists)
  - `PATCH /api/cart/:id` - Update cart item quantity
  - `DELETE /api/cart/:id` - Remove item from cart
- **Orders**:
  - `POST /api/orders` - Create order from cart (auto-clears cart)
  - `GET /api/orders/:id` - Get order details
  - `GET /api/orders?sessionId=xyz` - Get all orders for a session
- **Dashboard**:
  - `GET /api/renders?sessionId=xyz` - Get all renders for a session

**Validation & Error Handling**
- Zod schema parsing for all mutations (quiz, render, cart, orders)
- Returns 400 status with validation details for invalid input
- Returns 500 status only for unexpected server errors
- All foreign keys enforced as non-null to prevent orphaned records

**Data Access Layer**
- Storage abstraction: `ICuralinaStorage` interface in `server/storage-curalina.ts`
- `CuralinaStorage` implementation using Drizzle ORM
- Inner joins for cart/product hydration (no null assertions)
- Type-safe operations with shared schema types

### Data Storage Solutions

**Primary Database**
- PostgreSQL via Neon serverless driver with WebSocket support
- Connection pooling for efficient resource management
- Database schema managed through Drizzle ORM

**Curalina AI Schema Design** (in `shared/schema.ts`)

1. **`categories`** - Product categorization
   - `id` (varchar UUID), `name`, `type` ('room' | 'furniture'), `slug`, `createdAt`

2. **`suppliers`** - Furniture suppliers
   - `id` (varchar UUID), `name`, `email`, `createdAt`

3. **`products`** - Full product catalog
   - `id` (varchar UUID), `sku` (unique), `name`, `description`
   - `categoryId` (FK → categories, required), `supplierId` (FK → suppliers, required)
   - `styleTags` (string[]), `colors` (string[]), `materials` (string[])
   - `dimensions` (JSONB: {w, d, h, unit}), `price`, `discount`
   - `availability` ('in_stock' | 'preorder'), `images` (string[])
   - `asset3dUrl` (.glb/.usdz for AR), `shipping` (JSONB: {cost, eta})
   - `seoMeta` (JSONB: {title, description}), `slug` (unique), `createdAt`

4. **`quizResponses`** - User design preferences
   - `id` (varchar UUID), `sessionId`, `roomType`, `style`
   - `keyFeatures` (string[]), `budgetRange`, `vibeImages` (string[])
   - `preferences` (string[]), `floorplanUrl`, `createdAt`

5. **`renders`** - AI-generated room designs
   - `id` (varchar UUID), `quizResponseId` (FK → quizResponses, required)
   - `sessionId`, `imageUrl`, `prompt`, `productSkus` (string[])
   - `status` ('generating' | 'completed' | 'failed'), `errorMessage`, `createdAt`

6. **`cartItems`** - Shopping cart
   - `id` (varchar UUID), `sessionId`
   - `productId` (FK → products, required), `quantity`, `createdAt`

7. **`orders`** - Purchase orders
   - `id` (varchar UUID), `sessionId`
   - `status` ('pending' | 'paid' | 'fulfilled' | 'shipped' | 'delivered')
   - `totalAmount`, `customerEmail`, `customerName`
   - `shippingAddress` (JSONB: {street, city, state, zip, country})
   - `stripePaymentIntentId`, `createdAt`, `updatedAt`

8. **`orderItems`** - Individual items in orders
   - `id` (varchar UUID), `orderId` (FK → orders, required)
   - `productId` (FK → products, required), `quantity`, `priceAtPurchase`

**Legacy Schema** (from previous admin platform - may be deprecated)
- `users`, `sessions`, `content`, `settings`, `activityLog`

**ORM & Migrations**
- Drizzle ORM with drizzle-kit for schema management
- Type-safe query builder with TypeScript inference
- Schema definitions in `shared/schema.ts` using Drizzle's pg-core
- Zod integration via drizzle-zod for runtime validation
- Migration files generated in `/migrations` directory

**Object Storage**
- Google Cloud Storage integration for file uploads
- Custom ACL policy system for fine-grained access control
- Object metadata storage for ownership and permissions
- Uppy file upload UI with AWS S3-compatible interface
- Support for public and private object visibility
- Replit sidecar integration for GCS credential management

### External Dependencies

**Authentication Service**
- Replit OIDC provider for user authentication
- OpenID Client library for OIDC flows
- Automatic token refresh and session management
- Issuer URL: `https://replit.com/oidc` (configurable via env)

**Database**
- Neon serverless PostgreSQL with WebSocket connections
- Database URL configured via `DATABASE_URL` environment variable
- Automatic connection pooling and prepared statements

**Object Storage**
- **Google Cloud Storage**: For user uploads (floorplans, vibe images, AI renders)
  - External account credentials via Replit sidecar endpoint
  - Project-less configuration (empty projectId)
  - Credential endpoint: `http://127.0.0.1:1106`
- **AWS S3**: For product images
  - Bucket: "curalina"
  - Region: AWS_REGION env var (defaults to us-east-1)
  - Public-read ACL for direct browser access
  - Validation: 10MB max file size, image MIME types only
  - URL format: `https://curalina.s3.{region}.amazonaws.com/{key}`
  - Key format: `products/{sku}-{timestamp}.{ext}`

**Third-Party UI Libraries**
- Radix UI primitives (30+ component packages)
- Uppy file uploader with dashboard and AWS S3 plugins
- Lucide React icons for consistent iconography
- date-fns or similar for date manipulation (implied by calendar component)

**Development Tools**
- Vite plugins: Replit cartographer, dev banner, runtime error overlay
- TypeScript for type safety across client, server, and shared code
- ESBuild for server-side bundling in production

**Styling Dependencies**
- Tailwind CSS with PostCSS and Autoprefixer
- class-variance-authority for variant-based component styling
- tailwind-merge and clsx for conditional className merging