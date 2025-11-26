import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getSessionId } from "@/lib/session";
import GlobalLayout from "@/components/GlobalLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import type { Product } from "@shared/schema";

interface CartItemWithProduct {
  id: string;
  sessionId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  product: Product;
}

export default function Cart() {
  const [, setLocation] = useLocation();
  const sessionId = getSessionId();
  const { toast } = useToast();

  const { data: cartItems, isLoading } = useQuery<CartItemWithProduct[]>({
    queryKey: ["/api/cart", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const res = await fetch(`/api/cart/${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch cart");
      return res.json();
    },
    enabled: !!sessionId,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      return apiRequest("PATCH", `/api/cart/${itemId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/cart/${itemId}`);
    },
    onSuccess: () => {
      toast({
        title: "Removed from cart",
        description: "Item removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive",
      });
    },
  });

  const subtotal = cartItems?.reduce((sum, item) => {
    const price = parseFloat(item.product.price);
    const discount = parseFloat(item.product.discount || "0");
    const finalPrice = price * (1 - discount / 100);
    return sum + finalPrice * item.quantity;
  }, 0) || 0;

  const shipping = subtotal > 100 ? 0 : 9.99;
  const total = subtotal + shipping;

  if (!sessionId) {
    return (
      <GlobalLayout>
        <div className="flex-1 flex items-center justify-center p-4 py-24">
          <div className="text-center">
            <h1 
              className="font-cormorant text-foreground mb-4"
              style={{ fontSize: "var(--font-size-3xl)", fontWeight: 500 }}
            >
              No Session Found
            </h1>
            <p 
              className="text-muted-foreground mb-6 font-inter"
              style={{ fontSize: "var(--font-size-base)" }}
            >
              Please start by taking the design quiz.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-start-quiz">
              Start Quiz
            </Button>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (isLoading) {
    return (
      <GlobalLayout>
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="text-center">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground font-inter">Loading your cart...</p>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <GlobalLayout>
        <div className="flex-1 flex items-center justify-center p-4 py-24">
          <div className="text-center max-w-md">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h1 
              className="font-cormorant text-foreground mb-4"
              style={{ fontSize: "var(--font-size-3xl)", fontWeight: 500 }}
              data-testid="heading-empty-cart"
            >
              Your cart is empty
            </h1>
            <p 
              className="text-muted-foreground mb-6 font-inter"
              style={{ fontSize: "var(--font-size-base)" }}
            >
              Browse our AI-generated design results to find furniture that matches your style.
            </p>
            <Button onClick={() => setLocation("/results")} data-testid="button-browse-products">
              Browse Products
            </Button>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout>
      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/results")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 
            className="font-cormorant text-foreground"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 500 }}
            data-testid="heading-cart"
          >
            Shopping Cart
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6" data-testid={`card-cart-item-${item.id}`}>
                  <div className="flex gap-6">
                    <div className="w-32 h-32 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                      {item.product.images && item.product.images.length > 0 ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 
                        className="font-cormorant text-foreground mb-2"
                        style={{ fontSize: "var(--font-size-xl)", fontWeight: 500 }}
                        data-testid={`text-product-name-${item.id}`}
                      >
                        {item.product.name}
                      </h3>
                      <p 
                        className="text-muted-foreground mb-4 line-clamp-2 font-inter"
                        style={{ fontSize: "var(--font-size-sm)" }}
                      >
                        {item.product.description}
                      </p>

                      <div className="mb-4">
                        {item.product.discount && parseFloat(item.product.discount) > 0 ? (
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-success font-semibold font-inter"
                              style={{ fontSize: "var(--font-size-2xl)" }}
                            >
                              ${(parseFloat(item.product.price) * (1 - parseFloat(item.product.discount) / 100)).toFixed(2)}
                            </span>
                            <span 
                              className="text-muted-foreground line-through font-inter"
                              style={{ fontSize: "var(--font-size-sm)" }}
                            >
                              ${item.product.price}
                            </span>
                          </div>
                        ) : (
                          <span 
                            className="font-semibold text-foreground font-inter"
                            style={{ fontSize: "var(--font-size-2xl)" }}
                            data-testid={`text-price-${item.id}`}
                          >
                            ${item.product.price}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              if (item.quantity > 1) {
                                updateQuantityMutation.mutate({
                                  itemId: item.id,
                                  quantity: item.quantity - 1,
                                });
                              }
                            }}
                            disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                            data-testid={`button-decrease-${item.id}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span 
                            className="w-12 text-center font-semibold font-inter"
                            data-testid={`text-quantity-${item.id}`}
                          >
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              updateQuantityMutation.mutate({
                                itemId: item.id,
                                quantity: item.quantity + 1,
                              });
                            }}
                            disabled={updateQuantityMutation.isPending}
                            data-testid={`button-increase-${item.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItemMutation.mutate(item.id)}
                          disabled={removeItemMutation.isPending}
                          data-testid={`button-remove-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div>
            <Card className="p-6 sticky top-24">
              <h2 
                className="font-cormorant text-foreground mb-6"
                style={{ fontSize: "var(--font-size-2xl)", fontWeight: 500 }}
                data-testid="heading-order-summary"
              >
                Order Summary
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-inter">Subtotal</span>
                  <span className="font-semibold font-inter" data-testid="text-subtotal">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-inter">Shipping</span>
                  <span className="font-semibold font-inter" data-testid="text-shipping">
                    {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                  </span>
                </div>
                {shipping === 0 && (
                  <p 
                    className="text-xs text-success font-inter"
                  >
                    Free shipping on orders over $100
                  </p>
                )}
                <div className="border-t border-border pt-4 flex justify-between">
                  <span 
                    className="font-semibold text-foreground font-inter"
                    style={{ fontSize: "var(--font-size-xl)" }}
                  >
                    Total
                  </span>
                  <span 
                    className="font-semibold text-foreground font-inter"
                    style={{ fontSize: "var(--font-size-xl)" }}
                    data-testid="text-total"
                  >
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => setLocation("/checkout")}
                data-testid="button-checkout"
              >
                Proceed to Checkout
              </Button>

              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => setLocation("/results")}
                data-testid="button-continue-shopping"
              >
                Continue Shopping
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
}
