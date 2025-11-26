import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

import organicModernImg from "@assets/stock_images/organic_modern_inter_bd5701c5.jpg";
import modernFarmhouseImg from "@assets/stock_images/modern_farmhouse_int_9fec75db.jpg";
import midcenturyImg from "@assets/stock_images/midcentury_modern_in_5ccdbfa4.jpg";
import contemporaryLuxImg from "@assets/stock_images/contemporary_luxury__1321758a.jpg";
import warmTransitionalImg from "@assets/stock_images/warm_transitional_in_6a7844cd.jpg";

import materialsImg1 from "@assets/stock_images/interior_design_mate_a8749c2c.jpg";
import materialsImg2 from "@assets/stock_images/interior_design_mate_e9262ba4.jpg";
import materialsImg3 from "@assets/stock_images/interior_design_mate_4cf2d356.jpg";
import materialsImg4 from "@assets/stock_images/interior_design_mate_ea89df81.jpg";
import materialsImg5 from "@assets/stock_images/interior_design_mate_f5bdb6c4.jpg";

interface StyleSelectionStepProps {
  value: string[];
  onChange: (value: string[]) => void;
  maxSelections?: number;
}

const styles = [
  {
    id: "Organic Modern",
    label: "ORGANIC MODERN",
    image: organicModernImg,
    materials: materialsImg1,
    description: "Earthy, uncluttered, tranquil, zen-inspired",
  },
  {
    id: "Modern Farmhouse",
    label: "MODERN FARMHOUSE",
    image: modernFarmhouseImg,
    materials: materialsImg2,
    description: "Rustic, casual, heritage-inspired, cozy",
  },
  {
    id: "Midcentury Scandi",
    label: "MIDCENTURY SCANDI",
    image: midcenturyImg,
    materials: materialsImg3,
    description: "Vintage, retro, functional, warm, clean",
  },
  {
    id: "Contemporary Luxe",
    label: "CONTEMPORARY LUXE",
    image: contemporaryLuxImg,
    materials: materialsImg4,
    description: "Sophisticated, minimal yet rich, polished",
  },
  {
    id: "Warm Transitional",
    label: "WARM TRANSITIONAL",
    image: warmTransitionalImg,
    materials: materialsImg5,
    description: "Timeless blend of traditional and modern",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function StyleSelectionStepV2({
  value,
  onChange,
  maxSelections = 2,
}: StyleSelectionStepProps) {
  const handleSelect = (styleId: string) => {
    if (value.includes(styleId)) {
      onChange(value.filter((v) => v !== styleId));
    } else if (value.length < maxSelections) {
      onChange([...value, styleId]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, styleId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(styleId);
    }
  };

  return (
    <div className="space-y-10">
      {/* Question Header */}
      <div className="text-left max-w-4xl">
        <h2
          className="font-cormorant font-medium text-foreground mb-4"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.2 }}
          data-testid="heading-style-selection"
        >
          Which style feels most like home?
        </h2>
        <p
          className="text-muted-foreground"
          style={{ fontSize: "var(--font-size-base)" }}
        >
          Choose up to {maxSelections} styles. Trust your instincts — There are
          no wrong answers.
        </p>
      </div>

      {/* Style Rows */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {styles.map((style) => {
          const isSelected = value.includes(style.id);
          const testId = `select-style-${style.id.toLowerCase().replace(/ /g, "-")}`;

          return (
            <motion.div key={style.id} variants={itemVariants}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(style.id)}
                onKeyDown={(e) => handleKeyDown(e, style.id)}
                className={`relative grid grid-cols-1 md:grid-cols-2 gap-1 cursor-pointer rounded-md overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:ring-1 hover:ring-border"
                }`}
                aria-label={`Select ${style.label}`}
                aria-pressed={isSelected}
                data-testid={testId}
              >
                {/* Left: Interior Image */}
                <div className="relative aspect-[16/9] md:aspect-[4/3] overflow-hidden">
                  <img
                    src={style.image}
                    alt={`${style.label} interior`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  {/* Style Name Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6">
                    <h3 className="text-white font-inter font-bold tracking-widest text-sm md:text-base">
                      {style.label}
                    </h3>
                    <p className="text-white/80 text-xs mt-1 hidden md:block">
                      {style.description}
                    </p>
                  </div>
                </div>

                {/* Right: Materials Board */}
                <div className="relative aspect-[16/9] md:aspect-[4/3] overflow-hidden hidden md:block">
                  <img
                    src={style.materials}
                    alt={`${style.label} materials`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  {/* Subtle Overlay */}
                  <div className="absolute inset-0 bg-black/10" />
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-4 right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg"
                    data-testid={`check-${style.id.toLowerCase().replace(/ /g, "-")}`}
                  >
                    <Check className="w-5 h-5 text-primary-foreground" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Selection Counter */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {value.length} of {maxSelections} styles selected
        </p>
      </div>
    </div>
  );
}
