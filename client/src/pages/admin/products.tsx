import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Edit, Trash2, Plus, Eye, Search, Filter, X, Sparkles, Loader2, CheckCircle2, XCircle, AlertCircle, Scan, ScanText, Wrench, CircleX } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertProductSchema, type Product, type Category, type Supplier, type InsertProduct } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Extend the schema for form handling with comma-separated strings
const productFormSchema = insertProductSchema.extend({
  price: z.string().min(1, "Price is required"),
  tradePrice: z.string().optional(),
  discount: z.string().optional(),
  inventory: z.string().optional(),
  leadTime: z.string().optional(),
  roomType: z.string().optional(),
  designStyle: z.string().optional(),
  keyFeatures: z.string().optional(),
  storageSolutions: z.string().optional(),
  styleTags: z.string().optional(),
  colors: z.string().optional(),
  materials: z.string().optional(),
  tags: z.string().optional(),
  dimensionsWidth: z.string().optional(),
  dimensionsDepth: z.string().optional(),
  dimensionsHeight: z.string().optional(),
  dimensionsArmWidth: z.string().optional(),
  dimensionsArmDepth: z.string().optional(),
  dimensionsSeatWidth: z.string().optional(),
  dimensionsSeatDepth: z.string().optional(),
  weight: z.string().optional(),
  seating: z.string().optional(),
  assembly: z.string().optional(),
  deliveryOptions: z.string().optional(),
  deliveryLocation: z.string().optional(),
  deliveryPolicy: z.string().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function AdminProducts() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<{ id: string; name: string } | null>(null);
  const [removeImagesProduct, setRemoveImagesProduct] = useState<{ id: string; name: string } | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: { current: number; total: number } }>({});
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [imageFilter, setImageFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [analysisFilter, setAnalysisFilter] = useState<string>("all");
  const [imageHealthFilter, setImageHealthFilter] = useState<string>("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [analyzeAllProducts, setAnalyzeAllProducts] = useState(false);
  const [analyzingProductId, setAnalyzingProductId] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
  });

  // Visual Analysis Jobs queries
  const { data: activeAnalysisJobs, refetch: refetchAnalysisJobs } = useQuery<any[]>({
    queryKey: ["/api/admin/visual-analysis/active"],
    refetchInterval: (query) => {
      // Poll while there are active jobs
      const hasActiveJobs = query.state.data?.some(
        (job: any) => job.status === "pending" || job.status === "processing"
      );
      return hasActiveJobs ? 3000 : false; // Poll every 3 seconds if jobs are active
    },
  });

  // Count products that need Front View analysis
  // Includes: named Front View images, single-image products, and missing Front View data
  const frontViewProductCount = useMemo(() => {
    if (!products) return 0;
    return products.filter(product => {
      if (!product.images || product.images.length === 0) return false;
      
      // Case 1: Has a named Front View image
      const hasNamedFrontView = product.images.some(imageUrl => {
        const lowerUrl = imageUrl.toLowerCase();
        return lowerUrl.includes('front-view') || 
               lowerUrl.includes('front_view') || 
               lowerUrl.includes('frontview');
      });
      
      // Case 2: Has exactly one image (should be treated as Front View)
      const hasSingleImage = product.images.length === 1;
      
      // Case 3: Missing Front View analysis data
      const missingFrontViewData = !product.visualDescriptionFrontView || 
                                    product.visualDescriptionFrontView.trim().length === 0;
      
      // Include if: (has named front view OR single image) AND missing data
      // OR just has single image (needs re-analysis with new logic)
      return (hasNamedFrontView || hasSingleImage) && (missingFrontViewData || hasSingleImage);
    }).length;
  }, [products]);

  const addForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      categoryId: "",
      supplierId: "",
      price: "",
      tradePrice: "",
      discount: "0",
      availability: "in_stock",
      inventory: "",
      leadTime: "",
      slug: "",
      roomType: "",
      designStyle: "",
      keyFeatures: "",
      storageSolutions: "",
      styleTags: "",
      colors: "",
      materials: "",
      tags: "",
      dimensionsWidth: "",
      dimensionsDepth: "",
      dimensionsHeight: "",
      dimensionsArmWidth: "",
      dimensionsArmDepth: "",
      dimensionsSeatWidth: "",
      dimensionsSeatDepth: "",
      weight: "",
      seating: "",
      assembly: "",
      deliveryOptions: "",
      deliveryLocation: "",
      deliveryPolicy: "",
    },
  });

  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
  });

  const transformFormData = (data: ProductFormData): any => {
    // Build dimensions object if any dimension fields are provided
    const dimensions: any = {};
    if (data.dimensionsWidth) dimensions.w = parseFloat(data.dimensionsWidth);
    if (data.dimensionsDepth) dimensions.d = parseFloat(data.dimensionsDepth);
    if (data.dimensionsHeight) dimensions.h = parseFloat(data.dimensionsHeight);
    if (data.dimensionsArmWidth) dimensions.armWidth = parseFloat(data.dimensionsArmWidth);
    if (data.dimensionsArmDepth) dimensions.armDepth = parseFloat(data.dimensionsArmDepth);
    if (data.dimensionsSeatWidth) dimensions.seatWidth = parseFloat(data.dimensionsSeatWidth);
    if (data.dimensionsSeatDepth) dimensions.seatDepth = parseFloat(data.dimensionsSeatDepth);
    if (Object.keys(dimensions).length > 0) {
      dimensions.unit = "inches";
    }
    
    // Build shipping object if any delivery fields are provided
    const shipping: any = {};
    if (data.deliveryOptions) shipping.deliveryOptions = data.deliveryOptions;
    if (data.deliveryLocation) shipping.deliveryLocation = data.deliveryLocation;
    if (data.deliveryPolicy) shipping.deliveryPolicy = data.deliveryPolicy;
    
    return {
      sku: data.sku,
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      supplierId: data.supplierId,
      price: parseFloat(data.price),
      tradePrice: data.tradePrice ? parseFloat(data.tradePrice) : undefined,
      discount: data.discount ? parseFloat(data.discount) : 0,
      availability: data.availability,
      inventory: data.inventory ? parseInt(data.inventory) : undefined,
      leadTime: data.leadTime ? parseInt(data.leadTime) : undefined,
      slug: data.slug,
      roomType: data.roomType ? data.roomType.split(",").map((s) => s.trim()).filter(Boolean) : [],
      designStyle: data.designStyle ? data.designStyle.split(",").map((s) => s.trim()).filter(Boolean) : [],
      keyFeatures: data.keyFeatures ? data.keyFeatures.split(",").map((s) => s.trim()).filter(Boolean) : [],
      storageSolutions: data.storageSolutions || undefined,
      styleTags: data.styleTags ? data.styleTags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      colors: data.colors ? data.colors.split(",").map((c) => c.trim()).filter(Boolean) : [],
      materials: data.materials ? data.materials.split(",").map((m) => m.trim()).filter(Boolean) : [],
      tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      dimensions: Object.keys(dimensions).length > 0 ? dimensions : undefined,
      weight: data.weight || undefined,
      seating: data.seating || undefined,
      assembly: data.assembly || undefined,
      shipping: Object.keys(shipping).length > 0 ? shipping : undefined,
    };
  };

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = transformFormData(data);
      return apiRequest("/api/admin/products", "POST", payload);
    },
    onSuccess: () => {
      toast({
        title: "Product created",
        description: "Product created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setIsAddDialogOpen(false);
      addForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      const payload = transformFormData(data);
      return apiRequest(`/api/admin/products/${id}`, "PATCH", payload);
    },
    onSuccess: () => {
      toast({
        title: "Product updated",
        description: "Product updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/products/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Product deleted",
        description: "Product deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setDeleteProduct(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete product",
        description: error.message,
        variant: "destructive",
      });
      setDeleteProduct(null);
    },
  });

  // Multi-angle analysis mutation for single product
  const multiAngleAnalysisMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest(`/api/admin/products/${productId}/analyze-multi-angle`, "POST");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Multi-angle analysis complete",
        description: `Successfully analyzed product from multiple angles`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setAnalyzingProductId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
      setAnalyzingProductId(null);
    },
  });

  // Batch multi-angle analysis mutation
  const batchMultiAngleMutation = useMutation({
    mutationFn: async (limit: number = 10) => {
      return apiRequest(`/api/admin/products/analyze-batch`, "POST", { limit });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Batch analysis complete",
        description: `Analyzed ${data.analyzed.length} products`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setBatchAnalyzing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Batch analysis failed",
        description: error.message,
        variant: "destructive",
      });
      setBatchAnalyzing(false);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      // Step 1: Get presigned URL from server (FAST - just metadata exchange)
      // apiRequest throws on error, so no need to check .ok
      const presignedResponse = await apiRequest("POST", `/api/admin/products/${productId}/presigned-upload-url`, {
        filename: file.name,
        contentType: file.type,
      });

      const presignedData = await presignedResponse.json();

      // Check if duplicate
      if (presignedData.duplicate) {
        return { 
          skipped: true, 
          filename: file.name,
          message: presignedData.message 
        };
      }

      const { url, fields, publicUrl } = presignedData;

      // Step 2: Upload directly to S3 (FAST - no server bottleneck)
      const formData = new FormData();
      
      // Add presigned fields first
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      
      // Add file last
      formData.append("file", file);

      const uploadResponse = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("S3 upload failed");
      }

      // Step 3: Confirm upload with server to update product record
      // apiRequest throws on error, so no need to check .ok
      const confirmResponse = await apiRequest("POST", `/api/admin/products/${productId}/confirm-upload`, {
        imageUrl: publicUrl,
      });

      return { skipped: false, ...(await confirmResponse.json()) };
    },
    onSuccess: (data: any) => {
      if (data.skipped) {
        toast({
          title: "Image skipped",
          description: `"${data.filename}" already exists for this product`,
        });
      } else {
        toast({
          title: "Image uploaded",
          description: "Product image uploaded successfully via direct S3 upload",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setUploadingFor(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingFor(null);
    },
  });

  // Gemini-only analysis (front view + combined)
  const analyzeWithGeminiMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/admin/products/analyze-with-gemini", "POST");
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Gemini analysis started",
        description: `Analyzing ${data.totalProducts} products. Check server logs for progress.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start Gemini analysis",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // New job-based visual analysis mutation
  const startVisualAnalysisMutation = useMutation({
    mutationFn: async (params: { productIds?: string[]; onlyMissingDescriptions?: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/visual-analysis/start", params);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Visual analysis started",
        description: `Job started for ${data.message}`,
      });
      refetchAnalysisJobs();
      setSelectedProductIds([]);
      setAnalyzeAllProducts(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start visual analysis",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reanalyzeFrontViewsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/visual-analysis/reanalyze-front-views");
      return response.json();
    },
    onSuccess: (data: any) => {
      const breakdown = data.breakdown || {};
      const details = [
        breakdown.namedFrontView > 0 ? `${breakdown.namedFrontView} named Front View` : null,
        breakdown.singleImage > 0 ? `${breakdown.singleImage} single-image` : null,
        breakdown.missingData > 0 ? `${breakdown.missingData} missing data` : null,
      ].filter(Boolean).join(', ');
      
      toast({
        title: "Front View re-analysis started",
        description: `Analyzing ${data.totalProducts} products: ${details || 'checking all criteria'}`,
      });
      refetchAnalysisJobs();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start Front View re-analysis",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateDescriptionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/products/generate-descriptions", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Description generation started",
        description: data.message || `Generating descriptions for ${data.totalProducts} products. Check server logs for progress.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate descriptions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate all files are images
    const invalidFiles = Array.from(files).filter(f => !f.type.startsWith("image/"));
    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid files",
        description: `${invalidFiles.length} file(s) are not images`,
        variant: "destructive",
      });
      return;
    }

    setUploadingFor(productId);
    setUploadProgress({ [productId]: { current: 0, total: files.length } });

    // Upload files concurrently
    const uploadPromises = Array.from(files).map(async (file, index) => {
      try {
        await uploadMutation.mutateAsync({ productId, file });
        setUploadProgress(prev => ({
          ...prev,
          [productId]: { current: index + 1, total: files.length }
        }));
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    });

    await Promise.all(uploadPromises);
    
    setUploadingFor(null);
    setUploadProgress({});
    toast({
      title: "Upload complete",
      description: `${files.length} image(s) uploaded successfully`,
    });
  };

  const onAddSubmit = (data: ProductFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    const dims = product.dimensions as any;
    const ship = product.shipping as any;
    editForm.reset({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      price: product.price?.toString() || "",
      tradePrice: (product as any).tradePrice?.toString() || "",
      discount: product.discount?.toString() || "0",
      availability: product.availability || "in_stock",
      inventory: (product as any).inventory?.toString() || "",
      leadTime: (product as any).leadTime?.toString() || "",
      slug: product.slug,
      roomType: (product as any).roomType?.join(", ") || "",
      designStyle: (product as any).designStyle?.join(", ") || "",
      keyFeatures: (product as any).keyFeatures?.join(", ") || "",
      storageSolutions: (product as any).storageSolutions || "",
      styleTags: product.styleTags?.join(", ") || "",
      colors: product.colors?.join(", ") || "",
      materials: product.materials?.join(", ") || "",
      tags: (product as any).tags?.join(", ") || "",
      dimensionsWidth: dims?.w?.toString() || "",
      dimensionsDepth: dims?.d?.toString() || "",
      dimensionsHeight: dims?.h?.toString() || "",
      dimensionsArmWidth: dims?.armWidth?.toString() || "",
      dimensionsArmDepth: dims?.armDepth?.toString() || "",
      dimensionsSeatWidth: dims?.seatWidth?.toString() || "",
      dimensionsSeatDepth: dims?.seatDepth?.toString() || "",
      weight: (product as any).weight || "",
      seating: (product as any).seating || "",
      assembly: (product as any).assembly || "",
      deliveryOptions: ship?.deliveryOptions || "",
      deliveryLocation: ship?.deliveryLocation || "",
      deliveryPolicy: ship?.deliveryPolicy || "",
    });
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "N/A";
    return categories?.find((c) => c.id === categoryId)?.name || "Unknown";
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "N/A";
    return suppliers?.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  // Image health mutations
  const repairImagesMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest(`/api/admin/products/${productId}/image-health/repair`, "PATCH");
    },
    onSuccess: () => {
      toast({
        title: "Image Repair Started",
        description: "Product images marked for revalidation",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Repair failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeImagesMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest(`/api/admin/products/${productId}/image-health/remove`, "PATCH");
    },
    onSuccess: () => {
      toast({
        title: "Images Removed",
        description: "Product images marked as removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Remove failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getImageUrl = (images: string[] | null) => {
    if (!images || images.length === 0) return null;
    const firstImage = images[0];
    // If it's already a full URL (S3 or external), return as is
    if (firstImage.startsWith("http://") || firstImage.startsWith("https://")) {
      return firstImage;
    }
    // If it's a local path, return as is (will be served by the server)
    return firstImage;
  };

  // Helper to check if product has any AI analysis (legacy or dual-provider)
  const hasAIAnalysis = (product: Product) => {
    return !!(
      (product as any).visualDescription || 
      (product as any).visualDescriptionGemini || 
      (product as any).visualDescriptionOpenAI
    );
  };

  // Filtered products based on all filters
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter(product => {
      // Search filter (name or SKU)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesSKU = product.sku.toLowerCase().includes(query);
        if (!matchesName && !matchesSKU) return false;
      }
      
      // Category filter
      if (categoryFilter !== "all" && product.categoryId !== categoryFilter) {
        return false;
      }
      
      // Supplier filter
      if (supplierFilter !== "all" && product.supplierId !== supplierFilter) {
        return false;
      }
      
      // Image filter
      if (imageFilter === "with_images") {
        if (!product.images || product.images.length === 0) return false;
      } else if (imageFilter === "without_images") {
        if (product.images && product.images.length > 0) return false;
      }
      
      // Availability filter
      if (availabilityFilter !== "all" && product.availability !== availabilityFilter) {
        return false;
      }
      
      // Analysis filter - use helper to check all AI analysis fields
      if (analysisFilter === "analyzed") {
        if (!hasAIAnalysis(product)) return false;
      } else if (analysisFilter === "not_analyzed") {
        if (hasAIAnalysis(product)) return false;
      }
      
      // Image health filter
      if (imageHealthFilter !== "all" && product.imageHealth !== imageHealthFilter) {
        return false;
      }
      
      return true;
    });
  }, [products, searchQuery, categoryFilter, supplierFilter, imageFilter, availabilityFilter, analysisFilter, imageHealthFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSupplierFilter("all");
    setImageFilter("all");
    setAvailabilityFilter("all");
    setAnalysisFilter("all");
    setImageHealthFilter("all");
  };

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || supplierFilter !== "all" || imageFilter !== "all" || availabilityFilter !== "all" || analysisFilter !== "all" || imageHealthFilter !== "all";

  const ProductFormFields = ({ form }: { form: any }) => (
    <>
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Basic Information</h3>
        
        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-sku" placeholder="PROD-001" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-name" placeholder="Product name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} data-testid="input-description" placeholder="Product description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-supplier">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL Slug</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-slug" placeholder="product-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Pricing & Inventory */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-lg">Pricing & Inventory</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="tradePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trade Price ($)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-trade-price" type="number" step="0.01" placeholder="79.99" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Retail Price ($)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-price" type="number" step="0.01" placeholder="99.99" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount ($)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-discount" type="number" step="0.01" placeholder="0" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="inventory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inventory</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-inventory" type="number" placeholder="10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="availability"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Availability</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-availability">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="preorder">Preorder</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="leadTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Time (days)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-lead-time" type="number" placeholder="7" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Product Attributes */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-lg">Product Attributes</h3>
        
        <FormField
          control={form.control}
          name="roomType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Room Type (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-room-type" placeholder="Living Room, Bedroom" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="designStyle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Design Style (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-design-style" placeholder="Modern, Contemporary, Minimalist" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="keyFeatures"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Key Features (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-key-features" placeholder="Pet-friendly, Stain resistant, Easy to clean" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="storageSolutions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Storage Solutions</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-storage-solutions" placeholder="No Storage, 3 Drawers, Built-in Shelves" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="styleTags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Style Tags (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-style-tags" placeholder="modern, organic, minimalist" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="colors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Colors (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-colors" placeholder="white, black, brown" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="materials"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Materials (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-materials" placeholder="wood, fabric, metal" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-tags" placeholder="sofa, luxury, modern" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Physical Specifications */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-lg">Physical Specifications</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="dimensionsWidth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Width (inches)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-width" type="number" placeholder="84" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dimensionsDepth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Depth (inches)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-depth" type="number" placeholder="36" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dimensionsHeight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Height (inches)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-height" type="number" placeholder="32" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="dimensionsArmWidth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Arm Width (in)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-arm-width" type="number" placeholder="10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dimensionsArmDepth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Arm Depth (in)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-arm-depth" type="number" placeholder="32" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dimensionsSeatWidth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seat Width (in)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-seat-width" type="number" placeholder="60" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dimensionsSeatDepth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seat Depth (in)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-seat-depth" type="number" placeholder="24" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-weight" placeholder="150 lbs" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="seating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seating Capacity</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-seating" placeholder="3 seats, 2-4 people" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assembly"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assembly Required</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-assembly" placeholder="Yes, No, Partial" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Shipping & Delivery */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-lg">Shipping & Delivery</h3>
        
        <FormField
          control={form.control}
          name="deliveryOptions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Options (comma separated)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-delivery-options" placeholder="White glove delivery, Curbside delivery" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deliveryLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Location</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-delivery-location" placeholder="Continental US, Worldwide" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deliveryPolicy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Policy</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-delivery-policy" placeholder="Free shipping over $100" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-products">
            Products
          </h1>
          <p className="text-stone-600 dark:text-stone-400 mt-2">
            Manage your furniture catalog ({products?.length || 0} products)
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Start visual analysis for all products without descriptions
              startVisualAnalysisMutation.mutate({ onlyMissingDescriptions: true });
            }}
            disabled={startVisualAnalysisMutation.isPending}
            data-testid="button-analyze-visuals"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {startVisualAnalysisMutation.isPending ? "Starting..." : "Analyze Visuals"}
          </Button>

          <Button
            variant="outline"
            onClick={() => reanalyzeFrontViewsMutation.mutate()}
            disabled={reanalyzeFrontViewsMutation.isPending || frontViewProductCount === 0}
            data-testid="button-reanalyze-front-views"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {reanalyzeFrontViewsMutation.isPending 
              ? "Starting..." 
              : `Re-analyze ${frontViewProductCount} Front View Products`
            }
          </Button>

          <Button
            variant="default"
            onClick={() => analyzeWithGeminiMutation.mutate()}
            disabled={analyzeWithGeminiMutation.isPending}
            data-testid="button-gemini-analysis"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {analyzeWithGeminiMutation.isPending 
              ? "Analyzing..." 
              : "Gemini: Front View + Combined"
            }
          </Button>
          
          <Button
            variant="outline"
            onClick={() => {
              setBatchAnalyzing(true);
              batchMultiAngleMutation.mutate(10);
            }}
            disabled={batchAnalyzing}
            data-testid="button-batch-multi-angle"
          >
            <Scan className="w-4 h-4 mr-2" />
            {batchAnalyzing ? "Analyzing..." : "Multi-Angle Analysis (10)"}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => generateDescriptionsMutation.mutate()}
            disabled={generateDescriptionsMutation.isPending}
            data-testid="button-generate-descriptions"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generateDescriptionsMutation.isPending ? "Generating..." : "Generate Text Descriptions"}
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>Create a new product in the catalog</DialogDescription>
              </DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                  <ProductFormFields form={addForm} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-add">
                      {createMutation.isPending ? "Creating..." : "Create Product"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Advanced Filters */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-stone-600" />
          <h2 className="text-lg font-semibold">Advanced Filters</h2>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              data-testid="button-clear-filters"
              className="ml-auto"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <Label htmlFor="search" className="text-sm mb-2 block">Search by Name or SKU</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                id="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <Label htmlFor="category-filter" className="text-sm mb-2 block">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="category-filter" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Supplier Filter */}
          <div>
            <Label htmlFor="supplier-filter" className="text-sm mb-2 block">Supplier</Label>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger id="supplier-filter" data-testid="select-supplier-filter">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image Status Filter */}
          <div>
            <Label htmlFor="image-filter" className="text-sm mb-2 block">Image Status</Label>
            <Select value={imageFilter} onValueChange={setImageFilter}>
              <SelectTrigger id="image-filter" data-testid="select-image-filter">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="with_images">With Images</SelectItem>
                <SelectItem value="without_images">Without Images</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Availability Filter */}
          <div>
            <Label htmlFor="availability-filter" className="text-sm mb-2 block">Availability</Label>
            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger id="availability-filter" data-testid="select-availability-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="preorder">Preorder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="image-health-filter" className="text-sm mb-2 block">Image Health</Label>
            <Select value={imageHealthFilter} onValueChange={setImageHealthFilter}>
              <SelectTrigger id="image-health-filter" data-testid="select-image-health-filter">
                <SelectValue placeholder="All Health Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Health Status</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="repairing">Repairing</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AI Analysis Filter */}
          <div>
            <Label htmlFor="analysis-filter" className="text-sm mb-2 block">AI Analysis</Label>
            <Select value={analysisFilter} onValueChange={setAnalysisFilter}>
              <SelectTrigger id="analysis-filter" data-testid="select-analysis-filter">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="analyzed">✨ Analyzed</SelectItem>
                <SelectItem value="not_analyzed">Not Analyzed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Results Summary */}
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-600">
          <span>Showing {filteredProducts.length} of {products?.length || 0} products</span>
          {hasActiveFilters && (
            <Badge variant="secondary" data-testid="badge-active-filters">
              {[
                searchQuery && "Search",
                categoryFilter !== "all" && "Category",
                supplierFilter !== "all" && "Supplier",
                imageFilter !== "all" && "Images",
                availabilityFilter !== "all" && "Status",
                analysisFilter !== "all" && "Analysis",
                imageHealthFilter !== "all" && "Health"
              ].filter(Boolean).length} filter(s) active
            </Badge>
          )}
        </div>
      </Card>

      {/* Visual Analysis Jobs */}
      {activeAnalysisJobs && activeAnalysisJobs.length > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Loader2 className="w-5 h-5 text-stone-600 animate-spin" />
            <h2 className="text-lg font-semibold">Active Visual Analysis Jobs</h2>
          </div>
          
          <div className="space-y-4">
            {activeAnalysisJobs.map((job: any) => (
              <div key={job.id} className="border rounded-lg p-4 bg-stone-50 dark:bg-stone-900">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {job.status === "processing" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="font-medium">
                      {job.jobType === "auto_after_upload" ? "Auto-triggered" : "Manual"} Analysis
                    </span>
                    <Badge variant={job.status === "processing" ? "default" : "secondary"}>
                      {job.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Started {new Date(job.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                
                {/* Progress Bars for Two-Phase Analysis */}
                {job.phaseStats ? (
                  <div className="space-y-3 mb-3">
                    {/* Phase 1: Front View Analysis */}
                    <div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                        <div className="flex items-center gap-2">
                          <span>Phase 1: Front View Analysis</span>
                          {job.currentPhase === 'front-view' && (
                            <Badge variant="outline" className="text-xs">Active</Badge>
                          )}
                        </div>
                        <span>{job.phaseStats.frontView.completed} / {job.totalProducts}</span>
                      </div>
                      <Progress 
                        value={(job.phaseStats.frontView.completed / job.totalProducts) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    {/* Phase 2: Combined Analysis */}
                    <div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                        <div className="flex items-center gap-2">
                          <span>Phase 2: Combined Analysis</span>
                          {job.currentPhase === 'combined' && (
                            <Badge variant="outline" className="text-xs">Active</Badge>
                          )}
                        </div>
                        <span>{job.phaseStats.combined.completed} / {job.totalProducts}</span>
                      </div>
                      <Progress 
                        value={(job.phaseStats.combined.completed / job.totalProducts) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    {/* Overall Progress */}
                    <div>
                      <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span className="font-medium">Overall Progress</span>
                        <span className="font-medium">
                          {job.analyzedProducts + job.failedProducts + job.skippedProducts} / {job.totalProducts}
                        </span>
                      </div>
                      <Progress 
                        value={((job.analyzedProducts + job.failedProducts + job.skippedProducts) / job.totalProducts) * 100} 
                        className="h-2 bg-stone-200"
                      />
                    </div>
                  </div>
                ) : (
                  /* Legacy single-phase progress for V1 */
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{job.analyzedProducts + job.failedProducts + job.skippedProducts} / {job.totalProducts}</span>
                    </div>
                    <Progress 
                      value={((job.analyzedProducts + job.failedProducts + job.skippedProducts) / job.totalProducts) * 100} 
                      className="h-2"
                    />
                  </div>
                )}
                
                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-muted-foreground">Analyzed:</span>
                    <span className="font-medium">{job.analyzedProducts}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-muted-foreground">Failed:</span>
                    <span className="font-medium">{job.failedProducts}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span className="text-muted-foreground">Skipped:</span>
                    <span className="font-medium">{job.skippedProducts}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-blue-600" />
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className="font-medium">
                      {job.totalProducts - (job.analyzedProducts + job.failedProducts + job.skippedProducts)}
                    </span>
                  </div>
                </div>
                
                {/* Current Product and Phase Details */}
                {job.currentProductName && (
                  <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-muted-foreground">Currently analyzing: </span>
                        <span className="text-sm font-medium">{job.currentProductName}</span>
                      </div>
                      {job.currentPhase && (
                        <Badge variant="outline" className="text-xs">
                          {job.currentPhase === 'front-view' ? 'Front View' : 'Combined'}
                        </Badge>
                      )}
                    </div>
                    {job.processingDetails && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span>Workers: {job.processingDetails.activeWorkers || 0}/{job.processingDetails.totalWorkers || 5}</span>
                        {job.processingDetails.batchNumber && (
                          <span className="ml-3">Batch: {job.processingDetails.batchNumber}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-stone-500">Loading products...</p>
        </div>
      ) : (
        <Card className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-stone-500">
                      {hasActiveFilters ? "No products match your filters" : "No products found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                    <TableCell>
                      <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded overflow-hidden">
                        {getImageUrl(product.images) ? (
                          <img
                            src={getImageUrl(product.images)!}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <Upload className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {product.name}
                        {hasAIAnalysis(product) && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-analyzed-${product.id}`}>
                            ✨ {((product as any).visualDescriptionGemini && (product as any).visualDescriptionOpenAI) ? 'Dual AI' : 'AI Analyzed'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryName(product.categoryId)}</TableCell>
                    <TableCell>{getSupplierName(product.supplierId)}</TableCell>
                    <TableCell className="font-semibold text-green-600">${product.price}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs ${
                          product.availability === "in_stock"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : product.availability === "out_of_stock"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        }`}
                      >
                        {product.availability === "in_stock"
                          ? "In Stock"
                          : product.availability === "out_of_stock"
                          ? "Out of Stock"
                          : "Preorder"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.imageHealth === "healthy"
                            ? "default"
                            : product.imageHealth === "repairing"
                            ? "secondary"
                            : "destructive"
                        }
                        data-testid={`badge-health-${product.id}`}
                      >
                        {product.imageHealth === "healthy" ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Healthy</>
                        ) : product.imageHealth === "repairing" ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Repairing</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" /> Removed</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingProduct(product)}
                          data-testid={`button-view-${product.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(product)}
                          data-testid={`button-edit-${product.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {/* Multi-angle analysis button */}
                        {product.images && product.images.length > 0 && 
                         !(product as any).synthesizedFrontView && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAnalyzingProductId(product.id);
                              multiAngleAnalysisMutation.mutate(product.id);
                            }}
                            disabled={analyzingProductId === product.id}
                            data-testid={`button-multi-angle-${product.id}`}
                            title="Analyze from multiple angles"
                          >
                            {analyzingProductId === product.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ScanText className="w-4 h-4 text-blue-600" />
                            )}
                          </Button>
                        )}
                        {/* Image health actions */}
                        {product.imageHealth !== "healthy" && (
                          <>
                            {product.imageHealth === "removed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => repairImagesMutation.mutate(product.id)}
                                disabled={repairImagesMutation.isPending}
                                data-testid={`button-repair-images-${product.id}`}
                                title="Repair images - mark for revalidation"
                              >
                                <Wrench className="w-4 h-4 text-amber-600" />
                              </Button>
                            )}
                            {product.imageHealth === "repairing" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRemoveImagesProduct({ id: product.id, name: product.name })}
                                disabled={removeImagesMutation.isPending}
                                data-testid={`button-remove-images-${product.id}`}
                                title="Remove images - mark as removed"
                              >
                                <CircleX className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleFileSelect(product.id, e)}
                          className="hidden"
                          id={`upload-${product.id}`}
                          data-testid={`input-upload-${product.id}`}
                        />
                        <label htmlFor={`upload-${product.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={uploadingFor === product.id}
                            data-testid={`button-upload-${product.id}`}
                            asChild
                          >
                            <span className="cursor-pointer">
                              {uploadingFor === product.id && uploadProgress[product.id] ? (
                                <span className="text-xs">{uploadProgress[product.id].current}/{uploadProgress[product.id].total}</span>
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteProduct({ id: product.id, name: product.name })}
                          data-testid={`button-delete-${product.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <ProductFormFields form={editForm} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending ? "Updating..." : "Update Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProduct && deleteMutation.mutate(deleteProduct.id)}
              data-testid="button-confirm-delete"
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Images Confirmation Dialog */}
      <AlertDialog open={!!removeImagesProduct} onOpenChange={(open) => !open && setRemoveImagesProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product Images</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark images as removed for "{removeImagesProduct?.name}"? Image URLs will be preserved but marked as inaccessible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove-images">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeImagesProduct) {
                  removeImagesMutation.mutate(removeImagesProduct.id);
                  setRemoveImagesProduct(null);
                }
              }}
              data-testid="button-confirm-remove-images"
              className="bg-amber-600 hover:bg-amber-700"
            >
              {removeImagesMutation.isPending ? "Removing..." : "Remove Images"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Dialog */}
      <Dialog open={!!viewingProduct} onOpenChange={(open) => !open && setViewingProduct(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingProduct?.name}</DialogTitle>
            <DialogDescription>Complete Product Details</DialogDescription>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">SKU</Label>
                    <p className="font-mono text-sm">{viewingProduct.sku}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p>{getCategoryName(viewingProduct.categoryId)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Supplier</Label>
                    <p>{getSupplierName(viewingProduct.supplierId)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Source File</Label>
                    <p className="text-sm">{(viewingProduct as any).sourceFile || "N/A"}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{viewingProduct.description || "N/A"}</p>
                </div>
              </div>

              {/* Pricing & Inventory */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Pricing & Inventory</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Trade Price</Label>
                    <p className="font-semibold">{(viewingProduct as any).tradePrice ? `$${(viewingProduct as any).tradePrice}` : "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Retail Price</Label>
                    <p className="font-semibold text-green-600">${viewingProduct.price}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Inventory</Label>
                    <p>{(viewingProduct as any).inventory ?? "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Availability</Label>
                    <p className="capitalize">{viewingProduct.availability}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Lead Time</Label>
                    <p>{(viewingProduct as any).leadTime ? `${(viewingProduct as any).leadTime} days` : "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Product Attributes */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Product Attributes</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Room Type</Label>
                    <p className="text-sm">{(viewingProduct as any).roomType?.join(", ") || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Design Style</Label>
                    <p className="text-sm">{(viewingProduct as any).designStyle?.join(", ") || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Key Features</Label>
                    <p className="text-sm">{(viewingProduct as any).keyFeatures?.join(", ") || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Storage Solutions</Label>
                    <p className="text-sm">{(viewingProduct as any).storageSolutions || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Colors</Label>
                    <p className="text-sm">{viewingProduct.colors?.join(", ") || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Materials</Label>
                    <p className="text-sm">{viewingProduct.materials?.join(", ") || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tags</Label>
                    <p className="text-sm">{(viewingProduct as any).tags?.join(", ") || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Style Tags</Label>
                    <p className="text-sm">{viewingProduct.styleTags?.join(", ") || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Physical Specifications */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Physical Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Dimensions (W × D × H)</Label>
                    <p className="text-sm">
                      {viewingProduct.dimensions 
                        ? `${(viewingProduct.dimensions as any).w}" W × ${(viewingProduct.dimensions as any).d}" D × ${(viewingProduct.dimensions as any).h}" H`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Arm Dimensions</Label>
                    <p className="text-sm">
                      {(viewingProduct.dimensions as any)?.armWidth || (viewingProduct.dimensions as any)?.armDepth
                        ? `${(viewingProduct.dimensions as any).armWidth || "?"}" W × ${(viewingProduct.dimensions as any).armDepth || "?"}" D`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Seat Dimensions</Label>
                    <p className="text-sm">
                      {(viewingProduct.dimensions as any)?.seatWidth || (viewingProduct.dimensions as any)?.seatDepth
                        ? `${(viewingProduct.dimensions as any).seatWidth || "?"}" W × ${(viewingProduct.dimensions as any).seatDepth || "?"}" D`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Seating Capacity</Label>
                    <p className="text-sm">{(viewingProduct as any).seating || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Weight</Label>
                    <p className="text-sm">{(viewingProduct as any).weight || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Assembly Required</Label>
                    <p className="text-sm">{(viewingProduct as any).assembly || "N/A"}</p>
                  </div>
                </div>
              </div>
              
              {/* Shipping & Delivery */}
              {((viewingProduct as any).shipping?.deliveryOptions || (viewingProduct as any).shipping?.deliveryLocation || (viewingProduct as any).shipping?.deliveryPolicy) && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Shipping & Delivery</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Delivery Options</Label>
                      <p className="text-sm">{(viewingProduct as any).shipping?.deliveryOptions || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Delivery Location</Label>
                      <p className="text-sm">{(viewingProduct as any).shipping?.deliveryLocation || "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Delivery Policy</Label>
                      <p className="text-sm">{(viewingProduct as any).shipping?.deliveryPolicy || "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Images */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Images</h3>
                <p className="text-sm text-muted-foreground mb-2">{viewingProduct.images?.length || 0} image(s)</p>
                {viewingProduct.images && viewingProduct.images.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {viewingProduct.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={getImageUrl([img])!}
                        alt={`${viewingProduct.name} ${idx + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No images uploaded</p>
                )}
              </div>

              {/* AI Visual Descriptions - Dual Provider Comparison */}
              <div>
                <h3 className="font-semibold text-lg mb-3">AI Visual Descriptions</h3>
                
                {hasAIAnalysis(viewingProduct) ? (
                  <div className="space-y-4">
                    {/* Dual Provider Comparison (if new fields exist) */}
                    {((viewingProduct as any).visualDescriptionGemini || (viewingProduct as any).visualDescriptionOpenAI) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Gemini Description */}
                        <div className={`border rounded-lg p-4 ${(viewingProduct as any).visualDescriptionGemini ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            <h4 className="font-semibold text-sm">Gemini 2.5 Flash</h4>
                          </div>
                          {(viewingProduct as any).visualDescriptionGemini ? (
                            <>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{(viewingProduct as any).visualDescriptionGemini}</p>
                              <p className="text-xs text-muted-foreground mt-3">
                                {(viewingProduct as any).visualDescriptionGemini.length} characters
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No Gemini analysis available
                            </p>
                          )}
                        </div>

                        {/* OpenAI Description */}
                        <div className={`border rounded-lg p-4 ${(viewingProduct as any).visualDescriptionOpenAI ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-green-600" />
                            <h4 className="font-semibold text-sm">OpenAI GPT-5 Vision</h4>
                          </div>
                          {(viewingProduct as any).visualDescriptionOpenAI ? (
                            <>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{(viewingProduct as any).visualDescriptionOpenAI}</p>
                              <p className="text-xs text-muted-foreground mt-3">
                                {(viewingProduct as any).visualDescriptionOpenAI.length} characters
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No OpenAI analysis available
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legacy Single-Provider View (if only old visualDescription exists) */}
                    {(viewingProduct as any).visualDescription && !(viewingProduct as any).visualDescriptionGemini && !(viewingProduct as any).visualDescriptionOpenAI && (
                      <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <h4 className="font-semibold text-sm">Legacy AI Analysis</h4>
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{(viewingProduct as any).visualDescription}</p>
                        <p className="text-xs text-muted-foreground mt-3">
                          {(viewingProduct as any).visualDescription.length} characters • Re-analyze to get dual provider comparison
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      No visual descriptions generated yet. Click "Analyze Product Images" to generate comprehensive AI descriptions from both Gemini and OpenAI providers for quality comparison.
                    </p>
                  </div>
                )}

                {/* Active Description Info */}
                {(viewingProduct as any).visualDescription && (
                  <div className="mt-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                      🎯 Active Description: {(viewingProduct as any).visualDescription === (viewingProduct as any).visualDescriptionGemini ? 'Gemini 2.5 Flash' : (viewingProduct as any).visualDescription === (viewingProduct as any).visualDescriptionOpenAI ? 'OpenAI GPT-5' : 'Legacy/Other'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Used for AI room rendering. You can test rendering with either provider's description to compare quality.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
