import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Check, Play } from "lucide-react";
import Navigation from "@/components/Navigation";
import howItWorks1 from "@assets/How it works 1_1762329639081.png";
import howItWorks2 from "@assets/How it works2_1762329639082.png";
import howItWorks3 from "@assets/How it works 3_1762329639082.png";
import checkmarkIcon from "@assets/Checkmark_1762329639081.png";
import canadaFlag from "@assets/Canada Flag_1762329639080.png";
import playButton from "@assets/Play button_1762329639083.png";

export default function Landing() {
  const [, setLocation] = useLocation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const styles = [
    "Mid Century Scandi",
    "Organic Modern",
    "Artful Eclectic",
    "Modern Farmhouse",
    "Warm Transitional",
    "Modern Luxe"
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />

      {/* Spacer for fixed navigation */}
      <div className="h-28"></div>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Headline & CTA */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight" data-testid="heading-hero">
                Design The Space Where You'll Feel Most at Home
              </h1>
              <p className="text-xl text-stone-600 dark:text-stone-400 mb-8">
                Your Dream Room is Just 7 Questions Away
              </p>
              <Button
                size="lg"
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-12 py-6 text-lg"
                onClick={() => setLocation("/quiz")}
                data-testid="button-start-now"
              >
                START NOW
              </Button>
            </motion.div>

            {/* Right: Style Carousel */}
            <div className="relative">
              <div className="overflow-hidden">
                <motion.div
                  animate={{ x: [0, -1000] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="flex gap-4"
                >
                  {[...styles, ...styles].map((style, idx) => (
                    <Card
                      key={idx}
                      className="min-w-[350px] p-8 text-center bg-stone-50 dark:bg-stone-900 hover-elevate"
                    >
                      <div className="w-full h-56 bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-700 dark:to-stone-800 rounded-lg mb-4"></div>
                      <p className="text-lg font-semibold">{style}</p>
                    </Card>
                  ))}
                </motion.div>
              </div>
              <p className="text-center text-sm text-stone-500 mt-4">(Slide to show all style examples)</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-stone-50 dark:bg-stone-900">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-16"
            data-testid="heading-how-it-works"
          >
            HOW IT WORKS
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="grid md:grid-cols-3 gap-12"
          >
            <motion.div variants={itemVariants} className="text-center" data-testid="how-it-works-1">
              <div className="w-24 h-24 mx-auto mb-6">
                <img src={howItWorks1} alt="Tell us about your dream space" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-xl font-bold mb-4 uppercase">Tell Us About<br />Your Dream Space</h3>
              <p className="text-stone-600 dark:text-stone-400">
                Choose your room type, mood, style and budget.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="text-center" data-testid="how-it-works-2">
              <div className="w-24 h-24 mx-auto mb-6">
                <img src={howItWorks2} alt="Let us design it in minutes" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-xl font-bold mb-4 uppercase">Let Us Design<br />It in Minutes</h3>
              <p className="text-stone-600 dark:text-stone-400">
                Our personalized system will provide a design with curated furniture selections.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="text-center" data-testid="how-it-works-3">
              <div className="w-24 h-24 mx-auto mb-6">
                <img src={howItWorks3} alt="Designer's picks provided" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-xl font-bold mb-4 uppercase">Designer's<br />Picks Provided</h3>
              <p className="text-stone-600 dark:text-stone-400">
                Receive your full personal designer selections
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-800 dark:to-stone-900 rounded-2xl p-20"
          >
            <button
              className="absolute inset-0 flex items-center justify-center group"
              data-testid="button-watch-video"
            >
              <div className="w-20 h-20 transform transition-transform group-hover:scale-110">
                <img src={playButton} alt="Play video" className="w-full h-full" />
              </div>
            </button>
            <div className="relative z-10 pointer-events-none">
              <p className="text-2xl font-bold mb-4">WATCH OUR VIDEO</p>
            </div>
          </motion.div>

          {/* Scrolling bullets */}
          <div className="mt-8 overflow-hidden">
            <motion.div
              animate={{ x: [0, -500] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="flex gap-8 text-sm text-stone-600 dark:text-stone-400"
            >
              {[
                "Professional Design in Minutes",
                "Curated Furniture Selections",
                "Canadian Designers",
                "Quality Guaranteed",
                "Professional Design in Minutes",
                "Curated Furniture Selections"
              ].map((bullet, idx) => (
                <span key={idx} className="whitespace-nowrap">• {bullet}</span>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Furniture Feature Section */}
      <section className="py-20 px-6 bg-stone-50 dark:bg-stone-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div>
              <h2 className="text-4xl font-bold mb-6" data-testid="heading-furniture-curated">
                FURNITURE CURATED JUST FOR YOU
              </h2>
              <p className="text-lg text-stone-600 dark:text-stone-400 mb-8 leading-relaxed">
                We don't just sell furniture—we curate it. Every piece is handpicked by our design team for quality, comfort, and timeless style. From custom upholstery to space-saving silhouettes, you'll only find what's worth loving.
              </p>
              <p className="text-lg font-semibold text-stone-700 dark:text-stone-300">
                Crafted with care. Delivered with confidence.
              </p>
            </div>

            {/* Right: Feature Checkmarks */}
            <div className="space-y-6">
              {[
                "Canadian Sourced & Designed",
                "Custom Options Available",
                "Handpicked by Interior Designers",
                "Built For Real Life"
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-4"
                  data-testid={`feature-${idx + 1}`}
                >
                  <div className="w-12 h-12 flex-shrink-0">
                    <img src={checkmarkIcon} alt="Checkmark" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-lg font-semibold">{feature}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Company */}
            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2 text-stone-400">
                <li>
                  <button onClick={() => setLocation("/about")} className="hover:text-green-400 transition-colors" data-testid="link-footer-about">
                    About us
                  </button>
                </li>
                <li>
                  <button onClick={() => setLocation("/")} className="hover:text-green-400 transition-colors" data-testid="link-footer-how-it-works">
                    How it Works
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-press">Press Inquiries</a>
                </li>
              </ul>
            </div>

            {/* Design Tools */}
            <div>
              <h3 className="font-bold mb-4">Design Tools</h3>
              <ul className="space-y-2 text-stone-400">
                <li>
                  <button onClick={() => setLocation("/quiz")} className="hover:text-green-400 transition-colors" data-testid="link-footer-quiz">
                    Take the Quiz
                  </button>
                </li>
                <li>
                  <button onClick={() => setLocation("/results")} className="hover:text-green-400 transition-colors" data-testid="link-footer-examples">
                    View Example Rooms
                  </button>
                </li>
                <li>
                  <button onClick={() => setLocation("/pricing")} className="hover:text-green-400 transition-colors" data-testid="link-footer-pricing">
                    Pricing & Plans
                  </button>
                </li>
              </ul>
            </div>

            {/* For Professionals */}
            <div>
              <h3 className="font-bold mb-4">For Professionals</h3>
              <ul className="space-y-2 text-stone-400">
                <li>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-designers">For Designers</a>
                </li>
                <li>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-realtors">For Realtors / Airbnb Hosts</a>
                </li>
                <li>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-partner">Partner With Us</a>
                </li>
              </ul>
            </div>

            {/* Stay Connected */}
            <div>
              <h3 className="font-bold mb-4">Stay Connected</h3>
              <div className="flex gap-2 mb-6">
                <Input
                  type="email"
                  placeholder="Email address"
                  className="bg-stone-800 border-stone-700 text-white placeholder:text-stone-500"
                  data-testid="input-newsletter"
                />
                <Button className="bg-green-500 hover:bg-green-600 text-white" data-testid="button-subscribe">
                  Subscribe
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8">
                  <img src={canadaFlag} alt="Canada Flag" className="w-full h-full object-contain" />
                </div>
                <p className="text-sm font-semibold">Proud to be<br />Canadian</p>
              </div>
            </div>
          </div>

          {/* Legal & Support */}
          <div className="pt-8 border-t border-stone-800">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="font-semibold mb-2">Legal</h4>
                <div className="flex gap-4 text-stone-400 text-sm">
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-privacy">Privacy Policy</a>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-terms">Terms of Service</a>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Support</h4>
                <div className="flex gap-4 text-stone-400 text-sm">
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-faq">FAQ</a>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-contact">Contact Us</a>
                </div>
              </div>
            </div>

            <div className="text-center text-stone-400 text-sm pt-6">
              <p>&copy; 2024 Curalina AI. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
