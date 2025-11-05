import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Activity, TrendingUp } from "lucide-react";
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-admin-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome to your admin dashboard. Monitor and manage your platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index} className="hover-elevate transition-all" data-testid={`card-stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-green-600 dark:text-green-500">
                  {stat.trend}
                </span>
                <span className="text-xs text-muted-foreground">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No recent activity</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/admin/content"
              className="flex items-center gap-3 p-4 rounded-md border hover-elevate active-elevate-2 transition-all"
              data-testid="link-quick-content"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Manage Content</div>
                <div className="text-sm text-muted-foreground">Create and edit content</div>
              </div>
            </a>
            <a
              href="/admin/users"
              className="flex items-center gap-3 p-4 rounded-md border hover-elevate active-elevate-2 transition-all"
              data-testid="link-quick-users"
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Manage Users</div>
                <div className="text-sm text-muted-foreground">View and manage users</div>
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
