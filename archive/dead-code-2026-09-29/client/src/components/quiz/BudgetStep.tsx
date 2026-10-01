interface BudgetStepProps {
  value: string;
  onChange: (value: string) => void;
}

const budgets = [
  { id: "budget", label: "Budget-Friendly", range: "Under $5,000", description: "Smart choices that maximize value" },
  { id: "moderate", label: "Moderate", range: "$5,000 - $15,000", description: "Balance of quality and cost" },
  { id: "premium", label: "Premium", range: "$15,000 - $30,000", description: "High-quality pieces and finishes" },
  { id: "luxury", label: "Luxury", range: "$30,000+", description: "Designer pieces and custom work" },
];

export default function BudgetStep({ value, onChange }: BudgetStepProps) {
  return (
    <div>
      <h2 className="font-semibold mb-4" style={{ fontSize: 'var(--font-size-3xl)' }} data-testid="heading-budget">
        What's your budget range?
      </h2>
      <p className="text-muted-foreground mb-8">
        This helps us recommend the right pieces for you
      </p>

      <div className="space-y-4">
        {budgets.map((budget) => {
          const isSelected = value === budget.id;
          
          return (
            <button
              key={budget.id}
              onClick={() => onChange(budget.id)}
              className={`w-full flex items-center justify-between p-6 rounded-lg border-2 text-left transition-all hover-elevate active-elevate-2 ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent"
              }`}
              data-testid={`budget-option-${budget.id}`}
            >
              <div className="flex-1">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-semibold" style={{ fontSize: 'var(--font-size-xl)' }}>
                    {budget.label}
                  </span>
                  <span className="font-medium text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {budget.range}
                  </span>
                </div>
                <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {budget.description}
                </p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ml-4 ${
                isSelected
                  ? "bg-accent border-accent"
                  : "border-border"
              }`}>
                {isSelected && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-accent-foreground rounded-full" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
