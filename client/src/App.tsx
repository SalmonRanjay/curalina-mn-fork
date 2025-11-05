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
import AdminDashboard from "@/pages/admin/dashboard";
import AdminContent from "@/pages/admin/content";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalSettings from "@/pages/portal/settings";

function Router() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  // Show landing page for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Admin routes with sidebar
  if (isAdmin) {
    const sidebarStyle = {
      "--sidebar-width": "15rem",
      "--sidebar-width-icon": "3rem",
    };

    return (
      <Switch>
        {/* Public landing (accessible to logged-in users) */}
        <Route path="/" component={Landing} />
        
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
        
        <Route path="/admin/content">
          {() => (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <AdminContent />
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
