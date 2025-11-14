# Curalina AI - Design Guidelines (Per Client PDF Oct 1)

## Brand Voice & Copy
- **Tagline**: "Crafted for real life, elevated for everyday."
- **Hero Headline**: "Design the space where you'll feel most at home"
- **Hero Subheadline**: "Discover your signature space in just 7 questions"
- **CTA**: "START THE QUIZ" with subtitle "Takes 2 minutes, No wrong answers"
- **Subheader**: "Your style journey is just beginning — more styles, rooms, and edits are on the way"

## Typography
- **Display Font**: Cormorant Garamond (quiz questions, hero headlines, major headings)
- **Body Font**: Inter (all UI, body text, labels, buttons)
- **Hierarchy**:
  - Quiz Questions: text-3xl md:text-4xl lg:text-5xl, font-cormorant, font-medium
  - Hero Headlines: text-4xl md:text-5xl lg:text-6xl, font-cormorant, font-medium
  - Section Headers: text-2xl md:text-3xl, font-cormorant, font-medium
  - Subheadings: text-lg md:text-xl, font-inter, font-normal
  - Body: text-base md:text-lg, font-inter
  - UI Labels: text-sm, font-inter, font-medium
  - Helper Text: text-sm, font-inter, opacity-70

## Color Palette
### Primary Colors
- **Background**: #FAF9F7 (warm off-white)
- **Surface**: #FFFFFF (white cards)
- **Brand Teal**: #24A8AE
- **Mint Selection**: #D9F2E5
- **Text Primary**: Deep charcoal (#1A1A1A)
- **Text Secondary**: Medium gray (#6B7280)
- **Neutral Dark**: #F3F0EB (CTA bands)

### Color Schemes (Updated per PDF Note)
1. **Warm Neutrals**
2. **Earth & Stone**
3. **Coastal Calm**
4. **Soft Contrast**
5. **Monochrome Luxe**
6. **Artful Contrast**
7. **Heritage Warmth**
8. **Dark & Moody**

## Layout System
- **Spacing**: Generous white space throughout
- **Containers**: max-w-[1120px] (12-column grid) with px-6 md:px-12 lg:px-16
- **Quiz Container**: max-w-5xl centered
- **Section Padding**: py-16 md:py-24
- **Grid System**: 12-column layout with responsive breakpoints

## Navigation
**Sticky Header** (background: #FAF9F7):
- Left: Logo/wordmark
- Center: "How It Works", "Style Quiz", "Pricing", "The Edit"
- Right: "Sign In" (text) + "Start the Quiz" (primary button)
- On scroll: add subtle shadow

## Homepage Sections

### 1. Hero Section (Above the Fold)
- Background: #FAF9F7
- Two-column layout (left: content, right: hero image)
- **Left Column**:
  - Pill label: "INTERIOR DESIGN, MADE PERSONAL"
  - H1: "Design the space where you'll feel most at home"
  - Subtext: "Discover your signature style in just 7 questions — then get a shoppable design tailored to your room, budget, and lifestyle."
  - Primary button: "Take the Style Quiz"
  - Secondary ghost button: "Browse Design Styles"
- **Right Column**:
  - Large hero interior image
  - Floating card (bottom-left overlay): mini result preview with thumbnail, "Organic Modern Living Room · Curated for you", link: "See an example design"

### 2. How It Works (3-Step Section)
- Background: #FFFFFF
- Centered title: "How it works"
- Three cards (horizontal on desktop):
  1. **Tell us about your space** - Icon: room outline - "Choose your room, styles and colour palette in just a few clicks."
  2. **We design it for you** - Icon: magic wand/sparkle - "Our designers curate furniture and decor tailored to your answers."
  3. **Shop your room** - Icon: shopping bag - "View your rendered room and instantly shop every piece."
- Bottom link: "Learn more about our process →"

### 3. Preview the Styles (Carousel)
- Background: #FAF9F7
- Title: "Find your look"
- Horizontal scroll carousel with style cards:
  - Organic Modern, Modern Farmhouse, Midcentury Scandi, Warm Transitional, Contemporary Luxe, Artful Eclectic
  - Each card: image thumbnail, style name, one-liner description
  - Hover: slight zoom + gradient overlay

### 4. Value Proposition
- Background: #FFFFFF
- Split layout (left: text, right: visual)
- **Left**: 
  - Title: "Designed by humans, powered by smart tools"
  - Bullets: "Every room is handpicked by professional interior designers", "Hundreds of premium brands", "Shoppable designs"
- **Right**: Before/after room visual

### 5. Testimonials
- Background: #FFFFFF
- Title: "Loved by people who care how their home feels"
- 3 testimonial cards: quote, name, room type
- White cards with soft borders

### 6. Bottom CTA Band
- Background: #F3F0EB
- Centered content:
  - H2: "Your dream room is 7 questions away"
  - Helper: "It takes about 3 minutes. There are no wrong answers."
  - Primary button: "Start the Quiz"
  - Link: "See an example room first →"

### 7. Footer
- Background: #FAF9F7
- Left: logo + tagline
- Link columns:
  - **Company**: About, Contact, Press, Partner with Us
  - **Help**: FAQ, Shipping, Returns
  - **Resources**: Style Quiz, The Edit, Before & After
- Bottom: copyright, terms, privacy

## Quiz Design (7 Steps)

### Quiz Design System
- **Container**: max-w-6xl centered with px-6 md:px-12 lg:px-16 padding
- **Grid System**: 12-column grid for layout control
- **Spacing**: Consistent vertical spacing between sections (space-y-8 or space-y-12)
- **Quiz Card Selections**: 
  - Hover state: subtle elevation and border color change
  - Selected state: border-2 border-primary with checkmark icon
  - Transition: all 200ms ease-in-out
- **Progress Bar**: Subtle linear progress at top (--quiz-progress CSS variable)

### Global Quiz Elements
- **Progress Indicator**: "Step X of 7" centered at top
- **Helper Text**: "Everyone has their own sense of style | Learn More About Our Design Styles"
- **Navigation**: 
  - "< Previous: [Context]" (left)
  - "Next: [Context] >" (right)
  - "Curious about each look? Explore all styles" (center, when applicable)

### Step 1: Room Type Selection
- **Question**: "Which room do you dream of transforming first?"
- **Subtitle**: "You can always explore other rooms later—let's just start with the one that matters most"
- **Options** (large cards with icons):
  - LIVING ROOM
  - DINING ROOM
  - HOME OFFICE
  - BEDROOM

### Step 2: Style Selection
- **Question**: "Which style feels most like home?"
- **Subtitle**: "Choose up to 2 styles. Trust your instincts — There are no wrong answers."
- **Styles** (image cards):
  - ORGANIC MODERN
  - MODERN FARMHOUSE
  - MIDCENTURY SCANDI
  - CONTEMPORARY LUX
  - WARM TRANSITIONAL

### Step 3: Color Palette
- **Question**: "Which colour palette feels most like you?"
- **Subtitle**: "Choose up to 2 styles. Trust your instincts — There are no wrong answers."
- **Updated Color Schemes**:
  - Warm Neutrals
  - Earth & Stone
  - Coastal Calm
  - Soft Contrast
  - Monochrome Luxe
  - Artful Contrast
  - Heritage Warmth
  - Dark & Moody

### Step 4: Functional Features
- **Question**: "Functional Features"
- **Subtitle**: "A room should look stunning and live smart. Let's design for how you live, not just how it looks."
- **Label**: "Select all that apply"

**Living Room Features**:
- Storage Solutions (Shelves & cabinetry)
- Workspace Area (Integrated office)
- Comfortable Seat (Sectional or deep sofa)
- Accent Lighting (Ambient & Task)
- Pet-Friendly (Durable fabrics)
- Child-Friendly (Toy storage, rounded edges)
- Media Area (Entertainment Cabinet)
- Multi-Function (Sofa Bed)

**Dining Room Features**:
- Casual Setting (Relaxed & Everyday)
- Formal Setting (Elevated & Polished)
- Bar Storage (Wine and Liquor)
- Storage Solutions (Organize clutter) *Note: Update to "Open or Closed Storage"*
- Seating: [4] [6] [8] [10] [12] people

**Bedroom Features**:
- Storage Solutions (Clothing & Linens)
- Workspace Area (Integrated office)
- Vanity Table *Note: ADD this option*
- Comfortable Seat (Reading Chair)
- Media Area (TV Cabinet)
- Twin/Single Bed (38" wide x 75" long)
- Double Bed (54" wide x 75" long)
- Queen Bed (60" wide x 75" long)
- King Bed (76" wide x 80" long)

**Home Office Features**:
- Concealed Storage (Keep clutter out)
- Bookcase Storage (Open Shelves)
- Filing Storage (Documents & Files)
- Reading Chair (Comfortable Seat)
- Large Desk (52" to 62")
- Small Desk (32" to 48")

### Step 5: Budget Range
(To be implemented)

### Step 6: Vibe Images
(Upload inspiration images)

### Step 7: Floorplan Upload
(Upload room photo or floorplan)

## Component Styling

### Buttons
- **Primary CTA**: Clean, minimal style with subtle hover states
- **Quiz Selection Cards**: Large, tappable cards with clear visual feedback on selection
- **Navigation**: Text-based with chevron icons

### Cards
- Clean white backgrounds
- Subtle shadows or borders
- Generous padding
- Clear hover states

### Form Elements
- Clean, minimal inputs
- Checkbox grids for multi-select
- Large, accessible touch targets

## Accessibility
- High contrast text
- Large touch targets (minimum 44px)
- Clear focus states
- Screen reader friendly navigation
- Progress announcements

## Brand Positioning
- **Canadian Focus**: "Proudly Canadian", "Curated for Canadians"
- **Accessible Design**: Magazine-quality results for everyone
- **Real Life Focus**: "Designed for real life", practical yet elevated
- **Designer Curated**: "Handpicked by Interior Designers"
