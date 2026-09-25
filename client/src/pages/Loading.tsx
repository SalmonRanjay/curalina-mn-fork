import { useEffect, useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { getSessionId } from "@/lib/session";
import type { Render } from "@shared/schema";
import "@/components/quiz/consultation.css";
// Cropped from docs/consultation-1/pages/page-14.jpg (the client's mockup artwork).
import chairImg from "@/assets/synth-chair-wireframe.jpg";

const CHECKLIST = [
  "Calibrating stylistic alignment",
  "Optimizing procurement parameters",
  "Curating Furniture & Finishes",
  "Finalizing room design",
];

// Cosmetic pacing only: items 1-3 tick off on a slow timer while we wait. The
// last item is NEVER ticked by the timer; it only completes when the real
// render status resolves to "completed".
const PACING_MS = [5000, 12000, 21000];

export default function Loading() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [pacedDone, setPacedDone] = useState(0); // 0..3, timer-driven, cosmetic

  const { renderId, sessionId } = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return {
      renderId: params.get("renderId"),
      sessionId: params.get("sessionId") || getSessionId(),
    };
  }, [searchString]);

  // The polling query remains as a fallback and for the final result
  const { data: render } = useQuery<Render>({
    queryKey: renderId ? ["/api/render", renderId] : ["/api/render/latest", sessionId],
    queryFn: async () => {
      const url = renderId
        ? `/api/render/${renderId}`
        : `/api/render/latest?sessionId=${sessionId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch render status");
      return res.json();
    },
    enabled: !!(renderId || sessionId),
    refetchInterval: 2000,
  });

  useEffect(() => {
    const timers = PACING_MS.map((ms, i) => setTimeout(() => setPacedDone((p) => Math.max(p, i + 1)), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const resolved =
    !!render &&
    (render.status === "completed" || render.status === "failed" || render.status === "needs_input");
  const completed = render?.status === "completed";

  useEffect(() => {
    if (!render || !resolved) return;
    // Let the glow settle after a real completion; failures/needs_input leave immediately.
    const delay = completed ? 2200 : 300;
    const t = setTimeout(() => {
      const { id: actualRenderId, sessionId: actualSessionId } = render;
      setLocation(`/results?renderId=${actualRenderId}&sessionId=${actualSessionId}`);
    }, delay);
    return () => clearTimeout(t);
  }, [render, resolved, completed, setLocation]);

  // Real status can only finish the checklist when the render actually completed.
  const doneCount = completed ? CHECKLIST.length : Math.min(pacedDone, CHECKLIST.length - 1);
  const slow = { duration: 1.6, ease: [0.33, 1, 0.68, 1] as [number, number, number, number] };

  return (
    <div className="cc-loading flex flex-col items-center text-center px-6 py-20 md:py-28" data-testid="loading-screen">
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={slow}
        className="text-4xl md:text-6xl"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        data-testid="heading-loading"
      >
        Synthesizing Your Curation
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...slow, delay: 0.4 }}
        className="mt-8 max-w-xl text-lg md:text-xl font-light text-white/90"
      >
        Synchronizing your spatial data and investment parameters with our design logic to realize your vision.
      </motion.p>

      <ul className="mt-16 space-y-5 text-left" aria-label="Progress" data-testid="loading-checklist">
        {CHECKLIST.map((label, i) => {
          const done = i < doneCount;
          const active = i === doneCount;
          return (
            <li key={label} className="flex items-center gap-5 text-lg md:text-xl" data-done={done}>
              <span className="cc-check" data-done={done} data-active={active}>
                {done ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </span>
              <span className="transition-opacity duration-[1600ms]" style={{ opacity: done || active ? 1 : 0.55 }}>{label}</span>
            </li>
          );
        })}
      </ul>

      <motion.img
        src={chairImg}
        alt=""
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2.4, delay: 0.3 }}
        className="cc-chair mt-14 w-64 md:w-80"
        style={{ filter: completed ? "drop-shadow(0 0 28px rgba(201,162,39,0.55))" : undefined, transition: "filter 2s ease" }}
        data-testid="loading-chair"
      />
    </div>
  );
}
