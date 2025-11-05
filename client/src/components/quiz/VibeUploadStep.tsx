import { useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface VibeUploadStepProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function VibeUploadStep({ value, onChange }: VibeUploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "vibe-images");

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
      onChange([...value, data.url]);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        uploadMutation.mutate(file);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        uploadMutation.mutate(file);
      }
    });
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="heading-vibe">
        Share your inspiration
      </h2>
      <p className="text-stone-600 dark:text-stone-400 mb-8">
        Upload images that capture the vibe you're going for (3-5 images recommended)
      </p>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer hover-elevate ${
          isDragging
            ? "border-green-400 bg-green-50 dark:bg-green-950"
            : "border-stone-300 dark:border-stone-600"
        }`}
        data-testid="upload-zone-vibe"
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="vibe-upload"
        />
        <label htmlFor="vibe-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-4 text-stone-400" />
          <p className="text-lg font-medium mb-2">Drop images here or click to upload</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            PNG, JPG up to 10MB each
          </p>
        </label>
      </div>

      {/* Uploaded Images */}
      {value.length > 0 && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {value.map((url, index) => (
            <div key={index} className="relative group aspect-square" data-testid={`vibe-image-${index}`}>
              <img
                src={url}
                alt={`Vibe ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-remove-vibe-${index}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadMutation.isPending && (
        <div className="mt-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
          <ImageIcon className="w-5 h-5 animate-pulse" />
          <span className="text-sm">Uploading...</span>
        </div>
      )}
    </div>
  );
}
