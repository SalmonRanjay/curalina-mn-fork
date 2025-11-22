import { GoogleGenAI } from "@google/genai";
import type { Product } from "@shared/schema";
import { buildDimensionSummary } from './dimension-utils';

const getGeminiApiKey = () => {
  return process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
};

const genAI = new GoogleGenAI({ apiKey: getGeminiApiKey() || "" });

/**
 * Image prioritization for visual description generation
 * Returns the best image URL for analysis based on view priority
 */
export function selectBestImageForAnalysis(product: Product): { url: string; source: string } | null {
  if (!product.images || product.images.length === 0) {
    return null;
  }
  
  // Priority 1: Front View (highest priority - best for accurate descriptions)
  const frontViewImage = product.images.find(url => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('front') || lowerUrl.includes('frontview') || lowerUrl.includes('front-view');
  });
  
  if (frontViewImage) {
    return { url: frontViewImage, source: 'Front View' };
  }
  
  // Priority 2: Main product image (if product has a primary/main image)
  const mainImage = product.images.find(url => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('main') || lowerUrl.includes('primary') || lowerUrl.includes('hero');
  });
  
  if (mainImage) {
    return { url: mainImage, source: 'Main View' };
  }
  
  // Priority 3: Any image without "back", "side", "angle" in the name
  const neutralImage = product.images.find(url => {
    const lowerUrl = url.toLowerCase();
    return !lowerUrl.includes('back') && 
           !lowerUrl.includes('side') && 
           !lowerUrl.includes('angle') &&
           !lowerUrl.includes('detail');
  });
  
  if (neutralImage) {
    return { url: neutralImage, source: 'Default View' };
  }
  
  // Priority 4: First available image (fallback)
  return { url: product.images[0], source: 'First Available' };
}

/**
 * Generate highly accurate visual description using Gemini Vision
 * Focuses on exact appearance, color, design, features, and dimensions
 */
export async function generateAccurateVisualDescription(
  product: Product,
  imageUrl: string
): Promise<string | null> {
  try {
    console.log(`  📸 Analyzing image: ${imageUrl.split('/').pop()}`);
    
    // Build dimension context for the prompt
    const dimensionSummary = buildDimensionSummary(product);
    const dimensionContext = dimensionSummary 
      ? `\n\nEXPECTED DIMENSIONS: ${dimensionSummary}` 
      : '';
    
    // Build comprehensive analysis prompt
    const analysisPrompt = buildAccurateDescriptionPrompt(product, dimensionContext);
    
    // Fetch image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.warn(`  ⚠️ Failed to fetch image: ${imageResponse.status}`);
      return null;
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    // Call Gemini Vision for analysis
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { text: analysisPrompt },
          { inlineData: { data: imageBase64, mimeType } }
        ]
      }]
    });
    
    // Extract text from response
    const description = (response.text || '').trim();
    
    if (!description) {
      console.error(`  ⚠️ No text in response - response keys:`, Object.keys(response));
      return null;
    }
    
    if (description.length < 50) {
      console.warn(`  ⚠️ Generated description too short: ${description.length} chars`);
      console.log(`  Response preview: ${description.substring(0, 100)}...`);
      return null;
    }
    
    console.log(`  ✅ Generated ${description.length} character description`);
    return description;
    
  } catch (error) {
    console.error(`  ❌ Analysis failed:`, error);
    return null;
  }
}

/**
 * Build prompt for generating accurate visual descriptions
 * Emphasizes exact color, appearance, design, and dimensional accuracy for AI rendering fidelity
 */
function buildAccurateDescriptionPrompt(product: Product, dimensionContext: string): string {
  return `You are a professional furniture analyst generating EXACT visual descriptions for AI-powered interior design rendering. Your description will be used to generate realistic product renders, so 100% accuracy is critical.

**PRODUCT TO ANALYZE:**
Name: ${product.name}
SKU: ${product.sku}
${dimensionContext}

**YOUR MISSION:**
Analyze this product image and generate a PRECISE, EXACT visual description that will enable an AI to render this EXACT product - not a similar one, but THIS SPECIFIC ITEM with perfect fidelity. Every detail matters for accurate rendering.

**CRITICAL REQUIREMENTS FOR RENDERING ACCURACY:**

1. **EXACT COLOR MATCHING** (HIGHEST PRIORITY - CANNOT BE APPROXIMATE):
   - State the PRECISE color(s) you observe - be hyper-specific (e.g., "soft taupe with subtle gray undertones", "warm charcoal gray with brown hints", "deep walnut brown with reddish highlights")
   - Use compound color descriptors when needed: "warm beige", "cool gray", "soft white", "rich brown"
   - Distinguish subtle differences (cream vs ivory vs beige, slate vs charcoal vs graphite)
   - Note ANY color variations, gradients, or multi-tone effects
   - Specify finish type: matte, glossy, satin, brushed, textured, distressed
   - If wood, note grain color and tone (light oak, dark walnut, medium teak, etc.)

2. **EXACT MATERIAL IDENTIFICATION**:
   - Identify EVERY material visible with specificity (solid wood, engineered wood, metal, upholstery fabric, leather, glass, etc.)
   - For fabrics: specify weave/texture (linen, bouclé, velvet, performance fabric, woven, smooth)
   - For wood: specify type if identifiable (oak, walnut, teak, pine, etc.) and finish (natural, stained, painted)
   - For metal: specify finish (brushed brass, matte black, polished chrome, antique bronze)
   - Describe tactile qualities: smooth, rough, soft, plush, firm, textured, tufted

3. **EXACT DESIGN & FORM**:
   - Precise shape description: curved, straight, angular, rounded, organic, geometric
   - Overall silhouette: low-profile, high-back, compact, substantial, sleek, chunky
   - Design style: mid-century modern, contemporary, traditional, industrial, Scandinavian, etc.
   - Distinctive design elements: channel tufting, nailhead trim, piping, contrast welting, buttons, pleating

4. **EXACT STRUCTURAL ELEMENTS** (Critical for AI to render correctly):
   - Legs: style (tapered, straight, turned, hairpin, splayed), material, finish, height/visibility
   - Arms (if applicable): style (track, rolled, English, flared), height relative to back
   - Back: style (cushioned, tight-back, slatted, upholstered, pillow-back)
   - Base/Support: platform, exposed legs, pedestal, skirted
   - Cushions: number, style (loose, attached), firmness appearance

5. **EXACT PROPORTIONS & SCALE** (Critical for realistic rendering):
   - Relative dimensions: wide vs narrow, tall vs low, deep vs shallow
   - Proportion relationships: back height to seat depth, arm width to overall width
   - Visual weight: appears heavy/substantial OR light/airy
   - Scale indicators: suitable for compact spaces OR generous/oversized

6. **UNIQUE IDENTIFYING FEATURES** (What makes THIS product unique):
   - Distinctive visual elements that differentiate this from similar items
   - Hardware: visible handles, knobs, legs, connectors (describe finish and style)
   - Decorative details: contrast stitching, button patterns, trim, accent colors
   - Special features: storage, reversible cushions, modular components

**CRITICAL OUTPUT REQUIREMENTS:**

Write a 300-400 word description in flowing prose (NOT bullet points) organized as follows:
- Paragraph 1: EXACT colors, tones, and finish types
- Paragraph 2: EXACT materials, textures, and tactile qualities  
- Paragraph 3: Design style, form, and structural elements
- Paragraph 4: Proportions, scale indicators, and unique identifying features

**WRITING STYLE RULES:**
- Use EXACT, SPECIFIC descriptors - never use vague terms like "neutral" or "standard"
- Use professional furniture terminology
- Focus ONLY on what is visually observable in the image
- Describe in present tense, third person
- NO marketing language, NO subjective opinions, NO assumptions about quality
- Every descriptor should help an AI render this EXACT product, not a generic similar one

**GOAL:** An AI reading your description should be able to generate a render that looks IDENTICAL to this photograph - same color, same materials, same proportions, same details. Perfect fidelity is required.

Begin your precise analysis now:`;
}

/**
 * Batch process for regenerating visual descriptions for all products
 */
export interface BatchRegenerationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentProduct?: string;
  errors: Array<{ sku: string; error: string }>;
}

export async function regenerateAllVisualDescriptions(
  products: Product[],
  progressCallback?: (progress: BatchRegenerationProgress) => void
): Promise<BatchRegenerationProgress> {
  const progress: BatchRegenerationProgress = {
    total: products.length,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  console.log(`\n🎨 Starting batch visual description regeneration for ${products.length} products...`);
  
  for (const product of products) {
    progress.currentProduct = `${product.sku} - ${product.name}`;
    console.log(`\n[${progress.processed + 1}/${progress.total}] ${progress.currentProduct}`);
    
    try {
      // Select best image for analysis
      const selectedImage = selectBestImageForAnalysis(product);
      
      if (!selectedImage) {
        console.log(`  ⏭️ Skipped - no images available`);
        progress.skipped++;
        progress.processed++;
        progressCallback?.(progress);
        continue;
      }
      
      console.log(`  📍 Using: ${selectedImage.source} image`);
      
      // Generate accurate visual description
      const description = await generateAccurateVisualDescription(product, selectedImage.url);
      
      if (description) {
        // Update product in database (will be done by caller)
        product.visualDescription = description;
        progress.successful++;
        console.log(`  ✅ Success - ${description.length} chars`);
      } else {
        progress.failed++;
        progress.errors.push({
          sku: product.sku,
          error: 'Failed to generate description'
        });
        console.log(`  ❌ Failed - could not generate description`);
      }
      
    } catch (error) {
      progress.failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progress.errors.push({
        sku: product.sku,
        error: errorMessage
      });
      console.error(`  ❌ Error:`, errorMessage);
    }
    
    progress.processed++;
    progressCallback?.(progress);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ Batch regeneration complete!`);
  console.log(`  📊 Total: ${progress.total}`);
  console.log(`  ✅ Successful: ${progress.successful}`);
  console.log(`  ❌ Failed: ${progress.failed}`);
  console.log(`  ⏭️  Skipped: ${progress.skipped}`);
  
  if (progress.errors.length > 0 && progress.errors.length <= 10) {
    console.log(`\n❌ Errors encountered:`);
    progress.errors.forEach(err => {
      console.log(`  - ${err.sku}: ${err.error}`);
    });
  } else if (progress.errors.length > 10) {
    console.log(`\n❌ ${progress.errors.length} errors encountered (showing first 10):`);
    progress.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.sku}: ${err.error}`);
    });
  }
  
  return progress;
}
