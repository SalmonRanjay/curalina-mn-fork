import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const BUCKET_NAME = "curalina";
// AWS_REGION might be set to "global" which is invalid - default to us-east-1
const AWS_REGION = (process.env.AWS_REGION === "global" || !process.env.AWS_REGION) ? "us-east-1" : process.env.AWS_REGION;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Initialize S3 client with credentials from environment variables
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Validate file for upload
 * @param buffer - The file buffer
 * @param contentType - The MIME type
 * @throws Error if validation fails
 */
export function validateUpload(buffer: Buffer, contentType: string): void {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`File type ${contentType} not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
}

/**
 * Upload a file to S3 bucket
 * @param key - The S3 object key (file path in bucket)
 * @param body - The file buffer
 * @param contentType - The MIME type of the file
 * @returns The public URL of the uploaded file
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  // Validate before upload
  validateUpload(body, contentType);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: "public-read", // Make file publicly accessible
  });

  await s3Client.send(command);
  
  // Return the public URL using the configured region
  return `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Get a signed URL for a private S3 object
 * @param key - The S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns A signed URL for accessing the object
 */
export async function getSignedS3Url(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * List all objects in a specific folder/prefix with pagination support
 * @param prefix - The folder prefix to list (e.g., 'products/')
 * @returns Array of all object keys (handles pagination automatically)
 */
export async function listS3Objects(prefix: string = ""): Promise<string[]> {
  const allKeys: string[] = [];
  let continuationToken: string | undefined;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    
    // Add keys from this page
    if (response.Contents) {
      allKeys.push(...response.Contents.map(obj => obj.Key || ""));
    }
    
    // Check if there are more pages
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return allKeys;
}

/**
 * Check if an S3 object exists
 * @param key - The S3 object key to check
 * @returns true if the object exists, false otherwise
 */
export async function checkS3ObjectExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Generate S3 key for a product image
 * Uses original filename to enable duplicate detection
 * @param productSku - The product SKU
 * @param filename - Original filename
 * @returns S3 object key
 */
export function generateProductImageKey(productSku: string, filename: string): string {
  // Sanitize SKU: trim, lowercase, replace non-alphanumerics with hyphens
  const sanitizedSku = String(productSku)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Sanitize filename: lowercase, remove leading dots, replace special chars with hyphens
  const sanitizedFilename = filename
    .toLowerCase()
    .replace(/^\.+/, '')  // Remove leading dots to prevent directory traversal
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')  // Collapse repeated hyphens
    .replace(/^-|-$/g, '');
  
  return `products/${sanitizedSku}/${sanitizedFilename}`;
}

/**
 * Generate a presigned POST URL for direct browser-to-S3 uploads
 * This allows the browser to upload files directly to S3 without going through the server,
 * significantly improving upload speeds by eliminating the server bottleneck.
 * 
 * @param key - The S3 object key where the file will be stored
 * @param contentType - The MIME type of the file
 * @param maxFileSize - Maximum file size in bytes (default: 10MB)
 * @returns Presigned POST data including URL and form fields
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  maxFileSize: number = MAX_FILE_SIZE
): Promise<{
  url: string;
  fields: Record<string, string>;
  key: string;
}> {
  // Validate content type
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`File type ${contentType} not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: BUCKET_NAME,
    Key: key,
    Conditions: [
      ["content-length-range", 0, maxFileSize],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: {
      acl: "public-read",
      "Content-Type": contentType,
    },
    Expires: 600, // URL expires in 10 minutes
  });

  return { url, fields, key };
}

/**
 * Normalize S3 key by replacing spaces and plus signs with dashes
 * Note: Input should already be decoded to canonical form
 * @param key - The canonical S3 key (already decoded)
 * @returns The normalized key with dashes instead of spaces and plus signs
 */
export function normalizeS3Key(key: string): string {
  // Replace spaces and + with dashes
  return key.replace(/[\s+]+/g, '-');
}

/**
 * Copy an S3 object to a new key
 * @param sourceKey - The source object key
 * @param destinationKey - The destination object key
 * @returns The destination key
 */
export async function copyS3Object(sourceKey: string, destinationKey: string): Promise<string> {
  // URL-encode the source key to handle spaces and special characters
  const encodedSourceKey = encodeURIComponent(sourceKey).replace(/%2F/g, '/');
  
  const command = new CopyObjectCommand({
    Bucket: BUCKET_NAME,
    CopySource: `${BUCKET_NAME}/${encodedSourceKey}`,
    Key: destinationKey,
    ACL: "public-read",
  });

  await s3Client.send(command);
  return destinationKey;
}

/**
 * Delete an S3 object
 * @param key - The object key to delete
 */
export async function deleteS3Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Rename an S3 object by copying to new key and deleting the old one
 * @param oldKey - The current object key
 * @param newKey - The new object key
 * @returns The new key
 */
export async function renameS3Object(oldKey: string, newKey: string): Promise<string> {
  // Copy to new location
  await copyS3Object(oldKey, newKey);
  
  // Delete old object
  await deleteS3Object(oldKey);
  
  return newKey;
}
