/**
 * Stability AI Image-to-Image Rendering Service
 * Generates room renders using Stability AI's SD3 model
 * Uses multipart/form-data as per official API spec
 */

const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image/generate/sd3";

interface StabilityRenderParams {
  roomImageUrl: string;
  products: Array<{
    sku: string;
    name: string;
    visualDescription?: string | null;
    colors?: string[] | null;
    dimensions?: any;
  }>;
  roomType?: string;
  stylePreference?: string;
  sharedPrompt?: string; // Pre-built prompt from shared-prompt-builder (for fair comparison)
}

interface StabilityRenderResult {
  success: boolean;
  imageBase64?: string;
  productsUsed?: number;
  error?: string;
}

/**
 * Truncate prompt to fit Stability AI's limit
 */
function truncatePrompt(prompt: string, maxLength: number = 9500): string {
  if (prompt.length <= maxLength) return prompt;
  console.warn(`⚠️ Prompt truncated from ${prompt.length} to ${maxLength} chars`);
  return prompt.substring(0, maxLength) + '...';
}

/**
 * Resolve relative URLs to absolute URLs
 */
function resolveImageUrl(imageUrl: string): string {
  // If already absolute, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Resolve relative URLs using domain
  const domain = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
  const fullDomain = domain.startsWith('http') ? domain : `https://${domain}`;
  
  // Ensure URL starts with /
  const normalizedUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  
  return `${fullDomain}${normalizedUrl}`;
}

/**
 * Generate render using Stability AI image-to-image
 * Uses shared prompt builder for fair comparison with Gemini/OpenAI
 */
export async function generateStabilityRender(
  params: StabilityRenderParams
): Promise<StabilityRenderResult> {
  try {
    if (!STABILITY_API_KEY) {
      throw new Error("STABILITY_API_KEY not configured");
    }

    const isTextToImage = !params.roomImageUrl || params.roomImageUrl.trim() === '';
    
    console.log(`\n🎨 Starting Stability AI render generation...`);
    console.log(`   Mode: ${isTextToImage ? 'Text-to-image' : 'Image-to-image'}`);
    console.log(`   Room image: ${params.roomImageUrl || '(none)'}`);
    console.log(`   Products: ${params.products.length}`);

    // Fetch room image (only for image-to-image mode)
    let roomImageBuffer: ArrayBuffer | null = null;
    if (!isTextToImage) {
      // Resolve relative URL to absolute
      const absoluteUrl = resolveImageUrl(params.roomImageUrl);
      console.log(`📥 Fetching room image: ${absoluteUrl}`);
      const roomImageResponse = await fetch(absoluteUrl);
      if (!roomImageResponse.ok) {
        throw new Error(`Failed to fetch room image: ${roomImageResponse.statusText}`);
      }
      roomImageBuffer = await roomImageResponse.arrayBuffer();
      console.log(`✅ Room image loaded`);
    }

    // Use pre-built shared prompt if provided (for fair comparison), otherwise build our own
    let prompt: string;
    if (params.sharedPrompt) {
      prompt = params.sharedPrompt;
      console.log(`📝 Using pre-built shared prompt (${prompt.length} chars)`);
    } else {
      const { buildSharedPrompt } = await import('./shared-prompt-builder');
      const sharedPrompt = await buildSharedPrompt({
        roomImageUrl: params.roomImageUrl,
        products: params.products,
        roomType: params.roomType,
        stylePreference: params.stylePreference,
      });
      prompt = sharedPrompt.mainPrompt;
      console.log(`📝 Built prompt (${prompt.length} chars)`);
    }

    console.log(`📝 Shared prompt length: ${prompt.length} chars`);

    // Create FormData for Stability AI API (multipart/form-data)
    const formData = new FormData();
    
    // Add image only for image-to-image mode
    if (!isTextToImage && roomImageBuffer) {
      formData.append('image', new Blob([roomImageBuffer]), 'room.jpg');
      formData.append('image_strength', '0.65'); // Only for image-to-image
    }
    
    formData.append('prompt', truncatePrompt(prompt));
    formData.append('output_format', 'png');
    formData.append('model', 'sd3-5-large'); // Correct model name with hyphens

    console.log(`🚀 Calling Stability AI SD3 API (${isTextToImage ? 'text-to-image' : 'image-to-image'})...`);
    const response = await fetch(STABILITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json', // Request JSON response with base64
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Stability AI API error (${response.status}):`, errorText);
      throw new Error(`Stability AI API error: ${response.status} - ${errorText}`);
    }

    // Parse JSON response
    const responseData = await response.json();
    
    // SD3 returns base64 in 'image' field when Accept: application/json
    if (!responseData.image) {
      console.error(`❌ No image in Stability AI response:`, responseData);
      throw new Error('No image returned from Stability AI');
    }

    const imageBase64 = `data:image/png;base64,${responseData.image}`;

    console.log(`✅ Stability AI render generated successfully!`);

    return {
      success: true,
      imageBase64,
      productsUsed: params.products.length,
    };

  } catch (error) {
    console.error(`❌ Stability AI render generation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
