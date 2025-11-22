import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  errors: string[];
  details?: string;
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string;
}

interface FilePreview {
  columns: string[];
  sampleData: any[];
}

export default function CSVImportPage() {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);

  // Preview file mutation to show column mapping
  const previewFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/products/preview-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Preview failed');
      }

      return response.json();
    },
    onSuccess: (data: FilePreview) => {
      setFilePreview(data);
      // Initialize mappings with auto-detected matches
      const initialMappings = data.columns.map(col => ({
        csvColumn: col,
        targetField: autoMapColumn(col)
      }));
      setColumnMappings(initialMappings);
      setShowMappingDialog(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Preview Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, mappings }: { file: File; mappings: ColumnMapping[] }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mappings', JSON.stringify(mappings));

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
          description: `Created ${result.imported} new products. Updated ${result.updated} existing products.`,
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

  // Auto-map CSV column names to target fields
  const autoMapColumn = (csvColumn: string): string => {
    // Clean up the column name by removing extra whitespace and line breaks
    const cleaned = csvColumn.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
    
    // Exact matches
    const exactMappings: Record<string, string> = {
      'product name': 'Product Name',
      'name': 'Product Name',
      'sku': 'SKU',
      'item number': 'SKU',
      'item #': 'SKU',
      'item#': 'SKU',
      'overview': 'Overview',
      'description': 'Overview',
      'supplier': 'Supplier',
      'furniture category': 'Furniture Category',
      'category': 'Furniture Category',
      'room type': 'Room Type',
      'design style': 'Design Style',
      'style': 'Design Style',
      'key features': 'Key Features',
      'features': 'Key Features',
      'storage solutions': 'Storage Solutions',
      'storage': 'Storage Solutions',
      'colour': 'Colour',
      'color': 'Colour',
      'product material': 'Product Materials',
      'product materials': 'Product Materials',
      'material': 'Product Materials',
      'materials': 'Product Materials',
      'inventory': 'Inventory',
      'stock': 'Inventory',
      'trade price': 'Trade Price',
      'general dimensions (inch)': 'Dimensions (Inch) Width x Depth x Height',
      'general dimensions': 'Dimensions (Inch) Width x Depth x Height',
      'dimensions (inch)': 'Dimensions (Inch) Width x Depth x Height',
      'dimensions': 'Dimensions (Inch) Width x Depth x Height',
      'dimensions (inch) width x depth x height': 'Dimensions (Inch) Width x Depth x Height',
      'retail price': 'Retail Price',
      'price': 'Retail Price',
      'seat height': 'Seat Height',
      'dimensions (height)': 'Dimensions (Height)',
      'height': 'Dimensions (Height)',
      'dimensions (width)': 'Dimensions (Width)',
      'width': 'Dimensions (Width)',
      'dimensions (depth)': 'Dimensions (Depth)',
      'depth': 'Dimensions (Depth)',
      'arm width': 'Arm Width',
      'arm depth': 'Arm Depth',
      'seat width': 'Seat Width',
      'seat depth': 'Seat Depth',
      'seating': 'Seating',
      'assembly': 'Assembly',
      'lead time': 'Lead Time',
      'delivery options': 'Delivery Options',
      'delivery location': 'Delivery Location',
      'delivery policy': 'Delivery Policy',
      'tags': 'Tags',
      'weight': 'Weight (lbs)',
      'weight (lbs)': 'Weight (lbs)',
      'volume': 'Volume',
      'door width': 'Door Width',
      'door thickness': 'Door Thickness',
      'door height': 'Door Height',
      'leg/base depth 1': 'Leg/Base Depth 1',
      'leg base depth 1': 'Leg/Base Depth 1',
      'leg/base height 1': 'Leg/Base Height 1',
      'leg base height 1': 'Leg/Base Height 1',
      'leg/base width 1': 'Leg/Base Width 1',
      'leg base width 1': 'Leg/Base Width 1',
      'tabletop thickness': 'Tabletop Thickness',
      'shape type': 'Shape Type',
    };
    
    return exactMappings[cleaned] || '';
  };

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
        setPendingFile(files[0]);
        previewFileMutation.mutate(files[0]);
      }
    },
  });

  const handleConfirmImport = () => {
    if (pendingFile) {
      setShowMappingDialog(false);
      setUploadProgress(10);
      importMutation.mutate({ file: pendingFile, mappings: columnMappings });
    }
  };

  const downloadTemplate = () => {
    // Helper function to escape CSV fields properly
    const escapeCsvField = (field: string): string => {
      // If field contains comma, newline, or quote, wrap in quotes and escape internal quotes
      if (field.includes(',') || field.includes('\n') || field.includes('"') || field.includes('\r')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    // CSV template with 12 required fields + 26 optional fields
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
      // 🟨 OPTIONAL FIELDS (26)
      'Trade Price',
      'Retail Price',
      'Dimensions (Height)',
      'Dimensions (Width)',
      'Dimensions (Depth)',
      'Arm Width',
      'Arm Depth',
      'Seat Width',
      'Seat Depth',
      'Volume',
      'Door Width',
      'Door Thickness',
      'Door Height',
      'Leg/Base Depth 1',
      'Leg/Base Height 1',
      'Leg/Base Width 1',
      'Tabletop Thickness',
      'Shape Type',
      'Seating',
      'Assembly',
      'Lead Time',
      'Delivery Options',
      'Delivery Location',
      'Delivery Policy',
      'Tags',
      'Weight (lbs)'
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
      // OPTIONAL (26 fields)
      '1199.00',           // Trade Price
      '1499.00',           // Retail Price
      '32',                // Dimensions (Height)
      '84',                // Dimensions (Width)
      '36',                // Dimensions (Depth)
      '10',                // Arm Width
      '32',                // Arm Depth
      '60',                // Seat Width
      '24',                // Seat Depth
      '98',                // Volume
      '28',                // Door Width
      '2',                 // Door Thickness
      '72',                // Door Height
      '8',                 // Leg/Base Depth 1
      '4',                 // Leg/Base Height 1
      '6',                 // Leg/Base Width 1
      '1.5',               // Tabletop Thickness
      'Round',             // Shape Type
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
            CSV template with 12 required fields and 26 optional fields. Download and fill in all required fields for each product.
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
                <li>• Product Materials</li>
                <li>• Inventory</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-yellow-700 dark:text-yellow-400">🟨 Optional Fields (26)</h4>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>• Trade Price, Retail Price</li>
                <li>• Dimensions (Height, Width, Depth)</li>
                <li>• Arm Width, Arm Depth</li>
                <li>• Seat Width, Seat Depth</li>
                <li>• Volume, Door Width, Door Thickness, Door Height</li>
                <li>• Leg/Base Depth 1, Height 1, Width 1</li>
                <li>• Tabletop Thickness, Shape Type</li>
                <li>• Seating</li>
                <li>• Assembly</li>
                <li>• Lead Time</li>
                <li>• Delivery Options, Location, Policy</li>
                <li>• Tags, Weight (lbs)</li>
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
                <p className="text-sm text-muted-foreground">Updated (Existing Products)</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-updated-count">
                  {importResult.updated}
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

      {/* Column Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Map CSV Columns</DialogTitle>
            <DialogDescription>
              Match your CSV columns to the expected fields. Auto-detected mappings are shown.
            </DialogDescription>
          </DialogHeader>
          
          {filePreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm font-medium border-b pb-2">
                <div>Your CSV Column</div>
                <div>Maps To</div>
              </div>
              
              {filePreview.columns.map((csvCol, index) => (
                <div key={csvCol} className="grid grid-cols-2 gap-4 items-center">
                  <div className="font-mono text-sm p-2 bg-muted rounded">{csvCol}</div>
                  <Select
                    value={columnMappings[index]?.targetField || '_skip_'}
                    onValueChange={(value) => {
                      const newMappings = [...columnMappings];
                      newMappings[index] = { csvColumn: csvCol, targetField: value === '_skip_' ? '' : value };
                      setColumnMappings(newMappings);
                    }}
                  >
                    <SelectTrigger data-testid={`select-mapping-${index}`}>
                      <SelectValue placeholder="Skip this column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip_">Skip (Don't Import)</SelectItem>
                      <SelectItem value="Product Name">Product Name</SelectItem>
                      <SelectItem value="SKU">SKU</SelectItem>
                      <SelectItem value="Overview">Overview</SelectItem>
                      <SelectItem value="Supplier">Supplier</SelectItem>
                      <SelectItem value="Furniture Category">Furniture Category</SelectItem>
                      <SelectItem value="Room Type">Room Type</SelectItem>
                      <SelectItem value="Design Style">Design Style</SelectItem>
                      <SelectItem value="Key Features">Key Features</SelectItem>
                      <SelectItem value="Storage Solutions">Storage Solutions</SelectItem>
                      <SelectItem value="Colour">Colour</SelectItem>
                      <SelectItem value="Product Materials">Product Materials</SelectItem>
                      <SelectItem value="Inventory">Inventory</SelectItem>
                      <SelectItem value="Trade Price">Trade Price</SelectItem>
                      <SelectItem value="Retail Price">Retail Price</SelectItem>
                      <SelectItem value="Dimensions (Inch) Width x Depth x Height">Dimensions (Inch) Width x Depth x Height</SelectItem>
                      <SelectItem value="Dimensions (Height)">Dimensions (Height)</SelectItem>
                      <SelectItem value="Dimensions (Width)">Dimensions (Width)</SelectItem>
                      <SelectItem value="Dimensions (Depth)">Dimensions (Depth)</SelectItem>
                      <SelectItem value="Arm Width">Arm Width</SelectItem>
                      <SelectItem value="Arm Depth">Arm Depth</SelectItem>
                      <SelectItem value="Seat Width">Seat Width</SelectItem>
                      <SelectItem value="Seat Depth">Seat Depth</SelectItem>
                      <SelectItem value="Seat Height">Seat Height</SelectItem>
                      <SelectItem value="Volume">Volume</SelectItem>
                      <SelectItem value="Door Width">Door Width</SelectItem>
                      <SelectItem value="Door Thickness">Door Thickness</SelectItem>
                      <SelectItem value="Door Height">Door Height</SelectItem>
                      <SelectItem value="Leg/Base Depth 1">Leg/Base Depth 1</SelectItem>
                      <SelectItem value="Leg/Base Height 1">Leg/Base Height 1</SelectItem>
                      <SelectItem value="Leg/Base Width 1">Leg/Base Width 1</SelectItem>
                      <SelectItem value="Tabletop Thickness">Tabletop Thickness</SelectItem>
                      <SelectItem value="Shape Type">Shape Type</SelectItem>
                      <SelectItem value="Seating">Seating</SelectItem>
                      <SelectItem value="Assembly">Assembly</SelectItem>
                      <SelectItem value="Lead Time">Lead Time</SelectItem>
                      <SelectItem value="Delivery Options">Delivery Options</SelectItem>
                      <SelectItem value="Delivery Location">Delivery Location</SelectItem>
                      <SelectItem value="Delivery Policy">Delivery Policy</SelectItem>
                      <SelectItem value="Tags">Tags</SelectItem>
                      <SelectItem value="Weight (lbs)">Weight (lbs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              
              {filePreview.sampleData.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-2">Sample Data Preview</h4>
                  <div className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                    {JSON.stringify(filePreview.sampleData[0], null, 2)}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)} data-testid="button-cancel-mapping">
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} data-testid="button-confirm-import">
              Import with Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <span className="text-muted-foreground">Overview, Trade Price, Room Type, Design Style, Key Features, Storage Solutions, Dimensions (Height, Width, Depth), Volume, Door Width, Door Thickness, Door Height, Leg/Base Depth 1, Leg/Base Height 1, Leg/Base Width 1, Tabletop Thickness, Shape Type, Weight (lbs), Colour, Product Materials, Assembly, Lead Time, Inventory, Tags</span>
            </div>
          </div>
          
          <div className="pt-4 border-t space-y-2">
            <p className="text-sm font-medium">Format Examples:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Prices:</strong> 1299.99 (without $)</li>
              <li><strong>Colors/Materials:</strong> Black, Brown, White (comma-separated)</li>
              <li><strong>Dimensions:</strong> 84" W X 36" D X 32" H</li>
              <li><strong>Weight (lbs):</strong> 150 lbs</li>
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
