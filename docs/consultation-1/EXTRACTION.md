# Consultation 1 — page-by-page extraction

Source: `Consultation 1.pdf` (22 pages, client design mockups with red programmer
annotations). Page images: `pages/page-NN.jpg` (rendered at 1.2x). Every entry
below was read directly from the page image by the orchestrating session;
"(annotation)" = red text on the mockup, "(mockup)" = visual-only, not stated in text.

> Provenance note: a first automated extraction (research-scout, Haiku) was
> discarded — it never wrote its file, mis-assigned page numbers, and invented
> content (e.g. palette text on page 2, a 6-option living-room list on page 8).
> Do not trust any extraction that was not checked against the images.

## Global look and feel (all pages)

- **Light theme**, white page, `#f4f6f5`-ish pale grey-green panels, near-black (`~#231f20`) header bar and buttons, **khaki/grey-olive selected state** (`~#7f807a` fill, white text). Selected-state rule, stated three times (annotation): "the image darkens with a khaki overlay upon selection" (p1, p2), "Selection has Khaki overlay / Font becomes white" (p6, p7).
- **Header**: near-black bar; hamburger menu left; centred script wordmark **"Curalina & Co."**; right side a circle with **customer initials** (e.g. "KD") — annotation p4: "Initials switches to customer initials upon sign-in" (a person icon before sign-in, p1–p3).
- **Footer (identical on every page)**: circular "CC" monogram; columns **Company** (About / Partner / Contact — later pages: About us / Partner with Us / Contact Us), **Support** (Delivery & Shipping / Returns & Exchanges / FAQ), **Explore** (Design Styles / Before & After / Pricing), **Stay Connected** ("Receive occasional updates, new releases, and design insights." + email field + Instagram + Pinterest); bottom bar "Terms & Conditions · Privacy Policy" and "Curalina & Co. All rights reserved." (later pages "© 2026 Curalina & Co.").
- **Typography**: high-contrast display serif for headings (Didone/Bodoni-like), light humanist sans for body.
- **Buttons**: rectangular, near-black fill, white text; "Previous" left, "Proceed" right on every question step.
- **Interaction directive (annotation, pp3,7,8,9,10 — repeated verbatim)**: "Update design to include affects and to be more tech-forward (i.e. soften the line thickness, lighten the font colour — and have the lines darken and box change colour as each is selecte[d])". p3 adds: "Can we remove the boxes or lighten the weight of the lines? Once they input their email, password fades in, then the sign in button?"
- No Home Office anywhere. Rooms are **Living Room, Dining Room, Bedroom** only.

## Page-by-page

**p1 — "Select the space you will be elevating".** Three image tiles in a row: LIVING ROOM (dog on bouclé chair), DINING ROOM, BEDROOM (nightstand). Single-select (implied). Selected tile darkens with khaki overlay (annotation). Button: **"Initiate the Refinement"** (replaces Next/Proceed on this step). Mockup shows the label bars over the images.

**p2 — "Identify Your Aesthetic".** Three full-width lifestyle photos, each with a caption, stacked vertically: (1) "Soft forms, natural materials, composed calm"; (2) "Sculptural silhouettes with polished, statement finishes" (shown darkened = the selected/overlay state); (3) "Warm minimalism with timeless & clean proportion". Previous / Proceed. Annotation: "User selects by clicking on the image; the image darkens with a khaki overlay upon selection." **These three captions are the canonical option labels** (they reappear verbatim on p11/p12).

**p3 — "Project Portfolio" (sign in / sign up).** Two columns. Sign In: Email, Password, "Sign In", "Forgot Password". Sign Up: Email, Password, Verify Password, "Agree and Continue", legal line "By signing in or clicking 'Agree and Continue,' you agree to our Terms of Service. Please read our Privacy Policy." Annotation: lighten/remove boxes; progressive disclosure (email → password fades in → sign-in button). **No first/last name or phone field** (current register collects firstName, lastName, phone).

**p4 — "Define the materiality and depth of the environment".** Three mood-board panels, each: large photo, 3×3 image grid, a centred card with a quote, a palette line, and a "Select" button. Card 1 (annotation "Represents: **Organic Modern**"): "I love natural materials like light wood, soft fabrics and earthy stone. Nothing overly glossy or ornate." / "Cream, sand, taupe, olive, clay, and softly aged metal accents". Card 2 ("Represents: **Contemporary Luxe**"): "I'm drawn to rich, luxurious textures — velvets, statement stone, and metal accents that feel refined and intentional." / "Ivory, charcoal, black, brass, polished metal finishes, and deep tonal accents". Card 3 ("Represents: **Midcentury Scandinavian**"): "I'm drawn to inviting textures paired with clean, modern lines — soft fabrics, natural wood, and subtle black details." / "Crisp whites, matte metals, soft greys, khaki, denim blue, and muted mustard accents". Selected = filled dark "Select" button (card 1 shown selected). **The three "Represents:" annotations tie p2/p4's three personas to the three catalogue styles** (`Organic Modern`, `Contemporary Luxe`, `Mid-Century Scandinavian`). p2's persona ↔ style pairing is NOT annotated; p2 caption 1 and card 1 share the words "natural materials", so the order 1=Organic Modern, 2=Contemporary Luxe, 3=Midcentury Scandinavian is the evident pairing (**inferred, confirm with client**).

**p5 — "Determine the tonality of your atmosphere".** Three tall photo columns labelled **Bright & Airy · Warm & Balanced · Dark & Moody**. Previous / Proceed. Single-select.

**p6 — "Specify pattern density".** Three horizontal rows beside a rug photo: **Just Solids** ("You love clean lines, calm energy, and a timeless, uncluttered look. Solids keep your space feeling serene and easy."), **Patterned Accents** ("You enjoy a touch of personality and flair. A patterned pillow, or rug is just enough." — shown selected, khaki fill, white text), **Pattern Forward** ("You embrace a layered aesthetic, skillfully navigating the intersection of complex prints"). Annotation: "Selection has Khaki overlay / Font becomes white".

**p7 — "Select all practical touches that make living effortless" — Living Room (annotation label).** Multi-select 2×3: "Cozy, relaxing space for everyday comfort"; "Pet friendly and durable fabrics"; "Refined space for hosting and socializing" (shown selected); "Dedicated media area for television"; "Storage to keep everything tidy"; "An architectural fireplace to anchor the room".

**p8 — same heading, no room label.** Multi-select 2×2: "Cozy, relaxing space for everyday comfort"; "Pet friendly and durable fabrics"; "Refined space for hosting and socializing" (selected); "Storage to keep everything tidy". Below, a boxed row **"Seating: 4 6 8 10 12"** (single-select numeric; "4" rendered greyed/selected). *The mockup does not say which room this is; seating 4–12 implies Dining Room* (**inferred**).

**p9 — same heading — Bedroom (annotation label).** Multi-select: "Cozy, relaxing space for everyday comfort"; "Pet friendly and durable fabrics"; "Refined space for hosting guests" (selected); "Storage to keep everything tidy"; then a row of three: **"Double Size Bed" · "Queen Size Bed" · "King Size Bed"**. Unspecified whether bed size is single- or multi-select (mockup implies one row of exclusive sizes).

**p10 — "Define your investment".** Single-select list: **$20,000 – $30,000 · $31,000 – $40,000 · $41,000 – $50,000 · $51,000 – $65,000 (selected) · $66,000+**.

**p11 — "Verify System Parameters" (modal/card).** "Your design protocol has been generated based on the following architectural snapshot:" rows: YOUR AESTHETIC = "Soft forms, natural materials, composed calm"; ATMOSPHERE = "Warm & Balanced"; VISUAL LAYERING = "Just solids"; INVESTMENT = "$12,000 – $15,000". Buttons: **Authorize**, link "Refine your selection". Annotation: "View next page if customer selects refine". Note: the verify card shows exactly four fields — room, materiality, practical touches, seating, bed size and photos are not summarised.

**p12 — "Refine Design Parameters".** "Adjust the foundational logic if necessary to align with your final vision." Radio groups: YOUR AESTHETIC (the three p2 captions); ATMOSPHERE ("Bright and airy / Warm and balanced / Dark and moody"); VISUAL LAYERING ("**Mostly Solids / A touch of pattern / Embrace pattern**" — different wording from p6's "Just Solids / Patterned Accents / Pattern Forward"); INVESTMENT (**$12,000–$15,000 · $16,000–$20,000 · $21,000–$25,000 · $26,000–$30,000 · $31,000+**). Buttons: **Update**, link "Maintain Original".

**p13 — "Environmental Context".** "Provide photo(s) and/or floorplan to synchronize our design logic with your physical space." Two boxes: "Upload your photo(s)" [Add Photo] "See Example"; "Upload your floorplan" [Add Plan] "See Example". Button **Generate Design**. Two example modals: *Photo Example* — "Eliminate Clutter (Make sure the room is free of clutter. The less furntiure the better)", "Capture a Wide View (Step back to show the whole space)", "Let There Be Light (Take photos during the day for good lighting)"; *Plan Example* — "Keep it Simple (Use plain paper and a black pen)", "Basic Measurements (Label the length and width of walls in feet or inches)", "Include Door and Windows (Mark where doors and windows are located so we know how furniture should flow.)"; sketch shows 268" × 168" room, 30" door, 100" window, 48" fireplace. Either upload is optional ("photo(s) and/or floorplan").

**p14 — "Synthesizing Your Curation" (loading).** Black screen. "Synchronizing your spatial data and investment parameters with our design logic to realize your vision." Checklist: Calibrating stylistic alignment · Optimizing procurement parameters · Curating Furniture & Finishes · Finalizing room design (last item "+" = in progress). Centre: golden wireframe mesh chair with an olive upholstered cushion. Animation note (verbatim summary): wireframe chair fades in and pulses; bullets check off one by one with soft gold glow; upholstered cushion fades in when bullet 3 hits; when all checked the image glows and dissolves into the final room render; movement "slow, fluid, and 'heavy'… avoid fast or snappy transitions".

**p15 — "Your space is ready." (paywall).** Blurred customer render behind ("Blurred Image of Customers Render", annotation). "Choose a package to reveal your personalised render and curated selections." **Singular Experience — ENGAGEMENT: $1,499 | INSTANT ACCESS** (one living, dining or primary environment; Deliverables: Bespoke Spatial Framework; Principal-Curated Specification; **Refinement Protocol: up to three precision substitutions**; Finalized Architectural Vision, "white-glove logistical orchestration") [Unlock]. **Harmonized Residence — ENGAGEMENT: $4,100 | INSTANT ACCESS** (unified aesthetic across three key living areas e.g. living, dining, primary suite; Unified Spatial Framework; Principal-Curated Specifications; **up to three substitutions per environment**; Integrated Architectural Vision: three finalized room designs) [Unlock]. Typo in source: "esolution".

**p16 — "The Final Edit — Where your design comes together." (cart).** Blurred render header. Line items: **Singular Suite** "A dedicated design experience for one room." qty stepper, $1,499.00, Remove; **Harmonized Residence** "A seamless design journey for three key areas", qty stepper, $4,100.00, Remove. Order Summary: Subtotal, Taxes, Total, **Secure Checkout**, "By clicking 'Secure Checkout,' you agree with our Terms & Conditions, Return Policy and Privacy Policy." Accepted payment methods icons (Visa, Mastercard, AmEx, JCB, UnionPay, Delta, Apple Pay, PayPal). A contact form ("Have questions or looking for guidance? We're happy to help." Name*, Email*, Subject*, Message*, Submit Form).

**p17 — "Payment Methods".** Radio: card (UnionPay, Delta, JCB, Visa, Mastercard, AmEx icons) with Name on card, Card number, Expiry date, CVV; radio PayPal (PayPal Credit badge); radio Apple Pay. "BILL TO": saved address radio (KASH DIMAS, 1003-78 Tecumseth St, Toronto, Ontario, Canada M5V 0A9) or "Add a new destination". Button **Authorize and Initiate**; tagline "We bridge the gap between world-class design and seamless realization". (**Toronto address ⇒ Canadian context; no currency symbol/code anywhere in the document.**)

**p18 — "Your Design Reveal".** "{Customer's Name}, Here is a curated vision for your living room, realized." Full-width render. **"About Your Design"** paragraph (annotation: "This is autogenerated from our AI"): "This space was designed to feel calm the moment you enter — a place that invites you to slow down and settle in. Soft, layered neutrals create a gentle backdrop, while sculptural forms and warm materials add depth and presence without drawing attention to themselves. Light moves easily through the room…". **Curated Selections** card (thumbnail "Shows a piece from their render"): "Each piece has been chosen to support the overall design — You may refine individual selections without disrupting the vision." [View Selections]. "Confirm your specifications below to finalize your procurement brief" [Review Specifications]. "Our design concierge is available to provide a walkthrough of the architectural logic and curatorial intent behind this space." link "Request a walkthrough".

**p19 — "Your Curated Selections".** Subtitle "Selections may be refined, up to three times, while preserving the overall vision." Render on top; product rows: **Clarice Chair, Jane Table, Lux Table**, each "Furniture Details", "Get it Fri Jun 18 – Jun 20", $1,599.00 (identical price on all three — placeholder), qty stepper, "Retain for later", "Remove", **[Refine Item]**. Order Summary: Subtotal, Delivery, Taxes, Total, **Authorize and Inititate** (sic). "Receive samples of the upholstery fabrics used throughout your design — Request Fabric Samples". Accordions: **Custom Craftsmanship**, **White-Glove Delivery**. "Request a walkthrough".

**p20 — same page, accordions open.** Custom Craftsmanship: "Selections within your curation are commissioned to order, allowing proportions, finishes, and technical details to be engineered for your specific style and environment…". White-Glove Delivery: "Upon completion, your furnishings are transitioned with absolute care… professionally delivered, strategically placed, and prepared within your environment…". **Annotation under the T&C line: "I thought we have one return policy? We weren't accepting returns in general? Therefore, we would have one return Policy and wouldn't need to be under every item?"** — i.e. an unresolved returns-policy question, and the client's intent that returns are one global policy, not per-item.

**p21 — pop-ups ("background to fade when window pops up").** (a) **Fabric Samples**: "Obtain a tactile portfolio of specified upholstery textiles prior to commissioning", **$35.00 Fee**, [Add Samples]. (b) **Design Support**: "We ensure every element is meticulously calibrated for your personal signature…", Email field, **[Schedule your 15-Minute Call]**, "A design concierge will follow up within two business days." Annotation: "Email address is sent to our inbox for us to follow up and schedule a call". (c) **Refine This Selection**: three alternative chairs — Stella, Turner, Maho — each $1,599.00, "Furniture Details", "Get it Fri Jun 18 – Jun 20", [Select]; button **"Confirm and see this in your space"**; footer "Your curation includes 3 refinements". (Confirms the swap re-renders the room.)

**p22 — Product detail (Stella Chair).** Hero image; "Engineering and Form" (3 angle thumbnails); **"From the Curator"** narrative ("The Stella balances architectural rigour with an inviting, organic silhouette. It is designed for the quiet corners of a primary suite or as a sculptural anchor in a gallery-style living space — an exercise in restraint and poise.") with annotation "Maybe we should have the AI generate this message too? They aren't aware but the curator would be Genius". Accordions: **Materiality & Composition** (Structure: [Frame/legs/base material and finish]; Seat Upholstery: [Fabric type, colour, composition]; Feel: [Soft / textured / smooth / durable / refined]) — bracketed placeholders map to catalogue columns *Structure, Upholstery/Fabric Composition, Fabric Feel*; **Product Dimensions** (30.71"W × 28.5"D × 29.13"H; 78 W × 72 D × 74 H cm — inches and cm); **Production Timeline** ("8 – 16 weeks (This item is made to order)" — maps to catalogue *Lead Time*); **Preservation & Longevity** (fabric / leather / wood / metal care copy). [Back to Collection].

## Comparison with the current implementation

Current quiz = 7 steps (`client/src/pages/Quiz.tsx:30`): Room → Style → Colour+Materials → Features → Budget → Vibe (inspiration upload) → Final (photo/floorplan/description).

| Item | Consultation | Current | Status |
|---|---|---|---|
| Rooms | Living, Dining, Bedroom | 4 incl. Home Office (`RoomTypeStepV2.tsx:16-19`) | CHANGED (drop Home Office) |
| Room step CTA/heading | "Select the space you will be elevating" / "Initiate the Refinement" | "Which room do you dream of transforming first?" / Next | CHANGED |
| Style | 3 personas (p2) ↔ Organic Modern / Contemporary Luxe / Midcentury Scandinavian | 5 styles: Organic Modern, Modern Farmhouse, Midcentury Scandi, Contemporary Luxe, Warm Transitional (`StyleSelectionStepV2.tsx:25-53`) | CHANGED (5→3; Farmhouse and Warm Transitional dropped) |
| Materiality (p4) | separate step, 3 quote+palette cards | colour palettes + textures combined step (`ColorMaterialsStepV2.tsx`) | CHANGED |
| Atmosphere | explicit step, 3 options | no field; quiz has `colorPalettes`; mapper hard-codes `atmosphere = null` (`server/services/ai-adapter/design-profile-mapper.ts`) | **NEW — closes item 20's atmosphere blocker** |
| Pattern density | 3 options | verify field `patternPreference` exists in schema | CHANGED wording (also p6 vs p12 wording differ) |
| Practical touches | room-scoped, lifestyle phrasing; dining seating 4–12; bedroom bed size | icon-based feature list (`FeaturesStepV2`), no seating/bed size | CHANGED + 2 NEW fields |
| Budget | $20K–$66K+ (p10); refine bands $12K–$31K+ (p12); verify $12–15K (p11) | $2K–$20K+ (`BudgetStepV2.tsx:18-23`) | CHANGED and **internally inconsistent** |
| Verify + Refine | new gate before generation | none | NEW |
| Photos/floorplan | one step, both optional, with example modals | `FinalStepV2`/`FloorplanStep` | CHANGED (guidance copy) |
| Loading | narrative checklist + chair animation | spinner + design facts (`Loading.tsx`) | CHANGED |
| Package paywall (p15) | pay $1,499/$4,100 to reveal render | none | NEW (product decision) |
| Cart / payment (p16–17) | packages + Secure Checkout, cards/PayPal/Apple Pay | product cart exists (`/cart`) but not package-based; no payment processor | NEW |
| Reveal + AI narrative (p18) | AI "About Your Design" text | none | NEW |
| Curated selections + refine ×3 (p19–21) | swap up to 3 times, re-render | `Results.tsx` swap exists (alternatives endpoint missing — STATUS item 21) | NEW/CHANGED |
| Fabric samples $35, concierge call (p19–21) | add-ons | none | NEW |
| Product page (p22) | narrative-rich PDP, AI curator text | basic | CHANGED |
| Auth page (p3) | email-first, no name/phone | register collects first/last name + phone | CHANGED |

## Contradictions with existing ADRs / STATUS.md (facts, no recommendations)

1. **Payment before reveal** (p15–17) contradicts the current free-render flow and `ADR-0018`'s demo scope, which contains no payment surface. `ADR-0016`'s no-fabrication rule still applies to whatever is shown blurred/unlocked.
2. **"Refinement Protocol" swaps re-render the room** (p21 "see this in your space") — depends on room image generation that `ADR-0011`/`ADR-0018`/`ADR-0020` record as unbuilt; per-piece regeneration is beyond rooms P1–P3.
3. **Three catalogue styles vs five UI styles**: the supplier workbooks (Celadon/Lazzoni/Luxus) contain exactly 3 `Design Style` values, 3 `Atmosphere` values and 3 `Room Type` values; the consultation matches those three-by-three-by-three. The current UI's 5 styles do not.
4. **`ADR-0006`/`ADR-0013` leakage firewall**: `Room Type`, `Design Style`, `Atmosphere` are label-source fields kept out of recommendation's `Product`; the new quiz makes them primary *query* inputs (fine) — but any catalogue-side use of those tags for ranking still needs the `ai-ml-lead` ruling.
5. **Budget scale**: catalogue retail prices are per-piece (e.g. the Luxus/Lazzoni sofas in the tens of thousands, artwork ~$1,000); consultation shows placeholder products at $1,599 each against a $12K–$66K budget. Unresolved whether "investment" is product spend or includes the engagement fee (p15).
6. **Returns**: p20 annotation says the client is unsure returns are accepted at all; the footer links "Returns & Exchanges" and p16 links a "Return Policy". Contradicts `docs/` delivery/returns copy if any exists — no policy text is supplied.

## Ambiguities that block or shape engineering (each needs a client answer)

A1. **p2 vs p4**: two three-way "style" screens. Are they two steps (aesthetic, then materiality) or one revised design? Verify/refine (p11–12) only show "YOUR AESTHETIC" with p2's captions. p4 has no place in the summary.
A2. **p8 room**: which room shows Seating 4–12 (unlabelled)? Is seating dining-only? Do Living/Bedroom also get a seating question?
A3. **Bed size**: single-select? Does it filter beds (catalogue has `Bed` products; check size data exists) or only inform the render?
A4. **Budget bands**: p10 ($20K+ bands) vs p12 ($12K–$31K+ bands) vs p11 ($12–15K) cannot all be right; which set is the quiz's?
A5. **Package vs rooms**: Singular = one of living/dining/primary; Harmonized = three rooms. Does the quiz run once per room (3× for Harmonized) or is the room picked at p1 only for Singular?
A6. **Currency** (no code shown; Toronto billing address). Project owner has stated: default **CAD**, configurable.
A7. **Wording drift** p6 vs p12 for pattern density: which strings are stored?
A8. **AI-generated copy**: "About Your Design" (p18) and "From the Curator" (p22) — LLM-generated per render/product? Which model, what grounding, what fail-closed behaviour (ADR-0016)?
A9. **Returns policy text**, **payment processor**, **concierge scheduling mechanism** (email-only per p21 annotation), **fabric sample fulfilment**, **delivery date logic** ("Get it Fri Jun 18 – Jun 20" vs catalogue "Lead Time" and p22 "8–16 weeks made to order" — contradictory delivery promises).
A10. **Names on auth**: the reveal greets "{Customer's Name}" but the sign-up mockup collects no name.

## Open questions this document answers (or does not)

- **Atmosphere source (STATUS item 20)**: ANSWERED — p5 supplies the missing quiz field with exactly the three catalogue values ("Bright & Airy", "Warm & Balanced", "Dark & Moody").
- **Currency (STATUS "needs the client" item 14)**: NOT answered by the document; owner's verbal answer is CAD default/configurable.
- **`OQ-010` room photos/floorplans**: partially informed — p13 shows the capture UX and guidance, no dimension-parsing rules.
- **`OQ-007`/`OQ-008`** (hex library, LRV): NOT answered — p4's palettes are colour *names* only.
