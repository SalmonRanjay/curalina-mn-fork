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
      <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="heading-budget">
        What's your budget range?
      </h2>
      <p className="text-stone-600 dark:text-stone-400 mb-8">
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
                  ? "border-green-300 bg-green-50 dark:bg-green-950"
                  : "border-stone-200 dark:border-stone-700 hover:border-green-200"
              }`}
              data-testid={`budget-option-${budget.id}`}
            >
              <div className="flex-1">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className={`text-xl font-semibold ${isSelected ? "text-green-700 dark:text-green-400" : ""}`}>
                    {budget.label}
                  </span>
                  <span className="text-sm font-medium text-stone-500 dark:text-stone-400">
                    {budget.range}
                  </span>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  {budget.description}
                </p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ml-4 ${
                isSelected
                  ? "bg-green-400 border-green-400"
                  : "border-stone-300 dark:border-stone-600"
              }`}>
                {isSelected && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
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
