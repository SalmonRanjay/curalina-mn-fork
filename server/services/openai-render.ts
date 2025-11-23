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
    
    // Construct comprehensive prompt with STRICT preservation requirements
    const roomDescription = params.floorPlanAnalysis?.overallDescription || 
                           `A ${params.stylePreference || 'modern'} ${params.roomType || 'living room'}`;
    
    // Build strict architectural context when floor plan is available
    let architecturalContext = '';
    if (params.floorPlanAnalysis) {
      architecturalContext = `\n\n🔒 CRITICAL - PRESERVE THESE ARCHITECTURAL FEATURES EXACTLY:
• Room Dimensions: ${params.floorPlanAnalysis.roomDimensions || 'As specified in the space'}
• Windows: ${params.floorPlanAnalysis.windowLocations?.join(', ') || 'Existing window placement'} - DO NOT move, resize, or change
• Doors/Openings: ${params.floorPlanAnalysis.doorLocations?.join(', ') || 'Existing door positions'} - DO NOT relocate or modify
• Ceiling: ${params.floorPlanAnalysis.ceilingRoofDesign || 'Standard height'} - Keep exact height and design
• Built-in Features: ${params.floorPlanAnalysis.builtInFeatures?.join(', ') || 'None specified'} - Must remain in place
• Layout: ${params.floorPlanAnalysis.layoutNotes || 'Existing layout'}

⚠️ STRICT REQUIREMENT: Preserve ALL walls, floors, ceiling, windows, and doors in their EXACT positions and dimensions. Only furniture is new - the room structure must remain IDENTICAL to the specification above.`;
    }
    
    const prompt = `Create a photorealistic interior design render of ${roomDescription}.${architecturalContext}

Furnish this space with these exact products (ONLY change furniture, preserve all room structure):
${productDescriptions}

REQUIREMENTS:
• Photorealistic quality with professional lighting and shadows
• All products must be clearly visible, properly scaled to real-world dimensions
• Maintain accurate product colors and materials exactly as specified
• Natural furniture placement following interior design principles
• High-resolution, magazine-quality composition
• Preserve exact room dimensions, wall positions, window locations, and door placements
• DO NOT modify any structural elements - walls, floors, ceiling, windows, doors must match specifications EXACTLY
• Only furniture should be different - everything else must be preserved precisely`;


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
