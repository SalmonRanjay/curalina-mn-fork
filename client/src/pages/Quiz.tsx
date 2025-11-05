import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { getOrCreateSessionId } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";

// Step components
import RoomTypeStep from "@/components/quiz/RoomTypeStep";
import StyleStep from "@/components/quiz/StyleStep";
import FeaturesStep from "@/components/quiz/FeaturesStep";
import BudgetStep from "@/components/quiz/BudgetStep";
import VibeUploadStep from "@/components/quiz/VibeUploadStep";
import PreferencesStep from "@/components/quiz/PreferencesStep";
import FloorplanStep from "@/components/quiz/FloorplanStep";

const TOTAL_STEPS = 7;

export default function Quiz() {
  const [currentStep, setCurrentStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Quiz data state
  const [quizData, setQuizData] = useState({
    roomType: "",
    style: "",
    keyFeatures: [] as string[],
    budgetRange: "",
    vibeImages: [] as string[],
    preferences: [] as string[],
    floorplanUrl: "",
  });

  const submitQuizMutation = useMutation({
    mutationFn: async (data: typeof quizData) => {
      const sessionId = getOrCreateSessionId();
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, sessionId }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Navigate to loading page, which will redirect to results
      setLocation("/loading");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateQuizData = (field: string, value: any) => {
    setQuizData(prev => ({ ...prev, [field]: value }));
  };

  const canContinue = () => {
    switch (currentStep) {
      case 1: return !!quizData.roomType;
      case 2: return !!quizData.style;
      case 3: return quizData.keyFeatures.length > 0;
      case 4: return !!quizData.budgetRange;
      case 5: return quizData.vibeImages.length > 0;
      case 6: return quizData.preferences.length > 0;
      case 7: return true; // Floorplan is optional
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Submit quiz
      submitQuizMutation.mutate(quizData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <RoomTypeStep value={quizData.roomType} onChange={(v: string) => updateQuizData("roomType", v)} />;
      case 2:
        return <StyleStep value={quizData.style} onChange={(v: string) => updateQuizData("style", v)} />;
      case 3:
        return <FeaturesStep value={quizData.keyFeatures} onChange={(v: string[]) => updateQuizData("keyFeatures", v)} />;
      case 4:
        return <BudgetStep value={quizData.budgetRange} onChange={(v: string) => updateQuizData("budgetRange", v)} />;
      case 5:
        return <VibeUploadStep value={quizData.vibeImages} onChange={(v: string[]) => updateQuizData("vibeImages", v)} />;
      case 6:
        return <PreferencesStep value={quizData.preferences} onChange={(v: string[]) => updateQuizData("preferences", v)} />;
      case 7:
        return <FloorplanStep value={quizData.floorplanUrl} onChange={(v: string) => updateQuizData("floorplanUrl", v)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 py-16 md:py-24 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-12" data-testid="quiz-progress">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-12 rounded-full transition-all duration-300 ${
                i + 1 < currentStep
                  ? "bg-green-400"
                  : i + 1 === currentStep
                  ? "bg-green-300"
                  : "bg-stone-200 dark:bg-stone-700"
              }`}
              data-testid={`progress-step-${i + 1}`}
            />
          ))}
        </div>

        {/* Quiz Container */}
        <div className="bg-white dark:bg-stone-900 rounded-lg shadow-lg p-8 md:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-12 pt-8 border-t">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <p className="text-sm text-stone-500 dark:text-stone-400" data-testid="text-step-counter">
              Step {currentStep} of {TOTAL_STEPS}
            </p>

            <Button
              onClick={handleNext}
              disabled={!canContinue() || submitQuizMutation.isPending}
              className="bg-green-400 hover:bg-green-500 text-white"
              data-testid="button-continue"
            >
              {currentStep === TOTAL_STEPS ? (
                submitQuizMutation.isPending ? "Submitting..." : "Generate Design"
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
