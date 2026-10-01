import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

import livingRoomImg from "@assets/generated_images/modern_luxury_living_room.png";
import diningRoomImg from "@assets/generated_images/sophisticated_dining_room.png";
import bedroomImg from "@assets/generated_images/elegant_master_bedroom.png";
import homeOfficeImg from "@assets/generated_images/stylish_home_office.png";

interface RoomTypeStepProps {
  value: string;
  onChange: (value: string) => void;
}

const rooms = [
  { id: "Living Room", label: "LIVING ROOM", image: livingRoomImg },
  { id: "Dining Room", label: "DINING ROOM", image: diningRoomImg },
  { id: "Bedroom", label: "BEDROOM", image: bedroomImg },
  { id: "Home Office", label: "HOME OFFICE", image: homeOfficeImg },
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
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function RoomTypeStepV2({ value, onChange }: RoomTypeStepProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, roomId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(roomId);
    }
  };

  return (
    <div className="space-y-10">
      {/* Question Header */}
      <div className="text-left max-w-4xl">
        <h2
          className="font-cormorant font-medium text-foreground mb-4"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.2 }}
          data-testid="heading-room-type"
        >
          Which room do you dream of transforming first?
        </h2>
        <p
          className="text-muted-foreground"
          style={{ fontSize: "var(--font-size-base)" }}
        >
          You can always explore other rooms later—let's just start with the one
          that matters most
        </p>
      </div>

      {/* Room Tiles Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
      >
        {rooms.map((room) => {
          const isSelected = value === room.id;
          const testId = `select-room-${room.id.toLowerCase().replace(/ /g, "-")}`;

          return (
            <motion.div key={room.id} variants={itemVariants}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onChange(room.id)}
                onKeyDown={(e) => handleKeyDown(e, room.id)}
                className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-md transition-all duration-300 ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:ring-1 hover:ring-border"
                }`}
                aria-label={`Select ${room.label}`}
                aria-pressed={isSelected}
                data-testid={testId}
              >
                {/* Background Image */}
                <img
                  src={room.image}
                  alt={room.label}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />

                {/* Dark Overlay at Bottom */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />

                {/* Label Bar */}
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-inter font-semibold tracking-widest text-xs md:text-sm">
                      {room.label}
                    </span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-white rounded-full flex items-center justify-center"
                        data-testid={`check-${room.id.toLowerCase().replace(/ /g, "-")}`}
                      >
                        <Check className="w-4 h-4 text-primary" />
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
  );
}
