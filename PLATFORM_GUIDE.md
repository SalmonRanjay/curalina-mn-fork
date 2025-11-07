# Curalina AI Platform - Complete Feature Guide

## Table of Contents
1. [User Journey Overview](#user-journey-overview)
2. [The 7-Step Design Quiz](#the-7-step-design-quiz)
3. [AI-Powered Room Generation](#ai-powered-room-generation)
4. [Intelligent Product Selection](#intelligent-product-selection)
5. [Vibe Image Analysis](#vibe-image-analysis)
6. [Product Visual Analysis](#product-visual-analysis)
7. [Image Compositing System](#image-compositing-system)
8. [Shopping Experience](#shopping-experience)
9. [Authentication & User Management](#authentication--user-management)
10. [Admin Management Tools](#admin-management-tools)
11. [Technical Architecture](#technical-architecture)

---

## User Journey Overview

### How Users Experience the Platform

The platform guides users through a complete interior design journey, from initial inspiration to final purchase:

1. **Landing Page**: Users arrive and see the value proposition - designing personalized spaces through AI
2. **Design Quiz**: 7 questions capture design preferences, style, budget, and room photos
3. **AI Generation**: The system generates a fully-furnished room design with real products
4. **Results Page**: Users explore their design, swap products, and add items to cart
5. **Shopping Cart**: Review selections, adjust quantities, see totals
6. **Checkout**: Complete purchase with shipping details (Stripe payment processing)

### Session Management

Every visitor gets a unique **anonymous session ID** stored in their browser's local storage. This allows:
- **Guest browsing**: No account required to generate designs
- **Cart persistence**: Shopping cart items saved even without login
- **Design history**: Access to previously generated designs
- **Seamless transition**: If user creates account, session data is preserved

---

## The 7-Step Design Quiz

### Purpose
The quiz extracts detailed design preferences that the AI uses to create personalized room designs. Each question serves a specific purpose in the AI generation process.

### Step-by-Step Breakdown

#### **Step 1: Room Type Selection**
- **Options**: Living Room, Bedroom, Dining Room, Home Office, Nursery, Entryway
- **Why it matters**: Determines functional requirements (seating vs. storage), typical furniture pieces, and spatial layout rules
- **How AI uses it**: Selects appropriate product categories and spatial arrangements

#### **Step 2: Style Selection** (Choose up to 2)
- **Options**: 
  - Organic Modern (earthy, curved, minimalist)
  - Modern Farmhouse (rustic, cozy, vintage charm)
  - Midcentury Scandi (retro, functional, warm woods)
  - Contemporary Luxe (sleek, high-end materials, dramatic)
  - Warm Transitional (classic meets modern, rich woods)
  - Artful Eclectic (bold patterns, global influences, collected look)

- **Why it matters**: Each style has specific characteristics for materials, colors, textures, and furniture forms
- **How AI uses it**: The system has detailed "style descriptions" that guide the AI image generator:
  - **Example for Organic Modern**: "curved sculptural furniture with soft edges, natural materials like white oak and travertine, plush boucle and linen textiles, earthy neutral color palette, low-profile furniture silhouettes"
  - These descriptions are injected into the AI prompt to ensure accurate style representation

#### **Step 3: Color Palette** (Choose up to 2)
- **Options**: Light Neutrals, Warm & Cozy, Dark & Moody, Fresh & Airy, Earth Tones, Bold & Vibrant
- **Why it matters**: Defines dominant colors for walls, furniture, and accents
- **How AI uses it**: Each palette has detailed color descriptions:
  - **Example for "Dark & Moody"**: "deep charcoal, navy blue, forest green, rich burgundy, warm blacks with luxe brass and gold accents"

#### **Step 4: Functional Features** (Select all that apply)
- **Options**: Storage Solutions, Workspace Area, Entertainment Focus, Dining Space, Reading Nook, Natural Light, etc.
- **Why it matters**: Ensures the design includes necessary functional elements
- **How AI uses it**: Influences product selection (e.g., "Storage Solutions" triggers selection of bookcases, cabinets, ottomans with storage)

#### **Step 5: Budget Range**
- **Options**: $500-$1,500, $1,500-$3,000, $3,000-$5,000, $5,000+
- **Important Note**: **Budget is NOT currently enforced** during product filtering
- **Rationale**: Prioritizing render quality over budget constraints ensures better AI-generated designs
- **Future Enhancement**: Budget filtering can be re-enabled if users prefer price-conscious selections

#### **Step 6: Vibe Image Upload** (Optional - Up to 3 images)
- **Purpose**: Upload inspiration photos from Pinterest, Instagram, or magazines
- **Why it's powerful**: Instead of choosing from pre-set styles, users can show *exactly* what they like
- **How AI analyzes it**: See [Vibe Image Analysis](#vibe-image-analysis) below

#### **Step 7: Room Photo or Floor Plan Upload** (Optional - 1 image)
- **Two use cases**:
  1. **Room Photo**: Upload existing space that needs redesign
  2. **Floor Plan**: Upload architectural drawing with dimensions

- **Why it matters**: Enables **structure-preserving redesign** - AI keeps your actual room's dimensions, windows, doors, and layout while redesigning furniture and decor
- **How AI analyzes it**: See [AI-Powered Room Generation](#ai-powered-room-generation) below

### What Happens After Submission

1. Quiz data is saved to database (`quizResponses` table)
2. User is redirected to **Loading Page** with animated progress indicator
3. Backend starts AI generation process
4. Loading page polls every 2 seconds to check generation status
5. Once complete, user is automatically redirected to **Results Page**

---

## AI-Powered Room Generation

### Two Generation Modes

The platform uses **Gemini 2.5 Flash** (Google's multimodal AI) to generate interior designs. There are two distinct modes:

---

### **Mode 1: Text-to-Image (No Room Photo Uploaded)**

**When it's used**: User completes quiz without uploading a room photo

**How it works**:
1. **Prompt Building**: System constructs a detailed text description combining:
   - Room type: "Spacious living room with thoughtful furniture arrangement"
   - Style description: Full paragraph describing materials, textures, furniture forms
   - Color palette: Specific color names and accents
   - Functional features: "Include workspace area", "entertainment focus with media console"
   - Selected products: Names and visual descriptions of chosen furniture pieces

2. **AI Generation**: Gemini 2.5 Flash creates a room from scratch based entirely on text prompt

3. **Result**: Completely AI-imagined room with no reference to an existing space

**Example Prompt Snippet**:
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

### **Mode 2: Image-to-Image (Room Photo or Floor Plan Uploaded)**

**When it's used**: User uploads existing room photo or floor plan

**How it works**:

#### **Phase 1: Gemini Vision Analysis**

Before generating the new design, AI analyzes the uploaded image to understand the existing space:

**If Room Photo is uploaded**:
- **Extraction Process** (`analyzeRoomImage` function):
  - Identifies all current furniture pieces and their condition
  - Extracts dominant colors in walls, furniture, decor
  - Describes wall paint colors with specific names (e.g., "soft dove gray", "warm beige with cool undertones") and finish type (matte, eggshell, glossy)
  - Notes wall patterns or textures (wallpaper, painted patterns, plain painted)
  - Determines current design style
  - Analyzes room layout and traffic flow
  - Assesses lighting quality (natural and artificial sources)
  - **Catalogs architectural features**: Windows (size, placement, type), doors (location, swing direction), ceiling details, built-in features, moldings, etc.

**If Floor Plan is uploaded**:
- **Extraction Process** (`analyzeFloorPlan` function):
  - Extracts room dimensions (width, length, ceiling height)
  - Maps window locations with exact placement
  - Documents door locations and swing directions
  - Identifies built-in features (closets, fireplaces, alcoves)
  - Analyzes ceiling/roof design elements
  - Notes spatial constraints and layout considerations

#### **Phase 2: Structure-Preserving Prompt**

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

#### **Phase 3: Image-to-Image Generation**

Gemini 2.5 Flash **sees the uploaded room photo** and uses it as a visual reference:
- Analyzes the spatial structure, perspective, and architectural elements
- Generates new design while **visually matching** the room's architecture
- Maintains the original viewpoint and camera angle
- Redesigns furniture, colors, and decor according to user preferences

**Result**: A redesigned version of the user's actual space - same room dimensions, same windows and doors, same architectural features, but with new furniture and styling that matches their quiz preferences.

---

### Why This Matters

**Without image-to-image**: AI might generate a beautiful room, but it could have different dimensions, window placements, or layout than your actual space - making it unrealistic to implement.

**With image-to-image**: The AI-generated design is **directly implementable** because it respects your real-world constraints. When you purchase the furniture, you know it's sized and arranged for your actual room.

---

## Intelligent Product Selection

### The Challenge

How do you choose the best 5-10 products from a catalog of hundreds to include in a personalized room design?

### The Solution: Multi-Factor Scoring System

The platform uses a sophisticated scoring algorithm that evaluates every product against user preferences across multiple dimensions:

---

### **Scoring Factors**

Each product receives a score from 0-100 based on these weighted criteria:

#### **1. Category Match (40% weight)**
- **What it checks**: Does the product belong to a category suitable for the room type?
- **Example**: For a "Living Room" design, prioritize sofas, coffee tables, side tables, lamps, rugs
- **How it works**: 
  - Each room type has a predefined list of "core categories" and "accent categories"
  - Products in core categories get full points (40/40)
  - Products in accent categories get partial points (20/40)
  - Products in unrelated categories get zero points

#### **2. Style Match (30% weight)**
- **What it checks**: Does the product's style align with the user's selected style(s)?
- **How it works**:
  - Every product has `styleTags` (e.g., ["organic modern", "minimalist"])
  - User selected up to 2 styles in quiz
  - If product has ANY overlap with user's style selections, it gets full 30 points
  - No overlap = 0 points

#### **3. Visual Similarity Score (20% weight)** - *Only if vibe images uploaded*
- **What it checks**: How closely does this product match the visual aesthetic from the user's inspiration photos?
- **See**: [Vibe Image Analysis](#vibe-image-analysis) for detailed breakdown
- **How it works**: Compares product colors, materials, and textures against extracted vibe preferences

#### **4. Functional Feature Bonus (10% weight)**
- **What it checks**: Does this product fulfill any requested functional features?
- **Examples**:
  - User selected "Storage Solutions" → Bookcases, storage ottomans, cabinets get +10 points
  - User selected "Workspace Area" → Desks, office chairs get +10 points
  - User selected "Reading Nook" → Accent chairs, floor lamps, side tables get +10 points

---

### **Selection Process**

1. **Initial Filtering**:
   - Remove products with invalid/missing images (quality control)
   - Remove products that don't match room type at all

2. **Scoring**: Calculate weighted score for each remaining product

3. **Category Balancing**: Ensure variety in product selection
   - Don't select 5 lamps and no seating
   - Algorithm picks top-scoring products while maintaining category diversity

4. **Final Count**: Select 6-10 products total (configurable)

---

### **Image Quality Validation**

Before using any product in AI generation, the system validates that:
- Product has at least one valid image URL
- Image URL is not a placeholder or broken link
- Image format is supported (JPEG, PNG, WebP)
- URL is accessible and returns valid image data

**Why this matters**: AI image generation REQUIRES working product images as visual reference. Products without images cannot be accurately rendered.

---

## Vibe Image Analysis

### What Are Vibe Images?

"Vibe images" are inspiration photos that users upload during the quiz (Step 6). These could be:
- Pinterest screenshots of dream rooms
- Instagram photos of favorite styles
- Magazine clippings of aspirational spaces
- Photos of furniture they love

### The Power of Visual Preferences

Instead of choosing from limited pre-set options ("modern" vs. "traditional"), vibe images let users communicate their aesthetic preferences visually - which is often more accurate than verbal descriptions.

---

### How the System Analyzes Vibe Images

#### **Step 1: Gemini Vision Processing**

Each uploaded vibe image is sent to **Gemini Vision API** (Google's multimodal AI) with this analysis request:

```
You are an expert interior designer analyzing inspiration images to understand 
a user's visual preferences. Extract the following information:

1. COLOR PALETTE: List 5-8 dominant colors with specific names or hex codes
   Example: ["warm terracotta #E07A5F", "soft sage green #84A98C", "creamy white #F4F1DE"]

2. MATERIALS: Identify visible materials in furniture and décor
   Example: ["natural oak wood", "brushed brass metal", "linen fabric", "marble stone"]

3. TEXTURES: Describe surface textures and finishes
   Example: ["smooth matte", "rough textured", "glossy polished", "woven", "soft plush"]

4. LIGHTING TONE: Classify the lighting atmosphere
   Options: "warm" | "cool" | "natural" | "dramatic"

5. DENSITY: Assess the visual density of furnishings
   Options: "minimal" (sparse, open) | "moderate" (balanced) | "layered" (full, curated)

6. OVERALL VIBE: Write 2-3 sentences capturing the emotional feeling and design aesthetic
```

#### **Step 2: Structured Data Extraction**

Gemini Vision returns JSON with extracted preferences:

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
  "overallVibe": "This space embodies organic warmth with earthy natural tones and tactile textures. The design feels grounded yet airy, with a focus on sustainable materials and handcrafted elements that create a serene, lived-in aesthetic."
}
```

#### **Step 3: Semantic Product Matching**

The extracted vibe data is used to calculate **visual similarity scores** for each product.

---

### Visual Similarity Scoring Algorithm

For each product, the system calculates how well it matches the vibe preferences using this formula:

#### **Color Match (40% of similarity score)**

```
Process:
1. Extract product colors from:
   - Product.colors array (if available)
   - Product.visualDescription text (AI-analyzed product description)

2. Compare with vibe color palette:
   - Check for exact color name matches ("terracotta" in both)
   - Check for partial matches ("warm gray" contains "gray")

3. Calculate score:
   ColorScore = (Number of matching colors) / (Total vibe colors)
   Example: 3 matches out of 5 vibe colors = 0.6 (60%)

4. Weight: ColorScore × 0.40
```

#### **Material Match (35% of similarity score)**

```
Process:
1. Extract product materials from visualDescription
   Example: "solid oak wood with natural grain, linen upholstery"

2. Compare with vibe materials:
   - "oak wood" matches "natural oak wood" ✓
   - "linen" matches "linen fabric" ✓

3. Calculate score:
   MaterialScore = (Number of matching materials) / (Total vibe materials)
   Example: 2 matches out of 5 = 0.4 (40%)

4. Weight: MaterialScore × 0.35
```

#### **Texture Match (25% of similarity score)**

```
Process:
1. Extract textures from visualDescription
   Example: "smooth matte painted surface, woven seat cushion"

2. Compare with vibe textures:
   - "smooth matte" matches vibe preference ✓
   - "woven" matches vibe preference ✓

3. Calculate score:
   TextureScore = (Number of matching textures) / (Total vibe textures)
   Example: 2 matches out of 4 = 0.5 (50%)

4. Weight: TextureScore × 0.25
```

#### **Final Visual Similarity Score**

```
FinalScore = (ColorScore × 0.40) + (MaterialScore × 0.35) + (TextureScore × 0.25)

Example calculation:
- Color match: 60% → 0.60 × 0.40 = 0.24
- Material match: 40% → 0.40 × 0.35 = 0.14
- Texture match: 50% → 0.50 × 0.25 = 0.125

Total Visual Similarity Score = 0.24 + 0.14 + 0.125 = 0.505 (50.5%)
```

This 50.5% score contributes **20% to the final product ranking** (see [Intelligent Product Selection](#intelligent-product-selection)).

---

### Why This Approach Works

**Traditional approach**: "I like modern style" → Broad category, millions of interpretations

**Vibe image approach**: User uploads photo of a room with warm terracotta accents, oak furniture, and woven textures → AI extracts *specific* color codes, materials, and textures → Products are matched semantically to these exact preferences

**Result**: Highly personalized product selections that authentically match the user's aesthetic vision.

---

## Product Visual Analysis

### The Problem

Product catalogs typically have limited text descriptions:
- "Modern dining chair"
- "Wood finish, upholstered seat"
- "Dimensions: 18"W x 20"D x 34"H"

But for AI image generation, we need **extremely detailed visual information**:
- Exact color codes and shade descriptions
- Precise material types and finishes
- Specific geometric shapes and proportions
- Tactile texture details
- Construction details and joinery

### The Solution: Gemini Vision Product Analysis

Every product image is analyzed by **Gemini Vision** to generate a comprehensive visual description that enables accurate AI rendering.

---

### Analysis Process

#### **Step 1: Multi-Angle Image Collection**

Products often have multiple images showing different angles:
- Front view
- Side view
- Detail shots
- In-room context photos

All images are analyzed to build a complete visual understanding.

#### **Step 2: Detailed Visual Extraction**

Gemini Vision receives this specialized prompt (condensed version):

```
You are an expert furniture designer analyzing this product image for exact 
reproduction in AI-generated interior designs. Provide an extremely detailed 
visual description that would allow an AI image generator to recreate this 
furniture piece with precision.

CRITICAL REQUIREMENTS:
- Use SPECIFIC measurements when visible (e.g., "approximately 6 inches wide" not "narrow")
- Include EXACT color names and codes (e.g., "warm charcoal gray #4A4A4A" not "dark gray")
- Describe textures with tactile precision (e.g., "tightly woven linen with 2mm raised texture")
- Note exact geometric shapes (e.g., "perfect 90-degree angles" or "gentle 15-degree curve")
- Specify material types precisely (e.g., "solid oak with quarter-sawn grain pattern")

ANALYSIS FRAMEWORK:

1. OVERALL FORM & SILHOUETTE
   - Exact shape description (rectangular, L-shaped, curved, asymmetric)
   - Precise proportions (width to depth to height ratios)
   - Design style with specific era (e.g., "Mid-century modern Scandinavian, circa 1960s")

2. STRUCTURAL COMPONENTS
   - Frame construction (visible joinery type, corner treatments)
   - Leg design (tapered/straight/curved, angle from vertical)
   - Leg dimensions (diameter, length, spacing from edges)
   - Support structures (stretchers, crossbars with exact placement)

3. MATERIALS & SURFACES
   - Primary material with specific type (e.g., "white oak" not "wood")
   - Wood grain pattern and direction
   - Metal type and finish (brushed brass, matte black steel)
   - Fabric weave type (bouclé, twill, herringbone)
   - Surface treatments (lacquer sheen level, oil finish)

4. COLOR PALETTE - EXTREMELY SPECIFIC
   - Dominant color with exact shade name
   - Secondary colors with percentages (e.g., "10% brass accent trim")
   - Color temperature (warm/cool/neutral)
   - Finish sheen (matte/satin/semi-gloss with % sheen)

5. PROPORTIONAL MEASUREMENTS
   - Seat height to floor ratio
   - Arm height relative to seat
   - Back height proportions
   - Overall footprint dimensions

6. DISTINCTIVE DESIGN FEATURES
   - Signature elements (tufting, channeling, nailhead trim)
   - Decorative details (carved elements, inlays)
   - Hardware (knobs, pulls, hinges with finish)
   - Edge treatments (rounded, beveled, sharp)

OUTPUT FORMAT:
Write a single flowing paragraph (300-400 words) that integrates ALL these 
details naturally.
```

#### **Step 3: Storage in Database**

The generated visual description is stored in the `visualDescription` field of the product record.

---

### Example Visual Description

**Product**: Modern Boucle Accent Chair

**Generated Description**:
```
This mid-century modern accent chair features a gently curved, sculptural silhouette 
in warm ivory boucle fabric (approximately Sherwin Williams Natural Linen SW 9109 
equivalent) with a nubby, looped texture measuring roughly 3-4mm pile height. The 
frame consists of solid white oak legs in a light natural finish with subtle honey 
undertones, showcasing tight, linear grain running vertically. Each leg tapers 
from approximately 2.5 inches diameter at the seat attachment to 1.75 inches at 
the floor, angled outward at roughly 8-10 degrees from vertical for stability. 
The seat cushion sits 18 inches from the floor, with the curved backrest rising 
to 32 inches total height. The backrest features a gentle 12-15 degree recline 
angle and wraps around the sides in a soft embrace shape, with armrests integrated 
into the back at 24 inches height. The boucle upholstery has a matte finish with 
no sheen, creating a soft, tactile appearance that absorbs light subtly. Visible 
stitching along seams uses matching ivory thread in straight lines, with reinforced 
double-stitching at stress points. The chair's footprint measures approximately 
28 inches wide by 30 inches deep, with legs positioned 2 inches inset from outer 
edges. The overall aesthetic embodies Scandinavian minimalism with organic warmth, 
featuring clean lines softened by the plush textile and gentle curves that invite 
relaxation while maintaining visual lightness through exposed wooden legs.
```

---

### How This Enhances AI Generation

When the AI generates a room design, it includes these product descriptions in the prompt:

```
Include these specific products in your design:

- [Boucle Accent Chair]: This mid-century modern accent chair features a gently 
  curved, sculptural silhouette in warm ivory boucle fabric with 3-4mm pile height,
  solid white oak legs with light natural honey-toned finish, tapered from 2.5" to 
  1.75" diameter, angled 8-10 degrees outward...

- [Oak Coffee Table]: A minimalist rectangular coffee table in quarter-sawn white 
  oak with prominent medullary ray figuring, dimensions 48"W x 24"D x 16"H, featuring 
  waterfall edge detail with continuous grain wrap, matte natural oil finish...
```

**Result**: The AI can render these products with remarkable accuracy because it has precise visual specifications, not just generic descriptions.

---

## Image Compositing System

### Current Implementation (v1 MVP)

The platform uses a **hybrid approach** that combines AI-generated rooms with real product images.

---

### The Compositing Process

#### **Step 1: Base Image Generation**

Gemini 2.5 Flash generates the complete room design with AI-rendered versions of the selected products already integrated into the scene.

#### **Step 2: Product Placement Configuration**

For each product that should be composited onto the image, the system defines:

```typescript
{
  sku: "CHAIR-001",
  productName: "Boucle Accent Chair",
  imageUrl: "https://s3.amazonaws.com/products/chair-front.jpg",
  position: {
    x: 0.35,  // 35% from left edge of image
    y: 0.60   // 60% from top edge of image
  },
  scale: 0.20,      // Product should occupy 20% of image width
  zIndex: 2,        // Layering order (higher = in front)
  addShadow: true   // Generate subtle shadow beneath product
}
```

#### **Step 3: Multi-Angle Image Selection**

Products often have multiple images (front, side, angled views). The system:
1. Analyzes the desired placement location
2. Selects the most appropriate product image angle
   - Example: For products placed at 45° angle, use 3/4 view image

#### **Step 4: Image Processing with Sharp Library**

For each product:

```
1. Fetch product image from URL
2. Get image dimensions (width, height)
3. Calculate target dimensions based on scale factor
   - Target width = Base image width × scale (e.g., 1920px × 0.20 = 384px)
   - Target height = Proportional to maintain aspect ratio
4. Resize image to target dimensions
5. Force PNG format with transparency (alpha channel)
   - Even if source is JPEG, convert to PNG
   - Add transparent background
6. Calculate absolute pixel position on base image
   - Left = (position.x × base width) - (product width / 2)
   - Top = (position.y × base height) - (product height / 2)
7. If addShadow=true:
   - Create shadow layer using product's alpha channel
   - Apply blur filter (10px radius)
   - Position shadow 5px offset from product
```

#### **Step 5: Layer Compositing**

Products are composited in order of zIndex (back-to-front):

```
1. Sort all products by zIndex (lowest first)
2. For each product (in order):
   a. Add shadow layer to composite (if enabled)
   b. Add product layer to composite
3. Apply all layers to base image using "over" blend mode
4. Generate final JPEG output
5. Upload to Google Cloud Storage
```

---

### Current Limitations (v1 MVP)

#### **Issue #1: Product Backgrounds**
- **Problem**: Product images are JPEGs with visible backgrounds (not transparent PNGs)
- **Visual Result**: Products appear with white/colored rectangular backgrounds overlaid on room
- **Why it happens**: Forcing PNG transparency doesn't remove existing backgrounds from source images

#### **Issue #2: Simple Grid Placement**
- **Problem**: Products are placed using basic X/Y coordinates without scene analysis
- **Visual Result**: Products may not align with room perspective or natural placement positions
- **Why it happens**: No depth analysis or 3D spatial understanding

#### **Issue #3: No Perspective Matching**
- **Problem**: Product images are placed flat without adjusting for room perspective
- **Visual Result**: Products at different depths appear same size, breaking spatial realism
- **Why it happens**: No perspective transformation applied to product images

#### **Issue #4: Shadows Disabled**
- **Problem**: `addShadow` is currently disabled due to background visibility issues
- **Visual Result**: Products appear to "float" rather than resting on surfaces
- **Why it happens**: Shadows work best with transparent product images

---

### Planned Improvements (Roadmap)

#### **Enhancement #1: Background Removal API Integration**

**Services to integrate**: remove.bg, ClipDrop, or Adobe Sensei

**Process**:
```
1. Before compositing, send each product image to background removal API
2. Receive back transparent PNG with product isolated
3. Use transparent PNG in compositing process
4. Result: Clean product placement without visible backgrounds
```

#### **Enhancement #2: Scene-Aware Placement with Gemini Vision**

**Process**:
```
1. Send base AI-generated image to Gemini Vision
2. Request depth map and surface detection:
   - "Identify all horizontal surfaces (floors, tables, shelves)"
   - "Map depth layers (foreground, mid-ground, background)"
   - "Locate optimal placement zones for [product type]"
3. Use analysis to calculate intelligent placement coordinates
4. Result: Products placed naturally on tables, floors, shelves
```

#### **Enhancement #3: Perspective-Matched Scaling**

**Process**:
```
1. Analyze room perspective lines using computer vision
2. Calculate depth-based scaling factors
   - Products in foreground: Larger scale
   - Products in background: Smaller scale
3. Apply perspective transformation to product images
4. Result: Realistic spatial depth and scale relationships
```

#### **Enhancement #4: Realistic Floor-Plane Shadows**

**Process**:
```
1. Detect floor plane angle using Gemini Vision
2. Calculate shadow projection based on:
   - Virtual light source position
   - Product height and footprint
   - Floor plane angle
3. Generate perspective-correct shadow
4. Apply with appropriate blur and opacity
5. Result: Realistic shadows that ground products in space
```

---

### Why Hybrid Compositing?

**Why not just use the AI-generated products?**
- AI-generated products are approximations based on text descriptions
- Real product photos show exact colors, materials, textures
- Customers want to see the *actual* product they're purchasing

**Why not just show product photos separately?**
- Seeing products *in the designed room* provides context
- Customers can visualize how products work together
- Spatial relationships and scale are immediately apparent

**The Goal**: Combine the creativity of AI room design with the accuracy of real product photography.

---

## Shopping Experience

### Results Page: "Shop the Look" Sidebar

#### **Layout**

The Results page uses a **side-by-side layout**:
- **Left side (2/3 width)**: AI-generated room design image
  - Full-size image display
  - "View fullscreen" button to open modal
  - "Regenerate Design" button (after product swaps)

- **Right side (1/3 width)**: "Shop the Look" scrollable sidebar
  - List of all products featured in the design
  - Each product card shows:
    - Product image (with left/right arrows if multiple angles)
    - Product name
    - Category
    - Original price (strikethrough if discounted)
    - Sale price (in green)
    - Discount percentage badge
    - "Add to Cart" button
    - "Swap Product" button

#### **Product Swapping**

**How it works**:
1. User clicks "Swap Product" on any item
2. Modal opens showing **alternative products**:
   - Same category as original product
   - Different SKU from original
   - Ranked by similarity score
3. User clicks "Swap" on an alternative
4. Original product is replaced in the list
5. "Regenerate Design" button becomes available
6. User clicks "Regenerate" → New AI render created with swapped products

**Why swapping matters**:
- Users might like the room but prefer different chair style
- Allows customization within the same design aesthetic
- Maintains cohesive look while honoring personal preferences

#### **Multi-Angle Product Images**

Products with multiple images (front, side, detail views) display navigation arrows:
- Left arrow: Previous image
- Right arrow: Next image
- Allows users to examine products from different angles before purchase

---

### Shopping Cart

#### **Cart Management**

**Adding to Cart**:
- Click "Add to Cart" on Results page
- Item added with quantity = 1
- Toast notification confirms addition
- Cart icon in header shows item count

**Cart Operations**:
- **Increase quantity**: Click "+" button
- **Decrease quantity**: Click "-" button
- **Remove item**: Click trash icon
- All changes immediately saved to database

#### **Cart Calculations**

**Price Calculations**:
```
For each item:
1. Get base price from product.price
2. Apply discount if available:
   Final Price = Base Price × (1 - discount / 100)
   Example: $100 with 20% discount = $100 × 0.80 = $80

3. Multiply by quantity:
   Line Total = Final Price × Quantity
   Example: $80 × 2 = $160

Subtotal = Sum of all line totals

Shipping = $15 if subtotal < $100, otherwise FREE

Tax = Subtotal × 0.08 (8% sales tax)

Grand Total = Subtotal + Shipping + Tax
```

**Example Cart Summary**:
```
Subtotal:        $425.00
Shipping:        FREE (over $100)
Tax (8%):        $34.00
─────────────────────────
Total:           $459.00
```

---

### Checkout & Order Processing

#### **Checkout Form**

User provides:
- Full name
- Email address
- Shipping address (street, city, state, ZIP)
- Payment method (Stripe integration)

#### **Order Creation**

When user submits checkout:

```
1. Validate all required fields
2. Calculate final order total
3. Create order record in database:
   - Order ID (unique)
   - Session ID (links to user)
   - Customer name and email
   - Shipping address
   - Total amount
   - Status: "pending"
   - Created timestamp

4. Create order items (one per cart item):
   - Product reference
   - Quantity
   - Price at time of purchase (locked in)

5. Process payment via Stripe
   - If successful: Update order status to "paid"
   - If failed: Update order status to "failed"

6. Clear shopping cart

7. Send confirmation email (future enhancement)

8. Redirect user to order confirmation page
```

#### **Stripe Integration**

**Payment Flow**:
```
1. User clicks "Place Order"
2. Frontend creates Stripe payment intent
3. Stripe hosted checkout page opens
4. User enters payment details securely
5. Stripe processes payment
6. Webhook notifies backend of payment status
7. Backend updates order record
8. User sees confirmation
```

**Security**:
- Payment details never touch Curalina servers
- Stripe handles PCI compliance
- Secure HTTPS communication
- Webhook signatures validated

---

### Session-Based Shopping

**Anonymous Users**:
- Unique session ID stored in browser localStorage
- Cart items linked to session ID
- Can browse, add to cart, checkout without account
- Order history accessible via session ID

**Registered Users**:
- Session ID preserved after login/registration
- Cart items persist across devices (future enhancement)
- Order history linked to user account
- Saved addresses and payment methods (future enhancement)

---

## Authentication & User Management

### Three User States

#### **1. Anonymous Visitor**
- **Capabilities**:
  - Take design quiz
  - Generate AI designs
  - Add products to cart
  - Complete checkout (provides email for order)
  - View results for current session

- **Limitations**:
  - Cannot view order history (no account)
  - Cannot save designs across devices
  - Cart cleared if localStorage is cleared

#### **2. Registered User (Email/Password)**
- **Capabilities**:
  - Everything anonymous users can do, PLUS:
  - View all past orders
  - Save multiple designs
  - Manage profile (name, email, preferences)
  - Faster checkout with saved details

- **Registration Process**:
  ```
  1. User provides:
     - Email address (validated format)
     - Password (minimum 8 characters)
     - First name
     - Last name

  2. Backend validation:
     - Check email not already registered
     - Hash password with bcrypt (10 salt rounds)
     - Create user record in database

  3. Auto-login after registration
  4. Session created and persisted
  ```

#### **3. Admin User**
- **Capabilities**:
  - Everything registered users can do, PLUS:
  - Access admin dashboard
  - Manage product catalog
  - Upload product images
  - Trigger AI product analysis
  - Manage AI training data
  - View all orders (all users)
  - Update order statuses

---

### Authentication Methods

#### **Method 1: Local Authentication (Email/Password)**

**Technology**: Passport.js with Local Strategy

**Login Flow**:
```
1. User submits email + password
2. Backend queries database for user by email
3. If user not found: Return "Invalid email or password"
4. If user found: Compare password with bcrypt hash
   - bcrypt.compare(submitted_password, stored_hash)
5. If match: Create session, return user data
6. If no match: Return "Invalid email or password"
```

**Password Security**:
- Passwords hashed with bcrypt (industry standard)
- Salt rounds: 10 (balances security vs. performance)
- Plain-text passwords NEVER stored
- Hash comparison uses constant-time algorithm (prevents timing attacks)

**Session Creation**:
```
1. Generate session ID (cryptographically random)
2. Store in PostgreSQL sessions table:
   - Session ID
   - User ID
   - Expiration timestamp (7 days from creation)
   - Session data (serialized user object)

3. Send session cookie to browser:
   - HttpOnly flag (prevents JavaScript access → XSS protection)
   - Secure flag (HTTPS only in production)
   - SameSite=Strict (CSRF protection)
   - MaxAge: 7 days

4. Browser automatically includes cookie in subsequent requests
```

#### **Method 2: Replit OIDC (Google, GitHub Login)**

**Technology**: OpenID Connect (OIDC) protocol

**Login Flow**:
```
1. User clicks "Login with Google" (or GitHub)
2. Frontend redirects to Replit OIDC provider
3. Replit shows authorization page:
   - "Curalina AI wants to access your basic profile"
   - User approves
4. Replit redirects back with authorization code
5. Backend exchanges code for tokens:
   - Access token (used to fetch user info)
   - Refresh token (used to get new access token when expired)
   - ID token (contains user claims)
6. Backend extracts user claims:
   - sub (unique user ID)
   - email
   - first_name
   - last_name
   - profile_image_url
7. Upsert user record (create if new, update if exists)
8. Create session (same as local auth)
9. Redirect user to application
```

**Token Refresh**:
```
- Access tokens expire after 1 hour
- Refresh tokens valid for 30 days
- When access token expires:
  1. Backend uses refresh token to request new access token
  2. OIDC provider issues new access token
  3. User session continues without re-login
```

**Security Benefits**:
- No password management required
- Leverages Google/GitHub's security infrastructure
- Two-factor authentication (if enabled on provider)
- Automatic token rotation

---

### Session Management

#### **Session Storage**

**PostgreSQL Sessions Table**:
```sql
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,           -- Session ID (unique)
  sess JSON NOT NULL,                -- Serialized session data
  expire TIMESTAMP NOT NULL          -- Expiration timestamp
);

CREATE INDEX ON sessions (expire);   -- For cleanup queries
```

**Session Data Example**:
```json
{
  "cookie": {
    "originalMaxAge": 604800000,
    "expires": "2025-11-14T15:41:13.000Z",
    "httpOnly": true,
    "secure": true
  },
  "passport": {
    "user": "22703de4-d507-45db-af21-2ae010f523dd"
  }
}
```

#### **Session Lifecycle**

**Creation**:
- On successful login/registration
- Session ID generated cryptographically
- TTL: 7 days (604,800,000 milliseconds)

**Validation** (every request):
```
1. Extract session ID from cookie
2. Query sessions table for matching sid
3. Check expiration:
   - If expired: Delete session, return 401 Unauthorized
   - If valid: Continue
4. Deserialize session data
5. Extract user ID from passport.user
6. Query users table for full user object
7. Attach user to request object (req.user)
```

**Renewal**:
- Session TTL resets on every request (rolling expiration)
- User remains logged in as long as they're active
- 7 days of inactivity → automatic logout

**Destruction**:
```
1. User clicks "Logout"
2. Backend deletes session from database
3. Backend clears session cookie
4. Frontend redirects to landing page
```

**Cleanup**:
- Expired sessions automatically pruned by connect-pg-simple
- Runs every 24 hours
- Deletes all sessions where expire < current timestamp

---

### Access Control

#### **Protected Routes**

**Middleware**: `isAuthenticated` function

```typescript
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    // Passport populates req.user if session valid
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
```

**Usage**:
```typescript
// User profile - requires login
app.get('/api/auth/user', isAuthenticated, async (req, res) => {
  res.json(req.user);
});

// Admin dashboard - requires login + admin role
app.get('/api/admin/dashboard', isAuthenticated, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden" });
  }
  // ... admin logic
});

// Quiz submission - NO authentication required
app.post('/api/quiz', async (req, res) => {
  // Anyone can submit quiz
});
```

---

## Admin Management Tools

### Product Management

#### **1. Manual Product Entry**

**Admin Dashboard → Products**:

**Add New Product Form**:
- SKU (unique identifier)
- Name
- Category (dropdown: Seating, Tables, Storage, Lighting, Decor, Rugs)
- Price
- Discount percentage (optional)
- Supplier (dropdown)
- Dimensions (width, depth, height in inches)
- Description
- Style tags (multi-select: organic modern, farmhouse, etc.)
- Colors (multi-select)
- Materials (text field, comma-separated)
- Stock quantity
- 3D model URL (optional for AR features)
- Image uploads (multiple files)

**Product List View**:
- Searchable table with all products
- Columns: Image, SKU, Name, Category, Price, Stock, Actions
- Actions: Edit, Delete, Manage Images, Trigger AI Analysis

#### **2. Bulk CSV Import**

**Purpose**: Import hundreds of products quickly from Excel/CSV files

**Supported Columns**:
- Required: SKU, name, category, price, supplier
- Optional: discount, width, depth, height, description, styleTags, colors, materials, stock, image1, image2, image3, image4, model3dUrl

**Import Process**:
```
1. Admin uploads CSV/XLSX file
2. Frontend reads file with XLSX library
3. Validates data:
   - Check required columns present
   - Validate SKUs are unique
   - Validate price is numeric
   - Validate category exists
4. Display preview table with row count
5. Admin clicks "Import"
6. Backend processes each row:
   a. Create supplier if doesn't exist
   b. Create category if doesn't exist
   c. Parse styleTags from comma-separated string
   d. Create product record
   e. If image URLs provided, validate and store
7. Return import summary:
   - Total rows processed
   - Successful imports
   - Failed rows with error messages
```

**Example CSV**:
```csv
sku,name,category,price,discount,supplier,styleTags,colors,materials
SOFA-001,Boucle Cloud Sofa,Seating,1299,15,West Elm,"organic modern,minimalist","ivory,cream","bouclé fabric,oak wood"
TABLE-042,Live Edge Coffee Table,Tables,599,0,CB2,"organic modern,rustic","natural wood","solid oak"
```

#### **3. Bulk Image Upload**

**Two Methods**:

**Method A: Folder-Based Upload**
```
1. Admin organizes images in folders by product name
   /uploads
     /Boucle Cloud Sofa
       front.jpg
       side.jpg
       detail.jpg
     /Live Edge Coffee Table
       front.jpg
       angled.jpg

2. Admin uploads folder structure
3. System uses AI to match folder names to products:
   - Gemini analyzes folder name "Boucle Cloud Sofa"
   - Searches products by name similarity
   - Links images to matched product
```

**Method B: SKU-Based Filenames**
```
1. Admin names files with SKU prefix
   SOFA-001_front.jpg
   SOFA-001_side.jpg
   TABLE-042_front.jpg

2. Upload multiple files at once
3. System extracts SKU from filename
4. Links images to products automatically
```

**Upload Processing**:
```
1. Validate image format (JPEG, PNG, WebP)
2. Resize to standard dimensions (1200px width max)
3. Optimize compression (quality 85)
4. Upload to AWS S3 bucket "curalina"
5. Generate public URL
6. Update product record with image URLs
7. Optionally trigger AI visual analysis
```

#### **4. AI Visual Analysis Trigger**

**Manual Trigger**:
- Admin clicks "Analyze Images" on product detail page
- System sends all product images to Gemini Vision
- Generates comprehensive visual description
- Stores in product.visualDescription field

**Bulk Trigger**:
- Admin selects multiple products
- Clicks "Batch Analyze Images"
- System processes products in parallel (max 5 concurrent)
- Progress indicator shows completion status

---

### AI Training Data Management

#### **Purpose**

The AI learns from examples to improve design quality over time. Admins curate four types of training data:

---

#### **1. Design Examples**

**What they are**: Reference images showing good or bad interior designs

**Types**:
- **Good Examples**: Well-designed rooms that represent ideal aesthetics
  - High-quality composition
  - Proper color balance
  - Appropriate product placement
  - Strong visual hierarchy

- **Bad Examples**: Common design mistakes to avoid
  - Cluttered spaces
  - Poor lighting
  - Mismatched styles
  - Incorrect scale relationships

**Admin Interface**:
```
Add Design Example form:
- Upload image
- Select type: "good" or "bad"
- Choose style tags (organic modern, farmhouse, etc.)
- Write description explaining why it's good/bad
- Submit
```

**How AI uses them**:
```
- Good examples inform aesthetic preferences
- Bad examples teach avoidance patterns
- During generation, AI receives context:
  "Create a design similar to these good examples, avoiding patterns 
   from bad examples"
```

**Example Good Description**:
> "Organic modern living room with excellent spatial balance. Curved boucle sofa anchors the space, complemented by natural oak coffee table. Neutral color palette (ivory, warm beige, soft terracotta accents) creates cohesion. Textural variety through woven rug, linen curtains, and ceramic vases adds visual interest without clutter."

**Example Bad Description**:
> "Overly cluttered living room with mismatched furniture styles. Mid-century modern chair clashes with traditional floral sofa. Too many small decorative objects create visual chaos. Lighting is insufficient with single overhead fixture. Color palette lacks cohesion with competing warm and cool tones."

---

#### **2. Product Packages**

**What they are**: Pre-curated product combinations that work well together

**Purpose**: Teach AI which products complement each other

**Package Structure**:
```
Package Name: "Organic Modern Living Room Essentials"
Style Tags: ["organic modern", "minimalist"]
Products:
  - Curved Boucle Sofa (SKU: SOFA-001)
  - Live Edge Oak Coffee Table (SKU: TABLE-042)
  - Ceramic Table Lamp (SKU: LAMP-018)
  - Jute Area Rug (SKU: RUG-105)
Description: "Foundation package for organic modern aesthetic. 
             Curved sofa provides soft sculptural form, oak table 
             adds natural warmth, ceramic lamp and jute rug layer 
             complementary textures."
```

**Admin Interface**:
```
Create Package form:
- Package name
- Style tags (multi-select)
- Add products (search and select from catalog)
- Reorder products by drag-and-drop
- Write description
- Submit
```

**How AI uses them**:
```
During product selection:
1. Identify user's selected styles
2. Query packages matching those styles
3. Prioritize products that appear in successful packages
4. Ensure selected products work well together
```

---

#### **3. Placement Guidelines**

**What they are**: Rules for where specific product types should be placed in rooms

**Purpose**: Teach AI natural product positioning and spatial relationships

**Example Guidelines**:

```
Guideline: "Sofa Placement in Living Rooms"
Room Type: Living Room
Product Category: Seating (Sofas)
Placement Rule: "Position sofa facing the room's focal point (fireplace, 
                 TV, or window with view). Maintain 12-18 inches clearance 
                 from wall to allow circulation. Center sofa on longest wall 
                 unless room layout suggests alternate arrangement (e.g., 
                 angled to conversation area)."
Visual Example: [Upload image showing correct sofa placement]
```

```
Guideline: "Coffee Table Height and Distance"
Room Type: Living Room
Product Category: Tables (Coffee Tables)
Placement Rule: "Coffee table should be positioned 14-18 inches from sofa 
                 edge for comfortable reach. Table height should be level 
                 with or 1-2 inches lower than sofa seat cushion height. 
                 Table width should be approximately 2/3 the sofa length 
                 to maintain visual proportion."
Visual Example: [Upload image showing correct coffee table placement]
```

**Admin Interface**:
```
Add Placement Guideline form:
- Room type
- Product category
- Guideline title
- Placement rule (detailed text)
- Upload example image
- Submit
```

**How AI uses them**:
```
During image compositing:
1. Identify product types to be placed
2. Query relevant placement guidelines
3. Apply rules to calculate positions:
   - Sofa 18" from wall
   - Coffee table 16" from sofa edge
   - Table lamp on side table, not floor
4. Validate placements don't violate guidelines
```

---

#### **4. Design Rules**

**What they are**: General design principles and aesthetic rules

**Purpose**: Codify universal design best practices for AI to follow

**Example Rules**:

```
Rule: "Color Balance - 60-30-10 Principle"
Category: Color Theory
Description: "For harmonious color schemes, distribute colors using the 
             60-30-10 ratio: 60% dominant color (walls, large furniture), 
             30% secondary color (accent chairs, rugs), 10% accent color 
             (pillows, artwork). This creates visual balance without 
             overwhelming the space."
```

```
Rule: "Rug Size for Living Rooms"
Category: Spatial Proportions
Description: "Living room rugs should be large enough that at least the 
             front legs of all seating pieces rest on the rug. Avoid small 
             rugs that 'float' in the center of the room. Minimum 8x10 
             for standard living rooms, 9x12 for larger spaces."
```

```
Rule: "Lighting Layers"
Category: Lighting Design
Description: "Every room needs three lighting layers: ambient (overhead 
             or general illumination), task (reading lamps, under-cabinet 
             lights), and accent (highlighting art or architectural features). 
             Single overhead fixtures create harsh, flat lighting."
```

**Admin Interface**:
```
Add Design Rule form:
- Rule name
- Category (Color Theory, Spatial Proportions, Lighting, etc.)
- Detailed description
- Style applicability (all styles vs. specific styles)
- Submit
```

**How AI uses them**:
```
During prompt construction:
1. Query applicable design rules
2. Inject into AI generation prompt:
   "Follow these design principles:
    - Apply 60-30-10 color distribution
    - Ensure rug size accommodates all seating
    - Include layered lighting (ambient, task, accent)"
3. AI incorporates rules into generation decisions
```

---

### Training Data Impact

**Continuous Improvement Loop**:
```
1. Admin curates training data (examples, packages, guidelines, rules)
2. AI uses training data during next generation
3. User feedback collected (design ratings, product swaps, etc.)
4. Admin reviews user feedback
5. Updates training data based on patterns:
   - Add new good examples from highly-rated designs
   - Add bad examples from poorly-rated designs
   - Refine placement guidelines based on swap patterns
6. AI performance improves with each iteration
```

**Quality Metrics** (Future Enhancement):
- Design completion rate (% of users who complete full journey)
- Average design rating
- Product swap frequency (lower = better initial selections)
- Purchase conversion rate
- Time spent on results page (engagement indicator)

---

## Technical Architecture

### Frontend Stack

**Framework**: React 18 with TypeScript
- Component-based architecture
- Type-safe development with TypeScript
- Hooks for state management (useState, useEffect, useContext)

**Build Tool**: Vite
- Fast HMR (Hot Module Replacement)
- Optimized production builds
- ES modules support

**UI Components**: shadcn/ui (Radix UI primitives)
- Accessible components (ARIA compliant)
- Headless architecture for customization
- Tailwind CSS for styling

**Routing**: Wouter
- Lightweight client-side routing
- Hooks-based API (useLocation, useRoute)
- SSR-friendly

**State Management**:
- **Server State**: React Query (TanStack Query v5)
  - Automatic caching
  - Background refetching
  - Optimistic updates
  - Loading/error states
- **Local State**: React hooks (useState, useReducer)
- **Session State**: localStorage (anonymous session ID)

**Forms**: React Hook Form + Zod
- Controlled form components
- Schema validation
- Type-safe form data

**Styling**:
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Animations and transitions
- **Custom Design System**: Defined in `index.css` with CSS variables

---

### Backend Stack

**Server**: Express.js with TypeScript
- RESTful API architecture
- Middleware-based request processing
- Session management

**Database**:
- **PostgreSQL** (Neon serverless)
- **ORM**: Drizzle ORM
  - Type-safe queries
  - Migration management
  - Schema-first design

**Authentication**:
- **Passport.js**: Authentication middleware
  - Local Strategy (email/password)
  - OIDC Strategy (Google, GitHub)
- **bcrypt**: Password hashing
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

**File Storage**:
- **Google Cloud Storage**: User uploads (vibe images, room photos, floor plans, AI renders)
- **AWS S3**: Product images (curalina bucket)

**Image Processing**:
- **Sharp**: High-performance image manipulation
  - Resizing
  - Format conversion
  - Compositing
  - Compression

**AI Services**:
- **Gemini 2.5 Flash**: Text-to-image generation
- **Gemini Vision**: Multi-modal image analysis
- **Stability AI SDXL**: Image-to-image rendering (legacy, currently using Gemini)

**Payment Processing**:
- **Stripe**: Checkout, payment intents, webhooks

**Validation**: Zod
- Runtime type validation
- Schema definition
- Error messages

---

### Database Schema

**Core Tables**:

```
users
- id (primary key, UUID)
- email (unique)
- password (bcrypt hash, nullable for OIDC users)
- firstName
- lastName
- role (user | admin)
- profileImageUrl
- bio

categories
- id (primary key)
- name (unique)
- type (room | furniture)
- description

suppliers
- id (primary key)
- name (unique)
- website
- contactEmail

products
- id (primary key, UUID)
- sku (unique)
- name
- categoryId (foreign key → categories)
- supplierId (foreign key → suppliers)
- price (decimal)
- discount (decimal, percentage)
- description
- styleTags (array)
- colors (array)
- materials (array)
- width, depth, height (decimal, inches)
- stock (integer)
- images (array of URLs)
- model3dUrl
- visualDescription (text, from Gemini Vision)

quizResponses
- id (primary key, UUID)
- sessionId (indexed)
- userId (foreign key → users, nullable)
- roomType
- style
- colorPalette
- functionalFeatures (array)
- budget
- vibeImageUrls (array)
- vibeColorPalette (array, from Gemini Vision)
- vibeMaterials (array, from Gemini Vision)
- vibeTextures (array, from Gemini Vision)
- vibeLightingTone
- vibeDensity
- floorPlanUrl
- roomPhotoUrl
- createdAt

renders
- id (primary key, UUID)
- sessionId (indexed)
- userId (foreign key → users, nullable)
- quizResponseId (foreign key → quizResponses)
- imageUrl (AI-generated result)
- productSkus (array, ordered)
- status (generating | completed | failed)
- error (text, if failed)
- createdAt

cartItems
- id (primary key, UUID)
- sessionId (indexed)
- productId (foreign key → products)
- quantity (integer)
- createdAt

orders
- id (primary key, UUID)
- sessionId
- userId (foreign key → users, nullable)
- customerEmail
- customerName
- shippingAddress (JSON)
- totalAmount (decimal)
- status (pending | paid | shipped | delivered | cancelled | failed)
- createdAt

orderItems
- id (primary key, UUID)
- orderId (foreign key → orders)
- productId (foreign key → products)
- quantity
- price (decimal, locked at purchase time)

designExamples (AI training)
- id (primary key, UUID)
- imageUrl
- type (good | bad)
- styleTags (array)
- description
- createdAt

productPackages (AI training)
- id (primary key, UUID)
- name
- styleTags (array)
- productIds (array)
- description
- createdAt

placementGuidelines (AI training)
- id (primary key, UUID)
- roomType
- productCategory
- guidelineText
- exampleImageUrl
- createdAt

designRules (AI training)
- id (primary key, UUID)
- ruleName
- category
- description
- applicableStyles (array)
- createdAt

sessions (express-session)
- sid (primary key, VARCHAR)
- sess (JSON)
- expire (TIMESTAMP)
```

---

### API Routes

**Public Routes** (no authentication required):
```
POST   /api/quiz                - Submit design quiz
GET    /api/render/latest       - Get latest render by session
GET    /api/products            - Get all products
GET    /api/products/:id        - Get product by ID
GET    /api/products/alternatives/:id - Get alternative products
POST   /api/cart                - Add item to cart
GET    /api/cart/:sessionId     - Get cart items
PATCH  /api/cart/:id            - Update cart item quantity
DELETE /api/cart/:id            - Remove cart item
POST   /api/orders              - Create order
```

**Authenticated Routes** (requires login):
```
GET    /api/auth/user           - Get current user
POST   /api/auth/register       - Register new user
POST   /api/auth/login          - Login
POST   /api/auth/logout         - Logout
GET    /api/orders/:id          - Get order details
GET    /api/orders/session/:sessionId - Get orders by session
```

**Admin Routes** (requires admin role):
```
GET    /api/admin/products      - Get all products (admin view)
POST   /api/admin/products      - Create product
PUT    /api/admin/products/:id  - Update product
DELETE /api/admin/products/:id  - Delete product
POST   /api/admin/products/bulk-analyze - Trigger AI analysis
POST   /api/admin/products/import - Import from CSV

POST   /api/admin/training/examples - Add design example
GET    /api/admin/training/examples - Get all examples
DELETE /api/admin/training/examples/:id - Delete example

POST   /api/admin/training/packages - Add product package
GET    /api/admin/training/packages - Get all packages
DELETE /api/admin/training/packages/:id - Delete package

POST   /api/admin/training/guidelines - Add placement guideline
GET    /api/admin/training/guidelines - Get all guidelines
DELETE /api/admin/training/guidelines/:id - Delete guideline

POST   /api/admin/training/rules - Add design rule
GET    /api/admin/training/rules - Get all rules
DELETE /api/admin/training/rules/:id - Delete rule

GET    /api/admin/orders        - Get all orders (all users)
PATCH  /api/admin/orders/:id    - Update order status
```

---

### Environment Variables

**Required**:
```
DATABASE_URL               - PostgreSQL connection string
SESSION_SECRET            - Secret for session encryption
AWS_ACCESS_KEY_ID         - S3 access key
AWS_SECRET_ACCESS_KEY     - S3 secret key
AWS_REGION                - S3 region
DEFAULT_OBJECT_STORAGE_BUCKET_ID - GCS bucket ID
STABILITY_API_KEY         - Stability AI API key
```

**Optional**:
```
ISSUER_URL                - OIDC provider URL (default: Replit)
REPLICATE_API_TOKEN       - Replicate API token (future)
```

---

### Deployment Architecture

**Hosting**: Replit (development and production)
- Automatic SSL/TLS
- Environment management
- Database provisioning
- Object storage integration

**Database**: Neon PostgreSQL
- Serverless architecture
- Automatic scaling
- Connection pooling
- Built-in backups

**CDN**: Cloudflare (via Replit)
- Global edge network
- DDoS protection
- Asset caching

**Object Storage**:
- **GCS**: User-generated content
- **S3**: Product catalog images

---

## Summary

Curalina AI is a comprehensive interior design platform that combines:

1. **User-Friendly Quiz**: 7 intuitive steps capture design preferences
2. **Advanced AI Generation**: Gemini 2.5 Flash creates personalized room designs
3. **Intelligent Product Selection**: Multi-factor scoring ensures relevant product recommendations
4. **Visual Preference Analysis**: Vibe images analyzed for colors, materials, textures
5. **Structure-Preserving Redesign**: Image-to-image generation respects actual room architecture
6. **Detailed Product Analysis**: Gemini Vision extracts comprehensive visual descriptions
7. **Hybrid Compositing**: Combines AI creativity with real product photography
8. **Seamless Shopping**: From design to cart to checkout
9. **Flexible Authentication**: Anonymous, email/password, or social login
10. **Admin Control**: Comprehensive tools for catalog and AI training management

**The Result**: Users get personalized, implementable interior designs with shoppable products - bridging the gap between inspiration and reality.
