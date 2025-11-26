import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, User, Heart, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

interface QuizLayoutProps {
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  canProceed?: boolean;
  showExploreLink?: boolean;
}

export default function QuizLayout({
  currentStep,
  totalSteps,
  children,
  onPrevious,
  onNext,
  previousLabel = "Previous",
  nextLabel = "Next",
  canProceed = true,
  showExploreLink = false,
}: QuizLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          {/* Logo & Nav Row */}
          <div className="flex items-center justify-between h-16">
            {/* Left: Monogram Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-cormorant font-bold text-lg">C</span>
              </div>
              <span className="hidden md:block font-cormorant text-xl font-medium tracking-wide">
                Curalina
              </span>
            </Link>

            {/* Center: Navigation Menu */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link href="/" className="px-3 py-2 text-xs font-medium tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                GET STARTED
              </Link>
              <span className="text-border">|</span>
              <Link href="/about" className="px-3 py-2 text-xs font-medium tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                HOW WE WORK
              </Link>
              <span className="text-border">|</span>
              <Link href="/styles" className="px-3 py-2 text-xs font-medium tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                EXPLORE STYLES
              </Link>
              <span className="text-border">|</span>
              <Link href="/pricing" className="px-3 py-2 text-xs font-medium tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                PRICING
              </Link>
              <span className="text-border">|</span>
              <Link href="/blog" className="px-3 py-2 text-xs font-medium tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                THE CURALINA EDIT
              </Link>
            </nav>

            {/* Right: Icons */}
            <div className="flex items-center gap-4">
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Profile" data-testid="button-profile">
                <User className="w-5 h-5" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Favourites" data-testid="button-favourites">
                <Heart className="w-5 h-5" />
              </button>
              <Link href="/cart" className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Cart" data-testid="link-cart">
                <ShoppingBag className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Announcement Bar */}
      <div className="bg-muted/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <p className="text-center text-sm text-muted-foreground">
            Everyone has their own sense of style
            <span className="mx-2">|</span>
            <Link href="/styles" className="underline hover:text-foreground transition-colors" data-testid="link-learn-design-styles">
              Learn More About Our Design Styles
            </Link>
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16">
          {/* Step Progress */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <span className="text-sm font-medium tracking-wider text-muted-foreground uppercase">
              Step {currentStep} of {totalSteps}
            </span>
          </motion.div>

          {/* Quiz Content */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-6">
          <div className="flex items-center justify-between">
            {/* Previous */}
            <div className="flex-1">
              {onPrevious && currentStep > 1 && (
                <button
                  onClick={onPrevious}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                  data-testid="button-previous"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="hidden sm:inline">&lt; Previous:</span>
                  <span>{previousLabel}</span>
                </button>
              )}
            </div>

            {/* Center: Explore Link */}
            <div className="flex-1 text-center">
              {showExploreLink && (
                <Link
                  href="/styles"
                  className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
                  data-testid="link-explore-styles"
                >
                  Curious about each look? Explore all styles
                </Link>
              )}
            </div>

            {/* Next */}
            <div className="flex-1 text-right">
              {onNext && (
                <button
                  onClick={onNext}
                  disabled={!canProceed}
                  className={`inline-flex items-center gap-2 text-sm transition-colors group ${
                    canProceed
                      ? "text-foreground hover:text-primary"
                      : "text-muted-foreground/50 cursor-not-allowed"
                  }`}
                  data-testid="button-next"
                >
                  <span>Next:</span>
                  <span>{nextLabel}</span>
                  <ChevronRight className={`w-4 h-4 ${canProceed ? "group-hover:translate-x-1" : ""} transition-transform`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
