# Curalina AI - Interior Design Platform Design Guidelines

## Design Approach

**Reference-Based Hybrid**: Combine Airbnb's welcoming warmth + Linear's clean efficiency + Notion's approachable UX. The quiz experience should feel like a curated design consultation—sophisticated yet friendly, spacious yet purposeful.

**Core Principle**: Create an inspiring journey through the design process where each quiz step feels intentional, beautiful, and empowering. The platform should make interior design feel accessible to everyone.

---

## Typography

**Font Families** (Google Fonts):
- **Primary**: Inter (all UI, body text, quiz questions)
- **Accent**: Playfair Display (hero headlines, design inspirational quotes)

**Hierarchy**:
- Hero Headlines: text-6xl md:text-7xl, font-bold (Playfair Display)
- Quiz Questions: text-3xl md:text-4xl, font-semibold
- Section Headers: text-2xl md:text-3xl, font-medium
- Body: text-base md:text-lg, leading-relaxed
- UI Labels: text-sm, font-medium
- Helper Text: text-sm, opacity-70

---

## Layout System

**Spacing Primitives**: Tailwind units of **4, 6, 8, 12, 16, 24** for generous breathing room

**Container Strategy**:
- Marketing pages: max-w-7xl with px-6 md:px-12
- Quiz container: max-w-4xl centered with abundant py-16 md:py-24
- Content sections: max-w-6xl

---

## Component Library

### A. Public Homepage

**Hero Section**: Full-width background image (interior design showcase, 1920x1000px) with overlay gradient, centered headline "Transform Your Space with AI-Powered Design", subheadline, single prominent CTA "Start Your Design Journey" with blurred background.

**How It Works**: 3-column grid showcasing quiz → AI generation → final design with icons and descriptions

**Design Gallery**: Masonry grid (3-4 columns) of completed interior designs with hover reveal of style tags

**Social Proof**: 2-column testimonials with before/after room photos

**Footer**: 4-column layout (Product, Resources, Company, Contact) with newsletter signup

### B. 7-Step Design Quiz

**Quiz Container**: Centered card-style interface (max-w-4xl) with generous padding (p-8 md:p-12), soft shadow, white background against subtle textured backdrop

**Progress Indicator**: Horizontal step tracker at top showing 7 dots, filled with light green (#86efac or similar) for completed steps, outlined for current/upcoming

**Quiz Steps Structure**:

1. **Room Type Selection**: Large cards in 2-3 column grid with room icons, titles. Light green border (border-2 border-green-300) on selection with smooth transition
2. **Style Preferences**: Image-based cards (4-column grid on desktop) showing different interior styles (modern, minimalist, bohemian, etc.) with overlay labels
3. **Key Features**: Checkbox grid of features (natural light, storage, workspace) with green checkmarks
4. **Budget Range**: Slider component with range markers, light green fill for selected range
5. **Vibe Board Upload**: Drag-drop zone (dashed border, upload icon) with image preview grid below
6. **Design Preferences Text**: Large textarea with typewriter animation revealing placeholder text character-by-character ("Describe your dream space...")
7. **Floorplan Upload**: File upload interface with preview, dimensions display, edit capabilities

**Navigation**: "Back" and "Continue" buttons at bottom, "Continue" uses light green background with white text, "Back" is ghost button

### C. Results Dashboard

**Layout**: Top navigation with user profile, main content area showing AI-generated designs in grid

**Design Cards**: Generated interior renders with save/share/customize actions, style metadata

---

## Images

**Homepage Hero**: Large inspiring interior design photo (modern living room with natural light, plants, 1920x1000px minimum)

**Quiz Backgrounds**: Subtle texture or soft gradient, never competing with content

**Style Reference Images**: High-quality interior photos for each style option (600x400px minimum)

**Gallery Images**: User-submitted vibe boards and completed designs displayed in masonry layout

**Before/After**: Testimonial section includes transformation photos

---

## Navigation & User Flow

- `/` - Marketing homepage with hero, features, gallery, CTA to quiz
- `/quiz` - 7-step questionnaire experience
- `/results` - AI-generated design options
- `/dashboard` - Saved designs and projects
- `/admin` - Content management (use existing admin guidelines)

---

## Animations

**Quiz-Specific**:
- Step transitions: Slide-fade between questions (300ms ease-in-out)
- Selection states: Scale transform on hover (scale-105), light green border fade-in on selection
- Typewriter effect: Character-by-character reveal in step 6 textarea placeholder (80ms per character)
- Progress dots: Fill animation when step completes (200ms)
- Upload zones: Pulse animation on drag-over state

**General**:
- Button hovers: Subtle lift with shadow increase
- Card hovers: Slight elevation change
- Page loads: Fade-in content (200ms)

---

## Accessibility

- High contrast green selection states (#86efac on white meets WCAG AA)
- All interactive quiz cards minimum 120px height for easy tapping
- Focus states with visible green ring (ring-2 ring-green-400)
- Form labels always visible, never placeholder-only
- Skip navigation for multi-step quiz
- Progress indicator announces step changes for screen readers

---

## Icons

**Primary Library**: Heroicons (outline style for consistency)
- Room type icons: home, building-office, etc.
- Feature icons: light-bulb, archive, desktop
- Upload icons: cloud-arrow-up, photo
- Navigation: chevron-left, chevron-right

Maintain h-6 w-6 for quiz cards, h-8 w-8 for upload zones.