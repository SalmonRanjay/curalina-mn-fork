/**
 * Enhanced image detection and processing utilities
 */

/**
 * Detects if an image is a front-view image based on its filename
 * Searches for case-insensitive variations like:
 * - "front view", "Front View", "FRONT VIEW"
 * - "front_view", "Front_View", "front-view"
 * - "frontview", "FrontView", "FRONTVIEW"
 * 
 * @param imagePath The image path or filename to check
 * @returns True if the image is identified as a front view
 */
export function isFrontViewImage(imagePath: string | null | undefined): boolean {
  if (!imagePath) return false;
  
  // Extract filename from path
  const filename = imagePath.split('/').pop()?.toLowerCase() || '';
  
  // Pattern to match variations of "front view" at the start of filename
  // This regex matches:
  // - front view (with space)
  // - front_view (with underscore)
  // - front-view (with hyphen)
  // - frontview (no separator)
  // All case-insensitive
  const frontViewPattern = /^front[\s_\-]?view/i;
  
  return frontViewPattern.test(filename);
}

/**
 * Finds the front-view image from an array of image paths
 * 
 * @param images Array of image paths
 * @returns The front-view image path if found, null otherwise
 */
export function findFrontViewImage(images: string[] | null | undefined): string | null {
  if (!images || images.length === 0) return null;
  
  // First try to find an explicitly named front-view image
  const frontViewImage = images.find(img => isFrontViewImage(img));
  if (frontViewImage) return frontViewImage;
  
  // If no explicit front-view image found, return null
  // (caller can decide to use first image as fallback)
  return null;
}

/**
 * Prioritizes images array to put front-view image first
 * 
 * @param images Array of image paths
 * @returns Reordered array with front-view image first if found
 */
export function prioritizeFrontViewImage(images: string[] | null | undefined): string[] {
  if (!images || images.length === 0) return [];
  
  const frontViewImage = findFrontViewImage(images);
  
  if (frontViewImage) {
    // Put front-view image first, followed by others
    return [
      frontViewImage,
      ...images.filter(img => img !== frontViewImage)
    ];
  }
  
  // Return original order if no front-view found
  return [...images];
}

/**
 * Groups images into front-view and other views
 * 
 * @param images Array of image paths
 * @returns Object with frontView and otherViews arrays
 */
export function categorizeImages(images: string[] | null | undefined): {
  frontView: string | null;
  otherViews: string[];
  allImages: string[];
} {
  if (!images || images.length === 0) {
    return {
      frontView: null,
      otherViews: [],
      allImages: []
    };
  }
  
  const frontView = findFrontViewImage(images);
  const otherViews = frontView 
    ? images.filter(img => img !== frontView)
    : images;
  
  return {
    frontView,
    otherViews,
    allImages: images
  };
}

/**
 * Validates if an image URL is accessible
 * Used to filter out broken or invalid images before analysis
 * 
 * @param imageUrl URL to validate
 * @returns True if image is likely valid
 */
export function isValidImageUrl(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  
  // Check for common invalid patterns
  const invalidPatterns = [
    'placeholder',
    'no-image',
    'default',
    'missing',
    'error'
  ];
  
  const lowerUrl = imageUrl.toLowerCase();
  if (invalidPatterns.some(pattern => lowerUrl.includes(pattern))) {
    return false;
  }
  
  // Check for valid image extensions
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];
  if (!validExtensions.some(ext => lowerUrl.includes(ext))) {
    return false;
  }
  
  // Check for basic URL structure
  try {
    new URL(imageUrl);
    return true;
  } catch {
    // If it's not a full URL, it might be a relative path which is still valid
    return imageUrl.startsWith('/') || imageUrl.startsWith('./');
  }
}

/**
 * Batch processes image arrays to extract front views for multiple products
 * 
 * @param productImages Array of products with their image arrays
 * @returns Map of product IDs to their front-view images
 */
export function extractFrontViewBatch(
  productImages: Array<{ productId: string; images: string[] | null }>
): Map<string, string | null> {
  const frontViewMap = new Map<string, string | null>();
  
  for (const { productId, images } of productImages) {
    frontViewMap.set(productId, findFrontViewImage(images));
  }
  
  return frontViewMap;
}