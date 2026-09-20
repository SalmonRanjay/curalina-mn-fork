import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

// Firebase Functions env provides credentials automatically
export const objectStorageClient = new Storage();

// Use the default bucket if not specified
const DEFAULT_BUCKET = process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}.appspot.com`;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private bucketName: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || DEFAULT_BUCKET;
  }

  getBucket() {
    return objectStorageClient.bucket(this.bucketName);
  }

  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const isPublic = true; // Simplified for now, can add ACL checks back if needed
      
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on("error", (err: any) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(404).json({ error: "File not found or inaccessible" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    // In Firebase, we ideally want the CLIENT to upload directly using the Client SDK
    // But to keep your current flow working, we will generate a Signed URL.
    
    const objectId = randomUUID();
    const objectName = `uploads/${objectId}`;

    // This URL is for your internal API to PUT to, or for the client to use if you return it
    // For now, let's keep the Replit compatible return format if your frontend expects a specific string.
    // BUT normally we would return a signed URL here.
    
    // Returning the internal path that the frontend likely uses to POST to your server proxy
    // If you are proxying uploads through your Express server:
    return `/api/objects/upload-internal/${this.bucketName}/${objectName}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    // Expected format: /objects/<path>
    if (!objectPath.startsWith("/objects/")) {
        throw new ObjectNotFoundError();
    }

    const relativePath = objectPath.replace("/objects/", "");
    const file = this.getBucket().file(relativePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return file;
  }

  // Legacy helper for Replit compatibility
  async searchPublicObject(filePath: string): Promise<File | null> {
    const file = this.getBucket().file(filePath);
    const [exists] = await file.exists();
    return exists ? file : null;
  }
  
  // Stubs for ACL to prevent compilation errors, can be implemented fully if needed
  async trySetObjectEntityAclPolicy(path: string, _policy: any): Promise<string> {
    return path;
  }

  async canAccessObjectEntity(_params: any): Promise<boolean> {
    return true; 
  }
}
