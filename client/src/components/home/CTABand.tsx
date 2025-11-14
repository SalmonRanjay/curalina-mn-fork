import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function CTABand() {
  return (
    <section className="bg-[#F3F0EB] py-16 md:py-20" data-testid="section-cta-band">
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 lg:px-16 text-center">
        <h2 className="text-3xl md:text-4xl font-cormorant font-medium text-stone-900 mb-4" data-testid="heading-cta-band">
          Your dream room is 7 questions away
        </h2>
        <p className="text-base md:text-lg text-stone-600 mb-8" data-testid="text-cta-helper">
          It takes about 3 minutes. There are no wrong answers.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link href="/quiz">
            <Button 
              size="lg"
              className="bg-[#24A8AE] text-white font-inter font-semibold px-10 py-6 text-lg"
              data-testid="button-start-quiz-cta"
            >
              Start the Quiz
            </Button>
          </Link>
          <Link href="/results">
            <span 
              className="text-sm font-inter font-medium text-stone-600 hover:text-[#24A8AE] transition-colors cursor-pointer"
              data-testid="link-see-example-cta"
            >
              See an example room first →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
