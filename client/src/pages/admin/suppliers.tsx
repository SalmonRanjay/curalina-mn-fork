import { useQuery } from "@tanstack/react-query";

export default function AdminSuppliers() {
  const { data: vendors, isLoading } = useQuery({
    queryKey: ["/api/admin/vendors"],
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="heading-suppliers">Suppliers</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-2">
          Manage your furniture suppliers and vendors
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-stone-500">Loading suppliers...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-lg border p-6">
          <p className="text-sm text-stone-500">
            {vendors?.length || 0} suppliers
          </p>
          {/* Supplier list will go here */}
        </div>
      )}
    </div>
  );
}
