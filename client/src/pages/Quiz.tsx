import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Check, ChevronDown, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { getOrCreateSessionId } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import Dropzone from "react-dropzone";

const TOTAL_STEPS = 7;

// Typewriter effect component for Step 6
function TypewriterBullets({ bullets }: { bullets: string[] }) {
  const [displayedBullets, setDisplayedBullets] = useState<string[]>([]);
  const [currentBulletIndex, setCurrentBulletIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");

  useEffect(() => {
    if (currentBulletIndex >= bullets.length) return;

    const bullet = bullets[currentBulletIndex];
    const targetLength = currentText.length + 1;

    if (targetLength <= bullet.length) {
      const timer = setTimeout(() => {
        setCurrentText(bullet.substring(0, targetLength));
      }, 30);
      return () => clearTimeout(timer);
    } else {
      // Current bullet complete, move to next
      const timer = setTimeout(() => {
        setDisplayedBullets(prev => [...prev, bullet]);
        setCurrentText("");
        setCurrentBulletIndex(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentBulletIndex, currentText, bullets]);

  return (
    <div className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
      <p className="font-semibold">For example:</p>
      {displayedBullets.map((bullet, idx) => (
        <motion.p
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {bullet}
        </motion.p>
      ))}
      {currentText && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {currentText}
          <span className="animate-pulse">|</span>
        </motion.p>
      )}
    </div>
  );
}

// Style data with Key Characteristics
const STYLES_DATA = {
  "Midcentury Scandi": {
    moodWords: "Vintage, retro, functional, warm, clean, natural, refined",
    textures: "Woods are a staple like oak and walnut, often paired with leather, durable wools, cotton and matte metals",
    furniture: "Furniture has clean lines, soft curves, and minimalist forms, with natural wood finishes and tapered legs that add timeless warmth and function.",
    colorPalette: "Soft neutrals like off-white, warm beige, and light grey form a timeless base. Accents in sage, teal, mustard, burnt orange, and burgundy add retro warmth and contrast.",
    renders: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1615875474908-f403609c4ccc?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=300&fit=crop"
    ]
  },
  "Organic Modern": {
    moodWords: "Earthy, uncluttered, tranquil, zen-inspired, textural, rounded edges, plush, minimalistic",
    textures: "Breathable linens, soft cotton, cozy bouclé paired with warm oaks, tactile rugs, neutral matte stones, clay & plaster",
    furniture: "Furniture features low-profile, minimalist designs with soft curves and sculpted edges, replacing harsh modern angles.",
    colorPalette: "Whites, bones, chalks & earthy neutrals with small nature-inspired accents of sage, terracotta",
    renders: [
      "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop"
    ]
  },
  "Artful Eclectic": {
    moodWords: "Unexpected, playful, expressive, soulful, layered, creative, vibrant, bold, eclectic",
    textures: "Mixed fabrics of velvet, linen, silk/satin accented with patterned textiles, rugs, natural distressed materials, lacquered surfaces, and glamorous metals/mirrors",
    furniture: "Harmonious yet mismatched pieces with a mix of eras (vintage & modern), styles and global inspired designs",
    colorPalette: "Jewel tones add drama and depth, grounded by neutrals like charcoal, ivory, warm browns, white, & black",
    renders: [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566752229-250ed79470d1?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=400&h=300&fit=crop"
    ]
  },
  "Modern Farmhouse": {
    moodWords: "Rustic, casual, heritage-inspired, cozy, wholesome, vintage charm, worn-in",
    textures: "Distressed and whitewashed woods, matte stones, exposed brick, butcher blocks, knits, boucle, woven wool, cotton and linen",
    furniture: "Oversized armchairs, plush slipcovered sofas that invite relaxation with built-in storage",
    colorPalette: "Foundational neutrals of creamy white and greige, contrasting accents of black metals and nature inspired hues of deep green, pale blue and terracotta",
    renders: [
      "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566753151-384129cf4e3e?w=400&h=300&fit=crop"
    ]
  },
  "Warm Transitional": {
    moodWords: "Timeless blend of traditional and modern, with tailored comfort and understated elegance that's refined, classic, and polished",
    textures: "Polished metals, rich woods, velvet upholstery, chenille, bouclé, silk drapes, and veined marble surfaces",
    furniture: "Combines traditional curves with modern clean lines, subtle nailhead trim, piping and metal knobs",
    colorPalette: "Creamy white, warm greige, charcoal grey, espresso brown, bronze, brushed gold, antique nickel, soft blush, mauve, pewter, sage green, dusty blue, slate blue",
    renders: [
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=400&h=300&fit=crop"
    ]
  },
  "Modern Luxe": {
    moodWords: "Sophisticated, minimal yet rich, polished, glamorous, refined, sleek, chic, upscale, curated",
    textures: "Plush velvet, vegan furs, high performance linen, leather, lacquered surfaces, smooth woods & finishes, polished or honed marbles, quarzite and travertines",
    furniture: "Clean sculptural lines, sleek silhouettes, gentle curves, architectural forms, statement pieces, art-inspired design, polished finishes, high-end materials, luxury accent chairs, curated furniture",
    colorPalette: "Ivory white, bone white, warm taupe, greige, putty beige, charcoal grey, matte black, espresso brown, brushed gold, antique brass, emerald green, sapphire blue, dusty rose, muted mauve",
    renders: [
      "https://images.unsplash.com/photo-1600566753414-2afc9e2f5a28?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600563438938-a9a27216b4f5?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop"
    ]
  }
};

// Key Features by Room Type
const KEY_FEATURES_BY_ROOM: Record<string, Array<{label: string, subtitle?: string}>> = {
  "Living Room": [
    { label: "Storage Solutions", subtitle: "Shelves & cabinetry" },
    { label: "Workspace Area", subtitle: "Integrated desks" },
    { label: "Comfortable Seat", subtitle: "Sectional or deep sofa" },
    { label: "Accent Lighting", subtitle: "Ambient & Task" },
    { label: "Bright & Airy", subtitle: "Light colour palette" },
    { label: "Deep & Moody", subtitle: "Dark hues & contrast" },
    { label: "Pet-Friendly", subtitle: "Durable fabrics" },
    { label: "Child-Friendly", subtitle: "Toy storage, rounded edges" },
    { label: "Media Area", subtitle: "Entertainment unit" },
    { label: "Multi-Function", subtitle: "Sofa Bed or ottoman" }
  ],
  "Bedroom": [
    { label: "Storage Solutions", subtitle: "Clothing & Linens" },
    { label: "Workspace Area", subtitle: "Built-in desk" },
    { label: "Comfortable Seat", subtitle: "Reading Chair" },
    { label: "Pet-Friendly", subtitle: "Durable fabrics" },
    { label: "Bright & Airy", subtitle: "Light colour palette" },
    { label: "Deep & Moody", subtitle: "Dark colour palette" },
    { label: "Kid's Bedroom", subtitle: "Toy storage, rounded edges" },
    { label: "Media Area", subtitle: "TV Cabinet" },
    { label: "Twin/Single Bed", subtitle: "38\" wide x 75\" long" },
    { label: "Double Bed", subtitle: "54\" wide x 75\" long" },
    { label: "Queen Bed", subtitle: "60\" wide x 75\" long" },
    { label: "King Bed", subtitle: "76\" wide x 80\" long" }
  ],
  "Dining Room": [
    { label: "Casual Setting", subtitle: "Relaxed & Everyday" },
    { label: "Formal Setting", subtitle: "Elevated & Polished" },
    { label: "Upholstered", subtitle: "Comfortable Chairs" },
    { label: "Storage Solutions", subtitle: "Buffet & Sideboard" },
    { label: "Bright & Airy", subtitle: "Light colour palette" },
    { label: "Deep & Moody", subtitle: "Dark colour palette" },
    { label: "Seating for 4" },
    { label: "Seating for 6" },
    { label: "Seating for 8" },
    { label: "Seating for 10" },
    { label: "Seating for 12" }
  ],
  "Home Office": [
    { label: "Concealed Storage", subtitle: "Keep clutter out" },
    { label: "Bookcase Storage", subtitle: "Open Shelves" },
    { label: "Reading Chair", subtitle: "Comfortable Seat" },
    { label: "Decorative Chair", subtitle: "Stylish & Statement" },
    { label: "Bright & Airy", subtitle: "Light colour palette" },
    { label: "Deep & Moody", subtitle: "Dark colour palette" },
    { label: "Filing Storage", subtitle: "Documents & Files" },
    { label: "Multi-Function", subtitle: "Sofa Bed" },
    { label: "Large Desk", subtitle: "52\" to 62\"" },
    { label: "Small Desk", subtitle: "32\" to 48\"" }
  ],
  "Nursery": [
    { label: "Crib Area", subtitle: "Safe Sleep Zone" },
    { label: "Nursing Area", subtitle: "Comfy Chair/Glider" },
    { label: "Changing Station", subtitle: "Storage Table" },
    { label: "Toy Storage", subtitle: "Baskets or Bins" },
    { label: "Book Storage", subtitle: "Open Shelving" },
    { label: "Soft & Cozy", subtitle: "Comfortable Palette" },
    { label: "Play Area", subtitle: "Open Soft Flooring" },
    { label: "Growth-Ready", subtitle: "Convertible Furniture" }
  ],
  "Entry": [
    { label: "Shoe Storage", subtitle: "Daily drop zone" },
    { label: "Coat Hooks", subtitle: "Wall Mounted" },
    { label: "Coat Storage", subtitle: "Hallway closet" },
    { label: "Console Table", subtitle: "Landing pad for keys" },
    { label: "Mirror Moment", subtitle: "See beautiful you" },
    { label: "Artwork", subtitle: "Sets the style/tone" },
    { label: "Bench or Stool", subtitle: "Seating for shoes" },
    { label: "Accent Lighting", subtitle: "Statement Lamp" }
  ]
};

export default function Quiz() {
  const [currentStep, setCurrentStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Quiz data state
  const [quizData, setQuizData] = useState({
    roomType: "",
    styles: [] as string[],
    keyFeatures: [] as string[],
    budgetRange: "",
    vibeImages: [] as string[],
    preferences: "",
    floorplanUrl: "",
  });

  // UI state
  const [expandedStyles, setExpandedStyles] = useState<string[]>([]);
  const [uploadingVibe, setUploadingVibe] = useState(false);
  const [uploadingFloorplan, setUploadingFloorplan] = useState(false);

  const submitQuizMutation = useMutation({
    mutationFn: async (data: typeof quizData) => {
      const sessionId = getOrCreateSessionId();
      
      // Transform styles array to single string (first selection)
      const submitData = {
        ...data,
        style: data.styles[0] || "",
        sessionId
      };

      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }
      
      return response.json();
    },
    onSuccess: () => {
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

  const toggleStyle = (style: string) => {
    const currentStyles = quizData.styles;
    if (currentStyles.includes(style)) {
      updateQuizData("styles", currentStyles.filter(s => s !== style));
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

  const toggleKeyFeature = (feature: string) => {
    const current = quizData.keyFeatures;
    if (current.includes(feature)) {
      updateQuizData("keyFeatures", current.filter(f => f !== feature));
    } else {
      updateQuizData("keyFeatures", [...current, feature]);
    }
  };

  const handleFileUpload = async (files: File[], type: "vibe" | "floorplan") => {
    if (files.length === 0) return;
    
    const formData = new FormData();
    files.forEach(file => formData.append("files", file));

    if (type === "vibe") setUploadingVibe(true);
    else setUploadingFloorplan(true);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      
      const data = await response.json();
      const urls = data.urls || [];

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
      toast({
        title: "Upload Error",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (type === "vibe") setUploadingVibe(false);
      else setUploadingFloorplan(false);
    }
  };

  const canContinue = () => {
    switch (currentStep) {
      case 1: return !!quizData.roomType;
      case 2: return quizData.styles.length > 0;
      case 3: return quizData.keyFeatures.length > 0;
      case 4: return !!quizData.budgetRange;
      case 5: return quizData.vibeImages.length > 0;
      case 6: return quizData.preferences.trim().length > 0;
      case 7: return true; // Optional
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    } else {
      submitQuizMutation.mutate(quizData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Cascade animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  const renderStep1 = () => {
    const rooms = ["Living Room", "Bedroom", "Dining Room", "Home Office", "Nursery", "Entry"];
    
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight">
            Let's Transform Your Unique Style Into Space You Truly Love
          </h2>
          <p className="text-xl font-semibold">Choose Your Room to Begin Your Design Journey</p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 md:gap-6 max-w-3xl mx-auto mt-12"
        >
          {rooms.map((room) => (
            <motion.div key={room} variants={itemVariants}>
              <Card
                className={`p-8 text-center cursor-pointer transition-all hover-elevate ${
                  quizData.roomType === room ? "bg-green-100 dark:bg-green-900/30 border-green-400" : ""
                }`}
                onClick={() => updateQuizData("roomType", room)}
                data-testid={`room-${room.toLowerCase().replace(" ", "-")}`}
              >
                <p className="font-semibold text-lg">{room}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <p className="text-center text-stone-600 dark:text-stone-400 mt-8">
          Start with the space that matters most
        </p>
      </div>
    );
  };

  const renderStep2 = () => {
    const styles = Object.keys(STYLES_DATA);

    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight">
            Everyone Has Their Own Sense of Style - There's No One-Size-Fits All
          </h2>
          <p className="text-lg">
            Select the design style that feels most like you<br />
            <span className="text-stone-600 dark:text-stone-400">Decisions are hard. Check up to 2 boxes.</span>
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {styles.map((styleName) => {
            const styleData = STYLES_DATA[styleName as keyof typeof STYLES_DATA];
            const isSelected = quizData.styles.includes(styleName);
            const isExpanded = expandedStyles.includes(styleName);

            return (
              <motion.div key={styleName} variants={itemVariants}>
                <Card
                  className={`p-6 transition-all ${
                    isSelected ? "bg-green-100 dark:bg-green-900/30 border-green-400" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-6 h-6 border-2 rounded flex items-center justify-center cursor-pointer ${
                          isSelected ? "bg-green-400 border-green-400" : "border-stone-300"
                        }`}
                        onClick={() => toggleStyle(styleName)}
                        data-testid={`style-${styleName.toLowerCase().replace(" ", "-")}`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <h3 className="text-xl font-bold uppercase">{styleName}</h3>
                    </div>
                  </div>

                  {/* Renders */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {styleData.renders.map((url, idx) => (
                      <div key={idx} className="space-y-1">
                        <img
                          src={url}
                          alt={`${styleName} render ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-md"
                        />
                        <p className="text-xs text-center text-stone-600 dark:text-stone-400 uppercase">
                          {["Living", "Dining", "Bedroom"][idx]} Render
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Key Characteristics Toggle */}
                  <button
                    onClick={() =>
                      setExpandedStyles(prev =>
                        prev.includes(styleName)
                          ? prev.filter(s => s !== styleName)
                          : [...prev, styleName]
                      )
                    }
                    className="flex items-center gap-2 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"
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
                        className="mt-4 space-y-4 overflow-hidden"
                      >
                        <div>
                          <h4 className="font-semibold mb-1">Mood Words</h4>
                          <p className="text-sm text-stone-600 dark:text-stone-400">{styleData.moodWords}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">Textures</h4>
                          <p className="text-sm text-stone-600 dark:text-stone-400">{styleData.textures}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">Furniture</h4>
                          <p className="text-sm text-stone-600 dark:text-stone-400">{styleData.furniture}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">Color Palette</h4>
                          <p className="text-sm text-stone-600 dark:text-stone-400">{styleData.colorPalette}</p>
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
    const features = KEY_FEATURES_BY_ROOM[quizData.roomType] || [];

    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold uppercase">Almost There - Your Dream Space is Loading</h2>
          <div className="space-y-2">
            <p className="text-xl font-semibold">Key Features</p>
            <p className="text-lg">
              Let's create a {quizData.roomType.toLowerCase()} that works for your lifestyle — not just your layout
            </p>
            <p className="text-stone-600 dark:text-stone-400">Select all that apply</p>
          </div>
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
                  className={`p-6 cursor-pointer hover-elevate transition-all ${
                    isSelected ? "bg-green-100 dark:bg-green-900/30 border-green-400" : ""
                  }`}
                  onClick={() => toggleKeyFeature(feature.label)}
                  data-testid={`feature-${feature.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <p className="font-semibold">{feature.label}</p>
                  {feature.subtitle && (
                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{feature.subtitle}</p>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    );
  };

  const renderStep4 = () => {
    const budgetRanges = [
      "$2,000-$5,000",
      "$5,000-$8,000",
      "$9,000-$12,000",
      "$13,000-$16,000",
      "$17,000-$20,000",
      "Over $20,000"
    ];

    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold uppercase">Dream Big, Spend Smart</h2>
          <div className="space-y-2">
            <p className="text-xl font-semibold">Set Your Budget</p>
            <p className="text-lg text-stone-600 dark:text-stone-400">
              Choose a budget range that feels comfortable — enough to elevate your space without stretching your limits
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
                className={`p-8 text-center cursor-pointer hover-elevate transition-all ${
                  quizData.budgetRange === budget ? "bg-green-100 dark:bg-green-900/30 border-green-400" : ""
                }`}
                onClick={() => updateQuizData("budgetRange", budget)}
                data-testid={`budget-${budget.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <p className="font-semibold text-lg">{budget}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  };

  const renderStep5 = () => {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold uppercase">You Bring the Vibe and We'll Bring the Design</h2>
          <div className="space-y-2">
            <p className="text-xl font-semibold">Vibe Check</p>
            <p className="text-lg text-stone-600 dark:text-stone-400">
              Upload photos from Pinterest<br />
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
                  isDragActive ? "border-green-400 bg-green-50 dark:bg-green-900/20" : "border-stone-300 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                }`}
                data-testid="vibe-upload-area"
              >
                <input {...getInputProps()} />
                <p className="text-lg font-semibold mb-2">
                  {uploadingVibe ? "Uploading..." : isDragActive ? "Drop files here" : "Drag and drop or add photos"}
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
                  <img src={url} alt={`Vibe ${idx + 1}`} className="w-full h-32 object-cover rounded-md" />
                  <button
                    onClick={() => updateQuizData("vibeImages", quizData.vibeImages.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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

  const renderStep6 = () => {
    const exampleBullets = [
      "• I am looking for an area to put my dog bed",
      "• I would like a tranquil bed design with calming colours",
      "• I want to create an area to read my books"
    ];

    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold uppercase">Your New Space is Nearly Ready</h2>
          <div className="space-y-2">
            <p className="text-xl font-semibold">Design Preferences?</p>
            <p className="text-lg">We got you</p>
            <p className="text-stone-600 dark:text-stone-400">
              Share what matters most in your space.<br />
              We'll make sure it shows up in your design.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          <TypewriterBullets bullets={exampleBullets} />

          <Textarea
            value={quizData.preferences}
            onChange={(e) => updateQuizData("preferences", e.target.value)}
            placeholder="Type your design preferences here..."
            className="min-h-[200px] text-base"
            data-testid="input-preferences"
          />
        </div>
      </div>
    );
  };

  const renderStep7 = () => {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <motion.h2
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-3xl md:text-4xl font-bold uppercase"
          >
            You Made It to the Final Step
          </motion.h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">Uploading a photo is optional</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Photo Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Upload a photo of your space</h3>
            <Dropzone
              onDrop={(files) => handleFileUpload(files, "vibe")}
              accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
              maxFiles={1}
            >
              {({ getRootProps, getInputProps, isDragActive }) => (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDragActive || quizData.vibeImages.length > 0
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                      : "border-stone-300 hover:border-green-400"
                  }`}
                  data-testid="photo-upload-area"
                >
                  <input {...getInputProps()} />
                  <p className="font-semibold mb-4">{uploadingVibe ? "Uploading..." : "Add Photo"}</p>
                  <Button type="button" variant="link" size="sm" data-testid="button-see-photo-example">
                    See Example
                  </Button>
                </div>
              )}
            </Dropzone>
          </div>

          {/* Floorplan Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Upload your floorplan</h3>
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
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                      : "border-stone-300 hover:border-green-400"
                  }`}
                  data-testid="floorplan-upload-area"
                >
                  <input {...getInputProps()} />
                  <p className="font-semibold mb-4">{uploadingFloorplan ? "Uploading..." : "Add Plan"}</p>
                  <Button type="button" variant="link" size="sm" data-testid="button-see-plan-example">
                    See Example
                  </Button>
                </div>
              )}
            </Dropzone>
          </div>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950 py-8 md:py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Progress Indicator - 7 dots */}
        <div className="flex items-center justify-center gap-2 mb-8" data-testid="quiz-progress">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                i + 1 <= currentStep ? "bg-green-400" : "bg-stone-200 dark:bg-stone-700"
              }`}
              data-testid={`progress-dot-${i + 1}`}
            />
          ))}
        </div>

        {/* Quiz Content */}
        <div className="bg-stone-50 dark:bg-stone-900 rounded-lg p-8 md:p-12 mb-8">
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
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="lg"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="uppercase font-semibold"
            data-testid="button-back"
          >
            Back
          </Button>

          <p className="text-sm font-semibold text-stone-600 dark:text-stone-400 uppercase" data-testid="text-step-counter">
            Step {currentStep} of {TOTAL_STEPS}
          </p>

          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canContinue() || submitQuizMutation.isPending}
            className="bg-stone-200 hover:bg-teal-500 hover:text-white text-stone-700 uppercase font-semibold transition-all"
            data-testid="button-next"
          >
            {currentStep === TOTAL_STEPS ? (
              submitQuizMutation.isPending ? "Submitting..." : "Next"
            ) : (
              "Next"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
