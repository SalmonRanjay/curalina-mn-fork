import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, XCircle, RefreshCw, CheckCircle2, TrendingUp, Lightbulb } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function MappingAnalysis() {
  const { toast } = useToast();

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ['/api/admin/mapping-analysis'],
  });

  const normalizeRoomTypesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/mapping-analysis/normalize-room-types', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to normalize room types');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mapping-analysis'] });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const normalizeStylesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/mapping-analysis/normalize-design-styles', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to normalize styles');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mapping-analysis'] });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="p-8">
        <Card className="bg-red-50 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="text-red-900 dark:text-red-100">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-800 dark:text-red-200">Failed to load analysis data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-mapping-analysis">Quiz Mapping & Optimization Analysis</h1>
          <p className="text-muted-foreground">
            Analyze product coverage, identify gaps, and optimize filter combinations
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
            <div className="text-3xl font-bold" data-testid="text-total-products">{analysis.summary.totalProducts}</div>
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
            <CardTitle className="text-sm font-medium">Avg Match Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analysis.summary.avgMatchScore}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Overall data quality
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actionable Recommendations */}
      {analysis.recommendations && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <CardTitle>Actionable Recommendations</CardTitle>
            </div>
            <CardDescription>Top priorities to improve product selection and data quality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-sm">🎯 Acquisition Priorities</h4>
              <div className="space-y-1">
                {analysis.recommendations.acquisition.map((rec: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-sm">🔧 Data Quality Improvements</h4>
              <div className="space-y-1">
                {analysis.recommendations.dataQuality.map((rec: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-sm">✅ Best Filter Combinations</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.recommendations.bestFilters.map((filter: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Tabs */}
      <Tabs defaultValue="room-types" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="room-types" data-testid="tab-room-types">Room Types</TabsTrigger>
          <TabsTrigger value="styles" data-testid="tab-styles">Styles</TabsTrigger>
          <TabsTrigger value="color-palettes" data-testid="tab-color-palettes">Color Palettes</TabsTrigger>
          <TabsTrigger value="composition" data-testid="tab-composition">Composition</TabsTrigger>
          <TabsTrigger value="filters" data-testid="tab-filters">Filter Optimization</TabsTrigger>
          <TabsTrigger value="gaps" data-testid="tab-gaps">Data Gaps</TabsTrigger>
        </TabsList>

        <TabsContent value="room-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Room Type Mapping</CardTitle>
              <CardDescription>Quiz options vs product database values</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Quiz Options</h3>
                  <div className="space-y-2">
                    {analysis.roomTypes.quizOptions.map((option: string) => (
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
                      {analysis.roomTypes.productValues.map((pv: any) => (
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
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">Unmapped Values</h4>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                        These product values don't match any quiz options:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analysis.roomTypes.unmapped.map((val: string) => (
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
              <CardDescription>Quiz options vs product database values</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Quiz Options</h3>
                  <div className="space-y-2">
                    {analysis.styles.quizOptions.map((option: string) => (
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
                      {analysis.styles.productValues.map((pv: any) => (
                        <TableRow key={pv.value}>
                          <TableCell>{pv.value}</TableCell>
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

        <TabsContent value="color-palettes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Color Palette Coverage</CardTitle>
              <CardDescription>How well products match each color palette option</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Palette</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Colors</TableHead>
                    <TableHead className="text-right">Coverage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.colorPalettes?.paletteCoverage?.map((p: any) => (
                    <TableRow key={p.palette}>
                      <TableCell className="font-medium">{p.palette}</TableCell>
                      <TableCell className="text-right">{p.productsCount}</TableCell>
                      <TableCell className="text-right">{p.uniqueColors}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.coverage >= 20 ? "default" : "destructive"}>
                          {p.coverage}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {analysis.colorPalettes?.lowCoveragePalettes?.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900 dark:text-red-100">Low Coverage Palettes</h4>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                        These palettes need more product coverage:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analysis.colorPalettes.lowCoveragePalettes.map((p: any) => (
                          <Badge key={p.palette} variant="secondary">
                            {p.palette} ({p.coverage}%)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="composition" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Functional Category Breakdown</CardTitle>
              <CardDescription>Product distribution across furniture roles</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.composition?.categoryBreakdown?.map((cat: any) => (
                    <TableRow key={cat.category}>
                      <TableCell className="font-medium">{cat.category}</TableCell>
                      <TableCell className="text-right">{cat.count}</TableCell>
                      <TableCell className="text-right">{cat.percentage}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-medium">Uncategorized</TableCell>
                    <TableCell className="text-right">{analysis.composition?.uncategorized || 0}</TableCell>
                    <TableCell className="text-right">
                      {Math.round((analysis.composition?.uncategorized || 0) / analysis.summary.totalProducts * 100)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {analysis.composition?.uncategorized > 0 && (
                <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {analysis.composition.uncategorized} products are not assigned to any functional category
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Room Composition Requirements</CardTitle>
              <CardDescription>Essential and recommended items per room type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(analysis.composition?.roomCompositionNeeds || {}).map(([roomType, needs]: [string, any]) => (
                <div key={roomType}>
                  <h4 className="font-semibold mb-3">{roomType}</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium mb-1">Essential Items:</p>
                      {needs.essential.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-1">
                          <span className="text-muted-foreground">{item.category}</span>
                          <Badge variant={item.current >= item.min ? "default" : "destructive"}>
                            {item.current} / {item.min} min
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Recommended Items:</p>
                      {needs.recommended.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-1">
                          <span className="text-muted-foreground">{item.category}</span>
                          <Badge variant={item.current >= item.target ? "default" : "secondary"}>
                            {item.current} / {item.target} target
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Best Filter Combinations</CardTitle>
              <CardDescription>Top-performing Room Type × Style combinations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.filterOptimization?.bestCombinations?.map((combo: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{combo.roomType}</TableCell>
                      <TableCell>{combo.style}</TableCell>
                      <TableCell className="text-right">{combo.productCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Viable
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weak Filter Combinations</CardTitle>
              <CardDescription>Combinations with insufficient products (less than 10)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.filterOptimization?.weakCombinations?.map((combo: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{combo.roomType}</TableCell>
                      <TableCell>{combo.style}</TableCell>
                      <TableCell className="text-right">{combo.productCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          Needs more
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Room Type Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Type</TableHead>
                      <TableHead className="text-right">Total Products</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.filterOptimization?.roomTypeCoverage?.map((rt: any) => (
                      <TableRow key={rt.roomType}>
                        <TableCell>{rt.roomType}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={rt.viable ? "default" : "destructive"}>
                            {rt.totalProducts}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Style Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Style</TableHead>
                      <TableHead className="text-right">Total Products</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.filterOptimization?.styleCoverage?.map((s: any) => (
                      <TableRow key={s.style}>
                        <TableCell>{s.style}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={s.viable ? "default" : "destructive"}>
                            {s.totalProducts}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Quality Issues</CardTitle>
              <CardDescription>Products with missing or mismatched data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="font-semibold text-red-900 dark:text-red-100">Missing Room Type</h4>
                  </div>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {analysis.gaps.productsWithoutRoomType}
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">products</p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="font-semibold text-red-900 dark:text-red-100">Missing Design Style</h4>
                  </div>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {analysis.gaps.productsWithoutStyle}
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">products</p>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100">Missing Features</h4>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {analysis.gaps.productsWithoutFeatures}
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-200">products</p>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100">Missing Colors</h4>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {analysis.gaps.productsWithoutColors}
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-200">products</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
