import { motion } from "framer-motion";
import { Check } from "lucide-react";

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

const budgetRanges = [
  { id: "$2,000-$5,000", label: "$2,000 - $5,000", description: "Refresh essentials" },
  { id: "$5,000-$8,000", label: "$5,000 - $8,000", description: "Elevated basics" },
  { id: "$9,000-$12,000", label: "$9,000 - $12,000", description: "Full transformation" },
  { id: "$13,000-$16,000", label: "$13,000 - $16,000", description: "Designer collection" },
  { id: "$17,000-$20,000", label: "$17,000 - $20,000", description: "Luxury selection" },
  { id: "Over $20,000", label: "Over $20,000", description: "Bespoke experience" },
];

interface BudgetStepV2Props {
  value: string;
  onChange: (budget: string) => void;
}

export function BudgetStepV2({ value, onChange }: BudgetStepV2Props) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <p
          className="uppercase tracking-widest text-muted-foreground mb-3"
          style={{ fontSize: "var(--font-size-xs)" }}
        >
          Investment Level
        </p>
        <h2
          className="font-serif text-foreground mb-4"
          style={{ fontSize: "var(--font-size-3xl)", fontWeight: 400 }}
        >
          Dream Big, Spend Smart
        </h2>
        <p
          className="text-muted-foreground max-w-xl mx-auto"
          style={{ fontSize: "var(--font-size-base)" }}
        >
          Choose a budget range that feels comfortable — enough to elevate your space without stretching your limits
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto"
      >
        {budgetRanges.map((budget) => {
          const isSelected = value === budget.id;
          return (
            <motion.div
              key={budget.id}
              variants={itemVariants}
              onClick={() => onChange(budget.id)}
              className={`relative p-8 text-center cursor-pointer transition-all duration-300 border ${
                isSelected
                  ? "border-foreground bg-accent/5"
                  : "border-border hover:border-foreground/30"
              }`}
              data-testid={`budget-${budget.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 w-5 h-5 bg-foreground rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-background" />
                </div>
              )}
              <p
                className="font-serif text-foreground mb-2"
                style={{ fontSize: "var(--font-size-xl)", fontWeight: 400 }}
              >
                {budget.label}
              </p>
              <p
                className="text-muted-foreground"
                style={{ fontSize: "var(--font-size-sm)" }}
              >
                {budget.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="text-center mt-12">
        <p
          className="text-muted-foreground italic"
          style={{ fontSize: "var(--font-size-sm)" }}
        >
          Your budget helps us curate pieces that match both your vision and your investment
        </p>
      </div>
    </div>
  );
}
