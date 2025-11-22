import type { Product } from "@shared/schema";

/**
 * Stability AI Quality Control Service
 * Uses ControlNet Reference to enforce product accuracy in renders
 * 
 * Flow:
 * 1. Take Gemini-generated render + actual product images
 * 2. Use ControlNet Reference to make furniture match real products
 * 3. Return refined render with accurate product appearance
 */

const STABILITY_API_KEY = process.env.STABILITY_AI_API_KEY;
const STABILITY_API_URL = "https://api.stability.ai/v2beta/image-to-image/control/reference";
const STABILITY_ENGINE_ID = "stable-diffusion-xl-2-0-turbo";

interface QCRefinementParams {
  renderImageBase64: string;
  productImages: Array<{ sku: string; imageBase64: string }>;
  renderPrompt: string;
  strength?: number; // 0-1, how much to modify (0.5-0.7 recommended)
}

interface QCResult {
  success: boolean;
  refinedImageBase64?: string;
  refinedImageUrl?: string;
  qualityScore?: number; // 0-100, how confident the match is
  error?: string;
  appliedProducts?: string[]; // SKUs of products that were refined
}

/**
 * Convert image URL to base64
 */
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error(`Failed to convert image URL to base64:`, error);
    throw error;
  }
}

/**
 * Extract primary product images for ControlNet reference
 */
function selectReferenceImages(
  products: Array<{ sku: string; images?: string[] }>,
  maxReferences: number = 3
): Array<{ sku: string; imageUrl: string }> {
  const references: Array<{ sku: string; imageUrl: string }> = [];
  
  for (const product of products) {
    if (references.length >= maxReferences) break;
    
    // Get first valid image for each product
    if (product.images && product.images.length > 0) {
      const validImage = product.images.find(img => 
        img && typeof img === 'string' && 
        (img.startsWith('http') || img.startsWith('/public-objects/') || img.includes('s3'))
      );
      
      if (validImage) {
        references.push({
          sku: product.sku,
          imageUrl: validImage
        });
      }
    }
  }
  
  return references;
}

/**
 * Refine a Gemini render using Stability AI ControlNet Reference
 * Ensures furniture in render matches actual product images
 */
export async function refineRenderWithControlNetReference(
  params: QCRefinementParams
): Promise<QCResult> {
  if (!STABILITY_API_KEY) {
    console.warn("⚠️ STABILITY_AI_API_KEY not set - skipping QC refinement");
    return {
      success: false,
      error: "Stability AI API key not configured"
    };
  }

  const strength = params.strength || 0.6; // Default 60% strength for balanced refinement

  try {
    console.log(`🎨 Starting Stability AI QC refinement...`);
    console.log(`   Applying ${params.productImages.length} product references`);
    console.log(`   Refinement strength: ${Math.round(strength * 100)}%`);

    // Build ControlNet reference data
    // We'll make one API call per product image for maximum accuracy
    let refinedImage = params.renderImageBase64;
    const appliedSkus: string[] = [];

    for (const productRef of params.productImages) {
      try {
        console.log(`   📦 Refining with product: ${productRef.sku}...`);

        // Create FormData for multipart request
        const formData = new FormData();
        
        // Add render image
        const renderBlob = Buffer.from(refinedImage, 'base64');
        formData.append('image', new Blob([renderBlob], { type: 'image/png' }));
        
        // Add product reference image for ControlNet
        const productBlob = Buffer.from(productRef.imageBase64, 'base64');
        formData.append('control_image', new Blob([productBlob], { type: 'image/png' }));
        
        // Add prompt with product context
        const prompt = `${params.renderPrompt}. Ensure the furniture matches the reference image exactly.`;
        formData.append('prompt', prompt);
        formData.append('strength', strength.toString());
        formData.append('control_strength', '1.0'); // Max control strength for reference
        formData.append('output_format', 'png');

        const response = await fetch(STABILITY_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STABILITY_API_KEY}`,
            'Accept': 'image/*',
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`   ❌ Stability API error for ${productRef.sku}:`, error);
          continue;
        }

        // Get refined image as base64
        const arrayBuffer = await response.arrayBuffer();
        refinedImage = Buffer.from(arrayBuffer).toString('base64');
        appliedSkus.push(productRef.sku);
        
        console.log(`   ✅ Successfully refined ${productRef.sku}`);

      } catch (error) {
        console.error(`   ⚠️ Failed to refine ${productRef.sku}:`, error);
        // Continue with next product even if this one fails
        continue;
      }
    }

    if (appliedSkus.length === 0) {
      return {
        success: false,
        error: "No products could be refined"
      };
    }

    console.log(`✅ Stability AI QC complete. Applied to ${appliedSkus.length} products`);

    return {
      success: true,
      refinedImageBase64: refinedImage,
      qualityScore: Math.min(100, 75 + (appliedSkus.length * 5)), // Quality score based on products applied
      appliedProducts: appliedSkus
    };

  } catch (error) {
    console.error(`❌ Stability AI QC refinement failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during QC refinement"
    };
  }
}

/**
 * Validate that furniture dimensions fit the space properly
 * Returns compatibility score 0-100
 */
export function validateFurnitureFit(
  product: Product,
  roomDimensions: { width: number; depth: number; height: number },
  placementPosition: { x: number; y: number } // As percentage of room width/depth
): number {
  if (!product.dimensions || typeof product.dimensions !== 'object') {
    return 50; // Neutral score if no dimensions available
  }

  const dims = product.dimensions as any;
  const productWidth = dims.width || dims.w;
  const productDepth = dims.depth || dims.d;
  const productHeight = dims.height || dims.h;

  if (!productWidth || !productDepth || !productHeight) {
    return 50;
  }

  let score = 100;

  // Check width fit
  if (productWidth > roomDimensions.width * 0.9) {
    score -= 20; // Furniture is too wide for room
  } else if (productWidth > roomDimensions.width * 0.7) {
    score -= 5; // Furniture takes up significant space but okay
  }

  // Check depth fit
  if (productDepth > roomDimensions.depth * 0.8) {
    score -= 20; // Furniture is too deep
  } else if (productDepth > roomDimensions.depth * 0.6) {
    score -= 5; // Takes significant depth space
  }

  // Check height appropriateness
  const heightToRoomRatio = productHeight / roomDimensions.height;
  if (heightToRoomRatio > 0.8) {
    score -= 15; // Furniture too tall, might feel cramped
  } else if (heightToRoomRatio < 0.2) {
    score -= 5; // Furniture very short, might look out of place
  }

  // Check placement position (ensure not blocked by walls)
  const minMargin = 0.1; // 10% margin from walls
  if (placementPosition.x < minMargin || placementPosition.x > (1 - minMargin)) {
    score -= 10; // Placement too close to side walls
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate QC report for a render with products
 */
export function generateQCReport(
  products: Product[],
  roomDimensions: { width: number; depth: number; height: number }
): {
  compatibilityScore: number;
  issues: string[];
  recommendations: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let totalScore = 0;

  for (const product of products) {
    const fitScore = validateFurnitureFit(
      product,
      roomDimensions,
      { x: 0.5, y: 0.5 } // Center position for overall assessment
    );
    totalScore += fitScore;

    if (fitScore < 50) {
      issues.push(`${product.name} may not fit well in the space`);
    } else if (fitScore < 70) {
      warnings.push(`${product.name} is large relative to room size`);
    }

    // Check for dimension data
    if (!product.dimensions) {
      recommendations.push(`Add dimensions to ${product.name} for better placement accuracy`);
    }
  }

  const avgScore = products.length > 0 ? Math.round(totalScore / products.length) : 50;

  return {
    compatibilityScore: avgScore,
    issues,
    recommendations,
    warnings
  };
}

/**
 * Create QC-optimized prompt for better furniture matching
 */
export function createQCOptimizedPrompt(
  basePrompt: string,
  productSkus: string[],
  products: Product[]
): string {
  const productDetails = products
    .filter(p => productSkus.includes(p.sku))
    .map(p => {
      const dims = (p.dimensions as any) || {};
      return `${p.name}: ${dims.width || '?'}"W × ${dims.depth || '?'}"D × ${dims.height || '?'}"H`;
    })
    .join(', ');

  return `${basePrompt}

CRITICAL FURNITURE ACCURACY REQUIREMENTS:
- Each furniture piece MUST match its reference image exactly
- Use actual product dimensions: ${productDetails}
- Ensure proper spacing and scale relationships
- Apply photorealistic quality control
- Validate that all pieces fit proportionally within the space`;
}

/**
 * Simple QC refinement function for integration
 * Used when ENABLE_STABILITY_QC is set to 'true'
 */
export async function applyQCRefinement(
  baseImageData: string,
  prompt: string
): Promise<string | null> {
  if (!process.env.STABILITY_AI_API_KEY) {
    console.warn('⚠️ Stability AI API key not configured');
    return null;
  }

  try {
    // Extract base64 data from data URL
    const base64Match = baseImageData.match(/^data:image\/\w+;base64,(.*)$/);
    if (!base64Match) {
      console.error('Invalid image data format');
      return null;
    }
    
    const imageBuffer = Buffer.from(base64Match[1], 'base64');
    
    // Create form data for Stability API
    const formData = new FormData();
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', imageBlob, 'render.png');
    formData.append('prompt', prompt + ' photorealistic interior design, accurate product representation, exact furniture matching');
    formData.append('control_strength', '0.7'); // Moderate control for balance
    formData.append('output_format', 'png');
    formData.append('negative_prompt', 'distorted furniture, wrong products, incorrect colors, mismatched items, blurry, low quality');
    
    const response = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STABILITY_AI_API_KEY}`,
        'Accept': 'image/*'
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Stability AI QC error (${response.status}): ${errorText}`);
      return null;
    }

    const refinedImageBuffer = await response.arrayBuffer();
    const base64Refined = Buffer.from(refinedImageBuffer).toString('base64');
    
    return `data:image/png;base64,${base64Refined}`;
  } catch (error) {
    console.error('QC refinement failed:', error);
    return null;
  }
}
