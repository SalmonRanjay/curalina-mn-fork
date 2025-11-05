import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getSessionId } from "@/lib/session";
import Navigation from "@/components/Navigation";
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

  // Fetch user's renders
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

  // Fetch user's orders
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
        return "bg-green-500";
      case "shipped":
        return "bg-blue-500";
      case "fulfilled":
        return "bg-purple-500";
      case "paid":
        return "bg-yellow-500";
      default:
        return "bg-stone-500";
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />
      <div className="h-28"></div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-4" data-testid="heading-dashboard">
            My Dashboard
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400">
            Manage your designs, orders, and account
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/quiz")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Start New Design</h3>
                <p className="text-stone-600 dark:text-stone-400 text-sm">
                  Take our 7-step quiz to create a new AI-powered room design
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/cart")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">View Cart</h3>
                <p className="text-stone-600 dark:text-stone-400 text-sm">
                  Check out your selected furniture items
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/styles")}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Explore Styles</h3>
                <p className="text-stone-600 dark:text-stone-400 text-sm">
                  Browse our curated interior design styles
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Designs Section */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold" data-testid="heading-my-designs">
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
              <p className="text-stone-600 dark:text-stone-400">Loading your designs...</p>
            </div>
          ) : completedRenders.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <Package className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Designs Yet</h3>
                <p className="text-stone-600 dark:text-stone-400 mb-6">
                  Take our quiz to generate your first AI-powered interior design
                </p>
                <Button
                  onClick={() => setLocation("/quiz")}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  data-testid="button-start-quiz"
                >
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
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                          Completed
                        </Badge>
                        <span className="text-xs text-stone-500">
                          {new Date(render.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                        {render.prompt}
                      </p>
                      {render.productSkus && render.productSkus.length > 0 && (
                        <p className="text-xs text-stone-500 mt-2">
                          {render.productSkus.length} products featured
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* My Orders Section */}
        <div>
          <h2 className="text-3xl font-bold mb-6" data-testid="heading-my-orders">
            My Orders
          </h2>

          {ordersLoading ? (
            <div className="text-center py-12">
              <p className="text-stone-600 dark:text-stone-400">Loading your orders...</p>
            </div>
          ) : recentOrders.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <ShoppingCart className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Orders Yet</h3>
                <p className="text-stone-600 dark:text-stone-400 mb-6">
                  Your order history will appear here once you make a purchase
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/quiz")}
                  data-testid="button-browse-products"
                >
                  Start Shopping
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order, index) => (
                <Card key={order.id} className="hover-elevate" data-testid={`order-card-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">Order #{order.id.slice(0, 8)}</h4>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-stone-600 dark:text-stone-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${(order.totalAmount / 100).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-view-order-${index}`}>
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
