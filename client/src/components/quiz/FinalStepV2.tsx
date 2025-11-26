import { motion } from "framer-motion";
import { Upload, Camera, FileText, Sparkles } from "lucide-react";
import Dropzone from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FinalStepV2Props {
  floorplanUrl: string;
  roomDescription: string;
  onPhotoUpload: (files: File[]) => void;
  onFloorplanUpload: (files: File[]) => void;
  onDescriptionChange: (description: string) => void;
  isUploadingFloorplan: boolean;
}

export function FinalStepV2({
  floorplanUrl,
  roomDescription,
  onPhotoUpload,
  onFloorplanUpload,
  onDescriptionChange,
  isUploadingFloorplan,
}: FinalStepV2Props) {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 mb-4"
        >
          <Sparkles className="w-5 h-5 text-muted-foreground" />
          <p
            className="uppercase tracking-widest text-muted-foreground"
            style={{ fontSize: "var(--font-size-xs)" }}
          >
            Final Touch
          </p>
          <Sparkles className="w-5 h-5 text-muted-foreground" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-foreground mb-4"
          style={{ fontSize: "var(--font-size-3xl)", fontWeight: 400 }}
        >
          You Made It to the Final Step
        </motion.h2>
        <p
          className="text-muted-foreground max-w-xl mx-auto"
          style={{ fontSize: "var(--font-size-base)" }}
        >
          Help us understand your space better with photos or a description
        </p>
        <p
          className="text-muted-foreground mt-2 italic"
          style={{ fontSize: "var(--font-size-sm)" }}
        >
          Uploading photos is optional, but helps us create a more personalized design
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p
            className="text-center mb-4 font-medium text-foreground"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Upload a photo of your space
          </p>
          <Dropzone
            onDrop={onPhotoUpload}
            accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
            maxFiles={1}
            disabled={isUploadingFloorplan}
          >
            {({ getRootProps, getInputProps, isDragActive }) => (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed transition-all duration-300 cursor-pointer h-48 flex flex-col items-center justify-center ${
                  isDragActive || floorplanUrl
                    ? "border-foreground bg-accent/5"
                    : "border-border hover:border-foreground/50"
                }`}
                data-testid="photo-upload-area"
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 mb-4 rounded-full border border-border flex items-center justify-center">
                  <Camera className="w-5 h-5 text-muted-foreground" />
                </div>
                <p
                  className="font-medium text-foreground mb-2"
                  style={{ fontSize: "var(--font-size-sm)" }}
                >
                  {isUploadingFloorplan ? "Uploading..." : "Add Photo"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="uppercase tracking-wider"
                  style={{ fontSize: "var(--font-size-xs)" }}
                  data-testid="button-see-photo-example"
                >
                  See Example
                </Button>
              </div>
            )}
          </Dropzone>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p
            className="text-center mb-4 font-medium text-foreground"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Upload your floorplan
          </p>
          <Dropzone
            onDrop={onFloorplanUpload}
            accept={{ "image/*": [".png", ".jpg", ".jpeg", ".pdf"] }}
            maxFiles={1}
            disabled={isUploadingFloorplan}
          >
            {({ getRootProps, getInputProps, isDragActive }) => (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed transition-all duration-300 cursor-pointer h-48 flex flex-col items-center justify-center ${
                  isDragActive || floorplanUrl
                    ? "border-foreground bg-accent/5"
                    : "border-border hover:border-foreground/50"
                }`}
                data-testid="floorplan-upload-area"
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 mb-4 rounded-full border border-border flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <p
                  className="font-medium text-foreground mb-2"
                  style={{ fontSize: "var(--font-size-sm)" }}
                >
                  {isUploadingFloorplan ? "Uploading..." : "Add Plan"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="uppercase tracking-wider"
                  style={{ fontSize: "var(--font-size-xs)" }}
                  data-testid="button-see-plan-example"
                >
                  See Example
                </Button>
              </div>
            )}
          </Dropzone>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-3xl mx-auto"
      >
        <div className="text-center mb-4">
          <p
            className="font-medium text-foreground"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Describe your space
          </p>
          <p
            className="text-muted-foreground mt-1"
            style={{ fontSize: "var(--font-size-xs)" }}
          >
            Tell us about dimensions, doorway size, and any preferences
          </p>
        </div>
        <Textarea
          value={roomDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Example: My living room is 15 feet by 12 feet with 9-foot ceilings. Standard 32-inch doorway. I want a warm, inviting feel with natural materials and soft neutrals..."
          className="min-h-32 border-2 border-border bg-transparent text-foreground resize-y focus:border-foreground transition-colors"
          style={{ fontSize: "var(--font-size-base)" }}
          data-testid="input-room-description"
        />
        <p
          className="text-center mt-4 text-muted-foreground italic"
          style={{ fontSize: "var(--font-size-xs)" }}
        >
          The more details you share, the more personalized your design recommendations will be
        </p>
      </motion.div>
    </div>
  );
}
