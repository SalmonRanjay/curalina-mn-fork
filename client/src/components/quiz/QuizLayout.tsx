import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

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
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal Quiz Header */}
      <header className="sticky top-0 z-50 header-premium">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            {/* Logo */}
            <Link href="/">
              <span className="header-logo cursor-pointer" data-testid="link-logo-quiz">
                Curalina
              </span>
            </Link>

            {/* Step Indicator - Desktop */}
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Step {currentStep} of {totalSteps}
              </span>
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              <Link href="/cart">
                <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="link-cart-quiz">
                  <ShoppingBag className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Progress Bar - Mobile */}
        <div className="md:hidden quiz-progress-container">
          <motion.div
            className="quiz-progress-bar"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progressPercentage / 100 }}
            transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
          />
        </div>
      </header>

      {/* Info Banner */}
      <div className="bg-muted/40 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-2.5">
          <p className="text-center text-sm text-muted-foreground">
            Everyone has their own sense of style
            <span className="mx-2 opacity-50">|</span>
            <Link 
              href="/styles" 
              className="text-primary hover:underline transition-colors font-medium"
              data-testid="link-learn-design-styles"
            >
              Learn More About Our Design Styles
            </Link>
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 py-10 md:py-14 lg:py-16">
        <div className="quiz-container">
          {/* Mobile Step Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 md:hidden"
          >
            <span className="text-sm font-medium tracking-wider text-muted-foreground uppercase">
              Step {currentStep} of {totalSteps}
            </span>
          </motion.div>

          {/* Quiz Content with Animation */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.33, 1, 0.68, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="border-t border-border bg-background sticky bottom-0 z-40">
        <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-4 md:py-5">
          <div className="flex items-center justify-between gap-4">
            {/* Previous Button */}
            <div className="flex-1">
              {onPrevious && currentStep > 1 ? (
                <button
                  onClick={onPrevious}
                  className="quiz-nav-button group"
                  data-testid="button-previous"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="hidden sm:inline">Previous:</span>
                  <span className="quiz-nav-context">{previousLabel}</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            {/* Center: Explore Link */}
            <div className="hidden md:block text-center">
              {showExploreLink && (
                <Link
                  href="/styles"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-explore-styles"
                >
                  Curious about each look? Explore all styles
                </Link>
              )}
            </div>

            {/* Next Button */}
            <div className="flex-1 flex justify-end">
              {onNext && (
                <Button
                  onClick={onNext}
                  disabled={!canProceed}
                  className="gap-2 px-6"
                  data-testid="button-next"
                >
                  <span className="hidden sm:inline">Next:</span>
                  <span>{nextLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
