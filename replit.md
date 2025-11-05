# Curalina - Unified Platform

## Overview

Curalina is a full-stack web application built with React, Express, and PostgreSQL. The platform provides a comprehensive content management system with distinct experiences for public visitors, authenticated users, and administrators. It features a modern UI built with shadcn/ui components, server-side authentication via Replit Auth, and integrated object storage capabilities through Google Cloud Storage.

The application follows a monorepo structure with client-side React code, server-side Express API, and shared TypeScript schemas. It emphasizes a clean, productivity-focused design inspired by Linear for admin interfaces while maintaining an engaging, accessible experience for public-facing pages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR support
- Client-side routing using Wouter for lightweight navigation
- React Query (TanStack Query) for server state management and caching

**UI Component Strategy**
- shadcn/ui component library (New York style variant) providing pre-built, accessible Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Custom CSS variables for theming (light/dark mode support)
- Component composition pattern using Radix UI slot pattern for flexibility

**Design System**
- Typography: Inter font for UI/body text, JetBrains Mono for technical content
- Hybrid design approach: Linear-inspired clean aesthetics for admin, Notion-inspired accessibility for public site
- Consistent spacing primitives (2, 4, 8, 12, 16, 20 Tailwind units)
- Custom color scheme with HSL values supporting alpha channel transparency

**State Management**
- React Query for async server state with aggressive caching (staleTime: Infinity)
- Local React state for UI-specific concerns
- Auth state managed through custom `useAuth` hook querying `/api/auth/user`

**Routing & Access Control**
- Public routes: Landing page accessible to all
- Protected admin routes: Dashboard, Content, Users, Settings (requires admin role)
- Protected user routes: Portal Dashboard, Portal Settings (requires authentication)
- Automatic redirect to login for unauthenticated users, redirect to portal for non-admin users accessing admin routes

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for type-safe API development
- Custom middleware for request logging with duration tracking
- JSON body parsing with raw body preservation for webhook verification
- Session-based authentication using express-session

**Authentication & Authorization**
- Replit OpenID Connect (OIDC) integration via Passport.js strategy
- Session storage in PostgreSQL using connect-pg-simple
- Token refresh mechanism for maintaining long-lived sessions
- Role-based access control (RBAC) with 'admin' and 'user' roles
- Protected middleware: `isAuthenticated` for all authenticated routes

**API Structure**
- RESTful endpoints under `/api` prefix:
  - `/api/auth/user` - Get current authenticated user
  - `/api/users/profile` - Update user profile
  - `/api/content` - CRUD operations for content management
  - `/api/settings` - Application settings management
  - `/api/activity` - Activity logging
  - `/api/login`, `/api/callback`, `/api/logout` - Authentication flows

**Data Access Layer**
- Storage abstraction pattern with `IStorage` interface
- `DatabaseStorage` implementation using Drizzle ORM
- All database operations return typed entities from shared schema
- Transaction support through Drizzle ORM capabilities

### Data Storage Solutions

**Primary Database**
- PostgreSQL via Neon serverless driver with WebSocket support
- Connection pooling for efficient resource management
- Database schema managed through Drizzle ORM

**Schema Design**
- `users` table: User profiles with role-based access (id, email, name, role, bio, timestamps)
- `sessions` table: Express session storage (sid, sess JSON, expire timestamp)
- `content` table: CMS content entries (id, title, description, body, imageUrl, category, published status, authorId, timestamps)
- `settings` table: Key-value configuration store (key, value JSON, description, timestamps)
- `activityLog` table: Audit trail (id, userId, action, details JSON, timestamp)

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
- Google Cloud Storage for file/asset hosting
- External account credentials via Replit sidecar endpoint
- Project-less configuration (empty projectId)
- Credential endpoint: `http://127.0.0.1:1106`

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