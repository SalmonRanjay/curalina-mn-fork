import { GoogleGenAI } from "@google/genai";
import type { Product } from "@shared/schema";
import { buildDimensionSummary } from './dimension-utils';

const genAI = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

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
    
    // Call Gemini Vision for analysis with retry logic for rate limits
    let response;
    let retries = 0;
    const MAX_RETRIES = 3;
    
    while (retries <= MAX_RETRIES) {
      try {
        response = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{
            role: "user",
            parts: [
              { text: analysisPrompt },
              { inlineData: { data: imageBase64, mimeType } }
            ]
          }]
        });
        break; // Success, exit retry loop
      } catch (error: any) {
        // Check if it's a rate limit error
        if (error?.error?.code === 'RATELIMIT_EXCEEDED' && retries < MAX_RETRIES) {
          const delayMs = Math.pow(2, retries) * 2000; // Exponential backoff: 2s, 4s, 8s
          console.warn(`  ⏱️ Rate limit hit. Retrying in ${delayMs}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          retries++;
        } else {
          throw error; // Not a rate limit error or max retries reached
        }
      }
    }
    
    // Check if response was successfully generated
    if (!response) {
      console.error(`  ⚠️ No response received after ${MAX_RETRIES} retries`);
      return null;
    }
    
    // Extract text from response
    let description = (response.text || '').trim();
    
    if (!description) {
      console.error(`  ⚠️ No text in response - response keys:`, Object.keys(response));
      return null;
    }
    
    // Remove trailing period if present (Gemini sometimes adds it)
    description = description.replace(/\.$/, '');
    
    // Validate format: must be comma-separated, no sentence structure (mid-sentence terminators)
    if (description.match(/[.!?]/)) {
      console.warn(`  ⚠️ Generated description contains sentence terminators - not comma-separated format`);
      console.log(`  Response preview: ${description.substring(0, 150)}...`);
      return null;
    }
    
    // Count words for validation (target: 30-40 words = 40-50 tokens)
    const wordCount = description.split(/\s+/).length;
    
    if (wordCount < 20) {
      console.warn(`  ⚠️ Generated description too short: ${wordCount} words (target: 30-40)`);
      console.log(`  Response preview: ${description.substring(0, 100)}...`);
      return null;
    }
    
    if (wordCount > 42) {
      console.warn(`  ⚠️ Generated description too long: ${wordCount} words (target: 30-40, max: 42)`);
      console.log(`  Response preview: ${description.substring(0, 150)}...`);
      return null;
    }
    
    console.log(`  ✅ Generated ${wordCount}-word description (${description.length} chars)`);
    return description;
    
  } catch (error) {
    console.error(`  ❌ Analysis failed:`, error);
    return null;
  }
}

/**
 * Build prompt for generating condensed visual descriptions optimized for AI generation
 * Target: 40-50 tokens (30-40 words) focusing on key visual attributes
 */
function buildAccurateDescriptionPrompt(product: Product, dimensionContext: string): string {
  return `You are generating a CONDENSED visual description for AI image generation. This description will be passed directly to image generation models (Gemini, Stability AI), so it must be concise and generation-ready.

**PRODUCT:**
${product.name}${dimensionContext}

**MISSION:**
Create a 30-40 word comma-separated description extracting ONLY the essential visual attributes needed for accurate AI generation.

**REQUIRED ATTRIBUTES (in order):**

1. **Primary Material & Finish** (e.g., "walnut wood", "matte black metal", "cream linen fabric")
2. **Exact Color & Tone** (e.g., "warm charcoal gray", "soft taupe", "deep walnut brown")
3. **Key Structural Elements** (e.g., "curved backrest", "tapered legs", "channel tufting")
4. **Design Silhouette** (e.g., "mid-century modern", "low-profile", "high-back")
5. **Scale Reference** (e.g., "dining chair height", "compact", "oversized")

**FORMAT RULES:**
- Comma-separated key attributes only
- NO full sentences, NO prose paragraphs, NO periods
- NO marketing language or subjective opinions
- Target: 30-40 words (40-50 tokens)
- Be hyper-specific with colors (not "neutral" but "soft taupe with gray undertones")
- Include finish types (matte, glossy, brushed, textured)
- DO NOT end with a period - just list the attributes

**GOOD EXAMPLE:**
"Walnut wood dining chair, curved backrest with channel tufting, tapered wooden legs, warm charcoal gray linen upholstery, matte finish, mid-century modern silhouette, standard dining height"

**BAD EXAMPLE:**
"This beautiful dining chair features a stunning design with elegant proportions. The high-quality materials create a sophisticated look perfect for any modern home." (too vague, marketing language, no specific attributes)

Generate the condensed description now:`;
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
  progressCallback?: (progress: BatchRegenerationProgress) => void,
  onProductUpdated?: (product: Product) => Promise<void>
): Promise<BatchRegenerationProgress> {
  const progress: BatchRegenerationProgress = {
    total: products.length,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  console.log(`\n🎨 Starting batch visual description regeneration (concurrent: 2 workers, respecting API limits) for ${products.length} products...`);
  
  // Process 2 products concurrently to respect API rate limits
  const CONCURRENT_WORKERS = 2;
  const BATCH_SIZE = Math.ceil(products.length / CONCURRENT_WORKERS);
  
  const processingWorkers = [];
  
  for (let workerIdx = 0; workerIdx < CONCURRENT_WORKERS; workerIdx++) {
    const start = workerIdx * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, products.length);
    const workerProducts = products.slice(start, end);
    
    if (workerProducts.length === 0) continue;
    
    const worker = (async () => {
      for (const product of workerProducts) {
        progress.currentProduct = `${product.sku} - ${product.name}`;
        console.log(`\n[W${workerIdx + 1}][${progress.processed + 1}/${progress.total}] ${progress.currentProduct}`);
        
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
            // Update product and save immediately via callback
            product.visualDescription = description;
            progress.successful++;
            const wordCount = description.split(/\s+/).length;
            console.log(`  ✅ Success - ${wordCount} words (${description.length} chars)`);
            
            // Save to database immediately as each product completes
            if (onProductUpdated) {
              await onProductUpdated(product);
            }
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
        
        // Delay between products to respect API rate limits (500-1000ms per product)
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    })();
    
    processingWorkers.push(worker);
  }
  
  // Wait for all workers to complete
  await Promise.all(processingWorkers);
  
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
