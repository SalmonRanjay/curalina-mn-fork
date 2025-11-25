import { GoogleGenAI, Modality } from "@google/genai";
import type { Product } from "@shared/schema";
import { applyQCRefinement } from "./stability-ai-qc";

// Initialize Gemini client using Replit AI Integrations
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

/**
 * Room analysis result with architecture description and estimated dimensions
 */
interface RoomAnalysisResult {
  architectureDescription: string;
  estimatedDimensions: {
    lengthFeet: number | null;
    widthFeet: number | null;
    ceilingHeightFeet: number | null;
    usableFloorArea: string;
    wallLengths: string[];
  };
}

/**
 * Analyze room architecture using Gemini Vision BEFORE rendering
 * This gives the model a detailed understanding of what to preserve
 * Now also estimates room dimensions from the image
 */
async function analyzeRoomWithGeminiVision(roomImageBase64: string): Promise<RoomAnalysisResult> {
  const emptyResult: RoomAnalysisResult = {
    architectureDescription: '',
    estimatedDimensions: {
      lengthFeet: null,
      widthFeet: null,
      ceilingHeightFeet: null,
      usableFloorArea: 'unknown',
      wallLengths: []
    }
  };
  
  try {
    console.log(`\n🔍 ANALYZING ROOM ARCHITECTURE with Gemini Vision...`);
    
    // Extract base64 data
    const base64Data = roomImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = roomImageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            text: `Analyze this room's architecture in detail. Provide TWO sections:

SECTION 1 - ARCHITECTURE DESCRIPTION (max 150 words, dense paragraph):
Cover walls (color, texture, position), floor (material, color), ceiling (height estimate, features), windows (position, size, shape), doors (position, style), lighting (natural light direction), perspective (camera angle), and existing elements (built-ins, moldings).

SECTION 2 - ESTIMATED DIMENSIONS (use visual cues like doors, windows, furniture to estimate):
Estimate these values based on standard reference sizes:
- Standard interior door: 80" tall x 36" wide
- Standard window: 36-48" wide
- Standard ceiling: 8-10 feet
- Average sofa: 7 feet long

Provide your estimates in this EXACT format:
DIMENSIONS:
- Room length: [X] feet (estimated)
- Room width: [X] feet (estimated)
- Ceiling height: [X] feet (estimated)
- Available wall lengths: [list wall segments and estimated lengths]
- Usable floor area: [small/medium/large/very large]

Be PRECISE. This will guide furniture placement and scaling.`
          },
          {
            inlineData: {
              data: base64Data,
              mimeType
            }
          }
        ]
      }]
    });
    
    const fullAnalysis = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (fullAnalysis.length > 0) {
      console.log(`   ✅ Room analysis complete (${fullAnalysis.length} chars)`);
      
      // Parse the response to extract dimensions
      const dimensions = parseRoomDimensions(fullAnalysis);
      
      // Extract just the architecture description (before DIMENSIONS:)
      const archDesc = fullAnalysis.split('DIMENSIONS:')[0].trim();
      
      console.log(`   📝 Architecture: ${archDesc.substring(0, 150)}...`);
      console.log(`   📐 Estimated dimensions: ~${dimensions.lengthFeet || '?'}ft x ${dimensions.widthFeet || '?'}ft, ceiling ${dimensions.ceilingHeightFeet || '?'}ft`);
      console.log(`   📏 Usable area: ${dimensions.usableFloorArea}`);
      
      return {
        architectureDescription: archDesc,
        estimatedDimensions: dimensions
      };
    }
    
    console.log(`   ⚠️ Room analysis returned empty`);
    return emptyResult;
  } catch (error) {
    console.error(`   ❌ Room analysis failed:`, error);
    return emptyResult;
  }
}

/**
 * Parse room dimensions from Gemini Vision analysis text
 */
function parseRoomDimensions(analysisText: string): RoomAnalysisResult['estimatedDimensions'] {
  const result: RoomAnalysisResult['estimatedDimensions'] = {
    lengthFeet: null,
    widthFeet: null,
    ceilingHeightFeet: null,
    usableFloorArea: 'unknown',
    wallLengths: []
  };
  
  try {
    // Extract room length
    const lengthMatch = analysisText.match(/Room length:\s*(\d+(?:\.\d+)?)\s*feet/i);
    if (lengthMatch) result.lengthFeet = parseFloat(lengthMatch[1]);
    
    // Extract room width
    const widthMatch = analysisText.match(/Room width:\s*(\d+(?:\.\d+)?)\s*feet/i);
    if (widthMatch) result.widthFeet = parseFloat(widthMatch[1]);
    
    // Extract ceiling height
    const ceilingMatch = analysisText.match(/Ceiling height:\s*(\d+(?:\.\d+)?)\s*feet/i);
    if (ceilingMatch) result.ceilingHeightFeet = parseFloat(ceilingMatch[1]);
    
    // Extract usable floor area category
    const areaMatch = analysisText.match(/Usable floor area:\s*(small|medium|large|very large)/i);
    if (areaMatch) result.usableFloorArea = areaMatch[1].toLowerCase();
    
    // Extract wall lengths (capture lines after "Available wall lengths:")
    const wallSection = analysisText.match(/Available wall lengths?:([^\n]*(?:\n(?!-\s*(?:Room|Ceiling|Usable))[^\n]*)*)/i);
    if (wallSection) {
      const wallLines = wallSection[1].split('\n').filter(line => line.trim());
      result.wallLengths = wallLines.map(line => line.trim()).filter(line => line.length > 0);
    }
  } catch (error) {
    console.warn('   ⚠️ Error parsing room dimensions:', error);
  }
  
  return result;
}

/**
 * Resolve relative URLs to absolute URLs for fetching
 * Handles /public-objects/... and other relative paths
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
 * Helper to fetch image and convert to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // Resolve relative URLs to absolute
    const absoluteUrl = resolveImageUrl(imageUrl);
    console.log(`  📥 Fetching: ${absoluteUrl}`);
    
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image ${absoluteUrl}: ${response.statusText}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Determine MIME type
    const contentType = response.headers.get('content-type');
    const mimeType = contentType || (imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg');
    
    return { data: base64, mimeType };
  } catch (error) {
    console.error(`Error fetching image ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Select front view image for each product
 * Returns array of product images to use as references
 */
function selectProductFrontViewImages(products: Product[]): Array<{ url: string; productName: string; sku: string }> {
  const productImages: Array<{ url: string; productName: string; sku: string }> = [];
  
  for (const product of products) {
    // Priority: frontView > first image in array
    let imageUrl: string | null = null;
    
    if (product.images) {
      if (typeof product.images === 'object' && 'frontView' in product.images && product.images.frontView) {
        imageUrl = product.images.frontView as string;
      } else if (Array.isArray(product.images) && product.images.length > 0) {
        imageUrl = product.images[0];
      }
    }
    
    if (imageUrl && isValidImageUrl(imageUrl)) {
      productImages.push({
        url: imageUrl,
        productName: product.name,
        sku: product.sku
      });
    } else {
      console.warn(`⚠️  Product ${product.name} (${product.sku}) has no valid image - SKIPPED from rendering`);
      console.warn(`   Images field: ${JSON.stringify(product.images)?.substring(0, 200)}`);
    }
  }
  
  return productImages;
}

/**
 * Validate image URL
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  
  // Check for valid URL formats
  const isExternalUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
  const isObjectStorage = trimmed.startsWith('/public-objects/') || trimmed.startsWith('/private-objects/');
  const isS3Path = trimmed.includes('s3.amazonaws.com') || trimmed.includes('curalina');
  
  return isExternalUrl || isObjectStorage || isS3Path;
}

/**
 * Detect functional category from product name and description
 */
function detectFunctionalCategory(product: Product): string {
  const name = product.name.toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const combined = `${name} ${desc}`;
  
  if (combined.includes('sofa') || combined.includes('couch') || combined.includes('sectional')) return 'Seating';
  if (combined.includes('chair') || combined.includes('armchair') || combined.includes('accent chair')) return 'Seating';
  if (combined.includes('coffee table')) return 'Coffee Table';
  if (combined.includes('side table') || combined.includes('end table') || combined.includes('accent table')) return 'Side Table';
  if (combined.includes('dining table')) return 'Dining Table';
  if (combined.includes('console') || combined.includes('sideboard') || combined.includes('credenza')) return 'Console';
  if (combined.includes('bookshelf') || combined.includes('bookcase') || combined.includes('shelf')) return 'Storage';
  if (combined.includes('cabinet') || combined.includes('dresser') || combined.includes('chest')) return 'Storage';
  if (combined.includes('floor lamp')) return 'Floor Lamp';
  if (combined.includes('table lamp')) return 'Table Lamp';
  if (combined.includes('pendant') || combined.includes('chandelier')) return 'Pendant Light';
  if (combined.includes('lamp')) return 'Lighting';
  if (combined.includes('rug') || combined.includes('carpet')) return 'Rug';
  if (combined.includes('mirror')) return 'Mirror';
  if (combined.includes('plant') || combined.includes('vase') || combined.includes('art')) return 'Decor';
  if (combined.includes('ottoman') || combined.includes('pouf')) return 'Ottoman';
  if (combined.includes('bench')) return 'Bench';
  if (combined.includes('bed') || combined.includes('headboard')) return 'Bed';
  if (combined.includes('nightstand') || combined.includes('bedside')) return 'Nightstand';
  
  return 'Furniture';
}

/**
 * Get smart placement directive based on product category
 * Returns specific instructions for WHERE to place the product
 */
function getPlacementDirective(category: string, productIndex: number, totalProducts: number): string {
  const placementRules: Record<string, string> = {
    'Seating': 'Place as the main seating element in the conversation area, facing the focal point. Position with back against or angled toward a wall, leaving walkway clearance.',
    'Coffee Table': 'Position centrally in front of the main sofa/seating, leaving 16-18 inches between seating and table for comfortable access.',
    'Side Table': 'Place adjacent to seating - next to a sofa arm or beside an accent chair. Ensure the table top is roughly level with the arm height.',
    'Dining Table': 'Center in the dining area with equal clearance on all sides for chair pullout. Position under pendant lighting if present.',
    'Console': 'Position against a wall - behind a sofa, in an entryway, or against a focal wall. Leave 3-4 inches from wall.',
    'Storage': 'Place against a wall, away from windows. Align with room architecture and other furniture lines.',
    'Floor Lamp': 'Position behind or beside seating to provide reading/ambient light. Place in a corner or next to a sofa arm.',
    'Table Lamp': 'Place on a side table or console. Position to provide functional lighting for adjacent seating.',
    'Pendant Light': 'Suspend from ceiling over dining table, kitchen island, or as a focal point. Center over the furniture below.',
    'Lighting': 'Position to provide ambient or task lighting. Place near seating areas or as accent lighting.',
    'Rug': 'Center under the main furniture grouping. Front legs of seating should rest on the rug. Size should define the conversation area.',
    'Mirror': 'Mount on a wall opposite or adjacent to windows to reflect light. Position at eye level or above a console.',
    'Decor': 'Place on surfaces (consoles, shelves, coffee tables) or as floor elements in corners. Use to fill vertical space.',
    'Ottoman': 'Position in front of or adjacent to main seating. Can serve as extra seating or footrest.',
    'Bench': 'Place at the foot of a bed, in an entryway, or along a wall as additional seating.',
    'Bed': 'Center against the main wall, with nightstand space on both sides. Position with headboard against the wall.',
    'Nightstand': 'Place on each side of the bed, close enough for reaching from the bed. Align tops with mattress height.',
    'Furniture': 'Position in a visually balanced arrangement with other furniture. Maintain walkway clearance and sight lines.'
  };
  
  return placementRules[category] || placementRules['Furniture'];
}

/**
 * Get visual details from product for prompt
 */
function getProductVisualDetails(product: Product): string {
  const details: string[] = [];
  
  // Add colors
  if (product.colors && product.colors.length > 0) {
    details.push(product.colors.join(' and '));
  }
  
  // Add materials
  if (product.materials && product.materials.length > 0) {
    details.push(product.materials.slice(0, 2).join(' and '));
  }
  
  // Add condensed description if available
  if (product.visualDescription) {
    const condensed = product.visualDescription.substring(0, 150);
    details.push(condensed);
  }
  
  return details.join('. ') || 'Use the exact appearance from the reference image';
}

/**
 * Format dimensions for prompt
 */
function formatDimensions(dimensions: any): string {
  if (!dimensions) return '';
  
  if (dimensions.w && dimensions.d && dimensions.h) {
    const unit = dimensions.unit || 'inches';
    return `${dimensions.w}x${dimensions.d}x${dimensions.h} ${unit}`;
  }
  
  return '';
}

export interface ImageOnlyRenderParams {
  roomImageUrl: string;
  products: Product[];
  roomType?: string;
  stylePreference?: string;
  sharedPrompt?: string; // Pre-built prompt from shared-prompt-builder (for fair comparison)
  floorPlanAnalysis?: {
    roomDimensions: string;
    windowLocations: string[];
    doorLocations: string[];
    builtInFeatures: string[];
    ceilingRoofDesign: string;
    layoutNotes: string;
    overallDescription: string;
  };
  placementInstructions?: string; // Spatial guidance for furniture placement
}

export interface ImageOnlyRenderResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  productsUsed: number;
  productsSentToAI?: string[]; // SKUs of products actually sent to AI (after image filtering)
}

/**
 * Build the "Anchor & Composite" prompt based on Google AI Studio's strategy
 * 
 * Strategy:
 * 1. The Anchor (Structure): User's room photo as first reference - preserve geometry
 * 2. The Composites (Products): Actual cropped product images as secondary references
 * 
 * The prompt explicitly references each image and instructs Gemini to use THOSE EXACT objects.
 */
function buildAnchorCompositePrompt(
  products: Product[],
  productRefs: Array<{ url: string; productName: string; sku: string }>,
  roomType?: string,
  stylePreference?: string,
  hasRoomImage?: boolean,
  floorPlanAnalysis?: any,
  placementInstructions?: string
): string {
  // Extract style context
  const style = stylePreference || 'Modern';
  const room = roomType || 'living room';
  
  const totalProducts = productRefs.length;
  
  // Build product placement instructions with specific spatial directives
  const productInstructions = productRefs.map((ref, index) => {
    const product = products.find(p => p.sku === ref.sku);
    const category = product ? detectFunctionalCategory(product) : 'Furniture';
    const visualDetails = product ? getProductVisualDetails(product) : '';
    const dimensions = product ? formatDimensions(product.dimensions) : '';
    const placementDirective = getPlacementDirective(category, index, totalProducts);
    
    const imageNum = hasRoomImage ? index + 2 : index + 1; // Room is REFERENCE IMAGE 1 if present
    
    let instruction = `REFERENCE IMAGE ${imageNum}: [${category}] ${ref.productName}.
ACTION: Place this EXACT item in the room using the following placement:
PLACEMENT: ${placementDirective}
Visual Details: ${visualDetails || 'Match the exact appearance from the reference image.'}`;
    
    if (dimensions) {
      instruction += `\nDimensions: ${dimensions}`;
    }
    
    return instruction;
  }).join('\n\n');
  
  // Build architectural preservation instructions
  let architecturalInstructions = '';
  if (hasRoomImage) {
    if (floorPlanAnalysis) {
      architecturalInstructions = `PRESERVE EXACT ARCHITECTURE from REFERENCE IMAGE 1:
- Room Dimensions: ${floorPlanAnalysis.roomDimensions || 'As shown in image'}
- Windows: ${floorPlanAnalysis.windowLocations?.join(', ') || 'As shown in image'}
- Doors: ${floorPlanAnalysis.doorLocations?.join(', ') || 'As shown in image'}
- Built-in Features: ${floorPlanAnalysis.builtInFeatures?.join(', ') || 'As shown in image'}
- Ceiling: ${floorPlanAnalysis.ceilingRoofDesign || 'As shown in image'}
- Layout: ${floorPlanAnalysis.layoutNotes || 'Preserve exact floor plan'}`;
    } else {
      architecturalInstructions = `PRESERVE EXACT ARCHITECTURE from REFERENCE IMAGE 1:
Keep all walls, windows, floor, ceiling, doors, and perspective EXACTLY as seen in this image.
Replace only the existing furniture.`;
    }
  } else {
    architecturalInstructions = `Create a beautiful ${style} ${room} interior with professional architecture.
Include appropriate walls, flooring, windows, and ceiling for the style.`;
  }
  
  // Build the full prompt using Google's SIMPLE, DIRECT pattern
  // Key insight from Google: "Describe the scene, don't just list keywords"
  // Simpler prompts work better than complex instruction lists
  
  let prompt: string;
  
  if (hasRoomImage) {
    // IMAGE-TO-IMAGE MODE: Use Google's simple inpainting pattern
    // "Using the provided image, change only [X]. Keep everything else exactly the same."
    
    const productList = productRefs.map((ref, index) => {
      const imageNum = index + 2;
      return `the ${ref.productName} from image ${imageNum}`;
    }).join(', ');
    
    prompt = `Using the provided room photo (image 1), change only the furniture. Keep everything else in the room exactly the same - same walls, windows, floor, ceiling, lighting, and camera angle.

Replace the existing furniture with these exact items from the reference images: ${productList}.

For each furniture piece, copy the exact appearance from its reference image - same shape, same color, same texture, same material. The furniture should look identical to the photos provided.

CRITICAL PLACEMENT RULES:
1. All furniture must appear FULLY within the frame - no clipping at edges. Keep furniture away from the left and right edges of the image.
2. ALIGNMENT: Sofas and beds MUST be placed STRAIGHT and PARALLEL to walls - never at diagonal angles. These major pieces should align cleanly with the room's architecture.

Arrange the furniture naturally in the room with proper perspective and realistic shadows. ${style} style. Photorealistic interior design photo.`;
    
  } else {
    // TEXT-TO-IMAGE MODE: Generate room with specific products
    const productList = productRefs.map((ref, index) => {
      const imageNum = index + 1;
      return `the ${ref.productName} from image ${imageNum}`;
    }).join(', ');
    
    prompt = `Create a beautiful ${style} ${room} interior featuring these exact furniture pieces from the reference images: ${productList}.

For each furniture piece, copy the exact appearance from its reference image - same shape, same color, same texture, same material. The furniture should look identical to the photos provided.

CRITICAL PLACEMENT RULES:
1. All furniture must appear FULLY within the frame - no clipping at edges. Keep furniture away from the left and right edges of the image.
2. ALIGNMENT: Sofas and beds MUST be placed STRAIGHT and PARALLEL to walls - never at diagonal angles. These major pieces should align cleanly with the room's architecture.

Design a well-lit room with appropriate walls, windows, and flooring. Arrange the furniture naturally with proper perspective and realistic shadows. Photorealistic interior design photo, 8K.`;
  }

  return prompt;
}

// Maximum products to send to AI for optimal fidelity
// More products = lower accuracy per product
// Google's multi-image composition works best with 3-5 reference images
const MAX_PRODUCTS_FOR_FIDELITY = 7;

/**
 * Generate render using the "Anchor & Composite" multi-modal strategy
 * 
 * Based on Google AI Studio's approach:
 * 1. Pass room photo as first reference (Anchor) - preserves geometry
 * 2. Pass actual product images as secondary references (Composites)
 * 3. Use structured prompt to instruct Gemini to place THESE EXACT objects
 * 
 * This approach achieves:
 * - Visual Fidelity: Actual pixel data ensures texture/shape replication
 * - Spatial Integrity: Room photo ensures proper floor/wall boundaries
 * 
 * IMPORTANT: Limited to MAX_PRODUCTS_FOR_FIDELITY products for best results
 */
export async function generateImageOnlyRender(params: ImageOnlyRenderParams): Promise<ImageOnlyRenderResult> {
  const { roomImageUrl, products, roomType, stylePreference, floorPlanAnalysis, placementInstructions } = params;
  
  try {
    // Limit products for better fidelity
    const limitedProducts = products.slice(0, MAX_PRODUCTS_FOR_FIDELITY);
    if (products.length > MAX_PRODUCTS_FOR_FIDELITY) {
      console.log(`⚠️ Limiting products from ${products.length} to ${MAX_PRODUCTS_FOR_FIDELITY} for optimal fidelity`);
    }
    
    console.log(`\n🖼️ Starting ANCHOR & COMPOSITE render generation...`);
    console.log(`📍 Room image (Anchor): ${roomImageUrl || '(none - text-to-image mode)'}`);
    console.log(`📦 Products to furnish (Composites): ${limitedProducts.length} (max: ${MAX_PRODUCTS_FOR_FIDELITY})`);
    
    // Step 1: Fetch room image (optional - skip if empty for text-to-image mode)
    let roomImage: { data: string; mimeType: string } | null = null;
    const hasRoomImage = roomImageUrl && roomImageUrl.trim().length > 0;
    
    if (hasRoomImage) {
      console.log(`📥 Fetching room image (THE ANCHOR)...`);
      roomImage = await fetchImageAsBase64(roomImageUrl);
      if (!roomImage) {
        console.warn(`⚠️ Failed to fetch room image, falling back to text-to-image mode`);
      } else {
        console.log(`✅ Room image loaded as ANCHOR (${roomImage.mimeType})`);
      }
    } else {
      console.log(`📝 Text-to-image mode (no room photo - no anchor)`);
    }
    
    // Step 2: Select and fetch product front view images (THE COMPOSITES)
    // Use limitedProducts for better fidelity
    const productImageRefs = selectProductFrontViewImages(limitedProducts);
    console.log(`📸 Selected ${productImageRefs.length} product images (COMPOSITES)`);
    
    if (productImageRefs.length === 0) {
      return {
        success: false,
        error: 'No valid product images found',
        productsUsed: 0,
        productsSentToAI: []
      };
    }
    
    const productImageParts: any[] = [];
    const productSkusSentToAI: string[] = [];
    let fetchedCount = 0;
    
    for (const productRef of productImageRefs) {
      const productImage = await fetchImageAsBase64(productRef.url);
      if (productImage) {
        productImageParts.push({
          inlineData: {
            data: productImage.data,
            mimeType: productImage.mimeType
          }
        });
        productSkusSentToAI.push(productRef.sku);
        fetchedCount++;
        console.log(`  ✅ Composite ${fetchedCount}: ${productRef.productName} (${productRef.sku})`);
      } else {
        console.warn(`  ❌ Failed to fetch image for ${productRef.productName} (${productRef.sku}) - EXCLUDED`);
      }
    }
    
    console.log(`✅ Loaded ${fetchedCount}/${productImageRefs.length} composite images`);
    
    if (fetchedCount === 0) {
      return {
        success: false,
        error: 'Failed to fetch any product images',
        productsUsed: 0,
        productsSentToAI: []
      };
    }
    
    // Step 3: Build the Anchor & Composite prompt
    const prompt = buildAnchorCompositePrompt(
      limitedProducts,
      productImageRefs.filter(ref => productSkusSentToAI.includes(ref.sku)),
      roomType,
      stylePreference,
      !!roomImage,
      floorPlanAnalysis,
      placementInstructions
    );
    
    console.log(`\n📝 ANCHOR & COMPOSITE PROMPT:\n${'='.repeat(80)}\n${prompt}\n${'='.repeat(80)}\n`);
    
    // Step 4: Build parts array following the Anchor & Composite structure
    // Part 1: The Prompt (Text)
    // Part 2: The Room (Image) - ANCHOR
    // Part 3...N: The Products (Images) - COMPOSITES
    const parts: any[] = [];
    
    // Part 1: The main prompt text
    parts.push({ text: prompt });
    
    // Part 2: The Room Image - simple label
    if (roomImage) {
      parts.push({ text: `Image 1: The room to furnish (keep the room structure exactly the same)` });
      parts.push({
        inlineData: {
          data: roomImage.data,
          mimeType: roomImage.mimeType
        }
      });
    }
    
    // Parts 3...N: Product Images with simple, direct binding
    // Google's advice: Simpler is better - just identify the image clearly
    const successfulRefs = productImageRefs.filter(ref => productSkusSentToAI.includes(ref.sku));
    
    for (let i = 0; i < productImageParts.length; i++) {
      const productRef = successfulRefs[i];
      const imageNum = roomImage ? i + 2 : i + 1;
      
      // Simple, direct label - let the main prompt do the heavy lifting
      parts.push({ text: `Image ${imageNum}: ${productRef.productName}` });
      parts.push(productImageParts[i]);
    }
    
    console.log(`🎨 Sending to Gemini 2.5 Flash (Anchor & Composite mode)...`);
    console.log(`   Mode: ${roomImage ? 'Image-to-image (ANCHOR provided)' : 'Text-to-image (no ANCHOR)'}`);
    console.log(`   Parts: 1 prompt + ${roomImage ? '1 anchor + ' : ''}${productImageParts.length} composites`);
    
    // Step 5: Call Gemini with multimodal inputs
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    return await processGeminiResponse(response, fetchedCount, productSkusSentToAI);
  } catch (error) {
    console.error('❌ Anchor & Composite generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: 0,
      productsSentToAI: []
    };
  }
}

/**
 * Process Gemini response and extract image
 */
async function processGeminiResponse(
  response: any, 
  productsUsed: number, 
  productsSentToAI: string[]
): Promise<ImageOnlyRenderResult> {
  try {
    
    // Extract generated image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error(`❌ No image data in Gemini response`);
      return {
        success: false,
        error: 'No image generated by Gemini',
        productsUsed,
        productsSentToAI
      };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    console.log(`✅ Anchor & Composite render generated successfully!`);
    console.log(`   Products composited: ${productsUsed}`);
    console.log(`   Product SKUs: ${productsSentToAI.join(', ')}`);
    
    return {
      success: true,
      imageBase64,
      productsUsed,
      productsSentToAI
    };
    
  } catch (error) {
    console.error(`❌ Anchor & Composite render generation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: 0,
      productsSentToAI: []
    };
  }
}

// ============================================================================
// MULTI-STEP RENDER PIPELINE
// ============================================================================
// Breaks render into multiple smaller passes for better fidelity:
// 1. Room Lock Pass: Establish room baseline
// 2. Product Batch Passes: Add 2-3 products at a time (large items first)
// ============================================================================

const MAX_PRODUCTS = 7; // Hard limit for model reliability
const PRODUCTS_PER_BATCH = 2; // Smaller batches = less hallucination of extra furniture
const MAX_LAMPS = 2; // Limit lamps to avoid cluttered renders

// NOTE: Delta compositing solves room drift - we extract furniture from Gemini output
// and composite it onto the ORIGINAL room image, preserving architecture perfectly.

/**
 * Limits total products to MAX_PRODUCTS
 * Keeps highest priority products (large anchors over small accents)
 */
function limitProducts(products: Product[]): Product[] {
  if (products.length <= MAX_PRODUCTS) {
    return products;
  }
  
  console.log(`\n⚠️ PRODUCT LIMIT: Found ${products.length} products, limiting to ${MAX_PRODUCTS}`);
  
  // Sort by category weight (large items first) then take top MAX_PRODUCTS
  const sorted = [...products].sort((a, b) => {
    const weightA = getCategoryWeight(a);
    const weightB = getCategoryWeight(b);
    return weightB - weightA;
  });
  
  const kept = sorted.slice(0, MAX_PRODUCTS);
  const removed = sorted.slice(MAX_PRODUCTS);
  
  console.log(`   Keeping: ${kept.map(p => p.name).join(', ')}`);
  console.log(`   Removing: ${removed.map(p => p.name).join(', ')}`);
  
  return kept;
}

/**
 * Filters products to limit lamps to MAX_LAMPS
 * Keeps the most expensive lamps (typically higher quality/larger)
 */
function limitLamps(products: Product[]): Product[] {
  const lamps: Product[] = [];
  const nonLamps: Product[] = [];
  
  for (const product of products) {
    const name = product.name.toLowerCase();
    if (name.includes('lamp') || name.includes('pendant') || name.includes('chandelier') || name.includes('sconce')) {
      lamps.push(product);
    } else {
      nonLamps.push(product);
    }
  }
  
  // If we have too many lamps, keep only the most expensive ones
  if (lamps.length > MAX_LAMPS) {
    console.log(`\n⚠️ LAMP LIMIT: Found ${lamps.length} lamps, limiting to ${MAX_LAMPS}`);
    
    // Sort lamps by price descending (keep most expensive)
    lamps.sort((a, b) => {
      const priceA = parseFloat(a.price || '0');
      const priceB = parseFloat(b.price || '0');
      return priceB - priceA;
    });
    
    const keptLamps = lamps.slice(0, MAX_LAMPS);
    const removedLamps = lamps.slice(MAX_LAMPS);
    
    console.log(`   Keeping: ${keptLamps.map(l => l.name).join(', ')}`);
    console.log(`   Removing: ${removedLamps.map(l => l.name).join(', ')}`);
    
    return [...nonLamps, ...keptLamps];
  }
  
  return products;
}

// Category weights for ordering: higher = render first (anchors the scene)
const CATEGORY_PRIORITY_WEIGHTS: Record<string, number> = {
  // Tier 1: Primary anchors (largest visual impact)
  'Sofa': 100,
  'Sectional': 100,
  'Sectional Sofa': 100,
  'Bed': 95,
  'Dining Table': 90,
  
  // Tier 2: Large furniture
  'Cabinet': 80,
  'Bar Cabinet': 80,
  'Sideboard': 80,
  'Buffet': 80,
  'Media Console': 75,
  'Media Unit': 75,
  'Bookcase': 75,
  'Shelving Unit': 75,
  'Console Table': 70,
  
  // Tier 3: Tables
  'Coffee Table': 65,
  'Dining Chair': 60,
  'Rug': 60,
  
  // Tier 4: Accent seating
  'Accent Chair': 55,
  'Chair': 55,
  'Ottoman': 50,
  'Bench': 50,
  'Stool': 45,
  
  // Tier 5: Small tables
  'Side Table': 40,
  'Accent Table': 40,
  'End Table': 40,
  'Nightstand': 40,
  
  // Tier 6: Lighting
  'Floor Lamp': 30,
  'Table Lamp': 25,
  'Pendant': 25,
  'Chandelier': 25,
  
  // Tier 7: Small decor (last)
  'Home Decor': 15,
  'Decor': 15,
  'Vase': 10,
  'Mirror': 10,
  'Art': 10,
};

/**
 * Orders products for optimal batching: large/anchor items first, small items last
 * This ensures foundational pieces establish the scene before smaller accents are added
 */
function orderProductsForBatching(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    // Get category weights
    const weightA = getCategoryWeight(a);
    const weightB = getCategoryWeight(b);
    
    // Primary sort: by category weight (descending - larger items first)
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    
    // Secondary sort: by price as proxy for size (descending - expensive items often larger)
    const priceA = parseFloat(a.price || '0');
    const priceB = parseFloat(b.price || '0');
    if (priceA !== priceB) {
      return priceB - priceA;
    }
    
    // Tertiary sort: prefer items with visual descriptions (better reference data)
    const hasDescA = a.visualDescription ? 1 : 0;
    const hasDescB = b.visualDescription ? 1 : 0;
    if (hasDescA !== hasDescB) {
      return hasDescB - hasDescA;
    }
    
    // Final tie-breaker: SKU for determinism
    return a.sku.localeCompare(b.sku);
  });
}

/**
 * Get priority weight for a product based on its category/name
 * Uses CATEGORY_PRIORITY_WEIGHTS map with comprehensive keyword matching
 */
function getCategoryWeight(product: Product): number {
  const name = product.name.toLowerCase();
  
  // Try to match against all keys in CATEGORY_PRIORITY_WEIGHTS
  // Check for exact category matches in product name first
  for (const [category, weight] of Object.entries(CATEGORY_PRIORITY_WEIGHTS)) {
    if (name.includes(category.toLowerCase())) {
      return weight;
    }
  }
  
  // Extended keyword matching for common variations
  // Tier 1: Primary anchors (100)
  if (name.includes('sofa') || name.includes('sectional') || name.includes('couch')) return 100;
  
  // Tier 1.5: Beds (95)
  if (name.includes('bed') && !name.includes('daybed')) return 95;
  
  // Tier 2: Dining tables (90)
  if (name.includes('dining table') || (name.includes('table') && name.includes('dining'))) return 90;
  
  // Tier 3: Large storage (80)
  if (name.includes('cabinet') || name.includes('sideboard') || name.includes('buffet') || 
      name.includes('armoire') || name.includes('wardrobe') || name.includes('hutch')) return 80;
  
  // Tier 3.5: Media furniture (75)
  if (name.includes('media') || name.includes('entertainment') || name.includes('tv stand') ||
      name.includes('bookcase') || name.includes('bookshelf') || name.includes('shelving')) return 75;
  
  // Tier 4: Console tables (70)
  if (name.includes('console')) return 70;
  
  // Tier 5: Coffee tables (65)
  if (name.includes('coffee table') || (name.includes('coffee') && name.includes('table'))) return 65;
  
  // Tier 5.5: Dining chairs and rugs (60)
  if (name.includes('dining chair') || name.includes('rug') || name.includes('carpet')) return 60;
  
  // Tier 6: Accent seating (55)
  if (name.includes('accent chair') || name.includes('armchair') || name.includes('lounge chair')) return 55;
  
  // Tier 6.5: General chairs and ottomans (50)
  if (name.includes('chair') || name.includes('ottoman') || name.includes('daybed')) return 50;
  
  // Tier 7: Benches and stools (45)
  if (name.includes('bench') || name.includes('stool')) return 45;
  
  // Tier 8: Small tables (40)
  if (name.includes('side table') || name.includes('accent table') || name.includes('end table') ||
      name.includes('nightstand') || name.includes('night stand')) return 40;
  
  // Tier 8.5: Pedestal sets (35)
  if (name.includes('pedestal')) return 35;
  
  // Tier 9: Floor lamps (30)
  if (name.includes('floor lamp')) return 30;
  
  // Tier 10: Table lamps and pendants (25)
  if (name.includes('lamp') || name.includes('pendant') || name.includes('chandelier') || 
      name.includes('sconce') || name.includes('light')) return 25;
  
  // Tier 11: Decor (15)
  if (name.includes('decor') || name.includes('vase') || name.includes('planter') ||
      name.includes('sculpture') || name.includes('figurine')) return 15;
  
  // Tier 12: Art and mirrors (10)
  if (name.includes('art') || name.includes('mirror') || name.includes('frame') ||
      name.includes('picture') || name.includes('print')) return 10;
  
  // Default weight for unknown items
  return 20;
}

interface MultiStepRenderParams {
  roomImageUrl: string;
  products: Product[];
  roomType?: string;
  stylePreference?: string;
}

interface MultiStepRenderResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  productsUsed: number;
  productsSentToAI: string[];
  stepsCompleted: number;
  totalSteps: number;
}

/**
 * Multi-step render pipeline for improved quality
 * 
 * Strategy:
 * 1. Room Lock Pass: Send room image with "keep exactly the same" to establish baseline
 * 2. Product Batch Passes: Add 2-3 products at a time, using previous render as new anchor
 * 
 * This approach:
 * - Preserves room structure by locking it first
 * - Gives each product more "attention" from the model
 * - Uses previous render as anchor for consistency
 */
export async function generateMultiStepRender(params: MultiStepRenderParams): Promise<MultiStepRenderResult> {
  const { roomImageUrl, products, roomType, stylePreference } = params;
  
  const style = stylePreference || 'Modern';
  const room = roomType || 'living room';
  
  console.log(`\n🔄 MULTI-STEP RENDER PIPELINE`);
  console.log(`   Total products received: ${products.length}`);
  
  // STEP 1: Limit lamps to avoid cluttered renders
  const lampsLimited = limitLamps(products);
  
  // STEP 2: Limit total products to MAX_PRODUCTS for model reliability
  const productsLimited = limitProducts(lampsLimited);
  
  // STEP 3: Sort products - large anchor items first, small accents last
  const sortedProducts = orderProductsForBatching(productsLimited);
  
  console.log(`   Products after limits: ${sortedProducts.length} (max ${MAX_PRODUCTS})`);
  console.log(`   Batch size: ${PRODUCTS_PER_BATCH}`);
  
  // Log the sorted order with weights for debugging
  console.log(`\n📋 PRODUCT ORDER (large→small):`);
  sortedProducts.forEach((p, i) => {
    const weight = getCategoryWeight(p);
    console.log(`   ${i + 1}. ${p.name} (weight: ${weight})`);
  });
  
  // Create batches from SORTED products
  const productBatches: Product[][] = [];
  for (let i = 0; i < sortedProducts.length; i += PRODUCTS_PER_BATCH) {
    productBatches.push(sortedProducts.slice(i, i + PRODUCTS_PER_BATCH));
  }
  const totalSteps = 1 + productBatches.length; // 1 room lock + N product batches
  
  console.log(`\n   Total steps: ${totalSteps} (1 room lock + ${productBatches.length} product batches)`);
  
  const allProductsSentToAI: string[] = [];
  let stepsCompleted = 0;
  
  try {
    // ========================================
    // STEP 0: Fetch and store TRUE original room image
    // ========================================
    console.log(`\n📸 Fetching original room image for architecture preservation...`);
    const trueOriginalRoom = await fetchImageAsBase64(roomImageUrl);
    if (!trueOriginalRoom) {
      return {
        success: false,
        error: 'Failed to fetch original room image',
        productsUsed: 0,
        productsSentToAI: [],
        stepsCompleted: 0,
        totalSteps
      };
    }
    const trueOriginalBase64 = `data:${trueOriginalRoom.mimeType};base64,${trueOriginalRoom.data}`;
    console.log(`   ✅ Original room stored for delta compositing`);
    
    // ========================================
    // STEP 0.5: Analyze room architecture with Gemini Vision
    // ========================================
    const roomAnalysisResult = await analyzeRoomWithGeminiVision(trueOriginalBase64);
    const roomArchitectureAnalysis = roomAnalysisResult.architectureDescription;
    const roomDimensions = roomAnalysisResult.estimatedDimensions;
    
    // ========================================
    // STEP 1: Room Lock Pass
    // ========================================
    console.log(`\n📍 STEP 1/${totalSteps}: Room Lock Pass`);
    console.log(`   Establishing room baseline - no products yet`);
    
    const roomLockResult = await executeRoomLockPass(roomImageUrl, style, room);
    
    if (!roomLockResult.success || !roomLockResult.imageBase64) {
      console.error(`❌ Room lock pass failed`);
      return {
        success: false,
        error: roomLockResult.error || 'Room lock pass failed',
        productsUsed: 0,
        productsSentToAI: [],
        stepsCompleted: 0,
        totalSteps
      };
    }
    
    stepsCompleted = 1;
    let currentAnchor = roomLockResult.imageBase64;
    // Store room lock result for batch 2+ architecture reference
    const originalRoomBase64 = roomLockResult.imageBase64;
    console.log(`   ✅ Room locked successfully`);
    
    // ========================================
    // STEP 2+: Product Batch Passes
    // ========================================
    for (let batchIndex = 0; batchIndex < productBatches.length; batchIndex++) {
      const batch = productBatches[batchIndex];
      const stepNum = batchIndex + 2;
      
      console.log(`\n📦 STEP ${stepNum}/${totalSteps}: Product Batch ${batchIndex + 1}`);
      console.log(`   Products: ${batch.map(p => p.name).join(', ')}`);
      
      // Pass original room image, analysis AND dimensions for architecture reference
      const batchResult = await executeProductBatchPass(
        currentAnchor,
        batch,
        style,
        room,
        batchIndex,
        productBatches.length,
        originalRoomBase64,         // Original room image for architecture preservation
        roomArchitectureAnalysis,   // Detailed room analysis from Gemini Vision
        roomDimensions              // Estimated room dimensions
      );
      
      if (!batchResult.success || !batchResult.imageBase64) {
        console.error(`❌ Batch ${batchIndex + 1} failed: ${batchResult.error}`);
        // Continue with current anchor, skip failed products
        console.log(`   ⚠️ Continuing without failed batch`);
        continue;
      }
      
      // Update anchor for next pass
      currentAnchor = batchResult.imageBase64;
      allProductsSentToAI.push(...batchResult.productsSentToAI);
      stepsCompleted++;
      
      console.log(`   ✅ Batch ${batchIndex + 1} complete: ${batchResult.productsSentToAI.length} products added`);
    }
    
    console.log(`\n✅ GEMINI RENDER COMPLETE`);
    console.log(`   Steps completed: ${stepsCompleted}/${totalSteps}`);
    console.log(`   Products rendered: ${allProductsSentToAI.length}`);
    
    // Use Gemini's render directly (delta compositing removed)
    const finalImage = currentAnchor;
    
    console.log(`\n✅ MULTI-STEP RENDER PIPELINE COMPLETE`);
    
    return {
      success: true,
      imageBase64: finalImage,
      productsUsed: allProductsSentToAI.length,
      productsSentToAI: allProductsSentToAI,
      stepsCompleted,
      totalSteps
    };
    
  } catch (error) {
    console.error(`❌ Multi-step render error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: allProductsSentToAI.length,
      productsSentToAI: allProductsSentToAI,
      stepsCompleted,
      totalSteps
    };
  }
}

/**
 * Step 1: Room Lock Pass
 * Sends just the room image to establish a baseline with preserved architecture
 */
async function executeRoomLockPass(
  roomImageUrl: string,
  style: string,
  room: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  try {
    // Fetch room image
    const roomImage = await fetchImageAsBase64(roomImageUrl);
    if (!roomImage) {
      return { success: false, error: 'Failed to fetch room image' };
    }
    
    // Room lock prompt - preserve EVERYTHING architectural including window shapes
    const prompt = `Recreate this ${style} ${room} EXACTLY as shown, preserving every architectural detail.

CRITICAL - DO NOT CHANGE:
- Window shapes, sizes, frames, and positions (keep arched windows arched, rectangular windows rectangular)
- Wall colors, textures, and surfaces
- Floor pattern and material
- Ceiling design, beams, and height
- All doors and doorframes
- Camera angle and perspective
- Natural lighting direction

You may remove loose furniture items, but the room's architecture must be PIXEL-PERFECT identical to the original. The window design is especially important - preserve its exact shape and style.

Output: The same room ready for furniture, with identical architecture.`;
    
    const parts = [
      { text: prompt },
      { text: `The room to preserve:` },
      { inlineData: { data: roomImage.data, mimeType: roomImage.mimeType } }
    ];
    
    console.log(`   Calling Gemini for room lock...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    // Extract image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      return { success: false, error: 'No image generated for room lock' };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    return { success: true, imageBase64 };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Room lock error' 
    };
  }
}

/**
 * Step 2+: Product Batch Pass
 * Adds a batch of products to the current anchor image
 * Now includes originalRoomBase64 as a reference for architecture preservation
 * roomArchitectureAnalysis provides detailed text description of the room to preserve
 * roomDimensions provides estimated measurements for proper furniture scaling
 */
async function executeProductBatchPass(
  anchorBase64: string,
  products: Product[],
  style: string,
  room: string,
  batchIndex: number,
  totalBatches: number,
  originalRoomBase64?: string, // Original room image for architecture reference
  roomArchitectureAnalysis?: string, // Detailed room analysis from Gemini Vision
  roomDimensions?: RoomAnalysisResult['estimatedDimensions'] // Estimated room dimensions
): Promise<{ success: boolean; imageBase64?: string; error?: string; productsSentToAI: string[] }> {
  try {
    // Get product images
    const productImageRefs = selectProductFrontViewImages(products);
    
    if (productImageRefs.length === 0) {
      return { success: false, error: 'No valid product images', productsSentToAI: [] };
    }
    
    // Fetch product images
    const productImageParts: any[] = [];
    const productsSentToAI: string[] = [];
    
    for (const productRef of productImageRefs) {
      const productImage = await fetchImageAsBase64(productRef.url);
      if (productImage) {
        productImageParts.push({
          inlineData: {
            data: productImage.data,
            mimeType: productImage.mimeType
          }
        });
        productsSentToAI.push(productRef.sku);
      }
    }
    
    if (productImageParts.length === 0) {
      return { success: false, error: 'Failed to fetch product images', productsSentToAI: [] };
    }
    
    // Build list of successful product references
    const successfulRefs = productImageRefs.filter(ref => productsSentToAI.includes(ref.sku));
    
    // Determine if we have an original room reference (for batch 2+)
    const hasOriginalRoomRef = batchIndex > 0 && originalRoomBase64;
    const isFirstBatch = batchIndex === 0;
    
    // Calculate image numbering based on whether we include original room
    // Batch 1: Image 1 = current anchor, products start at Image 2
    // Batch 2+: Image 1 = ORIGINAL room (architecture ref), Image 2 = current anchor, products start at Image 3
    const productImageStartIndex = hasOriginalRoomRef ? 3 : 2;
    
    // Update product descriptions with correct image numbering INCLUDING DIMENSIONS
    const productDescriptionsIndexed = successfulRefs.map((ref, index) => {
      const product = products.find(p => p.sku === ref.sku);
      const details: string[] = [];
      
      // Add dimensions for proper scale
      if (product?.dimensions) {
        const dims = product.dimensions as any;
        if (dims.w && dims.d && dims.h) {
          const unit = dims.unit || 'inches';
          details.push(`SIZE: ${dims.w}"W x ${dims.d}"D x ${dims.h}"H`);
        }
      }
      
      if (product?.materials && product.materials.length > 0) {
        details.push(`made of ${product.materials.join(', ')}`);
      }
      if (product?.colors && product.colors.length > 0) {
        details.push(`in ${product.colors.join('/')} color`);
      }
      if (product?.visualDescription) {
        const shortDesc = product.visualDescription.slice(0, 100);
        details.push(`${shortDesc}`);
      }
      
      const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
      return `Image ${productImageStartIndex + index}: "${ref.productName}"${detailStr}`;
    });
    
    // Build product list for prompt intro with correct indexing
    const productListIndexed = successfulRefs
      .map((ref, index) => `the "${ref.productName}" from image ${productImageStartIndex + index}`)
      .join(' and ');
    
    // Build room dimensions section if available
    const roomDimensionsSection = roomDimensions && (roomDimensions.lengthFeet || roomDimensions.widthFeet)
      ? `
📏 ESTIMATED ROOM DIMENSIONS:
- Room size: approximately ${roomDimensions.lengthFeet || '?'}ft x ${roomDimensions.widthFeet || '?'}ft
- Ceiling height: approximately ${roomDimensions.ceilingHeightFeet || 8}ft
- Usable floor area: ${roomDimensions.usableFloorArea || 'medium'}
${roomDimensions.wallLengths?.length > 0 ? `- Wall segments: ${roomDimensions.wallLengths.join(', ')}` : ''}

USE THESE DIMENSIONS to ensure furniture is placed at REALISTIC SCALE relative to the room.
` : '';
    
    // Build room architecture section from analysis with STRICT LOCK
    const roomArchitectureSection = roomArchitectureAnalysis 
      ? `

🔒 ARCHITECTURE LOCK - ABSOLUTELY NO CHANGES ALLOWED:
The room in the reference image is the EXACT space to use - NOT inspiration for a similar space.

${roomArchitectureAnalysis}
${roomDimensionsSection}
⛔ DO NOT CHANGE ANY OF THE FOLLOWING:
- Walls: Same color, texture, position, moldings, trim
- Windows: Same size, position, frame style, curtains/blinds
- Doors: Same position, style, handles
- Floor: Same material, color, pattern, reflectivity
- Ceiling: Same height, texture, beams, moldings
- Built-in elements: Shelves, niches, cabinets, fireplaces
- Camera angle: Same perspective, focal length, eye level
- Lighting conditions: Same natural/artificial light sources
- Any existing furniture/decor that was in the original room

` : '';

    // Enhanced prompt that references ORIGINAL room for batch 2+
    const keepExistingText = isFirstBatch 
      ? roomArchitectureSection
      : `
${roomArchitectureSection}
⚠️ CRITICAL PRESERVATION REQUIREMENTS:
- ROOM ARCHITECTURE: Match Image 1 (ORIGINAL ROOM) EXACTLY - same walls, windows, floor, ceiling, lighting, camera angle
- EXISTING FURNITURE: Keep all furniture from Image 2 (current scene) exactly as shown
- Only ADD the new pieces listed below`;
    
    const prompt = hasOriginalRoomRef
      ? `Add these furniture pieces: ${productListIndexed}.${keepExistingText}

IMAGE REFERENCES:
- Image 1: ORIGINAL ROOM - THIS IS THE EXACT ROOM TO USE. Copy every architectural detail pixel-for-pixel: walls, windows, floor, ceiling, perspective, lighting, built-ins. Do NOT reimagine or redesign this space.
- Image 2: CURRENT SCENE - keep ALL existing furniture from this image in their EXACT positions
- Images 3+: NEW FURNITURE to add (these are the ONLY new items allowed)

⚠️ MANDATORY - ALL ${successfulRefs.length} PRODUCTS MUST APPEAR:
${productDescriptionsIndexed.map((desc, i) => `- ${desc}`).join('\n')}

🎨 COLOR FIDELITY - CRITICAL:
- Each product MUST have the EXACT color shown in its reference image
- White furniture = pure white (not cream, beige, or off-white)
- Match the EXACT material texture (leather, fabric, wood grain, metal finish)
- If reference shows a white sofa, render a WHITE sofa - not any other color

📐 SCALE & SPATIAL RULES:
- USE THE DIMENSIONS PROVIDED for each product to render at CORRECT REAL-WORLD SCALE
- A standard door is ~80"H x 36"W - use this as reference for furniture sizing
- A standard ceiling is ~96"H (8 feet) - furniture should be proportional
- Dining chairs are typically ~18"W x 20"D x 35"H
- Sofas are typically ~80-90"W x 35"D x 35"H
- Every piece of furniture must be FULLY VISIBLE and SEPARATE
- NO furniture should be hidden behind or under other furniture
- Maintain clear floor space between all pieces
- Each product must have its own distinct footprint

🪑 FURNITURE PLACEMENT RULES BY TYPE:
SOFAS/SEATING:
- Place facing into the room, NOT against windows
- Can float in the room or be against a wall
- Multiple sofas should face each other or be at 90° angles

COFFEE TABLES:
- ALWAYS place directly IN FRONT of the main sofa
- Center it relative to the sofa's width
- Should be ~18" away from sofa edge

SIDE TABLES / END TABLES:
- ALWAYS place BESIDE a sofa or chair (at the arm, not in front)
- One on each side of a sofa, or at least one beside the main seating
- NEVER place in the middle of an open floor area
- NEVER place in front of seating

CONSOLE TABLES:
- ALWAYS place AGAINST A WALL (not floating in the room)
- Good locations: behind a sofa, along an entry wall, under a window
- NEVER place in the middle of the room

ACCENT TABLES:
- Place beside seating OR in corners
- Can go next to a reading chair or beside a sofa
- NEVER place randomly in open floor space

OTTOMANS/BENCHES:
- Place IN FRONT of sofas (like a coffee table position)
- Or at the FOOT of a bed in bedrooms
- NEVER under or behind sofas

🚨 CRITICAL RULES - ARCHITECTURE PRESERVATION:
1. ROOM ARCHITECTURE from Image 1: Walls, windows, floor, ceiling, camera angle IDENTICAL - pixel-for-pixel match
2. EXISTING FURNITURE from Image 2: Keep all furniture exactly as shown - same position, same appearance
3. COLOR MATCH: Each new product's color MUST match its reference image EXACTLY
4. ALL PRODUCTS: Every product listed above MUST appear in the render
5. NO OVERLAP: Furniture pieces must NOT overlap or hide each other

⛔ EXPLICITLY FORBIDDEN - DO NOT DO ANY OF THESE:
- DO NOT add windows, doors, or openings that weren't in the original
- DO NOT remove windows, doors, or openings that were in the original
- DO NOT change wall colors, textures, or add wallpaper
- DO NOT add or remove crown molding, baseboards, or trim
- DO NOT change the floor material (wood to tile, etc.)
- DO NOT add or remove built-in shelving, niches, or cabinets
- DO NOT change the ceiling height or add/remove beams
- DO NOT change the camera angle, perspective, or zoom level
- DO NOT transform the room type (living room stays living room, NOT bedroom)
- DO NOT add a bed to a non-bedroom space
- DO NOT fill empty space just because it "looks empty" - empty is CORRECT

🚫 ABSOLUTELY FORBIDDEN - DO NOT ADD:
- NO wall art, paintings, mirrors, or wall decorations unless listed above
- NO chandeliers, pendant lights, or ceiling fixtures unless listed above
- NO rugs, carpets, or floor coverings unless listed above
- NO plants, vases, books, or decorative objects unless listed above
- NO additional sofas, chairs, benches, or seating unless listed above
- NO additional tables, shelves, or storage unless listed above
- ONLY render the ${successfulRefs.length} products listed above - NOTHING ELSE
- Leave empty wall space EMPTY - do not fill it with anything
- If a space looks "empty", that is CORRECT - do not add furniture to fill it

${style} style interior. Photorealistic render. ONLY the listed ${successfulRefs.length} products.`
      : `Add these furniture pieces to the room in image 1: ${productListIndexed}.

⚠️ MANDATORY - ALL ${successfulRefs.length} PRODUCTS MUST APPEAR:
${productDescriptionsIndexed.map((desc, i) => `- ${desc}`).join('\n')}

🎨 COLOR FIDELITY - CRITICAL:
- Each product MUST have the EXACT color shown in its reference image
- White furniture = pure white (not cream, beige, or off-white)
- Match the EXACT material texture (leather, fabric, wood grain, metal finish)
- If reference shows a white sofa, render a WHITE sofa - not any other color

📐 SCALE & SPATIAL RULES:
- USE THE DIMENSIONS PROVIDED for each product to render at CORRECT REAL-WORLD SCALE
- A standard door is ~80"H x 36"W - use this as reference for furniture sizing
- A standard ceiling is ~96"H (8 feet) - furniture should be proportional
- Dining chairs are typically ~18"W x 20"D x 35"H
- Sofas are typically ~80-90"W x 35"D x 35"H
- Every piece of furniture must be FULLY VISIBLE and SEPARATE
- NO furniture should be hidden behind or under other furniture
- Maintain clear floor space between all pieces
- Each product must have its own distinct footprint

🪑 FURNITURE PLACEMENT RULES BY TYPE:
SOFAS/SEATING:
- Place facing into the room, NOT against windows
- Can float in the room or be against a wall
- Multiple sofas should face each other or be at 90° angles

COFFEE TABLES:
- ALWAYS place directly IN FRONT of the main sofa
- Center it relative to the sofa's width
- Should be ~18" away from sofa edge

SIDE TABLES / END TABLES:
- ALWAYS place BESIDE a sofa or chair (at the arm, not in front)
- One on each side of a sofa, or at least one beside the main seating
- NEVER place in the middle of an open floor area
- NEVER place in front of seating

CONSOLE TABLES:
- ALWAYS place AGAINST A WALL (not floating in the room)
- Good locations: behind a sofa, along an entry wall, under a window
- NEVER place in the middle of the room

ACCENT TABLES:
- Place beside seating OR in corners
- Can go next to a reading chair or beside a sofa
- NEVER place randomly in open floor space

OTTOMANS/BENCHES:
- Place IN FRONT of sofas (like a coffee table position)
- Or at the FOOT of a bed in bedrooms
- NEVER under or behind sofas

🚨 CRITICAL RULES - ARCHITECTURE PRESERVATION:
1. PRESERVE ROOM: Walls, windows, floor, ceiling, camera angle IDENTICAL to image 1 - pixel-for-pixel match
2. COLOR MATCH: Each product's color MUST match its reference image EXACTLY
3. ALL PRODUCTS: Every product listed above MUST appear in the render
4. NO OVERLAP: Furniture pieces must NOT overlap or hide each other

⛔ EXPLICITLY FORBIDDEN - DO NOT DO ANY OF THESE:
- DO NOT add windows, doors, or openings that weren't in the original
- DO NOT remove windows, doors, or openings that were in the original
- DO NOT change wall colors, textures, or add wallpaper
- DO NOT add or remove crown molding, baseboards, or trim
- DO NOT change the floor material (wood to tile, etc.)
- DO NOT add or remove built-in shelving, niches, or cabinets
- DO NOT change the ceiling height or add/remove beams
- DO NOT change the camera angle, perspective, or zoom level
- DO NOT transform the room type (living room stays living room, NOT bedroom)
- DO NOT add a bed to a non-bedroom space
- DO NOT fill empty space just because it "looks empty" - empty is CORRECT

🚫 ABSOLUTELY FORBIDDEN - DO NOT ADD:
- NO wall art, paintings, mirrors, or wall decorations unless listed above
- NO chandeliers, pendant lights, or ceiling fixtures unless listed above
- NO rugs, carpets, or floor coverings unless listed above
- NO plants, vases, books, or decorative objects unless listed above
- NO additional sofas, chairs, benches, or seating unless listed above
- NO additional tables, shelves, or storage unless listed above
- ONLY render the ${successfulRefs.length} products listed above - NOTHING ELSE
- Leave empty wall space EMPTY - do not fill it with anything
- If a space looks "empty", that is CORRECT - do not add furniture to fill it

${style} style interior. Photorealistic render. ONLY the listed ${successfulRefs.length} products.`;
    
    // Build parts - for batch 2+, include ORIGINAL room as first image
    const parts: any[] = [{ text: prompt }];
    
    if (hasOriginalRoomRef) {
      // Batch 2+: Include original room as Image 1 (architecture reference) with STRICT instruction
      parts.push({ text: `Image 1: ORIGINAL ROOM - THIS IS THE EXACT ROOM. Copy every wall, window, floor, ceiling, built-in element EXACTLY. Do NOT redesign, reimagine, or transform this space.` });
      const originalData = originalRoomBase64!.replace(/^data:image\/\w+;base64,/, '');
      const originalMimeType = originalRoomBase64!.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      parts.push({
        inlineData: {
          data: originalData,
          mimeType: originalMimeType
        }
      });
      
      // Image 2: Current anchor with existing furniture
      parts.push({ text: `Image 2: CURRENT SCENE - keep all furniture from this` });
    } else {
      // Batch 1: Just the anchor image with STRICT preservation instruction
      parts.push({ text: `Image 1: THE EXACT ROOM TO USE - Copy this room pixel-for-pixel. Do NOT change walls, windows, floor, ceiling, built-ins, or camera angle. Only ADD the furniture listed.` });
    }
    
    // Add anchor image (current state)
    const anchorData = anchorBase64.replace(/^data:image\/\w+;base64,/, '');
    const anchorMimeType = anchorBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    parts.push({
      inlineData: {
        data: anchorData,
        mimeType: anchorMimeType
      }
    });
    
    // Add product images with detailed labels (use indexed descriptions)
    for (let i = 0; i < productImageParts.length; i++) {
      parts.push({ text: productDescriptionsIndexed[i] });
      parts.push(productImageParts[i]);
    }
    
    console.log(`   Calling Gemini for batch ${batchIndex + 1}/${totalBatches} (${productsSentToAI.length} products)...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    // Extract image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      return { success: false, error: 'No image generated for batch', productsSentToAI: [] };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    return { success: true, imageBase64, productsSentToAI };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Batch error',
      productsSentToAI: []
    };
  }
}
