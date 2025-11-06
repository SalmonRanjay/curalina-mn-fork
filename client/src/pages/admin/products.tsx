import { useState } from "react";
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
import { Upload, Edit, Trash2, Plus, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertProductSchema, type Product, type Category, type Supplier, type InsertProduct } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Extend the schema for form handling with comma-separated strings
const productFormSchema = insertProductSchema.extend({
  price: z.string().min(1, "Price is required"),
  discount: z.string().optional(),
  styleTags: z.string().optional(),
  colors: z.string().optional(),
  materials: z.string().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function AdminProducts() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<{ id: string; name: string } | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: { current: number; total: number } }>({});

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
  });

  const addForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      categoryId: "",
      supplierId: "",
      price: "",
      discount: "0",
      availability: "in_stock",
      slug: "",
      styleTags: "",
      colors: "",
      materials: "",
    },
  });

  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
  });

  const transformFormData = (data: ProductFormData): any => {
    return {
      sku: data.sku,
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      supplierId: data.supplierId,
      price: parseFloat(data.price),
      discount: data.discount ? parseFloat(data.discount) : 0,
      availability: data.availability,
      slug: data.slug,
      styleTags: data.styleTags ? data.styleTags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      colors: data.colors ? data.colors.split(",").map((c) => c.trim()).filter(Boolean) : [],
      materials: data.materials ? data.materials.split(",").map((m) => m.trim()).filter(Boolean) : [],
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

  const uploadMutation = useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`/api/admin/products/${productId}/upload-image`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Image uploaded",
        description: "Product image uploaded successfully to S3",
      });
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
    editForm.reset({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      price: product.price?.toString() || "",
      discount: product.discount?.toString() || "0",
      availability: product.availability || "in_stock",
      slug: product.slug,
      styleTags: product.styleTags?.join(", ") || "",
      colors: product.colors?.join(", ") || "",
      materials: product.materials?.join(", ") || "",
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

  const ProductFormFields = ({ form }: { form: any }) => (
    <>
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

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price ($)</FormLabel>
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
      </div>

      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Slug</FormLabel>
            <FormControl>
              <Input {...field} data-testid="input-slug" placeholder="product-name" />
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => (
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
                    <TableCell className="font-medium">{product.name}</TableCell>
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
                ))}
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

      {/* View Dialog */}
      <Dialog open={!!viewingProduct} onOpenChange={(open) => !open && setViewingProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingProduct?.name}</DialogTitle>
            <DialogDescription>Product Details</DialogDescription>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-stone-500">SKU</Label>
                  <p className="font-mono">{viewingProduct.sku}</p>
                </div>
                <div>
                  <Label className="text-stone-500">Price</Label>
                  <p className="font-semibold text-green-600">${viewingProduct.price}</p>
                </div>
              </div>
              <div>
                <Label className="text-stone-500">Description</Label>
                <p>{viewingProduct.description || "N/A"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-stone-500">Category</Label>
                  <p>{getCategoryName(viewingProduct.categoryId)}</p>
                </div>
                <div>
                  <Label className="text-stone-500">Supplier</Label>
                  <p>{getSupplierName(viewingProduct.supplierId)}</p>
                </div>
              </div>
              <div>
                <Label className="text-stone-500">Style Tags</Label>
                <p>{viewingProduct.styleTags?.join(", ") || "N/A"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-stone-500">Colors</Label>
                  <p>{viewingProduct.colors?.join(", ") || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-stone-500">Materials</Label>
                  <p>{viewingProduct.materials?.join(", ") || "N/A"}</p>
                </div>
              </div>
              <div>
                <Label className="text-stone-500">Images</Label>
                <p>{viewingProduct.images?.length || 0} image(s)</p>
                {viewingProduct.images && viewingProduct.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {viewingProduct.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={getImageUrl([img])!}
                        alt={`${viewingProduct.name} ${idx + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                    ))}
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
