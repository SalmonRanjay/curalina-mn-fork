import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Activity, TrendingUp, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    if (!isLoading && isAuthenticated && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/portal";
      }, 500);
    }
  }, [isAuthenticated, isLoading, isAdmin, toast]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="space-y-8">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const stats = [
    {
      title: "Total Users",
      value: "0",
      description: "Active users",
      icon: Users,
      trend: "+0%",
    },
    {
      title: "Content Items",
      value: "0",
      description: "Published content",
      icon: FileText,
      trend: "+0%",
    },
    {
      title: "Activity",
      value: "0",
      description: "Recent actions",
      icon: Activity,
      trend: "+0%",
    },
    {
      title: "Growth",
      value: "0%",
      description: "This month",
      icon: TrendingUp,
      trend: "+0%",
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="text-3xl font-bold mb-2 tracking-tight" data-testid="text-admin-title">
          Dashboard
        </h1>
        <p className="text-base medium-contrast">
          Welcome to your admin dashboard. Monitor and manage your platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover-elevate transition-all border-border/50" data-testid={`card-stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 gap-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide low-contrast">
                {stat.title}
              </CardTitle>
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight mb-1">{stat.value}</div>
              <p className="text-sm low-contrast">
                {stat.description}
              </p>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  {stat.trend}
                </span>
                <span className="text-xs low-contrast">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="empty-state">
              <Activity className="empty-state-icon" />
              <p className="empty-state-title">No recent activity</p>
              <p className="empty-state-description">
                Activity logs will appear here as actions are performed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-2">
            <a
              href="/quiz"
              className="group flex items-center gap-4 p-4 rounded-lg border border-border/50 hover-elevate active-elevate-2 transition-all"
              data-testid="link-quick-quiz"
            >
              <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-0.5">Start Quiz</div>
                <div className="text-sm low-contrast">Take the design style quiz</div>
              </div>
            </a>
            <a
              href="/admin/content"
              className="group flex items-center gap-4 p-4 rounded-lg border border-border/50 hover-elevate active-elevate-2 transition-all"
              data-testid="link-quick-content"
            >
              <div className="rounded-lg bg-accent/10 p-2.5 group-hover:bg-accent/20 transition-colors">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-0.5">Manage Content</div>
                <div className="text-sm low-contrast">Create and edit content</div>
              </div>
            </a>
            <a
              href="/admin/users"
              className="group flex items-center gap-4 p-4 rounded-lg border border-border/50 hover-elevate active-elevate-2 transition-all"
              data-testid="link-quick-users"
            >
              <div className="rounded-lg bg-secondary/10 p-2.5 group-hover:bg-secondary/20 transition-colors">
                <Users className="h-5 w-5 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-0.5">Manage Users</div>
                <div className="text-sm low-contrast">View and manage users</div>
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
