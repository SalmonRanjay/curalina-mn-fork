import { Card } from "@/components/ui/card";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "Curalina transformed my living room into exactly what I envisioned. The quiz was fun and the results were spot-on!",
    name: "Sarah M.",
    room: "1-bedroom condo living room",
  },
  {
    quote: "I loved being able to shop everything directly. No more hunting for similar items — it's all right there.",
    name: "Michael T.",
    room: "Home office",
  },
  {
    quote: "The design felt so personal to my style. It's like having an interior designer who really gets you.",
    name: "Jessica L.",
    room: "Primary bedroom",
  },
];

export default function Testimonials() {
  return (
    <section className="surface-soft section-padding" data-testid="section-testimonials">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        {/* Section Title */}
        <h2 className="font-serif font-medium text-center text-foreground mb-12 md:mb-16" 
            style={{ fontSize: 'var(--font-size-3xl)' }}
            data-testid="heading-testimonials">
          Loved by people who care how their home feels
        </h2>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="p-6 border-card-border stack-base flex flex-col"
              data-testid={`card-testimonial-${index + 1}`}
            >
              <Quote className="w-8 h-8 text-accent mb-3" data-testid={`icon-quote-${index + 1}`} />
              <p className="text-card-foreground mb-4 italic leading-relaxed flex-1" 
                 style={{ fontSize: 'var(--font-size-base)' }}
                 data-testid={`quote-${index + 1}`}>
                "{testimonial.quote}"
              </p>
              <div className="border-t border-border pt-4 stack-tight flex flex-col">
                <p className="font-semibold text-card-foreground" data-testid={`name-${index + 1}`}>
                  {testimonial.name}
                </p>
                <p className="text-sm text-muted-foreground" data-testid={`room-${index + 1}`}>
                  {testimonial.room}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
