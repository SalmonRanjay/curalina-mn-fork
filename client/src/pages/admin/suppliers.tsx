import { useQuery } from "@tanstack/react-query";
import type { Supplier } from "@shared/schema";

export default function AdminSuppliers() {
  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="heading-suppliers">Suppliers</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-2">
          Manage your furniture suppliers
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-stone-500">Loading suppliers...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-lg border p-6">
          <p className="text-sm text-stone-500">
            {suppliers?.length || 0} suppliers
          </p>
          {/* Supplier list will go here */}
        </div>
      )}
    </div>
  );
}
