import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export default function AnalysisDashboard() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!isAuthenticated || !isAdmin) return <div className="p-8">Access denied</div>;

  const analyzeProduct = async (productId: string) => {
    try {
      setAnalyzing(true);
      const response = await fetch(`/api/admin/products/${productId}/analyze-comprehensive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();
      setResults(data);
      
      toast({
        title: "Analysis Complete",
        description: `Score: ${data.analysis.metrics.overallScore}/100 (${data.analysis.metrics.regenerationReadiness})`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Analysis failed",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeBatch = async () => {
    try {
      setAnalyzing(true);
      const response = await fetch("/api/admin/products/analyze-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });

      if (!response.ok) throw new Error("Batch analysis failed");

      const data = await response.json();
      setResults(data);
      
      toast({
        title: "Batch Analysis Complete",
        description: `Analyzed ${data.analyzed} products`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Batch analysis failed",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getReadinessIcon = (readiness: string) => {
    switch (readiness) {
      case "ready":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "caution":
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Product Visual Analysis</h1>
        <p className="text-muted-foreground">
          Analyze products to generate machine-readable visual descriptions for accurate rendering
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Batch Analysis
            </CardTitle>
            <CardDescription>Analyze up to 10 products at once</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={analyzeBatch} 
              disabled={analyzing}
              className="w-full"
            >
              {analyzing ? "Analyzing..." : "Start Batch Analysis"}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Single Product
            </CardTitle>
            <CardDescription>Analyze a specific product by ID</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              placeholder="Paste product ID"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md mb-3 text-sm"
              data-testid="input-product-id"
            />
            <Button 
              onClick={() => selectedProduct && analyzeProduct(selectedProduct)}
              disabled={analyzing || !selectedProduct}
              className="w-full"
              data-testid="button-analyze-single"
            >
              Analyze Product
            </Button>
          </CardContent>
        </Card>
      </div>

      {results && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {results.product && (
              <div className="space-y-2">
                <h3 className="font-semibold">{results.product.name}</h3>
                <p className="text-sm text-muted-foreground">SKU: {results.product.sku}</p>
              </div>
            )}

            {results.analysis && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Overall Score</p>
                    <p className="text-2xl font-bold">{results.analysis.metrics.overallScore}/100</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Readiness</p>
                    <div className="flex items-center gap-2">
                      {getReadinessIcon(results.analysis.metrics.regenerationReadiness)}
                      <p className="text-sm font-semibold capitalize">
                        {results.analysis.metrics.regenerationReadiness}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Images Analyzed</p>
                    <p className="text-2xl font-bold">{results.analysis.imageCount}</p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <p className="font-semibold">Quality Metrics</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Color Accuracy</span>
                      <span className="font-medium">{results.analysis.metrics.colorAccuracy}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dimension Precision</span>
                      <span className="font-medium">{results.analysis.metrics.dimensionPrecision}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Material Specificity</span>
                      <span className="font-medium">{results.analysis.metrics.materialSpecificity}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Texture Detail</span>
                      <span className="font-medium">{results.analysis.metrics.textureDetail}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Feature Completeness</span>
                      <span className="font-medium">{results.analysis.metrics.featureCompleteness}/100</span>
                    </div>
                  </div>
                </div>

                {results.analysis.frontView && (
                  <div className="pt-4 border-t space-y-2 text-sm">
                    <p className="font-semibold">Extracted Attributes</p>
                    <div className="space-y-1">
                      <p><span className="text-muted-foreground">Material:</span> {results.analysis.frontView.primaryMaterial}</p>
                      <p><span className="text-muted-foreground">Color:</span> {results.analysis.frontView.colorAndFinish}</p>
                      {results.analysis.frontView.hexColor && (
                        <p><span className="text-muted-foreground">HEX:</span> {results.analysis.frontView.hexColor}</p>
                      )}
                      {results.analysis.frontView.dimensions && (
                        <p><span className="text-muted-foreground">Dimensions:</span> H:{results.analysis.frontView.dimensions.height}" W:{results.analysis.frontView.dimensions.width}" D:{results.analysis.frontView.dimensions.depth}"</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {results.results && (
              <div className="space-y-3">
                <p className="font-semibold">Batch Results ({results.analyzed} products)</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {results.results.map((result: any) => (
                    <div key={result.id} className="flex justify-between items-center p-2 border border-border rounded-md text-sm">
                      <div>
                        <p className="font-medium">{result.name}</p>
                        <p className="text-xs text-muted-foreground">{result.sku}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.score && (
                          <Badge variant={result.score >= 75 ? "default" : result.score >= 50 ? "secondary" : "destructive"}>
                            {result.score}/100
                          </Badge>
                        )}
                        {result.readiness && getReadinessIcon(result.readiness)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
