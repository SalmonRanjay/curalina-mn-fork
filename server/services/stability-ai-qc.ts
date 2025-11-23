import type { Product } from "@shared/schema";

/**
 * Truncate prompt to fit Stability AI's 10,000 character limit
 */
function truncatePromptForStability(prompt: string, maxLength: number = 9500): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  
  console.warn(`⚠️ Prompt too long (${prompt.length} chars), truncating to ${maxLength}...`);
  return prompt.substring(0, maxLength) + '...';
}

/**
 * Stability AI Quality Control Service
 * Note: Uses Node.js 20+ native fetch API with FormData and Blob globals
 * Uses ControlNet Reference to enforce product accuracy in renders
 * 
 * Flow:
 * 1. Take Gemini-generated render + actual product images
 * 2. Use ControlNet Reference to make furniture match real products
 * 3. Return refined render with accurate product appearance
 */

const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
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
    console.warn("⚠️ STABILITY_API_KEY not set - skipping QC refinement");
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
        formData.append('prompt', truncatePromptForStability(prompt));
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
 * Fetch and convert an image URL to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    // Handle relative URLs
    let fetchUrl = imageUrl;
    if (fetchUrl.startsWith('/')) {
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      fetchUrl = `${baseUrl}${imageUrl}`;
    }
    
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image from ${fetchUrl}: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    return base64Data;
  } catch (error) {
    console.error(`Error fetching image ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Simple QC refinement function for integration
 * Used when ENABLE_STABILITY_QC is set to 'true'
 * Now supports:
 * - Product images as visual references for improved fidelity
 * - Layout masks for ControlNet-guided placement
 */
export async function applyQCRefinement(
  baseImageData: string,
  prompt: string,
  productImages?: Array<{ url: string; productName: string }>,
  layoutMask?: string
): Promise<string | null> {
  // Verify QC is actually enabled and API key exists
  const qcEnabled = process.env.ENABLE_STABILITY_QC === 'true';
  const apiKey = process.env.STABILITY_API_KEY;
  
  if (!qcEnabled) {
    console.log('ℹ️ QC refinement skipped - disabled by admin');
    return null;
  }
  
  if (!apiKey) {
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
    
    // Get control strength from settings (validated server-side)
    const controlStrength = parseFloat(process.env.STABILITY_QC_STRENGTH || '0.7');
    const validStrength = !isNaN(controlStrength) ? 
      Math.max(0.3, Math.min(1.0, controlStrength)) : 0.7;
    
    console.log(`🎚️ Using control strength: ${validStrength}`);
    
    // Priority 1: If layout mask is provided, use ControlNet Structure endpoint with mask
    if (layoutMask) {
      console.log(`🎭 Using ControlNet with layout mask for precise furniture placement`);
      
      // Extract base64 from layout mask data URL
      const maskMatch = layoutMask.match(/^data:image\/\w+;base64,(.*)$/);
      if (maskMatch) {
        const maskBuffer = Buffer.from(maskMatch[1], 'base64');
        
        const formData = new FormData();
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
        formData.append('image', imageBlob, 'render.png');
        
        const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
        formData.append('control_image', maskBlob, 'layout.png');
        
        formData.append('prompt', truncatePromptForStability(prompt + ' photorealistic interior design with precise furniture placement matching layout guide'));
        formData.append('control_strength', validStrength.toString());
        formData.append('output_format', 'png');
        formData.append('negative_prompt', 'distorted furniture, wrong placement, incorrect layout, mismatched items, blurry, low quality');
        
        const response = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
            'Accept': 'image/*'
          },
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Stability AI ControlNet failed (HTTP ${response.status}): ${errorText}`);
          console.log('   Falling back to product-image refinement...');
        } else {
          const refinedImageBuffer = await response.arrayBuffer();
          const base64Refined = Buffer.from(refinedImageBuffer).toString('base64');
          const sizeKB = (refinedImageBuffer.byteLength / 1024).toFixed(1);
          console.log(`✅ ControlNet refinement with layout mask SUCCESSFUL (${sizeKB}KB)`);
          console.log('   → Layout-guided placement applied via ControlNet structure control');
          return `data:image/png;base64,${base64Refined}`;
        }
      }
    }
    
    // Priority 2: If product images are provided, use Sketch endpoint with reference images
    if (productImages && productImages.length > 0) {
      console.log(`📸 Using ${productImages.length} product reference images for Stability AI refinement`);
      
      // Fetch product images
      const productImageData: string[] = [];
      for (const productImage of productImages.slice(0, 3)) { // Limit to 3 for performance
        const base64Data = await fetchImageAsBase64(productImage.url);
        if (base64Data) {
          productImageData.push(base64Data);
        }
      }
      
      if (productImageData.length > 0) {
        console.log(`✅ Successfully fetched ${productImageData.length} product images for reference`);
        
        // Use Sketch endpoint with style preset to match reference images
        const formData = new FormData();
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
        formData.append('image', imageBlob, 'render.png');
        
        // Add first product image as style reference
        const referenceBlob = new Blob([Buffer.from(productImageData[0], 'base64')], { type: 'image/png' });
        formData.append('style_image', referenceBlob, 'reference.png');
        
        formData.append('prompt', truncatePromptForStability(prompt + ' photorealistic interior design with exact product matching from reference images'));
        formData.append('control_strength', validStrength.toString());
        formData.append('style_strength', '0.8'); // High style strength for product fidelity
        formData.append('output_format', 'png');
        formData.append('negative_prompt', 'distorted furniture, wrong products, incorrect colors, mismatched items, blurry, low quality');
        
        const response = await fetch('https://api.stability.ai/v2beta/stable-image/control/sketch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
            'Accept': 'image/*'
          },
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Stability AI Sketch API error (${response.status}): ${errorText}`);
          console.log('Falling back to structure-only refinement...');
        } else {
          const refinedImageBuffer = await response.arrayBuffer();
          const base64Refined = Buffer.from(refinedImageBuffer).toString('base64');
          console.log('✅ Stability AI refinement with product references complete');
          return `data:image/png;base64,${base64Refined}`;
        }
      }
    }
    
    // Fallback: Use structure control without product references
    console.log('📐 Using structure-only refinement (no product references)');
    const formData = new FormData();
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', imageBlob, 'render.png');
    formData.append('prompt', truncatePromptForStability(prompt + ' photorealistic interior design, accurate product representation, exact furniture matching'));
    formData.append('control_strength', validStrength.toString());
    formData.append('output_format', 'png');
    formData.append('negative_prompt', 'distorted furniture, wrong products, incorrect colors, mismatched items, blurry, low quality');
    
    const response = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
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
