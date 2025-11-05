export default function AdminAnalytics() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="heading-analytics">Analytics</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-2">
          Track platform metrics and insights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-stone-900 rounded-lg border p-6">
          <p className="text-sm text-stone-500 mb-2">Total Orders</p>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-lg border p-6">
          <p className="text-sm text-stone-500 mb-2">Revenue</p>
          <p className="text-3xl font-bold">$0</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-lg border p-6">
          <p className="text-sm text-stone-500 mb-2">Products Sold</p>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>
    </div>
  );
}
