import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, Database, Clock, Package, CheckCircle, XCircle, Loader2, Eye } from "lucide-react";

interface RenderAnalytics {
  renderId: string;
  sessionId: string;
  status: string;
  roomType: string;
  style: string;
  budget: number | null;
  productCount: number;
  eventCount: number;
  submittedAt: string | null;
  completedAt: string | null;
  selectionHash: string | null;
}

interface RenderDetail {
  renderId: string;
  sessionId: string;
  status: string;
  roomType: string;
  style: string;
  budget: number | null;
  width: number | null;
  height: number | null;
  productCount: number;
  eventCount: number;
  submittedAt: string | null;
  completedAt: string | null;
  selectionHash: string | null;
}

interface RenderProduct {
  id: string;
  sku: string;
  name: string;
  supplierName: string | null;
  categoryName: string | null;
  priceAtRender: number;
  visualDescription: string | null;
  visualDescriptionSource: string | null;
  placementTarget: string | null;
}

interface RenderEvent {
  id: string;
  renderId: string;
  eventType: string;
  message: string;
  createdAt: string;
}

export default function RendersStorage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("all");
  const [styleFilter, setStyleFilter] = useState<string>("all");
  const [limit, setLimit] = useState<number>(50);
  const [selectedRenderId, setSelectedRenderId] = useState<string | null>(null);

  // Fetch renders list
  const { data: renders, isLoading } = useQuery<RenderAnalytics[]>({
    queryKey: ["/api/admin/renders/analytics", { status: statusFilter, roomType: roomTypeFilter, style: styleFilter, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (roomTypeFilter !== "all") params.append("roomType", roomTypeFilter);
      if (styleFilter !== "all") params.append("style", styleFilter);
      params.append("limit", limit.toString());
      
      const response = await fetch(`/api/admin/renders/analytics?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch renders: ${response.status} ${text}`);
      }
      return response.json();
    },
  });

  // Fetch render detail
  const { data: renderDetail } = useQuery<RenderDetail>({
    queryKey: ["/api/admin/renders/analytics", selectedRenderId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/renders/analytics/${selectedRenderId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch render detail: ${response.status} ${text}`);
      }
      return response.json();
    },
    enabled: !!selectedRenderId,
  });

  // Fetch render products
  const { data: renderProducts } = useQuery<RenderProduct[]>({
    queryKey: ["/api/admin/renders", selectedRenderId, "products"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/renders/${selectedRenderId}/products`, {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch render products: ${response.status} ${text}`);
      }
      return response.json();
    },
    enabled: !!selectedRenderId,
  });

  // Fetch render events
  const { data: renderEvents } = useQuery<RenderEvent[]>({
    queryKey: ["/api/admin/renders", selectedRenderId, "events"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/renders/${selectedRenderId}/events`, {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch render events: ${response.status} ${text}`);
      }
      return response.json();
    },
    enabled: !!selectedRenderId,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      completed: { variant: "default", icon: CheckCircle },
      generating: { variant: "secondary", icon: Loader2 },
      failed: { variant: "destructive", icon: XCircle },
    };
    const config = variants[status] || { variant: "outline" as const, icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-renders-storage">
          <Database className="h-8 w-8" />
          Renders Storage
        </h1>
        <p className="text-muted-foreground mt-2">
          Analytics and insights for AI-generated room renders with complete lifecycle tracking
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter renders by status, room type, style, and limit results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="generating">Generating</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-type-filter">Room Type</Label>
              <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                <SelectTrigger id="room-type-filter" data-testid="select-room-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  <SelectItem value="Living Room">Living Room</SelectItem>
                  <SelectItem value="Bedroom">Bedroom</SelectItem>
                  <SelectItem value="Dining Room">Dining Room</SelectItem>
                  <SelectItem value="Home Office">Home Office</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style-filter">Style</Label>
              <Select value={styleFilter} onValueChange={setStyleFilter}>
                <SelectTrigger id="style-filter" data-testid="select-style-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Styles</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="contemporary">Contemporary</SelectItem>
                  <SelectItem value="traditional">Traditional</SelectItem>
                  <SelectItem value="mid-century modern">Mid-Century Modern</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit-input">Limit</Label>
              <Input
                id="limit-input"
                type="number"
                min="1"
                max="200"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                data-testid="input-limit"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Renders Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Renders ({renders?.length || 0})</CardTitle>
          <CardDescription>Click on a render to view detailed analytics</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : renders && renders.length > 0 ? (
            <div className="space-y-2">
              {renders.map((render) => (
                <div
                  key={render.renderId}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => setSelectedRenderId(render.renderId)}
                  data-testid={`render-row-${render.renderId}`}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {render.roomType} • {render.style}
                      </span>
                      {getStatusBadge(render.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Session: {render.sessionId.substring(0, 8)}... • {render.productCount} products • {render.eventCount} events
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {render.budget && <span>${render.budget.toLocaleString()}</span>}
                    {render.completedAt && (
                      <span>{new Date(render.completedAt).toLocaleDateString()}</span>
                    )}
                    <Button variant="ghost" size="icon" data-testid={`button-view-${render.renderId}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No renders found. Try adjusting your filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Render Detail Dialog */}
      <Dialog open={!!selectedRenderId} onOpenChange={(open) => !open && setSelectedRenderId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-render-detail">Render Analytics</DialogTitle>
            <DialogDescription>
              Detailed analytics for render {selectedRenderId?.substring(0, 8)}...
            </DialogDescription>
          </DialogHeader>

          {renderDetail && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="products" data-testid="tab-products">Products ({renderProducts?.length || 0})</TabsTrigger>
                <TabsTrigger value="events" data-testid="tab-events">Events ({renderEvents?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quiz Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Room Type</Label>
                      <p className="text-sm font-medium">{renderDetail.roomType}</p>
                    </div>
                    <div>
                      <Label>Style</Label>
                      <p className="text-sm font-medium">{renderDetail.style}</p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <div className="mt-1">{getStatusBadge(renderDetail.status)}</div>
                    </div>
                    <div>
                      <Label>Budget</Label>
                      <p className="text-sm font-medium">
                        {renderDetail.budget ? `$${renderDetail.budget.toLocaleString()}` : 'N/A'}
                      </p>
                    </div>
                    {renderDetail.width && renderDetail.height && (
                      <div>
                        <Label>Room Dimensions</Label>
                        <p className="text-sm font-medium">
                          {renderDetail.width}" × {renderDetail.height}"
                        </p>
                      </div>
                    )}
                    <div>
                      <Label>Selection Hash</Label>
                      <p className="text-sm font-mono">
                        {renderDetail.selectionHash ? renderDetail.selectionHash.substring(0, 16) + '...' : 'N/A'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">{renderDetail.productCount}</p>
                      <p className="text-xs text-muted-foreground">Products</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">{renderDetail.eventCount}</p>
                      <p className="text-xs text-muted-foreground">Events</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <Database className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">
                        {renderDetail.submittedAt && renderDetail.completedAt
                          ? `${Math.round((new Date(renderDetail.completedAt).getTime() - new Date(renderDetail.submittedAt).getTime()) / 1000)}s`
                          : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="products" className="space-y-2">
                {renderProducts && renderProducts.length > 0 ? (
                  renderProducts.map((product) => (
                    <Card key={product.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <p className="font-medium">{product.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>SKU: {product.sku}</span>
                              {product.supplierName && <span>• {product.supplierName}</span>}
                              {product.categoryName && <span>• {product.categoryName}</span>}
                            </div>
                            {product.visualDescriptionSource && (
                              <Badge variant="outline" className="text-xs">
                                {product.visualDescriptionSource}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${product.priceAtRender.toFixed(2)}</p>
                            {product.placementTarget && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {product.placementTarget}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-center py-4 text-muted-foreground">No products found</p>
                )}
              </TabsContent>

              <TabsContent value="events" className="space-y-2">
                {renderEvents && renderEvents.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    {renderEvents.map((event, index) => (
                      <div key={event.id} className="relative pl-10 pb-4" data-testid={`event-${event.eventType}`}>
                        <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={event.eventType === 'failed' ? 'destructive' : 'default'}>
                              {event.eventType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{event.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">No events found</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
