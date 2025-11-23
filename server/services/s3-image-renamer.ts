/**
 * S3 Image Renamer Service
 * Renames S3 images to replace spaces with dashes and updates database records
 */

import { normalizeS3Key, renameS3Object, checkS3ObjectExists, deleteS3Object } from "../s3";
import type { ICuralinaStorage } from "../storage-curalina";

export interface RenameResult {
  productId: string;
  productName: string;
  oldImages: string[];
  newImages: string[];
  success: boolean;
  error?: string;
}

export interface RenameSummary {
  totalProducts: number;
  processedProducts: number;
  successfulRenames: number;
  failedRenames: number;
  results: RenameResult[];
}

/**
 * Extract and decode S3 key from URL to get canonical form
 * All encoding variants (%20, +, %2B) are decoded to their canonical form
 * https://curalina.s3.us-east-1.amazonaws.com/products/123/My%20Image.png -> products/123/My Image.png
 * https://curalina.s3.us-east-1.amazonaws.com/products/123/My+Image.png -> products/123/My+Image.png
 * https://curalina.s3.us-east-1.amazonaws.com/products/123/My%2BImage.png -> products/123/My+Image.png
 */
function extractAndDecodeS3Key(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove leading slash and decode %XX
    const pathname = urlObj.pathname.substring(1);
    return decodeURIComponent(pathname);
  } catch {
    // If not a full URL, try to decode anyway
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  }
}

/**
 * Check if a key needs normalization (contains spaces, +, %20, or %2B)
 */
function needsNormalization(key: string): boolean {
  // Check for spaces, +, or percent-encoded variants (%20, %2B)
  return /[\s+]|%20|%2B/i.test(key);
}

/**
 * Fully decode a key (recursively) and normalize to dashes
 * Handles: %20, %2B, +, literal spaces, nested encodings, and decode failures
 */
function fullyDecodeAndNormalize(key: string): string {
  let decoded = key;
  let prev;
  
  // Try to decode recursively
  do {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;  // Stop on decode errors (e.g., invalid % sequences)
    }
  } while (decoded !== prev && /%[0-9A-Fa-f]{2}/.test(decoded));
  
  // Replace literal %20 and %2B strings (handles cases where decoding failed)
  decoded = decoded.replace(/%20/g, ' ').replace(/%2B/gi, '+');
  
  // Replace spaces and + with dashes
  return decoded.replace(/[\s+]+/g, '-');
}

/**
 * Convert S3 key to full URL
 * products/123/image.png -> https://curalina.s3.us-east-1.amazonaws.com/products/123/image.png
 */
function keyToFullUrl(key: string): string {
  const AWS_REGION = (process.env.AWS_REGION === "global" || !process.env.AWS_REGION) ? "us-east-1" : process.env.AWS_REGION;
  const BUCKET_NAME = "curalina";
  return `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Rename all product images with spaces to use dashes
 * Also updates the database records
 */
export async function renameAllProductImages(
  storage: ICuralinaStorage,
  dryRun: boolean = false
): Promise<RenameSummary> {
  console.log(`[S3-RENAMER] Starting image renaming process (dry run: ${dryRun})`);
  
  const summary: RenameSummary = {
    totalProducts: 0,
    processedProducts: 0,
    successfulRenames: 0,
    failedRenames: 0,
    results: [],
  };

  try {
    // Get all products
    const products = await storage.getAllProducts();
    summary.totalProducts = products.length;
    
    console.log(`[S3-RENAMER] Found ${products.length} products to process`);

    for (const product of products) {
      if (!product.images || product.images.length === 0) {
        continue;
      }

      const result: RenameResult = {
        productId: product.id,
        productName: product.name,
        oldImages: [...product.images],
        newImages: [],
        success: false,
      };

      try {
        const newImages: string[] = [];
        let hasChanges = false;

        for (const imageUrl of product.images) {
          const wasFullUrl = imageUrl.startsWith('https://');
          
          // Extract raw key from URL (preserves encoding)
          let rawKey: string;
          try {
            const urlObj = new URL(imageUrl);
            rawKey = urlObj.pathname.substring(1);
          } catch {
            rawKey = imageUrl;
          }
          
          // Decode to canonical form (keep decoding until no more changes)
          let canonicalKey = rawKey;
          let prev;
          do {
            prev = canonicalKey;
            try {
              canonicalKey = decodeURIComponent(canonicalKey);
            } catch {
              break;  // Stop on decode errors
            }
          } while (canonicalKey !== prev);
          
          // Check if canonical key needs normalization
          if (!needsNormalization(canonicalKey)) {
            // No normalization needed
            newImages.push(imageUrl);
            continue;
          }
          
          // Find which variant actually exists in S3
          let existingKey: string | null = null;
          if (!dryRun) {
            // Try canonical key first (most common case: literal space in S3)
            if (await checkS3ObjectExists(canonicalKey)) {
              existingKey = canonicalKey;
            } else if (rawKey !== canonicalKey) {
              // Try raw key (rare case: literal %20 in S3)
              if (await checkS3ObjectExists(rawKey)) {
                existingKey = rawKey;
              }
            }
            
            if (!existingKey) {
              console.warn(`[S3-RENAMER] Source not found (tried raw and canonical): ${rawKey}`);
              newImages.push(imageUrl);
              continue;
            }
          } else {
            // In dry run, assume canonical key exists
            existingKey = canonicalKey;
          }
          
          // Normalize the canonical key (for DB consistency)
          const normalizedKey = canonicalKey.replace(/[\s+]+/g, '-');
          
          // Safety check
          if (existingKey === normalizedKey) {
            console.warn(`[S3-RENAMER] Normalized key equals existing key, skipping: ${existingKey}`);
            newImages.push(imageUrl);
            continue;
          }
          
          console.log(`[S3-RENAMER] Product ${product.name}: ${existingKey} -> ${normalizedKey}`);
          
          if (!dryRun) {
            // Check if destination already exists
            const destExists = await checkS3ObjectExists(normalizedKey);
            if (destExists) {
              console.log(`[S3-RENAMER] Destination exists, skipping rename: ${existingKey}`);
              const finalUrl = wasFullUrl ? keyToFullUrl(normalizedKey) : normalizedKey;
              newImages.push(finalUrl);
              hasChanges = true;
              continue;
            }

            // Rename using whichever key exists
            await renameS3Object(existingKey, normalizedKey);
            console.log(`[S3-RENAMER] Successfully renamed: ${existingKey} -> ${normalizedKey}`);
          }
          
          // Always use normalized canonical key in DB
          const finalUrl = wasFullUrl ? keyToFullUrl(normalizedKey) : normalizedKey;
          newImages.push(finalUrl);
          hasChanges = true;
        }

        result.newImages = newImages;
        result.success = true;

        // Update database if there were changes
        if (hasChanges && !dryRun) {
          await storage.updateProduct(product.id, { images: newImages });
          console.log(`[S3-RENAMER] Updated database for product: ${product.name}`);
        }

        summary.processedProducts++;
        summary.successfulRenames++;
        summary.results.push(result);

      } catch (error) {
        result.success = false;
        result.error = error instanceof Error ? error.message : String(error);
        summary.failedRenames++;
        summary.results.push(result);
        console.error(`[S3-RENAMER] Error processing product ${product.name}:`, error);
      }
    }

    console.log(`[S3-RENAMER] Completed: ${summary.successfulRenames} successful, ${summary.failedRenames} failed`);
    return summary;

  } catch (error) {
    console.error('[S3-RENAMER] Fatal error during renaming process:', error);
    throw error;
  }
}

/**
 * Preview what changes would be made without actually renaming
 */
export async function previewImageRenames(storage: ICuralinaStorage): Promise<RenameSummary> {
  return renameAllProductImages(storage, true);
}
