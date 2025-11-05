import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { getSessionId } from "@/lib/session";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, X, Eye, RefreshCw } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Render, Product } from "@shared/schema";

export default function Results() {
  const [, setLocation] = useLocation();
  const sessionId = getSessionId();
  const [showFullImage, setShowFullImage] = useState(false);
  const [swapProductId, setSwapProductId] = useState<string | null>(null);
  // Map original SKU → replacement product ID
  const [swappedProducts, setSwappedProducts] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Fetch latest render for this session
  const { data: render, isLoading: renderLoading, error: renderError } = useQuery<Render>({
    queryKey: ["/api/render/latest", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/render/latest?sessionId=${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch render");
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: (data) => {
      // Poll every 2 seconds if status is still 'generating'
      return data?.status === 'generating' ? 2000 : false;
    },
  });

  // Fetch all products
  const { data: allProducts, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  // Build ordered products list based on render.productSkus with swaps applied
  const products: Product[] = (render?.productSkus || []).map((sku) => {
    // If this SKU has been swapped, use the replacement product ID
    const targetId = swappedProducts[sku] || null;
    
    if (targetId) {
      // Find the swapped product by ID
      const swappedProduct = allProducts?.find(p => p.id === targetId);
      if (swappedProduct) return swappedProduct;
    }
    
    // Otherwise, find the original product by SKU
    const originalProduct = allProducts?.find(p => p.sku === sku);
    return originalProduct;
  }).filter(Boolean) as Product[];

  // Fetch alternative products for swap
  const { data: alternatives } = useQuery<Product[]>({
    queryKey: ["/api/products/alternatives", swapProductId],
    queryFn: async () => {
      if (!swapProductId) return [];
      const res = await fetch(`/api/products/alternatives/${swapProductId}`);
      if (!res.ok) throw new Error("Failed to fetch alternatives");
      return res.json();
    },
    enabled: !!swapProductId,
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest(`/api/cart`, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          productId,
          quantity: 1,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Added to cart",
        description: "Product added to your cart successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add product to cart",
        variant: "destructive",
      });
    },
  });

  // Redirect if no session
  useEffect(() => {
    if (!sessionId) {
      setLocation("/");
    }
  }, [sessionId, setLocation]);

  if (!sessionId) {
    return null;
  }

  if (renderLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-stone-700 dark:text-stone-300">Loading your design...</p>
        </div>
      </div>
    );
  }

  if (renderError || !render) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">No Design Found</h2>
          <p className="text-stone-600 dark:text-stone-400 mb-6">
            We couldn't find your design. Please start a new quiz.
          </p>
          <Button onClick={() => setLocation("/quiz")} data-testid="button-start-quiz">
            Start New Quiz
          </Button>
        </Card>
      </div>
    );
  }

  if (render.status === 'generating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-2" data-testid="text-generating">
            Generating Your Design...
          </h2>
          <p className="text-stone-600 dark:text-stone-400">
            Our AI is creating your personalized interior design
          </p>
        </div>
      </div>
    );
  }

  if (render.status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            Generation Failed
          </h2>
          <p className="text-stone-600 dark:text-stone-400 mb-6">
            {render.errorMessage || "Something went wrong while generating your design."}
          </p>
          <Button onClick={() => setLocation("/quiz")} data-testid="button-retry-quiz">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4" data-testid="heading-results">
            Your AI-Generated Design
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            Personalized just for you
          </p>
        </motion.div>

        {/* AI Render Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <Card className="p-4 relative">
            <img
              src={render.imageUrl}
              alt="AI Generated Interior Design"
              className="w-full h-auto rounded-lg cursor-pointer"
              onClick={() => setShowFullImage(true)}
              data-testid="img-render"
            />
            <Button
              variant="outline"
              size="icon"
              className="absolute top-6 right-6 bg-white/90 dark:bg-black/90 backdrop-blur"
              onClick={() => setShowFullImage(true)}
              data-testid="button-expand-image"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </Card>
        </motion.div>

        {/* Shop the Look Section */}
        {products && products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-3xl font-bold mb-6" data-testid="heading-shop-look">
              Shop the Look
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <Card className="overflow-hidden hover-elevate" data-testid={`card-product-${product.id}`}>
                    <div className="aspect-square relative bg-stone-100 dark:bg-stone-800">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          data-testid={`img-product-${product.id}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1" data-testid={`text-product-name-${product.id}`}>
                        {product.name}
                      </h3>
                      <p className="text-sm text-stone-600 dark:text-stone-400 mb-3 line-clamp-2">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          {product.discount ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                ${(product.price * (1 - product.discount / 100)).toFixed(2)}
                              </span>
                              <span className="text-sm text-stone-500 line-through">
                                ${product.price}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xl font-bold" data-testid={`text-price-${product.id}`}>
                              ${product.price}
                            </span>
                          )}
                        </div>
                        <Button 
                          size="icon" 
                          onClick={() => addToCartMutation.mutate(product.id)}
                          disabled={addToCartMutation.isPending}
                          data-testid={`button-add-to-cart-${product.id}`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setSwapProductId(product.id)}
                        data-testid={`button-swap-${product.id}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Swap Product
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/quiz")}
            data-testid="button-new-design"
          >
            Create New Design
          </Button>
          <Button
            onClick={() => setLocation("/cart")}
            data-testid="button-view-cart"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            View Cart
          </Button>
        </div>
      </div>

      {/* Swap Product Modal */}
      {swapProductId && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setSwapProductId(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-stone-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold" data-testid="heading-swap-modal">
                Swap Product
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSwapProductId(null)}
                data-testid="button-close-swap"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {alternatives && alternatives.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alternatives.map((alt) => (
                  <Card 
                    key={alt.id} 
                    className="overflow-hidden hover-elevate cursor-pointer"
                    onClick={() => {
                      // Swap the product by mapping original SKU to new product ID
                      if (render && swapProductId && allProducts) {
                        const currentProduct = allProducts.find(p => p.id === swapProductId);
                        
                        if (currentProduct) {
                          // Find the original SKU this product is replacing
                          let originalSku = currentProduct.sku;
                          
                          // Check if this product was already a swap - if so, find the ORIGINAL sku
                          for (const [sku, productId] of Object.entries(swappedProducts)) {
                            if (productId === swapProductId) {
                              originalSku = sku;
                              break;
                            }
                          }
                          
                          // Update swapped products map (original SKU -> new product ID)
                          setSwappedProducts(prev => ({
                            ...prev,
                            [originalSku]: alt.id
                          }));
                          
                          toast({
                            title: "Product swapped",
                            description: `Replaced ${currentProduct.name} with ${alt.name}`,
                          });
                          setSwapProductId(null);
                        }
                      }
                    }}
                    data-testid={`card-alternative-${alt.id}`}
                  >
                    <div className="aspect-square relative bg-stone-100 dark:bg-stone-800">
                      {alt.images && alt.images.length > 0 ? (
                        <img
                          src={alt.images[0]}
                          alt={alt.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-1">{alt.name}</h3>
                      <p className="text-sm text-stone-600 dark:text-stone-400 mb-2 line-clamp-2">
                        {alt.description}
                      </p>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${alt.price}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-stone-500">
                No alternative products available
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Full Image Modal */}
      {showFullImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 right-4"
            onClick={() => setShowFullImage(false)}
            data-testid="button-close-modal"
          >
            <X className="w-4 h-4" />
          </Button>
          <img
            src={render.imageUrl}
            alt="AI Generated Interior Design"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
            data-testid="img-fullscreen"
          />
        </div>
      )}
    </div>
  );
}
