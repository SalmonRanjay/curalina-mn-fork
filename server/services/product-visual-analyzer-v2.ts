import { GoogleGenAI } from "@google/genai";
import { analyzeProductVisualsWithOpenAI } from "./openai-vision";
import { findFrontViewImage, categorizeImages, isValidImageUrl } from "../utils/image-helpers";
import { needsAnalysis, markAsAnalyzed, sessionCache } from '../utils/image-cache';

// Initialize Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

// Analysis result types
interface AnalysisResult {
  combinedDescription: string;
  frontViewDescription: string;
}

interface DualProviderResult {
  gemini: AnalysisResult | null;
  openai: AnalysisResult | null;
}

interface ProductAnalysisResult {
  sku: string;
  productId?: string;
  // Combined descriptions (all images)
  visualDescription: string;
  visualDescriptionGemini: string;
  visualDescriptionOpenAI: string;
  // Front-view specific descriptions
  visualDescriptionFrontView: string;
  visualDescriptionFrontViewGemini: string;
  visualDescriptionFrontViewOpenAI: string;
  error?: string;
}

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  let mimeType = response.headers.get('content-type') || 'image/jpeg';
  if (!mimeType.startsWith('image/')) {
    mimeType = 'image/jpeg';
  }
  
  return { data: base64, mimeType };
}

/**
 * Get the detailed analysis prompt for furniture
 */
function getDetailedAnalysisPrompt(): string {
  return `You are an expert furniture designer analyzing this product image for exact reproduction in AI-generated interior designs. Provide an extremely detailed visual description that would allow an AI image generator to recreate this furniture piece with precision.

**CRITICAL REQUIREMENTS:**
- Use SPECIFIC measurements when visible (e.g., "approximately 6 inches wide" not "narrow")
- Include EXACT color names and codes when possible (e.g., "warm charcoal gray #4A4A4A" not "dark gray")
- Describe textures with tactile precision (e.g., "tightly woven linen with 2mm raised texture" not "textured fabric")
- Note exact geometric shapes (e.g., "perfect 90-degree angles" or "gentle 15-degree curve")
- Specify material types precisely (e.g., "solid oak with quarter-sawn grain pattern" not "wood")

**DETAILED ANALYSIS FRAMEWORK:**

1. **OVERALL FORM & SILHOUETTE**
   - Exact shape description (rectangular, L-shaped, curved, asymmetric, etc.)
   - Precise proportions (width to depth to height ratios)
   - Design style with specific era/movement
   - Overall scale indicators

2. **STRUCTURAL COMPONENTS**
   - Frame construction and joinery
   - Leg design, dimensions, and angles
   - Support structures and placement
   - Weight distribution indicators

3. **MATERIALS & SURFACES**
   - Primary material with specific type
   - Wood grain pattern and direction
   - Metal type and finish
   - Fabric weave type
   - Surface treatments and texture depth

4. **COLOR PALETTE - EXTREMELY SPECIFIC**
   - Dominant color with exact shade name
   - Secondary colors with percentages
   - Color temperature and undertones
   - Finish sheen levels

5. **DIMENSIONAL DETAILS**
   - All visible measurements
   - Component proportions
   - Gap widths and spacing
   - Border and trim widths

6. **DISTINCTIVE DESIGN ELEMENTS**
   - Unique curves with measurements
   - Angular details with degrees
   - Decorative patterns and symmetry
   - Tufting/stitching patterns

7. **HARDWARE & FASTENERS**
   - Handle/pull specifications
   - Visible hardware details
   - Finish matching or contrasting

8. **FINISH QUALITY & LIGHTING**
   - Surface quality and edge treatments
   - How light interacts with surfaces
   - Shadow and highlight zones

Provide a 300-400 word detailed description focusing on visual accuracy for AI reproduction.`;
}

/**
 * Analyze a single image using Gemini
 */
async function analyzeImageWithGemini(imageUrl: string, imageName: string): Promise<string> {
  try {
    const imageData = await downloadImageAsBase64(imageUrl);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: getDetailedAnalysisPrompt() },
          { 
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          }
        ]
      }]
    });
    
    return response.text?.trim() || '';
  } catch (error) {
    console.error(`Error analyzing ${imageName} with Gemini:`, error);
    throw error;
  }
}

/**
 * Synthesize multiple image analyses into one description
 */
async function synthesizeAnalyses(analyses: string[]): Promise<string> {
  if (analyses.length === 0) return '';
  if (analyses.length === 1) return analyses[0];
  
  const synthesisPrompt = `Synthesize these ${analyses.length} detailed furniture descriptions from different angles into ONE comprehensive master description:

${analyses.map((desc, i) => `**VIEW ${i + 1}:**\n${desc}`).join('\n\n---\n\n')}

Create a 400-500 word synthesis that:
1. Preserves ALL precise details (measurements, color codes, material names)
2. Resolves contradictions by using most detailed description
3. Describes features from all angles in logical sequence
4. Maintains technical specificity throughout
5. Integrates spatial relationships across views`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: synthesisPrompt }]
      }]
    });
    
    return response.text?.trim() || analyses.join(' ');
  } catch (error) {
    console.error('Error synthesizing descriptions:', error);
    return analyses.join(' ');
  }
}

/**
 * Two-phase analysis with Gemini: Front-view first, then combined
 */
async function analyzeWithGemini(
  productName: string,
  imageUrls: string[]
): Promise<AnalysisResult> {
  const { frontView, otherViews, allImages } = categorizeImages(imageUrls);
  const validImages = allImages.filter(isValidImageUrl);
  
  let frontViewDescription = '';
  let combinedDescription = '';
  
  // Phase 1: Analyze front-view if available
  if (frontView && isValidImageUrl(frontView)) {
    try {
      console.log(`  🎯 Gemini: Analyzing front-view image`);
      frontViewDescription = await analyzeImageWithGemini(frontView, 'Front View');
    } catch (error) {
      console.error(`  ⚠️ Gemini: Front-view analysis failed`);
    }
  }
  
  // Phase 2: Analyze all images for combined description
  if (validImages.length > 0) {
    const analyses: string[] = [];
    
    // Include front-view analysis if we have it
    if (frontViewDescription) {
      analyses.push(frontViewDescription);
    }
    
    // Analyze other views (skip front-view if already analyzed)
    const imagesToAnalyze = frontViewDescription 
      ? validImages.filter(img => img !== frontView)
      : validImages;
    
    for (let i = 0; i < Math.min(imagesToAnalyze.length, 3); i++) { // Limit to 3 additional images
      try {
        const analysis = await analyzeImageWithGemini(
          imagesToAnalyze[i], 
          `Image ${i + 1}`
        );
        if (analysis) analyses.push(analysis);
      } catch (error) {
        // Continue with other images
      }
      
      // Small delay between images
      if (i < imagesToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Synthesize all analyses
    combinedDescription = await synthesizeAnalyses(analyses);
  }
  
  // Use front-view as fallback for combined if no combined analysis
  if (!combinedDescription && frontViewDescription) {
    combinedDescription = frontViewDescription;
  }
  
  return {
    frontViewDescription,
    combinedDescription
  };
}

/**
 * Two-phase analysis with OpenAI: Front-view first, then combined
 */
async function analyzeWithOpenAI(
  productName: string,
  imageUrls: string[]
): Promise<AnalysisResult> {
  const { frontView, otherViews, allImages } = categorizeImages(imageUrls);
  const validImages = allImages.filter(isValidImageUrl);
  
  let frontViewDescription = '';
  let combinedDescription = '';
  
  // Phase 1: Analyze front-view if available
  if (frontView && isValidImageUrl(frontView)) {
    try {
      console.log(`  🎯 OpenAI: Analyzing front-view image`);
      // Use existing OpenAI function for single front-view
      frontViewDescription = await analyzeProductVisualsWithOpenAI(
        productName, 
        [frontView]
      );
    } catch (error) {
      console.error(`  ⚠️ OpenAI: Front-view analysis failed`);
    }
  }
  
  // Phase 2: Analyze all images for combined description
  if (validImages.length > 0) {
    try {
      combinedDescription = await analyzeProductVisualsWithOpenAI(
        productName,
        validImages.slice(0, 4) // Limit to 4 images for OpenAI
      );
    } catch (error) {
      console.error(`  ⚠️ OpenAI: Combined analysis failed`);
    }
  }
  
  // Use front-view as fallback
  if (!combinedDescription && frontViewDescription) {
    combinedDescription = frontViewDescription;
  }
  
  return {
    frontViewDescription,
    combinedDescription
  };
}

/**
 * Analyze a single product with both providers in two phases
 */
export async function analyzeProductVisualsV2(
  product: { 
    sku: string; 
    productId?: string;
    name: string; 
    images: string[] | null;
  }
): Promise<ProductAnalysisResult> {
  console.log(`\n🎨 V2 Analysis: ${product.name} (${product.sku})`);
  
  // Check for valid images
  if (!product.images || product.images.length === 0) {
    console.log(`  ⚠️ No images to analyze`);
    return {
      sku: product.sku,
      productId: product.productId,
      visualDescription: '',
      visualDescriptionGemini: '',
      visualDescriptionOpenAI: '',
      visualDescriptionFrontView: '',
      visualDescriptionFrontViewGemini: '',
      visualDescriptionFrontViewOpenAI: '',
      error: 'No images available'
    };
  }
  
  // Check cache if product has already been analyzed
  if (product.productId) {
    const needsBothAnalysis = await needsAnalysis(product.productId, 'both');
    if (!needsBothAnalysis) {
      console.log(`  ⚡ Skipping analysis - already complete (using cached results)`);
      return {
        sku: product.sku,
        productId: product.productId,
        visualDescription: '[cached]',
        visualDescriptionGemini: '[cached]',
        visualDescriptionOpenAI: '[cached]',
        visualDescriptionFrontView: '[cached]',
        visualDescriptionFrontViewGemini: '[cached]',
        visualDescriptionFrontViewOpenAI: '[cached]'
      };
    }
  }
  
  // Run both providers in parallel with independent failure handling
  const [geminiResult, openaiResult] = await Promise.allSettled([
    analyzeWithGemini(product.name, product.images),
    analyzeWithOpenAI(product.name, product.images)
  ]);
  
  // Extract results or use empty values on failure
  const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : null;
  const openai = openaiResult.status === 'fulfilled' ? openaiResult.value : null;
  
  // Log any failures
  if (geminiResult.status === 'rejected') {
    console.error(`  ⚠️ Gemini failed:`, geminiResult.reason);
  }
  if (openaiResult.status === 'rejected') {
    console.error(`  ⚠️ OpenAI failed:`, openaiResult.reason);
  }
  
  // Determine active descriptions (Gemini prioritized)
  const activeDescription = gemini?.combinedDescription || openai?.combinedDescription || '';
  const activeFrontView = gemini?.frontViewDescription || openai?.frontViewDescription || '';
  
  // Log results
  console.log(`  ✅ Analysis complete:`);
  console.log(`     - Gemini combined: ${gemini?.combinedDescription ? `${gemini.combinedDescription.length} chars` : 'N/A'}`);
  console.log(`     - Gemini front: ${gemini?.frontViewDescription ? `${gemini.frontViewDescription.length} chars` : 'N/A'}`);
  console.log(`     - OpenAI combined: ${openai?.combinedDescription ? `${openai.combinedDescription.length} chars` : 'N/A'}`);
  console.log(`     - OpenAI front: ${openai?.frontViewDescription ? `${openai.frontViewDescription.length} chars` : 'N/A'}`);
  
  const result = {
    sku: product.sku,
    productId: product.productId,
    // Combined descriptions
    visualDescription: activeDescription,
    visualDescriptionGemini: gemini?.combinedDescription || '',
    visualDescriptionOpenAI: openai?.combinedDescription || '',
    // Front-view descriptions
    visualDescriptionFrontView: activeFrontView,
    visualDescriptionFrontViewGemini: gemini?.frontViewDescription || '',
    visualDescriptionFrontViewOpenAI: openai?.frontViewDescription || ''
  };
  
  // Mark as analyzed in cache for future skipping
  if (product.productId && product.images) {
    markAsAnalyzed(product.productId, product.images, {
      visualDescription: result.visualDescription,
      visualDescriptionGemini: result.visualDescriptionGemini,
      visualDescriptionOpenAI: result.visualDescriptionOpenAI,
      visualDescriptionFrontView: result.visualDescriptionFrontView,
      visualDescriptionFrontViewGemini: result.visualDescriptionFrontViewGemini,
      visualDescriptionFrontViewOpenAI: result.visualDescriptionFrontViewOpenAI
    });
  }
  
  return result;
}

/**
 * Worker function for concurrent processing
 */
async function processWorker(
  workerId: number,
  products: Array<{ sku: string; productId?: string; name: string; images: string[] | null }>,
  onComplete: (result: ProductAnalysisResult) => void,
  onError: (error: Error, product: any) => void
): Promise<void> {
  console.log(`  🚀 Worker ${workerId}: Starting with ${products.length} products`);
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`  [W${workerId}] Processing ${i + 1}/${products.length}: ${product.name}`);
    
    try {
      const result = await analyzeProductVisualsV2(product);
      onComplete(result);
      
      // Adaptive delay based on success (shorter if successful, longer if struggling)
      const delay = result.error ? 10000 : 5000;
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`  [W${workerId}] Failed:`, error);
      onError(error as Error, product);
    }
  }
  
  console.log(`  ✅ Worker ${workerId}: Completed all tasks`);
}

/**
 * Concurrent batch analysis with multiple workers
 */
export async function batchAnalyzeProductsConcurrent(
  products: Array<{ 
    sku: string; 
    productId?: string;
    name: string; 
    images: string[] | null;
  }>,
  options: {
    workerCount?: number;
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<ProductAnalysisResult[]> {
  const { 
    workerCount = 5, 
    batchSize = 20,
    onProgress 
  } = options;
  
  console.log(`\n🚀 Starting V2 concurrent analysis:`);
  console.log(`  - Products: ${products.length}`);
  console.log(`  - Workers: ${workerCount}`);
  console.log(`  - Batch size per worker: ${batchSize}`);
  
  const results: ProductAnalysisResult[] = [];
  const errors: Array<{ product: any; error: Error }> = [];
  let completedCount = 0;
  
  // Split products into chunks for workers
  const chunksPerWorker = Math.ceil(batchSize / workerCount);
  const productChunks: Array<typeof products> = [];
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    // Distribute batch across workers
    for (let w = 0; w < workerCount; w++) {
      const workerStart = w * chunksPerWorker;
      const workerEnd = Math.min(workerStart + chunksPerWorker, batch.length);
      if (workerStart < batch.length) {
        if (!productChunks[w]) productChunks[w] = [];
        productChunks[w].push(...batch.slice(workerStart, workerEnd));
      }
    }
  }
  
  // Callbacks for workers
  const handleComplete = (result: ProductAnalysisResult) => {
    results.push(result);
    completedCount++;
    if (onProgress) {
      onProgress(completedCount, products.length);
    }
  };
  
  const handleError = (error: Error, product: any) => {
    errors.push({ product, error });
    completedCount++;
    // Create error result
    results.push({
      sku: product.sku,
      productId: product.productId,
      visualDescription: '',
      visualDescriptionGemini: '',
      visualDescriptionOpenAI: '',
      visualDescriptionFrontView: '',
      visualDescriptionFrontViewGemini: '',
      visualDescriptionFrontViewOpenAI: '',
      error: error.message
    });
    if (onProgress) {
      onProgress(completedCount, products.length);
    }
  };
  
  // Start workers in parallel
  const workerPromises = productChunks.map((chunk, index) =>
    processWorker(index + 1, chunk, handleComplete, handleError)
  );
  
  // Wait for all workers to complete
  await Promise.all(workerPromises);
  
  // Summary statistics
  const successCount = results.filter(r => !r.error).length;
  const geminiCombinedCount = results.filter(r => r.visualDescriptionGemini).length;
  const openaiCombinedCount = results.filter(r => r.visualDescriptionOpenAI).length;
  const geminiFrontCount = results.filter(r => r.visualDescriptionFrontViewGemini).length;
  const openaiFrontCount = results.filter(r => r.visualDescriptionFrontViewOpenAI).length;
  
  console.log(`\n📊 V2 Concurrent Analysis Complete:`);
  console.log(`  ✅ Successful: ${successCount}/${products.length}`);
  console.log(`  🤖 Gemini combined: ${geminiCombinedCount}`);
  console.log(`  🤖 Gemini front: ${geminiFrontCount}`);
  console.log(`  🤖 OpenAI combined: ${openaiCombinedCount}`);
  console.log(`  🤖 OpenAI front: ${openaiFrontCount}`);
  console.log(`  ❌ Failed: ${errors.length}`);
  
  return results;
}