import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle, Image, Info } from "lucide-react";
import type { Product } from "@shared/schema";

interface RegenerationResult {
  success: boolean;
  totalProducts: number;
  message: string;
  targetFilter: string;
}

export default function VisualDescriptionsPage() {
  const { toast } = useToast();
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<RegenerationResult | null>(null);
  const [resumeMode, setResumeMode] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/products/regenerate-visual-descriptions', {
        targetFilter,
        resume: resumeMode
      });
      return await response.json() as RegenerationResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setIsProcessing(true);
      toast({
        title: "Reanalysis Started!",
        description: `Processing ${data.totalProducts} products. Check server logs for detailed progress.`,
      });
      
      setTimeout(() => {
        setIsProcessing(false);
      }, data.totalProducts * 600);
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast({
        title: "Reanalysis Failed",
        description: error.message || "Failed to start visual description regeneration",
        variant: "destructive",
      });
    },
  });

  const stats = {
    total: products.length,
    withImages: products.filter(p => p.images && p.images.length > 0).length,
    withDescriptions: products.filter(p => p.visualDescription).length,
    withFrontView: products.filter(p => 
      p.images?.some(url => url.toLowerCase().includes('front'))
    ).length,
    missing: products.filter(p => 
      (p.images && p.images.length > 0) && !p.visualDescription
    ).length,
  };

  const getFilteredCount = () => {
    switch (targetFilter) {
      case 'all':
        return stats.withImages;
      case 'missing':
        return stats.missing;
      case 'front-view-only':
        return stats.withFrontView;
      default:
        return stats.missing;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-visual-descriptions-title">
          Visual Descriptions Reanalysis
        </h1>
        <p className="text-muted-foreground mt-2">
          Regenerate highly accurate visual descriptions using Gemini Vision for perfect AI rendering fidelity
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            Product Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Products</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">{stats.withImages}</div>
              <div className="text-sm text-muted-foreground">With Images</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{stats.withDescriptions}</div>
              <div className="text-sm text-muted-foreground">With Descriptions</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-purple-600">{stats.withFrontView}</div>
              <div className="text-sm text-muted-foreground">With Front View</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-orange-600">{stats.missing}</div>
              <div className="text-sm text-muted-foreground">Missing Descriptions</div>
            </div>
          </div>
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Coverage</span>
              <span className="text-sm font-medium">
                {stats.total > 0 ? ((stats.withDescriptions / stats.total) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <Progress value={stats.total > 0 ? (stats.withDescriptions / stats.total) * 100 : 0} className="mt-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Regenerate Visual Descriptions
          </CardTitle>
          <CardDescription>
            Generate precise, rendering-ready visual descriptions using enhanced Gemini Vision analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Enhanced Analysis System</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                The analysis system now uses an improved prompt that emphasizes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Exact color matching</strong> - Hyper-specific color descriptions for perfect rendering</li>
                <li><strong>Material precision</strong> - Detailed material identification with textures and finishes</li>
                <li><strong>Structural accuracy</strong> - Complete element descriptions for realistic AI generation</li>
                <li><strong>Front-view prioritization</strong> - Automatically selects front-view images when available</li>
              </ul>
              <p className="mt-2 text-sm">
                The goal is 100% rendering fidelity - the AI-generated renders should look identical to the product photos.
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Target Filter</label>
              <Select value={targetFilter} onValueChange={setTargetFilter} data-testid="select-target-filter">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Products with Images ({stats.withImages} products)
                  </SelectItem>
                  <SelectItem value="missing">
                    Only Missing Descriptions ({stats.missing} products)
                  </SelectItem>
                  <SelectItem value="front-view-only">
                    Only Front-View Products ({stats.withFrontView} products)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                Selected filter will process <strong>{getFilteredCount()}</strong> products
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => {
                  setResumeMode(false);
                  regenerateMutation.mutate();
                }}
                disabled={isProcessing || regenerateMutation.isPending}
                size="lg"
                data-testid="button-start-regeneration"
              >
                {isProcessing || regenerateMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start Fresh
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => {
                  setResumeMode(true);
                  regenerateMutation.mutate();
                }}
                disabled={isProcessing || regenerateMutation.isPending || stats.missing === 0}
                variant="outline"
                size="lg"
                data-testid="button-resume-regeneration"
              >
                {isProcessing || regenerateMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Resume ({stats.missing} left)
                  </>
                )}
              </Button>
            </div>
          </div>

          {result && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Reanalysis Job Started</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>{result.message}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary">
                      {result.totalProducts} products
                    </Badge>
                    <Badge variant="outline">
                      Filter: {result.targetFilter}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    The process is running in the background. Monitor server logs for detailed progress updates.
                    Products will be updated as analysis completes.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                1
              </span>
              Image Selection
            </h4>
            <p className="text-sm text-muted-foreground ml-8">
              The system automatically prioritizes front-view images for analysis. If no front-view image is available,
              it selects the best alternative (main, primary, or first available image).
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                2
              </span>
              Gemini Vision Analysis
            </h4>
            <p className="text-sm text-muted-foreground ml-8">
              Each product image is analyzed by Gemini Vision with a comprehensive prompt that extracts exact colors,
              materials, textures, structural details, and proportions - optimized for AI rendering accuracy.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                3
              </span>
              Description Generation
            </h4>
            <p className="text-sm text-muted-foreground ml-8">
              A 300-400 word professional description is generated, focusing on rendering fidelity. The description
              includes exact color specifications, material details, design elements, and unique features.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                4
              </span>
              Database Update
            </h4>
            <p className="text-sm text-muted-foreground ml-8">
              Generated descriptions are stored in the product's visualDescription field, making them immediately
              available for AI-powered room rendering with perfect product fidelity.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
