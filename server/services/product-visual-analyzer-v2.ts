import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// Initialize OpenAI client
const openaiClient = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});
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
 * Validate if an image URL is accessible
 */
async function validateImageUrl(imageUrl: string): Promise<boolean> {
  try {
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      fullUrl = `${baseUrl}${imageUrl}`;
    } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      fullUrl = `${baseUrl}/${imageUrl}`;
    }
    
    const response = await fetch(fullUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    const contentType = response.headers.get('content-type') || '';
    
    // Check if it's an image and accessible
    return response.ok && contentType.startsWith('image/');
  } catch (error) {
    return false;
  }
}

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // Handle relative URLs by prepending the base URL
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      // For relative URLs, prepend the base URL
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      fullUrl = `${baseUrl}${imageUrl}`;
    } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      // For S3 or other relative paths, assume they need the base URL
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      fullUrl = `${baseUrl}/${imageUrl}`;
    }
    
    const response = await fetch(fullUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.warn(`Failed to download image from ${fullUrl}: ${response.statusText}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      console.warn(`URL is not an image (got ${contentType}): ${fullUrl}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    let mimeType = contentType;
    if (!mimeType.startsWith('image/')) {
      mimeType = 'image/jpeg';
    }
    
    return { data: base64, mimeType };
  } catch (error) {
    console.warn(`Error downloading image ${imageUrl}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Get the structured analysis prompt for furniture (front-view focused)
 */
function getStructuredAnalysisPrompt(isFrontView: boolean = false): string {
  const charLimit = isFrontView ? '750' : '1500';  // Balanced limits: enough for data, but still concise
  
  return `You are an expert furniture designer analyzing this product image for AI-generated interior designs.

**OUTPUT FORMAT - CONCISE STRUCTURED DATA:**

Product Name: [Descriptive name]
Primary Material: [Specific material, e.g., "Lacquered MDF"]
Color & Finish: [Color with HEX, e.g., "White (#F8F8F8), gloss"]
Form Factor: [Core shape, e.g., "Round pedestal table"]
Dimensions: [Key measurements, e.g., "H:21.5" W:18.5" D:16""]
Key Geometry: [Essential features, e.g., "Domed top, tapered base"]
Distinctive Features: [2-3 unique elements max]
${!isFrontView ? 'View-Specific Details: [Features only visible from this angle]' : ''}

**CRITICAL REQUIREMENTS:**
- MAXIMUM ${charLimit} characters total
- Use EXACT values: HEX colors, measurements
- Be CONCISE but complete - include all essential details
- NO descriptive prose, only technical facts
- Focus on geometry, materials, and measurements

${isFrontView ? 
  '**FRONT VIEW PRIORITY:** This is the primary angle for AI rendering. Capture complete frontal geometry.' :
  '**ADDITIONAL ANGLE:** Note features not visible from front (back details, side profiles, hidden storage).'}`;
}

/**
 * Analyze a single image using Gemini
 */
async function analyzeImageWithGemini(imageUrl: string, imageName: string, isFrontView: boolean = false): Promise<string> {
  // Pre-validate image URL to avoid wasting API calls on broken images
  const isValid = await validateImageUrl(imageUrl);
  if (!isValid) {
    console.warn(`  ⚠️ Gemini: Skipping ${imageName} - image URL not accessible`);
    return '';
  }
  
  try {
    const imageData = await downloadImageAsBase64(imageUrl);
    
    // Return empty string if image download failed (shouldn't happen after validation, but defensive)
    if (!imageData) {
      console.warn(`  ⚠️ Gemini: Skipping ${imageName} - image download failed`);
      return '';
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: getStructuredAnalysisPrompt(isFrontView) },
          { 
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          }
        ]
      }]
    });
    
    const text = response.text?.trim() || '';
    
    // Validate character limits - balanced for completeness
    const charLimit = isFrontView ? 750 : 1500;
    if (text.length > charLimit) {
      console.warn(`Description exceeds ${charLimit} character limit (${text.length} chars). Truncating...`);
      return text.substring(0, charLimit);
    }
    
    return text;
  } catch (error) {
    // Re-throw AI provider errors (auth, rate limits, etc) - these are real problems
    console.error(`Error analyzing ${imageName} with Gemini:`, error);
    throw error;
  }
}


/**
 * Single-image analysis with Gemini: Front-view preferred, fallback to first valid image
 */
async function analyzeWithGemini(
  productName: string,
  imageUrls: string[]
): Promise<AnalysisResult> {
  const { frontView } = categorizeImages(imageUrls);
  const validImages = imageUrls.filter(isValidImageUrl);
  
  // Determine which image to analyze: front-view preferred, fallback to first valid
  let imageToAnalyze: string | null = null;
  let isFrontView = false;
  
  if (frontView && isValidImageUrl(frontView)) {
    imageToAnalyze = frontView;
    isFrontView = true;
  } else if (validImages.length > 0) {
    imageToAnalyze = validImages[0];
    isFrontView = false;
    console.log(`  ⚠️ Gemini: No front-view found, using first valid image as fallback`);
  }
  
  let description = '';
  
  if (imageToAnalyze) {
    try {
      const label = isFrontView ? 'Front View' : 'Product Image';
      console.log(`  🎯 Gemini: Analyzing ${isFrontView ? 'front-view' : 'fallback'} image ONLY`);
      description = await analyzeImageWithGemini(imageToAnalyze, label, isFrontView);
    } catch (error) {
      console.error(`  ⚠️ Gemini: Image analysis failed`);
      throw error;
    }
  } else {
    console.log(`  ⚠️ Gemini: No valid images found - skipping analysis`);
  }
  
  // Use single description for both fields (no separate combined analysis)
  return {
    frontViewDescription: isFrontView ? description : '',
    combinedDescription: description
  };
}

/**
 * Analyze a single image using OpenAI with structured format
 */
async function analyzeImageWithOpenAI(imageUrl: string, imageName: string, isFrontView: boolean = false): Promise<string> {
  // Pre-validate image URL to avoid wasting API calls on broken images
  const isValid = await validateImageUrl(imageUrl);
  if (!isValid) {
    console.warn(`  ⚠️ OpenAI: Skipping ${imageName} - image URL not accessible`);
    return '';
  }
  
  try {
    // Download image as base64
    const imageData = await downloadImageAsBase64(imageUrl);
    
    // Return empty string if image download failed (shouldn't happen after validation, but defensive)
    if (!imageData) {
      console.warn(`  ⚠️ OpenAI: Skipping ${imageName} - image download failed`);
      return '';
    }
    
    const response = await openaiClient.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: getStructuredAnalysisPrompt(isFrontView)
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageData.mimeType};base64,${imageData.data}`
              }
            }
          ],
        },
      ],
      max_completion_tokens: isFrontView ? 1024 : 2048, // Enforce token limits
    });
    
    const text = response.choices[0].message.content?.trim() || '';
    
    // Validate character limits - balanced for completeness
    const charLimit = isFrontView ? 750 : 1500;
    if (text.length > charLimit) {
      console.warn(`OpenAI description exceeds ${charLimit} character limit (${text.length} chars). Truncating...`);
      return text.substring(0, charLimit);
    }
    
    return text;
  } catch (error) {
    // Re-throw AI provider errors (auth, rate limits, etc) - these are real problems
    console.error(`Error analyzing ${imageName} with OpenAI:`, error);
    throw error;
  }
}


/**
 * Single-image analysis with OpenAI: Front-view preferred, fallback to first valid image
 */
async function analyzeWithOpenAI(
  productName: string,
  imageUrls: string[]
): Promise<AnalysisResult> {
  const { frontView } = categorizeImages(imageUrls);
  const validImages = imageUrls.filter(isValidImageUrl);
  
  // Determine which image to analyze: front-view preferred, fallback to first valid
  let imageToAnalyze: string | null = null;
  let isFrontView = false;
  
  if (frontView && isValidImageUrl(frontView)) {
    imageToAnalyze = frontView;
    isFrontView = true;
  } else if (validImages.length > 0) {
    imageToAnalyze = validImages[0];
    isFrontView = false;
    console.log(`  ⚠️ OpenAI: No front-view found, using first valid image as fallback`);
  }
  
  let description = '';
  
  if (imageToAnalyze) {
    try {
      const label = isFrontView ? 'Front View' : 'Product Image';
      console.log(`  🎯 OpenAI: Analyzing ${isFrontView ? 'front-view' : 'fallback'} image ONLY`);
      description = await analyzeImageWithOpenAI(imageToAnalyze, label, isFrontView);
    } catch (error) {
      console.error(`  ⚠️ OpenAI: Image analysis failed`);
      throw error;
    }
  } else {
    console.log(`  ⚠️ OpenAI: No valid images found - skipping analysis`);
  }
  
  // Use single description for both fields (no separate combined analysis)
  return {
    frontViewDescription: isFrontView ? description : '',
    combinedDescription: description
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
  
  // Check for valid images and safely extract them
  const productImages = product.images || [];
  if (productImages.length === 0) {
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
  
  // OPTIMIZATION: Identify which single image to analyze (front-view or first) BEFORE validation
  const { frontView } = categorizeImages(productImages);
  let validatedImage: string | null = null;
  
  // Try front-view first if available
  if (frontView) {
    console.log(`  🔍 Pre-validating front-view image...`);
    const isValid = await validateImageUrl(frontView);
    if (isValid) {
      validatedImage = frontView;
      console.log(`  ✅ Front-view image validated`);
    } else {
      console.log(`  ⚠️ Front-view failed validation, trying fallback...`);
    }
  }
  
  // Fallback: Try other images if front-view failed or doesn't exist
  if (!validatedImage && productImages.length > 0) {
    console.log(`  🔍 Validating fallback images...`);
    for (const imageUrl of productImages) {
      // Skip front-view if we already tried it
      if (imageUrl === frontView) continue;
      
      const isValid = await validateImageUrl(imageUrl);
      if (isValid) {
        validatedImage = imageUrl;
        console.log(`  ✅ Found valid fallback image`);
        break; // Stop at first valid image
      }
    }
  }
  
  // If no valid images found at all, return error
  if (!validatedImage) {
    console.log(`  ❌ All images failed validation - skipping AI analysis`);
    return {
      sku: product.sku,
      productId: product.productId,
      visualDescription: '',
      visualDescriptionGemini: '',
      visualDescriptionOpenAI: '',
      visualDescriptionFrontView: '',
      visualDescriptionFrontViewGemini: '',
      visualDescriptionFrontViewOpenAI: '',
      error: 'All images failed validation (broken or unsupported format)'
    };
  }
  
  console.log(`  ✅ Image validated and ready for analysis`);
  
  // Use only the validated image for analysis
  const imagesToAnalyze = [validatedImage];
  
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
    analyzeWithGemini(product.name, imagesToAnalyze),
    analyzeWithOpenAI(product.name, imagesToAnalyze)
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
  
  // Determine active descriptions (Front-view prioritized for rendering accuracy)
  // Prioritize front-view descriptions for AI rendering (more concise and accurate)
  const activeFrontView = gemini?.frontViewDescription || openai?.frontViewDescription || '';
  // For backward compatibility, keep combined as fallback or when front-view unavailable
  const activeDescription = activeFrontView || gemini?.combinedDescription || openai?.combinedDescription || '';
  
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
  
  // Only mark as analyzed if we got meaningful results from at least one provider
  // Don't cache empty results from failed analysis
  const hasValidResults = result.visualDescriptionGemini || result.visualDescriptionOpenAI ||
                         result.visualDescriptionFrontViewGemini || result.visualDescriptionFrontViewOpenAI;
  
  if (product.productId && imagesToAnalyze.length > 0 && hasValidResults) {
    markAsAnalyzed(product.productId, imagesToAnalyze, {
      visualDescription: result.visualDescription,
      visualDescriptionGemini: result.visualDescriptionGemini,
      visualDescriptionOpenAI: result.visualDescriptionOpenAI,
      visualDescriptionFrontView: result.visualDescriptionFrontView,
      visualDescriptionFrontViewGemini: result.visualDescriptionFrontViewGemini,
      visualDescriptionFrontViewOpenAI: result.visualDescriptionFrontViewOpenAI
    });
  } else if (product.productId && !hasValidResults) {
    console.warn(`  ⚠️ Not caching - no valid analysis results obtained`);
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