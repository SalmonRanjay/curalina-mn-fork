import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "How It Works", href: "#how-it-works", isAnchor: true },
    { label: "Style Quiz", href: "/quiz", isAnchor: false },
    { label: "Pricing", href: "/pricing", isAnchor: false },
    { label: "The Edit", href: "/blog", isAnchor: false },
  ];

  return (
    <header
      className={`sticky top-0 z-50 bg-[#FAF9F7] transition-shadow duration-300 ${
        isScrolled ? "shadow-md" : "border-b border-stone-200"
      }`}
      data-testid="header-sticky"
    >
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 lg:px-16">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/">
            <span className="text-2xl font-cormorant font-medium text-stone-900 cursor-pointer" data-testid="link-logo">
              Curalina
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" data-testid="nav-desktop">
            {navLinks.map((link) => 
              link.isAnchor ? (
                <a 
                  key={link.href} 
                  href={link.href}
                  className="text-sm font-inter font-medium text-stone-700 hover:text-[#24A8AE] transition-colors cursor-pointer" 
                  data-testid={`link-${link.label.toLowerCase().replace(/ /g, "-")}`}
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href}>
                  <span className="text-sm font-inter font-medium text-stone-700 hover:text-[#24A8AE] transition-colors cursor-pointer" data-testid={`link-${link.label.toLowerCase().replace(/ /g, "-")}`}>
                    {link.label}
                  </span>
                </Link>
              )
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login">
              <span className="text-sm font-inter font-medium text-stone-700 hover:text-[#24A8AE] transition-colors cursor-pointer" data-testid="link-sign-in">
                Sign In
              </span>
            </Link>
            <Link href="/quiz">
              <Button 
                className="bg-[#24A8AE] text-white font-inter font-semibold"
                data-testid="button-start-quiz-header"
              >
                Start the Quiz
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
            data-testid="button-mobile-menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-stone-200 mt-2" data-testid="nav-mobile">
            <nav className="flex flex-col gap-4 mt-4">
              {navLinks.map((link) => 
                link.isAnchor ? (
                  <a 
                    key={link.href}
                    href={link.href}
                    className="text-sm font-inter font-medium text-stone-700 hover:text-[#24A8AE] transition-colors cursor-pointer block"
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid={`link-mobile-${link.label.toLowerCase().replace(/ /g, "-")}`}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.href} href={link.href}>
                    <span 
                      className="text-sm font-inter font-medium text-stone-700 hover:text-[#24A8AE] transition-colors cursor-pointer block"
                      onClick={() => setIsMobileMenuOpen(false)}
                      data-testid={`link-mobile-${link.label.toLowerCase().replace(/ /g, "-")}`}
                    >
                      {link.label}
                    </span>
                  </Link>
                )
              )}
              <Link href="/login">
                <span className="text-sm font-inter font-medium text-stone-700 cursor-pointer block" data-testid="link-mobile-sign-in">
                  Sign In
                </span>
              </Link>
              <Link href="/quiz">
                <Button 
                  className="w-full bg-[#24A8AE] text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                  data-testid="button-start-quiz-mobile"
                >
                  Start the Quiz
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
