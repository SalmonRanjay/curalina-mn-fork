# Curalina Consolidated Application Design Guidelines

## Design Approach

**Hybrid System-Reference Approach**: Combine Linear's clean productivity aesthetics for admin/user portals with Notion's accessible interface patterns, while allowing the client-facing site creative freedom inspired by modern SaaS landing pages (Stripe, Vercel).

**Core Principle**: Unified design language with contextual variations—admin feels professional and efficient, client site feels engaging and trustworthy, user portal feels personal and empowering.

---

## Typography

**Font Families** (Google Fonts CDN):
- **Primary**: Inter (headings, UI elements, body text)
- **Accent**: JetBrains Mono (code snippets, technical data in admin)

**Hierarchy**:
- Hero Headlines: text-5xl to text-7xl, font-bold
- Section Headers: text-3xl to text-4xl, font-semibold
- Subsections: text-xl to text-2xl, font-medium
- Body: text-base, font-normal, leading-relaxed
- UI Labels: text-sm, font-medium, tracking-wide uppercase for section labels
- Small Print: text-xs for metadata, timestamps

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 8, 12, 16, 20** for consistency
- Component padding: p-4, p-6, p-8
- Section margins: my-12, my-16, my-20
- Grid gaps: gap-4, gap-6, gap-8
- Container max-widths: max-w-7xl for main content, max-w-prose for text-heavy sections

**Grid Strategy**:
- Admin: Sidebar + main content (grid-cols-[240px_1fr])
- Client site: Full-width sections with contained inner content
- User portal: Two-column layouts where appropriate (grid-cols-1 md:grid-cols-2)

---

## Component Library by Section

### A. Client-Facing Website (Public)

**Navigation**: Sticky header with logo left, navigation center, CTA right
**Hero Section**: Full-width with large hero image, centered headline, subheadline, dual CTA buttons (primary + secondary with blurred bg overlay on image)
**Features Grid**: 3-column layout (lg:grid-cols-3) with icons, titles, descriptions
**Social Proof**: Testimonials in 2-column layout with customer photos
**Footer**: Multi-column (4 sections: Product, Company, Resources, Legal) with newsletter signup

**Images**: 
- Hero: Large, impactful product/service visualization (1920x800px minimum)
- Feature visuals: Screenshots or illustrations for each feature
- Customer photos: Testimonial avatars (80x80px, rounded-full)

### B. Admin Dashboard

**Layout**: Fixed sidebar navigation (w-60) with main content area
**Sidebar**: Logo top, navigation menu with icons (Heroicons), user profile bottom
**Main Content**: 
- Dashboard cards in grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Data tables with sorting, filtering, pagination
- Form layouts: Single column with clear field grouping
- Action buttons: Top-right of sections, primary actions prominent

**Components**:
- Stats cards: Number, label, trend indicator
- Data tables: Striped rows, hover states, compact density
- Forms: Labeled inputs, inline validation, grouped sections
- Modal dialogs: Centered, max-w-2xl, backdrop blur

### C. User Portal

**Layout**: Top navigation with user profile dropdown
**Dashboard**: Personal stats in card grid (grid-cols-1 md:grid-cols-3)
**Content Areas**: 
- Account settings: Tabbed interface with form sections
- File uploads: Drag-drop zones with preview cards
- Activity feed: Timeline-style with avatars

**Components**:
- Profile card: Avatar, name, email, quick actions
- Upload interface: Dashed border, cloud icon, file list with thumbnails
- Settings panels: Grouped form fields with save/cancel actions

---

## Navigation & Routing

**Role-Based Entry Points**:
- `/` - Public client site (hero, features, CTA to sign up)
- `/admin` - Admin dashboard (requires admin role)
- `/portal` - User dashboard (requires user authentication)

**Visual Distinction**:
- Admin: Darker sidebar, data-dense layouts, technical aesthetic
- Client: Spacious, marketing-focused, conversion-optimized
- Portal: Personal, friendly, feature-focused

---

## Animations

**Minimal & Purposeful**:
- Page transitions: Simple fade (transition-opacity duration-200)
- Hover states: Scale buttons slightly (hover:scale-105 transition-transform)
- Loading states: Pulse animation on skeleton screens
- No scroll-triggered animations unless specifically enhancing comprehension

---

## Accessibility

- Maintain WCAG AA contrast ratios throughout
- All form inputs have visible labels
- Interactive elements have clear focus states (ring-2 ring-offset-2)
- Icon-only buttons include aria-labels
- Responsive touch targets (min 44x44px)

---

## Icons

**Primary Library**: Heroicons (outline for general UI, solid for active states)
Use via CDN, maintain consistent sizing (h-5 w-5 for inline, h-6 w-6 for standalone)