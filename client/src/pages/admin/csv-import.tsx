import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  details?: string;
}

export default function CSVImportPage() {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/products/import-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      setUploadProgress(100);
      
      if (result.success) {
        toast({
          title: "Import Completed",
          description: `Successfully imported ${result.imported} products. Skipped ${result.skipped} duplicates.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      } else {
        toast({
          title: "Import Failed",
          description: result.details || "An error occurred during import",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    onDrop: (files) => {
      if (files.length > 0) {
        setImportResult(null);
        setUploadProgress(10);
        importMutation.mutate(files[0]);
      }
    },
  });

  const downloadTemplate = () => {
    // Helper function to escape CSV fields properly
    const escapeCsvField = (field: string): string => {
      // If field contains comma, newline, or quote, wrap in quotes and escape internal quotes
      if (field.includes(',') || field.includes('\n') || field.includes('"') || field.includes('\r')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    // CSV template with 12 required fields + 17 optional fields
    const headers = [
      // ✅ REQUIRED FIELDS (12)
      'Product Name',
      'Overview',
      'Supplier',
      'SKU',
      'Furniture Category',
      'Room Type',
      'Design Style',
      'Key Features',
      'Storage Solutions',
      'Colour',
      'Product Material',
      'Inventory',
      // 🟨 OPTIONAL FIELDS (17)
      'Trade Price',
      'Retail Price',
      'Dimensions (Height)',
      'Dimensions (Width)',
      'Dimensions (Depth)',
      'Arm Width',
      'Arm Depth',
      'Seat Width',
      'Seat Depth',
      'Seating',
      'Assembly',
      'Lead Time',
      'Delivery Options',
      'Delivery Location',
      'Delivery Policy',
      'Tags',
      'Weight'
    ];
    
    const sampleRow = [
      // REQUIRED (12 fields)
      'Modern Boucle Sofa',
      'Premium boucle fabric sofa with curved silhouette and natural oak legs',
      'West Elm',
      'SOFA-001',
      'Seating',
      'Living Room, Family Room',
      'Organic Modern, Minimalist',
      'Pet-friendly fabric, Stain resistant, Easy to clean',
      'No Storage',
      'Ivory, Cream, Natural Oak',
      'Boucle fabric, Oak wood, Foam cushions',
      '15',
      // OPTIONAL (17 fields)
      '1199.00',           // Trade Price
      '1499.00',           // Retail Price
      '32',                // Dimensions (Height)
      '84',                // Dimensions (Width)
      '36',                // Dimensions (Depth)
      '10',                // Arm Width
      '32',                // Arm Depth
      '60',                // Seat Width
      '24',                // Seat Depth
      '3 seats',           // Seating
      'No',                // Assembly
      '7',                 // Lead Time
      'White glove delivery, Curbside delivery', // Delivery Options
      'Continental US',    // Delivery Location
      'Free shipping over $100', // Delivery Policy
      'sofa, modern, luxury', // Tags
      '150'                // Weight
    ];

    // Properly escape all fields for CSV format
    const csvContent = [
      headers.map(escapeCsvField).join(','),
      sampleRow.map(escapeCsvField).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Use this template to format your product data",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-section-title">CSV Product Import</h1>
        <p className="text-muted-foreground">Bulk upload products from Excel or CSV files</p>
      </div>

      {/* Download Template */}
      <Card>
        <CardHeader>
          <CardTitle>Download Template</CardTitle>
          <CardDescription>
            CSV template with 12 required fields and 17 optional fields. Download and fill in all required fields for each product.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">✅ Required Fields (12)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Product Name</li>
                <li>• Overview</li>
                <li>• Supplier</li>
                <li>• SKU</li>
                <li>• Furniture Category</li>
                <li>• Room Type</li>
                <li>• Design Style</li>
                <li>• Key Features</li>
                <li>• Storage Solutions</li>
                <li>• Colour</li>
                <li>• Product Material</li>
                <li>• Inventory</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-yellow-700 dark:text-yellow-400">🟨 Optional Fields (17)</h4>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>• Trade Price, Retail Price</li>
                <li>• Dimensions (Height, Width, Depth)</li>
                <li>• Arm Width, Arm Depth</li>
                <li>• Seat Width, Seat Depth</li>
                <li>• Seating</li>
                <li>• Assembly</li>
                <li>• Lead Time</li>
                <li>• Delivery Options, Location, Policy</li>
                <li>• Tags, Weight</li>
              </ul>
            </div>
          </div>
          <Button onClick={downloadTemplate} variant="outline" data-testid="button-download-template">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Product File</CardTitle>
          <CardDescription>
            Supported formats: Excel (.xlsx, .xls) or CSV (.csv)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover-elevate"
            }`}
            data-testid="dropzone-csv"
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                {importMutation.isPending ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                ) : (
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                )}
              </div>
              
              {importMutation.isPending ? (
                <div className="w-full max-w-md space-y-2">
                  <p className="font-medium">Processing file...</p>
                  <Progress value={uploadProgress} />
                </div>
              ) : isDragActive ? (
                <p className="text-lg font-medium">Drop your file here...</p>
              ) : (
                <>
                  <div>
                    <p className="text-lg font-medium mb-1">
                      Drag & drop your product file
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </div>
                  <Button variant="outline" data-testid="button-browse-csv">
                    <Upload className="w-4 h-4 mr-2" />
                    Browse Files
                  </Button>
                </>
              )}

              {acceptedFiles.length > 0 && !importMutation.isPending && (
                <Badge variant="secondary" className="mt-2">
                  Selected: {acceptedFiles[0].name}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              <CardTitle>
                {importResult.success ? "Import Successful" : "Import Failed"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Imported</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-imported-count">
                  {importResult.imported}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Skipped (Duplicates)</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="text-skipped-count">
                  {importResult.skipped}
                </p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  Errors ({importResult.errors.length})
                </div>
                <div className="space-y-1 max-h-48 overflow-auto bg-muted/50 rounded-md p-3">
                  {importResult.errors.map((error, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Column Format Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-sm">
            <div className="flex gap-2">
              <Badge variant="outline" className="shrink-0">Required</Badge>
              <span className="text-muted-foreground">Product Name, SKU, Supplier, Furniture Category, Retail Price</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="shrink-0">Optional</Badge>
              <span className="text-muted-foreground">Overview, Trade Price, Room Type, Design Style, Key Features, Storage Solutions, General Dimensions, Weight, Colour, Product Material, Assembly, LEAD Time, Inventory, Tags, Source File</span>
            </div>
          </div>
          
          <div className="pt-4 border-t space-y-2">
            <p className="text-sm font-medium">Format Examples:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Prices:</strong> 1299.99 (without $)</li>
              <li><strong>Colors/Materials:</strong> Black, Brown, White (comma-separated)</li>
              <li><strong>Dimensions:</strong> 84" W X 36" D X 32" H</li>
              <li><strong>Weight:</strong> 150 lbs</li>
              <li><strong>Room Type:</strong> Living room, Bedroom (comma-separated)</li>
              <li><strong>Design Style:</strong> Modern, Contemporary (comma-separated)</li>
              <li><strong>Key Features:</strong> pet-friendly, casual setting (comma-separated)</li>
              <li><strong>Assembly:</strong> Yes or No</li>
              <li><strong>Inventory:</strong> Number (e.g., 10)</li>
              <li><strong>Lead Time:</strong> Number of days (e.g., 7)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
