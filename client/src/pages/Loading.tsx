import { useEffect, useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getSessionId } from "@/lib/session";
import { Sparkles, Home, Palette, Lightbulb, Sofa, Leaf } from "lucide-react";
import type { Render } from "@shared/schema";

const designFacts = [
  {
    icon: Lightbulb,
    fact: "Natural light can increase productivity by up to 20%",
    category: "Light & Space"
  },
  {
    icon: Home,
    fact: "The average person spends 90% of their time indoors",
    category: "Home Life"
  },
  {
    icon: Leaf,
    fact: "Plants in your space can improve air quality by up to 25%",
    category: "Biophilic Design"
  },
  {
    icon: Palette,
    fact: "Color psychology shows blue tones promote calmness and focus",
    category: "Color Theory"
  },
  {
    icon: Sofa,
    fact: "Well-designed spaces can reduce stress levels by 30%",
    category: "Wellness"
  },
  {
    icon: Home,
    fact: "Open floor plans increase natural light by 40% on average",
    category: "Layout Design"
  },
];

export default function Loading() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  // Get render info from URL params (preferred) or fall back to localStorage session
  const { renderId, sessionId } = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return {
      renderId: params.get("renderId"),
      sessionId: params.get("sessionId") || getSessionId(),
    };
  }, [searchString]);

  // If we have a specific render ID, fetch that directly; otherwise fall back to latest by session
  const { data: render } = useQuery<Render>({
    queryKey: renderId ? ["/api/render", renderId] : ["/api/render/latest", sessionId],
    queryFn: async () => {
      if (renderId) {
        const res = await fetch(`/api/render/${renderId}`);
        if (!res.ok) throw new Error("Failed to fetch render");
        return res.json();
      } else {
        const res = await fetch(`/api/render/latest?sessionId=${sessionId}`);
        if (!res.ok) throw new Error("Failed to fetch render");
        return res.json();
      }
    },
    enabled: !!(renderId || sessionId),
    refetchInterval: 2000,
  });

  useEffect(() => {
    const factInterval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % designFacts.length);
    }, 4000);

    return () => clearInterval(factInterval);
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8;
      });
    }, 500);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    if (render && (render.status === 'completed' || render.status === 'failed')) {
      setProgress(100);
      setTimeout(() => {
        // Pass render ID to results page to ensure correct render is displayed
        const actualRenderId = render.id;
        const actualSessionId = render.sessionId;
        setLocation(`/results?renderId=${actualRenderId}&sessionId=${actualSessionId}`);
      }, 300);
    }
  }, [render, setLocation]);

  const currentFact = designFacts[currentFactIndex];
  const FactIcon = currentFact.icon;

  return (
    <div className="loading-container">
      <div className="max-w-2xl w-full text-center space-y-12">
        {/* Main Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
          </div>
          
          <h1 
            className="font-serif font-medium text-foreground"
            style={{ fontSize: 'var(--font-size-3xl)', lineHeight: 'var(--line-tight)' }}
            data-testid="heading-loading"
          >
            Creating your dream space...
          </h1>
          
          <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-lg)' }}>
            Our AI is analyzing your preferences and generating personalized designs
          </p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {progress < 30 ? "Analyzing preferences..." : 
             progress < 60 ? "Selecting products..." : 
             progress < 90 ? "Generating room design..." : 
             "Finalizing your design..."}
          </p>
        </motion.div>

        {/* Animated Dots */}
        <div className="loading-dots justify-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="loading-dot"
              animate={{
                y: [0, -12, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
              data-testid={`loading-dot-${i}`}
            />
          ))}
        </div>

        {/* Design Fact Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFactIndex}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
            className="loading-fact-card mx-auto"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <FactIcon className="w-5 h-5 text-primary" />
              <span className="loading-fact-label">
                {currentFact.category}
              </span>
            </div>
            <p 
              className="loading-fact-text"
              data-testid="text-fact"
            >
              {currentFact.fact}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary/10"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 30}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
