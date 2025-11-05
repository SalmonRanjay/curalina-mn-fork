import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_NAME = "curalina";

// Initialize S3 client with credentials from environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: "public-read", // Make file publicly accessible
  });

  await s3Client.send(command);
  
  // Return the public URL
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
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
 * List all objects in a specific folder/prefix
 * @param prefix - The folder prefix to list (e.g., 'products/')
 * @returns Array of object keys
 */
export async function listS3Objects(prefix: string = ""): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  return response.Contents?.map(obj => obj.Key || "") || [];
}

/**
 * Generate a unique S3 key for a product image
 * @param productSku - The product SKU
 * @param filename - Original filename
 * @returns S3 object key
 */
export function generateProductImageKey(productSku: string, filename: string): string {
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  return `products/${productSku}-${timestamp}.${extension}`;
}
