import { Home, Building2, Utensils, BedDouble, Briefcase } from "lucide-react";

interface RoomTypeStepProps {
  value: string;
  onChange: (value: string) => void;
}

const rooms = [
  { id: "living-room", label: "Living Room", icon: Home },
  { id: "bedroom", label: "Bedroom", icon: BedDouble },
  { id: "dining-room", label: "Dining Room", icon: Utensils },
  { id: "office", label: "Office", icon: Briefcase },
  { id: "kitchen", label: "Kitchen", icon: Building2 },
];

export default function RoomTypeStep({ value, onChange }: RoomTypeStepProps) {
  return (
    <div>
      <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="heading-room-type">
        Which room would you like to transform?
      </h2>
      <p className="text-stone-600 dark:text-stone-400 mb-8">
        Select the space you're planning to redesign
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {rooms.map((room) => {
          const Icon = room.icon;
          const isSelected = value === room.id;
          
          return (
            <button
              key={room.id}
              onClick={() => onChange(room.id)}
              className={`flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all hover-elevate active-elevate-2 ${
                isSelected
                  ? "border-green-300 bg-green-50 dark:bg-green-950"
                  : "border-stone-200 dark:border-stone-700 hover:border-green-200"
              }`}
              data-testid={`room-option-${room.id}`}
            >
              <Icon className={`w-12 h-12 mb-3 ${isSelected ? "text-green-500" : "text-stone-400"}`} />
              <span className={`font-medium ${isSelected ? "text-green-700 dark:text-green-400" : ""}`}>
                {room.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
