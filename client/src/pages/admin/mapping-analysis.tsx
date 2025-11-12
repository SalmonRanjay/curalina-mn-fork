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

  return null;
}
