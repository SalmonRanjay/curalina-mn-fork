import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

import lightNeutralsImg from "@assets/stock_images/light_neutral_color__59c65d92.jpg";
import warmCozyImg from "@assets/stock_images/warm_cozy_brown_terr_dfc3dcc9.jpg";
import darkMoodyImg from "@assets/stock_images/dark_moody_interior__3a50dda4.jpg";
import colorfulAccentImg from "@assets/stock_images/colorful_accent_inte_ab53f086.jpg";

const palettes = [
  {
    id: "Light Neutrals",
    label: "LIGHT NEUTRALS",
    image: lightNeutralsImg,
    description: "Creamy whites, soft beiges, warm greys",
  },
  {
    id: "Warm & Cozy",
    label: "WARM & COZY",
    image: warmCozyImg,
    description: "Terracotta, caramel, rich browns",
  },
  {
    id: "Dark & Moody",
    label: "DARK & MOODY",
    image: darkMoodyImg,
    description: "Deep charcoal, midnight hues, dramatic tones",
  },
  {
    id: "Colourful Accent",
    label: "COLOURFUL ACCENT",
    image: colorfulAccentImg,
    description: "Bold pops of color on neutral foundations",
  },
];

const lineStyles = [
  { id: "Classic", label: "Classic" },
  { id: "Transitional", label: "Transitional" },
  { id: "Modern", label: "Modern" },
  { id: "Eclectic", label: "Eclectic" },
  { id: "Relaxed", label: "Relaxed" },
];

const textures = [
  { id: "Leather, Wool", label: "Leather & Wool" },
  { id: "Rattan, Wicker, Jute", label: "Rattan & Jute" },
  { id: "Walnut", label: "Walnut" },
  { id: "Velvet, Brass, Smoked Glass", label: "Velvet & Brass" },
  { id: "Shiplap, Wrought Iron", label: "Shiplap & Iron" },
  { id: "White Oak, Linen, Travertine", label: "Oak & Linen" },
  { id: "Satin, Metallics", label: "Satin & Metallics" },
];

const patternPreferences = [
  {
    id: "Just Solids",
    label: "Just Solids",
    description: "Clean lines, calm energy, timeless look",
  },
  {
    id: "Patterned Accents",
    label: "Patterned Accents",
    description: "A touch of personality without going overboard",
  },
  {
    id: "I Love Patterns",
    label: "Bold Patterns",
    description: "Expressive, adventurous, vibrant energy",
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
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
    <div className="w-full max-w-6xl mx-auto space-y-16">
      {/* Color Palette Section */}
      <div>
        <div className="text-center mb-8">
          <p
            className="uppercase tracking-widest text-muted-foreground mb-3"
            style={{ fontSize: "var(--font-size-xs)" }}
          >
            Define Your Palette
          </p>
          <h2
            className="font-serif text-foreground mb-3"
            style={{ fontSize: "var(--font-size-3xl)", fontWeight: 400 }}
          >
            Which colours feel most like you?
          </h2>
          <p
            className="text-muted-foreground"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Choose up to {maxColorSelections} palettes
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
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
                  className={`relative aspect-[3/4] cursor-pointer overflow-hidden transition-all duration-300 ${
                    isSelected
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "hover:ring-1 hover:ring-border"
                  }`}
                  data-testid={`select-palette-${palette.id.toLowerCase().replace(/ /g, "-").replace(/&/g, "and")}`}
                >
                  <img
                    src={palette.image}
                    alt={palette.label}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <h3
                          className="text-white font-medium tracking-wider"
                          style={{ fontSize: "var(--font-size-xs)" }}
                        >
                          {palette.label}
                        </h3>
                        <p
                          className="text-white/70 mt-1"
                          style={{ fontSize: "10px" }}
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
                          <Check className="w-4 h-4 text-foreground" />
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

      {/* Mode & Textures Row */}
      <div className="grid lg:grid-cols-2 gap-12">
        {/* Mode Section */}
        <div>
          <h3
            className="font-serif text-foreground text-center mb-6"
            style={{ fontSize: "var(--font-size-xl)", fontWeight: 400 }}
          >
            Your Style Mode
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            {lineStyles.map((style) => {
              const isSelected = lineStyle === style.id;
              return (
                <motion.div
                  key={style.id}
                  variants={itemVariants}
                  onClick={() => onLineStyleChange(style.id)}
                  className={`p-4 text-center cursor-pointer transition-all duration-300 border ${
                    isSelected
                      ? "border-foreground bg-accent/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                  data-testid={`line-style-${style.id.toLowerCase()}`}
                >
                  <p
                    className="font-medium text-foreground"
                    style={{ fontSize: "var(--font-size-sm)" }}
                  >
                    {style.label}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Textures Section */}
        <div>
          <h3
            className="font-serif text-foreground text-center mb-4"
            style={{ fontSize: "var(--font-size-xl)", fontWeight: 400 }}
          >
            Materials & Textures
          </h3>
          <p
            className="text-muted-foreground text-center mb-6"
            style={{ fontSize: "var(--font-size-xs)" }}
          >
            Select up to {maxTextureSelections}
          </p>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-3"
          >
            {textures.map((texture) => {
              const isSelected = selectedTextures.includes(texture.id);
              return (
                <motion.div
                  key={texture.id}
                  variants={itemVariants}
                  onClick={() => handleTextureToggle(texture.id)}
                  className={`p-4 text-center cursor-pointer transition-all duration-300 border ${
                    isSelected
                      ? "border-foreground bg-accent/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                  data-testid={`texture-${texture.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <p
                    className="font-medium text-foreground"
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

      {/* Pattern Preferences */}
      <div className="max-w-3xl mx-auto">
        <h3
          className="font-serif text-foreground text-center mb-6"
          style={{ fontSize: "var(--font-size-xl)", fontWeight: 400 }}
        >
          Pattern Preference
        </h3>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-3 gap-4"
        >
          {patternPreferences.map((pattern) => {
            const isSelected = patternPreference === pattern.id;
            return (
              <motion.div
                key={pattern.id}
                variants={itemVariants}
                onClick={() => onPatternChange(pattern.id)}
                className={`p-6 text-center cursor-pointer transition-all duration-300 border ${
                  isSelected
                    ? "border-foreground bg-accent/5"
                    : "border-border hover:border-foreground/30"
                }`}
                data-testid={`pattern-${pattern.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <p
                  className="font-medium text-foreground mb-2"
                  style={{ fontSize: "var(--font-size-sm)" }}
                >
                  {pattern.label}
                </p>
                <p
                  className="text-muted-foreground"
                  style={{ fontSize: "var(--font-size-xs)" }}
                >
                  {pattern.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
