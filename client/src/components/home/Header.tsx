import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, ShoppingBag, User, ChevronRight, LogOut, LayoutDashboard } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
  });

  const handleQuizClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      setLocation("/quiz");
    } else {
      setLocation("/register?redirectTo=/quiz");
    }
    setIsMobileMenuOpen(false);
  };

  const { data: cartItems = [] } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    queryFn: async () => {
      const res = await fetch("/api/cart");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { label: "How It Works", href: "#how-it-works", isAnchor: true },
    { label: "Style Quiz", href: "/quiz", isAnchor: false },
    { label: "Pricing", href: "/pricing", isAnchor: false },
    { label: "The Edit", href: "/blog", isAnchor: false },
  ];

  const isActiveLink = (href: string) => {
    if (href.startsWith('#')) return false;
    return location === href;
  };

  return (
    <header
      className={`header-premium sticky top-0 z-50 transition-all duration-300 ${
        isScrolled ? "header-scrolled" : ""
      }`}
      data-testid="header-sticky"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        <div className="flex items-center justify-between h-16 md:h-[72px]">
          {/* Logo */}
          <Link href="/">
            <span 
              className="header-logo cursor-pointer"
              data-testid="link-logo"
            >
              Curalina
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10" data-testid="nav-desktop">
            {navLinks.map((link) => 
              link.isAnchor ? (
                <a 
                  key={link.href} 
                  href={link.href}
                  className="header-nav-link cursor-pointer"
                  data-testid={`link-${link.label.toLowerCase().replace(/ /g, "-")}`}
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href}>
                  <span 
                    className={`header-nav-link cursor-pointer ${isActiveLink(link.href) ? 'active' : ''}`}
                    data-testid={`link-${link.label.toLowerCase().replace(/ /g, "-")}`}
                  >
                    {link.label}
                  </span>
                </Link>
              )
            )}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Cart */}
            <Link href="/cart">
              <Button 
                variant="ghost" 
                size="icon"
                className="relative"
                data-testid="button-cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    data-testid="badge-cart-count"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost"
                    className="gap-2 font-medium"
                    data-testid="button-user-menu"
                  >
                    <User className="w-4 h-4" />
                    {user.firstName || 'Account'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/my-dashboard">
                      <span className="flex items-center gap-2 cursor-pointer w-full" data-testid="link-my-dashboard">
                        <LayoutDashboard className="w-4 h-4" />
                        My Dashboard
                      </span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()}
                    data-testid="button-logout"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button 
                  variant="ghost"
                  className="gap-2 font-medium"
                  data-testid="link-sign-in"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </Button>
              </Link>
            )}

            {/* Primary CTA */}
            <Button 
              className="font-semibold gap-1.5 px-5"
              onClick={handleQuizClick}
              data-testid="button-start-quiz-header"
            >
              Start the Quiz
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex lg:hidden items-center gap-2">
            {/* Mobile Cart */}
            <Link href="/cart">
              <Button 
                variant="ghost" 
                size="icon"
                className="relative"
                data-testid="button-cart-mobile"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    data-testid="badge-cart-count-mobile"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
              className="lg:hidden overflow-hidden"
              data-testid="nav-mobile"
            >
              <nav className="flex flex-col py-4 border-t border-border">
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {link.isAnchor ? (
                      <a 
                        href={link.href}
                        className="flex items-center justify-between py-3 px-2 text-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                        style={{ fontSize: 'var(--font-size-base)' }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        data-testid={`link-mobile-${link.label.toLowerCase().replace(/ /g, "-")}`}
                      >
                        <span className="font-medium">{link.label}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </a>
                    ) : (
                      <Link href={link.href}>
                        <span 
                          className={`flex items-center justify-between py-3 px-2 hover:bg-muted/50 rounded-md transition-colors cursor-pointer ${
                            isActiveLink(link.href) ? 'text-primary font-semibold' : 'text-foreground/80 hover:text-foreground font-medium'
                          }`}
                          style={{ fontSize: 'var(--font-size-base)' }}
                          onClick={() => setIsMobileMenuOpen(false)}
                          data-testid={`link-mobile-${link.label.toLowerCase().replace(/ /g, "-")}`}
                        >
                          <span>{link.label}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </span>
                      </Link>
                    )}
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navLinks.length * 0.05 }}
                  className="mt-2 pt-4 border-t border-border"
                >
                  {isAuthenticated && user ? (
                    <>
                      <Link href="/my-dashboard">
                        <span 
                          className="flex items-center gap-2 py-3 px-2 text-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-md transition-colors cursor-pointer font-medium"
                          style={{ fontSize: 'var(--font-size-base)' }}
                          onClick={() => setIsMobileMenuOpen(false)}
                          data-testid="link-mobile-my-dashboard"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          My Dashboard
                        </span>
                      </Link>
                      <span 
                        className="flex items-center gap-2 py-3 px-2 text-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-md transition-colors cursor-pointer font-medium"
                        style={{ fontSize: 'var(--font-size-base)' }}
                        onClick={() => {
                          logoutMutation.mutate();
                          setIsMobileMenuOpen(false);
                        }}
                        data-testid="button-mobile-logout"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </span>
                    </>
                  ) : (
                    <Link href="/login">
                      <span 
                        className="flex items-center gap-2 py-3 px-2 text-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-md transition-colors cursor-pointer font-medium"
                        style={{ fontSize: 'var(--font-size-base)' }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        data-testid="link-mobile-sign-in"
                      >
                        <User className="w-4 h-4" />
                        Sign In
                      </span>
                    </Link>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (navLinks.length + 1) * 0.05 }}
                  className="mt-4 px-2"
                >
                  <Button 
                    className="w-full font-semibold gap-1.5"
                    size="lg"
                    onClick={handleQuizClick}
                    data-testid="button-start-quiz-mobile"
                  >
                    Start the Quiz
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
