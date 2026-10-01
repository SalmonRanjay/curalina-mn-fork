import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

import warmNeutralsImg from "@assets/generated_images/warm_neutrals_interior_palette.png";
import earthStoneImg from "@assets/generated_images/earth_stone_interior_palette.png";
import coastalCalmImg from "@assets/generated_images/coastal_calm_interior_palette.png";
import softContrastImg from "@assets/generated_images/soft_contrast_interior_palette.png";
import monochromeLuxeImg from "@assets/generated_images/monochrome_luxe_interior_palette.png";
import artfulContrastImg from "@assets/generated_images/artful_contrast_interior_palette.png";
import heritageWarmthImg from "@assets/generated_images/heritage_warmth_interior_palette.png";
import darkMoodyImg from "@assets/generated_images/dark_moody_interior_palette.png";

const palettes = [
  {
    id: "Warm Neutrals",
    label: "Warm Neutrals",
    image: warmNeutralsImg,
    description: "Creamy beiges, soft tans, inviting warmth",
  },
  {
    id: "Earth & Stone",
    label: "Earth & Stone",
    image: earthStoneImg,
    description: "Terracotta, clay, natural organic tones",
  },
  {
    id: "Coastal Calm",
    label: "Coastal Calm",
    image: coastalCalmImg,
    description: "Soft blues, sandy beiges, serene whites",
  },
  {
    id: "Soft Contrast",
    label: "Soft Contrast",
    image: softContrastImg,
    description: "Muted complementary tones, gentle harmony",
  },
  {
    id: "Monochrome Luxe",
    label: "Monochrome Luxe",
    image: monochromeLuxeImg,
    description: "Sophisticated blacks, whites, elegant greys",
  },
  {
    id: "Artful Contrast",
    label: "Artful Contrast",
    image: artfulContrastImg,
    description: "Bold jewel tones, curated color stories",
  },
  {
    id: "Heritage Warmth",
    label: "Heritage Warmth",
    image: heritageWarmthImg,
    description: "Deep burgundy, rich gold, timeless elegance",
  },
  {
    id: "Dark & Moody",
    label: "Dark & Moody",
    image: darkMoodyImg,
    description: "Deep charcoal, midnight hues, dramatic",
  },
];

const modeOptions = [
  { id: "Classic", label: "Classic", description: "Timeless elegance" },
  { id: "Transitional", label: "Transitional", description: "Balanced blend" },
  { id: "Modern", label: "Modern", description: "Clean & current" },
  { id: "Eclectic", label: "Eclectic", description: "Curated mix" },
  { id: "Relaxed", label: "Relaxed", description: "Easy living" },
];

const textureOptions = [
  { id: "Leather, Wool", label: "Leather & Wool" },
  { id: "Rattan, Wicker, Jute", label: "Natural Weaves" },
  { id: "Walnut", label: "Rich Woods" },
  { id: "Velvet, Brass, Smoked Glass", label: "Luxe Metals" },
  { id: "White Oak, Linen, Travertine", label: "Soft Naturals" },
  { id: "Satin, Metallics", label: "Polished Finishes" },
];

const patternOptions = [
  {
    id: "Just Solids",
    label: "Solids Only",
    subtitle: "Pure & Minimal",
    description: "Clean lines and calm energy for a timeless, uncluttered aesthetic",
  },
  {
    id: "Patterned Accents",
    label: "Subtle Patterns",
    subtitle: "Thoughtful Details",
    description: "A touch of personality through carefully chosen accents",
  },
  {
    id: "I Love Patterns",
    label: "Bold Expression",
    subtitle: "Vibrant & Layered",
    description: "Adventurous mixing and expressive, dynamic energy",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface ColorMaterialsStepV2Props {
  colorPalettes: string[];
  lineStyle: string;
  selectedTextures: string[];
  patternPreference: string;
  onColorChange: (palettes: string[]) => void;
  onLineStyleChange: (style: string) => void;
  onTexturesChange: (textures: string[]) => void;
  onPatternChange: (pattern: string) => void;
  maxColorSelections?: number;
  maxTextureSelections?: number;
}

export default function ColorMaterialsStepV2({
  colorPalettes,
  lineStyle,
  selectedTextures,
  patternPreference,
  onColorChange,
  onLineStyleChange,
  onTexturesChange,
  onPatternChange,
  maxColorSelections = 2,
  maxTextureSelections = 2,
}: ColorMaterialsStepV2Props) {
  const handleColorSelect = (paletteId: string) => {
    if (colorPalettes.includes(paletteId)) {
      onColorChange(colorPalettes.filter((v) => v !== paletteId));
    } else if (colorPalettes.length < maxColorSelections) {
      onColorChange([...colorPalettes, paletteId]);
    }
  };

  const handleTextureToggle = (textureId: string) => {
    if (selectedTextures.includes(textureId)) {
      onTexturesChange(selectedTextures.filter((t) => t !== textureId));
    } else if (selectedTextures.length < maxTextureSelections) {
      onTexturesChange([...selectedTextures, textureId]);
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    callback: () => void
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Section 1: Color Palettes - Full Width Grid */}
      <div className="mb-16">
        <div className="text-center mb-10">
          <p
            className="uppercase tracking-[0.25em] text-muted-foreground mb-4"
            style={{ fontSize: "11px", letterSpacing: "0.25em" }}
          >
            Colour Story
          </p>
          <h2
            className="font-serif text-foreground leading-tight mb-3"
            style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 400 }}
          >
            Which palette speaks to you?
          </h2>
          <p
            className="text-muted-foreground max-w-xl mx-auto"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Select up to {maxColorSelections} colour schemes that resonate with your vision
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          {palettes.map((palette) => {
            const isSelected = colorPalettes.includes(palette.id);
            return (
              <motion.div key={palette.id} variants={itemVariants}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleColorSelect(palette.id)}
                  onKeyDown={(e) => handleKeyDown(e, () => handleColorSelect(palette.id))}
                  className={`group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-sm transition-all duration-300 ${
                    isSelected
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "hover:ring-1 hover:ring-border"
                  }`}
                  data-testid={`select-palette-${palette.id.toLowerCase().replace(/ /g, "-").replace(/&/g, "and")}`}
                >
                  <img
                    src={palette.image}
                    alt={palette.label}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <h3
                          className="text-white font-serif truncate"
                          style={{ fontSize: "clamp(0.875rem, 2vw, 1.125rem)" }}
                        >
                          {palette.label}
                        </h3>
                        <p 
                          className="text-white/70 line-clamp-2 mt-1" 
                          style={{ fontSize: "11px", lineHeight: 1.4 }}
                        >
                          {palette.description}
                        </p>
                      </div>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0"
                        >
                          <Check className="w-3.5 h-3.5 text-black" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="text-center mt-6">
          <p className="text-muted-foreground" style={{ fontSize: "var(--font-size-xs)" }}>
            {colorPalettes.length} of {maxColorSelections} selected
          </p>
        </div>
      </div>

      {/* Section 2: Design Language & Materials */}
      <div className="mb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Design Language */}
          <div>
            <div className="mb-6">
              <p
                className="uppercase tracking-[0.25em] text-muted-foreground mb-3"
                style={{ fontSize: "11px" }}
              >
                Design Language
              </p>
              <h3
                className="font-serif text-foreground"
                style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)", fontWeight: 400 }}
              >
                How would you describe your style?
              </h3>
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {modeOptions.map((mode) => {
                const isSelected = lineStyle === mode.id;
                return (
                  <motion.div
                    key={mode.id}
                    variants={itemVariants}
                    onClick={() => onLineStyleChange(mode.id)}
                    className={`group flex items-center justify-between p-4 cursor-pointer transition-all duration-300 border ${
                      isSelected
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent border-border hover:border-foreground/50"
                    }`}
                    data-testid={`line-style-${mode.id.toLowerCase()}`}
                  >
                    <div className="flex items-baseline gap-4">
                      <span
                        className="font-serif"
                        style={{ fontSize: "var(--font-size-base)" }}
                      >
                        {mode.label}
                      </span>
                      <span
                        className={`hidden sm:inline ${isSelected ? "text-background/70" : "text-muted-foreground"}`}
                        style={{ fontSize: "var(--font-size-xs)" }}
                      >
                        {mode.description}
                      </span>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-background flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-foreground" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Materials & Textures */}
          <div>
            <div className="mb-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <p
                    className="uppercase tracking-[0.25em] text-muted-foreground mb-3"
                    style={{ fontSize: "11px" }}
                  >
                    Material Palette
                  </p>
                  <h3
                    className="font-serif text-foreground"
                    style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)", fontWeight: 400 }}
                  >
                    Which textures draw you in?
                  </h3>
                </div>
                <p className="text-muted-foreground" style={{ fontSize: "11px" }}>
                  Select up to {maxTextureSelections}
                </p>
              </div>
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3"
            >
              {textureOptions.map((texture) => {
                const isSelected = selectedTextures.includes(texture.id);
                return (
                  <motion.div
                    key={texture.id}
                    variants={itemVariants}
                    onClick={() => handleTextureToggle(texture.id)}
                    className={`relative p-4 cursor-pointer transition-all duration-300 text-center border ${
                      isSelected
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent border-border hover:border-foreground/50"
                    }`}
                    data-testid={`texture-${texture.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <p
                      className="font-medium"
                      style={{ fontSize: "var(--font-size-sm)" }}
                    >
                      {texture.label}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Section 3: Pattern Preference */}
      <div>
        <div className="text-center mb-8">
          <p
            className="uppercase tracking-[0.25em] text-muted-foreground mb-3"
            style={{ fontSize: "11px" }}
          >
            Pattern Philosophy
          </p>
          <h2
            className="font-serif text-foreground"
            style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 400 }}
          >
            How do you feel about patterns?
          </h2>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto"
        >
          {patternOptions.map((pattern) => {
            const isSelected = patternPreference === pattern.id;
            return (
              <motion.div
                key={pattern.id}
                variants={itemVariants}
                onClick={() => onPatternChange(pattern.id)}
                className={`relative p-8 cursor-pointer transition-all duration-300 text-center border ${
                  isSelected
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-border hover:border-foreground/50"
                }`}
                data-testid={`pattern-${pattern.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <p
                  className={`uppercase tracking-[0.15em] mb-3 ${isSelected ? "text-background/60" : "text-muted-foreground"}`}
                  style={{ fontSize: "10px" }}
                >
                  {pattern.subtitle}
                </p>
                <h3
                  className="font-serif mb-3"
                  style={{ fontSize: "var(--font-size-lg)" }}
                >
                  {pattern.label}
                </h3>
                <p
                  className={`leading-relaxed ${isSelected ? "text-background/80" : "text-muted-foreground"}`}
                  style={{ fontSize: "var(--font-size-xs)" }}
                >
                  {pattern.description}
                </p>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-4 right-4 w-6 h-6 rounded-full bg-background flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-foreground" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
