import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Home, Sparkles, ShoppingBag } from "lucide-react";

const steps = [
  {
    icon: Home,
    title: "Tell us about your space",
    description: "Choose your room, styles and colour palette in just a few clicks.",
  },
  {
    icon: Sparkles,
    title: "We design it for you",
    description: "Our designers curate furniture and decor tailored to your answers.",
  },
  {
    icon: ShoppingBag,
    title: "Shop your room",
    description: "View your rendered room and instantly shop every piece.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="surface-soft section-padding scroll-mt-20" data-testid="section-how-it-works">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        {/* Section Title */}
        <h2 className="font-serif font-medium text-center text-foreground mb-12 md:mb-16" 
            style={{ fontSize: 'var(--font-size-3xl)' }}
            data-testid="heading-how-it-works">
          How it works
        </h2>

        {/* Steps Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card 
                key={index} 
                className="p-8 text-center hover-elevate transition-all border-card-border stack-base flex flex-col items-center"
                data-testid={`card-step-${index + 1}`}
              >
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                  <Icon className="w-8 h-8 text-accent" data-testid={`icon-step-${index + 1}`} />
                </div>
                <h3 className="font-semibold text-card-foreground mb-2" 
                    style={{ fontSize: 'var(--font-size-xl)' }}
                    data-testid={`heading-step-${index + 1}`}>
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed" 
                   style={{ fontSize: 'var(--font-size-base)' }}
                   data-testid={`text-step-${index + 1}`}>
                  {step.description}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Bottom Link */}
        <div className="text-center">
          <Link href="/about">
            <span 
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              data-testid="link-learn-more-process"
            >
              Learn more about our process →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
