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

export interface ImageOnlyRenderParams {
  roomImageUrl: string;
  products: Product[];
  roomType?: string;
  stylePreference?: string;
  floorPlanAnalysis?: {
    roomDimensions: string;
    windowLocations: string[];
    doorLocations: string[];
    builtInFeatures: string[];
    ceilingRoofDesign: string;
    layoutNotes: string;
    overallDescription: string;
  };
}

export interface ImageOnlyRenderResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  productsUsed: number;
}

/**
 * Generate render using ONLY images - no text descriptions
 * Mimics the user's AI Studio approach:
 * 1. Upload room photo
 * 2. Upload product front view images
 * 3. Simple prompt: "furnish this space with my products"
 * 
 * This approach bypasses all the visual description generation complexity
 */
export async function generateImageOnlyRender(params: ImageOnlyRenderParams): Promise<ImageOnlyRenderResult> {
  const { roomImageUrl, products, roomType, stylePreference, floorPlanAnalysis } = params;
  
  try {
    console.log(`\n🖼️ Starting IMAGE-ONLY render generation...`);
    console.log(`📍 Room image: ${roomImageUrl || '(none - text-to-image mode)'}`);
    console.log(`📦 Products to furnish: ${products.length}`);
    
    // Step 1: Fetch room image (optional - skip if empty for text-to-image mode)
    let roomImage: { data: string; mimeType: string } | null = null;
    const hasRoomImage = roomImageUrl && roomImageUrl.trim().length > 0;
    
    if (hasRoomImage) {
      console.log(`📥 Fetching room image...`);
      roomImage = await fetchImageAsBase64(roomImageUrl);
      if (!roomImage) {
        console.warn(`⚠️ Failed to fetch room image, falling back to text-to-image mode`);
      } else {
        console.log(`✅ Room image loaded (${roomImage.mimeType})`);
      }
    } else {
      console.log(`📝 Text-to-image mode (no room photo provided)`);
    }
    
    // Step 2: Select and fetch product front view images
    const productImageRefs = selectProductFrontViewImages(products);
    console.log(`📸 Selected ${productImageRefs.length} product front view images`);
    
    if (productImageRefs.length === 0) {
      return {
        success: false,
        error: 'No valid product images found',
        productsUsed: 0
      };
    }
    
    const productImageParts: any[] = [];
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
        fetchedCount++;
        console.log(`  ✅ ${fetchedCount}. ${productRef.productName} (${productRef.sku})`);
      }
    }
    
    console.log(`✅ Loaded ${fetchedCount}/${productImageRefs.length} product images`);
    
    // Step 3: Use the EXACT simple prompt that worked in AI Studio
    // Complex instructions confuse the model - keep it minimal
    let prompt: string;
    
    if (roomImage) {
      // Image-to-image mode: use the exact prompt from AI Studio that worked perfectly
      prompt = `This is my space image. Please furnish it with the Furniture and product images I provide`;
    } else {
      // Text-to-image mode: create a new room scene
      prompt = `Please create a beautifully designed ${roomType || 'interior'} space in ${stylePreference || 'modern'} style with the Furniture and products images I provide`;
    }
    
    // Step 4: Build parts array - INTERLEAVE text + image per product
    // This mimics Google AI Studio's sequential upload where each image is bound to preceding text
    const parts: any[] = [{ text: prompt }];
    
    // Add room image if available (image-to-image mode)
    if (roomImage) {
      parts.push({
        inlineData: {
          data: roomImage.data,
          mimeType: roomImage.mimeType
        }
      });
    }
    
    // Add each product image directly - NO TEXT DESCRIPTIONS
    // Pure image-only mode: Gemini uses visual features from the images themselves
    for (let i = 0; i < productImageParts.length; i++) {
      parts.push(productImageParts[i]);
    }
    
    console.log(`🎨 Sending to Gemini 2.5 Flash (image-only mode)...`);
    console.log(`   Mode: ${roomImage ? 'Image-to-image (room photo provided)' : 'Text-to-image (no room photo)'}`);
    console.log(`   Prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`   Images: ${roomImage ? '1 room + ' : ''}${productImageParts.length} products`);
    
    // Step 5: Call Gemini with multimodal inputs
    // Use gemini-2.5-flash-image (same as Google AI Studio "Nano Banana")
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    return await processGeminiResponse(response, fetchedCount);
  } catch (error) {
    console.error('❌ Image generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: 0
    };
  }
}

/**
 * Process Gemini response and extract image
 */
async function processGeminiResponse(response: any, productsUsed: number): Promise<ImageOnlyRenderResult> {
  try {
    
    // Step 6: Extract generated image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error(`❌ No image data in Gemini response`);
      return {
        success: false,
        error: 'No image generated by Gemini',
        productsUsed
      };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    console.log(`✅ Image-only render generated successfully!`);
    console.log(`   Products used: ${productsUsed}`);
    
    return {
      success: true,
      imageBase64,
      productsUsed
    };
    
  } catch (error) {
    console.error(`❌ Image-only render generation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: 0
    };
  }
}
