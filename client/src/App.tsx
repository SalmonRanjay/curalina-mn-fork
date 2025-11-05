import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Quiz from "@/pages/Quiz";
import Loading from "@/pages/Loading";
import Results from "@/pages/Results";
import Cart from "@/pages/Cart";
import Styles from "@/pages/styles";
import Pricing from "@/pages/pricing";
import About from "@/pages/about";
import Blog from "@/pages/blog";
import Dashboard from "@/pages/dashboard";
import AdminDashboard from "@/pages/admin";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalSettings from "@/pages/portal/settings";

function Router() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  // Public routes (accessible without authentication)
  const publicRoutes = (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/styles" component={Styles} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/loading" component={Loading} />
      <Route path="/results" component={Results} />
      <Route path="/cart" component={Cart} />
      <Route component={isLoading ? Landing : NotFound} />
    </Switch>
  );

  // Show public routes for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return publicRoutes;
  }

  // Admin routes with sidebar
  if (isAdmin) {
    const sidebarStyle = {
      "--sidebar-width": "15rem",
      "--sidebar-width-icon": "3rem",
    };

    return (
      <Switch>
        {/* Public routes (accessible to logged-in users) */}
        <Route path="/" component={Landing} />
        <Route path="/styles" component={Styles} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/about" component={About} />
        <Route path="/blog" component={Blog} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/quiz" component={Quiz} />
        <Route path="/loading" component={Loading} />
        <Route path="/results" component={Results} />
        <Route path="/cart" component={Cart} />
        
        {/* Admin routes - Unified dashboard with tabs */}
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/:rest*" component={AdminDashboard} />

        {/* User portal routes (admins can access these too) */}
        <Route path="/portal" component={PortalDashboard} />
        <Route path="/portal/settings" component={PortalSettings} />
        
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Regular user routes (no admin access)
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/styles" component={Styles} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/loading" component={Loading} />
      <Route path="/results" component={Results} />
      <Route path="/cart" component={Cart} />
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
