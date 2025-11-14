interface StyleStepProps {
  value: string;
  onChange: (value: string) => void;
}

const styles = [
  { id: "modern", label: "Modern", description: "Clean lines and minimalist aesthetics" },
  { id: "midcentury", label: "Midcentury", description: "Retro charm with organic shapes" },
  { id: "scandinavian", label: "Scandinavian", description: "Light, airy, and functional" },
  { id: "industrial", label: "Industrial", description: "Raw materials and urban edge" },
  { id: "bohemian", label: "Bohemian", description: "Eclectic and artistic flair" },
  { id: "coastal", label: "Coastal", description: "Beach-inspired tranquility" },
  { id: "traditional", label: "Traditional", description: "Classic elegance and warmth" },
  { id: "organic", label: "Organic Modern", description: "Natural materials and curves" },
];

export default function StyleStep({ value, onChange }: StyleStepProps) {
  return (
    <div>
      <h2 className="font-semibold mb-4" style={{ fontSize: 'var(--font-size-3xl)' }} data-testid="heading-style">
        What's your design style?
      </h2>
      <p className="text-muted-foreground mb-8">
        Choose the aesthetic that resonates with you
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {styles.map((style) => {
          const isSelected = value === style.id;
          
          return (
            <button
              key={style.id}
              onClick={() => onChange(style.id)}
              className={`flex flex-col items-start p-6 rounded-lg border-2 text-left transition-all hover-elevate active-elevate-2 ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent"
              }`}
              data-testid={`style-option-${style.id}`}
            >
              <span className="font-semibold mb-1" style={{ fontSize: 'var(--font-size-lg)' }}>
                {style.label}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }}>
                {style.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
