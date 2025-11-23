import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getSessionId } from "@/lib/session";
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

const encodeImageUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.toString();
  } catch {
    return url;
  }
};

export default function Cart() {
  const [, setLocation] = useLocation();
  const sessionId = getSessionId();
  const { toast } = useToast();

  // Fetch cart items
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

  // Update quantity mutation
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

  // Remove item mutation
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

  // Calculate totals
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">No Session Found</h1>
          <p className="text-stone-600 dark:text-stone-400 mb-6">
            Please start by taking the design quiz.
          </p>
          <Button onClick={() => setLocation("/")} data-testid="button-start-quiz">
            Start Quiz
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-stone-400 animate-pulse" />
          <p className="text-stone-600 dark:text-stone-400">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-stone-400" />
          <h1 className="text-3xl font-bold mb-4" data-testid="heading-empty-cart">
            Your cart is empty
          </h1>
          <p className="text-stone-600 dark:text-stone-400 mb-6">
            Browse our AI-generated design results to find furniture that matches your style.
          </p>
          <Button onClick={() => setLocation("/results")} data-testid="button-browse-products">
            Browse Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/results")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-4xl font-bold" data-testid="heading-cart">
            Shopping Cart
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
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
                    {/* Product Image */}
                    <div className="w-32 h-32 flex-shrink-0 bg-stone-100 dark:bg-stone-800 rounded-md overflow-hidden">
                      {item.product.images && item.product.images.length > 0 ? (
                        <img
                          src={encodeImageUrl(item.product.images[0])}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2" data-testid={`text-product-name-${item.id}`}>
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 line-clamp-2">
                        {item.product.description}
                      </p>

                      {/* Price */}
                      <div className="mb-4">
                        {item.product.discount && parseFloat(item.product.discount) > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                              ${(parseFloat(item.product.price) * (1 - parseFloat(item.product.discount) / 100)).toFixed(2)}
                            </span>
                            <span className="text-sm text-stone-500 line-through">
                              ${item.product.price}
                            </span>
                          </div>
                        ) : (
                          <span className="text-2xl font-bold" data-testid={`text-price-${item.id}`}>
                            ${item.product.price}
                          </span>
                        )}
                      </div>

                      {/* Quantity Controls */}
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
                          <span className="w-12 text-center font-semibold" data-testid={`text-quantity-${item.id}`}>
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

          {/* Order Summary */}
          <div>
            <Card className="p-6 sticky top-4">
              <h2 className="text-2xl font-bold mb-6" data-testid="heading-order-summary">
                Order Summary
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-stone-600 dark:text-stone-400">Subtotal</span>
                  <span className="font-semibold" data-testid="text-subtotal">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600 dark:text-stone-400">Shipping</span>
                  <span className="font-semibold" data-testid="text-shipping">
                    {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                  </span>
                </div>
                {shipping === 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Free shipping on orders over $100
                  </p>
                )}
                <div className="border-t pt-4 flex justify-between text-xl">
                  <span className="font-bold">Total</span>
                  <span className="font-bold" data-testid="text-total">
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
    </div>
  );
}
