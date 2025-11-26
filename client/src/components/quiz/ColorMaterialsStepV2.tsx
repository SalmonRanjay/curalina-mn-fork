import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

import lightNeutralsImg from "@assets/stock_images/light_neutral_color__59c65d92.jpg";
import warmCozyImg from "@assets/stock_images/warm_cozy_brown_terr_dfc3dcc9.jpg";
import darkMoodyImg from "@assets/stock_images/dark_moody_interior__3a50dda4.jpg";
import colorfulAccentImg from "@assets/stock_images/colorful_accent_inte_ab53f086.jpg";
import materialsImg1 from "@assets/stock_images/interior_design_mate_4cf2d356.jpg";
import materialsImg2 from "@assets/stock_images/interior_design_mate_a8749c2c.jpg";
import materialsImg3 from "@assets/stock_images/interior_design_mate_e9262ba4.jpg";

const palettes = [
  {
    id: "Light Neutrals",
    label: "Light Neutrals",
    image: lightNeutralsImg,
    description: "Creamy whites, soft beiges, warm greys",
  },
  {
    id: "Warm & Cozy",
    label: "Warm & Cozy",
    image: warmCozyImg,
    description: "Terracotta, caramel, rich browns",
  },
  {
    id: "Dark & Moody",
    label: "Dark & Moody",
    image: darkMoodyImg,
    description: "Deep charcoal, midnight hues",
  },
  {
    id: "Colourful Accent",
    label: "Colourful Accent",
    image: colorfulAccentImg,
    description: "Bold pops on neutral foundations",
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
    transition: { staggerChildren: 0.08 },
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
      {/* Section 1: Color Palettes */}
      <div className="mb-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-8">
            <p
              className="uppercase tracking-[0.2em] text-muted-foreground mb-4"
              style={{ fontSize: "11px" }}
            >
              01 — Colour Story
            </p>
            <h2
              className="font-serif text-foreground leading-tight mb-4"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 400 }}
            >
              Which palette speaks to you?
            </h2>
            <p
              className="text-muted-foreground leading-relaxed"
              style={{ fontSize: "var(--font-size-sm)" }}
            >
              Select up to {maxColorSelections} that resonate with your vision. 
              These tones will guide our curation.
            </p>
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-muted-foreground italic" style={{ fontSize: "var(--font-size-xs)" }}>
                {colorPalettes.length} of {maxColorSelections} selected
              </p>
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-8 grid grid-cols-2 gap-3"
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
                    className="group relative aspect-[4/5] cursor-pointer overflow-hidden"
                    data-testid={`select-palette-${palette.id.toLowerCase().replace(/ /g, "-").replace(/&/g, "and")}`}
                  >
                    <img
                      src={palette.image}
                      alt={palette.label}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute inset-0 ring-2 ring-white ring-inset"
                      />
                    )}
                    
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h3
                            className="text-white font-serif mb-1"
                            style={{ fontSize: "var(--font-size-lg)" }}
                          >
                            {palette.label}
                          </h3>
                          <p className="text-white/70" style={{ fontSize: "12px" }}>
                            {palette.description}
                          </p>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-7 h-7 bg-white rounded-full flex items-center justify-center flex-shrink-0"
                          >
                            <Check className="w-4 h-4 text-black" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Section 2: Mode & Materials - Editorial Layout */}
      <div className="mb-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left: Editorial Image Column */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-8">
              <div className="relative aspect-[3/4] overflow-hidden mb-6">
                <img
                  src={materialsImg1}
                  alt="Materials inspiration"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p
                    className="text-white/80 uppercase tracking-[0.15em] mb-2"
                    style={{ fontSize: "10px" }}
                  >
                    02 — Define Your Aesthetic
                  </p>
                  <h3 className="text-white font-serif" style={{ fontSize: "var(--font-size-xl)" }}>
                    Materials that tell your story
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="aspect-square overflow-hidden">
                  <img src={materialsImg2} alt="Textures" className="w-full h-full object-cover" />
                </div>
                <div className="aspect-square overflow-hidden">
                  <img src={materialsImg3} alt="Finishes" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Selection Cards */}
          <div className="lg:col-span-7 space-y-12">
            {/* Style Mode */}
            <div>
              <p
                className="uppercase tracking-[0.15em] text-muted-foreground mb-3"
                style={{ fontSize: "11px" }}
              >
                Your Design Language
              </p>
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
                      className={`group flex items-center justify-between p-4 cursor-pointer transition-all duration-300 border-b ${
                        isSelected
                          ? "bg-accent/5 border-foreground"
                          : "border-border hover:bg-accent/5 hover:border-foreground/30"
                      }`}
                      data-testid={`line-style-${mode.id.toLowerCase()}`}
                    >
                      <div className="flex items-baseline gap-4">
                        <span
                          className={`font-serif transition-colors ${isSelected ? "text-foreground" : "text-foreground/80"}`}
                          style={{ fontSize: "var(--font-size-lg)" }}
                        >
                          {mode.label}
                        </span>
                        <span
                          className="text-muted-foreground hidden sm:inline"
                          style={{ fontSize: "var(--font-size-xs)" }}
                        >
                          {mode.description}
                        </span>
                      </div>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-background" />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Materials & Textures */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <p
                  className="uppercase tracking-[0.15em] text-muted-foreground"
                  style={{ fontSize: "11px" }}
                >
                  Material Palette
                </p>
                <p className="text-muted-foreground italic" style={{ fontSize: "11px" }}>
                  Select up to {maxTextureSelections}
                </p>
              </div>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                {textureOptions.map((texture) => {
                  const isSelected = selectedTextures.includes(texture.id);
                  return (
                    <motion.div
                      key={texture.id}
                      variants={itemVariants}
                      onClick={() => handleTextureToggle(texture.id)}
                      className={`relative p-4 cursor-pointer transition-all duration-300 text-center ${
                        isSelected
                          ? "bg-foreground text-background"
                          : "bg-accent/5 hover:bg-accent/10 text-foreground"
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
      </div>

      {/* Section 3: Pattern Preference - Full Width Editorial */}
      <div>
        <div className="text-center mb-10">
          <p
            className="uppercase tracking-[0.2em] text-muted-foreground mb-3"
            style={{ fontSize: "11px" }}
          >
            03 — Pattern Philosophy
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
          {patternOptions.map((pattern, idx) => {
            const isSelected = patternPreference === pattern.id;
            return (
              <motion.div
                key={pattern.id}
                variants={itemVariants}
                onClick={() => onPatternChange(pattern.id)}
                className={`relative p-8 cursor-pointer transition-all duration-300 text-center group ${
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-accent/5 hover:bg-accent/10"
                }`}
                data-testid={`pattern-${pattern.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <p
                  className={`uppercase tracking-[0.1em] mb-3 ${isSelected ? "text-background/60" : "text-muted-foreground"}`}
                  style={{ fontSize: "10px" }}
                >
                  {pattern.subtitle}
                </p>
                <h3
                  className="font-serif mb-3"
                  style={{ fontSize: "var(--font-size-xl)" }}
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
