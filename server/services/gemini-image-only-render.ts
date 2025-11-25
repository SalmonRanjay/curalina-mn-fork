import { GoogleGenAI, Modality } from "@google/genai";
import type { Product } from "@shared/schema";

// Initialize Gemini client using Replit AI Integrations
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

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

Arrange the furniture naturally in the room with proper perspective and realistic shadows. ${style} style. Photorealistic interior design photo.`;
    
  } else {
    // TEXT-TO-IMAGE MODE: Generate room with specific products
    const productList = productRefs.map((ref, index) => {
      const imageNum = index + 1;
      return `the ${ref.productName} from image ${imageNum}`;
    }).join(', ');
    
    prompt = `Create a beautiful ${style} ${room} interior featuring these exact furniture pieces from the reference images: ${productList}.

For each furniture piece, copy the exact appearance from its reference image - same shape, same color, same texture, same material. The furniture should look identical to the photos provided.

Design a well-lit room with appropriate walls, windows, and flooring. Arrange the furniture naturally with proper perspective and realistic shadows. Photorealistic interior design photo, 8K.`;
  }

  return prompt;
}

// Maximum products to send to AI for optimal fidelity
// More products = lower accuracy per product
// Google's multi-image composition works best with 3-5 reference images
const MAX_PRODUCTS_FOR_FIDELITY = 5;

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
// 2. Product Batch Passes: Add 2-3 products at a time
// ============================================================================

const PRODUCTS_PER_BATCH = 2; // Optimal for fidelity

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
  
  // Calculate total steps
  const productBatches: Product[][] = [];
  for (let i = 0; i < products.length; i += PRODUCTS_PER_BATCH) {
    productBatches.push(products.slice(i, i + PRODUCTS_PER_BATCH));
  }
  const totalSteps = 1 + productBatches.length; // 1 room lock + N product batches
  
  console.log(`\n🔄 MULTI-STEP RENDER PIPELINE`);
  console.log(`   Total products: ${products.length}`);
  console.log(`   Batch size: ${PRODUCTS_PER_BATCH}`);
  console.log(`   Total steps: ${totalSteps} (1 room lock + ${productBatches.length} product batches)`);
  
  const allProductsSentToAI: string[] = [];
  let stepsCompleted = 0;
  
  try {
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
    console.log(`   ✅ Room locked successfully`);
    
    // ========================================
    // STEP 2+: Product Batch Passes
    // ========================================
    for (let batchIndex = 0; batchIndex < productBatches.length; batchIndex++) {
      const batch = productBatches[batchIndex];
      const stepNum = batchIndex + 2;
      
      console.log(`\n📦 STEP ${stepNum}/${totalSteps}: Product Batch ${batchIndex + 1}`);
      console.log(`   Products: ${batch.map(p => p.name).join(', ')}`);
      
      const batchResult = await executeProductBatchPass(
        currentAnchor,
        batch,
        style,
        room,
        batchIndex,
        productBatches.length
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
    
    console.log(`\n✅ MULTI-STEP RENDER COMPLETE`);
    console.log(`   Steps completed: ${stepsCompleted}/${totalSteps}`);
    console.log(`   Products rendered: ${allProductsSentToAI.length}`);
    
    return {
      success: true,
      imageBase64: currentAnchor,
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
 */
async function executeProductBatchPass(
  anchorBase64: string,
  products: Product[],
  style: string,
  room: string,
  batchIndex: number,
  totalBatches: number
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
    
    // Build detailed product descriptions for better AI recognition
    const successfulRefs = productImageRefs.filter(ref => productsSentToAI.includes(ref.sku));
    const productDescriptions = successfulRefs.map((ref, index) => {
      const product = products.find(p => p.sku === ref.sku);
      const details: string[] = [];
      
      // Add materials if available (array field)
      if (product?.materials && product.materials.length > 0) {
        details.push(`made of ${product.materials.join(', ')}`);
      }
      
      // Add colors if available (array field)
      if (product?.colors && product.colors.length > 0) {
        details.push(`in ${product.colors.join('/')} color`);
      }
      
      // Add AI visual description if available (truncated for prompt efficiency)
      if (product?.visualDescription) {
        const shortDesc = product.visualDescription.slice(0, 150);
        details.push(`- ${shortDesc}`);
      }
      
      const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
      return `Image ${index + 2}: "${ref.productName}"${detailStr}`;
    });
    
    // Build product list for prompt intro
    const productList = successfulRefs
      .map((ref, index) => `the "${ref.productName}" from image ${index + 2}`)
      .join(' and ');
    
    // Enhanced batch prompt with explicit instruction to KEEP existing furniture
    const isFirstBatch = batchIndex === 0;
    const keepExistingText = isFirstBatch 
      ? '' 
      : `\n\nKEEP ALL EXISTING FURNITURE: The room in image 1 already has furniture from previous steps. DO NOT remove or change any existing furniture - only ADD the new pieces listed below.`;
    
    const prompt = `Add these furniture pieces to the room in image 1: ${productList}.${keepExistingText}

NEW FURNITURE TO ADD - replicate EXACT appearance from reference images:
${productDescriptions.map((desc, i) => `- ${desc}`).join('\n')}

CRITICAL RULES:
1. KEEP all existing furniture in image 1 exactly where it is (do not remove, move, or modify)
2. KEEP room architecture identical (walls, windows, floor, ceiling, camera angle)
3. ADD new furniture with EXACT colors, shapes, textures from their reference images
4. Place new items naturally with proper perspective and shadows

${style} style interior. Photorealistic render.`;
    
    // Build parts
    const parts: any[] = [
      { text: prompt },
      { text: `Image 1: The room (preserve exactly, only add furniture)` }
    ];
    
    // Add anchor image (extract base64 data)
    const anchorData = anchorBase64.replace(/^data:image\/\w+;base64,/, '');
    const anchorMimeType = anchorBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    parts.push({
      inlineData: {
        data: anchorData,
        mimeType: anchorMimeType
      }
    });
    
    // Add product images with detailed labels
    for (let i = 0; i < productImageParts.length; i++) {
      parts.push({ text: productDescriptions[i] });
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
