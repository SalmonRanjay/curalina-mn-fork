# CURALINA AI - COMPLETE APPLICATION DOCUMENTATION

**Generated:** November 15, 2025  
**Version:** 1.0  
**Status:** Production Analysis & Enhancement Plan

---

## 📋 TABLE OF CONTENTS

1. [Application Overview](#-application-overview)
2. [Core Features & User Journey](#-core-features--user-journey)
3. [Technical Architecture](#-technical-architecture)
4. [AI Integration & Logic](#-ai-integration--logic)
5. [Current Issues & Limitations](#-current-issues--limitations)
6. [Fix Recommendations](#-fix-recommendations)
7. [Fine-Tuning Plan](#-fine-tuning-plan)
8. [Success Metrics](#-success-metrics)

---

## 🎯 APPLICATION OVERVIEW

**Curalina AI** is a sophisticated AI-powered interior design platform that combines personalized room generation with e-commerce functionality. The platform allows users to:

- Take a 7-step design quiz to capture preferences
- Generate AI-powered room designs with real furniture products
- Browse and shop curated products directly from their designs
- Complete purchases through integrated checkout

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite build system
- Tailwind CSS + shadcn/ui components
- Wouter for routing
- React Query for state management

**Backend:**
- Express.js with TypeScript
- PostgreSQL (Neon serverless) via Drizzle ORM
- Passport.js authentication (Local + OIDC)
- Session-based authentication with PostgreSQL store

**AI Services:**
- Google Gemini 2.5 Flash (primary generation)
- Google Gemini Vision (image analysis)
- OpenAI GPT-5 Vision (product analysis)

**Storage:**
- AWS S3 for product images
- Google Cloud Storage for user uploads

**Payment Processing:**
- Stripe (configured but not fully implemented)

---

## ✨ CORE FEATURES & USER JOURNEY

### 1. THE 7-STEP DESIGN QUIZ

The quiz extracts detailed user preferences for AI personalization. Each step serves a specific purpose in the generation process.

#### **Step 1: Room Type Selection**

**Options:**
- Living Room
- Bedroom
- Dining Room
- Home Office
- Nursery
- Entryway

**Purpose:** Determines functional requirements, typical furniture pieces, and spatial layout rules.

**How AI Uses It:** Selects appropriate product categories and spatial arrangements.

---

#### **Step 2: Style Selection** (Choose up to 2)

**Options:**
- **Organic Modern**: Earthy, curved, minimalist with natural materials
- **Modern Farmhouse**: Rustic, cozy, vintage charm
- **Midcentury Scandi**: Retro, functional, warm woods
- **Contemporary Luxe**: Sleek, high-end materials, dramatic
- **Warm Transitional**: Classic meets modern, rich woods
- **Artful Eclectic**: Bold patterns, global influences, collected look

**Purpose:** Each style has specific characteristics for materials, colors, textures, and furniture forms.

**How AI Uses It:** Detailed "style descriptions" guide the AI image generator. For example:

**Organic Modern:**
```
"Curved sculptural furniture with soft edges, natural materials like white oak 
and travertine, plush boucle and linen textiles, earthy neutral color palette, 
low-profile furniture silhouettes"
```

---

#### **Step 3: Color Palette** (Choose up to 2)

**Updated Options:**
1. **Warm Neutrals**: Soft warm whites, ivory, light beige, pale greige, cream tones
2. **Earth & Stone**: Natural earth tones with stone textures
3. **Coastal Calm**: Light blues, sandy neutrals, soft whites
4. **Soft Contrast**: Gentle color contrasts with balanced tones
5. **Monochrome Luxe**: Sophisticated monochromatic schemes
6. **Artful Contrast**: Bold color contrasts and artistic pairings
7. **Heritage Warmth**: Rich, warm traditional colors
8. **Dark & Moody**: Deep charcoal, navy, forest green, burgundy with brass accents

**How AI Uses It:** Each palette has detailed color descriptions injected into prompts.

**Example for "Dark & Moody":**
```
"Deep charcoal, navy blue, forest green, rich burgundy, warm blacks with 
luxe brass and gold accents"
```

---

#### **Step 4: Functional Features** (Select all that apply)

**Room-Specific Options:**

**Living Room:**
- Storage Solutions (shelves & cabinetry)
- Workspace Area (integrated office)
- Comfortable Seating (sectional or deep sofa)
- Accent Lighting (ambient & task)
- Pet-Friendly (durable fabrics)
- Child-Friendly (toy storage, rounded edges)
- Media Area (entertainment cabinet)
- Multi-Function (sofa bed)

**Dining Room:**
- Casual Setting (relaxed & everyday)
- Formal Setting (elevated & polished)
- Bar Storage (wine and liquor)
- Storage Solutions (organize clutter)
- Seating capacity: 4, 6, 8, 10, or 12 people

**Bedroom:**
- Storage Solutions (clothing & linens)
- Workspace Area (integrated office)
- Vanity Table
- Comfortable Seating (reading chair)
- Media Area (TV cabinet)
- Bed size options: Twin, Double, Queen, King

**Home Office:**
- Concealed Storage (keep clutter out)
- Bookcase Storage (open shelves)
- Filing Storage (documents & files)
- Reading Chair (comfortable seat)
- Desk size: Large (52"-62") or Small (32"-48")

**Purpose:** Ensures the design includes necessary functional elements.

**How AI Uses It:** Influences product selection (e.g., "Storage Solutions" triggers selection of bookcases, cabinets, ottomans with storage).

---

#### **Step 5: Budget Range**

**Options:**
- $500 - $1,500
- $1,500 - $3,000
- $3,000 - $5,000
- $5,000+

**⚠️ IMPORTANT NOTE:** Budget is currently **NOT enforced** during product filtering.

**Rationale:** Prioritizing render quality over budget constraints ensures better AI-generated designs.

**Future Enhancement:** Budget filtering can be re-enabled if users prefer price-conscious selections.

---

#### **Step 6: Vibe Image Upload** (Optional - Up to 3 images)

**Purpose:** Upload inspiration photos from Pinterest, Instagram, or magazines.

**Why It's Powerful:** Instead of choosing from pre-set styles, users can show *exactly* what they like.

**How AI Analyzes It:**

1. **Gemini Vision Processing:** Each image is analyzed to extract:
   - **Color Palette**: 5-8 dominant colors with specific names or HEX codes
   - **Materials**: Natural oak wood, brushed brass, linen fabric, marble stone
   - **Textures**: Smooth matte, rough textured, glossy polished, woven, soft plush
   - **Lighting Tone**: Warm, cool, natural, or dramatic
   - **Density**: Minimal (sparse), moderate (balanced), or layered (full)
   - **Overall Vibe**: 2-3 sentences capturing emotional feeling and design aesthetic

2. **Structured JSON Output Example:**
```json
{
  "colorPalette": [
    "warm terracotta #E07A5F",
    "soft sage green #84A98C",
    "creamy white #F4F1DE",
    "warm gray #8D99AE",
    "natural tan #D4A373"
  ],
  "materials": [
    "natural oak wood",
    "linen fabric",
    "jute fiber",
    "matte ceramic",
    "brushed brass"
  ],
  "textures": [
    "smooth matte finish",
    "woven fabric",
    "natural grain wood",
    "soft tactile surfaces"
  ],
  "lightingTone": "warm",
  "density": "moderate",
  "overallVibe": "This space embodies organic warmth with earthy natural tones..."
}
```

3. **Visual Similarity Scoring:** This data creates semantic matches with products:
   - **Color Match (40%)**: Compares extracted colors with product colors
   - **Material Match (35%)**: Matches materials like "oak", "linen", "brass"
   - **Texture Match (25%)**: Matches textures like "smooth", "woven", "matte"

---

#### **Step 7: Room Photo or Floor Plan Upload** (Optional - 1 image)

**Two Use Cases:**

1. **Room Photo**: Upload existing space that needs redesign
2. **Floor Plan**: Upload architectural drawing with dimensions

**Why It Matters:** Enables **structure-preserving redesign** - AI keeps your actual room's dimensions, windows, doors, and layout while redesigning furniture and decor.

**Room Photo Analysis (Gemini Vision):**
- Identifies current furniture and condition
- Extracts dominant colors in walls, furniture, decor
- Describes wall paint colors with specific names (e.g., "soft dove gray")
- Notes wall patterns or textures
- Determines current design style
- Analyzes room layout and traffic flow
- Assesses lighting quality
- **Catalogs architectural features**: Windows (size, placement), doors (location, swing), ceiling details, built-in features

**Floor Plan Analysis (Gemini Vision):**
- Extracts room dimensions (width, length, ceiling height)
- Maps window locations with exact placement
- Documents door locations and swing directions
- Identifies built-in features (closets, fireplaces, alcoves)
- Analyzes ceiling/roof design elements
- Notes spatial constraints and layout considerations

---

### What Happens After Quiz Submission

1. Quiz data is saved to database (`quizResponses` table)
2. User is redirected to **Loading Page** with animated progress indicator
3. Backend starts AI generation process
4. Loading page polls every 2 seconds to check generation status
5. Once complete, user is automatically redirected to **Results Page**

---

### 2. AI-POWERED ROOM GENERATION

The platform uses **Gemini 2.5 Flash** to generate interior designs with two distinct modes:

#### **Mode 1: Text-to-Image** (No Room Photo Uploaded)

**When Used:** User completes quiz without uploading a room photo.

**Process:**

1. **Prompt Building**: System constructs detailed text description combining:
   - Room type: "Spacious living room with thoughtful furniture arrangement"
   - Style description: Full paragraph describing materials, textures, furniture forms
   - Color palette: Specific color names and accents
   - Functional features: "Include workspace area", "entertainment focus with media console"
   - Selected products: Names and visual descriptions of chosen furniture pieces

2. **AI Generation**: Gemini 2.5 Flash creates a room from scratch based entirely on text prompt

3. **Result**: Completely AI-imagined room with no reference to an existing space

**Example Prompt Snippet:**
```
Professional interior design photography: Create a photorealistic rendering 
of a spacious living room. Organic Modern aesthetic featuring curved sculptural 
furniture with soft edges, natural white oak and travertine materials, plush 
boucle textiles, earthy neutral palette (warm whites, bone, soft terracotta accents).

Include these specific products:
- Curved boucle sofa in cream with low profile and soft rounded arms
- Natural oak coffee table with live edge and minimalist hairpin legs
- Textured wool area rug in warm beige with subtle geometric pattern
```

---

#### **Mode 2: Image-to-Image** (Room Photo or Floor Plan Uploaded)

**When Used:** User uploads existing room photo or floor plan.

**Phase 1: Gemini Vision Analysis**

Before generating the new design, AI analyzes the uploaded image to understand the existing space.

**If Room Photo:**
- Identifies all current furniture pieces and condition
- Extracts dominant colors in walls, furniture, decor
- Describes wall paint colors with specific names and finish types
- Notes wall patterns or textures
- Determines current design style
- Analyzes room layout and traffic flow
- Assesses lighting quality
- **Catalogs architectural features**: Windows, doors, ceiling details, built-in features, moldings

**If Floor Plan:**
- Extracts room dimensions (width, length, ceiling height)
- Maps window locations with exact placement
- Documents door locations and swing directions
- Identifies built-in features
- Analyzes ceiling/roof design elements
- Notes spatial constraints

**Phase 2: Structure-Preserving Prompt**

The system builds a prompt that **mandates architectural preservation**:

```
CRITICAL STRUCTURE PRESERVATION REQUIREMENT:
This is a REDESIGN of an existing space, not a new room. You must preserve 
the exact architectural structure while updating the design.

MANDATORY PRESERVATION (NEVER CHANGE):
- Room dimensions, shape, and proportions must match exactly
- All walls, windows, doors, and openings in their exact locations and sizes
- Ceiling height and architectural details
- Structural elements and built-in features
- The viewpoint and perspective of the original space

WHAT YOU CAN CHANGE:
- Furniture pieces and their arrangement
- Wall paint colors and finishes
- Decorative elements and artwork
- Soft furnishings (rugs, curtains, pillows)
- Lighting fixtures and accessories

CURRENT SPACE ANALYSIS:
Overall: [Description from Gemini Vision analysis]

ARCHITECTURAL FEATURES TO PRESERVE:
- Two large windows on north wall (6ft wide x 8ft tall each)
- Single door on east wall with inward swing
- 10ft ceiling with crown molding
- Built-in window seat beneath windows

[Rest of style preferences and product selections...]
```

**Phase 3: Image-to-Image Generation**

Gemini 2.5 Flash **sees the uploaded room photo** and uses it as a visual reference:
- Analyzes spatial structure, perspective, and architectural elements
- Generates new design while **visually matching** the room's architecture
- Maintains original viewpoint and camera angle
- Redesigns furniture, colors, and decor according to user preferences

**Result:** A redesigned version of the user's actual space - same room dimensions, same windows and doors, same architectural features, but with new furniture and styling that matches their quiz preferences.

---

### Why Image-to-Image Matters

**Without image-to-image:** AI might generate a beautiful room, but it could have different dimensions, window placements, or layout than your actual space - making it unrealistic to implement.

**With image-to-image:** The AI-generated design is **directly implementable** because it respects your real-world constraints. When you purchase the furniture, you know it's sized and arranged for your actual room.

---

### 3. INTELLIGENT PRODUCT SELECTION

**The Challenge:** How do you choose the best 5-10 products from hundreds to include in a personalized room design?

**The Solution:** Multi-Factor Scoring System

#### Scoring Factors

Each product receives a score from 0-100 based on weighted criteria:

##### **1. Category Match (40% weight)**

**What it checks:** Does the product belong to a category suitable for the room type?

**Example:** For a "Living Room" design, prioritize sofas, coffee tables, side tables, lamps, rugs.

**How it works:**
- Each room type has predefined "core categories" and "accent categories"
- Products in core categories get full points (40/40)
- Products in accent categories get partial points (20/40)
- Products in unrelated categories get zero points

##### **2. Style Match (30% weight)**

**What it checks:** Does the product's style align with user's selected style(s)?

**How it works:**
- Every product has `styleTags` (e.g., ["organic modern", "minimalist"])
- User selected up to 2 styles in quiz
- Uses flexible token matching (handles "Midcentury Scandi" as "midcentury" + "scandi")
- If product has ANY overlap with user's style selections: 30 points
- No overlap: 0 points

##### **3. Visual Similarity Score (20% weight)** - *Only if vibe images uploaded*

**What it checks:** How closely does this product match the visual aesthetic from user's inspiration photos?

**Calculation:**

1. **Color Match (40% of similarity score)**
   - Extract product colors from `colors` array and `visualDescription` text
   - Compare with vibe color palette
   - Check for exact matches ("terracotta" in both)
   - Check for partial matches ("warm gray" contains "gray")
   - Score: (Matching colors) / (Total vibe colors)

2. **Material Match (35% of similarity score)**
   - Extract materials from visualDescription
   - Compare with vibe materials
   - "oak wood" matches "natural oak wood" ✓
   - Score: (Matching materials) / (Total vibe materials)

3. **Texture Match (25% of similarity score)**
   - Extract textures from visualDescription
   - Compare with vibe textures
   - "smooth matte" matches vibe preference ✓
   - Score: (Matching textures) / (Total vibe textures)

**Final Visual Similarity:**
```
FinalScore = (ColorScore × 0.40) + (MaterialScore × 0.35) + (TextureScore × 0.25)

Example:
- Color match: 60% → 0.60 × 0.40 = 0.24
- Material match: 40% → 0.40 × 0.35 = 0.14
- Texture match: 50% → 0.50 × 0.25 = 0.125
Total = 0.505 (50.5% similarity)
```

This contributes **20% to final product ranking**.

##### **4. Functional Feature Bonus (10% weight)**

**What it checks:** Does this product fulfill requested functional features?

**Examples:**
- User selected "Storage Solutions" → Bookcases, storage ottomans, cabinets get +10 points
- User selected "Workspace Area" → Desks, office chairs get +10 points
- User selected "Reading Nook" → Accent chairs, floor lamps, side tables get +10 points

---

#### Selection Process

1. **Initial Filtering:**
   - Remove products with invalid/missing images (quality control)
   - Remove products not matching room type at all
   - Keep only `in_stock` products

2. **Scoring:** Calculate weighted score for each remaining product

3. **Fallback Logic** (if too few matches):
   - **Fallback 1**: Relax key features requirement (keep room type + style)
   - **Fallback 2**: Relax style requirement (keep room type only)
   - **Final Fallback**: Accept any in-stock product with valid images

4. **Category Balancing:** Ensure variety in product selection
   - Don't select 5 lamps and no seating
   - Algorithm picks top-scoring products while maintaining category diversity

5. **Final Count:** Select 6-10 products total (configurable)

---

#### Image Quality Validation

Before using any product in AI generation, the system validates:
- Product has at least one valid image URL
- Image URL is not a placeholder or broken link
- Image format is supported (JPEG, PNG, WebP)
- URL is accessible and returns valid image data

**Why this matters:** AI image generation REQUIRES working product images as visual reference. Products without images cannot be accurately rendered.

---

### 4. PRODUCT VISUAL ANALYSIS

**The Problem:** Product catalogs typically have limited text descriptions like "Modern dining chair, Wood finish, upholstered seat". But for AI image generation, we need **extremely detailed visual information**.

**The Solution:** AI-powered visual analysis using two systems.

#### Gemini Vision Product Analysis

**Process:**

1. **Multi-Angle Image Collection**: Products often have multiple images (front, side, details, context). All are analyzed.

2. **Detailed Visual Extraction**: Gemini Vision receives specialized prompt requesting:

**Analysis Framework:**
- **Overall Form & Silhouette**: Exact shape, precise proportions, design style with era
- **Structural Components**: Frame construction, leg design, dimensions, support structures
- **Materials & Surfaces**: Specific material types, wood grain patterns, metal finishes, fabric weaves
- **Color Palette**: Dominant color with exact shade name, secondary colors with percentages, color temperature, finish sheen
- **Proportional Measurements**: Seat height ratios, arm heights, back proportions
- **Distinctive Design Features**: Tufting, channeling, nailhead trim, carved elements, hardware

**Output Format:** Single flowing paragraph (300-400 words) integrating all details.

**Example Visual Description:**
```
This mid-century modern accent chair features a gently curved, sculptural silhouette 
in warm ivory boucle fabric (approximately Sherwin Williams Natural Linen SW 9109 
equivalent). The frame showcases solid white oak construction with a natural matte 
finish and subtle grain visibility. The chair sits on four tapered legs angled at 
approximately 8 degrees from vertical, each measuring 1.5 inches in diameter, creating 
an airy floating appearance. The seat cushion features a medium-firm density with 
subtle tufting, while the curved backrest provides ergonomic lumbar support at a 
110-degree recline angle. The boucle upholstery has a tight loop construction creating 
a tactile, textured surface with approximately 2mm pile height. Distinctive features 
include exposed wood armrests with waterfall edge treatment, contrast piping in 
natural linen along all seams, and hand-stitched detailing at corners. The overall 
footprint measures approximately 28" wide × 32" deep × 31" tall, with a seat height 
of 18" from floor...
```

3. **Storage**: Generated description stored in `visualDescriptionGemini` field.

#### OpenAI GPT-5 Vision Product Analysis

**Same process as Gemini**, providing alternative/supplementary description.

Stored in `visualDescriptionOpenAI` field.

#### Priority System for Rendering

When generating room designs, the system uses visual descriptions in this priority order:

1. **Front View Description** (`visualDescriptionFrontView`) - if available
2. **Gemini Vision Description** (`visualDescriptionGemini`)
3. **OpenAI Vision Description** (`visualDescriptionOpenAI`)
4. **Legacy Description** (fallback)

This ensures the highest quality visual information is used for AI rendering.

---

### 5. ADMIN MANAGEMENT TOOLS

Comprehensive backend management system for maintaining the platform.

#### Product Catalog Management

**Features:**
- Full CRUD operations for products, categories, suppliers
- Product attributes: pricing, dimensions, materials, colors, styles
- Inventory tracking and availability status
- Multiple visual description fields for AI analysis

**Bulk Operations:**
- CSV/Excel import with intelligent parsing
- Auto-creation of categories and suppliers
- Duplicate detection by SKU
- Error reporting for failed imports

#### Image Management

**Direct Browser-to-S3 Upload:**
- Generate presigned POST URLs
- Client uploads directly to S3 (no server bandwidth)
- Duplicate detection via S3 key checking
- Organized structure: `products/{SKU}/{filename}`

**Legacy Server Relay:**
- Upload to server, then relay to S3
- Kept for backward compatibility
- Slower but more compatible

**Image Health Worker:**
- Scheduled validation every 6 hours
- Checks image accessibility
- Marks products as `repairing` or `removed`
- Manual trigger available for admins
- Auto-retry logic for transient failures

#### AI Training Data Management

**Design Examples:**
- Curate successful room designs
- Tag with style, room type, color palette
- Used to improve AI generation quality

**Product Packages:**
- Pre-defined furniture groupings
- Ensures cohesive product combinations
- Room-specific templates

**Placement Guidelines:**
- Spatial arrangement rules
- Zone-based positioning
- Relative positioning logic

**Design Rules:**
- Room composition requirements
- Essential vs. complementary items
- Category balancing rules

#### Render Storage & Analytics

**Features:**
- View all AI-generated renders
- Track product snapshots at generation time
- Lifecycle event tracking (created, viewed, products added to cart)
- Filter by status, room type, style
- Export render data for analysis

**Selection Ledger Audit:**
- Complete decision trail for product selections
- Shows scoring breakdown
- Rationale for each product choice
- Essential vs. complementary categorization
- Priority ordering

#### Mapping Analysis

**Purpose:** Identify gaps in product catalog coverage.

**Analyses:**

1. **Style Coverage:**
   - Shows product count per style
   - Identifies low-coverage styles (<20 products)
   - Suggests data acquisition priorities

2. **Color Palette Coverage:**
   - Matches products to each palette
   - Flags palettes with <20% coverage
   - Recommends adding specific colors

3. **Room Composition:**
   - Checks essential items per room type
   - Identifies missing essentials
   - Recommends complementary items

4. **Filter Optimization:**
   - Analyzes style + room type combinations
   - Identifies weak filter combinations
   - Suggests catalog expansion

#### User Management

- View all registered users
- Assign roles (admin, user)
- Track user activity
- Email verification status

#### Order Management

**⚠️ Status:** Currently marked "coming soon"

**Planned Features:**
- Order listing with status filters
- Order detail view with line items
- Status update workflow
- Customer notifications
- Stripe webhook integration

#### Analytics Dashboard

**⚠️ Status:** Currently showing hardcoded zeros

**Planned Metrics:**
- Total orders count
- Revenue tracking
- Products sold
- User registration trends
- Conversion rates

#### Additional Tools

**S3 Sync Tool:**
- Synchronize Front View images between S3 and database
- Bulk metadata updates
- Missing image detection

**Documentation System:**
- Client-facing documentation
- Section management
- Commenting system
- Version control

**Settings:**
- General site configuration
- Email preferences
- API key management
- Feature flags

---

### 6. SHOPPING EXPERIENCE

#### Results Page

**Layout:**
- Large AI-generated room design displayed prominently
- Sidebar with product cards for all featured items

**Product Cards Show:**
- Product image
- Product name
- Price (with strikethrough for discounts)
- Visual description source badge (Front View, Gemini, OpenAI)
- "Add to Cart" button

**Product Swap Functionality:**
- Click "Swap" on any product
- See alternative products matching same category and style
- Replace product in design preview
- Updated cart automatically

**Design Actions:**
- "Shop the Look" - Add all products to cart at once
- Download render image
- Share design via link
- Save to account (if logged in)

#### Shopping Cart

**Features:**
- View all cart items with thumbnails
- Adjust quantities with +/- buttons
- Remove individual items
- See running subtotal
- Apply discount codes (if available)
- Proceed to checkout

**Session Persistence:**
- Cart data saved to `sessionId`
- Persists across page refreshes
- Available even for non-logged-in users
- Transfers to account upon registration

#### Checkout Process

**Step 1: Review Order**
- Order summary with all items
- Final total calculation
- Shipping estimate

**Step 2: Shipping Information**
- Name, email, phone
- Address with validation
- Special delivery instructions

**Step 3: Payment**
- Stripe payment form
- Credit card processing
- Secure payment confirmation

**Step 4: Order Confirmation**
- Order number generation
- Email confirmation sent
- Order saved to database with product price snapshots

---

## 🏗️ TECHNICAL ARCHITECTURE

### Database Schema (PostgreSQL via Drizzle ORM)

#### Core E-commerce Tables

**`categories`**
- Product categorization (room types and furniture types)
- Fields: `id`, `name`, `type` ('room' or 'furniture'), `slug`, `createdAt`

**`suppliers`**
- Furniture supplier information
- Fields: `id`, `name`, `email`, `createdAt`

**`products`**
- Full product catalog with extensive metadata
- **Pricing:** `tradePrice`, `price`, `discount`
- **Attributes:** `roomType[]`, `designStyle[]`, `styleTags[]`, `keyFeatures[]`, `storageSolutions`, `colors[]`, `materials[]`
- **Physical:** `dimensions` (JSON), `weight`, `assembly`
- **Inventory:** `inventory`, `leadTime`, `availability`
- **Media:** `images[]`, `asset3dUrl`
- **AI Descriptions:** `visualDescription`, `visualDescriptionGemini`, `visualDescriptionOpenAI`, `visualDescriptionFrontView`
- **Metadata:** `tags[]`, `sourceFile`, `seoMeta`, `slug`

#### User Journey Tables

**`quizResponses`**
- User design preferences from 7-step quiz
- Fields: `sessionId`, `roomType`, `style`, `keyFeatures[]`, `budgetRange`, `vibeImages[]`, `preferences[]`, `floorplanUrl`

**`renders`**
- AI-generated room designs
- Fields: `quizResponseId`, `sessionId`, `imageUrl`, `prompt`, `productSkus[]`, `status`, `errorMessage`

**`cartItems`**
- Shopping cart (session-based)
- Fields: `sessionId`, `productId`, `quantity`

**`orders` & `orderItems`**
- Purchase records
- Order fields: `sessionId`, `status`, `totalAmount`, `customerEmail`, `customerName`, `shippingAddress`, `stripePaymentIntentId`
- Item fields: `orderId`, `productId`, `quantity`, `priceAtPurchase` (snapshot)

#### Authentication Tables

**`users`**
- User accounts
- Fields: `id`, `email`, `password` (hashed), `firstName`, `lastName`, `role`, `profileImageUrl`

**`sessions`**
- Session storage for Passport.js
- Managed by `connect-pg-simple`

#### AI Training & Analytics Tables

**`designExamples`**
- Curated successful room designs
- Fields: `title`, `description`, `imageUrl`, `roomType`, `style`, `colorPalette`, `featuredProducts[]`

**`productPackages`**
- Pre-defined furniture groupings
- Fields: `name`, `description`, `roomType`, `productSkus[]`, `totalPrice`, `priority`

**`placementGuidelines`**
- Spatial arrangement rules
- Fields: `name`, `category`, `zone`, `positioning`, `relativeToProduct`

**`designRules`**
- Room composition requirements
- Fields: `roomType`, `essentialCategories`, `complementaryCategories`, `maxProducts`, `balancingRules`

**`uploadJobs`**
- Track bulk upload progress
- Fields: `type`, `status`, `totalFiles`, `processedFiles`, `successCount`, `errorCount`, `metadata`

**`visualAnalysisJobs`**
- Track AI analysis jobs
- Fields: `productId`, `imageUrl`, `analysisType`, `status`, `result` (JSON), `errorMessage`

**`renderProducts`**
- Product snapshots at render generation time
- Fields: `renderId`, `productId`, `snapshot` (JSON with price, name, description at time of render)

**`renderEvents`**
- Lifecycle tracking for renders
- Fields: `renderId`, `eventType`, `metadata`, `timestamp`

**`selectionLedger`**
- Decision trail for product selections
- Fields: `renderId`, `quizResponseId`, `selectedProducts[]`, `rejectedProducts[]`, `selectionRationale` (JSON), `compositionOrder[]`

---

### Authentication System

#### Dual Authentication Strategy

**1. Local Authentication (Email/Password)**

**Implementation:** Passport.js Local Strategy

**Features:**
- Email/password registration
- bcrypt password hashing (10 rounds)
- Session-based authentication
- PostgreSQL session store (7-day TTL)
- HttpOnly/Secure cookies
- Session regeneration on login (prevents fixation)

**Endpoints:**
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/user` - Get current user

**2. Replit OIDC Authentication**

**Implementation:** OpenID Connect with Replit

**Features:**
- OAuth flow with Replit
- Token refresh mechanism
- Auto user upsert on login
- Claims extraction (email, name, profile image, role)
- Multi-domain support

**Flow:**
1. User initiates login via Replit
2. Redirect to Replit authorization
3. Callback with authorization code
4. Exchange code for tokens
5. Extract claims and upsert user
6. Establish session

**Token Management:**
- Access token stored in session
- Refresh token for renewal
- Auto-refresh on expiration
- Middleware checks token validity

#### Session Management

**Anonymous Sessions:**
- Unique session ID generated in browser localStorage
- Persists cart items and quiz responses
- No server-side user account required
- Seamless migration to authenticated session upon registration

**Session Store:**
- PostgreSQL table managed by `connect-pg-simple`
- 7-day TTL (time-to-live)
- Automatic cleanup of expired sessions
- Session data serialization/deserialization

**Session Security:**
- `httpOnly: true` - Prevents JavaScript access
- `secure: true` - HTTPS only
- `sameSite: 'lax'` - CSRF protection
- Session secret from environment variable

#### Authorization Middleware

**`isAuthenticated`:**
- Checks if user is logged in
- Returns 401 if not authenticated
- Used for user-specific endpoints

**`isAdmin`:**
- Checks if user has admin role
- Returns 403 if not admin
- Used for admin management endpoints

---

### Image Pipeline

#### AWS S3 for Product Images

**Organization Structure:**
```
products/
  {SKU}/
    image-001.jpg
    image-002-front.jpg
    image-003-side.jpg
```

**Upload Methods:**

**1. Direct Browser-to-S3 (Preferred):**

**Workflow:**
1. Client requests presigned POST URL from server
2. Server generates presigned URL with S3 SDK
3. Server checks for duplicate (same SKU + filename)
4. Client uploads directly to S3 using presigned URL
5. Client confirms upload completion to server
6. Server updates product record with new image URL

**Advantages:**
- No server bandwidth consumption
- Faster uploads (no relay)
- Scalable for bulk uploads
- Automatic duplicate detection

**Endpoint:** `POST /api/admin/products/:id/presigned-upload-url`

**2. Server Relay (Legacy):**

**Workflow:**
1. Client uploads file to server via multipart/form-data
2. Server receives file in memory buffer
3. Server uploads to S3 using S3 SDK
4. Server updates product record
5. Server returns image URL

**Endpoint:** `POST /api/admin/products/:id/upload-image`

**Kept for backward compatibility and simpler client implementations.**

#### Google Cloud Storage for User Uploads

**Used For:**
- Vibe images (inspiration photos)
- Room photos (existing spaces)
- Floor plans (architectural drawings)

**Organization:**
```
user-uploads/
  {sessionId}/
    vibe-001.jpg
    vibe-002.jpg
    room-photo.jpg
```

#### Image Health Worker

**Purpose:** Ensure all product images are accessible and valid.

**Schedule:** Runs every 6 hours automatically

**Validation Process:**
1. Query all products marked as `repairing`
2. For each product, check all image URLs:
   - Attempt HTTP HEAD request
   - Verify 200 status code
   - Check content-type is image/*
   - Validate URL format
3. Update product status:
   - `healthy` if all images valid
   - `repairing` if some images invalid
   - `removed` if all images invalid
4. Log results and statistics

**Manual Trigger:** Admin can trigger via `POST /api/admin/image-health/validate`

**Status Monitoring:** `GET /api/admin/image-health/status` returns stats:
- Total products checked
- Healthy count
- Repairing count
- Removed count
- Last validation timestamp

---

### API Routes Structure

#### Public Routes (No Authentication Required)

**Homepage & Content:**
- `GET /` - Homepage
- `GET /styles` - Style gallery
- `GET /pricing` - Pricing page
- `GET /about` - About page
- `GET /blog` - Blog listing

**Quiz & Results:**
- `POST /api/quiz/submit` - Submit quiz responses
- `GET /api/renders/:id` - Get render by ID
- `GET /api/renders/session/:sessionId` - Get renders for session

**Shopping:**
- `GET /api/cart/:sessionId` - Get cart items
- `POST /api/cart` - Add item to cart
- `PATCH /api/cart/:id` - Update cart item quantity
- `DELETE /api/cart/:id` - Remove cart item

**Authentication:**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Get current user

#### Authenticated User Routes

**Order Management:**
- `POST /api/orders` - Create order
- `GET /api/orders/:sessionId` - Get user orders

**User Profile:**
- `GET /api/user/profile` - Get profile
- `PATCH /api/user/profile` - Update profile

#### Admin Routes (Requires Admin Role)

**Product Management:**
- `GET /api/admin/products` - List all products
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `PATCH /api/admin/products/:id` - Partial update
- `DELETE /api/admin/products/:id` - Delete product

**Category Management:**
- `GET /api/admin/categories` - List categories
- `POST /api/admin/categories` - Create category
- `DELETE /api/admin/categories/:id` - Delete category

**Supplier Management:**
- `GET /api/admin/suppliers` - List suppliers
- `POST /api/admin/suppliers` - Create supplier
- `DELETE /api/admin/suppliers/:id` - Delete supplier

**Bulk Operations:**
- `POST /api/admin/products/import-csv` - Import products from CSV/Excel
- `POST /api/admin/products/ai-match-folders` - AI folder-to-product matching

**Image Management:**
- `POST /api/admin/products/:id/presigned-upload-url` - Generate S3 upload URL
- `POST /api/admin/products/:id/confirm-upload` - Confirm S3 upload
- `POST /api/admin/products/:id/upload-image` - Legacy image upload
- `PATCH /api/admin/products/:id/image-health/repair` - Mark for repair
- `PATCH /api/admin/products/:id/image-health/remove` - Mark as removed
- `POST /api/admin/image-health/validate` - Manual validation trigger
- `GET /api/admin/image-health/status` - Get validation stats

**AI Training Data:**
- `GET /api/admin/design-examples` - List design examples
- `POST /api/admin/design-examples` - Create design example
- `PATCH /api/admin/design-examples/:id` - Update design example
- `DELETE /api/admin/design-examples/:id` - Delete design example
- Similar endpoints for: product packages, placement guidelines, design rules

**Render Management:**
- `GET /api/admin/renders` - List all renders
- `GET /api/admin/renders/:id` - Get render details
- `GET /api/admin/render-products/:renderId` - Get product snapshots
- `GET /api/admin/render-events/:renderId` - Get lifecycle events
- `GET /api/admin/selection-ledger/:renderId` - Get selection audit trail

**Upload & Analysis Jobs:**
- `POST /api/admin/upload-jobs` - Create upload job
- `GET /api/admin/upload-jobs/:id` - Get job status
- `PATCH /api/admin/upload-jobs/:id` - Update job progress
- Similar endpoints for visual analysis jobs

**Mapping Analysis:**
- `GET /api/admin/mapping-analysis/styles` - Analyze style coverage
- `GET /api/admin/mapping-analysis/palettes` - Analyze palette coverage
- `GET /api/admin/mapping-analysis/rooms` - Analyze room composition
- `GET /api/admin/mapping-analysis/filters` - Analyze filter optimization
- `GET /api/admin/mapping-analysis/comprehensive` - Full analysis report

**User Management:**
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id/role` - Update user role

**S3 Sync:**
- `GET /api/admin/s3/list-folders` - List S3 folders
- `POST /api/admin/s3/sync` - Sync S3 data with database

---

## 🤖 AI INTEGRATION & LOGIC

### Google Gemini 2.5 Flash

**Primary AI Model for Generation**

#### Use Case 1: Room Generation (Text-to-Image)

**Input:**
- Quiz responses (room type, style, colors, features)
- Selected product visual descriptions
- Style and color palette descriptions

**Process:**
1. Build detailed prompt combining all preference data
2. Inject product visual descriptions
3. Add spatial arrangement instructions
4. Send to Gemini 2.5 Flash with image generation config

**Output:** AI-generated room image URL

**Configuration:**
```javascript
{
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
  responseMimeType: "image/jpeg"
}
```

---

#### Use Case 2: Room Generation (Image-to-Image)

**Input:**
- User's room photo or floor plan
- Quiz responses
- Selected products
- Architectural analysis from Gemini Vision

**Process:**
1. Analyze uploaded image with Gemini Vision (separate call)
2. Build structure-preservation prompt with architectural details
3. Include user preferences and product descriptions
4. Send both reference image AND prompt to Gemini 2.5 Flash
5. AI generates redesign maintaining architectural structure

**Output:** Redesigned room image URL

**Special Instructions in Prompt:**
```
CRITICAL STRUCTURE PRESERVATION REQUIREMENT:
- Room dimensions, shape, and proportions must match exactly
- All walls, windows, doors in exact locations
- Preserve viewpoint and perspective
- Only change: furniture, colors, decor
```

---

#### Use Case 3: Vibe Image Analysis

**Input:** User-uploaded inspiration photo

**Process:**
1. Send image to Gemini Vision with structured extraction prompt
2. Request JSON output with specific schema
3. Parse extracted preferences

**Output (Structured JSON):**
```json
{
  "colorPalette": ["warm terracotta #E07A5F", "soft sage #84A98C", ...],
  "materials": ["natural oak wood", "linen fabric", "brushed brass"],
  "textures": ["smooth matte", "woven fabric", "natural grain"],
  "lightingTone": "warm",
  "density": "moderate",
  "overallVibe": "This space embodies organic warmth..."
}
```

**Schema Configuration:**
```javascript
responseSchema: {
  type: "object",
  properties: {
    colorPalette: { type: "array", items: { type: "string" } },
    materials: { type: "array", items: { type: "string" } },
    textures: { type: "array", items: { type: "string" } },
    lightingTone: { type: "string", enum: ["warm", "cool", "natural", "dramatic"] },
    density: { type: "string", enum: ["minimal", "moderate", "layered"] },
    overallVibe: { type: "string" }
  }
}
```

---

#### Use Case 4: AI Folder Matching

**Input:**
- Array of folder names from bulk upload
- Array of product objects (id, name, sku)

**Process:**
1. Send folder names and product list to Gemini
2. Request semantic matching based on names
3. AI analyzes naming patterns and suggests matches

**Output:**
```json
{
  "matches": [
    { "folderName": "sofa-modern-gray", "productId": "abc123", "confidence": 0.95 },
    { "folderName": "table-oak-round", "productId": "def456", "confidence": 0.88 }
  ]
}
```

**Used For:** Bulk image upload where folder structure indicates product names.

---

### Google Gemini Vision

**Specialized AI for Image Analysis**

#### Use Case 1: Product Visual Analysis

**Input:** Product image URL(s)

**Detailed Extraction Prompt:**
```
You are an expert furniture designer analyzing this product image for exact 
reproduction in AI-generated interior designs. Provide an extremely detailed 
visual description that would allow an AI image generator to recreate this 
furniture piece with precision.

CRITICAL REQUIREMENTS:
- Use SPECIFIC measurements when visible
- Include EXACT color names and HEX codes
- Describe textures with tactile precision
- Note exact geometric shapes
- Specify material types precisely

ANALYSIS FRAMEWORK:
1. Overall Form & Silhouette
2. Structural Components
3. Materials & Surfaces
4. Color Palette (with HEX codes)
5. Proportional Measurements
6. Distinctive Design Features

OUTPUT: Single flowing paragraph (300-400 words)
```

**Output:** Stored in `visualDescriptionGemini` field

**Example:**
```
This mid-century modern accent chair features a gently curved, sculptural 
silhouette in warm ivory boucle fabric (approximately SW 9109 Natural Linen). 
The frame showcases solid white oak construction with natural matte finish. 
Four tapered legs angle at 8 degrees from vertical, each 1.5" diameter. 
Seat cushion has medium-firm density with subtle tufting. Curved backrest 
provides lumbar support at 110-degree recline. Boucle upholstery features 
tight loop construction with 2mm pile height. Exposed wood armrests with 
waterfall edge treatment. Contrast piping in natural linen. Hand-stitched 
corner detailing. Dimensions: 28"W × 32"D × 31"H, seat height 18"...
```

---

#### Use Case 2: Room Image Analysis

**Input:** User's existing room photo

**Extraction Prompt:**
```
Analyze this room image and extract:

1. CURRENT FURNITURE: List all visible pieces and condition
2. COLORS: Dominant colors in walls, furniture, decor
3. WALL PAINT: Specific color names (e.g., "soft dove gray"), finish type
4. WALL PATTERNS: Wallpaper, painted patterns, or plain
5. DESIGN STYLE: Current aesthetic
6. LAYOUT: Room arrangement and traffic flow
7. LIGHTING: Natural and artificial sources
8. ARCHITECTURAL FEATURES:
   - Windows: size, placement, type
   - Doors: location, swing direction
   - Ceiling: height, details
   - Built-ins: shelving, alcoves, fireplaces
   - Moldings and trim

OUTPUT: Structured JSON
```

**Output:**
```json
{
  "currentFurniture": ["Gray sectional sofa (good condition)", "Glass coffee table"],
  "dominantColors": ["Soft white walls", "Gray upholstery", "Natural wood flooring"],
  "wallPaint": {
    "color": "Soft dove gray with cool undertones",
    "finish": "Matte"
  },
  "wallPatterns": "Plain painted, no wallpaper",
  "currentStyle": "Contemporary minimalist",
  "layoutNotes": "Open concept, good traffic flow around furniture",
  "lighting": {
    "natural": "Large window on west wall provides afternoon light",
    "artificial": "Recessed ceiling lights, floor lamp by sofa"
  },
  "architecturalFeatures": {
    "windows": [{
      "location": "West wall",
      "size": "6ft wide × 8ft tall",
      "type": "Double-hung"
    }],
    "doors": [{
      "location": "North wall",
      "swing": "Inward",
      "type": "Standard single door"
    }],
    "ceiling": {
      "height": "9 feet",
      "details": "Crown molding, recessed lighting"
    },
    "builtIns": []
  }
}
```

**Used For:** Structure-preserving image-to-image generation.

---

#### Use Case 3: Floor Plan Analysis

**Input:** User's floor plan drawing

**Extraction Prompt:**
```
Analyze this architectural floor plan and extract:

1. ROOM DIMENSIONS: Width, length, ceiling height (if noted)
2. WINDOW LOCATIONS: Exact placement on walls
3. DOOR LOCATIONS: Position and swing direction
4. BUILT-IN FEATURES: Closets, fireplaces, alcoves, built-in shelving
5. CEILING/ROOF DESIGN: Vaulted, tray, standard flat
6. LAYOUT NOTES: Spatial constraints, unusual features

OUTPUT: Structured JSON
```

**Output:**
```json
{
  "roomDimensions": "15ft wide × 20ft long × 9ft ceiling height",
  "windowLocations": [
    "North wall: two 3ft × 5ft windows, centered, 6ft spacing",
    "East wall: one 4ft × 6ft window, right side"
  ],
  "doorLocations": [
    "South wall: entry door, left side, swings inward",
    "West wall: closet door, sliding"
  ],
  "builtInFeatures": ["Walk-in closet (6ft × 4ft) on west wall"],
  "ceilingRoofDesign": "Standard flat ceiling with crown molding",
  "layoutNotes": "Rectangular room, good natural light from north and east"
}
```

**Used For:** Creating accurate spatial constraints for AI generation.

---

### OpenAI GPT-5 Vision

**Alternative Product Analysis System**

#### Use Case: Product Visual Analysis

**Same process as Gemini Vision**, providing redundant/comparative analysis.

**Prompt:** Identical to Gemini Vision prompt for consistency.

**Output:** Stored in `visualDescriptionOpenAI` field

**Advantages:**
- Provides alternative perspective
- Redundancy if Gemini fails
- Comparison for quality assurance
- Different AI models may catch different details

**Priority System:**
1. If both Gemini and OpenAI descriptions exist, prioritize Gemini
2. Use OpenAI as fallback if Gemini failed
3. Compare both for quality validation

---

### Prompt Engineering Strategies

#### 1. Style Descriptions

Each style has a detailed paragraph injected into prompts:

**Organic Modern:**
```
"Organic Modern aesthetic featuring curved sculptural furniture with soft edges, 
natural materials like white oak and travertine, plush boucle and linen textiles, 
earthy neutral color palette (warm whites, bone, soft beige with terracotta accents), 
low-profile furniture silhouettes, minimalist forms with organic warmth"
```

**Midcentury Scandi:**
```
"Mid-century Scandinavian design with clean-lined teak and walnut furniture, 
tapered legs at gentle angles, warm wood tones, functional minimalism, 
retro color accents (mustard, burnt orange, teal), geometric patterns, 
emphasis on natural light and open space"
```

---

#### 2. Color Palette Descriptions

**Dark & Moody:**
```
"Sophisticated dark palette with deep charcoal, espresso brown, midnight navy, 
forest green, or black accents balanced by warm metallic touches (brass, gold, 
aged copper) and strategic lighting for dramatic elegance"
```

**Warm & Cozy:**
```
"Warm inviting color scheme featuring rich caramels, warm taupes, soft terracotta, 
honey tones, and creamy whites with wood undertones creating comfort and intimacy"
```

---

#### 3. Product Integration

Products are integrated into prompts with their visual descriptions:

```
Include these specific products in the design:

1. SOFA: [Product Name]
   Visual Description: [Full 400-word Gemini Vision description]
   Placement: Primary seating along north wall, facing coffee table

2. COFFEE TABLE: [Product Name]
   Visual Description: [Full description]
   Placement: Centered in front of sofa, 18 inches clearance

3. RUG: [Product Name]
   Visual Description: [Full description]
   Placement: Anchoring seating area, extending 12 inches beyond furniture edges
```

---

#### 4. Zone-Based Placement Matrix

For complex layouts, generates spatial instructions:

```
PLACEMENT MATRIX:

Zone 1 (Primary Seating):
- Sofa: North wall, centered
- Coffee Table: 18" in front of sofa
- Side Table: Adjacent to sofa right arm

Zone 2 (Accent Seating):
- Accent Chair: East corner, angled toward sofa
- Floor Lamp: Behind accent chair, left side

Zone 3 (Decorative):
- Rug: Anchoring entire seating area
- Wall Art: Above sofa, centered
```

---

#### 5. Structure Preservation (Image-to-Image)

```
CRITICAL STRUCTURE PRESERVATION:

ARCHITECTURAL ANALYSIS:
- Room: 15ft × 20ft × 9ft ceiling
- Windows: Two on north wall (3ft × 5ft each), one on east wall (4ft × 6ft)
- Doors: Entry on south wall (left side, inward swing), closet on west wall (sliding)
- Built-ins: Walk-in closet (6ft × 4ft) west wall
- Current paint: Soft dove gray, matte finish

MANDATORY PRESERVATION:
- Exact room dimensions and shape
- All window and door positions
- Ceiling height and molding
- Built-in closet structure
- Original viewpoint and perspective

ALLOWED CHANGES:
- Furniture style and arrangement
- Wall paint color (current: gray → new: warm white)
- Decorative elements
- Soft furnishings
- Lighting fixtures
```

---

### AI Generation Workflow

**Complete End-to-End Process:**

1. **User Completes Quiz** → Quiz data saved to `quizResponses` table

2. **Product Selection Algorithm Runs:**
   - Filter products by room type, style, features
   - Calculate multi-factor scores
   - Apply fallback logic if needed
   - Select 6-10 products with category diversity

3. **Visual Description Retrieval:**
   - For each selected product, get best visual description
   - Priority: Front View → Gemini → OpenAI → Legacy

4. **Vibe Image Analysis** (if uploaded):
   - Send each vibe image to Gemini Vision
   - Extract color palette, materials, textures
   - Store in quiz response for scoring

5. **Room Image Analysis** (if uploaded):
   - Send room photo to Gemini Vision
   - Extract architectural features and current state
   - Build structure-preservation instructions

6. **Prompt Construction:**
   - Combine room type description
   - Add style descriptions (up to 2 styles)
   - Add color palette descriptions (up to 2)
   - Add functional feature instructions
   - Inject product visual descriptions
   - Add placement instructions (zone-based matrix)
   - Add structure preservation (if image-to-image)

7. **AI Generation:**
   - **Text-to-Image**: Send prompt to Gemini 2.5 Flash
   - **Image-to-Image**: Send prompt + room image to Gemini 2.5 Flash

8. **Post-Processing:**
   - Receive generated image URL
   - Create render record in database
   - Create product snapshots
   - Log lifecycle event (created)
   - Create selection ledger entry

9. **User Redirect:**
   - Loading page polls for status
   - Once status = 'completed', redirect to results page
   - Display generated design with product sidebar

---

### Hybrid Image Compositing (MVP Status)

**Current Implementation:**

Uses Sharp library for basic compositing of product images onto generated room.

**Process:**
1. Download generated room image
2. Download selected product images
3. Apply simple grid placement
4. Composite products onto room using Sharp

**⚠️ Current Limitations:**

1. **Background Issue**: Products are JPEGs with backgrounds, not transparent PNGs
   - Result: Visible white/colored backgrounds around products
   - Looks unprofessional

2. **No Scene Analysis**: Simple grid placement without understanding room layout
   - Doesn't respect perspective
   - Doesn't avoid overlaps

3. **No Perspective Matching**: Products inserted at original size/angle
   - Doesn't match room viewpoint
   - Looks flat and unrealistic

4. **Shadows Disabled**: Can't generate realistic shadows due to background issues

**Planned V2 Improvements:**

1. **Background Removal API Integration**
   - Use remove.bg or similar service
   - Create transparent PNGs for all products
   - Clean compositing

2. **Scene-Aware Placement**
   - Use Gemini Vision to analyze generated room
   - Identify surfaces (floors, walls, tables)
   - Place products on appropriate surfaces

3. **Perspective-Matched Scaling**
   - Calculate perspective transformation
   - Scale and rotate products to match room angle
   - Realistic depth perception

4. **Realistic Shadow Generation**
   - Analyze room lighting
   - Generate appropriate shadows under products
   - Composite shadows separately

---

## ⚠️ CURRENT ISSUES & LIMITATIONS

### 1. INCOMPLETE FEATURES

#### Order Management System
**Status:** Coming Soon  
**Location:** `client/src/pages/admin/orders.tsx`

**Current State:**
- Admin page displays "Order management coming soon" message
- No UI for viewing orders
- No status update workflow
- No customer notifications

**Impact:**
- Admins cannot track or fulfill orders
- Customers don't receive order confirmations
- Manual order processing required

**Required Implementation:**
- Order listing with filters (status, date range)
- Order detail view with line items
- Status update workflow (pending → paid → fulfilled → shipped → delivered)
- Email notifications for status changes
- Stripe webhook integration for payment confirmation

---

#### Analytics Dashboard
**Status:** Hardcoded Placeholders  
**Location:** `client/src/pages/admin/analytics.tsx`

**Current State:**
- Displays hardcoded zeros for all metrics:
  - Total Orders: 0
  - Revenue: $0
  - Products Sold: 0
- No actual data fetching
- No charts or trends

**Impact:**
- No business insights
- Cannot track platform performance
- No data-driven decision making

**Required Implementation:**
- SQL aggregation queries for metrics
- Date range filters
- Trend charts (orders over time, revenue growth)
- Conversion rate tracking
- User registration trends
- Popular products/styles

---

#### Budget Enforcement
**Status:** Collected but Not Used  
**Location:** Product selection algorithm in `server/services/gemini-ai.ts`

**Current State:**
```javascript
// Budget NOT enforced (line 456)
// Rationale: Prioritizing render quality over budget constraints
```

**Impact:**
- Selected products may exceed user's budget
- User expectations not managed
- Potential for cart abandonment

**Design Decision:** Intentionally disabled to ensure high-quality renders with best-match products.

**Options:**
1. **Enable strict budget filtering** - Only select products within budget
2. **Enable flexible budget** - Prefer within budget but allow slight overflow
3. **Keep disabled** - Communicate "inspiration design" rather than "budget design"

---

### 2. DATA QUALITY ISSUES

#### Product Catalog Coverage Gaps

**Identified by Mapping Analysis:**

1. **Low Color Palette Coverage:**
   - Some palettes have <20% product coverage
   - Example: "Artful Contrast" has only 15 products across all room types
   - Results in poor product variety for these selections

2. **Missing Essential Items:**
   - Some room types lack essential furniture
   - Example: "Dining Room" missing 2 essential dining chairs
   - Example: "Home Office" only has 1 desk option
   - Limits design quality

3. **Weak Style Coverage:**
   - Style + RoomType combinations with <5 products
   - Example: "Contemporary Luxe" × "Nursery" has 0 products
   - Falls back to generic selections

4. **Unbalanced Categories:**
   - Too many accent chairs, not enough sofas
   - Limited storage options
   - Few budget-friendly options in some categories

**Impact:**
- AI falls back to generic product selections
- Design quality degrades
- User preferences not accurately matched

**Recommendations:**
- Prioritize adding products for low-coverage combinations
- Balance essential vs. accent categories
- Expand supplier relationships for missing styles

---

#### Image Health Issues

**Current Problems:**
- Some products have broken/invalid image URLs
- Placeholder images not detected during import
- S3 sync issues causing missing images
- Legacy URLs from previous suppliers

**Image Health Worker Detects:**
- HTTP errors (404, 403, 500)
- Invalid content types
- Placeholder image patterns
- Unreachable URLs

**Manual Fixing Required:**
- Admin must review flagged products
- Replace broken URLs manually
- Re-upload missing images
- Update product records

**Improvement Opportunities:**
- Auto-retry failed URLs
- Suggest replacement images from S3
- Automated S3 sync repair
- Better validation during CSV import

---

### 3. AI SYSTEM LIMITATIONS

#### Compositing System (MVP)

**Current Issues:**

1. **Visible Backgrounds:**
```
Problem: Products have white/colored backgrounds
Cause: Using JPEG images instead of transparent PNGs
Result: Unprofessional-looking composites
```

2. **Poor Placement:**
```
Problem: Products placed on simple grid
Cause: No scene analysis or spatial understanding
Result: Products may overlap or float unrealistically
```

3. **No Perspective:**
```
Problem: Products inserted at original size/angle
Cause: No perspective transformation applied
Result: Flat, unrealistic appearance
```

4. **No Shadows:**
```
Problem: Products lack shadows
Cause: Disabled due to background issues
Result: Products don't appear grounded
```

**Impact:**
- Composite renders look unprofessional
- Users may prefer pure AI-generated designs
- Feature underutilized

**Planned Fix:** See "Hybrid Compositing V2" in Fine-Tuning Plan

---

#### Product Selection Fallbacks

**Fallback Chain:**

1. **Strict Filtering:** Room type + style + features → 5+ products
2. **Fallback 1:** Room type + style (relax features) → 5+ products
3. **Fallback 2:** Room type only (relax style) → 5+ products
4. **Final Fallback:** ANY in-stock product with valid images

**Issue:** Final fallback may select completely unrelated products.

**Example Failure Scenario:**
```
User selects:
- Room: Nursery
- Style: Organic Modern
- Features: Storage Solutions, Child-Friendly

Catalog has:
- 0 products matching Nursery + Organic Modern
- 2 products matching Nursery only
- Falls back to ANY 6 in-stock products

Result: 
- Nursery design shows dining chairs and office desks
- Completely wrong aesthetic
```

**Mitigation:**
- Better error messaging to admin
- Log fallback occurrences for catalog planning
- Show "limited product availability" warning to user

---

#### AI Generation Failures

**Possible Failure Points:**

1. **Gemini API Rate Limits:**
   - Exceeding quota during high traffic
   - No retry logic currently
   - User sees "generation failed" error

2. **Invalid Prompts:**
   - Extremely long prompts may exceed token limits
   - Unusual style combinations confuse AI
   - Rare: happens with edge-case quiz responses

3. **Image Processing Errors:**
   - Room image too large to process
   - Corrupted upload
   - Unsupported image format

**Current Handling:**
- Render marked as `status: 'failed'`
- Error message stored in database
- User sees generic error screen
- No automatic retry

**Improvement Opportunities:**
- Implement retry logic with exponential backoff
- Better error messages to user
- Fallback to text-to-image if image-to-image fails
- Queue system for high traffic

---

### 4. PERFORMANCE CONSIDERATIONS

#### AI Generation Time

**Observed Timings:**
- Text-to-Image: 10-30 seconds average
- Image-to-Image: 15-45 seconds average (includes vision analysis)
- Vibe image analysis: 3-5 seconds per image

**User Experience:**
- Loading page polls every 2 seconds
- No progress indication beyond "Generating..."
- User doesn't know how long to wait
- May abandon if > 60 seconds

**Improvement Opportunities:**
- WebSocket-based real-time progress updates
- Show generation stages ("Analyzing room... Selecting products... Generating design...")
- Estimated time remaining
- Preview of selected products while waiting

---

#### Image Upload Performance

**Direct S3 Upload:** Fast (~2-5 seconds for typical image)

**Server Relay:** Slower (~5-15 seconds) due to:
1. Upload to server
2. Server download to memory
3. Server upload to S3
4. Response to client

**Recommendation:** Deprecate server relay method, use direct S3 exclusively.

---

#### Database Query Performance

**Potential Bottlenecks:**

1. **Product Listing:** No pagination currently
   - Loads ALL products at once in admin
   - Slow with >1000 products

2. **Render Listing:** No filtering/pagination
   - Could be slow with thousands of renders

3. **No Indexes:** Some foreign keys lack indexes
   - Join queries may be slow

**Recommendations:**
- Add pagination to admin product listing
- Add database indexes on frequently queried fields
- Implement lazy loading for images

---

### 5. TYPESCRIPT / CODE QUALITY

#### LSP Diagnostics

**Location:** `server/routes-curalina.ts`  
**Count:** 5 TypeScript errors

**Likely Issues:**
- Type mismatches in route handlers
- Missing type imports
- Incorrect parameter types
- Unsafe `any` type usage

**Impact:**
- Potential runtime errors
- Reduced code maintainability
- IDE warnings

**Fix Required:**
- Review and fix all 5 diagnostics
- Add proper TypeScript types
- Remove `any` types where possible

---

### 6. USER EXPERIENCE ISSUES

#### No Design History

**Problem:** Users can generate designs but cannot view previous designs.

**Impact:**
- Users may lose track of favorite designs
- Cannot compare multiple variations
- Frustrating UX for indecisive users

**Solution:** Implement saved designs feature in user portal.

---

#### No Product Favorites

**Problem:** No way to save favorite products without adding to cart.

**Impact:**
- Users must add to cart to "save" products
- Cannot create wishlist
- May lose track of products they liked

**Solution:** Add favorites/wishlist feature.

---

#### Limited Product Swap Options

**Problem:** Product swap shows limited alternatives (typically 3-5).

**Impact:**
- User may not find perfect replacement
- Limited exploration

**Solution:** 
- Show more alternatives (10-15)
- Add filters (price range, style)
- AI-powered "similar products" suggestions

---

## 🔧 FIX RECOMMENDATIONS

### HIGH PRIORITY FIXES

#### 1. Complete Order Management System

**Status:** Coming Soon → **MUST IMPLEMENT**  
**Priority:** HIGH  
**Estimated Effort:** 3-5 days  
**Impact:** Critical for e-commerce functionality

**Implementation Scope:**

1. **Admin Order Listing:**
   - Table view with columns: Order ID, Date, Customer, Total, Status
   - Filter by status (pending, paid, fulfilled, shipped, delivered)
   - Filter by date range
   - Search by customer email or order ID
   - Pagination (20 orders per page)

2. **Order Detail View:**
   - Customer information (name, email, shipping address)
   - Line items with product details, quantity, price at purchase
   - Order timeline (created, paid, fulfilled, shipped, delivered)
   - Subtotal, shipping, tax, total
   - Payment information (Stripe payment intent ID)

3. **Status Update Workflow:**
   - Dropdown to change order status
   - Confirmation modal for status changes
   - Automatic email notifications on status change
   - Tracking number input for "shipped" status

4. **Email Notifications:**
   - Order confirmation (when created)
   - Payment confirmation (when paid)
   - Fulfillment notification (when fulfilled)
   - Shipping notification with tracking (when shipped)
   - Delivery confirmation (when delivered)

5. **Stripe Webhook Integration:**
   - Listen for `payment_intent.succeeded`
   - Automatically update order status to "paid"
   - Record payment details

**Files to Create/Modify:**
- `client/src/pages/admin/orders.tsx` - Complete rebuild
- `server/routes-curalina.ts` - Add order management endpoints
- Email templates for notifications

---

#### 2. Implement Analytics Dashboard

**Status:** Hardcoded Zeros → **FUNCTIONAL ANALYTICS**  
**Priority:** HIGH  
**Estimated Effort:** 2-3 days  
**Impact:** Critical for business insights

**Implementation Scope:**

1. **Real-Time Metrics:**
```sql
-- Total Orders
SELECT COUNT(*) FROM orders WHERE status != 'pending';

-- Total Revenue
SELECT SUM(total_amount) FROM orders WHERE status IN ('paid', 'fulfilled', 'shipped', 'delivered');

-- Products Sold
SELECT SUM(quantity) FROM order_items 
JOIN orders ON order_items.order_id = orders.id 
WHERE orders.status != 'pending';

-- Average Order Value
SELECT AVG(total_amount) FROM orders WHERE status != 'pending';
```

2. **Trend Charts:**
   - Orders per day (last 30 days)
   - Revenue per day (last 30 days)
   - User registrations per day
   - Quiz completions per day

3. **Top Performers:**
   - Top 10 best-selling products
   - Most popular styles
   - Most popular room types
   - Highest-revenue orders

4. **Conversion Metrics:**
   - Quiz completion rate (started / completed)
   - Design-to-cart rate (generated / added to cart)
   - Cart-to-purchase rate (cart items / orders)

5. **User Growth:**
   - Total registered users
   - Active users (30-day)
   - New users this month

**Libraries to Use:**
- Recharts for charts (already installed)
- Date range picker for filtering

**Files to Modify:**
- `client/src/pages/admin/analytics.tsx`
- `server/routes-curalina.ts` - Add analytics endpoints

---

#### 3. Fix TypeScript LSP Errors

**Status:** 5 Diagnostics in `routes-curalina.ts`  
**Priority:** MEDIUM-HIGH  
**Estimated Effort:** 1-2 hours  
**Impact:** Code quality and maintainability

**Process:**
1. Run `get_latest_lsp_diagnostics` to see exact errors
2. Fix type mismatches
3. Add proper type annotations
4. Remove `any` types where possible
5. Ensure all imports are correct

**Expected Issues:**
- Request/Response types in Express
- Zod schema validation results
- Database query results
- File upload types (multer)

---

### MEDIUM PRIORITY FIXES

#### 4. Enhance Image Compositing System

**Status:** MVP → **V2 WITH BACKGROUND REMOVAL**  
**Priority:** MEDIUM  
**Estimated Effort:** 1-2 weeks  
**Impact:** Significantly improves visual quality

**Phase 1: Background Removal (Week 1)**

1. **Integrate Background Removal API:**
   - Options: remove.bg, Cloudinary AI, Adobe Firefly
   - Process all product images on upload
   - Store transparent PNGs alongside originals

2. **Update Upload Workflow:**
```javascript
// After S3 upload
1. Download image from S3
2. Send to background removal API
3. Receive transparent PNG
4. Upload transparent version to S3
5. Update product record with both URLs
```

3. **Batch Processing:**
   - Admin tool to process existing products
   - Queue-based processing for large batches
   - Progress tracking

**Phase 2: Scene-Aware Placement (Week 2)**

1. **Gemini Vision Scene Analysis:**
```javascript
// Analyze generated room image
const sceneAnalysis = await analyzeRoomScene(generatedImage);
// Returns:
{
  surfaces: [
    { type: 'floor', bounds: {...}, perspective: {...} },
    { type: 'wall', bounds: {...} },
    { type: 'table', bounds: {...} }
  ],
  lighting: { direction: 'top-left', intensity: 'bright' }
}
```

2. **Intelligent Placement:**
   - Match product category to appropriate surface
   - Respect perspective angles
   - Avoid overlaps
   - Follow spatial logic (chairs near tables, lamps on tables)

3. **Perspective Transformation:**
   - Calculate vanishing points
   - Apply perspective to product images
   - Scale based on depth

**Phase 3: Shadow Generation (Concurrent with Phase 2)**

1. **Analyze Room Lighting:**
   - Extract light direction from generated image
   - Determine shadow angle and length

2. **Generate Shadows:**
   - Create shadow layer for each product
   - Apply blur and transparency
   - Composite below product layer

**Testing:**
- Compare V1 vs. V2 renders
- User testing for quality perception
- A/B test to measure impact on conversions

---

#### 5. Implement Budget Enforcement (Configurable)

**Status:** Disabled → **OPTIONAL ENFORCEMENT**  
**Priority:** MEDIUM  
**Estimated Effort:** 1-2 days  
**Impact:** Better expectation management

**Implementation:**

1. **Add Admin Configuration:**
```javascript
// In admin settings
budgetEnforcement: {
  enabled: boolean,
  mode: 'strict' | 'flexible' | 'disabled',
  allowance: number // % over budget allowed in 'flexible' mode
}
```

2. **Update Product Selection:**
```javascript
if (budgetEnforcement.enabled) {
  // Calculate total price of selected products
  const totalPrice = selectedProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);
  
  if (budgetEnforcement.mode === 'strict') {
    // Only select if within budget
    if (totalPrice > maxBudget) {
      // Remove highest-priced products until within budget
    }
  } else if (budgetEnforcement.mode === 'flexible') {
    // Allow up to X% over budget
    const maxAllowed = maxBudget * (1 + budgetEnforcement.allowance / 100);
    if (totalPrice > maxAllowed) {
      // Reduce to allowance threshold
    }
  }
}
```

3. **Communicate to User:**
   - Show total design cost on results page
   - If over budget: "This design is $X over your budget"
   - Suggest: "View budget-friendly alternatives"

4. **Budget-Friendly Alternatives:**
   - Button to regenerate with strict budget
   - Swap individual items for cheaper alternatives
   - Filter product swaps by price range

---

#### 6. Improve Product Catalog Coverage

**Status:** Gaps Identified → **SYSTEMATIC EXPANSION**  
**Priority:** MEDIUM  
**Estimated Effort:** Ongoing (2-4 weeks initial push)  
**Impact:** Better AI generation quality

**Strategy:**

1. **Use Mapping Analysis Reports:**
   - Run comprehensive mapping analysis
   - Prioritize based on user demand (quiz submission data)
   - Focus on combinations with >10 quiz submissions but <5 products

2. **Priority Acquisitions:**

**Week 1-2:**
- Add 20+ "Artful Contrast" products (currently 15)
- Add 10+ Nursery products for underrepresented styles
- Add 15+ Dining Chairs (currently only 5)

**Week 3-4:**
- Fill missing room × style combinations
- Add budget-friendly options ($500-$1,500 range)
- Add storage furniture (currently limited)

3. **Supplier Relationships:**
   - Identify 2-3 new suppliers specializing in gaps
   - Negotiate product data feeds
   - Automate CSV import from feeds

4. **Quality Control:**
   - Every new product requires front-view image
   - AI visual analysis before import
   - Manual review of visual descriptions

5. **Tracking:**
   - Dashboard showing coverage % per combination
   - Target: 80% coverage across all quiz combinations
   - Alert when coverage drops below threshold

---

### LOW PRIORITY ENHANCEMENTS

#### 7. Add Real-Time Progress Indicators

**Status:** Basic Polling → **WEBSOCKET PROGRESS**  
**Priority:** LOW  
**Estimated Effort:** 2-3 days  
**Impact:** Better UX during generation

**Implementation:**

1. **WebSocket Setup:**
```javascript
// Server: Emit progress events
io.to(sessionId).emit('generation:progress', {
  stage: 'Analyzing room image...',
  progress: 25
});

// Client: Listen for events
socket.on('generation:progress', (data) => {
  setProgress(data);
});
```

2. **Progress Stages:**
   - "Analyzing room image..." (0-20%)
   - "Selecting perfect products..." (20-40%)
   - "Building your design..." (40-80%)
   - "Adding final touches..." (80-95%)
   - "Complete!" (100%)

3. **Estimated Time:**
   - Calculate based on mode (text vs. image)
   - Show countdown timer
   - "Approximately 25 seconds remaining..."

---

#### 8. Automate Image Health Repairs

**Status:** Manual Fixing → **AUTOMATED REPAIR**  
**Priority:** LOW  
**Estimated Effort:** 3-4 days  
**Impact:** Reduces admin workload

**Implementation:**

1. **Auto-Retry Logic:**
```javascript
// If image fails validation
if (imageHealth.status === 'failed') {
  // Retry up to 3 times with exponential backoff
  await retryImageValidation(productId, retryCount);
}
```

2. **S3 Sync Repair:**
```javascript
// If image exists in S3 but not in database
const s3Images = await listS3Images(product.sku);
const dbImages = product.images || [];

const missingInDb = s3Images.filter(img => !dbImages.includes(img));
if (missingInDb.length > 0) {
  // Auto-update product record
  await updateProduct(productId, {
    images: [...dbImages, ...missingInDb]
  });
}
```

3. **Suggested Replacements:**
```javascript
// If image permanently broken
// Search S3 for similar product images based on SKU pattern
const suggestions = await findSimilarImages(product.sku);
// Present to admin for approval
```

---

## 📈 FINE-TUNING PLAN

### PHASE 1: STABILITY & COMPLETION (2-3 weeks)

**Goal:** Complete all critical features for production readiness

#### Week 1-2: Core E-commerce

**Tasks:**
1. ✅ Complete order management system
   - Admin order listing with filters
   - Order detail view
   - Status update workflow
   - Email notification templates
   - Stripe webhook integration

2. ✅ Implement analytics dashboard
   - Real-time metrics (orders, revenue, products sold)
   - Trend charts (30-day)
   - Top performers (products, styles, rooms)
   - Conversion metrics

3. ✅ Fix TypeScript LSP errors
   - Review all 5 diagnostics
   - Add proper types
   - Remove `any` types
   - Ensure type safety

**Deliverable:** Fully functional e-commerce platform with order tracking and business analytics.

---

#### Week 3: Data Quality & Error Handling

**Tasks:**
1. ✅ Implement comprehensive error handling
   - AI generation failures with retry logic
   - Database error recovery
   - Image upload error messages
   - User-friendly error screens

2. ✅ Add budget enforcement (configurable)
   - Admin setting to enable/disable
   - Strict vs. flexible modes
   - Budget communication on results page
   - Alternative product suggestions

3. ✅ Improve product catalog based on mapping analysis
   - Add 50+ products for low-coverage combinations
   - Focus on high-demand gaps
   - Ensure quality visual descriptions

**Deliverable:** Stable platform with excellent error handling and better product coverage.

---

### PHASE 2: AI ENHANCEMENT (3-4 weeks)

**Goal:** Improve AI generation quality and visual output

#### Week 4-5: Compositing System V2

**Tasks:**
1. ✅ Integrate background removal API
   - Select provider (remove.bg, Cloudinary, Adobe)
   - Implement upload workflow integration
   - Process existing products in batches
   - Store transparent PNGs

2. ✅ Implement scene-aware placement
   - Gemini Vision scene analysis
   - Surface detection (floors, walls, tables)
   - Intelligent product placement logic
   - Perspective-aware positioning

3. ✅ Add realistic shadow generation
   - Analyze room lighting direction
   - Generate dynamic shadows
   - Composite with proper blending

**Deliverable:** Professional-quality composite renders with transparent products, intelligent placement, and realistic shadows.

---

#### Week 6-7: Prompt & Selection Optimization

**Tasks:**
1. ✅ Fine-tune Gemini prompts for better style accuracy
   - A/B test prompt variations
   - Refine style descriptions based on output quality
   - Optimize product visual description integration
   - Test different placement instruction formats

2. ✅ Expand visual description quality
   - Analyze current descriptions for weaknesses
   - Re-process low-quality descriptions
   - Add multi-angle analysis for complex products
   - Validate color accuracy with HEX codes

3. ✅ Implement A/B testing framework
   - Track which prompt variations perform best
   - Measure user satisfaction with different approaches
   - Optimize based on data

4. ✅ Add intelligent product swap suggestions
   - Use AI to suggest "similar" products
   - Semantic matching based on visual descriptions
   - Style-consistent replacements

**Deliverable:** Higher quality AI-generated designs with more accurate style representation and better product matching.

---

### PHASE 3: USER EXPERIENCE (2-3 weeks)

**Goal:** Enhance user engagement and satisfaction

#### Week 8-9: User Features

**Tasks:**
1. ✅ Add saved designs feature
   - "Save Design" button on results page
   - User portal: view saved designs
   - Thumbnail gallery
   - Delete/rename saved designs

2. ✅ Implement design history
   - Automatic saving of all generated designs
   - Chronological list in user portal
   - Quick regeneration from history
   - Compare multiple designs side-by-side

3. ✅ Add "Favorite Products" functionality
   - Heart icon on product cards
   - User portal: favorites list
   - Add to cart from favorites
   - Share favorites via link

4. ✅ Email notifications for order updates
   - Order confirmation
   - Payment received
   - Order fulfilled
   - Shipped with tracking
   - Delivered confirmation

**Deliverable:** Engaging user portal with design management and product favorites.

---

#### Week 10: Performance & UX

**Tasks:**
1. ✅ Mobile responsiveness optimization
   - Test all pages on mobile devices
   - Optimize quiz flow for touch
   - Responsive product cards
   - Mobile-optimized results page

2. ✅ Performance optimization
   - Implement lazy loading for images
   - Add pagination to admin product listing
   - Optimize database queries with indexes
   - CDN integration for static assets

3. ✅ SEO improvements
   - Meta tags for all pages
   - Open Graph tags for sharing
   - Structured data for products
   - XML sitemap generation

**Deliverable:** Fast, mobile-friendly platform with excellent SEO.

---

### PHASE 4: ADVANCED FEATURES (4+ weeks)

**Goal:** Differentiate with unique capabilities

#### Future Enhancements (Prioritize based on user feedback)

**Multi-Room Design Packages:**
- Generate coordinated designs for multiple rooms
- Consistent style across entire home
- Bundle pricing discounts

**3D Room Visualization:**
- Interactive 3D model of designed room
- Walk-through experience
- Adjust camera angle and lighting
- VR compatibility

**AR Product Preview:**
- Use device camera to preview products in actual space
- Measure compatibility with room dimensions
- Try before you buy

**Social Features:**
- Share designs on social media
- Public design gallery
- Community voting/likes
- Featured designer of the week

**Designer Collaboration:**
- Allow professional designers to create for users
- Designer marketplace
- Commission-based model
- User can request custom designs

**Subscription Plans:**
- Unlimited designs per month
- Priority AI generation
- Exclusive product access
- Design consultation credits

**Expanded Supplier Integration:**
- Real-time inventory sync
- Automated product updates
- Price synchronization
- Drop-shipping integration

---

### CONTINUOUS IMPROVEMENTS

**Ongoing Activities:**

#### Monitoring & Analytics

**Weekly:**
- Review AI generation success/failure rates
- Monitor product selection quality (user feedback)
- Analyze quiz completion rates
- Track conversion funnel (quiz → purchase)

**Monthly:**
- Comprehensive mapping analysis
- Catalog coverage assessment
- Performance metrics review
- User satisfaction surveys

**Quarterly:**
- Platform roadmap review
- Major feature planning
- Supplier relationship evaluation
- Pricing strategy assessment

---

#### Data Quality

**Weekly:**
- Image health validation runs
- New product quality review
- Visual description spot checks

**Monthly:**
- Full catalog audit
- Duplicate detection
- Broken link cleanup
- Style tag consistency

**Quarterly:**
- Complete re-analysis of all products
- Update visual descriptions with new AI models
- Refresh product metadata
- Archive discontinued products

---

#### AI Model Updates

**Ongoing:**
- Monitor Gemini API updates
- Test new AI models as released
- Refine prompts based on user feedback
- Expand training data library

**Monthly:**
- Review AI generation quality metrics
- A/B test prompt variations
- Update style descriptions
- Optimize placement logic

**Quarterly:**
- Major prompt engineering overhaul
- Evaluate alternative AI providers
- Test emerging AI technologies
- Benchmark against competitors

---

## 🎯 SUCCESS METRICS

### User Engagement Metrics

**Quiz Performance:**
- **Quiz Start Rate:** % of homepage visitors who start quiz
  - Target: 30%+
- **Quiz Completion Rate:** % of started quizzes that are completed
  - Target: 70%+
- **Average Time to Complete:** How long users take to finish
  - Target: 3-5 minutes

**Design Generation:**
- **Generation Success Rate:** % of quiz submissions that successfully generate
  - Target: 95%+
- **Generation Time:** Average time from submission to completion
  - Target: <30 seconds for 90% of requests
- **Re-generation Rate:** % of users who generate multiple designs
  - Target: 40%+

**Product Interaction:**
- **Product Swap Usage:** % of users who swap at least one product
  - Target: 30%+
- **Average Swaps per Design:** How many products users swap
  - Target: 2-3
- **Favorites Added:** % of users who favorite products
  - Target: 25%+

---

### E-commerce Metrics

**Conversion Funnel:**
- **Design-to-Cart Rate:** % of generated designs where products added to cart
  - Target: 40%+
- **Cart-to-Purchase Rate:** % of cart sessions that convert to orders
  - Target: 25%+
- **Overall Conversion:** % of quiz submissions that result in purchase
  - Target: 10%+

**Order Metrics:**
- **Average Order Value (AOV):** Average total of completed orders
  - Target: $2,500+
- **Products per Order:** Average items purchased
  - Target: 4-6 products
- **Repeat Purchase Rate:** % of customers who order again within 90 days
  - Target: 15%+

**Cart Abandonment:**
- **Cart Abandonment Rate:** % of carts not converted to orders
  - Target: <75%
- **Time to Purchase:** Average time from cart creation to order
  - Target: <24 hours for 60% of orders

---

### Technical Performance Metrics

**Speed & Reliability:**
- **Page Load Time:** Time to interactive for key pages
  - Homepage: <2s
  - Quiz: <1.5s
  - Results: <3s
- **AI Generation Uptime:** % of generation requests that succeed
  - Target: 99%+
- **Platform Uptime:** Overall system availability
  - Target: 99.9%

**API Performance:**
- **Gemini API Response Time:** Average time for AI calls
  - Target: <10s for generation, <3s for analysis
- **Database Query Time:** Average query execution
  - Target: <100ms for 95% of queries
- **Image Upload Success Rate:** % of uploads that succeed
  - Target: 99%+

---

### Data Quality Metrics

**Product Catalog:**
- **Coverage Completeness:** % of quiz combinations with 5+ matching products
  - Target: 80%+
- **Image Health:** % of products with all valid images
  - Target: 95%+
- **Visual Description Completeness:** % of products with AI-generated descriptions
  - Target: 90%+

**Content Quality:**
- **Broken Link Rate:** % of product images that return errors
  - Target: <5%
- **Placeholder Detection:** % of products flagged with placeholder images
  - Target: <1%
- **Style Tag Consistency:** % of products with properly categorized tags
  - Target: 95%+

---

### User Satisfaction Metrics

**Ratings & Feedback:**
- **Design Quality Rating:** Average user rating of generated designs
  - Target: 4.2/5.0+
- **Product Match Accuracy:** % of users who rate products as "well-matched"
  - Target: 80%+
- **Overall Platform Rating:** Net Promoter Score (NPS)
  - Target: 40+

**Support & Issues:**
- **Support Ticket Volume:** Number of support requests per 100 users
  - Target: <5
- **Resolution Time:** Average time to resolve user issues
  - Target: <24 hours
- **User-Reported Bugs:** Number of unique bugs reported per month
  - Target: <10

---

### Business Metrics

**Revenue:**
- **Monthly Recurring Revenue (MRR):** From subscriptions (if implemented)
  - Target: TBD based on pricing model
- **Gross Merchandise Volume (GMV):** Total value of products sold
  - Target: $100k+ per month at scale
- **Average Revenue per User (ARPU):** Revenue divided by active users
  - Target: $50+ per active user

**Growth:**
- **User Growth Rate:** % increase in registered users month-over-month
  - Target: 15%+ MoM
- **Order Growth Rate:** % increase in orders month-over-month
  - Target: 20%+ MoM
- **Organic Traffic Growth:** % increase in non-paid visitors
  - Target: 10%+ MoM

**Customer Acquisition:**
- **Customer Acquisition Cost (CAC):** Marketing spend divided by new customers
  - Target: <$100 per customer
- **Lifetime Value (LTV):** Average revenue per customer over lifetime
  - Target: >$500 (LTV:CAC ratio of 5:1)
- **Payback Period:** Time to recover CAC
  - Target: <90 days

---

## 📊 TRACKING & REPORTING

### Dashboard Implementation

**Admin Analytics Dashboard Should Include:**

1. **Real-Time Overview:**
   - Today's orders
   - This week's revenue
   - Active users (24h)
   - Pending orders

2. **Charts & Trends:**
   - Orders per day (30-day)
   - Revenue trend (30-day)
   - Quiz completions (7-day)
   - Top products (this month)

3. **Conversion Funnel:**
   - Quiz started
   - Quiz completed
   - Designs generated
   - Products added to cart
   - Orders placed

4. **Data Quality:**
   - Products without images
   - Products needing analysis
   - Low-coverage combinations
   - Recent errors

---

### Reporting Schedule

**Daily Reports:**
- Orders placed (automated email to admin)
- Generation failures (if any)
- Critical errors

**Weekly Reports:**
- User growth
- Revenue summary
- Top products
- Conversion rates

**Monthly Reports:**
- Comprehensive business metrics
- User satisfaction survey results
- Product catalog health
- AI performance analysis

---

## 🎓 CONCLUSION

**Curalina AI** is a sophisticated, well-architected platform with strong AI integration and solid technical foundations. The core features work well, but several critical e-commerce components need completion before production launch.

**Immediate Priorities:**
1. Complete order management system
2. Implement analytics dashboard
3. Fix TypeScript errors
4. Improve product catalog coverage

**Key Strengths:**
- Advanced AI integration (Gemini 2.5 Flash, Vision)
- Comprehensive product visual analysis
- Intelligent product selection algorithm
- Flexible authentication system
- Scalable architecture

**Areas for Improvement:**
- E-commerce completion (orders, analytics)
- Image compositing quality
- Product catalog gaps
- User portal features
- Performance optimization

**Recommended Timeline:**
- **Phase 1 (2-3 weeks):** Complete core e-commerce features
- **Phase 2 (3-4 weeks):** Enhance AI quality and compositing
- **Phase 3 (2-3 weeks):** Improve user experience
- **Phase 4 (Ongoing):** Advanced features and continuous optimization

With focused execution on the outlined plan, Curalina AI can become a market-leading AI-powered interior design and e-commerce platform.

---

**End of Documentation**  
**Last Updated:** November 15, 2025  
**Version:** 1.0
