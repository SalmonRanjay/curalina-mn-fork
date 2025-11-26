import { motion } from "framer-motion";
import { Check } from "lucide-react";

import materialsImage1 from "@assets/stock_images/materials-flatlay-1_aEj5pQ.jpg";
import materialsImage2 from "@assets/stock_images/materials-flatlay-2_8EAwpV.jpg";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const materialFinishes = [
  { id: "natural-wood", label: "Natural Wood", description: "Warm oak, walnut, and light ash" },
  { id: "marble-stone", label: "Marble & Stone", description: "Elegant veining and cool tones" },
  { id: "brass-gold", label: "Brass & Gold", description: "Warm metallic accents" },
  { id: "matte-black", label: "Matte Black", description: "Modern and sophisticated" },
  { id: "linen-texture", label: "Linen & Texture", description: "Soft, organic fabrics" },
  { id: "leather", label: "Leather", description: "Rich, timeless material" },
];

const lifestyleCues = [
  { id: "minimal", label: "Minimal & Clean" },
  { id: "collected", label: "Collected & Curated" },
  { id: "cozy", label: "Cozy & Inviting" },
  { id: "bold", label: "Bold & Expressive" },
];

const patternPreferences = [
  { id: "solid", label: "Keep It Solid", description: "Clean, monochromatic approach" },
  { id: "subtle", label: "Subtle Patterns", description: "Gentle textures and tonal variations" },
  { id: "mixed", label: "Mix It Up", description: "Layered patterns with intention" },
  { id: "statement", label: "Make a Statement", description: "Bold patterns as focal points" },
];

interface MaterialsStepV2Props {
  selectedMaterials: string[];
  lifestyleCue: string;
  patternPreference: string;
  onMaterialsChange: (materials: string[]) => void;
  onLifestyleChange: (cue: string) => void;
  onPatternChange: (pattern: string) => void;
}

export function MaterialsStepV2({
  selectedMaterials,
  lifestyleCue,
  patternPreference,
  onMaterialsChange,
  onLifestyleChange,
  onPatternChange,
}: MaterialsStepV2Props) {
  const toggleMaterial = (materialId: string) => {
    if (selectedMaterials.includes(materialId)) {
      onMaterialsChange(selectedMaterials.filter((m) => m !== materialId));
    } else {
      onMaterialsChange([...selectedMaterials, materialId]);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-10">
        <p
          className="uppercase tracking-widest text-muted-foreground mb-3"
          style={{ fontSize: "var(--font-size-xs)" }}
        >
          Curate Your Palette
        </p>
        <h2
          className="font-serif text-foreground mb-4"
          style={{ fontSize: "var(--font-size-3xl)", fontWeight: 400 }}
        >
          Materials & Finishes
        </h2>
        <p
          className="text-muted-foreground max-w-xl mx-auto"
          style={{ fontSize: "var(--font-size-base)" }}
        >
          Select the textures and materials that speak to your style
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-16">
        <div className="relative aspect-[4/3] overflow-hidden rounded-sm">
          <img
            src={materialsImage1}
            alt="Materials inspiration"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3"
        >
          {materialFinishes.map((material) => {
            const isSelected = selectedMaterials.includes(material.id);
            return (
              <motion.div
                key={material.id}
                variants={itemVariants}
                onClick={() => toggleMaterial(material.id)}
                className={`relative p-5 cursor-pointer transition-all duration-300 border ${
                  isSelected
                    ? "border-foreground bg-accent/5"
                    : "border-border hover:border-foreground/30"
                }`}
                data-testid={`material-${material.id}`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-foreground rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-background" />
                  </div>
                )}
                <p
                  className="font-medium text-foreground mb-1"
                  style={{ fontSize: "var(--font-size-sm)" }}
                >
                  {material.label}
                </p>
                <p
                  className="text-muted-foreground"
                  style={{ fontSize: "var(--font-size-xs)" }}
                >
                  {material.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        <div>
          <h3
            className="font-serif text-foreground text-center mb-6"
            style={{ fontSize: "var(--font-size-xl)", fontWeight: 400 }}
          >
            Lifestyle Cues
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-3"
          >
            {lifestyleCues.map((cue) => {
              const isSelected = lifestyleCue === cue.id;
              return (
                <motion.div
                  key={cue.id}
                  variants={itemVariants}
                  onClick={() => onLifestyleChange(cue.id)}
                  className={`p-5 text-center cursor-pointer transition-all duration-300 border ${
                    isSelected
                      ? "border-foreground bg-accent/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                  data-testid={`lifestyle-${cue.id}`}
                >
                  <p
                    className="font-medium text-foreground"
                    style={{ fontSize: "var(--font-size-sm)" }}
                  >
                    {cue.label}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-sm lg:order-first">
          <img
            src={materialsImage2}
            alt="Lifestyle inspiration"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <h3
          className="font-serif text-foreground text-center mb-6"
          style={{ fontSize: "var(--font-size-xl)", fontWeight: 400 }}
        >
          Pattern Preferences
        </h3>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {patternPreferences.map((pattern) => {
            const isSelected = patternPreference === pattern.id;
            return (
              <motion.div
                key={pattern.id}
                variants={itemVariants}
                onClick={() => onPatternChange(pattern.id)}
                className={`flex items-center gap-4 p-5 cursor-pointer transition-all duration-300 border ${
                  isSelected
                    ? "border-foreground bg-accent/5"
                    : "border-border hover:border-foreground/30"
                }`}
                data-testid={`pattern-${pattern.id}`}
              >
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? "bg-foreground border-foreground" : "border-muted-foreground"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-background" />}
                </div>
                <div className="flex-1">
                  <p
                    className="font-medium text-foreground"
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
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
