import sharp from 'sharp';

/**
 * Placement configuration for a product in the composited scene
 */
export interface ProductPlacement {
  sku: string;
  productName: string;
  imageUrl: string; // Selected image URL with best angle
  position: {
    x: number; // X coordinate (0-1, normalized to image width)
    y: number; // Y coordinate (0-1, normalized to image height)
  };
  scale: number; // Scale factor (0.1-2.0)
  zIndex: number; // Layering order (higher = in front)
  addShadow?: boolean; // Whether to add a subtle shadow
}

/**
 * Select the best product image angle based on placement
 * For MVP, we'll use simple heuristics. Future: use AI to analyze best angle
 */
export function selectBestProductAngle(
  productImages: string[],
  placement: string
): string {
  if (!productImages || productImages.length === 0) {
    throw new Error('No product images available');
  }

  // For MVP: Simple selection logic
  // - First image for front-facing placements
  // - Middle image for side views
  // - Last image for angled views
  
  const placementLower = placement.toLowerCase();
  
  // Angled/corner placements prefer last image
  if (placementLower.includes('corner') || placementLower.includes('angled')) {
    return productImages[productImages.length - 1];
  }
  
  // Side placements prefer middle image
  if (placementLower.includes('side') || placementLower.includes('wall')) {
    const midIndex = Math.floor(productImages.length / 2);
    return productImages[midIndex];
  }
  
  // Default to first image (front view)
  return productImages[0];
}

/**
 * Generate placement guidelines based on room type and product selection
 * For MVP, we use predefined placement templates
 */
export function generatePlacementGuidelines(
  roomType: string,
  selectedProducts: Array<{ sku: string; name: string; placement: string; images: string[] }>
): ProductPlacement[] {
  const placements: ProductPlacement[] = [];
  
  // Simple MVP placement logic based on product order
  // Products are arranged in a visually pleasing composition
  
  selectedProducts.forEach((product, index) => {
    const totalProducts = selectedProducts.length;
    
    // Select best image angle
    const selectedImage = selectBestProductAngle(product.images, product.placement);
    
    // Generate position based on index and total count
    let position = { x: 0.5, y: 0.5 }; // Default center
    let scale = 0.25; // Default scale
    let zIndex = index; // Back to front ordering
    
    // TEMPORARY: Simplified placement while background removal is being implemented
    // Products are arranged in lower portion of image to simulate floor placement
    // Note: This is a stopgap - proper scene analysis is needed for realistic placement
    if (totalProducts <= 3) {
      // Horizontal arrangement for 1-3 products - larger scale, lower placement
      position = {
        x: 0.25 + (index * 0.25),
        y: 0.7 // Lower in frame to suggest floor placement
      };
      scale = 0.15; // Smaller to reduce background visibility
    } else if (totalProducts <= 6) {
      // 2 rows for 4-6 products
      const row = Math.floor(index / 3);
      const col = index % 3;
      position = {
        x: 0.2 + (col * 0.3),
        y: 0.65 + (row * 0.2)
      };
      scale = 0.12;
    } else {
      // 3 rows for 7+ products - very small to minimize background artifacts
      const row = Math.floor(index / 3);
      const col = index % 3;
      position = {
        x: 0.2 + (col * 0.3),
        y: 0.6 + (row * 0.15)
      };
      scale = 0.1; // Very small to minimize white box artifacts
    }
    
    placements.push({
      sku: product.sku,
      productName: product.name,
      imageUrl: selectedImage,
      position,
      scale,
      zIndex,
      addShadow: false // Disabled until background removal is implemented
    });
  });
  
  return placements;
}

/**
 * Fetch image from URL and return as Sharp instance
 */
async function fetchImage(url: string): Promise<sharp.Sharp> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return sharp(Buffer.from(buffer));
}

/**
 * Create a subtle shadow for a product image
 * Creates a neutral black semi-transparent shadow by:
 * 1. Starting with black canvas
 * 2. Masking it with product's alpha channel
 * 3. Blurring for soft shadow effect
 */
async function createShadow(productBuffer: Buffer): Promise<Buffer> {
  const productImage = sharp(productBuffer);
  const metadata = await productImage.metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid shadow image dimensions');
  }
  
  // Create a semi-transparent black canvas with subtle opacity
  const blackCanvas = await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.25 } // 25% opacity black for subtle shadow
    }
  }).png().toBuffer();
  
  // Composite product onto black canvas using 'dest-in' blend
  // This creates a black silhouette with product's alpha channel
  return sharp(blackCanvas)
    .composite([{
      input: productBuffer,
      blend: 'dest-in' // Use product's alpha as mask for black canvas
    }])
    .blur(10) // Blur for soft shadow
    .toBuffer();
}

/**
 * Composite product images onto AI-generated base image
 * 
 * CURRENT LIMITATIONS (v1 MVP):
 * - Product images are JPEGs with backgrounds (not transparent PNGs)
 * - Results show products with visible backgrounds overlaid on room
 * - Simple grid placement without scene analysis
 * 
 * PLANNED IMPROVEMENTS:
 * - Background removal API integration (remove.bg/ClipDrop)
 * - Scene-aware placement using Gemini Vision analysis
 * - Perspective-matched scaling and positioning
 * - Realistic shadow generation on floor plane
 * 
 * Returns the final composited image as a buffer
 */
export async function compositeProducts(
  baseImageUrl: string,
  placements: ProductPlacement[]
): Promise<Buffer> {
  console.log(`🎨 Starting hybrid compositing with ${placements.length} products`);
  
  // Fetch base AI-generated image
  const baseImage = await fetchImage(baseImageUrl);
  const baseMetadata = await baseImage.metadata();
  
  if (!baseMetadata.width || !baseMetadata.height) {
    throw new Error('Invalid base image dimensions');
  }
  
  const baseWidth = baseMetadata.width;
  const baseHeight = baseMetadata.height;
  
  console.log(`📐 Base image dimensions: ${baseWidth}x${baseHeight}`);
  
  // Sort placements by zIndex (back to front)
  const sortedPlacements = [...placements].sort((a, b) => a.zIndex - b.zIndex);
  
  // Build composite layers
  const compositeLayers: sharp.OverlayOptions[] = [];
  
  for (const placement of sortedPlacements) {
    try {
      console.log(`  📦 Processing ${placement.productName}`);
      
      // Fetch product image
      const productImage = await fetchImage(placement.imageUrl);
      const productMetadata = await productImage.metadata();
      
      if (!productMetadata.width || !productMetadata.height) {
        console.warn(`  ⚠️ Skipping ${placement.productName} - invalid dimensions`);
        continue;
      }
      
      // Calculate scaled dimensions
      const targetWidth = Math.round(baseWidth * placement.scale);
      const targetHeight = Math.round(
        (productMetadata.height / productMetadata.width) * targetWidth
      );
      
      // Resize product image and force PNG with transparency
      // This ensures alpha channel is preserved even for JPEG sources
      const resizedProduct = await productImage
        .resize(targetWidth, targetHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .ensureAlpha() // Ensure alpha channel exists
        .png() // Force PNG output with transparency
        .toBuffer();
      
      // Calculate absolute position
      const left = Math.round(placement.position.x * baseWidth - targetWidth / 2);
      const top = Math.round(placement.position.y * baseHeight - targetHeight / 2);
      
      // Add shadow if requested
      if (placement.addShadow) {
        const shadowBuffer = await createShadow(resizedProduct);
        compositeLayers.push({
          input: shadowBuffer,
          left: left + 5, // Offset shadow slightly
          top: top + 5,
          blend: 'over'
        });
      }
      
      // Add product image
      compositeLayers.push({
        input: resizedProduct,
        left,
        top,
        blend: 'over'
      });
      
      console.log(`  ✅ Added ${placement.productName} at (${left}, ${top})`);
    } catch (error) {
      console.error(`  ❌ Error processing ${placement.productName}:`, error);
      // Continue with other products even if one fails
    }
  }
  
  // Composite all layers onto base image
  const finalImage = await baseImage
    .composite(compositeLayers)
    .jpeg({ quality: 90 }) // High quality JPEG
    .toBuffer();
  
  console.log(`✅ Hybrid compositing complete!`);
  
  return finalImage;
}
