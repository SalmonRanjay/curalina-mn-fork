import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

import {
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { getOrCreateSessionId } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { useQuiz } from "@/contexts/QuizContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ConsultRoomStep,
  ConsultAestheticStep,
  ConsultMaterialityStep,
  ConsultAtmosphereStep,
  ConsultPatternStep,
  ConsultTouchesStep,
  ConsultInvestmentStep,
} from "@/components/quiz/ConsultQuestionSteps";
import ConsultVerifyStep from "@/components/quiz/ConsultVerifyStep";
import ConsultContextStep from "@/components/quiz/ConsultContextStep";
import QuizLayout from "@/components/quiz/QuizLayout";
// The V2 step components (RoomTypeStepV2, StyleSelectionStepV2, ColorMaterialsStepV2,
// FeaturesStepV2, BudgetStepV2, VibeCheckStepV2, FinalStepV2) remain in the repo but are
// no longer part of the flow (consultation-1 replaced it).

// 7 questions + verify/refine + environmental context
const TOTAL_STEPS = 9;

const API_BASE_URL = "/api";

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
        atmosphere: data.atmosphere || null,
        materiality: data.materiality || null,
        // Room-scoped answers: never send a value for a room it does not apply to.
        seatingCapacity: data.roomType === "Dining Room" ? data.seatingCapacity : null,
        bedSize: data.roomType === "Bedroom" ? data.bedSize || null : null,
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
    // Local/dev implementation: use existing multipart /api/upload endpoint
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "quiz-uploads");

    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(errorText || "Failed to upload file");
    }

    const data = await res.json() as { url?: string };
    if (!data.url) {
      throw new Error("Upload did not return a URL");
    }

    return data.url;
  };

  const handleFileUpload = async (
    files: File[],
    type: "photo" | "floorplan",
  ) => {
    if (files.length === 0) return;

    if (type === "photo") setUploadingPhoto(true);
    else setUploadingFloorplan(true);

    try {
      console.log(`Uploading ${files.length} file(s) via presigned URL...`);
      
      const uploadPromises = files.map(file => uploadViaPresignedUrl(file));
      const urls = await Promise.all(uploadPromises);

      console.log("Upload successful, urls:", urls);

      if (urls.length === 0) {
        throw new Error("No URLs returned from upload");
      }

      if (type === "photo") {
        updateQuizData("roomPhoto", urls[0] || "");
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
      if (type === "photo") setUploadingPhoto(false);
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

  const handleRoomChange = (room: string) => {
    if (room !== quizData.roomType) {
      // Touches, seating and bed size are room-scoped; drop answers that no longer apply.
      updateQuizData("keyFeatures", []);
      updateQuizData("seatingCapacity", null);
      updateQuizData("bedSize", "");
    }
    updateQuizData("roomType", room);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <ConsultRoomStep value={quizData.roomType} onChange={handleRoomChange} />;
      case 2:
        return (
          <ConsultAestheticStep
            style={quizData.styles[0] ?? ""}
            onChange={(style, caption) => {
              updateQuizData("styles", [style]);
              updateQuizData("aestheticCaption", caption);
            }}
          />
        );
      case 3:
        return <ConsultMaterialityStep value={quizData.materiality} onChange={(v) => updateQuizData("materiality", v)} />;
      case 4:
        return <ConsultAtmosphereStep value={quizData.atmosphere} onChange={(v) => updateQuizData("atmosphere", v)} />;
      case 5:
        return <ConsultPatternStep value={quizData.patternPreference} onChange={(v) => updateQuizData("patternPreference", v)} />;
      case 6:
        return (
          <ConsultTouchesStep
            roomType={quizData.roomType}
            touches={quizData.keyFeatures}
            seatingCapacity={quizData.seatingCapacity}
            bedSize={quizData.bedSize}
            onTouchesChange={(v) => updateQuizData("keyFeatures", v)}
            onSeatingChange={(v) => updateQuizData("seatingCapacity", v)}
            onBedSizeChange={(v) => updateQuizData("bedSize", v)}
          />
        );
      case 7:
        return <ConsultInvestmentStep value={quizData.budgetRange} onChange={(v) => updateQuizData("budgetRange", v)} />;
      case 8:
        return (
          <ConsultVerifyStep
            data={quizData}
            onUpdate={(patch) => (Object.keys(patch) as Array<keyof typeof quizData>).forEach((k) => updateQuizData(k, patch[k]))}
            onAuthorize={nextStep}
          />
        );
      case 9:
        return (
          <ConsultContextStep
            roomPhoto={quizData.roomPhoto}
            floorplanUrl={quizData.floorplanUrl}
            onPhotoUpload={(files) => handleFileUpload(files, "photo")}
            onFloorplanUpload={(files) => handleFileUpload(files, "floorplan")}
            isUploadingPhoto={uploadingPhoto}
            isUploadingFloorplan={uploadingFloorplan}
          />
        );
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
        nextLabel={currentStep === 1 ? "Initiate the Refinement" : currentStep === TOTAL_STEPS ? "Generate Design" : "Proceed"}
        canProceed={canProceed && !submitQuizMutation.isPending}
        hideNext={currentStep === 8}
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
