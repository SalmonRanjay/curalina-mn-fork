import { Check } from "lucide-react";

interface FeaturesStepProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const features = [
  { id: "natural-light", label: "Natural Light", description: "Large windows and brightness" },
  { id: "storage", label: "Storage Solutions", description: "Built-in organization" },
  { id: "workspace", label: "Workspace", description: "Dedicated work area" },
  { id: "seating", label: "Ample Seating", description: "Multiple seating options" },
  { id: "plants", label: "Greenery", description: "Indoor plants and nature" },
  { id: "art", label: "Art Display", description: "Gallery walls and artwork" },
  { id: "cozy", label: "Cozy Ambiance", description: "Warm and inviting feel" },
  { id: "open-space", label: "Open Layout", description: "Spacious and flowing" },
];

export default function FeaturesStep({ value, onChange }: FeaturesStepProps) {
  const toggleFeature = (featureId: string) => {
    if (value.includes(featureId)) {
      onChange(value.filter(id => id !== featureId));
    } else {
      onChange([...value, featureId]);
    }
  };

  return (
    <div>
      <h2 className="font-semibold mb-4" style={{ fontSize: 'var(--font-size-3xl)' }} data-testid="heading-features">
        What features are important to you?
      </h2>
      <p className="text-muted-foreground mb-8">
        Select all that apply
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature) => {
          const isSelected = value.includes(feature.id);
          
          return (
            <button
              key={feature.id}
              onClick={() => toggleFeature(feature.id)}
              className={`flex items-start p-5 rounded-lg border-2 text-left transition-all hover-elevate active-elevate-2 ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent"
              }`}
              data-testid={`feature-option-${feature.id}`}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded border-2 mr-4 flex items-center justify-center ${
                isSelected
                  ? "bg-accent border-accent"
                  : "border-border"
              }`}>
                {isSelected && <Check className="w-4 h-4 text-accent-foreground" />}
              </div>
              <div className="flex-1">
                <span className="block font-semibold mb-1">
                  {feature.label}
                </span>
                <span className="text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {feature.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
