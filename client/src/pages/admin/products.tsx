import { useQuery } from "@tanstack/react-query";

export default function AdminProducts() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/admin/products"],
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="heading-products">Products</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-2">
          Manage your furniture catalog
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-stone-500">Loading products...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-lg border p-6">
          <p className="text-sm text-stone-500">
            {products?.length || 0} products in catalog
          </p>
          {/* Product list will go here */}
        </div>
      )}
    </div>
  );
}
