import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { QuizProvider } from "@/contexts/QuizContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Quiz from "@/pages/Quiz";
import Loading from "@/pages/Loading";
import Results from "@/pages/Results";
import ComparisonRender from "@/pages/ComparisonRender";
import Cart from "@/pages/Cart";
import Styles from "@/pages/styles";
import Pricing from "@/pages/pricing";
import About from "@/pages/about";
import Blog from "@/pages/blog";
import Dashboard from "@/pages/dashboard";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalSettings from "@/pages/portal/settings";
import MyDashboard from "@/pages/my-dashboard";
import { AdminRoutes } from "@/components/AdminRoutes";

function Router() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [location] = useLocation();

  // Page transition variants for smooth fade
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const pageTransition = {
    duration: 0.2,
    ease: "easeInOut"
  };

  // Admin users - show all routes with admin routes wrapped in sidebar layout
  if (isAdmin) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
          className="min-h-screen"
        >
          <Switch location={location}>
            <Route path="/admin/:rest*" component={AdminRoutes} />
            <Route path="/" component={Home} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/styles" component={Styles} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/about" component={About} />
            <Route path="/blog" component={Blog} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/quiz" component={Quiz} />
            <Route path="/loading" component={Loading} />
            <Route path="/results" component={Results} />
            <Route path="/comparison" component={ComparisonRender} />
            <Route path="/cart" component={Cart} />
            <Route path="/my-dashboard" component={MyDashboard} />
            <Route path="/portal" component={PortalDashboard} />
            <Route path="/portal/settings" component={PortalSettings} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Regular user routes (no admin access)
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        className="min-h-screen"
      >
        <Switch location={location}>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/styles" component={Styles} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/about" component={About} />
          <Route path="/blog" component={Blog} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/quiz" component={Quiz} />
          <Route path="/loading" component={Loading} />
          <Route path="/results" component={Results} />
          <Route path="/comparison" component={ComparisonRender} />
          <Route path="/cart" component={Cart} />
          <Route path="/my-dashboard" component={MyDashboard} />
          <Route path="/portal" component={PortalDashboard} />
          <Route path="/portal/settings" component={PortalSettings} />
          
          {/* Redirect admin routes to portal for non-admin users */}
          <Route path="/admin">
            {() => {
              window.location.href = "/portal";
              return null;
            }}
          </Route>
          <Route path="/admin/:rest*">
            {() => {
              window.location.href = "/portal";
              return null;
            }}
          </Route>
          
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <QuizProvider>
          <Router />
          <Toaster />
        </QuizProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
