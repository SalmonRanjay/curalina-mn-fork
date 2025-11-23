import OpenAI from "openai";
import { Buffer } from "node:buffer";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

interface OpenAIRenderParams {
  roomImageUrl?: string;
  products: Array<{
    sku: string;
    name: string;
    visualDescription?: string;
    condensedDescription?: string;
    colors?: string[];
    dimensions?: any;
  }>;
  roomType?: string;
  stylePreference?: string;
  floorPlanAnalysis?: any;
}

interface OpenAIRenderResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  productsUsed: number;
  productsSentToAI: string[];
  generationTime?: number;
}

/**
 * Generate room render using OpenAI DALL-E (gpt-image-1)
 * Note: OpenAI doesn't support image-to-image with product references like Gemini/Stability
 * So we'll use text-to-image with detailed descriptions
 */
export async function generateOpenAIRender(params: OpenAIRenderParams): Promise<OpenAIRenderResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n🎨 Starting OpenAI DALL-E render generation...`);
    console.log(`📦 Products to furnish: ${params.products.length}`);
    
    // Build detailed prompt from products
    const productDescriptions = params.products
      .map((p, i) => {
        const desc = p.condensedDescription || p.visualDescription || p.name;
        const colors = p.colors && p.colors.length > 0 ? ` in ${p.colors.join(' and ')}` : '';
        return `${i + 1}. ${p.name}${colors}: ${desc}`;
      })
      .join('\n');
    
    // Construct comprehensive prompt
    const roomDescription = params.floorPlanAnalysis?.overallDescription || 
                           `A ${params.stylePreference || 'modern'} ${params.roomType || 'living room'}`;
    
    const architecturalContext = params.floorPlanAnalysis ? 
      `\nArchitectural features:
- Windows: ${params.floorPlanAnalysis.windowLocations?.join(', ') || 'Standard placement'}
- Ceiling: ${params.floorPlanAnalysis.ceilingRoofDesign || 'Standard height'}
- Layout: ${params.floorPlanAnalysis.layoutNotes || 'Rectangular layout'}` : '';
    
    const prompt = `Create a photorealistic interior design render of ${roomDescription}.${architecturalContext}

Furnish the room with these exact products:
${productDescriptions}

Requirements:
- Photorealistic quality with professional lighting
- All products must be clearly visible and properly scaled
- Maintain accurate product colors and materials
- Natural furniture placement following interior design principles
- High-resolution, magazine-quality composition`;

    console.log(`📝 Prompt length: ${prompt.length} characters`);
    console.log(`🎨 Calling OpenAI gpt-image-1...`);
    
    // Generate image using OpenAI DALL-E
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    // However, for image generation, we use gpt-image-1
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024",
      // Note: response_format is not supported for gpt-image-1, always returns base64
    });

    const imageBase64 = response.data?.[0]?.b64_json;
    
    if (!imageBase64) {
      throw new Error('No image data returned from OpenAI');
    }
    
    const generationTime = Date.now() - startTime;
    console.log(`✅ OpenAI render generated in ${(generationTime / 1000).toFixed(1)}s`);
    
    // Return all products as "sent to AI" since we described them in the prompt
    const productSkus = params.products.map(p => p.sku);
    
    return {
      success: true,
      imageBase64,
      productsUsed: params.products.length,
      productsSentToAI: productSkus,
      generationTime
    };
    
  } catch (error) {
    const generationTime = Date.now() - startTime;
    console.error(`❌ OpenAI render generation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: 0,
      productsSentToAI: [],
      generationTime
    };
  }
}
