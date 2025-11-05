import { useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface FloorplanStepProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FloorplanStep({ value, onChange }: FloorplanStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "floorplans");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      onChange(data.url);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload floorplan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      uploadMutation.mutate(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadMutation.mutate(file);
    }
  };

  const removeFloorplan = () => {
    onChange("");
  };

  return (
    <div>
      <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="heading-floorplan">
        Upload your floorplan (optional)
      </h2>
      <p className="text-stone-600 dark:text-stone-400 mb-8">
        A floorplan helps us create a more accurate design. You can skip this if you don't have one.
      </p>

      {!value ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer hover-elevate ${
            isDragging
              ? "border-green-400 bg-green-50 dark:bg-green-950"
              : "border-stone-300 dark:border-stone-600"
          }`}
          data-testid="upload-zone-floorplan"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="floorplan-upload"
          />
          <label htmlFor="floorplan-upload" className="cursor-pointer">
            <FileText className="w-12 h-12 mx-auto mb-4 text-stone-400" />
            <p className="text-lg font-medium mb-2">Drop floorplan here or click to upload</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              PNG, JPG up to 10MB
            </p>
          </label>
        </div>
      ) : (
        <div className="relative inline-block" data-testid="floorplan-preview">
          <img
            src={value}
            alt="Floorplan"
            className="max-w-full h-auto rounded-lg border-2 border-green-300"
          />
          <Button
            variant="destructive"
            size="icon"
            onClick={removeFloorplan}
            className="absolute top-2 right-2"
            data-testid="button-remove-floorplan"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {uploadMutation.isPending && (
        <div className="mt-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
          <Upload className="w-5 h-5 animate-pulse" />
          <span className="text-sm">Uploading floorplan...</span>
        </div>
      )}

      {!value && (
        <div className="mt-6 text-center">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Don't have a floorplan? No problem! You can skip this step and we'll still create a beautiful design for you.
          </p>
        </div>
      )}
    </div>
  );
}
