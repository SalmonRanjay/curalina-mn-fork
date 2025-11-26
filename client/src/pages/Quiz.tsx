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

const TOTAL_STEPS = 8;

// Style data with Key Characteristics
const STYLES_DATA = {
  "Midcentury Scandi": {
    moodWords: "Vintage, retro, functional, warm, clean, natural, refined",
    textures:
      "Woods are a staple like oak and walnut, often paired with leather, durable wools, cotton and matte metals",
    furniture:
      "Furniture has clean lines, soft curves, and minimalist forms, with natural wood finishes and tapered legs that add timeless warmth and function.",
    colorPalette:
      "Soft neutrals like off-white, warm beige, and light grey form a timeless base. Accents in sage, teal, mustard, burnt orange, and burgundy add retro warmth and contrast.",
    renders: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1615875474908-f403609c4ccc?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=300&fit=crop",
    ],
  },
  "Organic Modern": {
    moodWords:
      "Earthy, uncluttered, tranquil, zen-inspired, textural, rounded edges, plush, minimalistic",
    textures:
      "Breathable linens, soft cotton, cozy bouclé paired with warm oaks, tactile rugs, neutral matte stones, clay & plaster",
    furniture:
      "Furniture features low-profile, minimalist designs with soft curves and sculpted edges, replacing harsh modern angles.",
    colorPalette:
      "Whites, bones, chalks & earthy neutrals with small nature-inspired accents of sage, terracotta",
    renders: [
      "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop",
    ],
  },
  "Modern Farmhouse": {
    moodWords:
      "Rustic, casual, heritage-inspired, cozy, wholesome, vintage charm, worn-in",
    textures:
      "Distressed and whitewashed woods, matte stones, exposed brick, butcher blocks, knits, boucle, woven wool, cotton and linen",
    furniture:
      "Oversized armchairs, plush slipcovered sofas that invite relaxation with built-in storage",
    colorPalette:
      "Foundational neutrals of creamy white and greige, contrasting accents of black metals and nature inspired hues of deep green, pale blue and terracotta",
    renders: [
      "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566753151-384129cf4e3e?w=400&h=300&fit=crop",
    ],
  },
  "Warm Transitional": {
    moodWords:
      "Timeless blend of traditional and modern, with tailored comfort and understated elegance that's refined, classic, and polished",
    textures:
      "Polished metals, rich woods, velvet upholstery, chenille, bouclé, silk drapes, and veined marble surfaces",
    furniture:
      "Combines traditional curves with modern clean lines, subtle nailhead trim, piping and metal knobs",
    colorPalette:
      "Creamy white, warm greige, charcoal grey, espresso brown, bronze, brushed gold, antique nickel, soft blush, mauve, pewter, sage green, dusty blue, slate blue",
    renders: [
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=400&h=300&fit=crop",
    ],
  },
  "Contemporary Luxe": {
    moodWords:
      "Sophisticated, minimal yet rich, polished, glamorous, refined, sleek, chic, upscale, curated",
    textures:
      "Plush velvet, vegan furs, high performance linen, leather, lacquered surfaces, smooth woods & finishes, polished or honed marbles, quarzite and travertines",
    furniture:
      "Clean sculptural lines, sleek silhouettes, gentle curves, architectural forms, statement pieces, art-inspired design, polished finishes, high-end materials, luxury accent chairs, curated furniture",
    colorPalette:
      "Ivory white, bone white, warm taupe, greige, putty beige, charcoal grey, matte black, espresso brown, brushed gold, antique brass, emerald green, sapphire blue, dusty rose, muted mauve",
    renders: [
      "https://images.unsplash.com/photo-1600566753414-2afc9e2f5a28?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600563438938-a9a27216b4f5?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop",
    ],
  },
};

// Key Features by Room Type
const KEY_FEATURES_BY_ROOM: Record<
  string,
  Array<{ label: string; subtitle?: string }>
> = {
  "Living Room": [
    { label: "Storage Solutions", subtitle: "Shelves & cabinetry" },
    { label: "Workspace Area", subtitle: "Integrated office" },
    { label: "Comfortable Seat", subtitle: "Sectional or deep sofa" },
    { label: "Accent Lighting", subtitle: "Ambient & Task" },
    { label: "Pet-Friendly", subtitle: "Durable fabrics" },
    { label: "Child-Friendly", subtitle: "Toy storage, rounded edges" },
    { label: "Media Area", subtitle: "Entertainment Cabinet" },
    { label: "Multi-Function", subtitle: "Sofa Bed" },
  ],
  Bedroom: [
    { label: "Storage Solutions", subtitle: "Clothing & Linens" },
    { label: "Workspace Area", subtitle: "Integrated office" },
    { label: "Vanity Table", subtitle: "" },
    { label: "Comfortable Seat", subtitle: "Reading Chair" },
    { label: "Media Area", subtitle: "TV Cabinet" },
    { label: "Twin/Single Bed", subtitle: '38" wide x 75" long' },
    { label: "Double Bed", subtitle: '54" wide x 75" long' },
    { label: "Queen Bed", subtitle: '60" wide x 75" long' },
    { label: "King Bed", subtitle: '76" wide x 80" long' },
  ],
  "Dining Room": [
    { label: "Casual Setting", subtitle: "Relaxed & Everyday" },
    { label: "Formal Setting", subtitle: "Elevated & Polished" },
    { label: "Bar Storage", subtitle: "Wine and Liquor" },
    { label: "Open or Closed Storage", subtitle: "Organize clutter" },
  ],
  "Home Office": [
    { label: "Concealed Storage", subtitle: "Keep clutter out" },
    { label: "Bookcase Storage", subtitle: "Open Shelves" },
    { label: "Filing Storage", subtitle: "Documents & Files" },
    { label: "Reading Chair", subtitle: "Comfortable Seat" },
    { label: "Large Desk", subtitle: '52" to 62"' },
    { label: "Small Desk", subtitle: '32" to 48"' },
  
  ],
};

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
      const quizResponse = await fetch("/api/quiz", {
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
      const renderResponse = await fetch("/api/render", {
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

      return quiz;
    },
    onSuccess: (quiz) => {
      // If room dimensions were parsed, show confirmation dialog
      if (
        quiz.parsedRoomData &&
        typeof quiz.parsedRoomData === "object" &&
        Object.keys(quiz.parsedRoomData).length > 0
      ) {
        setParsedDimensions(quiz.parsedRoomData);
        setShowDimensionConfirmation(true);
      } else {
        // No dimensions to confirm, proceed directly
        setLocation("/loading");
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

  const toggleStyle = (style: string) => {
    const currentStyles = quizData.styles;
    if (currentStyles.includes(style)) {
      updateQuizData(
        "styles",
        currentStyles.filter((s) => s !== style),
      );
    } else if (currentStyles.length < 2) {
      updateQuizData("styles", [...currentStyles, style]);
    } else {
      toast({
        title: "Maximum Selections",
        description: "You can select up to 2 styles only.",
        variant: "destructive",
      });
    }
  };

  const toggleColorPalette = (palette: string) => {
    const currentPalettes = quizData.colorPalettes;
    if (currentPalettes.includes(palette)) {
      updateQuizData(
        "colorPalettes",
        currentPalettes.filter((p) => p !== palette),
      );
    } else if (currentPalettes.length < 2) {
      updateQuizData("colorPalettes", [...currentPalettes, palette]);
    } else {
      toast({
        title: "Maximum Selections",
        description: "You can select up to 2 colour palettes only.",
        variant: "destructive",
      });
    }
  };

  const toggleKeyFeature = (feature: string) => {
    const current = quizData.keyFeatures;
    if (current.includes(feature)) {
      updateQuizData(
        "keyFeatures",
        current.filter((f) => f !== feature),
      );
    } else {
      updateQuizData("keyFeatures", [...current, feature]);
    }
  };

  const toggleTexture = (texture: string) => {
    const currentTextures = quizData.textures;
    if (currentTextures.includes(texture)) {
      updateQuizData(
        "textures",
        currentTextures.filter((t) => t !== texture),
      );
    } else if (currentTextures.length < 2) {
      updateQuizData("textures", [...currentTextures, texture]);
    } else {
      toast({
        title: "Maximum Selections",
        description: "You can select up to 2 textures only.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (
    files: File[],
    type: "vibe" | "floorplan",
  ) => {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("folder", type === "vibe" ? "vibe-images" : "floorplans");

    if (type === "vibe") setUploadingVibe(true);
    else setUploadingFloorplan(true);

    try {
      console.log(`Uploading ${files.length} file(s) to /api/upload`);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      console.log("Upload response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("Upload response data:", data);
      const urls = data.urls || [];

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
      <RoomTypeStep
        value={quizData.roomType}
        onChange={(value) => updateQuizData("roomType", value)}
      />
    );
  };

  const renderStep2 = () => {
    const styles = [
      "Organic Modern",
      "Modern Farmhouse",
      "Midcentury Scandi",
      "Contemporary Luxe",
      "Warm Transitional",
    ];

    return (
      <div className="stack-roomy flex flex-col">
        <div className="text-center stack-base flex flex-col items-center">
          <p
            className="text-muted-foreground font-medium"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Everyone has their own sense of style | Learn More About Our Design
            Styles
          </p>
          <h2
            className="font-serif font-medium text-foreground"
            style={{ fontSize: "var(--font-size-3xl)" }}
          >
            Which style feels most like home?
          </h2>
          <p
            className="text-muted-foreground max-w-2xl"
            style={{ fontSize: "var(--font-size-lg)" }}
          >
            Choose up to 2 styles. Trust your instincts — There are no wrong
            answers.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="stack-base flex flex-col"
        >
          {styles.map((styleName) => {
            const styleData =
              STYLES_DATA[styleName as keyof typeof STYLES_DATA];
            const isSelected = quizData.styles.includes(styleName);
            const isExpanded = expandedStyles.includes(styleName);

            return (
              <motion.div key={styleName} variants={itemVariants}>
                <Card
                  className={`p-6 transition-all border-card-border hover-elevate ${
                    isSelected ? "bg-accent/10 border-accent" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-6 h-6 border-2 rounded flex items-center justify-center cursor-pointer transition-all ${
                          isSelected
                            ? "bg-accent border-accent"
                            : "border-border hover:border-accent/50"
                        }`}
                        onClick={() => toggleStyle(styleName)}
                        data-testid={`style-${styleName.toLowerCase().replace(" ", "-")}`}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-accent-foreground" />
                        )}
                      </div>
                      <h3
                        className="font-semibold text-card-foreground uppercase"
                        style={{ fontSize: "var(--font-size-xl)" }}
                      >
                        {styleName}
                      </h3>
                    </div>
                  </div>

                  {/* Renders */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {styleData.renders.map((url, idx) => (
                      <div key={idx} className="stack-tight flex flex-col">
                        <img
                          src={url}
                          alt={`${styleName} render ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-md"
                        />
                        <p
                          className="text-center text-muted-foreground uppercase font-medium"
                          style={{ fontSize: "var(--font-size-xs)" }}
                        >
                          {["Living", "Dining", "Bedroom"][idx]} Render
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Key Characteristics Toggle */}
                  <button
                    onClick={() =>
                      setExpandedStyles((prev) =>
                        prev.includes(styleName)
                          ? prev.filter((s) => s !== styleName)
                          : [...prev, styleName],
                      )
                    }
                    className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
                    data-testid={`key-characteristics-${styleName.toLowerCase().replace(" ", "-")}`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                    <span className="font-semibold">Key Characteristics</span>
                  </button>

                  {/* Expanded Characteristics */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-4 stack-base flex flex-col overflow-hidden"
                      >
                        <div className="stack-tight flex flex-col">
                          <h4 className="font-semibold text-card-foreground">
                            Mood Words
                          </h4>
                          <p
                            className="text-muted-foreground leading-relaxed"
                            style={{ fontSize: "var(--font-size-sm)" }}
                          >
                            {styleData.moodWords}
                          </p>
                        </div>
                        <div className="stack-tight flex flex-col">
                          <h4 className="font-semibold text-card-foreground">
                            Textures
                          </h4>
                          <p
                            className="text-muted-foreground leading-relaxed"
                            style={{ fontSize: "var(--font-size-sm)" }}
                          >
                            {styleData.textures}
                          </p>
                        </div>
                        <div className="stack-tight flex flex-col">
                          <h4 className="font-semibold text-card-foreground">
                            Furniture
                          </h4>
                          <p
                            className="text-muted-foreground leading-relaxed"
                            style={{ fontSize: "var(--font-size-sm)" }}
                          >
                            {styleData.furniture}
                          </p>
                        </div>
                        <div className="stack-tight flex flex-col">
                          <h4 className="font-semibold text-card-foreground mb-2">
                            Color Palette
                          </h4>
                          <img
                            src={colorPalette}
                            alt="Color palette inspiration"
                            className="w-full max-w-md mb-2 rounded-md"
                          />
                          <p
                            className="text-muted-foreground leading-relaxed"
                            style={{ fontSize: "var(--font-size-sm)" }}
                          >
                            {styleData.colorPalette}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    );
  };

  const renderStep3 = () => {
    const palettes = [
      "Warm Neutrals",
      "Earth & Stone",
      "Coastal Calm",
      "Soft Contrast",
      "Monochrome Luxe",
      "Artful Contrast",
      "Heritage Warmth",
      "Dark & Moody",
    ];

    return (
      <div className="stack-roomy flex flex-col">
        <div className="text-center stack-base flex flex-col items-center">
          <p
            className="text-muted-foreground font-medium"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Everyone has their own sense of style | Learn More About Our Design
            Styles
          </p>
          <h2
            className="font-serif font-medium text-foreground"
            style={{ fontSize: "var(--font-size-3xl)" }}
          >
            Which colour palette feels most like you?
          </h2>
          <p
            className="text-muted-foreground max-w-2xl"
            style={{ fontSize: "var(--font-size-lg)" }}
          >
            Choose up to 2 palettes. Trust your instincts — There are no wrong
            answers.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto"
        >
          {palettes.map((palette) => {
            const isSelected = quizData.colorPalettes.includes(palette);

            return (
              <motion.div key={palette} variants={itemVariants}>
                <Card
                  className={`p-6 text-center cursor-pointer transition-all border-card-border hover-elevate active-elevate-2 ${
                    isSelected ? "bg-accent/10 border-accent" : ""
                  }`}
                  onClick={() => toggleColorPalette(palette)}
                  data-testid={`palette-${palette.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <p
                    className="font-semibold uppercase text-card-foreground"
                    style={{ fontSize: "var(--font-size-sm)" }}
                  >
                    {palette}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    );
  };

  // Step 4: Design Preferences (Mode, Textures, Lifestyle, Patterns)
  const renderStep4 = () => {
    const lineStyles = [
      { id: "Clean Lines/Structured", label: "Clean Lines/Structured" },
      { id: "Upscale/Chic", label: "Upscale/Chic" },
      { id: "Elegant/Balanced", label: "Elegant/Balanced" },
      { id: "Calm/Serene", label: "Calm/Serene" },
      { id: "Rustic/Inviting", label: "Rustic/Inviting" },
    ];

    const textures = [
      { id: "Walnut", label: "Walnut" },
      { id: "Velvet, Brass, Smoked Glass", label: "Velvet, Brass, Smoked Glass" },
      { id: "Shiplap, Wrought Iron", label: "Shiplap, Wrought Iron" },
      { id: "White Oak, Linen, Travertine", label: "White Oak, Linen, Travertine" },
      { id: "Satin, Metallics", label: "Satin, Metallics" },
    ];

    const lifestyleCues = [
      { id: "Everyday Elegance/Gracious", label: "Everyday Elegance/Gracious" },
      { id: "Relaxed Sophistication/Minimalist", label: "Relaxed Sophistication/Minimalist" },
      { id: "Nurturing/Refined", label: "Nurturing/Refined" },
      { id: "Family Gatherings/Humble", label: "Family Gatherings/Humble" },
    ];

    const patternPreferences = [
      {
        id: "Just Solids",
        label: "Just Solids",
        description: "You love clean lines, calm energy, and a timeless, uncluttered look. Solids keep your space feeling serene and easy.",
      },
      {
        id: "Patterned Accents",
        label: "Patterned Accents",
        description: "You enjoy a touch of personality and flair without going overboard. A patterned pillow, or rug is just enough.",
      },
      {
        id: "I Love Patterns",
        label: "I Love Patterns — Don't Hold Back",
        description: "Bold, expressive, and adventurous. You see your home as a canvas and aren't afraid of mixing and vibrant energy.",
      },
    ];

    return (
      <div className="stack-roomy flex flex-col">
        <div className="text-center stack-base flex flex-col items-center">
          <p
            className="text-muted-foreground font-medium"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Everyone has their own sense of style | Learn More About Our Design
            Styles
          </p>
          <h2
            className="font-serif font-medium text-foreground"
            style={{ fontSize: "var(--font-size-3xl)" }}
          >
            Define Your Design Preferences
          </h2>
          <p
            className="text-muted-foreground max-w-2xl"
            style={{ fontSize: "var(--font-size-lg)" }}
          >
            Select your preferred mode, textures, lifestyle, and pattern preferences.
          </p>
        </div>

        {/* Mode/Line Style Section */}
        <div className="max-w-4xl mx-auto w-full">
          <h3
            className="font-serif font-medium text-foreground text-center mb-6"
            style={{ fontSize: "var(--font-size-xl)" }}
          >
            Mode
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-5 gap-4"
          >
            {lineStyles.map((style) => {
              const isSelected = quizData.lineStyle === style.id;

              return (
                <motion.div key={style.id} variants={itemVariants}>
                  <Card
                    className={`p-6 text-center cursor-pointer transition-all border-card-border hover-elevate active-elevate-2 ${
                      isSelected ? "bg-accent/10 border-accent" : ""
                    }`}
                    onClick={() => updateQuizData("lineStyle", style.id)}
                    data-testid={`line-style-${style.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <p
                      className="font-semibold text-card-foreground"
                      style={{ fontSize: "var(--font-size-sm)" }}
                    >
                      {style.label}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Textures Section */}
        <div className="mt-12 max-w-5xl mx-auto w-full">
          <h3
            className="font-serif font-medium text-foreground text-center mb-2"
            style={{ fontSize: "var(--font-size-xl)" }}
          >
            Textures
          </h3>
          <p
            className="text-muted-foreground text-center mb-6"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Select up to 2 textures
          </p>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-5 gap-4"
          >
            {textures.map((texture) => {
              const isSelected = quizData.textures.includes(texture.id);

              return (
                <motion.div key={texture.id} variants={itemVariants}>
                  <Card
                    className={`p-6 text-center cursor-pointer transition-all border-card-border hover-elevate active-elevate-2 min-h-24 flex items-center justify-center ${
                      isSelected ? "bg-accent/10 border-accent" : ""
                    }`}
                    onClick={() => toggleTexture(texture.id)}
                    data-testid={`texture-${texture.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <p
                      className="font-semibold text-card-foreground"
                      style={{ fontSize: "var(--font-size-sm)" }}
                    >
                      {texture.label}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Lifestyle Cues Section */}
        <div className="mt-12 max-w-4xl mx-auto w-full">
          <h3
            className="font-serif font-medium text-foreground text-center mb-6"
            style={{ fontSize: "var(--font-size-xl)" }}
          >
            Lifestyle Cues
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {lifestyleCues.map((cue) => {
              const isSelected = quizData.lifestyleCue === cue.id;

              return (
                <motion.div key={cue.id} variants={itemVariants}>
                  <Card
                    className={`p-6 text-center cursor-pointer transition-all border-card-border hover-elevate active-elevate-2 min-h-24 flex items-center justify-center ${
                      isSelected ? "bg-accent/10 border-accent" : ""
                    }`}
                    onClick={() => updateQuizData("lifestyleCue", cue.id)}
                    data-testid={`lifestyle-${cue.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <p
                      className="font-semibold text-card-foreground"
                      style={{ fontSize: "var(--font-size-sm)" }}
                    >
                      {cue.label}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Pattern Preferences Section */}
        <div className="mt-12 max-w-4xl mx-auto w-full">
          <h3
            className="font-serif font-medium text-foreground text-center mb-6"
            style={{ fontSize: "var(--font-size-xl)" }}
          >
            Pattern Preferences
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="stack-base flex flex-col"
          >
            {patternPreferences.map((pattern) => {
              const isSelected = quizData.patternPreference === pattern.id;

              return (
                <motion.div key={pattern.id} variants={itemVariants}>
                  <Card
                    className={`p-6 cursor-pointer transition-all border-card-border hover-elevate active-elevate-2 ${
                      isSelected ? "bg-accent/10 border-accent" : ""
                    }`}
                    onClick={() => updateQuizData("patternPreference", pattern.id)}
                    data-testid={`pattern-${pattern.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? "bg-accent border-accent"
                            : "border-border"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-accent-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-card-foreground mb-1">
                          {pattern.label}
                        </p>
                        <p
                          className="text-muted-foreground"
                          style={{ fontSize: "var(--font-size-sm)" }}
                        >
                          <span className="font-medium">Lifestyle cue:</span>{" "}
                          {pattern.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    );
  };

  // Step 5: Functional Features
  const renderStep5 = () => {
    const features = KEY_FEATURES_BY_ROOM[quizData.roomType] || [];
    const isDiningRoom = quizData.roomType === "Dining Room";
    const seatingCounts = [4, 6, 8, 10, 12];

    return (
      <div className="stack-roomy flex flex-col">
        <div className="text-center stack-base flex flex-col items-center">
          <p
            className="text-muted-foreground font-medium"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Everyone has their own sense of style | Learn More About Our Design
            Styles
          </p>
          <h2
            className="font-serif font-medium text-foreground"
            style={{ fontSize: "var(--font-size-3xl)" }}
          >
            Functional Features
          </h2>
          <p
            className="text-muted-foreground max-w-2xl"
            style={{ fontSize: "var(--font-size-lg)" }}
          >
            A room should look stunning and live smart. Let's design for how you
            live, not just how it looks.
          </p>
          <p
            className="text-muted-foreground font-medium"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Select all that apply
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 max-w-3xl mx-auto"
        >
          {features.map((feature, idx) => {
            const isSelected = quizData.keyFeatures.includes(feature.label);

            return (
              <motion.div key={idx} variants={itemVariants}>
                <Card
                  className={`p-6 cursor-pointer hover-elevate active-elevate-2 transition-all border-card-border ${
                    isSelected ? "bg-accent/10 border-accent" : ""
                  }`}
                  onClick={() => toggleKeyFeature(feature.label)}
                  data-testid={`feature-${feature.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <p className="font-semibold text-card-foreground">
                    {feature.label}
                  </p>
                  {feature.subtitle && (
                    <p
                      className="text-muted-foreground mt-1"
                      style={{ fontSize: "var(--font-size-sm)" }}
                    >
                      {feature.subtitle}
                    </p>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Special Dining Room Seating Selector */}
        {isDiningRoom && (
          <div className="max-w-3xl mx-auto stack-base flex flex-col items-center">
            <p className="text-center font-semibold text-foreground">
              Seating (Please select number of people to be seated)
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {seatingCounts.map((count) => {
                const seatingLabel = `Seating for ${count}`;
                const isSelected = quizData.keyFeatures.includes(seatingLabel);

                return (
                  <Button
                    key={count}
                    variant={isSelected ? "default" : "outline"}
                    size="lg"
                    className="w-16 h-16 font-semibold"
                    style={{ fontSize: "var(--font-size-lg)" }}
                    onClick={() => toggleKeyFeature(seatingLabel)}
                    data-testid={`seating-${count}`}
                  >
                    {count}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Step 6: Budget
  const renderStep6 = () => {
    const budgetRanges = [
      "$2,000-$5,000",
      "$5,000-$8,000",
      "$9,000-$12,000",
      "$13,000-$16,000",
      "$17,000-$20,000",
      "Over $20,000",
    ];

    return (
      <div className="stack-roomy flex flex-col">
        <div className="text-center stack-base flex flex-col items-center">
          <h2
            className="font-serif font-medium text-foreground"
            style={{ fontSize: "var(--font-size-3xl)" }}
          >
            Dream Big, Spend Smart
          </h2>
          <div className="stack-tight flex flex-col items-center">
            <p
              className="font-semibold text-foreground"
              style={{ fontSize: "var(--font-size-xl)" }}
            >
              Set Your Budget
            </p>
            <p
              className="text-muted-foreground max-w-2xl"
              style={{ fontSize: "var(--font-size-lg)" }}
            >
              Choose a budget range that feels comfortable — enough to elevate
              your space without stretching your limits
            </p>
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 max-w-2xl mx-auto"
        >
          {budgetRanges.map((budget) => (
            <motion.div key={budget} variants={itemVariants}>
              <Card
                className={`p-8 text-center cursor-pointer hover-elevate active-elevate-2 transition-all border-card-border ${
                  quizData.budgetRange === budget
                    ? "bg-accent/10 border-accent"
                    : ""
                }`}
                onClick={() => updateQuizData("budgetRange", budget)}
                data-testid={`budget-${budget.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <p
                  className="font-semibold text-card-foreground"
                  style={{ fontSize: "var(--font-size-lg)" }}
                >
                  {budget}
                </p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  };

  // Step 7: Vibe Check
  const renderStep7 = () => {
    return (
      <div className="stack-roomy flex flex-col">
        <div className="text-center stack-base flex flex-col items-center">
          <h2
            className="font-serif font-medium text-foreground"
            style={{ fontSize: "var(--font-size-3xl)" }}
          >
            You Bring the Vibe and We'll Bring the Design
          </h2>
          <div className="stack-tight flex flex-col items-center">
            <p
              className="font-semibold text-foreground"
              style={{ fontSize: "var(--font-size-xl)" }}
            >
              Vibe Check
            </p>
            <p
              className="text-muted-foreground max-w-2xl"
              style={{ fontSize: "var(--font-size-lg)" }}
            >
              Upload photos from Pinterest
              <br />
              Generate your room design based on a Pinterest board or images
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <Dropzone
            onDrop={(files) => handleFileUpload(files, "vibe")}
            accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
            multiple
          >
            {({ getRootProps, getInputProps, isDragActive }) => (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/50 hover:bg-accent/5"
                }`}
                data-testid="vibe-upload-area"
              >
                <input {...getInputProps()} />
                <p
                  className="font-semibold mb-2 text-foreground"
                  style={{ fontSize: "var(--font-size-lg)" }}
                >
                  {uploadingVibe
                    ? "Uploading..."
                    : isDragActive
                      ? "Drop files here"
                      : "Drag and drop or add photos"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  disabled={uploadingVibe}
                  data-testid="button-add-vibe-images"
                >
                  Add Link
                </Button>
              </div>
            )}
          </Dropzone>

          {quizData.vibeImages.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-4">
              {quizData.vibeImages.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={url}
                    alt={`Vibe ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-md"
                  />
                  <button
                    onClick={() =>
                      updateQuizData(
                        "vibeImages",
                        quizData.vibeImages.filter((_, i) => i !== idx),
                      )
                    }
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover-elevate"
                    data-testid={`remove-vibe-${idx}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Step 8: Final Step
  const renderStep8 = () => {
    return (
      <div className="stack-roomy flex flex-col">
        <div className="text-center stack-base flex flex-col items-center">
          <motion.h2
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="font-serif font-medium text-foreground"
            style={{ fontSize: "var(--font-size-3xl)" }}
          >
            You Made It to the Final Step
          </motion.h2>
          <p
            className="text-muted-foreground font-medium"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Uploading a photo is optional
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Photo Upload */}
          <div className="stack-base flex flex-col">
            <h3
              className="font-semibold text-center text-foreground"
              style={{ fontSize: "var(--font-size-lg)" }}
            >
              Upload a photo of your space
            </h3>
            <Dropzone
              onDrop={(files) => handleFileUpload(files, "floorplan")}
              accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
              maxFiles={1}
            >
              {({ getRootProps, getInputProps, isDragActive }) => (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDragActive || quizData.floorplanUrl
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/50"
                  }`}
                  data-testid="photo-upload-area"
                >
                  <input {...getInputProps()} />
                  <p className="font-semibold mb-4 text-foreground">
                    {uploadingFloorplan ? "Uploading..." : "Add Photo"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="button-see-photo-example"
                  >
                    See Example
                  </Button>
                </div>
              )}
            </Dropzone>
          </div>

          {/* Floorplan Upload */}
          <div className="stack-base flex flex-col">
            <h3
              className="font-semibold text-center text-foreground"
              style={{ fontSize: "var(--font-size-lg)" }}
            >
              Upload your floorplan
            </h3>
            <Dropzone
              onDrop={(files) => handleFileUpload(files, "floorplan")}
              accept={{ "image/*": [".png", ".jpg", ".jpeg", ".pdf"] }}
              maxFiles={1}
            >
              {({ getRootProps, getInputProps, isDragActive }) => (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDragActive || quizData.floorplanUrl
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/50"
                  }`}
                  data-testid="floorplan-upload-area"
                >
                  <input {...getInputProps()} />
                  <p className="font-semibold mb-4 text-foreground">
                    {uploadingFloorplan ? "Uploading..." : "Add Plan"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="button-see-plan-example"
                  >
                    See Example
                  </Button>
                </div>
              )}
            </Dropzone>
          </div>
        </div>

        {/* Room Description - Natural Language Input */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="stack-base flex flex-col">
            <h3
              className="font-semibold text-foreground"
              style={{ fontSize: "var(--font-size-lg)" }}
            >
              Describe your space
            </h3>
            <p
              className="text-muted-foreground mb-4"
              style={{ fontSize: "var(--font-size-sm)" }}
            >
              Tell us about your room dimensions, doorway size, and any
              preferences. For example: "My living room is 15 feet by 12 feet
              with 8-foot ceilings. Standard 32-inch doorway. I want a modern
              look with light wood tones."
            </p>
            <textarea
              value={quizData.roomDescription}
              onChange={(e) =>
                updateQuizData("roomDescription", e.target.value)
              }
              placeholder="Example: Living room is 15x12 feet with 8ft ceilings. Doorway is 32 inches wide. I love cozy, warm vibes with natural materials..."
              className="w-full min-h-32 p-4 rounded-lg border-2 border-border bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              style={{ fontSize: "var(--font-size-base)" }}
              data-testid="input-room-description"
            />
          </div>
        </div>
      </div>
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
      case 8:
        return renderStep8();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background section-padding">
      <div className="max-w-6xl mx-auto px-6">
        {/* Progress Indicator - 8 dots */}
        <div
          className="flex items-center justify-center gap-3 mb-10"
          data-testid="quiz-progress"
        >
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i + 1 <= currentStep
                  ? "bg-accent w-8"
                  : "bg-muted-foreground/30 w-2.5"
              }`}
              data-testid={`progress-dot-${i + 1}`}
            />
          ))}
        </div>

        {/* Quiz Content */}
        <div
          className="surface-soft rounded-lg p-8 md:p-12 mb-10"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
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
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between max-w-4xl mx-auto flex-wrap gap-4">
          <Button
            variant="ghost"
            size="lg"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="uppercase font-semibold flex items-center gap-2"
            data-testid="button-back"
          >
            {currentStep > 1 ? (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Previous: {getStepContext(currentStep).previous}
                </span>
                <span className="sm:hidden">Back</span>
              </>
            ) : (
              <span>Back</span>
            )}
          </Button>

          <p
            className="font-semibold text-muted-foreground uppercase order-first sm:order-none w-full sm:w-auto text-center"
            style={{ fontSize: "var(--font-size-sm)" }}
            data-testid="text-step-counter"
          >
            Step {currentStep} of {TOTAL_STEPS}
          </p>

          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed || submitQuizMutation.isPending}
            className="uppercase font-semibold transition-all flex items-center gap-2"
            data-testid="button-next"
          >
            {submitQuizMutation.isPending ? (
              <span>Submitting...</span>
            ) : currentStep === TOTAL_STEPS ? (
              <span>Submit Quiz</span>
            ) : (
              <>
                <span className="hidden sm:inline">
                  Next: {getStepContext(currentStep).next}
                </span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>

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
                setLocation("/loading");
              }}
              className="flex-1"
              data-testid="button-confirm-dimensions"
            >
              Looks Good!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
