import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface MappingAnalysis {
  roomTypes: {
    quizOptions: string[];
    productValues: Array<{ value: string; count: number }>;
    coverage: number;
    unmapped: string[];
  };
  styles: {
    quizOptions: string[];
    productValues: Array<{ value: string; count: number }>;
    coverage: number;
    unmapped: string[];
  };
  features: {
    quizOptions: string[];
    productValues: Array<{ value: string; count: number }>;
    coverage: number;
    unmapped: string[];
  };
  colors: {
    quizOptions: string[];
    productValues: Array<{ value: string; count: number }>;
    topColors: Array<{ value: string; count: number }>;
  };
  summary: {
    totalProducts: number;
    productsWithRoomType: number;
    productsWithStyle: number;
    productsWithFeatures: number;
    productsWithColors: number;
    avgMatchScore: number;
  };
  gaps: {
    productsWithoutRoomType: number;
    productsWithoutStyle: number;
    productsWithoutFeatures: number;
    productsWithoutColors: number;
    productsWithMismatchedRoomType: Array<{ id: string; sku: string; name: string; roomType: string[] }>;
    productsWithMismatchedStyle: Array<{ id: string; sku: string; name: string; designStyle: string[] }>;
  };
}

export default function MappingAnalysis() {
  const { toast } = useToast();
  
  const { data: analysis, isLoading, refetch } = useQuery<MappingAnalysis>({
    queryKey: ["/api/admin/mapping-analysis"],
  });

  const normalizeRoomTypesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/mapping-analysis/normalize-room-types");
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Room types normalized",
        description: `Updated ${data.updatedCount} products`,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Normalization failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const normalizeStylesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/mapping-analysis/normalize-design-styles");
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Design styles normalized",
        description: `Added style tags to ${data.updatedCount} products`,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Normalization failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No analysis data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quiz-to-Product Mapping Analysis</h1>
          <p className="text-muted-foreground">
            Analyze how quiz questions map to product database values and identify gaps
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => normalizeRoomTypesMutation.mutate()}
            disabled={normalizeRoomTypesMutation.isPending}
            variant="outline"
            size="sm"
            data-testid="button-normalize-room-types"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${normalizeRoomTypesMutation.isPending ? 'animate-spin' : ''}`} />
            Fix Room Types
          </Button>
          <Button
            onClick={() => normalizeStylesMutation.mutate()}
            disabled={normalizeStylesMutation.isPending}
            variant="outline"
            size="sm"
            data-testid="button-normalize-styles"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${normalizeStylesMutation.isPending ? 'animate-spin' : ''}`} />
            Map Styles
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analysis.summary.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Room Type Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analysis.roomTypes.coverage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysis.summary.productsWithRoomType} products mapped
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Style Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analysis.styles.coverage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysis.summary.productsWithStyle} products mapped
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Feature Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analysis.features.coverage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysis.summary.productsWithFeatures} products mapped
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mapping Tables */}
      <Tabs defaultValue="room-types" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="room-types">Room Types</TabsTrigger>
          <TabsTrigger value="styles">Styles</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="gaps">Gaps & Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="room-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Room Type Mapping</CardTitle>
              <CardDescription>
                Quiz options vs product database values
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Quiz Options</h3>
                  <div className="space-y-2">
                    {analysis.roomTypes.quizOptions.map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <Badge variant="outline">{option}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Product Database Values</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Value</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.roomTypes.productValues.map((pv) => (
                        <TableRow key={pv.value}>
                          <TableCell>{pv.value}</TableCell>
                          <TableCell className="text-right">{pv.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {analysis.roomTypes.unmapped.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">
                        Unmapped Values
                      </h4>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                        These product values don't match any quiz options:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analysis.roomTypes.unmapped.map((val) => (
                          <Badge key={val} variant="secondary">{val}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="styles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Design Style Mapping</CardTitle>
              <CardDescription>
                Quiz options vs product database values
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Quiz Options</h3>
                  <div className="space-y-2">
                    {analysis.styles.quizOptions.map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <Badge variant="outline">{option}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Product Database Values</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Value</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.styles.productValues.map((pv) => (
                        <TableRow key={pv.value}>
                          <TableCell>{pv.value}</TableCell>
                          <TableCell className="text-right">{pv.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {analysis.styles.unmapped.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">
                        Unmapped Values
                      </h4>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                        These product styles don't match any quiz options:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analysis.styles.unmapped.map((val) => (
                          <Badge key={val} variant="secondary">{val}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Mapping</CardTitle>
              <CardDescription>
                Quiz features vs product key features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Quiz Options</h3>
                  <div className="space-y-2">
                    {analysis.features.quizOptions.map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <Badge variant="outline">{option}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Product Database Values (Top 20)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Value</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.features.productValues.slice(0, 20).map((pv) => (
                        <TableRow key={pv.value}>
                          <TableCell className="text-sm">{pv.value}</TableCell>
                          <TableCell className="text-right">{pv.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Quality Issues</CardTitle>
              <CardDescription>
                Products with missing or mismatched data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="font-semibold text-red-900 dark:text-red-100">
                      Missing Room Type
                    </h4>
                  </div>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {analysis.gaps.productsWithoutRoomType}
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">products</p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="font-semibold text-red-900 dark:text-red-100">
                      Missing Design Style
                    </h4>
                  </div>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {analysis.gaps.productsWithoutStyle}
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">products</p>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100">
                      Missing Features
                    </h4>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {analysis.gaps.productsWithoutFeatures}
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-200">products</p>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100">
                      Missing Colors
                    </h4>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {analysis.gaps.productsWithoutColors}
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-200">products</p>
                </div>
              </div>

              {analysis.gaps.productsWithMismatchedRoomType.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Sample Products with Mismatched Room Types</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Room Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.gaps.productsWithMismatchedRoomType.slice(0, 10).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.roomType.map((rt) => (
                                <Badge key={rt} variant="secondary" className="text-xs">
                                  {rt}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
