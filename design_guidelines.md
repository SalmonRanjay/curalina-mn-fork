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
- **Background**: Clean white (#FFFFFF)
- **Text Primary**: Deep charcoal (#1A1A1A)
- **Text Secondary**: Medium gray (#6B7280)
- **Accent**: Soft green for selections and CTAs

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
- **Containers**: max-w-7xl with px-6 md:px-12 lg:px-16
- **Quiz Container**: max-w-5xl centered
- **Section Padding**: py-16 md:py-24

## Navigation
**Header Links** (horizontal layout):
- GET STARTED
- HOW WE WORK  
- EXPLORE STYLES
- PRICING
- THE CURALINA EDIT

## Homepage Sections

### 1. Hero Section
- Full-width clean background
- Centered content
- Headline: "Design the space where you'll feel most at home"
- Subheadline: "Discover your signature space in just 7 questions"
- Tagline: "Crafted for real life, elevated for everyday."
- CTA Button: "START THE QUIZ"
- Helper text: "Takes 2 minutes, No wrong answers"

### 2. Style Showcase
- Feature "Organic Modern" style with sample image
- Clean, minimal presentation

### 3. How We Work
- Section title: "HOW WE WORK"
- Three steps:
  1. **(1) TELL US ABOUT YOUR DREAM SPACE** - Choose your room type, mood, style and budget.
  2. **(2) LET US DESIGN IT IN MINUTES** - Our personalized system will provide a design with curated furniture and decor selections to reflect you
  3. **(3) RECEIVE YOUR FULL DESIGNER LOOK** - From concept to cart — every item is ready for you to own, styled for every corner of your space.

### 4. Features Grid
- **Curalina Rewards** - LEARN MORE
- **Handpicked by Interior Designers**
- **Subscription Program** - LEARN MORE

### 5. Partner Section
- "Partner with Curalina"
- "Join our curated network of brands shaping Canada's design future."
- "Showcase your products where design meets demand."
- "Partner with us to place your collection in beautifully styled spaces nationwide."

### 6. Footer
Four columns:
- **OUR COMPANY**: About us, Social Responsibility, Press Inquiries, Partner with Us, Contact Us
- **CUSTOMER CARE**: Order Status, Furniture Protection Plans, Returns & Exchanges, Delivery & Shipping
- **RESOURCES**: Take the Quiz, Before & Afters, Pricing & Subscriptions, FAQ
- **PROUDLY CANADIAN**: "Curated for Canadians. Designed for real life."
- **STAY CONNECTED**: Email signup with "Sign up for promotions, decorating tips and more from our team."

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
