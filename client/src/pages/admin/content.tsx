import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ContentDialog } from "@/components/ContentDialog";
import type { Content, InsertContent } from "@shared/schema";

export default function AdminContent() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<Content | null>(null);
  
  const { data: contentList, isLoading: isLoadingContent } = useQuery<Content[]>({
    queryKey: ["/api/content"],
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertContent) => {
      return await apiRequest("POST", "/api/content", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Success",
        description: "Content created successfully",
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Session expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create content",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertContent> }) => {
      return await apiRequest("PUT", `/api/content/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Success",
        description: "Content updated successfully",
      });
      setDialogOpen(false);
      setEditingContent(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Session expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update content",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Success",
        description: "Content deleted successfully",
      });
      setDeleteDialogOpen(false);
      setContentToDelete(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Session expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete content",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: InsertContent) => {
    createMutation.mutate(data);
  };

  const handleEdit = (data: InsertContent) => {
    if (editingContent) {
      updateMutation.mutate({ id: editingContent.id, data });
    }
  };

  const handleDelete = () => {
    if (contentToDelete) {
      deleteMutation.mutate(contentToDelete.id);
    }
  };

  const openCreateDialog = () => {
    setEditingContent(null);
    setDialogOpen(true);
  };

  const openEditDialog = (content: Content) => {
    setEditingContent(content);
    setDialogOpen(true);
  };

  const openDeleteDialog = (content: Content) => {
    setContentToDelete(content);
    setDeleteDialogOpen(true);
  };

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
        <Button 
          className="gap-2" 
          onClick={openCreateDialog}
          data-testid="button-create-content"
        >
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
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.category}
                      {item.description && ` • ${item.description.substring(0, 80)}${item.description.length > 80 ? '...' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.published ? (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded whitespace-nowrap">
                        Published
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded whitespace-nowrap">
                        Draft
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                      data-testid={`button-edit-${item.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(item)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">No content yet</p>
              <p className="text-sm">Create your first content item to get started</p>
              <Button 
                className="mt-6 gap-2" 
                variant="outline"
                onClick={openCreateDialog}
                data-testid="button-create-first-content"
              >
                <Plus className="h-4 w-4" />
                Create Content
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ContentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        content={editingContent}
        onSubmit={editingContent ? handleEdit : handleCreate}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{contentToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
