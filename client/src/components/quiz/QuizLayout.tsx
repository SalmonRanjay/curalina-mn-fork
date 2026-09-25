import { motion } from "framer-motion";
import { ChromeHeader, ChromeFooter } from "./QuizChrome";

interface QuizLayoutProps {
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string; // kept for call-site compatibility; the consultation UI always says "Previous"
  nextLabel?: string;
  canProceed?: boolean;
  showExploreLink?: boolean; // unused in the consultation UI
  hideNext?: boolean;
}

/** Consultation-1 chrome: dark header, content, Previous/Proceed, shared footer. */
export default function QuizLayout({
  currentStep,
  children,
  onPrevious,
  onNext,
  nextLabel = "Proceed",
  canProceed = true,
  hideNext = false,
}: QuizLayoutProps) {
  return (
    <div className="cc-root min-h-screen flex flex-col" data-testid="quiz-layout">
      <ChromeHeader />
      <main className="flex-1">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
        >
          {children}
        </motion.div>

        {(onPrevious || (onNext && !hideNext)) && (
          <div className="max-w-[1400px] mx-auto px-6 md:px-14 py-14 flex items-center justify-between gap-4">
            {onPrevious ? (
              <button onClick={onPrevious} className="cc-btn" data-testid="button-previous">Previous</button>
            ) : (
              <span />
            )}
            {onNext && !hideNext && (
              <button onClick={onNext} disabled={!canProceed} className="cc-btn" data-testid="button-next">
                {nextLabel}
              </button>
            )}
          </div>
        )}
      </main>
      <ChromeFooter />
    </div>
  );
}
