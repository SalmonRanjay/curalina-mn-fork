import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { getSessionId } from "@/lib/session";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, X, Eye, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
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
  // Track current image index for each product
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
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
    refetchInterval: (query) => {
      // Poll every 2 seconds if status is still 'generating'
      return query.state.data?.status === 'generating' ? 2000 : false;
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
      return apiRequest("POST", `/api/cart`, {
        sessionId,
        productId,
        quantity: 1,
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
        <div className="flex justify-between items-start mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1"
          >
            <h1 className="text-4xl font-bold mb-4" data-testid="heading-results">
              Your AI-Generated Design
            </h1>
            <p className="text-lg text-stone-600 dark:text-stone-400">
              Personalized just for you
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Button
              variant="outline"
              onClick={() => setLocation("/cart")}
              data-testid="button-view-cart"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              View Cart
            </Button>
          </motion.div>
        </div>

        {/* Main Content: Image + Products Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">
          {/* AI Render Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex-1 lg:flex-[2]"
          >
            <Card className="p-4 relative">
              <img
                src={render.imageUrl ?? ''}
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

          {/* Shop the Look Sidebar */}
          {products && products.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex-1 lg:max-w-md"
            >
              <Card className="p-6 h-full lg:max-h-[800px] flex flex-col">
                <h2 className="text-2xl font-bold mb-4" data-testid="heading-shop-look">
                  Shop the Look
                </h2>
                <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
                  {products.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                    >
                      <Card className="overflow-hidden hover-elevate" data-testid={`card-product-${product.id}`}>
                        <div className="aspect-square relative bg-stone-100 dark:bg-stone-800 group">
                          {product.images && product.images.length > 0 ? (
                            <>
                              <img
                                src={product.images[currentImageIndex[product.id] || 0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                data-testid={`img-product-${product.id}`}
                              />
                              {product.images.length > 1 && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentIdx = currentImageIndex[product.id] || 0;
                                      const newIdx = currentIdx === 0 ? product.images!.length - 1 : currentIdx - 1;
                                      setCurrentImageIndex(prev => ({ ...prev, [product.id]: newIdx }));
                                    }}
                                    data-testid={`button-prev-image-${product.id}`}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentIdx = currentImageIndex[product.id] || 0;
                                      const newIdx = (currentIdx + 1) % product.images!.length;
                                      setCurrentImageIndex(prev => ({ ...prev, [product.id]: newIdx }));
                                    }}
                                    data-testid={`button-next-image-${product.id}`}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                    {product.images.map((_, idx) => (
                                      <div
                                        key={idx}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                                          idx === (currentImageIndex[product.id] || 0)
                                            ? 'bg-white w-4'
                                            : 'bg-white/50'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </>
                              )}
                            </>
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
                              {product.discount && Number(product.discount) > 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                    ${(Number(product.price) * (1 - Number(product.discount) / 100)).toFixed(2)}
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
              </Card>
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-4">
          {Object.keys(swappedProducts).length > 0 && (
            <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-stone-700 dark:text-stone-300">
                You've swapped {Object.keys(swappedProducts).length} product(s). 
              </p>
              <Button
                onClick={async () => {
                  if (!render) return;
                  
                  // Build new product SKUs with swaps applied
                  const newProductSkus = (render.productSkus || []).map(sku => {
                    if (swappedProducts[sku]) {
                      const swappedProduct = allProducts?.find(p => p.id === swappedProducts[sku]);
                      return swappedProduct?.sku || sku;
                    }
                    return sku;
                  });
                  
                  try {
                    toast({
                      title: "Regenerating design",
                      description: "Creating a new render with your swapped products...",
                    });
                    
                    const response = await fetch("/api/render", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        quizResponseId: render.quizResponseId,
                        sessionId,
                        productSkus: newProductSkus,
                      }),
                    });
                    
                    if (!response.ok) throw new Error("Failed to regenerate");
                    
                    // Clear swaps and refetch
                    setSwappedProducts({});
                    queryClient.invalidateQueries({ queryKey: ["/api/render/latest", sessionId] });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to regenerate design",
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="button-regenerate-design"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate AI Design
              </Button>
            </div>
          )}
          
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
                    <div className="aspect-square relative bg-stone-100 dark:bg-stone-800 group">
                      {alt.images && alt.images.length > 0 ? (
                        <>
                          <img
                            src={alt.images[currentImageIndex[alt.id] || 0]}
                            alt={alt.name}
                            className="w-full h-full object-cover"
                          />
                          {alt.images.length > 1 && (
                            <>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentIdx = currentImageIndex[alt.id] || 0;
                                  const newIdx = currentIdx === 0 ? alt.images!.length - 1 : currentIdx - 1;
                                  setCurrentImageIndex(prev => ({ ...prev, [alt.id]: newIdx }));
                                }}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentIdx = currentImageIndex[alt.id] || 0;
                                  const newIdx = (currentIdx + 1) % alt.images!.length;
                                  setCurrentImageIndex(prev => ({ ...prev, [alt.id]: newIdx }));
                                }}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                {alt.images.map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                      idx === (currentImageIndex[alt.id] || 0)
                                        ? 'bg-white w-4'
                                        : 'bg-white/50'
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </>
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
            src={render.imageUrl ?? ''}
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
