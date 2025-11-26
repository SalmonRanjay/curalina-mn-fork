import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { AuthenticatedQuizButton } from "@/components/AuthenticatedQuizButton";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

import organicModern from "@assets/stock_images/organic_modern_bedro_d4118219.jpg";
import modernFarmhouse from "@assets/stock_images/modern_farmhouse_din_1ee52001.jpg";
import midcenturyScandi from "@assets/stock_images/midcentury_scandinav_77cf4d78.jpg";
import contemporaryLuxe from "@assets/stock_images/contemporary_luxe_be_e74c2402.jpg";
import warmTransitional from "@assets/stock_images/warm_transitional_li_b3bb947d.jpg";

const heroStyles = [
  {
    id: "Organic Modern",
    name: "Organic Modern",
    tagline: "Soft, calm, natural",
    description: "Warm textures meet clean lines",
    image: organicModern,
  },
  {
    id: "Modern Farmhouse",
    name: "Modern Farmhouse",
    tagline: "Rustic, cozy, vintage charm",
    description: "Country warmth, modern comfort",
    image: modernFarmhouse,
  },
  {
    id: "Midcentury Scandi",
    name: "Midcentury Scandi",
    tagline: "Vintage, retro, functional",
    description: "Timeless design, effortless style",
    image: midcenturyScandi,
  },
  {
    id: "Contemporary Luxe",
    name: "Contemporary Luxe",
    tagline: "Sleek, sophisticated, elegant",
    description: "Bold statements, refined taste",
    image: contemporaryLuxe,
  },
  {
    id: "Warm Transitional",
    name: "Warm Transitional",
    tagline: "Comfortable, timeless, refined",
    description: "Classic meets contemporary",
    image: warmTransitional,
  },
];

export default function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [direction, setDirection] = useState(1);
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const currentStyle = heroStyles[currentIndex];

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % heroStyles.length);
  }, []);

  const goToPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + heroStyles.length) % heroStyles.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, goToNext]);

  const handleStyleClick = () => {
    const quizUrl = `/quiz?style=${encodeURIComponent(currentStyle.id)}`;
    if (isAuthenticated) {
      setLocation(quizUrl);
    } else {
      setLocation(`/register?redirectTo=${encodeURIComponent(quizUrl)}`);
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 1.05,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <section className="bg-background section-padding md:py-20 lg:py-24" data-testid="section-hero">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="stack-roomy flex flex-col" data-testid="hero-content">
            {/* Pill Label */}
            <div className="inline-block mb-1">
              <Badge variant="secondary" className="px-4 py-2 font-semibold uppercase tracking-wider bg-accent/15 text-foreground border border-accent/30" style={{ fontSize: 'var(--font-size-xs)' }}>
                <Sparkles className="w-3 h-3 mr-1.5 inline" />
                Interior Design, Made Personal
              </Badge>
            </div>

            {/* H1 Headline */}
            <h1 className="font-serif font-medium text-foreground leading-[1.1]" 
                style={{ fontSize: 'var(--font-size-display)' }}
                data-testid="heading-hero">
              Design the space where you'll feel most at home
            </h1>

            {/* Subtext */}
            <p className="text-muted-foreground max-w-xl leading-relaxed" 
               style={{ fontSize: 'var(--font-size-lg)' }}
               data-testid="text-hero-subtext">
              Discover your signature style in just 7 questions — then get a shoppable design tailored to your room, budget, and lifestyle.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <AuthenticatedQuizButton 
                className="font-semibold min-h-12 px-8"
                data-testid="button-take-quiz-hero"
              />
              <Button 
                asChild
                variant="outline"
                size="lg"
                className="font-semibold min-h-12 px-8"
              >
                <a href="#styles" data-testid="button-browse-styles-hero">
                  Browse Design Styles
                </a>
              </Button>
            </div>

            {/* Helper Text */}
            <p className="text-muted-foreground italic" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="text-helper">
              Takes about 3 minutes. No wrong answers.
            </p>
          </div>

          {/* Right Column - Hero Image Slider with Floating Card */}
          <div className="relative" data-testid="hero-visual">
            <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-xl)' }}>
              {/* Image Slider */}
              <div className="relative w-full h-[400px] md:h-[550px] lg:h-[600px] overflow-hidden">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.img
                    key={currentIndex}
                    src={currentStyle.image}
                    alt={currentStyle.name}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.3 },
                      scale: { duration: 0.4 },
                    }}
                    className="absolute inset-0 w-full h-full object-cover"
                    data-testid="img-hero"
                  />
                </AnimatePresence>
              </div>
              
              {/* Dark gradient overlay for better contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent pointer-events-none" />
              
              {/* Navigation Arrows */}
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 shadow-lg z-10"
                data-testid="button-prev-slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 shadow-lg z-10"
                data-testid="button-next-slide"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>

              {/* Slide Indicators */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
                <div className="flex gap-2 bg-background/70 backdrop-blur-sm rounded-full px-3 py-2">
                  {heroStyles.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentIndex 
                          ? "bg-accent w-6" 
                          : "bg-foreground/40 hover:bg-foreground/60"
                      }`}
                      data-testid={`button-slide-indicator-${index}`}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="bg-background/70 backdrop-blur-sm hover:bg-background/90 w-8 h-8"
                  data-testid="button-toggle-autoplay"
                >
                  {isAutoPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </Button>
              </div>
              
              {/* Floating Style Card - Updates with current style */}
              <Card 
                className="absolute bottom-6 left-6 right-6 md:right-auto md:w-80 surface-elevated backdrop-blur-md p-5 border-card-border hover-elevate cursor-pointer group" 
                onClick={handleStyleClick}
                data-testid="card-floating-preview"
              >
                <div className="flex gap-4">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={currentIndex}
                      src={currentStyle.image}
                      alt={currentStyle.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="w-20 h-20 object-cover rounded-md flex-shrink-0 ring-2 ring-accent/20"
                      data-testid="img-preview-thumbnail"
                    />
                  </AnimatePresence>
                  <div className="flex-1 min-w-0">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="font-semibold text-card-foreground mb-0.5 truncate" 
                           style={{ fontSize: 'var(--font-size-base)' }}
                           data-testid="text-preview-title">
                          {currentStyle.name}
                        </p>
                        <p className="text-muted-foreground mb-1.5" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="text-preview-subtitle">
                          {currentStyle.tagline}
                        </p>
                        <span 
                          className="text-accent group-hover:underline font-medium inline-flex items-center gap-1 transition-all"
                          style={{ fontSize: 'var(--font-size-sm)' }}
                          data-testid="link-try-style"
                        >
                          Try this style 
                          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                
                {/* Progress bar for auto-play */}
                {isAutoPlaying && (
                  <motion.div 
                    className="absolute bottom-0 left-0 h-0.5 bg-accent rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    key={currentIndex}
                  />
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
