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
 * Emphasizes exact color, appearance, design, and dimensional accuracy
 */
function buildAccurateDescriptionPrompt(product: Product, dimensionContext: string): string {
  return `You are a professional furniture analyst generating precise visual descriptions for AI-powered interior design rendering.

**PRODUCT TO ANALYZE:**
Name: ${product.name}
SKU: ${product.sku}
${dimensionContext}

**YOUR TASK:**
Analyze this product image and generate a highly accurate, detailed visual description that will be used to render this exact product in AI-generated interior designs.

**CRITICAL REQUIREMENTS:**

1. **COLOR ACCURACY** (MOST IMPORTANT):
   - Identify the EXACT color(s) - be very specific (e.g., "soft taupe", "charcoal gray", "warm walnut brown")
   - Distinguish between similar shades (beige vs cream vs taupe, gray vs charcoal vs slate)
   - Note any color variations or gradients
   - Specify finish (matte, glossy, satin, textured)

2. **MATERIAL SPECIFICITY**:
   - Identify all materials visible (wood, metal, fabric, leather, glass, etc.)
   - Describe texture and finish (smooth, textured, brushed, polished, woven, tufted)
   - Note material quality indicators (grain patterns, weave type, leather type)

3. **DESIGN & STYLE**:
   - Overall design style (modern, traditional, mid-century, industrial, etc.)
   - Shape and silhouette (clean lines, curved, angular, organic)
   - Notable design features (tufting, nailhead trim, turned legs, geometric patterns)

4. **STRUCTURAL DETAILS**:
   - Leg style and material (tapered, straight, cabriole, hairpin, etc.)
   - Arm style (if applicable): track, rolled, English, etc.
   - Back design: cushioned, slatted, upholstered, etc.
   - Base type: platform, legs, pedestal, etc.

5. **PROPORTIONS & SCALE**:
   - Overall impression of size (compact, standard, oversized, substantial)
   - Proportion relationships (seat to back height, width to depth ratio)
   - Visual weight (heavy, light, balanced)

6. **UNIQUE FEATURES**:
   - Distinctive elements that make this product recognizable
   - Hardware details (handles, knobs, hinges, if visible)
   - Decorative elements (piping, contrast welting, buttons, etc.)

**OUTPUT FORMAT:**
Generate a 300-400 word description in flowing prose (not bullet points) that captures:
- Exact colors and finishes (paragraph 1)
- Materials and textures (paragraph 2)
- Design style and structural details (paragraph 3)
- Proportions and distinctive features (paragraph 4)

**WRITING STYLE:**
- Be precise and specific, not generic
- Use professional furniture industry terminology
- Focus on observable visual characteristics
- Avoid subjective opinions or marketing language
- Write in present tense, third person

Begin your analysis now:`;
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
