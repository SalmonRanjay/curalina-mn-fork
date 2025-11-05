import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Sparkles, Palette, ShoppingBag, ArrowRight, Star } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60 z-10"></div>
          <img
            src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1920&h=1000&fit=crop"
            alt="Modern interior design"
            className="w-full h-full object-cover"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-20 text-center px-6 max-w-5xl mx-auto"
        >
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6" style={{ fontFamily: 'Playfair Display, serif' }} data-testid="heading-hero">
            Transform Your Space with AI-Powered Design
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed max-w-3xl mx-auto">
            Create stunning, personalized interior designs in minutes. Our AI understands your style and brings your vision to life.
          </p>
          <Button
            size="lg"
            className="bg-green-400 hover:bg-green-500 text-black font-semibold px-8 py-6 text-lg"
            onClick={() => setLocation("/quiz")}
            data-testid="button-start-journey"
          >
            Start Your Design Journey
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 bg-white/70 rounded-full mt-2"
            />
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-stone-50 dark:bg-stone-900">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="text-center mb-16">
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold mb-4" data-testid="heading-how-it-works">
              How It Works
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
              Three simple steps to your dream interior
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="grid md:grid-cols-3 gap-8">
            <motion.div variants={itemVariants}>
              <Card className="p-8 h-full hover-elevate" data-testid="card-step-1">
                <div className="w-16 h-16 bg-green-400 rounded-2xl flex items-center justify-center mb-6">
                  <Palette className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Take the Quiz</h3>
                <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                  Answer 7 simple questions about your room type, style preferences, budget, and upload inspiration images or floorplans.
                </p>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-8 h-full hover-elevate" data-testid="card-step-2">
                <div className="w-16 h-16 bg-green-400 rounded-2xl flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">AI Generates Design</h3>
                <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                  Our advanced AI analyzes your preferences and creates a photorealistic interior design tailored specifically to your taste.
                </p>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-8 h-full hover-elevate" data-testid="card-step-3">
                <div className="w-16 h-16 bg-green-400 rounded-2xl flex items-center justify-center mb-6">
                  <ShoppingBag className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Shop the Look</h3>
                <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                  Browse curated furniture pieces that match your design. Swap products, add to cart, and bring your vision to life.
                </p>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Design Gallery */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="text-center mb-16">
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold mb-4" data-testid="heading-gallery">
              Design Inspiration
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
              Explore stunning AI-generated interiors across various styles
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&h=800&fit=crop", style: "Modern Minimalist" },
              { url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=600&fit=crop", style: "Scandinavian" },
              { url: "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=600&h=800&fit=crop", style: "Mid-Century Modern" },
              { url: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&h=600&fit=crop", style: "Contemporary" },
              { url: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=600&h=800&fit=crop", style: "Industrial Chic" },
              { url: "https://images.unsplash.com/photo-1616137422211-74d0b6066daf?w=600&h=600&fit=crop", style: "Bohemian" },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="group relative overflow-hidden rounded-lg cursor-pointer"
                data-testid={`gallery-item-${index}`}
              >
                <img src={item.url} alt={item.style} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                  <span className="text-white font-semibold text-lg">{item.style}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-stone-50 dark:bg-stone-900">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="text-center mb-16">
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold mb-4" data-testid="heading-testimonials">
              What Our Clients Say
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-stone-600 dark:text-stone-400">
              Real transformations from real people
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="grid md:grid-cols-2 gap-8">
            <motion.div variants={itemVariants}>
              <Card className="p-8" data-testid="testimonial-1">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg mb-6 leading-relaxed text-stone-700 dark:text-stone-300">
                  "Curalina AI completely transformed our living room. The AI understood exactly what we wanted and the furniture recommendations were spot-on. We couldn't be happier!"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-400 rounded-full flex items-center justify-center text-black font-semibold">
                    SM
                  </div>
                  <div>
                    <p className="font-semibold">Sarah Mitchell</p>
                    <p className="text-sm text-stone-600 dark:text-stone-400">Homeowner, San Francisco</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-8" data-testid="testimonial-2">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg mb-6 leading-relaxed text-stone-700 dark:text-stone-300">
                  "As an interior designer, I was skeptical at first, but this tool is incredible. It helps me visualize ideas quickly and my clients love the instant results. Game changer!"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-400 rounded-full flex items-center justify-center text-black font-semibold">
                    JC
                  </div>
                  <div>
                    <p className="font-semibold">James Chen</p>
                    <p className="text-sm text-stone-600 dark:text-stone-400">Interior Designer, New York</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-green-600 to-green-700">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="max-w-4xl mx-auto text-center">
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-white mb-6" data-testid="heading-cta">
            Ready to Transform Your Space?
          </motion.h2>
          <motion.p variants={itemVariants} className="text-xl text-white/90 mb-8">
            Start your design journey today and see your vision come to life in minutes
          </motion.p>
          <motion.div variants={itemVariants}>
            <Button
              size="lg"
              variant="outline"
              className="bg-white hover:bg-white/90 border-2 border-white text-green-700 font-semibold px-8 py-6 text-lg"
              onClick={() => setLocation("/quiz")}
              data-testid="button-start-quiz-cta"
            >
              Take the Quiz Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <h3 className="text-2xl font-bold mb-4">Curalina AI</h3>
              <p className="text-stone-400 leading-relaxed">
                AI-powered interior design platform helping you create beautiful spaces effortlessly.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-stone-400">
                <li>
                  <button onClick={() => setLocation("/quiz")} className="hover:text-green-400 transition-colors" data-testid="link-footer-quiz">
                    Design Quiz
                  </button>
                </li>
                <li>
                  <button onClick={() => setLocation("/results")} className="hover:text-green-400 transition-colors" data-testid="link-footer-results">
                    Browse Designs
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-stone-400">
                <li>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-gallery">Design Gallery</a>
                </li>
                <li>
                  <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-style-guide">Style Guide</a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Stay Updated</h4>
              <p className="text-stone-400 mb-4 text-sm">
                Get design tips and inspiration
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="bg-stone-800 border-stone-700 text-white placeholder:text-stone-500"
                  data-testid="input-newsletter"
                />
                <Button size="sm" className="bg-green-400 hover:bg-green-500 text-black" data-testid="button-subscribe">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-stone-400 text-sm">
            <p>&copy; 2024 Curalina AI. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-privacy">Privacy Policy</a>
              <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-terms">Terms of Service</a>
              <a href="#" className="hover:text-green-400 transition-colors" data-testid="link-footer-contact">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
