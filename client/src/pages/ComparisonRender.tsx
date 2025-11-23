import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Image } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ComparisonRender {
  id: string;
  sessionId: string;
  
  geminiImageUrl: string | null;
  geminiGenerationTime: number | null;
  geminiProductCount: number | null;
  geminiStatus: string;
  geminiError: string | null;
  
  openaiImageUrl: string | null;
  openaiGenerationTime: number | null;
  openaiProductCount: number | null;
  openaiStatus: string;
  openaiError: string | null;
  
  stabilityImageUrl: string | null;
  stabilityGenerationTime: number | null;
  stabilityProductCount: number | null;
  stabilityStatus: string;
  stabilityError: string | null;
  
  selectedService: string | null;
  productSkus: string[];
  createdAt: string;
}

export default function ComparisonRender() {
  const [, setLocation] = useLocation();
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  
  // Get or create session ID
  const getSessionId = () => {
    let sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("sessionId", sessionId);
    }
    return sessionId;
  };
  
  const sessionId = getSessionId();
  
  // Trigger comparison render on mount (only once)
  const createComparisonMutation = useMutation({
    mutationFn: async (params: any) => {
      const response = await apiRequest("POST", "/api/render/comparison", params);
      return await response.json();
    },
    onSuccess: (data: ComparisonRender) => {
      setComparisonId(data.id);
    },
    onError: (error: Error) => {
      console.error("Failed to create comparison:", error);
    },
  });
  
  // Poll for comparison updates
  const { data: comparison, isLoading } = useQuery<ComparisonRender>({
    queryKey: [`/api/render/comparison/${comparisonId}`],
    enabled: !!comparisonId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      
      // Stop polling if all services are done (success or failed)
      const allDone = 
        (data.geminiStatus === 'success' || data.geminiStatus === 'failed') &&
        (data.openaiStatus === 'success' || data.openaiStatus === 'failed') &&
        (data.stabilityStatus === 'success' || data.stabilityStatus === 'failed');
      
      return allDone ? false : 2000;
    },
  });
  
  // Start comparison on mount
  useEffect(() => {
    if (!comparisonId) {
      // Get params from location state or localStorage
      const roomImageUrl = localStorage.getItem("roomImageUrl");
      const productSkus = JSON.parse(localStorage.getItem("selectedProductSkus") || "[]");
      const roomType = localStorage.getItem("roomType");
      const style = localStorage.getItem("style");
      
      if (roomImageUrl && productSkus.length > 0) {
        createComparisonMutation.mutate({
          roomImageUrl,
          productSkus,
          sessionId,
          roomType,
          style,
        });
      }
    }
  }, []);
  
  const selectWinnerMutation = useMutation({
    mutationFn: async ({ service, reason }: { service: string; reason?: string }) => {
      if (!comparisonId) return null;
      
      const response = await apiRequest("PATCH", `/api/render/comparison/${comparisonId}`, {
        selectedService: service,
        selectionReason: reason,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/render/comparison/${comparisonId}`] });
    },
  });
  
  const handleSelectWinner = (service: string) => {
    setSelectedService(service);
    selectWinnerMutation.mutate({ 
      service,
      reason: `User selected ${service} as preferred render`
    });
  };
  
  if (createComparisonMutation.isPending || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Comparison Renders
            </CardTitle>
            <CardDescription>
              Testing all three AI services in parallel...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  if (createComparisonMutation.isError || !comparison) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>
              Failed to create comparison render. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/quiz")} data-testid="button-back-to-quiz">
              Back to Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const renderServiceCard = (
    serviceName: string,
    imageUrl: string | null,
    generationTime: number | null,
    productCount: number | null,
    status: string,
    error: string | null
  ) => {
    const isPending = status === 'pending';
    const isSuccess = status === 'success';
    const isFailed = status === 'failed';
    const isSelected = selectedService === serviceName.toLowerCase();
    
    return (
      <Card className={`relative ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{serviceName}</CardTitle>
            {isPending && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />Generating</Badge>}
            {isSuccess && <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>}
            {isFailed && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Render Image */}
          <div className="aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
            {isPending && (
              <div className="text-center text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-2" />
                <p className="text-sm">Generating...</p>
              </div>
            )}
            {isSuccess && imageUrl && (
              <img
                src={imageUrl}
                alt={`${serviceName} render`}
                className="w-full h-full object-cover"
                data-testid={`img-render-${serviceName.toLowerCase()}`}
              />
            )}
            {isFailed && (
              <div className="text-center text-destructive">
                <XCircle className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">{error || 'Generation failed'}</p>
              </div>
            )}
          </div>
          
          {/* Metrics */}
          <div className="space-y-2 text-sm">
            {generationTime !== null && (
              <div className="flex items-center justify-between" data-testid={`text-time-${serviceName.toLowerCase()}`}>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Generation Time:
                </span>
                <span className="font-medium">{(generationTime / 1000).toFixed(1)}s</span>
              </div>
            )}
            {productCount !== null && (
              <div className="flex items-center justify-between" data-testid={`text-products-${serviceName.toLowerCase()}`}>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Image className="h-3 w-3" />
                  Products:
                </span>
                <span className="font-medium">{productCount}</span>
              </div>
            )}
          </div>
          
          {/* Select Button */}
          {isSuccess && (
            <Button
              onClick={() => handleSelectWinner(serviceName.toLowerCase())}
              variant={isSelected ? "default" : "outline"}
              className="w-full"
              disabled={selectWinnerMutation.isPending}
              data-testid={`button-select-${serviceName.toLowerCase()}`}
            >
              {isSelected ? 'Selected ✓' : 'Select This Render'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-title">AI Service Comparison</h1>
            <p className="text-muted-foreground mt-1">
              Compare renders from Gemini, OpenAI, and Stability AI side-by-side
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/results")} data-testid="button-back">
            Back to Results
          </Button>
        </div>
        
        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderServiceCard(
            'Gemini',
            comparison.geminiImageUrl,
            comparison.geminiGenerationTime,
            comparison.geminiProductCount,
            comparison.geminiStatus,
            comparison.geminiError
          )}
          
          {renderServiceCard(
            'OpenAI',
            comparison.openaiImageUrl,
            comparison.openaiGenerationTime,
            comparison.openaiProductCount,
            comparison.openaiStatus,
            comparison.openaiError
          )}
          
          {renderServiceCard(
            'Stability',
            comparison.stabilityImageUrl,
            comparison.stabilityGenerationTime,
            comparison.stabilityProductCount,
            comparison.stabilityStatus,
            comparison.stabilityError
          )}
        </div>
        
        {/* Summary Card */}
        {selectedService && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                <h3 className="text-lg font-semibold">Winner Selected!</h3>
                <p className="text-muted-foreground">
                  You selected <span className="font-medium text-foreground capitalize">{selectedService}</span> as the best render
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
