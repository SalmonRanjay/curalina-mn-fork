import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import Header from "@/components/home/Header";
import organicModernImg from "@assets/image001_1762335467188.png";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Top bar with journey message */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <p className="text-center text-sm text-muted-foreground font-inter">
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
              <h1 className="font-cormorant text-foreground mb-6 leading-tight tracking-tight" style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 500 }} data-testid="heading-hero">
                Design the space where you'll feel most at home
              </h1>
              <p className="text-muted-foreground mb-4 font-inter" style={{ fontSize: 'var(--font-size-xl)' }}>
                Discover your signature space in just 7 questions
              </p>
              <p className="text-muted-foreground mb-8 font-inter" style={{ fontSize: 'var(--font-size-lg)' }}>
                Crafted for real life, elevated for everyday.
              </p>
              <Button
                size="lg"
                className="font-inter"
                onClick={() => setLocation("/quiz")}
                data-testid="button-start-quiz"
              >
                START THE QUIZ
              </Button>
              <p className="text-sm text-muted-foreground mt-4 font-inter">
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
              <p className="text-sm font-inter font-medium text-muted-foreground mb-2 tracking-wider uppercase">
                ORGANIC MODERN
              </p>
              <h2 className="font-cormorant text-foreground leading-tight" style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 500 }}>
                You asked, we delivered — personalized design made accessible.
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="py-24 px-6 bg-muted">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-sm font-inter font-semibold text-center mb-20 tracking-[0.2em] text-foreground uppercase" data-testid="heading-how-we-work">
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
                <h3 className="text-sm font-inter font-semibold mb-3 text-foreground">
                  (1) TELL US ABOUT YOUR DREAM SPACE
                </h3>
                <p className="text-muted-foreground font-inter">
                  Choose your room type, mood, style and budget.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-sm font-inter font-semibold mb-3 text-foreground">
                  (2) LET US DESIGN IT IN MINUTES
                </h3>
                <p className="text-muted-foreground font-inter">
                  Our personalized system will provide a design with curated furniture and decor selections to reflect you
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-sm font-inter font-semibold mb-3 text-foreground">
                  (3) RECEIVE YOUR FULL DESIGNER LOOK
                </h3>
                <p className="text-muted-foreground font-inter">
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
      <section className="py-24 px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-cormorant mb-6" style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 500 }}>
            Partner with Curalina
          </h2>
          <p className="text-primary-foreground/80 mb-4 font-inter" style={{ fontSize: 'var(--font-size-lg)' }}>
            Join our curated network of brands shaping Canada's design future.
          </p>
          <p className="text-primary-foreground/80 mb-4 font-inter" style={{ fontSize: 'var(--font-size-lg)' }}>
            Showcase your products where design meets demand.
          </p>
          <p className="text-primary-foreground/80 font-inter" style={{ fontSize: 'var(--font-size-lg)' }}>
            Partner with us to place your collection in beautifully styled spaces nationwide.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted border-t border-border py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* OUR COMPANY */}
            <div>
              <h3 className="font-inter font-semibold mb-4 text-sm text-foreground uppercase tracking-wider">OUR COMPANY</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button onClick={() => setLocation("/about")} className="hover:text-accent transition-colors" data-testid="link-footer-about">
                    About us
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">Social Responsibility</a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors" data-testid="link-footer-press">Press Inquiries</a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">Partner with Us</a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors" data-testid="link-footer-contact">Contact Us</a>
                </li>
              </ul>
            </div>

            {/* CUSTOMER CARE */}
            <div>
              <h3 className="font-inter font-semibold mb-4 text-sm text-foreground uppercase tracking-wider">CUSTOMER CARE</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-accent transition-colors">Order Status</a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">Furniture Protection Plans</a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">Returns & Exchanges</a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">Delivery & Shipping</a>
                </li>
              </ul>
            </div>

            {/* RESOURCES */}
            <div>
              <h3 className="font-inter font-semibold mb-4 text-sm text-foreground uppercase tracking-wider">RESOURCES</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button onClick={() => setLocation("/quiz")} className="hover:text-accent transition-colors" data-testid="link-footer-quiz">
                    Take the Quiz
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">Before & Afters</a>
                </li>
                <li>
                  <button onClick={() => setLocation("/pricing")} className="hover:text-accent transition-colors" data-testid="link-footer-pricing">
                    Pricing & Subscriptions
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors" data-testid="link-footer-faq">FAQ</a>
                </li>
              </ul>
            </div>

            {/* PROUDLY CANADIAN */}
            <div>
              <h3 className="font-inter font-semibold mb-4 text-sm text-foreground uppercase tracking-wider">PROUDLY CANADIAN</h3>
              <p className="text-sm text-muted-foreground italic font-inter">
                Curated for Canadians.<br />
                Designed for real life.
              </p>
            </div>

            {/* STAY CONNECTED */}
            <div>
              <h3 className="font-inter font-semibold mb-4 text-sm text-foreground uppercase tracking-wider">STAY CONNECTED</h3>
              <p className="text-sm text-muted-foreground mb-4 font-inter">
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
          <div className="pt-8 border-t border-border">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground font-inter">
              <a href="#" className="hover:text-accent transition-colors">Terms & Conditions</a>
              <a href="#" className="hover:text-accent transition-colors" data-testid="link-footer-privacy">Privacy Policy</a>
              <span>© {new Date().getFullYear()} Curalina. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
