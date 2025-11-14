import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import heroImage from "@assets/stock_images/beautiful_modern_liv_cc3ef764.jpg";
import renderThumb from "@assets/stock_images/organic_modern_bedro_d4118219.jpg";

export default function HeroSection() {
  return (
    <section className="bg-[#FAF9F7] py-16 md:py-24" data-testid="section-hero">
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <div className="space-y-6" data-testid="hero-content">
            {/* Pill Label */}
            <div className="inline-block">
              <span className="px-4 py-2 bg-[#D9F2E5] rounded-full text-xs font-inter font-semibold text-[#24A8AE] uppercase tracking-wider" data-testid="text-pill-label">
                Interior Design, Made Personal
              </span>
            </div>

            {/* H1 Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-cormorant font-medium text-stone-900 leading-tight" data-testid="heading-hero">
              Design the space where you'll feel most at home
            </h1>

            {/* Subtext */}
            <p className="text-base md:text-lg text-stone-600 max-w-xl" data-testid="text-hero-subtext">
              Discover your signature style in just 7 questions — then get a shoppable design tailored to your room, budget, and lifestyle.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/quiz">
                <Button 
                  size="lg"
                  className="bg-[#24A8AE] text-white font-inter font-semibold px-8 py-6 text-base"
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
                className="border-2 border-stone-300 text-stone-700 font-inter font-semibold px-8 py-6 text-base"
              >
                <a href="#styles" data-testid="button-browse-styles-hero">
                  Browse Design Styles
                </a>
              </Button>
            </div>

            {/* Helper Text */}
            <p className="text-sm text-stone-500 italic" data-testid="text-helper">
              Takes about 3 minutes. No wrong answers.
            </p>
          </div>

          {/* Right Column - Hero Image with Floating Card */}
          <div className="relative" data-testid="hero-visual">
            <div className="relative rounded-lg overflow-hidden shadow-lg">
              <img 
                src={heroImage} 
                alt="Beautiful modern living room" 
                className="w-full h-[400px] md:h-[500px] object-cover"
                data-testid="img-hero"
              />
              
              {/* Floating Result Card */}
              <Card className="absolute bottom-4 left-4 right-4 md:right-auto md:w-72 bg-white/95 backdrop-blur-sm p-4 shadow-xl border-none" data-testid="card-floating-preview">
                <div className="flex gap-3">
                  <img 
                    src={renderThumb} 
                    alt="Rendered room example" 
                    className="w-20 h-20 object-cover rounded-md"
                    data-testid="img-preview-thumbnail"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-inter font-semibold text-stone-900" data-testid="text-preview-title">
                      Organic Modern Living Room
                    </p>
                    <p className="text-xs text-stone-600 mb-2" data-testid="text-preview-subtitle">
                      Curated for you
                    </p>
                    <Link href="/results">
                      <span 
                        className="text-xs text-[#24A8AE] hover:underline font-medium cursor-pointer"
                        data-testid="link-see-example"
                      >
                        See an example design →
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
