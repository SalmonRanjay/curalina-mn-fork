import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, XCircle, AlertCircle, FolderOpen } from "lucide-react";

interface ProductMatch {
  file: File;
  folderName: string;
  productId: string;
  productName: string;
  sku: string;
  productType: string;
  status: "pending" | "uploading" | "success" | "error" | "skipped";
  error?: string;
  preview?: string;
}

export default function FrontViewUpload() {
  const [files, setFiles] = useState<ProductMatch[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  // Fetch all products for matching
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/products"],
  });

  // Detect product type from product name
  const detectProductType = (productName: string): string => {
    const name = productName.toLowerCase();
    
    // Storage furniture
    if (name.includes('cabinet') || name.includes('cupboard')) return 'cabinet';
    if (name.includes('console')) return 'console';
    if (name.includes('dresser') || name.includes('chest')) return 'dresser';
    if (name.includes('credenza')) return 'credenza';
    if (name.includes('nightstand') || name.includes('bedside')) return 'nightstand';
    if (name.includes('shelf') || name.includes('bookcase') || name.includes('bookshelf')) return 'shelf';
    
    // Seating
    if (name.includes('sofa') || name.includes('couch') || name.includes('sectional')) return 'sofa';
    if (name.includes('chair')) return 'chair';
    if (name.includes('stool')) return 'stool';
    if (name.includes('bench')) return 'bench';
    if (name.includes('ottoman')) return 'ottoman';
    if (name.includes('chaise')) return 'chaise';
    
    // Tables
    if (name.includes('table')) return 'table';
    if (name.includes('desk')) return 'desk';
    
    // Bedroom
    if (name.includes('bed')) return 'bed';
    
    // Lighting
    if (name.includes('lamp') || name.includes('light')) return 'lamp';
    
    // Decor
    if (name.includes('mirror')) return 'mirror';
    if (name.includes('pillow')) return 'pillow';
    if (name.includes('rug') || name.includes('mat')) return 'rug';
    if (name.includes('vase') || name.includes('bowl') || name.includes('vessel')) return 'decor';
    if (name.includes('rack')) return 'rack';
    if (name.includes('planter')) return 'planter';
    
    return 'item'; // Fallback
  };

  // Check if a file is a "Front View" image (case-insensitive)
  const isFrontViewFile = (filename: string): boolean => {
    const lower = filename.toLowerCase();
    return lower.includes('front') && lower.includes('view');
  };

  // Extract SKU folder name from nested file path
  // Expected structure: Product Images/Category/SKU/Front View.jpg
  const extractFolderName = (file: File): string => {
    // Use webkitRelativePath which contains the full folder hierarchy
    const path = (file as any).webkitRelativePath || file.name;
    const parts = path.split('/');
    
    // The SKU folder is the parent folder of the file
    // e.g., "Product Images/Tables/ABC123/Front View.jpg" -> "ABC123"
    if (parts.length >= 2) {
      return parts[parts.length - 2]; // SKU folder (parent of file)
    }
    return '';
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (!products || products.length === 0) {
      toast({
        title: "Products not loaded",
        description: "Please wait for products to load",
        variant: "destructive",
      });
      return;
    }

    // Filter to only "Front View" files
    const frontViewFiles = acceptedFiles.filter(file => isFrontViewFile(file.name));

    if (frontViewFiles.length === 0) {
      toast({
        title: "No Front View files found",
        description: "Please ensure your files are named 'Front View.jpg' or similar",
        variant: "destructive",
      });
      return;
    }

    // Group files by folder and match to products
    const newMatches: ProductMatch[] = [];
    const unmatchedFolders: string[] = [];

    frontViewFiles.forEach(file => {
      const folderName = extractFolderName(file);
      
      if (!folderName) {
        return; // Skip files not in folders
      }

      // Try to match folder name to product SKU
      const normalizedFolder = folderName.trim().toLowerCase();
      const product = products.find(p => 
        p.sku.toLowerCase() === normalizedFolder ||
        p.sku.toLowerCase().replace(/[^a-z0-9]/g, '-') === normalizedFolder.replace(/[^a-z0-9]/g, '-')
      );

      if (product) {
        // Check if product already has a front-view image
        const hasFrontView = product.images?.some((img: string) => 
          img.toLowerCase().includes('front') && img.toLowerCase().includes('view')
        );

        const productType = detectProductType(product.name);

        newMatches.push({
          file,
          folderName,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          productType,
          status: hasFrontView ? "skipped" : "pending",
          error: hasFrontView ? "Already has front-view image" : undefined,
          preview: URL.createObjectURL(file),
        });
      } else {
        if (!unmatchedFolders.includes(folderName)) {
          unmatchedFolders.push(folderName);
        }
      }
    });

    setFiles(prev => [...prev, ...newMatches]);

    const matchedCount = newMatches.filter(f => f.status === "pending").length;
    const skippedCount = newMatches.filter(f => f.status === "skipped").length;

    toast({
      title: "Front View files detected",
      description: `${matchedCount} ready to upload, ${skippedCount} already have front-view, ${unmatchedFolders.length} unmatched folders`,
    });

    if (unmatchedFolders.length > 0) {
      console.log("Unmatched folders:", unmatchedFolders);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isLoadingProducts || isUploading,
    noClick: isLoadingProducts || isUploading,
    noKeyboard: isLoadingProducts || isUploading,
  });

  // Override getInputProps to enable directory upload
  const inputProps = getInputProps();
  const directoryInputProps = {
    ...inputProps,
    webkitdirectory: "true",
    directory: "true",
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === "pending");
    
    if (pendingFiles.length === 0) {
      toast({
        title: "No files to upload",
        description: "All files are either uploaded or skipped",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    let completed = 0;
    const total = pendingFiles.length;

    for (const match of pendingFiles) {
      try {
        // Mark as uploading
        setFiles(prev => prev.map(f => 
          f === match ? { ...f, status: "uploading" as const } : f
        ));

        // Generate the front-view filename
        const ext = match.file.name.split('.').pop();
        const frontViewFilename = `Front View ${match.productType}.${ext}`;

        // Get presigned URL
        const presignedResponse = await fetch(`/api/admin/products/${match.productId}/presigned-upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: frontViewFilename,
            contentType: match.file.type,
          }),
        });

        if (!presignedResponse.ok) {
          const error = await presignedResponse.json();
          throw new Error(error.error || 'Failed to get upload URL');
        }

        const presignedData = await presignedResponse.json();

        // Check if file is a duplicate (already exists)
        if (presignedData.duplicate) {
          // Skip this file - it already exists
          setFiles(prev => prev.map(f => 
            f === match ? { 
              ...f, 
              status: "skipped" as const,
              error: "File already exists in S3"
            } : f
          ));
          completed++;
          setUploadProgress(Math.round((completed / total) * 100));
          continue;
        }

        const { url, fields, publicUrl } = presignedData;

        // Upload directly to S3
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
          formData.append(key, value as string);
        });
        formData.append('file', match.file);

        const uploadResponse = await fetch(url, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('S3 upload failed');
        }

        // Confirm upload with backend using publicUrl (not imageUrl)
        const confirmResponse = await fetch(`/api/admin/products/${match.productId}/confirm-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: publicUrl }),
        });

        if (!confirmResponse.ok) {
          throw new Error('Failed to confirm upload');
        }

        // Mark as success
        setFiles(prev => prev.map(f => 
          f === match ? { ...f, status: "success" as const } : f
        ));

        completed++;
        setUploadProgress(Math.round((completed / total) * 100));

      } catch (error) {
        console.error(`Upload failed for ${match.productName}:`, error);
        setFiles(prev => prev.map(f => 
          f === match ? { 
            ...f, 
            status: "error" as const,
            error: error instanceof Error ? error.message : "Upload failed"
          } : f
        ));
        completed++;
        setUploadProgress(Math.round((completed / total) * 100));
      }
    }

    setIsUploading(false);

    const successCount = files.filter(f => f.status === "success").length;
    const errorCount = files.filter(f => f.status === "error").length;

    toast({
      title: "Upload Complete",
      description: `${successCount} uploaded successfully, ${errorCount} failed`,
      variant: successCount > 0 ? "default" : "destructive",
    });
  };

  const clearAll = () => {
    setFiles([]);
    setUploadProgress(0);
  };

  const pendingCount = files.filter(f => f.status === "pending").length;
  const uploadingCount = files.filter(f => f.status === "uploading").length;
  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const skippedCount = files.filter(f => f.status === "skipped").length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Front View Upload Tool</h1>
        <p className="text-muted-foreground">
          Automatically upload "Front View" images for products missing them. 
          Drag your "Product Images" folder or category folders containing SKU subfolders with "Front View.jpg" files.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Expected structure: Product Images → Category → SKU → Front View.jpg
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload Area */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload Front View Images</CardTitle>
              <CardDescription>
                Drop your entire "Product Images" folder or category subfolders. The tool will automatically find SKU folders and extract "Front View" images.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                  ${isLoadingProducts || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                data-testid="dropzone-front-view"
              >
                <input {...directoryInputProps} />
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                {isDragActive ? (
                  <p className="text-lg">Drop folders here...</p>
                ) : isLoadingProducts ? (
                  <p className="text-lg">Loading products...</p>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-2">
                      Drag & drop your Product Images folder here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The tool will automatically find SKU folders and extract "Front View" images
                    </p>
                  </>
                )}
              </div>

              {files.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-x-2">
                      <Badge variant="outline">{pendingCount} Pending</Badge>
                      <Badge variant="outline">{uploadingCount} Uploading</Badge>
                      <Badge variant="outline">{successCount} Success</Badge>
                      <Badge variant="outline">{errorCount} Failed</Badge>
                      <Badge variant="outline">{skippedCount} Skipped</Badge>
                    </div>
                    <div className="space-x-2">
                      <Button
                        onClick={handleUpload}
                        disabled={pendingCount === 0 || isUploading}
                        data-testid="button-upload-front-views"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload {pendingCount} Front Views
                      </Button>
                      <Button
                        variant="outline"
                        onClick={clearAll}
                        disabled={isUploading}
                        data-testid="button-clear-all"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Upload Progress</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upload Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Files</span>
                <span className="font-medium">{files.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ready to Upload</span>
                <span className="font-medium text-blue-600">{pendingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Successfully Uploaded</span>
                <span className="font-medium text-green-600">{successCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failed</span>
                <span className="font-medium text-red-600">{errorCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Skipped (Has Front View)</span>
                <span className="font-medium text-amber-600">{skippedCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Organize folders by product SKU</p>
              <p>2. Place "Front View.jpg" in each folder</p>
              <p>3. Drag folders into upload area</p>
              <p>4. System auto-detects product type</p>
              <p>5. Click "Upload" to process all</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Front View Files ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {files.map((match, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`file-item-${index}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {match.preview && (
                      <img
                        src={match.preview}
                        alt={match.productName}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{match.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {match.sku} • {match.productType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {match.status === "pending" && (
                      <Badge variant="outline">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                    {match.status === "uploading" && (
                      <Badge variant="outline">
                        <Upload className="mr-1 h-3 w-3 animate-pulse" />
                        Uploading
                      </Badge>
                    )}
                    {match.status === "success" && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Success
                      </Badge>
                    )}
                    {match.status === "error" && (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        <XCircle className="mr-1 h-3 w-3" />
                        {match.error || "Error"}
                      </Badge>
                    )}
                    {match.status === "skipped" && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Already has front-view
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
