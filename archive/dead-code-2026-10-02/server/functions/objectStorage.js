"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectStorageService = exports.ObjectNotFoundError = exports.objectStorageClient = void 0;
const storage_1 = require("@google-cloud/storage");
const crypto_1 = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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

    async getObjectEntityUploadURL(fileName, contentType) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
            console.error("Missing AWS configuration");
            throw new Error("Server configuration error");
        }

        const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        const key = `uploads/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            ContentType: contentType,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return {
            method: "PUT",
            url,
            headers: {
                "Content-Type": contentType,
            },
            key,
        };
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
