import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function CTABand() {
  return (
    <section className="bg-muted section-padding md:py-20" data-testid="section-cta-band">
      <div className="max-w-4xl mx-auto px-6 md:px-12 lg:px-16 text-center stack-roomy flex flex-col items-center">
        <h2 className="font-serif font-medium text-foreground" 
            style={{ fontSize: 'var(--font-size-3xl)' }}
            data-testid="heading-cta-band">
          Your dream room is 7 questions away
        </h2>
        <p className="text-muted-foreground max-w-2xl" 
           style={{ fontSize: 'var(--font-size-lg)' }}
           data-testid="text-cta-helper">
          It takes about 3 minutes. There are no wrong answers.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link href="/quiz">
            <Button 
              size="lg"
              className="font-semibold px-10 min-h-14"
              data-testid="button-start-quiz-cta"
            >
              Start the Quiz
            </Button>
          </Link>
          <Link href="/results">
            <span 
              className="font-medium text-foreground/70 hover:text-accent transition-colors cursor-pointer"
              style={{ fontSize: 'var(--font-size-sm)' }}
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
