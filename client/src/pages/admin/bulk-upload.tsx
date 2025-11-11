import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, CheckCircle, XCircle, AlertCircle, Image as ImageIcon, FolderOpen, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

interface FileWithMeta {
  file: File;
  sku: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  productId?: string;
  preview?: string;
  confidence?: number;
  reasoning?: string;
}

interface UploadJob {
  id: string;
  productId: string;
  productName: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  progress: number;
}

export default function BulkUpload() {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileWithMeta[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  const [isAiMatching, setIsAiMatching] = useState(false);
  const [jobFileMapping, setJobFileMapping] = useState<Map<string, string[]>>(new Map()); // jobId -> filenames
  const [completedJobIds, setCompletedJobIds] = useState<Set<string>>(new Set());
  const folderInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  // Extract SKU from filename (e.g., "SKU001-front.jpg" -> "SKU001")
  const extractSKU = (filename: string): string => {
    const nameWithoutExt = filename.split('.')[0];
    // Match pattern: SKU-anything or just SKU
    const match = nameWithoutExt.match(/^([A-Z0-9\-]+?)(?:-|_|\.|$)/i);
    return match ? match[1] : nameWithoutExt;
  };

  // Extract product name from folder path 
  // e.g., "Curalina Product Images/Sofas/Product Name/.PNG/front.jpg" -> "Product Name"
  const extractProductNameFromPath = (filepath: string): string => {
    const parts = filepath.split('/').filter(p => p); // Remove empty parts
    if (parts.length < 2) return '';
    
    // Remove the filename (last part)
    const folders = parts.slice(0, -1);
    
    // Ignore common container/image/category folder names
    const ignoreFolders = [
      // Image format folders
      '.png', '.jpg', '.jpeg', '.webp', '.gif',
      // Generic container folders
      'images', 'photos', 'assets', 'files',
      'curalina product images', 'product images', 'products',
      'cleaned', 'original', 'originals', 'originlas', 'raw', 'edited',
      // Category folders (common furniture categories)
      'sofas', 'chairs', 'tables', 'beds', 'lighting', 'decor',
      'dining', 'living room', 'bedroom', 'office',
      'storage', 'outdoor', 'rugs', 'accessories'
    ];
    
    const productFolders = folders.filter(f => 
      !ignoreFolders.includes(f.toLowerCase())
    );
    
    // Return the LAST valid folder (closest to the file, most likely the product)
    return productFolders.length > 0 ? productFolders[productFolders.length - 1] : folders[0];
  };

  const onDrop = (acceptedFiles: File[]) => {
    // Block if products are still loading
    if (isLoadingProducts) {
      toast({
        title: "Please wait",
        description: "Loading product catalog...",
        variant: "destructive",
      });
      return;
    }

    const newFiles: FileWithMeta[] = acceptedFiles.map(file => {
      const sku = extractSKU(file.name);
      const product = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
      
      return {
        file,
        sku,
        status: product ? "pending" : "error",
        error: product ? undefined : `No product found with SKU: ${sku}`,
        productId: product?.id,
        preview: URL.createObjectURL(file),
      };
    });

    setFiles(prev => [...prev, ...newFiles]);

    const matchedCount = newFiles.filter(f => f.status === "pending").length;
    const unmatchedCount = newFiles.filter(f => f.status === "error").length;

    toast({
      title: "Files added",
      description: `${matchedCount} matched, ${unmatchedCount} unmatched products`,
    });
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoadingProducts) {
      toast({
        title: "Please wait",
        description: "Loading product catalog...",
        variant: "destructive",
      });
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: FileWithMeta[] = Array.from(files).map(file => {
      const folderName = extractProductNameFromPath(file.webkitRelativePath || file.name);
      const filenameSku = extractSKU(file.name);
      
      // Normalize folder name by removing spaces around dashes
      // "Carrie - Side - Table" becomes "Carrie-Side-Table"
      const normalizedFolderName = folderName.replace(/\s*-\s*/g, '-').trim();
      
      // Try to match by folder name as PRODUCT NAME first (most common case)
      // Trim whitespace/newlines from product names for comparison
      let product = products.find(p => 
        p.name.trim().toLowerCase() === folderName.toLowerCase()
      );
      
      // If not found, try normalized folder name as product name
      if (!product) {
        product = products.find(p => 
          p.name.trim().toLowerCase() === normalizedFolderName.toLowerCase()
        );
      }
      
      // Try replacing dashes with spaces for product name matching
      // "Carrie-Side-Table" becomes "Carrie Side Table"
      if (!product) {
        const nameWithSpaces = normalizedFolderName.replace(/-/g, ' ');
        product = products.find(p => 
          p.name.trim().toLowerCase() === nameWithSpaces.toLowerCase()
        );
      }
      
      // Fallback: try folder name as SKU
      if (!product) {
        product = products.find(p => 
          p.sku.toLowerCase() === normalizedFolderName.toLowerCase()
        );
      }
      
      // Last resort: try filename as SKU
      if (!product && filenameSku) {
        product = products.find(p => p.sku.toLowerCase() === filenameSku.toLowerCase());
      }
      
      return {
        file,
        sku: product?.sku || filenameSku || normalizedFolderName,
        status: product ? "pending" : "error",
        error: product ? undefined : `No product found with folder name "${folderName}"`,
        productId: product?.id,
        preview: URL.createObjectURL(file),
      };
    });

    setFiles(prev => [...prev, ...newFiles]);

    const matchedCount = newFiles.filter(f => f.status === "pending").length;
    const unmatchedCount = newFiles.filter(f => f.status === "error").length;

    toast({
      title: "Folders processed",
      description: `${matchedCount} matched, ${unmatchedCount} unmatched products`,
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isLoadingProducts,
    noClick: isLoadingProducts,
    noKeyboard: isLoadingProducts,
  });

  // Fetch active jobs on mount to restore in-flight work
  const { data: activeJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/upload-jobs/active"],
    refetchInterval: 3000,
  });

  // Sync job completion status with files UI
  useEffect(() => {
    if (!activeJobs || activeJobs.length === 0) return;

    activeJobs.forEach((job: any) => {
      // Check if job just completed
      if ((job.status === 'completed' || job.status === 'failed') && !completedJobIds.has(job.id)) {
        setCompletedJobIds(prev => new Set(prev).add(job.id));

        // Show completion toast
        const successMsg = job.status === 'completed' 
          ? `✅ Upload complete for ${job.productName || 'product'}: ${job.completedFiles} uploaded, ${job.skippedFiles} skipped`
          : `❌ Upload failed for ${job.productName || 'product'}: ${job.failedFiles} errors`;

        toast({
          title: job.status === 'completed' ? "Upload Complete" : "Upload Failed",
          description: successMsg,
          variant: job.status === 'completed' ? "default" : "destructive",
        });

        // Mark associated files as success/error
        const fileNames = jobFileMapping.get(job.id);
        if (fileNames) {
          setFiles(prev => prev.map(f => {
            if (fileNames.includes(f.file.name)) {
              return {
                ...f,
                status: job.status === 'completed' ? 'success' : 'error',
                error: job.status === 'failed' ? job.errorMessage : undefined,
              };
            }
            return f;
          }));
        }

        // Invalidate products cache to show new images
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      }
    });
  }, [activeJobs, completedJobIds, jobFileMapping, toast]);

  // Background upload handler - creates jobs and lets server process them
  const handleBulkUpload = async () => {
    const pendingFiles = files.filter(f => f.status === "pending");
    if (pendingFiles.length === 0) {
      toast({
        title: "No files to upload",
        description: "All files are either uploaded or have errors",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Group files by productId (one job per product)
      const filesByProduct = new Map<string, FileWithMeta[]>();
      pendingFiles.forEach(file => {
        if (!file.productId) return;
        if (!filesByProduct.has(file.productId)) {
          filesByProduct.set(file.productId, []);
        }
        filesByProduct.get(file.productId)!.push(file);
      });

      const jobsCreated: string[] = [];

      // Create upload jobs for each product
      for (const [productId, productFiles] of Array.from(filesByProduct.entries())) {
        // Cap at 50 files per job to avoid oversized payloads (~75-100MB limit)
        const MAX_FILES_PER_JOB = 50;
        
        for (let i = 0; i < productFiles.length; i += MAX_FILES_PER_JOB) {
          const batch = productFiles.slice(i, i + MAX_FILES_PER_JOB);
          
          const formData = new FormData();
          formData.append('productId', productId);
          batch.forEach((file: FileWithMeta) => {
            formData.append('images', file.file);
          });

          const response = await fetch('/api/admin/upload-jobs/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to create upload job for product ${productId}`);
          }

          const { jobId } = await response.json();
          jobsCreated.push(jobId);

          // Track which files belong to this job
          const fileNames = batch.map(f => f.file.name);
          setJobFileMapping(prev => new Map(prev).set(jobId, fileNames));

          // Mark files as uploading (job created)
          setFiles(prev => prev.map(f => {
            if (batch.includes(f)) {
              return { ...f, status: "uploading" as const };
            }
            return f;
          }));
        }
      }

      // Invalidate active jobs query to start polling
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/upload-jobs/active"] });

      toast({
        title: "Upload jobs started",
        description: `${jobsCreated.length} background job(s) created. You can navigate away - processing continues!`,
      });

      // DO NOT remove files here - let the polling effect update them to success/error when jobs complete

    } catch (error) {
      console.error("Failed to start upload jobs:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to start background upload",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearCompleted = () => {
    setFiles(prev => {
      // Revoke object URLs for completed files to prevent memory leaks
      prev.filter(f => f.status === "success").forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      return prev.filter(f => f.status !== "success");
    });
  };

  const clearAll = () => {
    // Revoke all object URLs to prevent memory leaks
    files.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setTotalProgress(0);
  };

  const handleAIMatch = async () => {
    const errorFiles = files.filter(f => f.status === "error");
    if (errorFiles.length === 0) {
      toast({
        title: "No files to match",
        description: "All files are already matched or uploaded",
        variant: "destructive",
      });
      return;
    }

    setIsAiMatching(true);

    try {
      // Extract unique folder names from unmatched files
      const folderNamesSet = new Set(
        errorFiles.map(f => {
          const path = f.file.webkitRelativePath || f.file.name;
          return extractProductNameFromPath(path) || f.sku;
        }).filter(Boolean)
      );
      const folderNames = Array.from(folderNamesSet);

      // Call AI matching API
      const response = await fetch("/api/admin/products/ai-match-folders", {
        method: "POST",
        body: JSON.stringify({ folderNames }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to match folders");
      }

      const data = await response.json() as {
        matches: Array<{
          folderName: string;
          productName: string | null;
          productSku: string | null;
          productId: string | null;
          confidence: number;
          reasoning: string;
        }>;
      };

      // Update files with AI matches
      setFiles(prev => {
        return prev.map(file => {
          if (file.status !== "error") return file;

          const folderName = extractProductNameFromPath(file.file.webkitRelativePath || file.file.name) || file.sku;
          const match = data.matches.find((m: any) => m.folderName === folderName);

          if (match && match.productId && match.confidence >= 60) {
            return {
              ...file,
              productId: match.productId,
              sku: match.productSku || file.sku,
              status: "pending" as const,
              error: undefined,
              confidence: match.confidence,
              reasoning: match.reasoning,
            };
          }

          return file;
        });
      });

      const matchedCount = data.matches.filter((m: any) => m.productId && m.confidence >= 60).length;

      toast({
        title: "AI matching complete",
        description: `${matchedCount} products matched with confidence ≥ 60%`,
      });
    } catch (error) {
      toast({
        title: "AI matching failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsAiMatching(false);
    }
  };

  const pendingCount = files.filter(f => f.status === "pending").length;
  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Bulk Image Upload</h1>
        <p className="text-muted-foreground">
          Upload multiple product images at once using folders or SKU-based filenames
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{files.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Methods */}
      <Tabs defaultValue="folders" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="folders" data-testid="tab-folders">
            <FolderOpen className="w-4 h-4 mr-2" />
            Upload by Folders
          </TabsTrigger>
          <TabsTrigger value="sku" data-testid="tab-sku">
            <Upload className="w-4 h-4 mr-2" />
            Upload by SKU
          </TabsTrigger>
        </TabsList>

        {/* Folder-based Upload */}
        <TabsContent value="folders">
          <Card>
            <CardHeader>
              <CardTitle>Folder Upload</CardTitle>
              <CardDescription>
                Each folder name should match your product name exactly (e.g., "Modern Leather Sofa")
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <div className="border-2 border-dashed rounded-lg p-12 text-center cursor-wait opacity-50">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Loading product catalog...</p>
                  <p className="text-sm text-muted-foreground">
                    Loading {products.length > 0 ? products.length : '...'} products
                  </p>
                </div>
              ) : (
                <div>
                  <input
                    ref={folderInputRef}
                    type="file"
                    {...({ webkitdirectory: "", directory: "" } as any)}
                    multiple
                    onChange={handleFolderUpload}
                    className="hidden"
                    accept="image/*"
                    data-testid="input-folder-upload"
                  />
                  <Button
                    onClick={() => folderInputRef.current?.click()}
                    className="w-full h-32"
                    variant="outline"
                    data-testid="button-select-folders"
                  >
                    <div className="text-center">
                      <FolderOpen className="w-12 h-12 mx-auto mb-3" />
                      <p className="text-lg font-medium">Select Product Folders</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Choose folders named after your products
                      </p>
                    </div>
                  </Button>
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium mb-2">Example folder structure:</p>
                    <pre className="text-xs text-muted-foreground">
{`/Modern Leather Sofa/
  ├── front.jpg
  ├── side.jpg
  └── angle.jpg
/Dining Chair Set/
  ├── view1.jpg
  └── view2.jpg`}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SKU-based Upload */}
        <TabsContent value="sku">
          <Card>
            <CardHeader>
              <CardTitle>SKU-based Upload</CardTitle>
              <CardDescription>
                Name files with SKU prefix: SKU-description.jpg (e.g., SOFA001-front.jpg)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <div className="border-2 border-dashed rounded-lg p-12 text-center cursor-wait opacity-50">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Loading product catalog...</p>
                  <p className="text-sm text-muted-foreground">
                    Loading {products.length > 0 ? products.length : '...'} products
                  </p>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                    ${isDragActive 
                      ? 'border-primary bg-primary/10 border-solid' 
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20'
                    }
                  `}
                  data-testid="dropzone"
                >
                  <input {...getInputProps()} />
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {isDragActive ? (
                    <p className="text-lg font-medium text-primary">Drop files here...</p>
                  ) : (
                    <div>
                      <p className="text-lg font-medium mb-2">Drag & drop product images here</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to browse files
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Naming convention:</strong> SKU-description.jpg (e.g., SOFA001-front.jpg, SOFA001-angle.jpg)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {files.length > 0 && (
        <div className="flex gap-3">
          <Button
            onClick={handleBulkUpload}
            disabled={isUploading || pendingCount === 0}
            data-testid="button-start-upload"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}
          </Button>
          {errorCount > 0 && (
            <Button
              variant="default"
              onClick={handleAIMatch}
              disabled={isAiMatching || isUploading}
              data-testid="button-ai-match"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isAiMatching ? "AI Matching..." : `AI Match ${errorCount} Unmatched`}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={clearCompleted}
            disabled={successCount === 0}
            data-testid="button-clear-completed"
          >
            Clear Completed
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
      )}

      {/* Active Background Jobs */}
      {activeJobs && activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Background Upload Jobs</CardTitle>
            <CardDescription>
              {activeJobs.length} active job{activeJobs.length !== 1 ? 's' : ''} - You can navigate away, processing continues!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeJobs.map((job: any) => {
              const progress = job.totalFiles > 0 
                ? Math.round(((job.completedFiles + job.failedFiles + job.skippedFiles) / job.totalFiles) * 100)
                : 0;
              const isActive = job.status === 'pending' || job.status === 'processing';
              
              return (
                <div key={job.id} className="space-y-2 p-4 border rounded-lg" data-testid={`job-${job.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{job.productName || `Product ${job.productId}`}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.completedFiles + job.failedFiles + job.skippedFiles} / {job.totalFiles} files processed
                      </p>
                    </div>
                    <Badge variant={isActive ? "secondary" : job.status === 'completed' ? "default" : "destructive"}>
                      {job.status}
                    </Badge>
                  </div>
                  
                  <Progress value={progress} />
                  
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      {job.completedFiles} uploaded
                    </span>
                    {job.skippedFiles > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-yellow-600" />
                        {job.skippedFiles} duplicates skipped
                      </span>
                    )}
                    {job.failedFiles > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-600" />
                        {job.failedFiles} failed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Progress Bar (for local uploads) */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Creating upload jobs...</span>
                <span>{totalProgress}%</span>
              </div>
              <Progress value={totalProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files Table */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Files Queue</CardTitle>
            <CardDescription>
              {files.length} file{files.length !== 1 ? 's' : ''} in queue
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((fileWithMeta, index) => (
                    <TableRow key={index} data-testid={`row-file-${index}`}>
                      <TableCell>
                        {fileWithMeta.preview ? (
                          <img 
                            src={fileWithMeta.preview} 
                            alt={fileWithMeta.file.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{fileWithMeta.file.name}</TableCell>
                      <TableCell className="font-medium">{fileWithMeta.sku}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            fileWithMeta.status === "success" ? "default" :
                            fileWithMeta.status === "error" ? "destructive" :
                            fileWithMeta.status === "uploading" ? "secondary" :
                            "outline"
                          }
                        >
                          {fileWithMeta.status === "success" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {fileWithMeta.status === "error" && <XCircle className="w-3 h-3 mr-1" />}
                          {fileWithMeta.status === "uploading" && <AlertCircle className="w-3 h-3 mr-1" />}
                          {fileWithMeta.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fileWithMeta.error ? (
                          fileWithMeta.error
                        ) : fileWithMeta.status === "success" ? (
                          "Uploaded successfully"
                        ) : fileWithMeta.confidence ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={fileWithMeta.confidence >= 80 ? "default" : "secondary"}>
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Match: {fileWithMeta.confidence}%
                            </Badge>
                            <span className="text-xs">{fileWithMeta.reasoning}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
