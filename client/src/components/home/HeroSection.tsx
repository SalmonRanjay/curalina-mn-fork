import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles } from "lucide-react";
import heroImage from "@assets/stock_images/beautiful_modern_liv_cc3ef764.jpg";
import renderThumb from "@assets/stock_images/organic_modern_bedro_d4118219.jpg";

export default function HeroSection() {
  return (
    <section className="bg-background section-padding md:py-20 lg:py-24" data-testid="section-hero">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="stack-roomy flex flex-col" data-testid="hero-content">
            {/* Pill Label */}
            <div className="inline-block mb-1">
              <Badge variant="secondary" className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-accent/20 text-accent-foreground border-none">
                <Sparkles className="w-3 h-3 mr-1.5 inline" />
                Interior Design, Made Personal
              </Badge>
            </div>

            {/* H1 Headline */}
            <h1 className="font-serif font-medium text-foreground leading-[1.1]" 
                style={{ fontSize: 'var(--font-size-display)' }}
                data-testid="heading-hero">
              Design the space where you'll feel most at home
            </h1>

            {/* Subtext */}
            <p className="text-muted-foreground max-w-xl leading-relaxed" 
               style={{ fontSize: 'var(--font-size-lg)' }}
               data-testid="text-hero-subtext">
              Discover your signature style in just 7 questions — then get a shoppable design tailored to your room, budget, and lifestyle.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <Link href="/quiz">
                <Button 
                  size="lg"
                  className="font-semibold min-h-12 px-8"
                  data-testid="button-take-quiz-hero"
                >
                  Take the Style Quiz
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button 
                asChild
                variant="outline"
                size="lg"
                className="font-semibold min-h-12 px-8"
              >
                <a href="#styles" data-testid="button-browse-styles-hero">
                  Browse Design Styles
                </a>
              </Button>
            </div>

            {/* Helper Text */}
            <p className="text-sm text-muted-foreground italic" data-testid="text-helper">
              Takes about 3 minutes. No wrong answers.
            </p>
          </div>

          {/* Right Column - Hero Image with Floating Card */}
          <div className="relative" data-testid="hero-visual">
            <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-xl)' }}>
              <img 
                src={heroImage} 
                alt="Beautiful modern living room" 
                className="w-full h-[400px] md:h-[550px] lg:h-[600px] object-cover"
                data-testid="img-hero"
              />
              
              {/* Dark gradient overlay for better contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />
              
              {/* Floating Result Card */}
              <Card className="absolute bottom-6 left-6 right-6 md:right-auto md:w-80 surface-elevated backdrop-blur-md p-5 border-card-border hover-elevate" data-testid="card-floating-preview">
                <div className="flex gap-4">
                  <img 
                    src={renderThumb} 
                    alt="Rendered room example" 
                    className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                    data-testid="img-preview-thumbnail"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-card-foreground mb-1 truncate" 
                       style={{ fontSize: 'var(--font-size-base)' }}
                       data-testid="text-preview-title">
                      Organic Modern Living Room
                    </p>
                    <p className="text-sm text-muted-foreground mb-2" data-testid="text-preview-subtitle">
                      Curated for you
                    </p>
                    <Link href="/results">
                      <span 
                        className="text-sm text-primary hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
                        data-testid="link-see-example"
                      >
                        See an example design 
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
