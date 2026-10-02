import { GoogleGenAI } from "@google/genai";
import { buildDimensionSummary } from './dimension-utils';
const genAI = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
});
/**
 * Image prioritization for visual description generation
 * Returns the best image URL for analysis based on view priority
 */
export function selectBestImageForAnalysis(product) {
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
export async function generateAccurateVisualDescription(product, imageUrl) {
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
            }
            catch (error) {
                // Check if it's a rate limit error
                if (error?.error?.code === 'RATELIMIT_EXCEEDED' && retries < MAX_RETRIES) {
                    const delayMs = Math.pow(2, retries) * 2000; // Exponential backoff: 2s, 4s, 8s
                    console.warn(`  ⏱️ Rate limit hit. Retrying in ${delayMs}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    retries++;
                }
                else {
                    throw error; // Not a rate limit error or max retries reached
                }
            }
        }
        // Extract text from response
        if (!response) {
            console.error(`  ⚠️ No response from Gemini`);
            return null;
        }
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
    }
    catch (error) {
        console.error(`  ❌ Analysis failed:`, error);
        return null;
    }
}
/**
 * Build prompt for generating condensed visual descriptions optimized for AI generation
 * Target: 40-50 tokens (30-40 words) focusing on key visual attributes
 */
function buildAccurateDescriptionPrompt(product, dimensionContext) {
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
export async function regenerateAllVisualDescriptions(products, storage, // ICuralinaStorage instance
options = {}, progressCallback, onProductUpdated) {
    const { mode = 'missing_only', userId, resumeJobId } = options;
    // Filter products based on mode
    let productsToProcess = products;
    if (mode === 'missing_only' && !resumeJobId) {
        productsToProcess = products.filter(p => !p.visualDescription || p.visualDescription.trim() === '');
        console.log(`\n📋 Filtered to ${productsToProcess.length} products with missing descriptions (out of ${products.length} total)`);
    }
    const progress = {
        total: productsToProcess.length,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: []
    };
    // Create or resume job
    let job;
    if (resumeJobId) {
        job = await storage.getVisualDescriptionJob(resumeJobId);
        if (!job) {
            throw new Error(`Job ${resumeJobId} not found`);
        }
        console.log(`\n🔄 Resuming job ${resumeJobId} from checkpoint...`);
        console.log(`   Previous progress: ${job.processedProducts}/${job.totalProducts}`);
        // Restore progress from job
        progress.processed = job.processedProducts || 0;
        progress.successful = job.successfulAnalyses || 0;
        progress.failed = job.failedAnalyses || 0;
        progress.skipped = job.skippedProducts || 0;
        progress.jobId = job.id;
    }
    else {
        // Create new job
        job = await storage.createVisualDescriptionJob({
            userId,
            status: 'processing',
            mode,
            totalProducts: productsToProcess.length,
            processedProducts: 0,
            successfulAnalyses: 0,
            failedAnalyses: 0,
            skippedProducts: 0,
            startedAt: new Date(),
        });
        progress.jobId = job.id;
        // Create job products for tracking
        const jobProducts = productsToProcess.map(p => ({
            jobId: job.id,
            productId: p.id,
            status: 'pending',
        }));
        await storage.createVisualDescriptionProducts(jobProducts);
        console.log(`\n🎨 Starting batch visual description regeneration (Job ID: ${job.id})`);
        console.log(`   Mode: ${mode}`);
        console.log(`   Products: ${productsToProcess.length}`);
        console.log(`   Workers: 2 concurrent`);
    }
    // Get pending products from job
    const jobProducts = await storage.getPendingVisualDescriptionProducts(job.id, 999999);
    const pendingProductIds = new Set(jobProducts.map((jp) => jp.productId));
    const remainingProducts = productsToProcess.filter(p => pendingProductIds.has(p.id));
    console.log(`\n📊 Products remaining: ${remainingProducts.length}`);
    // Process 2 products concurrently to respect API rate limits
    const CONCURRENT_WORKERS = 2;
    const BATCH_SIZE = Math.ceil(remainingProducts.length / CONCURRENT_WORKERS);
    const processingWorkers = [];
    for (let workerIdx = 0; workerIdx < CONCURRENT_WORKERS; workerIdx++) {
        const start = workerIdx * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, remainingProducts.length);
        const workerProducts = remainingProducts.slice(start, end);
        if (workerProducts.length === 0)
            continue;
        const worker = (async () => {
            for (const product of workerProducts) {
                progress.currentProduct = `${product.sku} - ${product.name}`;
                console.log(`\n[W${workerIdx + 1}][${progress.processed + 1}/${progress.total}] ${progress.currentProduct}`);
                // Find corresponding job product
                const jobProduct = jobProducts.find((jp) => jp.productId === product.id);
                if (!jobProduct) {
                    console.warn(`  ⚠️ No job product found for ${product.sku}`);
                    progress.processed++;
                    continue;
                }
                // Update job product status to processing
                await storage.updateVisualDescriptionProduct(jobProduct.id, {
                    status: 'processing',
                });
                try {
                    // Select best image for analysis
                    const selectedImage = selectBestImageForAnalysis(product);
                    if (!selectedImage) {
                        console.log(`  ⏭️ Skipped - no images available`);
                        progress.skipped++;
                        progress.processed++;
                        // Update job product as skipped
                        await storage.updateVisualDescriptionProduct(jobProduct.id, {
                            status: 'skipped',
                            errorMessage: 'No images available',
                        });
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
                        // Update job product with success
                        await storage.updateVisualDescriptionProduct(jobProduct.id, {
                            status: 'completed',
                            visualDescription: description,
                            wordCount,
                            imageSource: selectedImage.source,
                        });
                    }
                    else {
                        progress.failed++;
                        progress.errors.push({
                            sku: product.sku,
                            error: 'Failed to generate description'
                        });
                        console.log(`  ❌ Failed - could not generate description`);
                        // Update job product with failure
                        await storage.updateVisualDescriptionProduct(jobProduct.id, {
                            status: 'failed',
                            errorMessage: 'Failed to generate description',
                        });
                    }
                }
                catch (error) {
                    progress.failed++;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    progress.errors.push({
                        sku: product.sku,
                        error: errorMessage
                    });
                    console.error(`  ❌ Error:`, errorMessage);
                    // Update job product with error
                    await storage.updateVisualDescriptionProduct(jobProduct.id, {
                        status: 'failed',
                        errorMessage,
                    });
                }
                progress.processed++;
                // Save checkpoint every 10 products
                if (progress.processed % 10 === 0) {
                    await storage.updateVisualDescriptionJob(job.id, {
                        processedProducts: progress.processed,
                        successfulAnalyses: progress.successful,
                        failedAnalyses: progress.failed,
                        skippedProducts: progress.skipped,
                        currentProductName: progress.currentProduct,
                        lastCheckpointProductId: product.id,
                    });
                    console.log(`   💾 Checkpoint saved: ${progress.processed}/${progress.total}`);
                }
                progressCallback?.(progress);
                // Delay between products to respect API rate limits (500-1000ms per product)
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        })();
        processingWorkers.push(worker);
    }
    // Wait for all workers to complete
    await Promise.all(processingWorkers);
    // Mark job as completed
    await storage.updateVisualDescriptionJob(job.id, {
        status: 'completed',
        processedProducts: progress.processed,
        successfulAnalyses: progress.successful,
        failedAnalyses: progress.failed,
        skippedProducts: progress.skipped,
        completedAt: new Date(),
    });
    console.log(`\n✅ Batch regeneration complete! (Job ID: ${job.id})`);
    console.log(`  📊 Total: ${progress.total}`);
    console.log(`  ✅ Successful: ${progress.successful}`);
    console.log(`  ❌ Failed: ${progress.failed}`);
    console.log(`  ⏭️  Skipped: ${progress.skipped}`);
    if (progress.errors.length > 0 && progress.errors.length <= 10) {
        console.log(`\n❌ Errors encountered:`);
        progress.errors.forEach(err => {
            console.log(`  - ${err.sku}: ${err.error}`);
        });
    }
    else if (progress.errors.length > 10) {
        console.log(`\n❌ ${progress.errors.length} errors encountered (showing first 10):`);
        progress.errors.slice(0, 10).forEach(err => {
            console.log(`  - ${err.sku}: ${err.error}`);
        });
    }
    return progress;
}
//# sourceMappingURL=batch-visual-description-regenerator.js.map