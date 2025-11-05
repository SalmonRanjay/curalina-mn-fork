import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Upload, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

export default function AdminProducts() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/admin/products/${productId}/upload-image`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
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

  const handleFileSelect = (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setUploadingFor(productId);
    uploadMutation.mutate({ productId, file });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="heading-products">Products</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-2">
          Manage your furniture catalog and upload product images to S3
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-stone-500">Loading products...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card border rounded-lg p-6 mb-6">
            <p className="text-sm text-stone-500">
              {products?.length || 0} products in catalog
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products?.map((product) => (
              <Card key={product.id} className="p-6" data-testid={`product-card-${product.id}`}>
                <div className="space-y-4">
                  {/* Product Images */}
                  <div className="aspect-square bg-stone-100 dark:bg-stone-800 rounded-lg overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        data-testid={`product-image-${product.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-16 h-16 text-stone-400" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div>
                    <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                    <p className="text-sm text-stone-500 mb-2">SKU: {product.sku}</p>
                    <p className="text-lg font-semibold text-green-600">${product.price}</p>
                  </div>

                  {/* Upload Button */}
                  <div className="pt-4 border-t">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(product.id, e)}
                      className="hidden"
                      id={`upload-${product.id}`}
                      data-testid={`input-upload-${product.id}`}
                    />
                    <label htmlFor={`upload-${product.id}`}>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={uploadingFor === product.id}
                        asChild
                        data-testid={`button-upload-${product.id}`}
                      >
                        <span className="cursor-pointer flex items-center justify-center gap-2">
                          <Upload className="w-4 h-4" />
                          {uploadingFor === product.id ? "Uploading..." : "Upload Image to S3"}
                        </span>
                      </Button>
                    </label>
                    
                    {product.images && product.images.length > 0 && (
                      <p className="text-xs text-stone-500 mt-2 text-center">
                        {product.images.length} image(s) stored
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
