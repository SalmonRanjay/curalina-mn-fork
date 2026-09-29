import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import {
  Archive,
  Monitor,
  Sofa,
  Lamp,
  PawPrint,
  Baby,
  Tv,
  RefreshCw,
  Wine,
  UtensilsCrossed,
  GlassWater,
  BookOpen,
  FileText,
  Armchair,
  RectangleHorizontal,
  LayoutGrid,
  Shirt,
  BedDouble,
  BedSingle,
} from "lucide-react";

import livingRoomImg from "@assets/generated_images/modern_luxury_living_room.png";
import diningRoomImg from "@assets/generated_images/sophisticated_dining_room.png";
import bedroomImg from "@assets/generated_images/elegant_master_bedroom.png";
import homeOfficeImg from "@assets/generated_images/stylish_home_office.png";

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
    { id: "Storage Solutions", label: "Storage Solutions", subtitle: "Shelves & cabinetry", icon: Archive },
    { id: "Workspace Area", label: "Workspace Area", subtitle: "Integrated office", icon: Monitor },
    { id: "Comfortable Seat", label: "Comfortable Seat", subtitle: "Sectional or deep sofa", icon: Sofa },
    { id: "Accent Lighting", label: "Accent Lighting", subtitle: "Ambient & task lighting", icon: Lamp },
    { id: "Pet-Friendly", label: "Pet-Friendly", subtitle: "Durable fabrics", icon: PawPrint },
    { id: "Child-Friendly", label: "Child-Friendly", subtitle: "Toy storage, rounded edges", icon: Baby },
    { id: "Media Area", label: "Media Area", subtitle: "Entertainment cabinet", icon: Tv },
    { id: "Multi-Function", label: "Multi-Function", subtitle: "Sofa bed", icon: RefreshCw },
  ],
  "Dining Room": [
    { id: "Casual Setting", label: "Casual Setting", subtitle: "Relaxed & everyday", icon: UtensilsCrossed },
    { id: "Formal Setting", label: "Formal Setting", subtitle: "Elevated & polished", icon: Wine },
    { id: "Bar Storage", label: "Bar Storage", subtitle: "Wine and liquor", icon: GlassWater },
    { id: "Open or Closed Storage", label: "Storage Solutions", subtitle: "Organize clutter", icon: Archive },
  ],
  Bedroom: [
    { id: "Storage Solutions", label: "Storage Solutions", subtitle: "Clothing & linens", icon: Shirt },
    { id: "Workspace Area", label: "Workspace Area", subtitle: "Integrated office", icon: Monitor },
    { id: "Comfortable Seat", label: "Comfortable Seat", subtitle: "Reading chair", icon: Armchair },
    { id: "Media Area", label: "Media Area", subtitle: "TV cabinet", icon: Tv },
  ],
  "Home Office": [
    { id: "Concealed Storage", label: "Concealed Storage", subtitle: "Keep clutter out", icon: Archive },
    { id: "Bookcase Storage", label: "Bookcase Storage", subtitle: "Open shelves", icon: BookOpen },
    { id: "Filing Storage", label: "Filing Storage", subtitle: "Documents & files", icon: FileText },
    { id: "Reading Chair", label: "Reading Chair", subtitle: "Comfortable seat", icon: Armchair },
    { id: "Large Desk", label: "Large Desk", subtitle: '52" to 62"', icon: RectangleHorizontal },
    { id: "Small Desk", label: "Small Desk", subtitle: '32" to 48"', icon: LayoutGrid },
  ],
};

const roomImages: Record<string, string> = {
  "Living Room": livingRoomImg,
  "Dining Room": diningRoomImg,
  Bedroom: bedroomImg,
  "Home Office": homeOfficeImg,
};

const seatingOptions = ["4", "6", "8", "10", "12"];

const bedSizeOptions = [
  { id: "Twin/Single Bed", label: "Twin / Single", dimensions: '38" × 75"' },
  { id: "Double Bed", label: "Double", dimensions: '54" × 75"' },
  { id: "Queen Bed", label: "Queen", dimensions: '60" × 80"' },
  { id: "King Bed", label: "King", dimensions: '76" × 80"' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
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
  const roomImage = roomImages[roomType] || roomImages["Living Room"];

  const handleToggle = (featureId: string) => {
    if (value.includes(featureId)) {
      onChange(value.filter((v) => v !== featureId));
    } else {
      onChange([...value, featureId]);
    }
  };

  const handleSingleSelect = (featureId: string, prefix: string) => {
    const filtered = value.filter((v) => !v.startsWith(prefix));
    onChange([...filtered, featureId]);
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

  const isDiningRoom = roomType === "Dining Room";
  const isBedroom = roomType === "Bedroom";

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Two-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column - Lifestyle Image */}
        <div className="lg:col-span-5">
          <div className="sticky top-8">
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={roomImage}
                alt={`${roomType} inspiration`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p
                  className="text-white/70 uppercase tracking-[0.15em] mb-2"
                  style={{ fontSize: "10px" }}
                >
                  Step 4 of 7
                </p>
                <h2
                  className="text-white font-serif"
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
                >
                  Functional Features
                </h2>
                <p
                  className="text-white/80 mt-2 leading-relaxed"
                  style={{ fontSize: "var(--font-size-sm)" }}
                >
                  A room should look stunning and live smart. Let's design for how you live, not just how it looks.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Feature Cards */}
        <div className="lg:col-span-7 space-y-8">
          <div className="mb-4">
            <p
              className="uppercase tracking-[0.15em] text-muted-foreground mb-2"
              style={{ fontSize: "11px" }}
            >
              Select all that apply
            </p>
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

              return (
                <motion.div key={feature.id} variants={itemVariants}>
                  <div
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={isSelected}
                    onClick={() => handleToggle(feature.id)}
                    onKeyDown={(e) => handleKeyDown(e, () => handleToggle(feature.id))}
                    className={`relative flex items-center gap-4 p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-foreground text-background"
                        : "bg-accent/30 hover:bg-accent/50 border border-border"
                    }`}
                    style={{ borderRadius: "10px" }}
                    data-testid={`select-feature-${feature.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? "bg-background/20"
                          : "bg-background"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${isSelected ? "text-background" : "text-foreground"}`}
                        strokeWidth={1.5}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4
                        className="font-semibold"
                        style={{ fontSize: "var(--font-size-base)" }}
                      >
                        {feature.label}
                      </h4>
                      {feature.subtitle && (
                        <p
                          className={`mt-0.5 ${isSelected ? "text-background/70" : "text-muted-foreground"}`}
                          style={{ fontSize: "var(--font-size-xs)" }}
                        >
                          {feature.subtitle}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex-shrink-0 w-5 h-5 rounded-full bg-background flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Dining Room: Seating Capacity */}
          {isDiningRoom && (
            <div className="pt-6 border-t border-border">
              <p
                className="uppercase tracking-[0.15em] text-muted-foreground mb-4"
                style={{ fontSize: "11px" }}
              >
                Seating Capacity
              </p>
              <p className="text-muted-foreground mb-4" style={{ fontSize: "var(--font-size-sm)" }}>
                Select number of people to be seated
              </p>
              <div className="flex flex-wrap gap-3">
                {seatingOptions.map((seats) => {
                  const seatId = `Seating-${seats}`;
                  const isSelected = value.some((v) => v.startsWith("Seating-") && v === seatId);

                  return (
                    <div
                      key={seats}
                      role="radio"
                      tabIndex={0}
                      aria-checked={isSelected}
                      onClick={() => handleSingleSelect(seatId, "Seating-")}
                      onKeyDown={(e) => handleKeyDown(e, () => handleSingleSelect(seatId, "Seating-"))}
                      className={`px-6 py-3 cursor-pointer transition-all duration-200 font-medium ${
                        isSelected
                          ? "bg-foreground text-background"
                          : "bg-accent/30 hover:bg-accent/50 text-foreground"
                      }`}
                      style={{ borderRadius: "999px", fontSize: "var(--font-size-base)" }}
                      data-testid={`seating-${seats}`}
                    >
                      {seats}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bedroom: Bed Size Selection */}
          {isBedroom && (
            <div className="pt-6 border-t border-border">
              <p
                className="uppercase tracking-[0.15em] text-muted-foreground mb-4"
                style={{ fontSize: "11px" }}
              >
                Bed Size
              </p>
              <div className="grid grid-cols-2 gap-3">
                {bedSizeOptions.map((bed) => {
                  const isSelected = value.includes(bed.id);

                  return (
                    <div
                      key={bed.id}
                      role="radio"
                      tabIndex={0}
                      aria-checked={isSelected}
                      onClick={() => {
                        const filtered = value.filter((v) => !bedSizeOptions.some((b) => b.id === v));
                        onChange([...filtered, bed.id]);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, () => {
                        const filtered = value.filter((v) => !bedSizeOptions.some((b) => b.id === v));
                        onChange([...filtered, bed.id]);
                      })}
                      className={`p-4 cursor-pointer transition-all duration-200 text-center ${
                        isSelected
                          ? "bg-foreground text-background"
                          : "bg-accent/30 hover:bg-accent/50 border border-border"
                      }`}
                      style={{ borderRadius: "10px" }}
                      data-testid={`bed-${bed.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        {bed.id.includes("King") ? (
                          <BedDouble className={`w-5 h-5 ${isSelected ? "text-background" : "text-foreground"}`} strokeWidth={1.5} />
                        ) : (
                          <BedSingle className={`w-5 h-5 ${isSelected ? "text-background" : "text-foreground"}`} strokeWidth={1.5} />
                        )}
                      </div>
                      <h4
                        className="font-semibold"
                        style={{ fontSize: "var(--font-size-sm)" }}
                      >
                        {bed.label}
                      </h4>
                      <p
                        className={`mt-1 ${isSelected ? "text-background/70" : "text-muted-foreground"}`}
                        style={{ fontSize: "var(--font-size-xs)" }}
                      >
                        {bed.dimensions}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selection Count */}
          <div className="pt-4">
            <p className="text-muted-foreground italic" style={{ fontSize: "var(--font-size-xs)" }}>
              {value.length} feature{value.length !== 1 ? "s" : ""} selected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
