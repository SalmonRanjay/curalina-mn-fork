
import { useState, ComponentType } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import GlobalLayout from "@/components/GlobalLayout";
import {
  ImageIcon,
  Heart,
  ShoppingBag,
  Package,
  Clock,
  Eye,
  Share2,
  Trash2,
  ExternalLink,
  Palette,
  TrendingUp,
  Star,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

interface DashboardAnalytics {
  totalRenders: number;
  savedDesigns: number;
  productViews: number;
  totalOrders: number;
}

interface Render {
  id: number;
  roomType: string;
  designStyle: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

interface SavedDesign {
  id: number;
  renderId: number;
  name: string | null;
  notes: string | null;
  createdAt: string;
  render: Render | null;
}

interface Order {
  id: number;
  status: string;
  totalAmount: string;
  createdAt: string;
  items: Array<{
    id: number;
    productName: string;
    quantity: number;
    unitPrice: string;
  }>;
}

interface ProductInteraction {
  id: number;
  interactionType: string;
  productId: string;
  productName: string;
  createdAt: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RenderCard({ render, onSave, isSaved }: { render: Render; onSave?: () => void; isSaved?: boolean }) {
  const [, setLocation] = useLocation();
  const imageUrl = render.thumbnailUrl || render.imageUrl;

  return (
    <Card className="overflow-hidden hover-elevate group">
      <div className="relative aspect-video bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${render.roomType} - ${render.designStyle}`}
            className="w-full h-full object-cover"
            data-testid={`img-render-${render.id}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/results?renderId=${render.id}`);
            }}
            data-testid={`button-view-render-${render.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {onSave && (
            <Button
              size="icon"
              variant={isSaved ? "default" : "secondary"}
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              data-testid={`button-save-render-${render.id}`}
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
            </Button>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="space-y-1">
          <h3 className="font-medium">{render.roomType}</h3>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {render.designStyle}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(render.createdAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SavedDesignCard({ 
  design, 
  onRemove 
}: { 
  design: SavedDesign;
  onRemove: () => void;
}) {
  const [, setLocation] = useLocation();
  const imageUrl = design.render?.thumbnailUrl || design.render?.imageUrl;

  return (
    <Card className="overflow-hidden hover-elevate group">
      <div className="relative aspect-video bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={design.name || "Saved design"}
            className="w-full h-full object-cover"
            data-testid={`img-saved-design-${design.id}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/results?renderId=${design.renderId}`);
            }}
            data-testid={`button-view-saved-${design.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              if (design.render?.imageUrl) {
                navigator.share?.({
                  title: design.name || "My Design",
                  url: design.render.imageUrl,
                });
              }
            }}
            data-testid={`button-share-saved-${design.id}`}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            data-testid={`button-remove-saved-${design.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="space-y-1">
          <h3 className="font-medium">{design.name || "Untitled Design"}</h3>
          {design.notes && (
            <p className="text-sm text-muted-foreground line-clamp-2">{design.notes}</p>
          )}
          <div className="flex items-center justify-between">
            {design.render && (
              <Badge variant="secondary" className="text-xs">
                {design.render.roomType}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {format(new Date(design.createdAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderCard({ order }: { order: Order }) {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium">Order #{order.id}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <div className="text-right">
            <Badge className={statusColors[order.status] || "bg-gray-100 text-gray-800"}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
            <p className="text-lg font-bold mt-1">${order.totalAmount}</p>
          </div>
        </div>
        <div className="space-y-2">
          {order.items?.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {item.productName} x{item.quantity}
              </span>
              <span>${item.unitPrice}</span>
            </div>
          ))}
          {order.items?.length > 3 && (
            <p className="text-sm text-muted-foreground">
              +{order.items.length - 3} more items
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ 
  icon: Icon,
  title, 
  description, 
  action 
}: { 
  icon: ComponentType<any>; 
  title: string; 
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action && (
        <Link href={action.href}>
          <Button className="mt-4 gap-2" data-testid="button-empty-action">
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export default function MyDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: analytics, isLoading: analyticsLoading } = useQuery<DashboardAnalytics>({
    queryKey: ["/api/user/dashboard/analytics"],
    enabled: isAuthenticated,
  });

  const { data: renders = [], isLoading: rendersLoading } = useQuery<Render[]>({
    queryKey: ["/api/user/dashboard/renders"],
    enabled: isAuthenticated,
  });

  const { data: savedDesigns = [], isLoading: savedLoading } = useQuery<SavedDesign[]>({
    queryKey: ["/api/user/dashboard/saved-designs"],
    enabled: isAuthenticated,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/user/dashboard/orders"],
    enabled: isAuthenticated,
  });

  const { data: interactions = [], isLoading: interactionsLoading } = useQuery<ProductInteraction[]>({
    queryKey: ["/api/user/dashboard/interactions"],
    enabled: isAuthenticated,
  });

  const saveDesignMutation = useMutation({
    mutationFn: async (renderId: number) => {
      await apiRequest("POST", "/api/user/dashboard/saved-designs", { renderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/dashboard/saved-designs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/dashboard/analytics"] });
      toast({ title: "Design saved", description: "Your design has been saved to favorites." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save design.", variant: "destructive" });
    },
  });

  const removeDesignMutation = useMutation({
    mutationFn: async (designId: number) => {
      await apiRequest("DELETE", `/api/user/dashboard/saved-designs/${designId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/dashboard/saved-designs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/dashboard/analytics"] });
      toast({ title: "Design removed", description: "Design removed from favorites." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove design.", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <GlobalLayout>
        <div className="container max-w-7xl mx-auto py-8 px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (!isAuthenticated) {
    setLocation("/register?redirectTo=/my-dashboard");
    return null;
  }

  const savedRenderIds = new Set(savedDesigns.map((d) => d.renderId));

  return (
    <GlobalLayout>
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 
            className="font-serif font-medium" 
            style={{ fontSize: "var(--font-size-3xl)" }}
            data-testid="heading-dashboard"
          >
            Welcome back, {user?.firstName || "Designer"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your designs, orders, and saved inspirations all in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Designs"
            value={analyticsLoading ? "..." : analytics?.totalRenders || 0}
            icon={ImageIcon as ComponentType<any>}
            description="AI-generated room designs"
          />
          <StatCard
            title="Saved Favorites"
            value={analyticsLoading ? "..." : analytics?.savedDesigns || 0}
            icon={Heart as ComponentType<any>}
            description="Your bookmarked designs"
          />
          <StatCard
            title="Products Viewed"
            value={analyticsLoading ? "..." : analytics?.productViews || 0}
            icon={Eye as ComponentType<any>}
            description="Items you've explored"
          />
          <StatCard
            title="Orders Placed"
            value={analyticsLoading ? "..." : analytics?.totalOrders || 0}
            icon={ShoppingBag as ComponentType<any>}
            description="Completed purchases"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="designs" data-testid="tab-designs">My Designs</TabsTrigger>
            <TabsTrigger value="saved" data-testid="tab-saved">Saved</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Recent Designs
                  </CardTitle>
                  <CardDescription>Your latest AI-generated room renders</CardDescription>
                </CardHeader>
                <CardContent>
                  {rendersLoading ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="aspect-video" />
                      ))}
                    </div>
                  ) : renders.length === 0 ? (
                    <EmptyState
                      icon={Palette as ComponentType<any>}
                      title="No designs yet"
                      description="Start your design journey by taking our style quiz."
                      action={{ label: "Take the Quiz", href: "/quiz" }}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {renders.slice(0, 2).map((render) => (
                        <RenderCard
                          key={render.id}
                          render={render}
                          isSaved={savedRenderIds.has(render.id)}
                          onSave={() => saveDesignMutation.mutate(render.id)}
                        />
                      ))}
                    </div>
                  )}
                  {renders.length > 2 && (
                    <Button
                      variant="ghost"
                      className="w-full mt-4"
                      onClick={() => setActiveTab("designs")}
                      data-testid="button-view-all-designs"
                    >
                      View all designs
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Recent Orders
                  </CardTitle>
                  <CardDescription>Track your furniture purchases</CardDescription>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : orders.length === 0 ? (
                    <EmptyState
                      icon={ShoppingBag as ComponentType<any>}
                      title="No orders yet"
                      description="Explore furniture from your designs and start shopping."
                    />
                  ) : (
                    <div className="space-y-4">
                      {orders.slice(0, 2).map((order) => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </div>
                  )}
                  {orders.length > 2 && (
                    <Button
                      variant="ghost"
                      className="w-full mt-4"
                      onClick={() => setActiveTab("orders")}
                      data-testid="button-view-all-orders"
                    >
                      View all orders
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {interactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Products you've interacted with</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {interactions.slice(0, 5).map((interaction) => (
                      <div
                        key={interaction.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            {interaction.interactionType === "view" && <Eye className="h-4 w-4" />}
                            {interaction.interactionType === "cart_add" && <ShoppingBag className="h-4 w-4" />}
                            {interaction.interactionType === "favorite" && <Heart className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{interaction.productName}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {interaction.interactionType.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(interaction.createdAt), "MMM d")}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="designs">
            {rendersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="aspect-video" />
                ))}
              </div>
            ) : renders.length === 0 ? (
              <Card className="p-8">
                <EmptyState
                  icon={Palette as ComponentType<any>}
                  title="No designs yet"
                  description="Start your interior design journey by taking our personalized style quiz."
                  action={{ label: "Take the Style Quiz", href: "/quiz" }}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renders.map((render) => (
                  <RenderCard
                    key={render.id}
                    render={render}
                    isSaved={savedRenderIds.has(render.id)}
                    onSave={() => saveDesignMutation.mutate(render.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved">
            {savedLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-video" />
                ))}
              </div>
            ) : savedDesigns.length === 0 ? (
              <Card className="p-8">
                <EmptyState
                  icon={Heart as ComponentType<any>}
                  title="No saved designs"
                  description="Save designs you love by clicking the heart icon on any render."
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedDesigns.map((design) => (
                  <SavedDesignCard
                    key={design.id}
                    design={design}
                    onRemove={() => removeDesignMutation.mutate(design.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders">
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <Card className="p-8">
                <EmptyState
                  icon={ShoppingBag as ComponentType<any>}
                  title="No orders yet"
                  description="When you purchase furniture from your designs, your orders will appear here."
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h3 className="font-medium text-lg mb-1">Ready for a new design?</h3>
                <p className="text-muted-foreground">
                  Take our style quiz to generate your next personalized room render.
                </p>
              </div>
              <Link href="/quiz">
                <Button size="lg" className="gap-2" data-testid="button-start-new-quiz">
                  <Star className="h-4 w-4" />
                  Start New Design
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </GlobalLayout>
  );
}
