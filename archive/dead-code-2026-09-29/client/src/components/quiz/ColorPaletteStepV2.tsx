import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

import lightNeutralsImg from "@assets/stock_images/light_neutral_color__59c65d92.jpg";
import warmCozyImg from "@assets/stock_images/warm_cozy_brown_terr_dfc3dcc9.jpg";
import darkMoodyImg from "@assets/stock_images/dark_moody_interior__3a50dda4.jpg";
import colorfulAccentImg from "@assets/stock_images/colorful_accent_inte_ab53f086.jpg";

interface ColorPaletteStepProps {
  value: string[];
  onChange: (value: string[]) => void;
  maxSelections?: number;
}

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
};

export default function ColorPaletteStepV2({
  value,
  onChange,
  maxSelections = 2,
}: ColorPaletteStepProps) {
  const handleSelect = (paletteId: string) => {
    if (value.includes(paletteId)) {
      onChange(value.filter((v) => v !== paletteId));
    } else if (value.length < maxSelections) {
      onChange([...value, paletteId]);
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    paletteId: string
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(paletteId);
    }
  };

  return (
    <div className="space-y-10">
      {/* Question Header */}
      <div className="text-left max-w-4xl">
        <h2
          className="font-cormorant font-medium text-foreground mb-4"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.2 }}
          data-testid="heading-color-palette"
        >
          Which colour palette feels most like you?
        </h2>
        <p
          className="text-muted-foreground"
          style={{ fontSize: "var(--font-size-base)" }}
        >
          Choose up to {maxSelections} palettes. Trust your instincts — There
          are no wrong answers.
        </p>
      </div>

      {/* Palette Grid - 2x2 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
      >
        {palettes.map((palette) => {
          const isSelected = value.includes(palette.id);
          const testId = `select-palette-${palette.id.toLowerCase().replace(/ /g, "-").replace(/&/g, "and")}`;

          return (
            <motion.div key={palette.id} variants={itemVariants}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(palette.id)}
                onKeyDown={(e) => handleKeyDown(e, palette.id)}
                className={`relative aspect-[4/3] cursor-pointer overflow-hidden rounded-md transition-all duration-300 ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:ring-1 hover:ring-border"
                }`}
                aria-label={`Select ${palette.label}`}
                aria-pressed={isSelected}
                data-testid={testId}
              >
                {/* Background Image */}
                <img
                  src={palette.image}
                  alt={palette.label}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />

                {/* Dark Overlay at Bottom */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />

                {/* Label Bar */}
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <h3 className="text-white font-inter font-bold tracking-widest text-sm md:text-base">
                        {palette.label}
                      </h3>
                      <p className="text-white/70 text-xs mt-1">
                        {palette.description}
                      </p>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0"
                        data-testid={`check-${palette.id.toLowerCase().replace(/ /g, "-").replace(/&/g, "and")}`}
                      >
                        <Check className="w-5 h-5 text-primary" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Selection Counter */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {value.length} of {maxSelections} palettes selected
        </p>
      </div>
    </div>
  );
}
