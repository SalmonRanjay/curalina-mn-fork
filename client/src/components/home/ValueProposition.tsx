import { Check } from "lucide-react";
import beforeAfterImage from "@assets/stock_images/beautiful_modern_liv_cc3ef764.jpg";

const benefits = [
  "Every room is handpicked by professional interior designers",
  "Hundreds of premium brands — your design isn't limited to one store",
  "You get shoppable designs — what you see is exactly what you can get",
];

export default function ValueProposition() {
  return (
    <section className="bg-background section-padding" data-testid="section-value-proposition">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Text Content */}
          <div className="stack-roomy flex flex-col" data-testid="value-content">
            <h2 className="font-serif font-medium text-foreground" 
                style={{ fontSize: 'var(--font-size-3xl)' }}
                data-testid="heading-value-prop">
              Designed by humans, powered by smart tools
            </h2>
            
            <ul className="stack-base flex flex-col">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex gap-3" data-testid={`benefit-${index + 1}`}>
                  <div className="flex-shrink-0 w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center mt-1">
                    <Check className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-foreground leading-relaxed" 
                        style={{ fontSize: 'var(--font-size-lg)' }}>
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right - Visual */}
          <div className="relative" data-testid="value-visual">
            <div className="rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <img 
                src={beforeAfterImage} 
                alt="Professional interior design" 
                className="w-full h-[400px] md:h-[500px] object-cover"
                data-testid="img-value-prop"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
