import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, XCircle, AlertCircle, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

interface FileWithMeta {
  file: File;
  sku: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  productId?: string;
  preview?: string;
}

export default function BulkUpload() {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileWithMeta[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  // Extract SKU from filename (e.g., "SKU001-front.jpg" -> "SKU001")
  const extractSKU = (filename: string): string => {
    const nameWithoutExt = filename.split('.')[0];
    // Match pattern: SKU-anything or just SKU
    const match = nameWithoutExt.match(/^([A-Z0-9\-]+?)(?:-|_|\.|$)/i);
    return match ? match[1] : nameWithoutExt;
  };

  const onDrop = (acceptedFiles: File[]) => {
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    multiple: true,
  });

  const uploadFile = async (fileWithMeta: FileWithMeta): Promise<void> => {
    if (!fileWithMeta.productId) {
      throw new Error("No product ID");
    }

    const formData = new FormData();
    formData.append('image', fileWithMeta.file);

    const response = await fetch(`/api/admin/products/${fileWithMeta.productId}/upload-image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Upload failed');
    }

    return response.json();
  };

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
    setTotalProgress(0);

    let completed = 0;
    const total = pendingFiles.length;

    // Upload files with concurrency limit (5 at a time)
    const concurrencyLimit = 5;
    for (let i = 0; i < pendingFiles.length; i += concurrencyLimit) {
      const batch = pendingFiles.slice(i, i + concurrencyLimit);
      
      await Promise.all(
        batch.map(async (fileWithMeta) => {
          const index = files.findIndex(f => f === fileWithMeta);
          
          // Update status to uploading
          setFiles(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], status: "uploading" };
            return updated;
          });

          try {
            await uploadFile(fileWithMeta);
            
            // Update status to success
            setFiles(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], status: "success" };
              return updated;
            });

            completed++;
            setTotalProgress(Math.round((completed / total) * 100));
          } catch (error) {
            // Update status to error
            setFiles(prev => {
              const updated = [...prev];
              updated[index] = { 
                ...updated[index], 
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed"
              };
              return updated;
            });
            
            completed++;
            setTotalProgress(Math.round((completed / total) * 100));
          }
        })
      );
    }

    // Invalidate products cache
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });

    setIsUploading(false);

    const successCount = files.filter(f => f.status === "success").length;
    const errorCount = files.filter(f => f.status === "error").length;

    toast({
      title: "Upload complete",
      description: `${successCount} successful, ${errorCount} failed`,
    });
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== "success"));
  };

  const clearAll = () => {
    setFiles([]);
    setTotalProgress(0);
  };

  const pendingCount = files.filter(f => f.status === "pending").length;
  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Bulk Image Upload</h1>
        <p className="text-muted-foreground">
          Upload multiple product images at once. Name files with SKU prefix (e.g., SKU001-front.jpg, SKU001-side.jpg)
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

      {/* Dropzone */}
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
            data-testid="dropzone"
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
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
        </CardContent>
      </Card>

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

      {/* Progress Bar */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
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
                        {fileWithMeta.error || (fileWithMeta.status === "success" ? "Uploaded successfully" : "-")}
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
