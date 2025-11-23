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
 * Analyze room image using GPT-5 Vision to extract architectural details
 * This allows OpenAI to work from the same room photo as Gemini/Stability
 */
async function analyzeRoomImage(roomImageUrl: string): Promise<string> {
  try {
    // Resolve relative URLs to absolute
    const absoluteUrl = roomImageUrl.startsWith('http') 
      ? roomImageUrl 
      : `${process.env.REPLIT_DEV_DOMAIN?.startsWith('http') ? process.env.REPLIT_DEV_DOMAIN : `https://${process.env.REPLIT_DEV_DOMAIN}`}${roomImageUrl.startsWith('/') ? roomImageUrl : `/${roomImageUrl}`}`;
    
    console.log(`  🔍 Analyzing with GPT-5 Vision: ${absoluteUrl}`);
    
    // Analyze with GPT-5 Vision (using Replit AI Integrations)
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this room's architectural features in detail. Describe:
1. Wall positions, colors, and materials
2. Floor type and color  
3. Ceiling height and design
4. Window locations, sizes, and styles
5. Door positions and types
6. Built-in features (shelves, fireplace, etc.)
7. Room dimensions (estimate)
8. Lighting fixtures and their positions
9. Any architectural details (molding, columns, etc.)

Be specific and precise - this will be used to recreate the exact same room structure with new furniture.`
          },
          {
            type: "image_url",
            image_url: {
              url: absoluteUrl,
            }
          }
        ]
      }],
      max_tokens: 1000,
    });
    
    const analysis = response.choices[0]?.message?.content || 'Room analysis unavailable';
    console.log(`  ✅ GPT-5 Vision analysis complete (${analysis.length} chars)`);
    return analysis;
  } catch (error) {
    console.error('GPT-5 Vision analysis failed:', error);
    return 'Room analysis unavailable';
  }
}

/**
 * Generate room render using OpenAI DALL-E (gpt-image-1)
 * Note: OpenAI doesn't support image-to-image, so we analyze the room first
 * then use text-to-image with architectural details to match Gemini/Stability inputs
 */
export async function generateOpenAIRender(params: OpenAIRenderParams): Promise<OpenAIRenderResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n🎨 Starting OpenAI DALL-E render generation...`);
    console.log(`📍 Room image: ${params.roomImageUrl || '(none - text-to-image mode)'}`);
    console.log(`📦 Products to furnish: ${params.products.length}`);
    
    // If room image provided, analyze it first for fair comparison with Gemini/Stability
    let roomAnalysis = '';
    if (params.roomImageUrl && params.roomImageUrl.trim().length > 0) {
      console.log(`🔍 Analyzing room image to extract architectural details...`);
      roomAnalysis = await analyzeRoomImage(params.roomImageUrl);
      console.log(`✅ Room analysis complete`);
    }
    
    // Build detailed prompt from products
    const productDescriptions = params.products
      .map((p, i) => {
        const desc = p.condensedDescription || p.visualDescription || p.name;
        const colors = p.colors && p.colors.length > 0 ? ` in ${p.colors.join(' and ')}` : '';
        return `${i + 1}. ${p.name}${colors}: ${desc}`;
      })
      .join('\n');
    
    // Construct comprehensive prompt with STRICT preservation requirements
    const roomDescription = roomAnalysis || 
                           params.floorPlanAnalysis?.overallDescription || 
                           `A ${params.stylePreference || 'modern'} ${params.roomType || 'living room'}`;
    
    // Build strict architectural context
    let architecturalContext = '';
    if (roomAnalysis) {
      architecturalContext = `\n\n🔒 CRITICAL - PRESERVE THESE EXACT ARCHITECTURAL FEATURES:
${roomAnalysis}

⚠️ STRICT REQUIREMENT: Recreate this EXACT room structure. ALL walls, floors, ceiling, windows, doors, built-in features, and architectural details MUST match the description above PRECISELY. Only furniture should be different - the room itself must be IDENTICAL.`;
    } else if (params.floorPlanAnalysis) {
      architecturalContext = `\n\n🔒 CRITICAL - PRESERVE THESE ARCHITECTURAL FEATURES EXACTLY:
• Room Dimensions: ${params.floorPlanAnalysis.roomDimensions || 'As specified in the space'}
• Windows: ${params.floorPlanAnalysis.windowLocations?.join(', ') || 'Existing window placement'} - DO NOT move, resize, or change
• Doors/Openings: ${params.floorPlanAnalysis.doorLocations?.join(', ') || 'Existing door positions'} - DO NOT relocate or modify
• Ceiling: ${params.floorPlanAnalysis.ceilingRoofDesign || 'Standard height'} - Keep exact height and design
• Built-in Features: ${params.floorPlanAnalysis.builtInFeatures?.join(', ') || 'None specified'} - Must remain in place
• Layout: ${params.floorPlanAnalysis.layoutNotes || 'Existing layout'}

⚠️ STRICT REQUIREMENT: Preserve ALL walls, floors, ceiling, windows, and doors in their EXACT positions and dimensions. Only furniture is new - the room structure must remain IDENTICAL to the specification above.`;
    }
    
    const prompt = roomAnalysis 
      ? `Recreate this EXACT room with new furniture.${architecturalContext}

Furnish with these products (preserve ALL room structure, only change furniture):
${productDescriptions}

REQUIREMENTS:
• Recreate the room's architecture EXACTLY as described above
• Photorealistic quality with professional lighting matching the original room
• All products clearly visible, properly scaled to real-world dimensions
• Accurate product colors and materials as specified
• Natural furniture placement following interior design principles
• High-resolution, magazine-quality composition
• Room structure (walls, floor, ceiling, windows, doors, built-ins) must be IDENTICAL to description
• Only furniture is new - everything else preserved precisely`
      : `Create a photorealistic interior design render of ${roomDescription}.${architecturalContext}

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
    console.log(`🎨 Calling OpenAI GPT Image 1 with ${roomAnalysis ? 'GPT-5 Vision analysis' : 'floor plan details'}...`);
    
    // Generate image using GPT Image 1 (replaces DALL-E 3, superior text rendering and photorealism)
    // GPT-5 is the language model (August 2025), gpt-image-1 is the image generation model
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
