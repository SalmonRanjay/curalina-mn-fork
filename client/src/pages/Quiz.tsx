import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { getOrCreateSessionId } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { useQuiz } from "@/contexts/QuizContext";
import Dropzone from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import colorPalette from "@assets/image001_1762335467188.png";
import RoomTypeStep from "@/components/quiz/RoomTypeStep";
import RoomTypeStepV2 from "@/components/quiz/RoomTypeStepV2";
import StyleSelectionStepV2 from "@/components/quiz/StyleSelectionStepV2";
import ColorMaterialsStepV2 from "@/components/quiz/ColorMaterialsStepV2";
import FeaturesStepV2 from "@/components/quiz/FeaturesStepV2";
import { BudgetStepV2 } from "@/components/quiz/BudgetStepV2";
import { VibeCheckStepV2 } from "@/components/quiz/VibeCheckStepV2";
import { FinalStepV2 } from "@/components/quiz/FinalStepV2";
import QuizLayout from "@/components/quiz/QuizLayout";

const TOTAL_STEPS = 7;

// Define your Firebase Functions API base URL here
// IMPORTANT: Replace with your actual deployed Firebase Function URL
// Ensure this URL is correct and points to your API
const API_BASE_URL = "https://us-central1-curalina-replit-57401799-974b8.cloudfunctions.net/api";

export default function Quiz() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Use QuizContext for state management
  const {
    currentStep,
    quizData,
    updateQuizData,
    nextStep,
    previousStep,
    canProceed,
    getStepContext,
  } = useQuiz();

  // UI state (local to this component)
  const [expandedStyles, setExpandedStyles] = useState<string[]>([]);
  const [uploadingVibe, setUploadingVibe] = useState(false);
  const [uploadingFloorplan, setUploadingFloorplan] = useState(false);
  const [showDimensionConfirmation, setShowDimensionConfirmation] =
    useState(false);
  const [parsedDimensions, setParsedDimensions] = useState<any>(null);

  const submitQuizMutation = useMutation({
    mutationFn: async (data: typeof quizData) => {
      const sessionId = getOrCreateSessionId();

      // Transform data to match backend schema
      const submitData = {
        sessionId,
        roomType: data.roomType,
        styles: data.styles, // Now supports array of 1-2 styles
        colorPalettes: data.colorPalettes,
        lineStyle: data.lineStyle || null,
        textures: data.textures,
        lifestyleCue: data.lifestyleCue || null,
        patternPreference: data.patternPreference || null,
        keyFeatures: data.keyFeatures,
        budgetRange: data.budgetRange,
        vibeImages: data.vibeImages,
        vibeBoardUrl: data.vibeBoardUrl || null,
        preferences: data.preferences ? [data.preferences] : [], // Convert string to array
        roomPhoto: data.roomPhoto || null,
        floorplanUrl: data.floorplanUrl || null,
        roomDescription: data.roomDescription || null,
      };

      // Step 1: Submit quiz
      const quizResponse = await fetch(`${API_BASE_URL}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      if (!quizResponse.ok) {
        const errorData = await quizResponse.json();
        console.error("Quiz submission error:", errorData);
        throw new Error(errorData.error || "Failed to submit quiz");
      }

      const quiz = await quizResponse.json();

      // Step 2: Create render and start AI generation
      const renderResponse = await fetch(`${API_BASE_URL}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizResponseId: quiz.id,
          sessionId,
        }),
      });

      if (!renderResponse.ok) {
        const errorData = await renderResponse.json();
        console.error("Render creation error:", errorData);
        throw new Error(errorData.error || "Failed to start AI generation");
      }

      const render = await renderResponse.json();
      
      // Return both quiz and render data
      return { quiz, renderId: render.id, sessionId };
    },
    onSuccess: (data) => {
      const { quiz, renderId, sessionId: renderSessionId } = data;
      // If room dimensions were parsed, show confirmation dialog
      if (
        quiz.parsedRoomData &&
        typeof quiz.parsedRoomData === "object" &&
        Object.keys(quiz.parsedRoomData).length > 0
      ) {
        setParsedDimensions(quiz.parsedRoomData);
        // Store render info for after confirmation
        (window as any).__pendingRenderInfo = { renderId, sessionId: renderSessionId };
        setShowDimensionConfirmation(true);
      } else {
        // No dimensions to confirm, proceed directly with render info in URL
        setLocation(`/loading?renderId=${renderId}&sessionId=${renderSessionId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadViaPresignedUrl = async (file: File) => {
    // 1) Ask backend for a presigned URL
    // NOTE: This assumes your backend /api/upload now supports this JSON format
    const initRes = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    });

    if (!initRes.ok) {
       // Fallback for old multipart behavior if server not updated yet
       // This is a safety measure during transition
       if (initRes.status === 400 || initRes.status === 404) {
          console.warn("Presigned URL endpoint might not be ready, trying legacy multipart upload...");
           // NOTE: We cannot easily fallback to multipart here because the function signature is different
           // Ideally, the server should be updated first.
           const errorText = await initRes.text();
           throw new Error(`Failed to get upload parameters: ${errorText}`);
       }
       throw new Error("Failed to get upload parameters");
    }

    const data = await initRes.json() as {
      method: string;
      url: string;
      headers?: Record<string, string>;
      fields?: Record<string, string>;
      publicUrl?: string; // Optional: if server returns the final public URL
    };

    // 2) Upload file directly to S3 with the presigned URL
    const putRes = await fetch(data.url, {
      method: data.method || "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        ...(data.headers || {}),
      },
      body: file,
    });

    if (!putRes.ok) {
      throw new Error("Failed to upload file to storage");
    }

    // 3) Return the public (or at least stable) URL
    // If the server provided a publicUrl, use it. Otherwise, assume presigned URL without query params.
    if (data.publicUrl) return data.publicUrl;
    
    // Fallback: strip query params from presigned URL (works for some setups, but risky if bucket is private)
    // Better to have server return the public URL.
    return data.url.split("?")[0]; 
  };

  const handleFileUpload = async (
    files: File[],
    type: "vibe" | "floorplan",
  ) => {
    if (files.length === 0) return;

    if (type === "vibe") setUploadingVibe(true);
    else setUploadingFloorplan(true);

    try {
      console.log(`Uploading ${files.length} file(s) via presigned URL...`);
      
      const uploadPromises = files.map(file => uploadViaPresignedUrl(file));
      const urls = await Promise.all(uploadPromises);

      console.log("Upload successful, urls:", urls);

      if (urls.length === 0) {
        throw new Error("No URLs returned from upload");
      }

      if (type === "vibe") {
        updateQuizData("vibeImages", [...quizData.vibeImages, ...urls]);
      } else {
        updateQuizData("floorplanUrl", urls[0] || "");
      }

      toast({
        title: "Success",
        description: `${files.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (type === "vibe") setUploadingVibe(false);
      else setUploadingFloorplan(false);
    }
  };

  const handleNext = () => {
    if (!canProceed) {
      toast({
        title: "Please complete this step",
        description: "Fill out all required fields before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (currentStep < TOTAL_STEPS) {
      nextStep();
    } else {
      submitQuizMutation.mutate(quizData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      previousStep();
    }
  };

  // Cascade animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const renderStep1 = () => {
    return (
      <RoomTypeStepV2
        value={quizData.roomType}
        onChange={(value) => updateQuizData("roomType", value)}
      />
    );
  };

  const renderStep2 = () => {
    return (
      <StyleSelectionStepV2
        value={quizData.styles}
        onChange={(styles) => updateQuizData("styles", styles)}
        maxSelections={2}
      />
    );
  };

  // Step 3: Combined Color Palette & Materials
  const renderStep3 = () => {
    return (
      <ColorMaterialsStepV2
        colorPalettes={quizData.colorPalettes}
        lineStyle={quizData.lineStyle}
        selectedTextures={quizData.textures}
        patternPreference={quizData.patternPreference}
        onColorChange={(palettes) => updateQuizData("colorPalettes", palettes)}
        onLineStyleChange={(style) => updateQuizData("lineStyle", style)}
        onTexturesChange={(textures) => updateQuizData("textures", textures)}
        onPatternChange={(pattern) => updateQuizData("patternPreference", pattern)}
        maxColorSelections={2}
        maxTextureSelections={2}
      />
    );
  };

  // Step 4: Functional Features
  const renderStep4 = () => {
    return (
      <FeaturesStepV2
        roomType={quizData.roomType}
        value={quizData.keyFeatures}
        onChange={(features) => updateQuizData("keyFeatures", features)}
      />
    );
  };

  // Step 5: Budget
  const renderStep5 = () => {
    return (
      <BudgetStepV2
        value={quizData.budgetRange}
        onChange={(budget) => updateQuizData("budgetRange", budget)}
      />
    );
  };

  // Step 6: Vibe Check
  const renderStep6 = () => {
    return (
      <VibeCheckStepV2
        vibeImages={quizData.vibeImages}
        onUpload={(files) => handleFileUpload(files, "vibe")}
        onRemove={(idx) =>
          updateQuizData(
            "vibeImages",
            quizData.vibeImages.filter((_, i) => i !== idx),
          )
        }
        isUploading={uploadingVibe}
      />
    );
  };

  // Step 7: Final Step
  const renderStep7 = () => {
    return (
      <FinalStepV2
        floorplanUrl={quizData.floorplanUrl}
        roomDescription={quizData.roomDescription}
        onPhotoUpload={(files) => handleFileUpload(files, "floorplan")} // Reusing logic for photo/floorplan
        onFloorplanUpload={(files) => handleFileUpload(files, "floorplan")}
        onDescriptionChange={(desc) => updateQuizData("roomDescription", desc)}
        isUploadingFloorplan={uploadingFloorplan}
      />
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      case 7:
        return renderStep7();
      default:
        return null;
    }
  };

  return (
    <>
      <QuizLayout
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        onPrevious={currentStep > 1 ? handleBack : undefined}
        onNext={handleNext}
        previousLabel={getStepContext(currentStep).previous}
        nextLabel={currentStep === TOTAL_STEPS ? "Submit" : getStepContext(currentStep).next}
        canProceed={canProceed && !submitQuizMutation.isPending}
        showExploreLink={currentStep === 2}
      >
        {renderStep()}
      </QuizLayout>

      {/* Room Dimensions Confirmation Dialog */}
      <Dialog
        open={showDimensionConfirmation}
        onOpenChange={setShowDimensionConfirmation}
      >
        <DialogContent
          className="sm:max-w-md"
          data-testid="dialog-dimension-confirmation"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent" />
              We understood your room
            </DialogTitle>
            <DialogDescription>
              Based on your description, here's what we understood about your
              space:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Room Dimensions */}
            {parsedDimensions?.dimensions && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">
                  Room Dimensions
                </h4>
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  {parsedDimensions.dimensions.width &&
                  parsedDimensions.dimensions.depth ? (
                    <p>
                      {parsedDimensions.dimensions.width}' ×{" "}
                      {parsedDimensions.dimensions.depth}'
                      {parsedDimensions.dimensions.height &&
                        ` with ${parsedDimensions.dimensions.height}' height`}
                    </p>
                  ) : (
                    <p>Dimensions partially detected</p>
                  )}
                  {parsedDimensions.dimensions.confidence < 80 && (
                    <div className="flex items-center gap-1 mt-2 text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-xs">
                        Low confidence ({parsedDimensions.dimensions.confidence}
                        %)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Doorway */}
            {parsedDimensions?.doorway && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">Doorway</h4>
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <p>
                    {parsedDimensions.doorway.width}" wide
                    {parsedDimensions.doorway.height &&
                      ` × ${parsedDimensions.doorway.height}" tall`}
                  </p>
                  {parsedDimensions.doorway.confidence < 80 && (
                    <div className="flex items-center gap-1 mt-2 text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-xs">
                        Low confidence ({parsedDimensions.doorway.confidence}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ceiling Height */}
            {parsedDimensions?.ceilingHeight && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">
                  Ceiling Height
                </h4>
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <p>{parsedDimensions.ceilingHeight.height}' high</p>
                  {parsedDimensions.ceilingHeight.confidence < 80 && (
                    <div className="flex items-center gap-1 mt-2 text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-xs">
                        Low confidence (
                        {parsedDimensions.ceilingHeight.confidence}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            {parsedDimensions?.warnings &&
              parsedDimensions.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-foreground flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                    Notes
                  </h4>
                  <ul className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md space-y-1">
                    {parsedDimensions.warnings.map(
                      (warning: string, idx: number) => (
                        <li key={idx}>• {warning}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDimensionConfirmation(false);
                setParsedDimensions(null);
                // Don't navigate, let user edit the description
              }}
              className="flex-1"
              data-testid="button-edit-dimensions"
            >
              Edit Description
            </Button>
            <Button
              onClick={() => {
                setShowDimensionConfirmation(false);
                setParsedDimensions(null);
                // Use stored render info from submission
                const renderInfo = (window as any).__pendingRenderInfo;
                if (renderInfo) {
                  setLocation(`/loading?renderId=${renderInfo.renderId}&sessionId=${renderInfo.sessionId}`);
                  delete (window as any).__pendingRenderInfo;
                } else {
                  setLocation("/loading");
                }
              }}
              className="flex-1"
              data-testid="button-confirm-dimensions"
            >
              Looks Good!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
