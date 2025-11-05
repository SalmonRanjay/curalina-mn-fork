import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function Pricing() {
  const [, setLocation] = useLocation();

  const plans = [
    {
      name: "Single Room",
      price: "$99",
      description: "Perfect for trying out our service",
      features: [
        "1 Room Design",
        "AI-Generated Render",
        "Curated Furniture List",
        "Shopping Links",
        "Email Support"
      ]
    },
    {
      name: "Full Home",
      price: "$299",
      description: "Most popular for complete homes",
      features: [
        "Up to 5 Rooms",
        "AI-Generated Renders",
        "Priority Support",
        "Custom Modifications",
        "Designer Consultation (30 min)"
      ],
      popular: true
    },
    {
      name: "Professional",
      price: "$599",
      description: "For designers and real estate professionals",
      features: [
        "Unlimited Rooms",
        "White-Label Options",
        "Priority Rendering",
        "Dedicated Account Manager",
        "Commercial License"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />
      <div className="h-28"></div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4" data-testid="heading-pricing">Pricing & Plans</h1>
          <p className="text-xl text-stone-600 dark:text-stone-400">
            Choose the perfect plan for your interior design needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <Card
              key={idx}
              className={`p-8 ${plan.popular ? "border-green-500 border-2 relative" : ""}`}
              data-testid={`pricing-card-${idx}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold text-green-500 mb-2">{plan.price}</div>
              <p className="text-stone-600 dark:text-stone-400 mb-6">{plan.description}</p>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                onClick={() => setLocation("/quiz")}
                data-testid={`button-select-plan-${idx}`}
              >
                Get Started
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
