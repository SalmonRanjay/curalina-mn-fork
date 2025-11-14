import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  FileText,
  Clock,
  User,
  Tag,
  Archive,
  CheckCircle,
  Loader2,
  MessageCircle,
  Reply,
  Check,
  Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface DocumentationSection {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[] | null;
  version: number;
  publishedVersion: number | null;
  status: string;
  sortOrder: number;
  parentSectionId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  creatorName?: string | null;
  updaterName?: string | null;
}

interface DocumentationComment {
  id: string;
  sectionId: string;
  threadRootId: string | null;
  parentCommentId: string | null;
  userId: string;
  commentText: string;
  anchorType: string;
  anchorValue: string | null;
  anchorOffset: number | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  isInternal: boolean;
  metadata: any;
  editedAt: string | null;
  createdAt: string;
  userName?: string;
  resolverName?: string;
}

export default function Documentation() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<DocumentationSection | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Fetch all documentation sections
  const { data: sections, isLoading } = useQuery<DocumentationSection[]>({
    queryKey: ["/api/admin/documentation/sections"],
  });

  // Delete section mutation
  const deleteMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/documentation/sections/${sectionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documentation/sections"] });
      toast({
        title: "Success",
        description: "Documentation section deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Publish section mutation
  const publishMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const response = await apiRequest("POST", `/api/admin/documentation/sections/${sectionId}/publish`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documentation/sections"] });
      toast({
        title: "Success",
        description: "Documentation section published successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch comments for selected section
  const { data: comments, refetch: refetchComments } = useQuery<DocumentationComment[]>({
    queryKey: ["/api/admin/documentation/comments", selectedSection?.id],
    queryFn: async () => {
      if (!selectedSection) return [];
      const response = await fetch(`/api/admin/documentation/comments?sectionId=${selectedSection.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
    enabled: !!selectedSection,
    refetchInterval: 15000, // Poll every 15 seconds for real-time updates
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (data: { commentText: string; anchorType?: string; anchorValue?: string; isInternal?: boolean }) => {
      if (!selectedSection) throw new Error("No section selected");
      const response = await apiRequest("POST", "/api/admin/documentation/comments", {
        sectionId: selectedSection.id,
        commentText: data.commentText,
        anchorType: data.anchorType || "section",
        anchorValue: data.anchorValue || null,
        isInternal: data.isInternal || false,
      });
      return response.json();
    },
    onSuccess: () => {
      refetchComments();
      setNewCommentText("");
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reply to comment mutation
  const replyCommentMutation = useMutation({
    mutationFn: async (data: { parentCommentId: string; commentText: string; isInternal?: boolean }) => {
      if (!selectedSection) throw new Error("No section selected");
      const response = await apiRequest("POST", "/api/admin/documentation/comments", {
        sectionId: selectedSection.id,
        parentCommentId: data.parentCommentId,
        commentText: data.commentText,
        isInternal: data.isInternal || false,
      });
      return response.json();
    },
    onSuccess: () => {
      refetchComments();
      setReplyToCommentId(null);
      setReplyText("");
      toast({
        title: "Success",
        description: "Reply added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resolve comment mutation
  const resolveCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await apiRequest("PUT", `/api/admin/documentation/comments/${commentId}/resolve`);
      return response.json();
    },
    onSuccess: () => {
      refetchComments();
      toast({
        title: "Success",
        description: "Comment resolved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter sections based on search query
  const filteredSections = sections?.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.slug.toLowerCase().includes(query) ||
      section.content.toLowerCase().includes(query) ||
      section.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const getStatusBadge = (status: string, testIdSuffix?: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      published: { variant: "default", icon: CheckCircle },
      draft: { variant: "secondary", icon: FileText },
      archived: { variant: "outline", icon: Archive },
    };
    const config = variants[status] || { variant: "outline" as const, icon: FileText };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} data-testid={`badge-status-${status}${testIdSuffix ? `-${testIdSuffix}` : ""}`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const handleViewSection = (section: DocumentationSection) => {
    setSelectedSection(section);
    setIsViewDialogOpen(true);
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (confirm("Are you sure you want to delete this documentation section?")) {
      deleteMutation.mutate(sectionId);
    }
  };

  const handlePublishSection = (sectionId: string) => {
    publishMutation.mutate(sectionId);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-documentation">
            <BookOpen className="h-8 w-8" />
            Curalina Documentation
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage client-facing documentation with markdown, versioning, and collaboration
          </p>
        </div>
        <Button data-testid="button-create-section">
          <Plus className="h-4 w-4 mr-2" />
          New Section
        </Button>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Search by title, slug, content, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-sections">{sections?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1" data-testid="text-published-sections">
              {sections?.filter((s) => s.status === "published").length || 0} published
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sections Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation Sections</CardTitle>
          <CardDescription>
            {filteredSections?.length || 0} sections found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSections && filteredSections.length > 0 ? (
            <div className="space-y-4">
              {filteredSections.map((section) => (
                <Card key={section.id} className="hover-elevate" data-testid={`card-section-${section.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold" data-testid={`text-title-${section.id}`}>{section.title}</h3>
                          {getStatusBadge(section.status, section.id)}
                          {section.tags && section.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {section.tags.map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs" data-testid={`badge-tag-${section.id}-${idx}`}>
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1" data-testid={`text-version-${section.id}`}>
                            <FileText className="h-3 w-3" />
                            v{section.version}
                            {section.publishedVersion && ` (published: v${section.publishedVersion})`}
                          </span>
                          {section.creatorName && (
                            <span className="flex items-center gap-1" data-testid={`text-creator-${section.id}`}>
                              <User className="h-3 w-3" />
                              {section.creatorName}
                            </span>
                          )}
                          <span className="flex items-center gap-1" data-testid={`text-updated-${section.id}`}>
                            <Clock className="h-3 w-3" />
                            {new Date(section.updatedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-preview-${section.id}`}>
                          {section.content.substring(0, 200)}...
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSection(section)}
                          data-testid={`button-view-${section.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-edit-${section.id}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        {section.status === "draft" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePublishSection(section.id)}
                            disabled={publishMutation.isPending}
                            data-testid={`button-publish-${section.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Publish
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteSection(section.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${section.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No documentation sections found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search query" : "Create your first documentation section to get started"}
              </p>
              {!searchQuery && (
                <Button data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Section
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Section Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-view-section">
              {selectedSection?.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {selectedSection && getStatusBadge(selectedSection.status, "dialog")}
              <span data-testid="text-dialog-version">Version {selectedSection?.version}</span>
              {selectedSection?.tags && selectedSection.tags.length > 0 && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  {selectedSection.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" data-testid={`badge-dialog-tag-${idx}`}>
                      {tag}
                    </Badge>
                  ))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
              <TabsTrigger value="metadata" data-testid="tab-metadata">Metadata</TabsTrigger>
              <TabsTrigger value="comments" data-testid="tab-comments">
                <MessageCircle className="h-4 w-4 mr-2" />
                Comments ({comments?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <ScrollArea className="h-[60vh] w-full rounded-md border p-6">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedSection?.content || ""}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="metadata" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Section Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Slug</Label>
                    <p className="text-sm font-mono" data-testid="text-slug">{selectedSection?.slug}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div className="mt-1" data-testid="text-status">{selectedSection && getStatusBadge(selectedSection.status)}</div>
                  </div>
                  <div>
                    <Label>Version</Label>
                    <p className="text-sm font-medium" data-testid="text-version">v{selectedSection?.version}</p>
                  </div>
                  <div>
                    <Label>Published Version</Label>
                    <p className="text-sm font-medium" data-testid="text-published-version">
                      {selectedSection?.publishedVersion ? `v${selectedSection.publishedVersion}` : "Not published"}
                    </p>
                  </div>
                  <div>
                    <Label>Created By</Label>
                    <p className="text-sm" data-testid="text-created-by">{selectedSection?.creatorName || "Unknown"}</p>
                  </div>
                  <div>
                    <Label>Updated By</Label>
                    <p className="text-sm" data-testid="text-updated-by">{selectedSection?.updaterName || "Unknown"}</p>
                  </div>
                  <div>
                    <Label>Created At</Label>
                    <p className="text-sm" data-testid="text-created-at">
                      {selectedSection?.createdAt && new Date(selectedSection.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label>Updated At</Label>
                    <p className="text-sm" data-testid="text-updated-at">
                      {selectedSection?.updatedAt && new Date(selectedSection.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments" className="space-y-4">
              {/* New Comment Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Add Comment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Write your comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    data-testid="textarea-new-comment"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <Badge variant="outline" className="text-xs">
                      Section-level comment
                    </Badge>
                    <Button
                      onClick={() => createCommentMutation.mutate({ commentText: newCommentText })}
                      disabled={!newCommentText.trim() || createCommentMutation.isPending}
                      data-testid="button-add-comment"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Add Comment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Comments List */}
              <ScrollArea className="h-[50vh]">
                {comments && comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments
                      .filter((c) => !c.parentCommentId) // Root comments only
                      .map((comment) => (
                        <Card key={comment.id} className={comment.resolvedAt ? "opacity-60" : ""} data-testid={`card-comment-${comment.id}`}>
                          <CardContent className="p-4 space-y-3">
                            {/* Comment Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm" data-testid={`text-comment-author-${comment.id}`}>
                                    {comment.userName || "Unknown"}
                                  </span>
                                  <span className="text-xs text-muted-foreground" data-testid={`text-comment-time-${comment.id}`}>
                                    {new Date(comment.createdAt).toLocaleString()}
                                  </span>
                                  {comment.isInternal && (
                                    <Badge variant="secondary" className="text-xs" data-testid={`badge-internal-${comment.id}`}>
                                      Internal
                                    </Badge>
                                  )}
                                  {comment.resolvedAt && (
                                    <Badge variant="default" className="text-xs" data-testid={`badge-resolved-${comment.id}`}>
                                      <Check className="h-3 w-3 mr-1" />
                                      Resolved
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm mt-2" data-testid={`text-comment-text-${comment.id}`}>
                                  {comment.commentText}
                                </p>
                              </div>
                            </div>

                            {/* Comment Actions */}
                            <div className="flex items-center gap-2">
                              {!comment.resolvedAt && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReplyToCommentId(comment.id)}
                                    data-testid={`button-reply-${comment.id}`}
                                  >
                                    <Reply className="h-3 w-3 mr-1" />
                                    Reply
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => resolveCommentMutation.mutate(comment.id)}
                                    disabled={resolveCommentMutation.isPending}
                                    data-testid={`button-resolve-${comment.id}`}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Resolve
                                  </Button>
                                </>
                              )}
                            </div>

                            {/* Reply Form */}
                            {replyToCommentId === comment.id && (
                              <div className="mt-3 space-y-2 pl-6 border-l-2">
                                <Textarea
                                  placeholder="Write your reply..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  className="text-sm"
                                  data-testid={`textarea-reply-${comment.id}`}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      replyCommentMutation.mutate({
                                        parentCommentId: comment.id,
                                        commentText: replyText,
                                      })
                                    }
                                    disabled={!replyText.trim() || replyCommentMutation.isPending}
                                    data-testid={`button-send-reply-${comment.id}`}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    Send
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setReplyToCommentId(null);
                                      setReplyText("");
                                    }}
                                    data-testid={`button-cancel-reply-${comment.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Nested Replies */}
                            {comments.filter((c) => c.parentCommentId === comment.id).length > 0 && (
                              <div className="mt-3 space-y-3 pl-6 border-l-2">
                                {comments
                                  .filter((c) => c.parentCommentId === comment.id)
                                  .map((reply) => (
                                    <div key={reply.id} className="space-y-2" data-testid={`card-reply-${reply.id}`}>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm" data-testid={`text-reply-author-${reply.id}`}>
                                          {reply.userName || "Unknown"}
                                        </span>
                                        <span className="text-xs text-muted-foreground" data-testid={`text-reply-time-${reply.id}`}>
                                          {new Date(reply.createdAt).toLocaleString()}
                                        </span>
                                        {reply.isInternal && (
                                          <Badge variant="secondary" className="text-xs">
                                            Internal
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm" data-testid={`text-reply-text-${reply.id}`}>
                                        {reply.commentText}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No comments yet</h3>
                    <p className="text-muted-foreground">
                      Be the first to add a comment to this documentation section
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
