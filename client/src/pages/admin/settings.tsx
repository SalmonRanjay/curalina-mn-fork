import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sparkles, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminSettings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [stabilityQCEnabled, setStabilityQCEnabled] = useState(false);
  const [qcStrength, setQcStrength] = useState("0.7");
  
  // Fetch current QC settings
  const { data: qcSettings } = useQuery<{ enabled: boolean; strength: string; hasApiKey: boolean; message: string }>({
    queryKey: ['/api/admin/settings/stability-qc'],
    enabled: isAuthenticated && isAdmin,
  });
  
  useEffect(() => {
    if (qcSettings) {
      setStabilityQCEnabled(qcSettings.enabled || false);
      setQcStrength(qcSettings.strength || "0.7");
    }
  }, [qcSettings]);
  
  // Save QC settings mutation
  const saveQCSettings = useMutation({
    mutationFn: (data: { enabled: boolean; strength: string }) =>
      apiRequest('/api/admin/settings/stability-qc', 'POST', data),
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Stability AI QC settings have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/stability-qc'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save QC settings.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    if (!isLoading && isAuthenticated && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/portal";
      }, 500);
    }
  }, [isAuthenticated, isLoading, isAdmin, toast]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your platform settings and preferences.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Configure basic platform settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site Name</Label>
              <Input
                id="siteName"
                placeholder="Curalina"
                defaultValue="Curalina"
                data-testid="input-site-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteDescription">Site Description</Label>
              <Textarea
                id="siteDescription"
                placeholder="Your comprehensive platform for success"
                rows={3}
                data-testid="input-site-description"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>User Registration</Label>
                <p className="text-sm text-muted-foreground">
                  Allow new users to register
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-registration" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Put the platform in maintenance mode
                </p>
              </div>
              <Switch data-testid="switch-maintenance" />
            </div>

            <div className="pt-4">
              <Button data-testid="button-save-settings">
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Settings</CardTitle>
            <CardDescription>
              Configure email notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From Email</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder="noreply@curalina.com"
                data-testid="input-from-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                placeholder="Curalina Team"
                data-testid="input-from-name"
              />
            </div>

            <div className="pt-4">
              <Button variant="outline" data-testid="button-save-email">
                Save Email Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Render Settings
            </CardTitle>
            <CardDescription>
              Configure AI-powered render generation and quality control
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Stability AI Quality Control uses ControlNet to ensure furniture in renders matches actual product images exactly.
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Stability AI Quality Control</Label>
                <p className="text-sm text-muted-foreground">
                  Apply QC refinement to ensure accurate product representation
                </p>
              </div>
              <Switch 
                checked={stabilityQCEnabled}
                onCheckedChange={setStabilityQCEnabled}
                data-testid="switch-stability-qc" 
              />
            </div>

            {stabilityQCEnabled && (
              <div className="space-y-2">
                <Label htmlFor="qcStrength">Control Strength ({qcStrength})</Label>
                <Input
                  id="qcStrength"
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.1"
                  value={qcStrength}
                  onChange={(e) => setQcStrength(e.target.value)}
                  className="w-full"
                  data-testid="slider-qc-strength"
                />
                <p className="text-xs text-muted-foreground">
                  Higher values preserve more structure from the base render
                </p>
              </div>
            )}

            <div className="pt-4">
              <Button 
                onClick={() => saveQCSettings.mutate({ 
                  enabled: stabilityQCEnabled, 
                  strength: qcStrength 
                })}
                disabled={saveQCSettings.isPending}
                data-testid="button-save-qc-settings"
              >
                {saveQCSettings.isPending ? "Saving..." : "Save QC Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
