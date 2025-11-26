import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface QuizData {
  roomType: string;
  styles: string[];
  colorPalettes: string[];
  lineStyle: string;
  textures: string[];
  lifestyleCue: string;
  patternPreference: string;
  keyFeatures: string[];
  budgetRange: string;
  vibeImages: string[];
  vibeBoardUrl: string;
  preferences: string;
  roomPhoto: string;
  floorplanUrl: string;
  roomDescription: string; // Natural language description of room dimensions and preferences
}

interface QuizContextType {
  currentStep: number;
  quizData: QuizData;
  updateQuizData: (field: keyof QuizData, value: any) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  canProceed: boolean;
  resetQuiz: () => void;
  getStepContext: (step: number) => { previous: string; next: string };
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

const INITIAL_QUIZ_DATA: QuizData = {
  roomType: "",
  styles: [],
  colorPalettes: [],
  lineStyle: "",
  textures: [],
  lifestyleCue: "",
  patternPreference: "",
  keyFeatures: [],
  budgetRange: "",
  vibeImages: [],
  vibeBoardUrl: "",
  preferences: "",
  roomPhoto: "",
  floorplanUrl: "",
  roomDescription: "",
};

const TOTAL_STEPS = 7;
const QUIZ_STORAGE_KEY = "curalina_quiz_progress";

export function QuizProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [quizData, setQuizData] = useState<QuizData>(INITIAL_QUIZ_DATA);

  useEffect(() => {
    const saved = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setQuizData(parsed.data || INITIAL_QUIZ_DATA);
        setCurrentStep(parsed.step || 1);
      } catch (e) {
        console.error("Failed to load saved quiz progress:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify({ data: quizData, step: currentStep })
    );
  }, [quizData, currentStep]);

  const updateQuizData = (field: keyof QuizData, value: any) => {
    setQuizData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return quizData.roomType.length > 0;
      case 2:
        return quizData.styles.length >= 1 && quizData.styles.length <= 2;
      case 3:
        return quizData.colorPalettes.length >= 1 && quizData.colorPalettes.length <= 2;
      case 4:
        return quizData.keyFeatures.length > 0;
      case 5:
        return quizData.budgetRange.length > 0;
      case 6:
        return true;
      case 7:
        return true;
      default:
        return false;
    }
  };

  const getStepContext = (step: number): { previous: string; next: string } => {
    const contexts = {
      1: { previous: "Home", next: "Style" },
      2: { previous: "Room", next: "Colors" },
      3: { previous: "Style", next: "Features" },
      4: { previous: "Colors", next: "Budget" },
      5: { previous: "Features", next: "Vibe" },
      6: { previous: "Budget", next: "Preferences" },
      7: { previous: "Vibe", next: "Results" },
    };
    return contexts[step as keyof typeof contexts] || { previous: "", next: "" };
  };

  const canProceed = validateStep(currentStep);

  const nextStep = () => {
    if (canProceed && currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  };

  const resetQuiz = () => {
    setQuizData(INITIAL_QUIZ_DATA);
    setCurrentStep(1);
    localStorage.removeItem(QUIZ_STORAGE_KEY);
  };

  return (
    <QuizContext.Provider
      value={{
        currentStep,
        quizData,
        updateQuizData,
        nextStep,
        previousStep,
        goToStep,
        canProceed,
        resetQuiz,
        getStepContext,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error("useQuiz must be used within a QuizProvider");
  }
  return context;
}
