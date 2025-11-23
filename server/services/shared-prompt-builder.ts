import type { Product } from "@shared/schema";

/**
 * Shared prompt builder for AI comparison system
 * Ensures all three AI services (Gemini, OpenAI, Stability AI) receive identical prompts
 */

export interface PromptBuilderParams {
  roomImageUrl?: string | null;
  products: Array<{
    sku: string;
    name: string;
    visualDescription?: string | null;
    condensedDescription?: string | null;
    colors?: string[] | null;
    dimensions?: any;
  }>;
  roomType?: string;
  stylePreference?: string;
}

export interface PromptBuilderResult {
  mainPrompt: string;
  architecturalContext: string;
  roomAnalysis?: string;
  productDescriptions: string;
}

/**
 * Analyze room image using GPT-5 Vision to extract architectural details
 * This analysis is shared across all three services for fair comparison
 */
async function analyzeRoomWithGPT5Vision(roomImageUrl: string): Promise<string> {
  try {
    // Initialize OpenAI client (Replit AI Integrations)
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!,
    });
    
    // Resolve relative URLs to absolute
    const absoluteUrl = roomImageUrl.startsWith('http') 
      ? roomImageUrl 
      : `${process.env.REPLIT_DEV_DOMAIN?.startsWith('http') ? process.env.REPLIT_DEV_DOMAIN : `https://${process.env.REPLIT_DEV_DOMAIN}`}${roomImageUrl.startsWith('/') ? roomImageUrl : `/${roomImageUrl}`}`;
    
    console.log(`  🔍 Analyzing room with GPT-5 Vision: ${absoluteUrl}`);
    
    // Analyze with GPT-5 Vision
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
      max_completion_tokens: 1000,
    });
    
    const analysis = response.choices[0]?.message?.content || 'Room analysis unavailable';
    console.log(`  ✅ GPT-5 Vision analysis complete (${analysis.length} chars)`);
    return analysis;
  } catch (error) {
    console.error('GPT-5 Vision room analysis failed:', error);
    return 'Room analysis unavailable';
  }
}

/**
 * Build consistent prompt for all AI services
 * This ensures fair comparison by giving identical instructions to all three services
 */
export async function buildSharedPrompt(params: PromptBuilderParams): Promise<PromptBuilderResult> {
  console.log(`\n📝 Building shared prompt for AI comparison...`);
  console.log(`   Room image: ${params.roomImageUrl || '(none - text-to-image mode)'}`);
  console.log(`   Products: ${params.products.length}`);
  
  // Analyze room if image provided
  let roomAnalysis = '';
  if (params.roomImageUrl && params.roomImageUrl.trim().length > 0) {
    roomAnalysis = await analyzeRoomWithGPT5Vision(params.roomImageUrl);
  }
  
  // Build product descriptions (identical for all services)
  const productDescriptions = params.products
    .map((p, i) => {
      const desc = p.condensedDescription || p.visualDescription || p.name;
      const colors = p.colors && p.colors.length > 0 ? ` in ${p.colors.join(' and ')}` : '';
      return `${i + 1}. ${p.name}${colors}: ${desc}`;
    })
    .join('\n');
  
  // Build architectural context
  let architecturalContext = '';
  if (roomAnalysis) {
    // Image-to-image mode: Use GPT-5 Vision analysis
    architecturalContext = `\n\n🔒 CRITICAL - PRESERVE THESE EXACT ARCHITECTURAL FEATURES:
${roomAnalysis}

⚠️ STRICT REQUIREMENT: Recreate this EXACT room structure. ALL walls, floors, ceiling, windows, doors, built-in features, and architectural details MUST match the description above PRECISELY. Only furniture should be different - the room itself must be IDENTICAL.`;
  } else {
    // Text-to-image mode: Generic room description (no preservation constraints)
    architecturalContext = `\n\n✨ Create a beautiful, cohesive ${params.stylePreference || 'modern'} ${params.roomType || 'room'} with professional interior design.`;
  }
  
  // Build main prompt (consistent structure for all services)
  const roomDescription = roomAnalysis 
    ? `Recreate this EXACT room with new furniture`
    : `Create a photorealistic interior design render of a ${params.stylePreference || 'modern'} ${params.roomType || 'room'}`;
  
  const mainPrompt = `${roomDescription}.${architecturalContext}

Furnish with these products (${roomAnalysis ? 'preserve ALL room structure, only change furniture' : 'create cohesive design'}):
${productDescriptions}

REQUIREMENTS:
• Photorealistic quality with professional lighting${roomAnalysis ? ' matching the original room' : ' and shadows'}
• All products clearly visible, properly scaled to real-world dimensions
• Accurate product colors and materials as specified
• Natural furniture placement following interior design principles
• High-resolution, magazine-quality composition
${roomAnalysis ? '• Room structure (walls, floor, ceiling, windows, doors, built-ins) must be IDENTICAL to description' : '• Cohesive color palette and style throughout'}
• Only furniture is new - everything else preserved precisely

${roomAnalysis ? 'Now, furnish this space with the product images provided.' : 'Use the product images provided to create this design.'}`;

  console.log(`   ✅ Shared prompt built (${mainPrompt.length} chars)`);
  
  return {
    mainPrompt,
    architecturalContext,
    roomAnalysis,
    productDescriptions,
  };
}
