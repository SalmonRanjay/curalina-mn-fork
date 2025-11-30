"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectStorageService = exports.ObjectNotFoundError = exports.objectStorageClient = void 0;
const storage_1 = require("@google-cloud/storage");
const crypto_1 = require("crypto");
// Firebase Functions env provides credentials automatically
exports.objectStorageClient = new storage_1.Storage();
// Use the default bucket if not specified
const DEFAULT_BUCKET = process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}.appspot.com`;
class ObjectNotFoundError extends Error {
    constructor() {
        super("Object not found");
        this.name = "ObjectNotFoundError";
        Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
    }
}
exports.ObjectNotFoundError = ObjectNotFoundError;
class ObjectStorageService {
    constructor(bucketName) {
        this.bucketName = bucketName || DEFAULT_BUCKET;
    }
    getBucket() {
        return exports.objectStorageClient.bucket(this.bucketName);
    }
    async downloadObject(file, res, cacheTtlSec = 3600) {
        try {
            const [metadata] = await file.getMetadata();
            const isPublic = true; // Simplified for now, can add ACL checks back if needed
            res.set({
                "Content-Type": metadata.contentType || "application/octet-stream",
                "Content-Length": metadata.size,
                "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
            });
            const stream = file.createReadStream();
            stream.on("error", (err) => {
                console.error("Stream error:", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Error streaming file" });
                }
            });
            stream.pipe(res);
        }
        catch (error) {
            console.error("Error downloading file:", error);
            if (!res.headersSent) {
                res.status(404).json({ error: "File not found or inaccessible" });
            }
        }
    }
    async getObjectEntityUploadURL() {
        // In Firebase, we ideally want the CLIENT to upload directly using the Client SDK
        // But to keep your current flow working, we will generate a Signed URL.
        const objectId = (0, crypto_1.randomUUID)();
        const objectName = `uploads/${objectId}`;
        const file = this.getBucket().file(objectName);
        // This URL is for your internal API to PUT to, or for the client to use if you return it
        // For now, let's keep the Replit compatible return format if your frontend expects a specific string.
        // BUT normally we would return a signed URL here.
        // Returning the internal path that the frontend likely uses to POST to your server proxy
        // If you are proxying uploads through your Express server:
        return `/api/objects/upload-internal/${this.bucketName}/${objectName}`;
    }
    async getObjectEntityFile(objectPath) {
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
    async searchPublicObject(filePath) {
        const file = this.getBucket().file(filePath);
        const [exists] = await file.exists();
        return exists ? file : null;
    }
    // Stubs for ACL to prevent compilation errors, can be implemented fully if needed
    async trySetObjectEntityAclPolicy(path, policy) {
        return path;
    }
    async canAccessObjectEntity(params) {
        return true;
    }
}
exports.ObjectStorageService = ObjectStorageService;
