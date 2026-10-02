/**
 * Image Cache Utilities
 * Provides caching mechanisms to skip re-analysis of unchanged images
 */
import crypto from 'crypto';
import { curalinaStorage } from '../storage-curalina';
/**
 * Generate a hash for an image URL to detect changes
 * Includes URL and optionally fetch headers for content-based hashing
 */
export async function generateImageHash(imageUrl) {
    try {
        // For S3 URLs, include ETag in hash if available
        if (imageUrl.includes('s3.amazonaws.com')) {
            try {
                const response = await fetch(imageUrl, { method: 'HEAD' });
                const etag = response.headers.get('etag');
                const lastModified = response.headers.get('last-modified');
                if (etag || lastModified) {
                    const hashInput = `${imageUrl}|${etag || ''}|${lastModified || ''}`;
                    return crypto.createHash('sha256').update(hashInput).digest('hex');
                }
            }
            catch {
                // Fallback to URL-only hash if HEAD request fails
            }
        }
        // Default: hash the URL itself
        return crypto.createHash('sha256').update(imageUrl).digest('hex');
    }
    catch (error) {
        console.error(`Failed to generate hash for ${imageUrl}:`, error);
        // Return URL hash as fallback
        return crypto.createHash('sha256').update(imageUrl).digest('hex');
    }
}
/**
 * Check if an image has been analyzed and hasn't changed
 */
export async function isImageAnalyzed(productId, imageUrl, requiredFields) {
    try {
        const product = await curalinaStorage.getProduct(productId);
        if (!product)
            return false;
        // Check if all required fields are present
        for (const field of requiredFields) {
            if (!product[field]) {
                return false;
            }
        }
        // For now, we consider it analyzed if the required fields exist
        // In the future, we could store image hashes in the database
        // to detect when images change even if URLs stay the same
        return true;
    }
    catch (error) {
        console.error(`Failed to check analysis status for product ${productId}:`, error);
        return false;
    }
}
/**
 * Build a cache key for quick lookups
 */
export function buildCacheKey(productId, imageUrl) {
    return `${productId}:${imageUrl}`;
}
/**
 * In-memory cache for current job session
 * Prevents re-analysis within the same job run
 */
class SessionCache {
    constructor() {
        this.cache = new Map();
    }
    set(entry) {
        const key = buildCacheKey(entry.productId, entry.imageUrl);
        this.cache.set(key, entry);
    }
    get(productId, imageUrl) {
        const key = buildCacheKey(productId, imageUrl);
        return this.cache.get(key);
    }
    has(productId, imageUrl) {
        const key = buildCacheKey(productId, imageUrl);
        return this.cache.has(key);
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
}
// Export a singleton session cache instance
export const sessionCache = new SessionCache();
/**
 * Check if product needs any type of analysis
 */
export async function needsAnalysis(productId, analysisType) {
    try {
        const product = await curalinaStorage.getProduct(productId);
        if (!product)
            return false;
        // No images = no analysis needed
        if (!product.images || product.images.length === 0) {
            return false;
        }
        switch (analysisType) {
            case 'front-view':
                // Need front-view if any provider is missing
                return !product.visualDescriptionFrontViewGemini ||
                    !product.visualDescriptionFrontViewOpenAI;
            case 'combined':
                // Need combined if any provider is missing
                return !product.visualDescriptionGemini ||
                    !product.visualDescriptionOpenAI;
            case 'both':
                // Need analysis if any field is missing
                return !product.visualDescriptionGemini ||
                    !product.visualDescriptionOpenAI ||
                    !product.visualDescriptionFrontViewGemini ||
                    !product.visualDescriptionFrontViewOpenAI;
            default:
                return true;
        }
    }
    catch (error) {
        console.error(`Failed to check if product ${productId} needs analysis:`, error);
        return true; // Err on the side of analyzing
    }
}
/**
 * Mark product as analyzed in session cache
 */
export function markAsAnalyzed(productId, imageUrls, descriptions) {
    const now = new Date();
    for (const imageUrl of imageUrls) {
        sessionCache.set({
            productId,
            imageUrl,
            imageHash: crypto.createHash('sha256').update(imageUrl).digest('hex'),
            analyzedAt: now,
            ...descriptions
        });
    }
}
//# sourceMappingURL=image-cache.js.map