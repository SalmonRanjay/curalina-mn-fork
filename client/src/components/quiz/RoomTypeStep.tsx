import type { KeyboardEvent } from "react";
import { Home, Utensils, BedDouble, Briefcase, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface RoomTypeStepProps {
  value: string;
  onChange: (value: string) => void;
}

const rooms = [
  { id: "Living Room", label: "LIVING ROOM", icon: Home },
  { id: "Dining Room", label: "DINING ROOM", icon: Utensils },
  { id: "Home Office", label: "HOME OFFICE", icon: Briefcase },
  { id: "Bedroom", label: "BEDROOM", icon: BedDouble },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function RoomTypeStep({ value, onChange }: RoomTypeStepProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, roomId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(roomId);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-cormorant font-medium mb-4" data-testid="heading-room-type">
          Which room do you dream of transforming first?
        </h2>
        <p className="text-base md:text-lg text-stone-600 dark:text-stone-400">
          You can always explore other rooms later—let's just start with the one that matters most
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto"
      >
        {rooms.map((room) => {
          const Icon = room.icon;
          const isSelected = value === room.id;
          const testId = `select-room-${room.id.toLowerCase().replace(/ /g, '-')}`;
          
          return (
            <motion.div key={room.id} variants={itemVariants}>
              <Card
                role="button"
                tabIndex={0}
                onClick={() => onChange(room.id)}
                onKeyDown={(e) => handleKeyDown(e, room.id)}
                className={`relative flex flex-col items-center justify-center p-8 md:p-12 cursor-pointer transition-all hover-elevate active-elevate-2 ${
                  isSelected
                    ? "border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/20"
                    : "border border-stone-200 dark:border-stone-700"
                }`}
                aria-label={`Select ${room.label}`}
                aria-pressed={isSelected}
                data-testid={testId}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center" data-testid={`check-${room.id.toLowerCase().replace(/ /g, '-')}`}>
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <Icon className={`w-16 h-16 md:w-20 md:h-20 mb-4 ${isSelected ? "text-teal-500" : "text-stone-400"}`} />
                <span className={`text-sm md:text-base font-inter font-semibold tracking-wider ${isSelected ? "text-teal-700 dark:text-teal-400" : "text-stone-700 dark:text-stone-300"}`}>
                  {room.label}
                </span>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
