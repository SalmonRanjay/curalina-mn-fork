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
  // Consultation-1 fields
  atmosphere: string; // 'Bright & Airy' | 'Warm & Balanced' | 'Dark & Moody'
  materiality: string; // canonical style string chosen on the materiality step
  seatingCapacity: number | null; // Dining Room only
  bedSize: string; // Bedroom only
  aestheticCaption: string; // persona caption shown back on the Verify screen (client-only, not submitted)
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
  atmosphere: "",
  materiality: "",
  seatingCapacity: null,
  bedSize: "",
  aestheticCaption: "",
};

const TOTAL_STEPS = 9;
const QUIZ_STORAGE_KEY = "curalina_quiz_progress";

const VALID_COLOR_PALETTES = [
  "Warm Neutrals",
  "Earth & Stone",
  "Coastal Calm",
  "Soft Contrast",
  "Monochrome Luxe",
  "Artful Contrast",
  "Heritage Warmth",
  "Dark & Moody",
];

const CANONICAL_STYLES = ["Organic Modern", "Contemporary Luxe", "Mid-Century Scandinavian"];
const CONSULTATION_ROOMS = ["Living Room", "Dining Room", "Bedroom"];
const CONSULTATION_BUDGETS = ["$20,000-$30,000", "$31,000-$40,000", "$41,000-$50,000", "$51,000-$65,000", "$66,000+"];

function migrateQuizData(data: Partial<QuizData>): QuizData {
  // Merge with defaults to ensure all fields exist (handles old localStorage data)
  const merged: QuizData = {
    ...INITIAL_QUIZ_DATA,
    ...data,
    // Ensure arrays are always arrays (not undefined)
    styles: Array.isArray(data.styles) ? data.styles : [],
    colorPalettes: Array.isArray(data.colorPalettes) ? data.colorPalettes : [],
    textures: Array.isArray(data.textures) ? data.textures : [],
    keyFeatures: Array.isArray(data.keyFeatures) ? data.keyFeatures : [],
    vibeImages: Array.isArray(data.vibeImages) ? data.vibeImages : [],
  };
  
  // Consultation flow: drop saved answers that are no longer valid options
  // rather than silently carrying them into the new steps.
  if (merged.styles.length !== 1 || !CANONICAL_STYLES.includes(merged.styles[0])) {
    merged.styles = [];
    merged.aestheticCaption = "";
  }
  if (!CONSULTATION_ROOMS.includes(merged.roomType)) merged.roomType = "";
  if (!CONSULTATION_BUDGETS.includes(merged.budgetRange)) merged.budgetRange = "";
  if (merged.seatingCapacity !== null && typeof merged.seatingCapacity !== "number") merged.seatingCapacity = null;

  // Filter to only valid color palettes
  const migratedPalettes = merged.colorPalettes.filter((p) =>
    VALID_COLOR_PALETTES.includes(p)
  );
  
  return {
    ...merged,
    colorPalettes: migratedPalettes,
  };
}

export function QuizProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [quizData, setQuizData] = useState<QuizData>(INITIAL_QUIZ_DATA);

  useEffect(() => {
    const saved = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loadedData = parsed.data || INITIAL_QUIZ_DATA;
        const migratedData = migrateQuizData(loadedData);
        setQuizData(migratedData);
        // ALWAYS start at step 1 when entering the quiz
        // This ensures users start fresh instead of resuming from a previous session
        // The quiz data (preferences) are kept for convenience
        setCurrentStep(1);
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
        return quizData.styles.length === 1;
      case 3:
        return quizData.materiality.length > 0;
      case 4:
        return quizData.atmosphere.length > 0;
      case 5:
        return quizData.patternPreference.length > 0;
      case 6:
        return quizData.keyFeatures.length > 0; // seating / bed size rows are optional
      case 7:
        return quizData.budgetRange.length > 0;
      case 8:
        return true; // Verify/Refine has its own Authorize control
      case 9:
        return true; // photo and floorplan are both optional
      default:
        return false;
    }
  };

  const getStepContext = (step: number): { previous: string; next: string } => {
    const contexts: Record<number, { previous: string; next: string }> = {
      1: { previous: "Home", next: "Aesthetic" },
      2: { previous: "Room", next: "Materiality" },
      3: { previous: "Aesthetic", next: "Atmosphere" },
      4: { previous: "Materiality", next: "Pattern" },
      5: { previous: "Atmosphere", next: "Practical touches" },
      6: { previous: "Pattern", next: "Investment" },
      7: { previous: "Practical touches", next: "Verify" },
      8: { previous: "Investment", next: "Context" },
      9: { previous: "Verify", next: "Results" },
    };
    return contexts[step] || { previous: "", next: "" };
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
