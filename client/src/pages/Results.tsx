import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { getSessionId } from "@/lib/session";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, X, Eye, RefreshCw, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Render, Product, ProductMetadata, SelectionLedger, QuizResponse } from "@shared/schema";

/**
 * Helper function to reorder product images to prioritize Front View
 * Front View images should be displayed first in the Shop the Look carousel
 * Backend already handles URL encoding for S3 URLs
 */
function prioritizeFrontViewImage(images: string[] | null): string[] {
  if (!images || images.length === 0) return [];
  
  // Backend already handles URL encoding, use images as-is
  // Find the Front View image (case insensitive, checking for both encoded and unencoded variants)
  const frontViewIndex = images.findIndex(url => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('front%20view') ||
           lowerUrl.includes('front_view') ||
           lowerUrl.includes('front view') ||
           lowerUrl.includes('frontview') ||
           lowerUrl.includes('front-view');
  });
  
  // If Front View found, move it to the front
  if (frontViewIndex > 0) {
    const reordered = [...images];
    const frontView = reordered.splice(frontViewIndex, 1)[0];
    return [frontView, ...reordered];
  }
  
  // Return images in original order if Front View is already first or not found
  return images;
}

/**
 * Normalize visual description source labels to remove any legacy OpenAI references
 * Maps "OpenAI Vision" → "Legacy" for backwards compatibility
 */
function normalizeVisualDescriptionSource(source: string): string {
  // Map any legacy OpenAI Vision labels to Legacy
  if (source === "OpenAI Vision") return "Legacy";
  return source;
}

/**
 * Get visual description source badge styling based on priority
 * Front View (highest) → Gemini Vision → Legacy (lowest)
 */
function getVisualDescriptionBadgeVariant(source: string): "default" | "secondary" | "outline" {
  if (source === "Front View") return "default"; // Highest quality
  if (source === "Gemini Vision") return "secondary";
  return "outline"; // Legacy or None
}

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

  // Fetch latest Gemini render for this session (default)
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


  // Fetch products for this specific render (Shop the Look)
  const { data: renderProducts, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/render", render?.id, "products"],
    queryFn: async () => {
      if (!render?.id) throw new Error("No render ID");
      const res = await fetch(`/api/render/${render.id}/products`);
      if (!res.ok) throw new Error("Failed to fetch render products");
      return res.json();
    },
    enabled: !!render?.id,
  });

  // Fetch selection ledger for composition order (Task 7)
  const { data: selectionLedger } = useQuery<SelectionLedger>({
    queryKey: ["/api/render", render?.id, "ledger"],
    queryFn: async () => {
      if (!render?.id) throw new Error("No render ID");
      const res = await fetch(`/api/render/${render.id}/ledger`);
      if (!res.ok) {
        // Ledger may not exist for older renders - gracefully fall back
        if (res.status === 404) return null;
        throw new Error("Failed to fetch selection ledger");
      }
      return res.json();
    },
    enabled: !!render?.id,
  });

  // Fetch quiz response for comparison data
  const { data: quizResponse } = useQuery<QuizResponse>({
    queryKey: ["/api/quiz-response", render?.quizResponseId],
    queryFn: async () => {
      if (!render?.quizResponseId) throw new Error("No quiz response ID");
      const res = await fetch(`/api/quiz-response/${render.quizResponseId}`);
      if (!res.ok) throw new Error("Failed to fetch quiz response");
      return res.json();
    },
    enabled: !!render?.quizResponseId,
  });

  // Fetch swapped product details when needed
  const swappedProductIds = Object.values(swappedProducts).filter(Boolean);
  const { data: swappedProductDetails } = useQuery<Product[]>({
    queryKey: ["/api/products/by-ids", swappedProductIds],
    queryFn: async () => {
      if (swappedProductIds.length === 0) return [];
      // Fetch each swapped product individually and combine results
      const promises = swappedProductIds.map(id => 
        fetch(`/api/products/${id}`).then(res => res.ok ? res.json() : null)
      );
      const results = await Promise.all(promises);
      return results.filter(Boolean);
    },
    enabled: swappedProductIds.length > 0,
  });

  // Build products list from renderProducts, merging in swapped alternatives
  const products: Product[] = useMemo(() => {
    if (!renderProducts) return [];
    
    // Create a map of swapped product details for quick lookup
    const swappedMap = new Map<string, Product>();
    swappedProductDetails?.forEach(p => swappedMap.set(p.id, p));
    
    // Map products to handle swaps
    return renderProducts.map((product) => {
      // If this product's SKU has been swapped, use the replacement product
      const targetId = swappedProducts[product.sku] || null;
      
      if (targetId && targetId !== product.id) {
        // Try to find the swapped product from our fetched details
        const swappedProduct = swappedMap.get(targetId);
        if (swappedProduct) return swappedProduct;
        
        // Fallback: check if it's in the renderProducts
        const fallbackProduct = renderProducts.find(p => p.id === targetId);
        if (fallbackProduct) return fallbackProduct;
      }
      
      return product;
    });
  }, [renderProducts, swappedProducts, swappedProductDetails]);

  // Fetch alternative products for swap
  const { data: alternatives } = useQuery<Product[]>({
    queryKey: ["/api/products/alternatives", swapProductId],
    queryFn: async () => {
      if (!swapProductId) return [];
      const res = await fetch(`/api/products/alternatives/${swapProductId}`);
      if (!res.ok) throw new Error("Failed to fetch alternatives");
      return res.json();
    },
    enabled: !!swapProductId && !swapProductId.startsWith('placeholder-'),
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground" style={{ fontSize: 'var(--font-size-lg)' }}>Loading your design...</p>
        </div>
      </div>
    );
  }

  if (renderError || !render) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <h2 className="font-bold mb-4" style={{ fontSize: 'var(--font-size-2xl)' }}>No Design Found</h2>
          <p className="text-muted-foreground mb-6" style={{ fontSize: 'var(--font-size-base)' }}>
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="font-bold mb-2" style={{ fontSize: 'var(--font-size-2xl)' }} data-testid="text-generating">
            Generating Your Design...
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-base)' }}>
            Our AI is creating your personalized interior design
          </p>
        </div>
      </div>
    );
  }

  if (render.status === 'failed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <h2 className="font-bold text-destructive mb-4" style={{ fontSize: 'var(--font-size-2xl)' }}>
            Generation Failed
          </h2>
          <p className="text-muted-foreground mb-6" style={{ fontSize: 'var(--font-size-base)' }}>
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1"
          >
            <h1 className="font-bold mb-4" style={{ fontSize: 'var(--font-size-4xl)' }} data-testid="heading-results">
              Your AI-Generated Design
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-lg)' }}>
              Personalized just for you
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
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

        {/* AI Render and Products */}
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
                  className="absolute top-6 right-6 bg-card/90 backdrop-blur"
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
                <h2 className="font-bold mb-4" style={{ fontSize: 'var(--font-size-2xl)' }} data-testid="heading-shop-look">
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
                        <div className="aspect-square relative bg-muted group">
                          {(() => {
                            // Prioritize Front View image to show first
                            const prioritizedImages = prioritizeFrontViewImage(product.images);
                            return prioritizedImages && prioritizedImages.length > 0 ? (
                              <>
                                <img
                                  src={prioritizedImages[currentImageIndex[product.id] || 0]}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  data-testid={`img-product-${product.id}`}
                                />
                                {prioritizedImages.length > 1 && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIdx = currentImageIndex[product.id] || 0;
                                        const newIdx = currentIdx === 0 ? prioritizedImages.length - 1 : currentIdx - 1;
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
                                        const newIdx = (currentIdx + 1) % prioritizedImages.length;
                                        setCurrentImageIndex(prev => ({ ...prev, [product.id]: newIdx }));
                                      }}
                                      data-testid={`button-next-image-${product.id}`}
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </Button>
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                      {prioritizedImages.map((_, idx) => (
                                        <div
                                          key={idx}
                                          className={`w-1.5 h-1.5 rounded-full transition-all ${
                                            idx === (currentImageIndex[product.id] || 0)
                                              ? 'bg-accent-foreground w-4'
                                              : 'bg-accent-foreground/50'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </>
                                )}
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                No image
                              </div>
                            );
                          })()}
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }} data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </h3>
                            {(() => {
                              const metadata = render?.productMetadata as ProductMetadata | null | undefined;
                              if (metadata && metadata[product.sku]) {
                                const normalizedSource = normalizeVisualDescriptionSource(metadata[product.sku].visualDescriptionSource);
                                return (
                                  <Badge 
                                    variant={getVisualDescriptionBadgeVariant(normalizedSource)}
                                    className="shrink-0"
                                    style={{ fontSize: 'var(--font-size-xs)' }}
                                    data-testid={`badge-visual-source-${product.id}`}
                                  >
                                    {normalizedSource}
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <p className="text-muted-foreground mb-3 line-clamp-2" style={{ fontSize: 'var(--font-size-sm)' }}>
                            {product.description}
                          </p>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              {product.id.startsWith('placeholder-') ? (
                                <span className="font-bold text-muted-foreground" style={{ fontSize: 'var(--font-size-xl)' }} data-testid={`text-price-${product.id}`}>
                                  —
                                </span>
                              ) : product.discount && Number(product.discount) > 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-accent" style={{ fontSize: 'var(--font-size-xl)' }}>
                                    ${(Number(product.price) * (1 - Number(product.discount) / 100)).toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground line-through" style={{ fontSize: 'var(--font-size-sm)' }}>
                                    ${product.price}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-bold" style={{ fontSize: 'var(--font-size-xl)' }} data-testid={`text-price-${product.id}`}>
                                  ${product.price}
                                </span>
                              )}
                            </div>
                            <Button 
                              size="icon" 
                              onClick={() => addToCartMutation.mutate(product.id)}
                              disabled={addToCartMutation.isPending || product.id.startsWith('placeholder-')}
                              data-testid={`button-add-to-cart-${product.id}`}
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          </div>
                          {!product.id.startsWith('placeholder-') && (
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
                          )}
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
            <div className="flex items-center gap-4 p-4 bg-accent/10 rounded-lg">
              <p className="text-foreground" style={{ fontSize: 'var(--font-size-sm)' }}>
                You've swapped {Object.keys(swappedProducts).length} product(s). 
              </p>
              <Button
                onClick={async () => {
                  if (!render) return;
                  
                  // Build new product SKUs with swaps applied
                  const newProductSkus = (render.productSkus || []).map(sku => {
                    if (swappedProducts[sku]) {
                      const swappedProduct = renderProducts?.find((p: Product) => p.id === swappedProducts[sku]);
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
          
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setLocation("/quiz")}
              data-testid="button-new-design"
            >
              Create New Design
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                // Save render data to localStorage for comparison page
                if (render && quizResponse) {
                  // Get room image from quiz response floorplan
                  const roomImageUrl = quizResponse.floorplanUrl || "";
                  localStorage.setItem("roomImageUrl", roomImageUrl);
                  localStorage.setItem("selectedProductSkus", JSON.stringify(render.productSkus || []));
                  localStorage.setItem("roomType", quizResponse.roomType || "");
                  localStorage.setItem("style", quizResponse.styles?.[0] || "modern");
                }
                setLocation("/comparison");
              }}
              data-testid="button-compare-ai"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Compare AI Services
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
          className="fixed inset-0 bg-foreground/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSwapProductId(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold" style={{ fontSize: 'var(--font-size-2xl)' }} data-testid="heading-swap-modal">
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
                      if (render && swapProductId && renderProducts) {
                        const currentProduct = renderProducts.find((p: Product) => p.id === swapProductId);
                        
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
                    <div className="aspect-square relative bg-muted group">
                      {(() => {
                        const altImages = alt.images || [];
                        return altImages.length > 0 ? (
                          <>
                            <img
                              src={altImages[currentImageIndex[alt.id] || 0]}
                              alt={alt.name}
                              className="w-full h-full object-cover"
                            />
                            {altImages.length > 1 && (
                            <>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentIdx = currentImageIndex[alt.id] || 0;
                                  const newIdx = currentIdx === 0 ? altImages.length - 1 : currentIdx - 1;
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
                                  const newIdx = (currentIdx + 1) % altImages.length;
                                  setCurrentImageIndex(prev => ({ ...prev, [alt.id]: newIdx }));
                                }}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                {altImages.map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                      idx === (currentImageIndex[alt.id] || 0)
                                        ? 'bg-accent-foreground w-4'
                                        : 'bg-accent-foreground/50'
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            No image
                          </div>
                        );
                      })()}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-1" style={{ fontSize: 'var(--font-size-base)' }}>{alt.name}</h3>
                      <p className="text-muted-foreground mb-2 line-clamp-2" style={{ fontSize: 'var(--font-size-sm)' }}>
                        {alt.description}
                      </p>
                      <div className="font-bold text-accent" style={{ fontSize: 'var(--font-size-lg)' }}>
                        ${alt.price}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground" style={{ fontSize: 'var(--font-size-base)' }}>
                No alternative products available
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Full Image Modal */}
      {showFullImage && (
        <div
          className="fixed inset-0 bg-foreground/80 z-50 flex items-center justify-center p-4"
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
