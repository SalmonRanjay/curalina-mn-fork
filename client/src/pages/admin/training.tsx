import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type DesignExample = {
  id: string;
  type: 'good' | 'bad';
  roomType: string;
  styles: string[];
  imageUrl: string;
  title: string;
  description: string;
  reasoning: string;
  designPrinciples: string[];
  tags: string[];
  createdAt: string;
};

type ProductPackage = {
  id: string;
  name: string;
  description: string;
  roomType: string;
  styles: string[];
  productSkus: string[];
  imageUrl: string;
  priceRange: string;
  designNotes: string;
  tags: string[];
  active: boolean;
  createdAt: string;
};

type PlacementGuideline = {
  id: string;
  productCategory: string;
  roomType: string;
  guideline: string;
  doExamples: string[];
  dontExamples: string[];
  imageUrl: string;
  priority: number;
  reasoning: string;
  tags: string[];
  createdAt: string;
};

type DesignRule = {
  id: string;
  category: string;
  rule: string;
  description: string;
  examples: string[];
  counterExamples: string[];
  priority: number;
  applicableRooms: string[];
  applicableStyles: string[];
  active: boolean;
  createdAt: string;
};

export default function AdminTrainingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("design-examples");

  // Design Examples
  const { data: designExamples = [] } = useQuery<DesignExample[]>({
    queryKey: ['/api/admin/design-examples'],
  });

  const createDesignExampleMutation = useMutation({
    mutationFn: async (data: Partial<DesignExample>) =>
      await apiRequest("/api/admin/design-examples", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/design-examples'] });
      toast({ title: "Design example created successfully" });
    },
  });

  const deleteDesignExampleMutation = useMutation({
    mutationFn: async (id: string) =>
      await apiRequest(`/api/admin/design-examples/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/design-examples'] });
      toast({ title: "Design example deleted" });
    },
  });

  // Product Packages
  const { data: productPackages = [] } = useQuery<ProductPackage[]>({
    queryKey: ['/api/admin/product-packages'],
  });

  const createProductPackageMutation = useMutation({
    mutationFn: async (data: Partial<ProductPackage>) =>
      await apiRequest("/api/admin/product-packages", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/product-packages'] });
      toast({ title: "Product package created successfully" });
    },
  });

  const deleteProductPackageMutation = useMutation({
    mutationFn: async (id: string) =>
      await apiRequest(`/api/admin/product-packages/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/product-packages'] });
      toast({ title: "Product package deleted" });
    },
  });

  // Placement Guidelines
  const { data: placementGuidelines = [] } = useQuery<PlacementGuideline[]>({
    queryKey: ['/api/admin/placement-guidelines'],
  });

  const createPlacementGuidelineMutation = useMutation({
    mutationFn: async (data: Partial<PlacementGuideline>) =>
      await apiRequest("/api/admin/placement-guidelines", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/placement-guidelines'] });
      toast({ title: "Placement guideline created successfully" });
    },
  });

  const deletePlacementGuidelineMutation = useMutation({
    mutationFn: async (id: string) =>
      await apiRequest(`/api/admin/placement-guidelines/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/placement-guidelines'] });
      toast({ title: "Placement guideline deleted" });
    },
  });

  // Design Rules
  const { data: designRules = [] } = useQuery<DesignRule[]>({
    queryKey: ['/api/admin/design-rules'],
  });

  const createDesignRuleMutation = useMutation({
    mutationFn: async (data: Partial<DesignRule>) =>
      await apiRequest("/api/admin/design-rules", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/design-rules'] });
      toast({ title: "Design rule created successfully" });
    },
  });

  const deleteDesignRuleMutation = useMutation({
    mutationFn: async (id: string) =>
      await apiRequest(`/api/admin/design-rules/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/design-rules'] });
      toast({ title: "Design rule deleted" });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Training Data</h1>
        <p className="text-muted-foreground mt-2">
          Manage training data to improve AI design generation and product selection
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="design-examples" data-testid="tab-design-examples">
            Design Examples
          </TabsTrigger>
          <TabsTrigger value="product-packages" data-testid="tab-product-packages">
            Product Packages
          </TabsTrigger>
          <TabsTrigger value="placement-guidelines" data-testid="tab-placement-guidelines">
            Placement Rules
          </TabsTrigger>
          <TabsTrigger value="design-rules" data-testid="tab-design-rules">
            Design Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design-examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Design Examples</CardTitle>
              <CardDescription>
                Add good and bad design examples to train the AI on what works and what doesn't
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {designExamples.map((example) => (
                  <Card key={example.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={example.type === 'good' ? 'default' : 'destructive'}>
                              {example.type === 'good' ? 'Good Example' : 'Bad Example'}
                            </Badge>
                            <Badge variant="outline">{example.roomType}</Badge>
                          </div>
                          <h4 className="font-semibold">{example.title}</h4>
                          <p className="text-sm text-muted-foreground">{example.reasoning}</p>
                          {example.imageUrl && (
                            <img
                              src={example.imageUrl}
                              alt={example.title}
                              className="w-48 h-32 object-cover rounded"
                            />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDesignExampleMutation.mutate(example.id)}
                          data-testid={`delete-example-${example.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Total Examples: {designExamples.length}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product-packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Packages</CardTitle>
              <CardDescription>
                Create curated product combinations that work well together
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {productPackages.map((pkg) => (
                  <Card key={pkg.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{pkg.name}</h4>
                            <Badge variant="outline">{pkg.roomType}</Badge>
                            {pkg.active && <Badge variant="default">Active</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{pkg.description}</p>
                          <p className="text-sm">Products: {pkg.productSkus?.length || 0}</p>
                          {pkg.priceRange && (
                            <p className="text-sm font-medium">{pkg.priceRange}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProductPackageMutation.mutate(pkg.id)}
                          data-testid={`delete-package-${pkg.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Total Packages: {productPackages.length}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="placement-guidelines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Placement Guidelines</CardTitle>
              <CardDescription>
                Define rules for how products should be placed in rooms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {placementGuidelines.map((guideline) => (
                  <Card key={guideline.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge>{guideline.productCategory}</Badge>
                            <Badge variant="outline">{guideline.roomType}</Badge>
                            <Badge variant="secondary">Priority: {guideline.priority}</Badge>
                          </div>
                          <p className="font-medium">{guideline.guideline}</p>
                          {guideline.reasoning && (
                            <p className="text-sm text-muted-foreground">{guideline.reasoning}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePlacementGuidelineMutation.mutate(guideline.id)}
                          data-testid={`delete-guideline-${guideline.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Total Guidelines: {placementGuidelines.length}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design-rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Design Rules</CardTitle>
              <CardDescription>
                General design principles and rules for the AI to follow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {designRules.map((rule) => (
                  <Card key={rule.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge>{rule.category}</Badge>
                            <Badge variant="secondary">Priority: {rule.priority}</Badge>
                            {rule.active && <Badge variant="default">Active</Badge>}
                          </div>
                          <p className="font-medium">{rule.rule}</p>
                          {rule.description && (
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDesignRuleMutation.mutate(rule.id)}
                          data-testid={`delete-rule-${rule.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Total Rules: {designRules.length}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Usage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{designExamples.length}</p>
              <p className="text-sm text-muted-foreground">Design Examples</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{productPackages.length}</p>
              <p className="text-sm text-muted-foreground">Product Packages</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{placementGuidelines.length}</p>
              <p className="text-sm text-muted-foreground">Placement Guidelines</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{designRules.length}</p>
              <p className="text-sm text-muted-foreground">Design Rules</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
