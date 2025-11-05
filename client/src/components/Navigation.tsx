import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "HOME", path: "/" },
    { label: "EXPLORE STYLES", path: "/styles" },
    { label: "PRICING", path: "/pricing" },
    { label: "ABOUT US", path: "/about" },
    { label: "BLOG", path: "/blog" }
  ];

  const handleNavClick = (path: string) => {
    setLocation(path);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-stone-950 shadow-sm">
      {/* Promo Banner */}
      <div className="bg-stone-900 text-white text-center py-2 px-4 text-sm">
        <p className="font-medium">
          TAKE THE QUIZ. SHOP THE CURATED LOOK. LOVE YOUR PERSONALIZED SPACE | 
          <span className="text-green-400 ml-2">AUTUMN PROMO: FIRST DESIGN ON US</span>
        </p>
      </div>

      {/* Main Navigation */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => handleNavClick("/")}
            className="text-2xl font-bold"
            data-testid="logo-home"
          >
            CURALINA
          </button>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`font-semibold text-sm transition-colors hover:text-green-500 ${
                  location === item.path ? "text-green-500" : "text-stone-700 dark:text-stone-300"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA Button */}
          <Button
            onClick={() => handleNavClick("/quiz")}
            className="hidden md:inline-flex bg-green-500 hover:bg-green-600 text-white font-semibold"
            data-testid="button-nav-quiz"
          >
            TAKE THE QUIZ
          </Button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800">
          <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`block w-full text-left font-semibold text-sm py-2 transition-colors hover:text-green-500 ${
                  location === item.path ? "text-green-500" : "text-stone-700 dark:text-stone-300"
                }`}
                data-testid={`nav-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
              </button>
            ))}
            <Button
              onClick={() => handleNavClick("/quiz")}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold"
              data-testid="button-nav-quiz-mobile"
            >
              TAKE THE QUIZ
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
