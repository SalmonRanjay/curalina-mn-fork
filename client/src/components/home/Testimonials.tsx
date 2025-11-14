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
    <section className="bg-white py-16 md:py-24" data-testid="section-testimonials">
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 lg:px-16">
        {/* Section Title */}
        <h2 className="text-3xl md:text-4xl font-cormorant font-medium text-center text-stone-900 mb-12" data-testid="heading-testimonials">
          Loved by people who care how their home feels
        </h2>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="p-6 border border-stone-200 shadow-sm"
              data-testid={`card-testimonial-${index + 1}`}
            >
              <Quote className="w-8 h-8 text-[#24A8AE] mb-4" data-testid={`icon-quote-${index + 1}`} />
              <p className="text-base text-stone-700 mb-4 italic" data-testid={`quote-${index + 1}`}>
                "{testimonial.quote}"
              </p>
              <div className="border-t border-stone-200 pt-4">
                <p className="font-inter font-semibold text-stone-900" data-testid={`name-${index + 1}`}>
                  {testimonial.name}
                </p>
                <p className="text-sm text-stone-600" data-testid={`room-${index + 1}`}>
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
