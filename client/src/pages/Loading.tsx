import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getSessionId } from "@/lib/session";
import type { Render } from "@shared/schema";

const facts = [
  "Natural light can increase productivity by up to 20%",
  "The average person spends 90% of their time indoors",
  "Plants in your space can improve air quality by up to 25%",
  "Color psychology shows blue tones promote calmness and focus",
  "Open floor plans increase natural light by 40% on average",
];

export default function Loading() {
  const [, setLocation] = useLocation();
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const sessionId = getSessionId();

  // Poll for render completion
  const { data: render } = useQuery<Render>({
    queryKey: ["/api/render/latest", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/render/latest?sessionId=${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch render");
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Rotate facts every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % facts.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Redirect to results immediately when render is complete or failed
  useEffect(() => {
    if (render && (render.status === 'completed' || render.status === 'failed')) {
      setLocation("/results");
    }
  }, [render, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-8" data-testid="heading-loading">
          Creating your dream space...
        </h1>

        {/* Bouncing dots animation */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-4 h-4 bg-green-400 rounded-full"
              animate={{
                y: [0, -20, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              data-testid={`loading-dot-${i}`}
            />
          ))}
        </div>

        {/* Rotating facts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-stone-900 p-8 rounded-lg shadow-lg"
        >
          <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">
            DID YOU KNOW?
          </p>
          <motion.p
            key={currentFactIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="text-lg text-stone-700 dark:text-stone-300"
            data-testid="text-fact"
          >
            {facts[currentFactIndex]}
          </motion.p>
        </motion.div>

        <p className="mt-8 text-sm text-stone-500 dark:text-stone-400">
          Our AI is analyzing your preferences and generating personalized designs
        </p>
      </div>
    </div>
  );
}
