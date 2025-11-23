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
 * Generate render using Stability AI image-to-image
 */
export async function generateStabilityRender(
  params: StabilityRenderParams
): Promise<StabilityRenderResult> {
  try {
    if (!STABILITY_API_KEY) {
      throw new Error("STABILITY_API_KEY not configured");
    }

    console.log(`\n🎨 Starting Stability AI render generation...`);
    console.log(`   Room image: ${params.roomImageUrl}`);
    console.log(`   Products: ${params.products.length}`);

    // Fetch room image
    console.log(`📥 Fetching room image...`);
    const roomImageResponse = await fetch(params.roomImageUrl);
    if (!roomImageResponse.ok) {
      throw new Error(`Failed to fetch room image: ${roomImageResponse.statusText}`);
    }
    const roomImageBuffer = await roomImageResponse.arrayBuffer();
    console.log(`✅ Room image loaded`);

    // Build comprehensive prompt with strict preservation requirements
    const productDescriptions = params.products
      .map((p, i) => {
        const desc = p.visualDescription || p.name;
        const colors = p.colors?.filter(Boolean).join(', ') || '';
        return `${i + 1}. ${p.name}${colors ? ` (${colors})` : ''}: ${desc}`;
      })
      .join('\n');

    const prompt = `
🔒 CRITICAL - PRESERVE USER'S CURRENT SPACE:
• Keep ALL room structure EXACTLY as shown - walls, floors, ceiling, windows, doors unchanged
• Preserve room dimensions, architectural features, lighting, wall colors, floor materials
• DO NOT move, resize, or change any structural elements
• ONLY change furniture - everything else must remain precisely as photographed

🏠 Room Type: ${params.roomType || 'room'}
🎨 Style: ${params.stylePreference || 'modern'}

📦 FURNITURE TO ADD:
${productDescriptions}

⚠️ STRICT REQUIREMENT: This is furniture replacement only. Any changes to walls/windows/floors/ceiling = FAILURE.

Generate a photorealistic ${params.stylePreference || 'modern'} ${params.roomType || 'room'} design with these products, preserving ALL existing room structure.
`.trim();

    console.log(`📝 Prompt length: ${prompt.length} chars`);

    // Create FormData for Stability AI API (multipart/form-data)
    // Note: 'mode' is implied when image is provided, so we don't send it
    const formData = new FormData();
    formData.append('image', new Blob([roomImageBuffer]), 'room.jpg');
    formData.append('prompt', truncatePrompt(prompt));
    formData.append('image_strength', '0.65'); // Correct parameter name for SD3
    formData.append('output_format', 'png');
    formData.append('model', 'sd3-5-large'); // Correct model name with hyphens
    // seed can be omitted for random generation

    console.log(`🚀 Calling Stability AI SD3 API with SD3.5 Large model...`);
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
