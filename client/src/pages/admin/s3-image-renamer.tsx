import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileEdit, CheckCircle2, XCircle, AlertCircle, RefreshCw, Eye } from "lucide-react";

interface RenameResult {
  productId: string;
  productName: string;
  oldImages: string[];
  newImages: string[];
  success: boolean;
  error?: string;
}

interface RenameSummary {
  totalProducts: number;
  processedProducts: number;
  successfulRenames: number;
  failedRenames: number;
  results: RenameResult[];
}

export default function S3ImageRenamerPage() {
  const { toast } = useToast();
  const [previewResult, setPreviewResult] = useState<RenameSummary | null>(null);
  const [executeResult, setExecuteResult] = useState<RenameSummary | null>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/products/s3-images/preview-rename');
      return await response.json() as RenameSummary;
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      toast({
        title: "Preview Complete!",
        description: `Found ${data.processedProducts} products with images to rename`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview S3 image renames",
        variant: "destructive",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/products/s3-images/execute-rename');
      return await response.json() as RenameSummary;
    },
    onSuccess: (data) => {
      setExecuteResult(data);
      setPreviewResult(null);
      toast({
        title: "Renaming Complete!",
        description: `Successfully renamed images for ${data.successfulRenames} products`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute S3 image renames",
        variant: "destructive",
      });
    },
  });

  const productsWithChanges = previewResult?.results.filter(r => 
    JSON.stringify(r.oldImages) !== JSON.stringify(r.newImages)
  ) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-s3-rename-title">S3 Image Renamer</h1>
        <p className="text-muted-foreground mt-2">
          Replace spaces with dashes in S3 image filenames for cleaner URLs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="w-5 h-5" />
            S3 Image Renaming Tool
          </CardTitle>
          <CardDescription>
            This tool renames S3 images that contain spaces, replacing them with dashes for cleaner URLs.
            It also updates the database records to reflect the new filenames.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>1. Scans all product images in the database</p>
              <p>2. Identifies images with spaces in their filenames (e.g., "Angle View Chair.png")</p>
              <p>3. <strong>Preview Mode:</strong> Shows what changes would be made without modifying anything</p>
              <p>4. <strong>Execute Mode:</strong> Copies S3 files to new keys with dashes (e.g., "Angle-View-Chair.png")</p>
              <p>5. Deletes old S3 files and updates database records</p>
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
              variant="outline"
              size="lg"
              data-testid="button-preview-rename"
            >
              {previewMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Previewing...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Changes
                </>
              )}
            </Button>

            <Button
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending || !previewResult}
              size="lg"
              data-testid="button-execute-rename"
            >
              {executeMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                <>
                  <FileEdit className="w-4 h-4 mr-2" />
                  Execute Renaming
                </>
              )}
            </Button>
          </div>

          {previewResult && !executeResult && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Preview Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="text-preview-total">{previewResult.totalProducts}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Products with Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600" />
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-preview-changes">{productsWithChanges.length}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">No Changes Needed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-2xl font-bold text-green-600" data-testid="text-preview-no-changes">
                        {previewResult.totalProducts - productsWithChanges.length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {productsWithChanges.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Ready to Execute</AlertTitle>
                  <AlertDescription>
                    {productsWithChanges.length} product(s) have images with spaces that will be renamed. 
                    Click "Execute Renaming" to proceed.
                  </AlertDescription>
                </Alert>
              )}

              {productsWithChanges.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>All Images Already Normalized</AlertTitle>
                  <AlertDescription>
                    No images need renaming. All images already use dashes instead of spaces.
                  </AlertDescription>
                </Alert>
              )}

              {productsWithChanges.length > 0 && productsWithChanges.length <= 10 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Sample Changes:</h4>
                  {productsWithChanges.slice(0, 10).map((result, idx) => (
                    <Card key={idx} className="p-3">
                      <p className="font-medium text-sm">{result.productName}</p>
                      <div className="mt-1 space-y-1 text-xs">
                        {result.oldImages.map((oldImg, imgIdx) => {
                          const newImg = result.newImages[imgIdx];
                          if (oldImg !== newImg) {
                            const oldFilename = oldImg.split('/').pop();
                            const newFilename = newImg.split('/').pop();
                            return (
                              <div key={imgIdx} className="flex items-center gap-2">
                                <span className="text-red-600 line-through">{oldFilename}</span>
                                <span>→</span>
                                <span className="text-green-600">{newFilename}</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {executeResult && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Execution Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Processed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="text-execute-processed">{executeResult.processedProducts}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-2xl font-bold text-green-600" data-testid="text-execute-success">{executeResult.successfulRenames}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <p className="text-2xl font-bold text-red-600" data-testid="text-execute-failed">{executeResult.failedRenames}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {executeResult.successfulRenames > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>
                    Successfully renamed images for {executeResult.successfulRenames} product(s). 
                    URLs now use dashes instead of spaces.
                  </AlertDescription>
                </Alert>
              )}

              {executeResult.failedRenames > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Some Failures Occurred</AlertTitle>
                  <AlertDescription>
                    {executeResult.failedRenames} product(s) failed to rename. Check the logs for details.
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
