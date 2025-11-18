import { Switch, Route, useLocation } from "wouter";
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
import AdminRendersStorage from "@/pages/admin/renders-storage";
import AdminDocumentation from "@/pages/admin/documentation";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalSettings from "@/pages/portal/settings";

function AdminLayout() {
  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/admin" component={AdminDashboard} />
            <Route path="/admin/products" component={AdminProducts} />
            <Route path="/admin/suppliers" component={AdminSuppliers} />
            <Route path="/admin/orders" component={AdminOrders} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route path="/admin/settings" component={AdminSettings} />
            <Route path="/admin/training" component={AdminTraining} />
            <Route path="/admin/analytics" component={AdminAnalytics} />
            <Route path="/admin/blog" component={AdminBlog} />
            <Route path="/admin/content" component={AdminContent} />
            <Route path="/admin/bulk-upload" component={AdminBulkUpload} />
            <Route path="/admin/csv-import" component={AdminCsvImport} />
            <Route path="/admin/renders-storage" component={AdminRendersStorage} />
            <Route path="/admin/documentation" component={AdminDocumentation} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [location] = useLocation();

  // Public routes (accessible without authentication)
  const publicRoutes = (
    <Switch>
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
      <Route path="/cart" component={Cart} />
      <Route component={isLoading ? Landing : NotFound} />
    </Switch>
  );

  // Show public routes for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return publicRoutes;
  }

  // Admin users - wrap only /admin/* routes with sidebar
  if (isAdmin) {
    // Check if current path is an admin route
    const isAdminRoute = location.startsWith('/admin');
    
    if (isAdminRoute) {
      return <AdminLayout />;
    }
    
    // Non-admin routes for admin users (no sidebar)
    return (
      <Switch>
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
        <Route path="/cart" component={Cart} />
        <Route path="/portal" component={PortalDashboard} />
        <Route path="/portal/settings" component={PortalSettings} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Regular user routes (no admin access)
  return (
    <Switch>
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
        <QuizProvider>
          <Router />
          <Toaster />
        </QuizProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
