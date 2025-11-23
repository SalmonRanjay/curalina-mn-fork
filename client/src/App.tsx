import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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
import AdminDashboard from "@/pages/admin";
import AdminProducts from "@/pages/admin/products";
import AdminSuppliers from "@/pages/admin/suppliers";
import AdminOrders from "@/pages/admin/orders";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import AdminTraining from "@/pages/admin/training";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminBlog from "@/pages/admin/blog";
import AdminContent from "@/pages/admin/content";
import AdminBulkUpload from "@/pages/admin/bulk-upload";
import AdminCsvImport from "@/pages/admin/csv-import";
import AdminFrontViewUpload from "@/pages/admin/front-view-upload";
import AdminS3Sync from "@/pages/admin/s3-sync";
import AdminS3ImageRenamer from "@/pages/admin/s3-image-renamer";
import AdminRendersStorage from "@/pages/admin/renders-storage";
import AdminDocumentation from "@/pages/admin/documentation";
import AdminMappingAnalysis from "@/pages/admin/mapping-analysis";
import AnalysisDashboard from "@/pages/admin/analysis-dashboard";
import AdminVisualDescriptions from "@/pages/admin/visual-descriptions";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalSettings from "@/pages/portal/settings";

function AdminLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

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

  // Public routes (accessible without authentication)
  const publicRoutes = (
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
          <Route component={isLoading ? Landing : NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );

  // Show public routes for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return publicRoutes;
  }

  // Admin users - show all routes with admin routes wrapped in sidebar layout
  if (isAdmin) {
    // Check if current path is an admin route
    const isAdminRoute = location.startsWith('/admin');
    
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
            <Route path="/admin" component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/products" component={() => <AdminLayout><AdminProducts /></AdminLayout>} />
            <Route path="/admin/products/csv-import" component={() => <AdminLayout><AdminCsvImport /></AdminLayout>} />
            <Route path="/admin/products/bulk-upload" component={() => <AdminLayout><AdminBulkUpload /></AdminLayout>} />
            <Route path="/admin/products/front-view-upload" component={() => <AdminLayout><AdminFrontViewUpload /></AdminLayout>} />
            <Route path="/admin/products/s3-sync" component={() => <AdminLayout><AdminS3Sync /></AdminLayout>} />
            <Route path="/admin/products/s3-image-renamer" component={() => <AdminLayout><AdminS3ImageRenamer /></AdminLayout>} />
            <Route path="/admin/products/visual-descriptions" component={() => <AdminLayout><AdminVisualDescriptions /></AdminLayout>} />
            <Route path="/admin/suppliers" component={() => <AdminLayout><AdminSuppliers /></AdminLayout>} />
            <Route path="/admin/orders" component={() => <AdminLayout><AdminOrders /></AdminLayout>} />
            <Route path="/admin/users" component={() => <AdminLayout><AdminUsers /></AdminLayout>} />
            <Route path="/admin/settings" component={() => <AdminLayout><AdminSettings /></AdminLayout>} />
            <Route path="/admin/training" component={() => <AdminLayout><AdminTraining /></AdminLayout>} />
            <Route path="/admin/analytics" component={() => <AdminLayout><AdminAnalytics /></AdminLayout>} />
            <Route path="/admin/blog" component={() => <AdminLayout><AdminBlog /></AdminLayout>} />
            <Route path="/admin/content" component={() => <AdminLayout><AdminContent /></AdminLayout>} />
            <Route path="/admin/renders-storage" component={() => <AdminLayout><AdminRendersStorage /></AdminLayout>} />
            <Route path="/admin/documentation" component={() => <AdminLayout><AdminDocumentation /></AdminLayout>} />
            <Route path="/admin/mapping-analysis" component={() => <AdminLayout><AdminMappingAnalysis /></AdminLayout>} />
            <Route path="/admin/analysis" component={() => <AdminLayout><AnalysisDashboard /></AdminLayout>} />
            
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
