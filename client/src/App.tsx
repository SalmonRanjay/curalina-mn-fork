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
import AdminDashboard from "@/pages/admin/dashboard";
import AdminProducts from "@/pages/admin/products";
import AdminSuppliers from "@/pages/admin/suppliers";
import AdminOrders from "@/pages/admin/orders";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminUsers from "@/pages/admin/users";
import AdminBlog from "@/pages/admin/blog";
import AdminSettings from "@/pages/admin/settings";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalSettings from "@/pages/portal/settings";

function Router() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  // Public routes (accessible without authentication)
  const publicRoutes = (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/loading" component={Loading} />
      <Route path="/results" component={Results} />
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
        <Route path="/quiz" component={Quiz} />
        <Route path="/loading" component={Loading} />
        <Route path="/results" component={Results} />
        
        {/* Admin routes with sidebar */}
        <Route path="/admin">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminDashboard />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>
        
        <Route path="/admin/products">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminProducts />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>
        
        <Route path="/admin/suppliers">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminSuppliers />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>
        
        <Route path="/admin/orders">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminOrders />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>
        
        <Route path="/admin/analytics">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminAnalytics />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>
        
        <Route path="/admin/users">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminUsers />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>
        
        <Route path="/admin/blog">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminBlog />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>
        
        <Route path="/admin/settings">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminSettings />
                </main>
              </div>
            </SidebarProvider>
          )}
        </Route>

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
      <Route path="/quiz" component={Quiz} />
      <Route path="/loading" component={Loading} />
      <Route path="/results" component={Results} />
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
