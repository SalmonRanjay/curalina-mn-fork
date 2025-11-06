import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import organicModernImg from "@assets/image001_1762335467188.png";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />

      {/* Top bar with journey message */}
      <div className="bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <p className="text-center text-sm text-stone-600 dark:text-stone-400">
            Your style journey is just beginning — more styles, rooms, and edits are on the way
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left: Empty for balance */}
            <div></div>

            {/* Right: Hero Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-left"
            >
              <h1 className="text-5xl md:text-6xl font-medium mb-6 leading-tight tracking-tight" data-testid="heading-hero">
                Discover your signature space in just 7 questions
              </h1>
              <p className="text-lg text-stone-600 dark:text-stone-400 mb-8">
                Crafted for real life, elevated for everyday.
              </p>
              <Button
                size="lg"
                className="bg-stone-900 dark:bg-white hover:bg-stone-800 dark:hover:bg-stone-100 text-white dark:text-stone-900 font-medium px-12 py-6 text-base"
                onClick={() => setLocation("/quiz")}
                data-testid="button-start-quiz"
              >
                START THE QUIZ
              </Button>
              <p className="text-sm text-stone-500 dark:text-stone-500 mt-4">
                Takes 2 minutes, No wrong answers
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Organic Modern Showcase */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img 
                src={organicModernImg} 
                alt="Organic Modern" 
                className="w-full rounded-lg"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-2 tracking-wider">
                ORGANIC MODERN
              </p>
              <h2 className="text-4xl md:text-5xl font-medium mb-6 leading-tight">
                You asked, we delivered — personalized design made accessible.
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="py-24 px-6 bg-stone-50 dark:bg-stone-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-sm font-semibold text-center mb-20 tracking-[0.2em] text-stone-900 dark:text-white" data-testid="heading-how-we-work">
            HOW WE WORK
          </h2>

          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Left: Empty for balance */}
            <div></div>

            {/* Right: Steps */}
            <div className="space-y-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="text-sm font-semibold mb-3 text-stone-900 dark:text-white">
                  (1) TELL US ABOUT YOUR DREAM SPACE
                </h3>
                <p className="text-stone-600 dark:text-stone-400">
                  Choose your room type, mood, style and budget.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-sm font-semibold mb-3 text-stone-900 dark:text-white">
                  (2) LET US DESIGN IT IN MINUTES
                </h3>
                <p className="text-stone-600 dark:text-stone-400">
                  Our personalized system will provide a design with curated furniture and decor selections to reflect you
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-sm font-semibold mb-3 text-stone-900 dark:text-white">
                  (3) RECEIVE YOUR FULL DESIGNER LOOK
                </h3>
                <p className="text-stone-600 dark:text-stone-400">
                  From concept to cart — every item is ready for you to own, styled for every corner of your space.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover-elevate">
              <h3 className="text-xl font-semibold mb-4">Curalina Rewards</h3>
              <Button variant="outline" size="sm" className="mt-4">
                LEARN MORE
              </Button>
            </Card>

            <Card className="p-8 text-center hover-elevate">
              <h3 className="text-xl font-semibold mb-4">Handpicked by Interior Designers</h3>
            </Card>

            <Card className="p-8 text-center hover-elevate">
              <h3 className="text-xl font-semibold mb-4">Subscription Program</h3>
              <Button variant="outline" size="sm" className="mt-4">
                LEARN MORE
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Partner Section */}
      <section className="py-24 px-6 bg-stone-900 dark:bg-stone-950 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-6">
            Partner with Curalina
          </h2>
          <p className="text-lg text-stone-300 dark:text-stone-400 mb-4">
            Join our curated network of brands shaping Canada's design future.
          </p>
          <p className="text-lg text-stone-300 dark:text-stone-400 mb-4">
            Showcase your products where design meets demand.
          </p>
          <p className="text-lg text-stone-300 dark:text-stone-400">
            Partner with us to place your collection in beautifully styled spaces nationwide.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* OUR COMPANY */}
            <div>
              <h3 className="font-semibold mb-4 text-sm">OUR COMPANY</h3>
              <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
                <li>
                  <button onClick={() => setLocation("/about")} className="hover:text-stone-900 dark:hover:text-white transition-colors" data-testid="link-footer-about">
                    About us
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Social Responsibility</a>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors" data-testid="link-footer-press">Press Inquiries</a>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Partner with Us</a>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors" data-testid="link-footer-contact">Contact Us</a>
                </li>
              </ul>
            </div>

            {/* CUSTOMER CARE */}
            <div>
              <h3 className="font-semibold mb-4 text-sm">CUSTOMER CARE</h3>
              <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Order Status</a>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Furniture Protection Plans</a>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Returns & Exchanges</a>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Delivery & Shipping</a>
                </li>
              </ul>
            </div>

            {/* RESOURCES */}
            <div>
              <h3 className="font-semibold mb-4 text-sm">RESOURCES</h3>
              <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
                <li>
                  <button onClick={() => setLocation("/quiz")} className="hover:text-stone-900 dark:hover:text-white transition-colors" data-testid="link-footer-quiz">
                    Take the Quiz
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Before & Afters</a>
                </li>
                <li>
                  <button onClick={() => setLocation("/pricing")} className="hover:text-stone-900 dark:hover:text-white transition-colors" data-testid="link-footer-pricing">
                    Pricing & Subscriptions
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors" data-testid="link-footer-faq">FAQ</a>
                </li>
              </ul>
            </div>

            {/* PROUDLY CANADIAN */}
            <div>
              <h3 className="font-semibold mb-4 text-sm">PROUDLY CANADIAN</h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 italic">
                Curated for Canadians.<br />
                Designed for real life.
              </p>
            </div>

            {/* STAY CONNECTED */}
            <div>
              <h3 className="font-semibold mb-4 text-sm">STAY CONNECTED</h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
                Sign up for promotions, decorating tips and more from our team.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email address"
                  className="text-sm"
                  data-testid="input-newsletter"
                />
                <Button variant="ghost" size="sm" className="px-2" data-testid="button-subscribe">
                  →
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Legal */}
          <div className="pt-8 border-t border-stone-200 dark:border-stone-800">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-stone-600 dark:text-stone-400">
              <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors">Terms & Conditions</a>
              <a href="#" className="hover:text-stone-900 dark:hover:text-white transition-colors" data-testid="link-footer-privacy">Privacy Policy</a>
              <span>Copyrighted 2025</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
