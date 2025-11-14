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
    <section id="how-it-works" className="bg-white py-16 md:py-24 scroll-mt-20" data-testid="section-how-it-works">
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 lg:px-16">
        {/* Section Title */}
        <h2 className="text-3xl md:text-4xl font-cormorant font-medium text-center text-stone-900 mb-12" data-testid="heading-how-it-works">
          How it works
        </h2>

        {/* Steps Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card 
                key={index} 
                className="p-8 text-center hover-elevate transition-all border border-stone-200"
                data-testid={`card-step-${index + 1}`}
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-[#D9F2E5] rounded-full flex items-center justify-center">
                    <Icon className="w-8 h-8 text-[#24A8AE]" data-testid={`icon-step-${index + 1}`} />
                  </div>
                </div>
                <h3 className="text-xl font-inter font-semibold text-stone-900 mb-3" data-testid={`heading-step-${index + 1}`}>
                  {step.title}
                </h3>
                <p className="text-sm md:text-base text-stone-600" data-testid={`text-step-${index + 1}`}>
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
              className="text-sm font-inter font-medium text-[#24A8AE] hover:underline inline-flex items-center gap-1 cursor-pointer"
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
