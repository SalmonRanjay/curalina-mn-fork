import GlobalLayout from "@/components/GlobalLayout";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <GlobalLayout>
      <div className="max-w-4xl mx-auto px-6 md:px-12 lg:px-16 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-8">
            <Sparkles className="w-10 h-10 text-accent" />
          </div>
          
          <p
            className="uppercase tracking-[0.3em] text-muted-foreground mb-6 font-inter"
            style={{ fontSize: "var(--font-size-xs)" }}
            data-testid="text-maintenance-label-about"
          >
            Coming Soon
          </p>
          
          <h1
            className="font-cormorant text-foreground mb-6"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 500 }}
            data-testid="heading-about"
          >
            How We Work
          </h1>
          
          <p
            className="text-muted-foreground max-w-xl mx-auto leading-relaxed mb-12 font-inter"
            style={{ fontSize: "var(--font-size-base)" }}
            data-testid="text-maintenance-description-about"
          >
            We're crafting the perfect story to share how Curalina AI transforms 
            your design dreams into reality. Our process page is coming soon.
          </p>

          <div className="inline-block border-t border-border pt-8">
            <p 
              className="text-muted-foreground italic mb-6 font-inter" 
              style={{ fontSize: "var(--font-size-sm)" }}
              data-testid="text-maintenance-cta-about"
            >
              Experience the magic firsthand by taking our design quiz
            </p>
            <Link href="/quiz">
              <Button data-testid="button-start-quiz-about">
                Start Your Design Journey
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </GlobalLayout>
  );
}
