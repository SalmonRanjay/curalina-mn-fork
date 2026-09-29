import { motion } from "framer-motion";
import { Upload, Link, X, Image } from "lucide-react";
import Dropzone from "react-dropzone";
import { Button } from "@/components/ui/button";

interface VibeCheckStepV2Props {
  vibeImages: string[];
  onUpload: (files: File[]) => void;
  onRemove: (index: number) => void;
  isUploading: boolean;
}

export function VibeCheckStepV2({
  vibeImages,
  onUpload,
  onRemove,
  isUploading,
}: VibeCheckStepV2Props) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <p
          className="uppercase tracking-widest text-muted-foreground mb-3"
          style={{ fontSize: "var(--font-size-xs)" }}
        >
          Inspiration Board
        </p>
        <h2
          className="font-serif text-foreground mb-4"
          style={{ fontSize: "var(--font-size-3xl)", fontWeight: 400 }}
        >
          You Bring the Vibe
        </h2>
        <p
          className="text-muted-foreground max-w-xl mx-auto"
          style={{ fontSize: "var(--font-size-base)" }}
        >
          Share images that inspire you — from Pinterest boards to magazine clippings. 
          We'll design a space that captures your unique aesthetic.
        </p>
      </div>

      <Dropzone
        onDrop={onUpload}
        accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
        multiple
        disabled={isUploading}
      >
        {({ getRootProps, getInputProps, isDragActive }) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed transition-all duration-300 cursor-pointer ${
                isDragActive
                  ? "border-foreground bg-accent/5"
                  : "border-border hover:border-foreground/50"
              }`}
              data-testid="vibe-upload-area"
            >
            <input {...getInputProps()} />
            <div className="p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full border border-border flex items-center justify-center">
                {isUploading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </motion.div>
                ) : (
                  <Image className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <p
                className="font-medium text-foreground mb-2"
                style={{ fontSize: "var(--font-size-lg)" }}
              >
                {isUploading
                  ? "Uploading..."
                  : isDragActive
                    ? "Drop your inspiration here"
                    : "Drag & drop your inspiration"}
              </p>
              <p
                className="text-muted-foreground mb-6"
                style={{ fontSize: "var(--font-size-sm)" }}
              >
                or click to browse your files
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  className="uppercase tracking-wider"
                  style={{ fontSize: "var(--font-size-xs)" }}
                  data-testid="button-add-vibe-images"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isUploading}
                  className="uppercase tracking-wider"
                  style={{ fontSize: "var(--font-size-xs)" }}
                >
                  <Link className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </Dropzone>

      {vibeImages.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8"
        >
          <p
            className="text-muted-foreground mb-4 uppercase tracking-wider"
            style={{ fontSize: "var(--font-size-xs)" }}
          >
            Your Inspiration ({vibeImages.length} {vibeImages.length === 1 ? "image" : "images"})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {vibeImages.map((url, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group aspect-square overflow-hidden"
              >
                <img
                  src={url}
                  alt={`Inspiration ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(idx);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/80"
                  data-testid={`remove-vibe-${idx}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="text-center mt-10">
        <p
          className="text-muted-foreground italic"
          style={{ fontSize: "var(--font-size-sm)" }}
        >
          The more you share, the better we can capture your vision
        </p>
      </div>
    </div>
  );
}
