import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import {
  Archive,
  Monitor,
  Sofa,
  Lamp,
  Dog,
  Baby,
  Tv,
  BedDouble,
  Wine,
  Utensils,
  BookOpen,
  FileText,
  Armchair,
  LayoutDashboard,
} from "lucide-react";

interface FeaturesStepProps {
  roomType: string;
  value: string[];
  onChange: (value: string[]) => void;
}

type FeatureItem = {
  id: string;
  label: string;
  subtitle?: string;
  icon: typeof Archive;
};

const featuresByRoom: Record<string, FeatureItem[]> = {
  "Living Room": [
    { id: "storage", label: "Storage Solutions", subtitle: "Shelves & cabinetry", icon: Archive },
    { id: "workspace", label: "Workspace Area", subtitle: "Integrated office", icon: Monitor },
    { id: "seating", label: "Comfortable Seat", subtitle: "Sectional or deep sofa", icon: Sofa },
    { id: "lighting", label: "Accent Lighting", subtitle: "Ambient & Task", icon: Lamp },
    { id: "pet-friendly", label: "Pet-Friendly", subtitle: "Durable fabrics", icon: Dog },
    { id: "child-friendly", label: "Child-Friendly", subtitle: "Toy storage, rounded edges", icon: Baby },
    { id: "media", label: "Media Area", subtitle: "Entertainment Cabinet", icon: Tv },
    { id: "multi-function", label: "Multi-Function", subtitle: "Sofa Bed", icon: BedDouble },
  ],
  "Dining Room": [
    { id: "casual", label: "Casual Setting", subtitle: "Relaxed & Everyday", icon: Utensils },
    { id: "formal", label: "Formal Setting", subtitle: "Elevated & Polished", icon: Wine },
    { id: "bar-storage", label: "Bar Storage", subtitle: "Wine and Liquor", icon: Wine },
    { id: "storage", label: "Open or Closed Storage", subtitle: "Organize clutter", icon: Archive },
  ],
  Bedroom: [
    { id: "storage", label: "Storage Solutions", subtitle: "Clothing & Linens", icon: Archive },
    { id: "workspace", label: "Workspace Area", subtitle: "Integrated office", icon: Monitor },
    { id: "vanity", label: "Vanity Table", subtitle: "", icon: LayoutDashboard },
    { id: "seating", label: "Comfortable Seat", subtitle: "Reading Chair", icon: Armchair },
    { id: "media", label: "Media Area", subtitle: "TV Cabinet", icon: Tv },
  ],
  "Home Office": [
    { id: "concealed-storage", label: "Concealed Storage", subtitle: "Keep clutter out", icon: Archive },
    { id: "bookcase", label: "Bookcase Storage", subtitle: "Open Shelves", icon: BookOpen },
    { id: "filing", label: "Filing Storage", subtitle: "Documents & Files", icon: FileText },
    { id: "reading-chair", label: "Reading Chair", subtitle: "Comfortable Seat", icon: Armchair },
    { id: "large-desk", label: "Large Desk", subtitle: '52" to 62"', icon: LayoutDashboard },
    { id: "small-desk", label: "Small Desk", subtitle: '32" to 48"', icon: LayoutDashboard },
  ],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function FeaturesStepV2({
  roomType,
  value,
  onChange,
}: FeaturesStepProps) {
  const features = featuresByRoom[roomType] || featuresByRoom["Living Room"];

  const handleToggle = (featureId: string) => {
    if (value.includes(featureId)) {
      onChange(value.filter((v) => v !== featureId));
    } else {
      onChange([...value, featureId]);
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    featureId: string
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle(featureId);
    }
  };

  return (
    <div className="space-y-10">
      {/* Large Decorative Typography Background */}
      <div className="relative">
        {/* Decorative Words */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04] dark:opacity-[0.06]">
          <div className="font-cormorant font-bold text-[8rem] md:text-[12rem] leading-none -rotate-6 translate-y-8">
            Mood
          </div>
          <div className="font-cormorant font-bold text-[6rem] md:text-[10rem] leading-none rotate-3 -translate-y-4 translate-x-32">
            Textures
          </div>
        </div>

        {/* Question Header */}
        <div className="relative text-left max-w-4xl">
          <h2
            className="font-cormorant font-medium text-foreground mb-4"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.2 }}
            data-testid="heading-features"
          >
            Functional Features
          </h2>
          <p
            className="text-muted-foreground mb-2"
            style={{ fontSize: "var(--font-size-base)" }}
          >
            A room should look stunning and live smart. Let's design for how you
            live, not just how it looks.
          </p>
          <p className="text-sm text-muted-foreground font-medium">
            Select all that apply
          </p>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {features.map((feature) => {
          const isSelected = value.includes(feature.id);
          const Icon = feature.icon;
          const testId = `select-feature-${feature.id}`;

          return (
            <motion.div key={feature.id} variants={itemVariants}>
              <div
                role="checkbox"
                tabIndex={0}
                aria-checked={isSelected}
                onClick={() => handleToggle(feature.id)}
                onKeyDown={(e) => handleKeyDown(e, feature.id)}
                className={`relative flex items-center gap-4 p-5 cursor-pointer rounded-md transition-all duration-200 ${
                  isSelected
                    ? "bg-primary/10 border-2 border-primary"
                    : "bg-muted/40 border-2 border-transparent hover:border-border hover:bg-muted/60"
                }`}
                data-testid={testId}
              >
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                    isSelected
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-inter font-semibold text-foreground text-sm">
                    {feature.label}
                  </h4>
                  {feature.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {feature.subtitle}
                    </p>
                  )}
                </div>

                {/* Checkbox */}
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-border bg-background"
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Selection Count */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {value.length} feature{value.length !== 1 ? "s" : ""} selected
        </p>
      </div>
    </div>
  );
}
