import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Content } from "@shared/schema";

export default function AdminContent() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  
  const { data: contentList, isLoading: isLoadingContent } = useQuery<Content[]>({
    queryKey: ["/api/content"],
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });

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

  if (isLoading || !isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-content-title">
            Content Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage content for your platform.
          </p>
        </div>
        <Button className="gap-2" data-testid="button-create-content">
          <Plus className="h-4 w-4" />
          Create Content
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Content</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingContent ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>Loading...</p>
            </div>
          ) : contentList && contentList.length > 0 ? (
            <div className="space-y-4">
              {contentList.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-4 border rounded-md hover-elevate transition-all"
                  data-testid={`content-item-${item.id}`}
                >
                  <div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.published ? (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                        Published
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">No content yet</p>
              <p className="text-sm">Create your first content item to get started</p>
              <Button className="mt-6 gap-2" variant="outline" data-testid="button-create-first-content">
                <Plus className="h-4 w-4" />
                Create Content
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
