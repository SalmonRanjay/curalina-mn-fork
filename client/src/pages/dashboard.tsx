import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getSessionId } from "@/lib/session";
import GlobalLayout from "@/components/GlobalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Eye, Package, Calendar, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

type Render = {
  id: string;
  sessionId: string;
  imageUrl: string;
  prompt: string;
  productSkus: string[];
  status: "generating" | "completed" | "failed";
  createdAt: string;
};

type Order = {
  id: string;
  sessionId: string;
  status: "pending" | "paid" | "fulfilled" | "shipped" | "delivered";
  totalAmount: number;
  customerEmail: string;
  customerName: string;
  createdAt: string;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const sessionId = getSessionId();

  const { data: renders, isLoading: rendersLoading } = useQuery<Render[]>({
    queryKey: ["/api/renders", sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/renders?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch renders");
      }
      return response.json();
    },
    enabled: !!sessionId,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders", sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/orders?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
    enabled: !!sessionId,
  });

  const completedRenders = renders?.filter((r) => r.status === "completed") || [];
  const recentOrders = orders?.slice(0, 5) || [];

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "delivered":
        return "bg-success";
      case "shipped":
        return "bg-primary";
      case "fulfilled":
        return "bg-accent";
      case "paid":
        return "bg-chart-4";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <GlobalLayout>
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-12">
        <div className="mb-12">
          <h1 
            className="font-cormorant text-foreground mb-4" 
            style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 500 }}
            data-testid="heading-dashboard"
          >
            My Dashboard
          </h1>
          <p 
            className="text-muted-foreground font-inter"
            style={{ fontSize: "var(--font-size-lg)" }}
          >
            Manage your designs, orders, and account
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/quiz")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-cormorant text-foreground mb-2" style={{ fontSize: "var(--font-size-xl)", fontWeight: 500 }}>
                  Start New Design
                </h3>
                <p className="text-muted-foreground font-inter" style={{ fontSize: "var(--font-size-sm)" }}>
                  Take our 7-step quiz to create a new AI-powered room design
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/cart")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-cormorant text-foreground mb-2" style={{ fontSize: "var(--font-size-xl)", fontWeight: 500 }}>
                  View Cart
                </h3>
                <p className="text-muted-foreground font-inter" style={{ fontSize: "var(--font-size-sm)" }}>
                  Check out your selected furniture items
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/styles")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-8 h-8 text-foreground" />
                </div>
                <h3 className="font-cormorant text-foreground mb-2" style={{ fontSize: "var(--font-size-xl)", fontWeight: 500 }}>
                  Explore Styles
                </h3>
                <p className="text-muted-foreground font-inter" style={{ fontSize: "var(--font-size-sm)" }}>
                  Browse our curated interior design styles
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 
              className="font-cormorant text-foreground" 
              style={{ fontSize: "var(--font-size-3xl)", fontWeight: 500 }}
              data-testid="heading-my-designs"
            >
              My Designs
            </h2>
            {completedRenders.length > 0 && (
              <Button variant="outline" onClick={() => setLocation("/quiz")} data-testid="button-create-design">
                Create New Design
              </Button>
            )}
          </div>

          {rendersLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-inter">Loading your designs...</p>
            </div>
          ) : completedRenders.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-cormorant text-foreground mb-2" style={{ fontSize: "var(--font-size-xl)", fontWeight: 500 }}>
                  No Designs Yet
                </h3>
                <p className="text-muted-foreground mb-6 font-inter" style={{ fontSize: "var(--font-size-base)" }}>
                  Take our quiz to generate your first AI-powered interior design
                </p>
                <Button onClick={() => setLocation("/quiz")} data-testid="button-start-quiz">
                  Take the Quiz
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedRenders.map((render, index) => (
                <motion.div
                  key={render.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover-elevate cursor-pointer overflow-hidden" onClick={() => setLocation("/results")}>
                    <img
                      src={render.imageUrl}
                      alt="AI Generated Design"
                      className="w-full h-64 object-cover"
                      data-testid={`img-design-${index}`}
                    />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-success/10 text-success">
                          Completed
                        </Badge>
                        <span className="text-xs text-muted-foreground font-inter">
                          {new Date(render.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 font-inter">
                        {render.productSkus?.length || 0} products selected
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 
              className="font-cormorant text-foreground" 
              style={{ fontSize: "var(--font-size-3xl)", fontWeight: 500 }}
              data-testid="heading-recent-orders"
            >
              Recent Orders
            </h2>
          </div>

          {ordersLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-inter">Loading your orders...</p>
            </div>
          ) : recentOrders.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-cormorant text-foreground mb-2" style={{ fontSize: "var(--font-size-xl)", fontWeight: 500 }}>
                  No Orders Yet
                </h3>
                <p className="text-muted-foreground font-inter" style={{ fontSize: "var(--font-size-base)" }}>
                  Complete a design and checkout to see your orders here
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(order.status)}`} />
                      <div>
                        <p className="font-semibold font-inter" style={{ fontSize: "var(--font-size-base)" }}>
                          Order #{order.id.slice(0, 8)}
                        </p>
                        <div className="flex items-center gap-2 text-muted-foreground font-inter" style={{ fontSize: "var(--font-size-sm)" }}>
                          <Calendar className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold font-inter" style={{ fontSize: "var(--font-size-lg)" }}>
                        ${order.totalAmount.toFixed(2)}
                      </p>
                      <Badge variant="outline" className="capitalize">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
}
