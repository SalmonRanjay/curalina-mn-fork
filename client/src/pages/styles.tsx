import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STYLES_DATA = [
  {
    name: "Midcentury Scandi",
    description: "Vintage, retro, functional, warm, clean, natural, refined",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop",
    moodWords: "Vintage, retro, functional, warm, clean, natural, refined",
    textures: "Woods are a staple like oak and walnut, often paired with leather, durable wools, cotton and matte metals",
    furniture: "Furniture has clean lines, soft curves, and minimalist forms, with natural wood finishes and tapered legs that add timeless warmth and function.",
    colorPalette: "Soft neutrals like off-white, warm beige, and light grey form a timeless base. Accents in sage, teal, mustard, burnt orange, and burgundy add retro warmth and contrast."
  },
  {
    name: "Organic Modern",
    description: "Earthy, uncluttered, tranquil, zen-inspired, textural, rounded edges",
    image: "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop",
    moodWords: "Earthy, uncluttered, tranquil, zen-inspired, textural, rounded edges, plush, minimalistic",
    textures: "Breathable linens, soft cotton, cozy bouclé paired with warm oaks, tactile rugs, neutral matte stones, clay & plaster",
    furniture: "Furniture features low-profile, minimalist designs with soft curves and sculpted edges, replacing harsh modern angles.",
    colorPalette: "Whites, bones, chalks & earthy neutrals with small nature-inspired accents of sage, terracotta"
  },
  {
    name: "Artful Eclectic",
    description: "Unexpected, playful, expressive, soulful, layered, creative, vibrant",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
    moodWords: "Unexpected, playful, expressive, soulful, layered, creative, vibrant, bold, eclectic",
    textures: "Mixed fabrics of velvet, linen, silk/satin accented with patterned textiles, rugs, natural distressed materials, lacquered surfaces, and glamorous metals/mirrors",
    furniture: "Harmonious yet mismatched pieces with a mix of eras (vintage & modern), styles and global inspired designs",
    colorPalette: "Jewel tones add drama and depth, grounded by neutrals like charcoal, ivory, warm browns, white, & black"
  },
  {
    name: "Modern Farmhouse",
    description: "Rustic, casual, heritage-inspired, cozy, wholesome, vintage charm",
    image: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=600&fit=crop",
    moodWords: "Rustic, casual, heritage-inspired, cozy, wholesome, vintage charm, worn-in",
    textures: "Distressed and whitewashed woods, matte stones, exposed brick, butcher blocks, knits, boucle, woven wool, cotton and linen",
    furniture: "Oversized armchairs, plush slipcovered sofas that invite relaxation with built-in storage",
    colorPalette: "Foundational neutrals of creamy white and greige, contrasting accents of black metals and nature inspired hues of deep green, pale blue and terracotta"
  },
  {
    name: "Warm Transitional",
    description: "Timeless blend of traditional and modern, refined, classic, polished",
    image: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&h=600&fit=crop",
    moodWords: "Timeless blend of traditional and modern, with tailored comfort and understated elegance that's refined, classic, and polished",
    textures: "Polished metals, rich woods, velvet upholstery, chenille, bouclé, silk drapes, and veined marble surfaces",
    furniture: "Combines traditional curves with modern clean lines, subtle nailhead trim, piping and metal knobs",
    colorPalette: "Creamy white, warm greige, charcoal grey, espresso brown, bronze, brushed gold, antique nickel, soft blush, mauve, pewter, sage green, dusty blue, slate blue"
  },
  {
    name: "Modern Luxe",
    description: "Sophisticated, minimal yet rich, polished, glamorous, refined, sleek",
    image: "https://images.unsplash.com/photo-1600566753414-2afc9e2f5a28?w=800&h=600&fit=crop",
    moodWords: "Sophisticated, minimal yet rich, polished, glamorous, refined, sleek, chic, upscale, curated",
    textures: "Plush velvet, vegan furs, high performance linen, leather, lacquered surfaces, smooth woods & finishes, polished or honed marbles, quarzite and travertines",
    furniture: "Clean sculptural lines, sleek silhouettes, gentle curves, architectural forms, statement pieces, art-inspired design, polished finishes, high-end materials, luxury accent chairs, curated furniture",
    colorPalette: "Ivory white, bone white, warm taupe, greige, putty beige, charcoal grey, matte black, espresso brown, brushed gold, antique brass, emerald green, sapphire blue, dusty rose, muted mauve"
  }
];

export default function Styles() {
  const [expandedStyles, setExpandedStyles] = useState<number[]>([]);

  const toggleExpanded = (idx: number) => {
    setExpandedStyles(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />
      <div className="h-28"></div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold mb-4" data-testid="heading-explore-styles">Explore Styles</h1>
        <p className="text-xl text-stone-600 dark:text-stone-400 mb-12">
          Discover our curated interior design styles and find the perfect look for your space.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {STYLES_DATA.map((style, idx) => {
            const isExpanded = expandedStyles.includes(idx);
            
            return (
              <Card key={idx} className="overflow-hidden hover-elevate" data-testid={`style-card-${idx}`}>
                <img
                  src={style.image}
                  alt={style.name}
                  className="w-full h-64 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-2">{style.name}</h3>
                  <p className="text-stone-600 dark:text-stone-400 mb-4">{style.description}</p>

                  {/* Key Characteristics Toggle */}
                  <button
                    onClick={() => toggleExpanded(idx)}
                    className="flex items-center gap-2 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"
                    data-testid={`key-characteristics-toggle-${idx}`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                    <span className="text-sm font-semibold">Key Characteristics</span>
                  </button>

                  {/* Expandable Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-3 text-sm">
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-200">Mood Words:</p>
                            <p className="text-stone-600 dark:text-stone-400">{style.moodWords}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-200">Textures:</p>
                            <p className="text-stone-600 dark:text-stone-400">{style.textures}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-200">Furniture Style:</p>
                            <p className="text-stone-600 dark:text-stone-400">{style.furniture}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-200">Color Palette:</p>
                            <p className="text-stone-600 dark:text-stone-400">{style.colorPalette}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
