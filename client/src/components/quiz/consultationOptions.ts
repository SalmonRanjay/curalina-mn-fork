import livingRoomImg from "@assets/generated_images/modern_luxury_living_room.png";
import diningRoomImg from "@assets/generated_images/sophisticated_dining_room.png";
import bedroomImg from "@assets/generated_images/elegant_master_bedroom.png";
import organicModernImg from "@assets/generated_images/organic_modern_living_room.png";
import contemporaryLuxImg from "@assets/generated_images/contemporary_luxe_living_room.png";
import midcenturyImg from "@assets/generated_images/midcentury_scandi_living_room.png";
import atmBright from "@/assets/atmosphere-bright-airy.jpg";
import atmWarm from "@/assets/atmosphere-warm-balanced.jpg";
import atmDark from "@/assets/atmosphere-dark-moody.jpg";
import gridOrganic from "@/assets/materiality-grid-organic-modern.jpg";
import gridLuxe from "@/assets/materiality-grid-contemporary-luxe.jpg";
import gridScandi from "@/assets/materiality-grid-midcentury-scandinavian.jpg";

// Option strings are canonical, taken verbatim from docs/consultation-1/EXTRACTION.md.

export const ROOMS = [
  { id: "Living Room", label: "LIVING ROOM", image: livingRoomImg },
  { id: "Dining Room", label: "DINING ROOM", image: diningRoomImg },
  { id: "Bedroom", label: "BEDROOM", image: bedroomImg },
];

// persona 1/2/3 -> canonical catalogue style (p4 "Represents:" annotations; the
// p2 pairing is inferred by order in EXTRACTION.md and needs client confirmation).
export const AESTHETICS = [
  { style: "Organic Modern", caption: "Soft forms, natural materials, composed calm", image: organicModernImg },
  { style: "Contemporary Luxe", caption: "Sculptural silhouettes with polished, statement finishes", image: contemporaryLuxImg },
  { style: "Mid-Century Scandinavian", caption: "Warm minimalism with timeless & clean proportion", image: midcenturyImg },
];

export const MATERIALITY = [
  {
    style: "Organic Modern",
    quote: "I love natural materials like light wood, soft fabrics and earthy stone. Nothing overly glossy or ornate.",
    palette: "Cream, sand, taupe, olive, clay, and softly aged metal accents",
    photo: organicModernImg,
    grid: gridOrganic,
  },
  {
    style: "Contemporary Luxe",
    quote: "I'm drawn to rich, luxurious textures — velvets, statement stone, and metal accents that feel refined and intentional.",
    palette: "Ivory, charcoal, black, brass, polished metal finishes, and deep tonal accents",
    photo: contemporaryLuxImg,
    grid: gridLuxe,
  },
  {
    style: "Mid-Century Scandinavian",
    quote: "I'm drawn to inviting textures paired with clean, modern lines — soft fabrics, natural wood, and subtle black details.",
    palette: "Crisp whites, matte metals, soft greys, khaki, denim blue, and muted mustard accents",
    photo: midcenturyImg,
    grid: gridScandi,
  },
];

export const ATMOSPHERES = [
  { id: "Bright & Airy", refineLabel: "Bright and airy", image: atmBright },
  { id: "Warm & Balanced", refineLabel: "Warm and balanced", image: atmWarm },
  { id: "Dark & Moody", refineLabel: "Dark and moody", image: atmDark },
];

// Stored values are the p6 titles; p12 wording is display-only and maps back to these.
export const PATTERNS = [
  { id: "Just Solids", refineLabel: "Mostly Solids", description: "You love clean lines, calm energy, and a timeless, uncluttered look. Solids keep your space feeling serene and easy." },
  { id: "Patterned Accents", refineLabel: "A touch of pattern", description: "You enjoy a touch of personality and flair. A patterned pillow, or rug is just enough." },
  { id: "Pattern Forward", refineLabel: "Embrace pattern", description: "You embrace a layered aesthetic, skillfully navigating the intersection of complex prints" },
];

export const TOUCHES_BY_ROOM: Record<string, string[]> = {
  "Living Room": [
    "Cozy, relaxing space for everyday comfort",
    "Pet friendly and durable fabrics",
    "Refined space for hosting and socializing",
    "Dedicated media area for television",
    "Storage to keep everything tidy",
    "An architectural fireplace to anchor the room",
  ],
  // p8 is unlabelled in the mockup; treated as Dining (seating 4-12). Assumption.
  "Dining Room": [
    "Cozy, relaxing space for everyday comfort",
    "Pet friendly and durable fabrics",
    "Refined space for hosting and socializing",
    "Storage to keep everything tidy",
  ],
  Bedroom: [
    "Cozy, relaxing space for everyday comfort",
    "Pet friendly and durable fabrics",
    "Refined space for hosting guests",
    "Storage to keep everything tidy",
  ],
};

export const SEATING_OPTIONS = [4, 6, 8, 10, 12];
export const BED_SIZES = ["Double Size Bed", "Queen Size Bed", "King Size Bed"];

// id = stored value (BudgetStepV2 style), label = display text from p10.
export const INVESTMENTS = [
  { id: "$20,000-$30,000", label: "$20,000 - $30,000" },
  { id: "$31,000-$40,000", label: "$31,000 - $40,000" },
  { id: "$41,000-$50,000", label: "$41,000 - $50,000" },
  { id: "$51,000-$65,000", label: "$51,000 - $65,000" },
  { id: "$66,000+", label: "$66,000+" },
];
