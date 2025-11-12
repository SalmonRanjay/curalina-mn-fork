import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Database, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface SyncResult {
  success: boolean;
  updated: number;
  skipped: number;
  errors: string[];
  totalFrontViewsInS3: number;
  totalProducts: number;
  message: string;
}

export default function S3SyncPage() {
  const { toast } = useToast();
  const [result, setResult] = useState<SyncResult | null>(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/products/sync-s3-front-views');
      return await response.json() as SyncResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Sync Complete!",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Front View images from S3",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-s3-sync-title">S3 Front View Sync</h1>
        <p className="text-muted-foreground mt-2">
          Scan your S3 bucket and automatically link Front View images to products in the database
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Sync Tool
          </CardTitle>
          <CardDescription>
            This tool will scan all objects in your S3 bucket, find Front View images, and automatically
            add them to the corresponding products in your database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>1. Scans all objects in S3 bucket under the <code className="bg-muted px-1 rounded">products/</code> prefix</p>
              <p>2. Filters for Front View images (front-view, front_view, frontview)</p>
              <p>3. Extracts SKU from the S3 path (products/SKU/front-view.jpg)</p>
              <p>4. Matches to products in database and adds images to their images array</p>
              <p>5. Skips images that are already linked to products</p>
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              size="lg"
              data-testid="button-start-sync"
            >
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Start S3 Sync
                </>
              )}
            </Button>
          </div>

          {result && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Sync Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Front Views in S3</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="text-total-s3">{result.totalFrontViewsInS3}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Products Updated</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-2xl font-bold text-green-600" data-testid="text-updated">{result.updated}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Skipped</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <p className="text-2xl font-bold text-amber-600" data-testid="text-skipped">{result.skipped}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <p className="text-2xl font-bold text-red-600" data-testid="text-errors">{result.errors.length}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {result.success && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              )}

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Errors Occurred</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      {result.errors.slice(0, 10).map((error, idx) => (
                        <p key={idx} className="text-xs font-mono">{error}</p>
                      ))}
                      {result.errors.length > 10 && (
                        <p className="text-xs italic">...and {result.errors.length - 10} more errors</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
