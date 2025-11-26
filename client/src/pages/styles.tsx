import Navigation from "@/components/Navigation";
import { motion } from "framer-motion";
import { Palette } from "lucide-react";

export default function Styles() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="h-28"></div>

      <div className="max-w-4xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-8">
            <Palette className="w-10 h-10 text-muted-foreground" />
          </div>
          
          <p
            className="uppercase tracking-[0.3em] text-muted-foreground mb-6"
            style={{ fontSize: "11px" }}
            data-testid="text-maintenance-label-styles"
          >
            Coming Soon
          </p>
          
          <h1
            className="font-serif text-foreground mb-6"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 400 }}
            data-testid="heading-styles"
          >
            Explore Our Curated Styles
          </h1>
          
          <p
            className="text-muted-foreground max-w-xl mx-auto leading-relaxed mb-12"
            style={{ fontSize: "var(--font-size-base)" }}
            data-testid="text-maintenance-description-styles"
          >
            We're refining our style guide to bring you an even more inspiring collection. 
            Check back soon to discover the design aesthetics that will transform your space.
          </p>

          <div className="inline-block border-t border-border pt-8">
            <p 
              className="text-muted-foreground italic" 
              style={{ fontSize: "var(--font-size-sm)" }}
              data-testid="text-maintenance-cta-styles"
            >
              In the meantime, take our style quiz to discover your perfect aesthetic
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
