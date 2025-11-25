/**
 * Stability AI Inpainting Render Service
 * 
 * Uses Stability AI's Edit API for true pixel-level control:
 * - Creates a mask for furniture placement zones
 * - Only generates content in masked areas
 * - Preserves room architecture (walls, ceiling, windows) perfectly
 * 
 * This solves the fundamental Gemini limitation where it regenerates entire images.
 */

import sharp from 'sharp';

const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const STABILITY_EDIT_URL = "https://api.stability.ai/v2beta/stable-image/edit/inpaint";

interface InpaintProduct {
  sku: string;
  name: string;
  imageUrl?: string;
  visualDescription?: string | null;
  colors?: string[] | null;
  category?: string | null;
}

interface InpaintRenderParams {
  roomImageBase64: string;  // Original room image
  products: InpaintProduct[];
  roomType?: string;
  stylePreference?: string;
  placementZones?: {  // Optional explicit placement zones
    type: 'floor' | 'wall' | 'corner';
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}

interface InpaintRenderResult {
  success: boolean;
  imageBase64?: string;
  productsUsed?: number;
  error?: string;
}

/**
 * Generate a mask for furniture placement areas (floor region)
 * White = areas to regenerate (where furniture goes)
 * Black = areas to preserve (walls, ceiling, windows)
 * 
 * Note: This is a basic heuristic. For production, consider:
 * - Semantic segmentation to detect actual floor regions
 * - User-supplied placement zones
 * - Room type-specific masks (bedroom vs living room)
 */
async function generateFloorMask(
  width: number,
  height: number
): Promise<Buffer> {
  // Create a mask that covers the bottom 60% of the image (floor area)
  // This is a simple heuristic - in production you'd use semantic segmentation
  const maskHeight = Math.floor(height * 0.55);  // 55% from bottom
  const maskY = height - maskHeight;
  
  // Create mask: black everywhere except floor area (white)
  const mask = Buffer.alloc(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Floor area: bottom 55% of image, but not the very edges
      const isFloorArea = y >= maskY && 
                         x > width * 0.05 && 
                         x < width * 0.95;
      
      // Taper the edges for more natural blending
      let alpha = 0;
      if (isFloorArea) {
        // Vertical gradient: stronger at bottom, fading toward middle
        const verticalFade = (y - maskY) / maskHeight;
        alpha = Math.min(255, Math.floor(255 * verticalFade * 1.2));
      }
      
      mask[idx] = alpha;
    }
  }
  
  // Apply gaussian blur for smooth edges
  const blurredMask = await sharp(mask, {
    raw: { width, height, channels: 1 }
  })
    .blur(15)  // Smooth the mask edges
    .raw()
    .toBuffer();
  
  // Convert to PNG for API
  const maskPng = await sharp(blurredMask, {
    raw: { width, height, channels: 1 }
  })
    .png()
    .toBuffer();
  
  return maskPng;
}

/**
 * Build a focused prompt for furniture-only generation
 */
function buildInpaintPrompt(
  products: InpaintProduct[],
  stylePreference?: string
): string {
  const style = stylePreference || 'modern';
  
  const productDescriptions = products.map((p, i) => {
    const details: string[] = [];
    if (p.colors && p.colors.length > 0) {
      details.push(`${p.colors.join('/')} color`);
    }
    if (p.visualDescription) {
      details.push(p.visualDescription.slice(0, 100));
    }
    const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
    return `${p.name}${detailStr}`;
  }).join(', ');

  return `High-end ${style} interior design render with these exact furniture pieces on the floor: ${productDescriptions}. 
Photorealistic, professional interior photography, natural lighting, each piece of furniture clearly visible and separate.
The furniture should look like high-quality catalog products placed naturally in the space.
DO NOT add any extra furniture, wall art, or decorations beyond what is listed.`;
}

/**
 * Generate render using Stability AI inpainting
 * This preserves room architecture perfectly by only generating in masked floor areas
 */
export async function generateInpaintRender(
  params: InpaintRenderParams
): Promise<InpaintRenderResult> {
  try {
    if (!STABILITY_API_KEY) {
      return { 
        success: false, 
        error: "STABILITY_API_KEY not configured - inpainting unavailable" 
      };
    }

    console.log(`\n🎨 Starting Stability AI INPAINTING render...`);
    console.log(`   Products: ${params.products.length}`);
    console.log(`   Style: ${params.stylePreference || 'modern'}`);

    // Decode room image
    const imageData = params.roomImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(imageData, 'base64');
    
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;
    
    console.log(`   Room dimensions: ${width}x${height}`);

    // Generate mask for floor area (where furniture will be placed)
    console.log(`   🎭 Generating floor mask...`);
    const maskBuffer = await generateFloorMask(width, height);
    console.log(`   ✅ Mask generated (${maskBuffer.length} bytes)`);

    // Build prompt focused on furniture
    const prompt = buildInpaintPrompt(params.products, params.stylePreference);
    console.log(`   📝 Prompt: ${prompt.slice(0, 100)}...`);

    // Prepare image in correct format
    const imagePng = await sharp(imageBuffer).png().toBuffer();

    // Create FormData for Stability AI Edit API
    const formData = new FormData();
    formData.append('image', new Blob([imagePng]), 'room.png');
    formData.append('mask', new Blob([maskBuffer]), 'mask.png');
    formData.append('prompt', prompt);
    formData.append('output_format', 'png');
    // grow_mask helps blend edges
    formData.append('grow_mask', '5');

    console.log(`   🚀 Calling Stability AI Inpaint API...`);
    
    const response = await fetch(STABILITY_EDIT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Stability AI Inpaint error (${response.status}):`, errorText);
      return {
        success: false,
        error: `Stability AI Inpaint API error: ${response.status} - ${errorText}`,
      };
    }

    const responseData = await response.json();
    
    if (!responseData.image) {
      console.error(`   ❌ No image in response:`, responseData);
      return {
        success: false,
        error: 'No image returned from Stability AI Inpaint',
      };
    }

    const resultBase64 = `data:image/png;base64,${responseData.image}`;
    
    console.log(`   ✅ Inpainting render complete!`);
    console.log(`   📊 Products rendered: ${params.products.length}`);

    return {
      success: true,
      imageBase64: resultBase64,
      productsUsed: params.products.length,
    };

  } catch (error) {
    console.error(`   ❌ Inpainting render failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown inpainting error',
    };
  }
}

/**
 * Check if Stability AI inpainting is available
 */
export function isInpaintingAvailable(): boolean {
  return !!STABILITY_API_KEY;
}
