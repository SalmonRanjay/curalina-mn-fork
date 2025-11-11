import { ulid } from "ulid";
import { curalinaStorage } from "../storage-curalina";
import { analyzeProductVisuals } from "./product-visual-analyzer";
import { analyzeProductVisualsWithOpenAI } from "./openai-vision";
import type { VisualAnalysisJob, VisualAnalysisProduct, Product } from "@shared/schema";

const BATCH_SIZE = 20; // Max products per batch to avoid API overload
const ANALYSIS_DELAY = 8000; // 8 seconds between analyses to prevent rate limiting

/**
 * Create a new visual analysis job
 */
export async function createVisualAnalysisJob(
  userId: string | null,
  jobType: 'manual' | 'auto_after_upload' = 'manual',
  uploadJobId?: string,
  filters?: {
    productIds?: string[];
    onlyMissingDescriptions?: boolean;
  }
): Promise<VisualAnalysisJob> {
  console.log('\n📊 Creating visual analysis job...');
  
  // Get products to analyze
  let productsToAnalyze = await curalinaStorage.getAllProducts();
  
  // Filter for products with valid S3 images
  productsToAnalyze = productsToAnalyze.filter(p => 
    p.images && p.images.length > 0 && p.images[0].startsWith('https://curalina')
  );
  
  // Apply filters
  if (filters?.productIds) {
    productsToAnalyze = productsToAnalyze.filter(p => filters.productIds!.includes(p.id));
  }
  
  if (filters?.onlyMissingDescriptions) {
    productsToAnalyze = productsToAnalyze.filter(p => 
      !p.visualDescriptionGemini && !p.visualDescriptionOpenAI
    );
  }
  
  console.log(`Found ${productsToAnalyze.length} products to analyze`);
  
  // Create the job
  const job = await curalinaStorage.createVisualAnalysisJob({
    id: ulid(),
    userId,
    status: 'pending',
    jobType,
    uploadJobId,
    totalProducts: productsToAnalyze.length,
    analyzedProducts: 0,
    failedProducts: 0,
    skippedProducts: 0,
    currentProductName: null,
    currentProductSku: null,
    errorMessage: null,
    metadata: { 
      filters, 
      batchSize: BATCH_SIZE,
      startedAt: new Date().toISOString() 
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  });
  
  // Create product records for the job
  if (productsToAnalyze.length > 0) {
    const productRecords = productsToAnalyze.map(p => ({
      id: ulid(),
      jobId: job.id,
      productId: p.id,
      productSku: p.sku,
      productName: p.name,
      status: 'pending' as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    // Use upsert to handle unique constraint on (jobId, productId)
    await curalinaStorage.upsertVisualAnalysisProducts(productRecords);
  }
  
  console.log(`✅ Created visual analysis job ${job.id} with ${productsToAnalyze.length} products`);
  
  // Start processing in the background
  processJobAsync(job.id).catch(err => {
    console.error(`Failed to process job ${job.id}:`, err);
    curalinaStorage.updateVisualAnalysisJob(job.id, {
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date()
    });
  });
  
  return job;
}

/**
 * Process a visual analysis job asynchronously
 */
async function processJobAsync(jobId: string): Promise<void> {
  console.log(`\n🚀 Starting async processing for job ${jobId}`);
  
  // Update job status to processing
  await curalinaStorage.updateVisualAnalysisJob(jobId, {
    status: 'processing'
  });
  
  let hasMore = true;
  let iteration = 0;
  
  while (hasMore) {
    iteration++;
    console.log(`\n📦 Processing batch ${iteration} for job ${jobId}`);
    
    const processedCount = await processVisualAnalysisJob(jobId);
    hasMore = processedCount > 0;
    
    if (hasMore) {
      console.log(`⏳ Waiting ${ANALYSIS_DELAY / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));
    }
  }
  
  // Mark job as completed
  const job = await curalinaStorage.getVisualAnalysisJob(jobId);
  if (job) {
    const status = job.failedProducts > 0 ? 'completed_with_errors' : 'completed';
    await curalinaStorage.updateVisualAnalysisJob(jobId, {
      status,
      completedAt: new Date(),
      currentProductName: null,
      currentProductSku: null
    });
    console.log(`✅ Job ${jobId} completed with status: ${status}`);
  }
}

/**
 * Process a batch of products for a visual analysis job
 */
export async function processVisualAnalysisJob(jobId: string): Promise<number> {
  // Get pending products for this job (up to BATCH_SIZE)
  const pendingProducts = await curalinaStorage.getPendingVisualAnalysisProducts(jobId, BATCH_SIZE);
  
  if (pendingProducts.length === 0) {
    console.log(`No pending products for job ${jobId}`);
    return 0;
  }
  
  console.log(`Processing ${pendingProducts.length} products...`);
  
  let analyzedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  
  for (const productRecord of pendingProducts) {
    try {
      // Get the full product data
      const product = await curalinaStorage.getProduct(productRecord.productId);
      
      if (!product) {
        console.log(`Product ${productRecord.productId} not found, skipping`);
        await curalinaStorage.updateVisualAnalysisProduct(productRecord.id, {
          status: 'skipped',
          errorMessage: 'Product not found'
        });
        skippedCount++;
        continue;
      }
      
      // Skip products without valid images
      if (!product.images || product.images.length === 0 || 
          !product.images[0].startsWith('https://curalina')) {
        console.log(`Product ${product.name} has no valid images, skipping`);
        await curalinaStorage.updateVisualAnalysisProduct(productRecord.id, {
          status: 'skipped',
          errorMessage: 'No valid S3 images'
        });
        skippedCount++;
        continue;
      }
      
      // Update current product being analyzed
      await curalinaStorage.updateVisualAnalysisJob(jobId, {
        currentProductName: product.name,
        currentProductSku: product.sku || 'N/A'
      });
      
      console.log(`\n🔍 Analyzing: ${product.name} (SKU: ${product.sku || 'N/A'})`);
      
      // Run both analyses in parallel using Promise.allSettled
      const [geminiResult, openAiResult] = await Promise.allSettled([
        analyzeProductVisuals(product),
        analyzeProductVisualsWithOpenAI(product)
      ]);
      
      let updateData: any = {};
      let hasAnySuccess = false;
      let errorMessages: string[] = [];
      
      // Process Gemini result
      if (geminiResult.status === 'fulfilled' && geminiResult.value) {
        updateData.visualDescriptionGemini = geminiResult.value;
        // Set as main description if empty (backward compatibility)
        if (!product.visualDescription) {
          updateData.visualDescription = geminiResult.value;
        }
        hasAnySuccess = true;
        console.log('✅ Gemini analysis succeeded');
      } else if (geminiResult.status === 'rejected') {
        errorMessages.push(`Gemini: ${geminiResult.reason}`);
        console.log('❌ Gemini analysis failed:', geminiResult.reason);
      }
      
      // Process OpenAI result
      if (openAiResult.status === 'fulfilled' && openAiResult.value) {
        updateData.visualDescriptionOpenAI = openAiResult.value;
        // Set as main description if Gemini failed and this is empty
        if (!product.visualDescription && !updateData.visualDescriptionGemini) {
          updateData.visualDescription = openAiResult.value;
        }
        hasAnySuccess = true;
        console.log('✅ OpenAI analysis succeeded');
      } else if (openAiResult.status === 'rejected') {
        errorMessages.push(`OpenAI: ${openAiResult.reason}`);
        console.log('❌ OpenAI analysis failed:', openAiResult.reason);
      }
      
      // Update product and job record based on results
      if (hasAnySuccess) {
        await curalinaStorage.updateProduct(product.id, updateData);
        await curalinaStorage.updateVisualAnalysisProduct(productRecord.id, {
          status: 'analyzed'
        });
        analyzedCount++;
        console.log(`✅ Product analysis complete`);
      } else {
        // Both analyses failed
        await curalinaStorage.updateVisualAnalysisProduct(productRecord.id, {
          status: 'failed',
          errorMessage: errorMessages.join('; ')
        });
        failedCount++;
        console.log(`❌ Product analysis failed completely`);
      }
      
      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.error(`Error processing product ${productRecord.productId}:`, error);
      await curalinaStorage.updateVisualAnalysisProduct(productRecord.id, {
        status: 'failed',
        errorMessage: error.message || 'Unknown error'
      });
      failedCount++;
    }
  }
  
  // Update job counters
  const job = await curalinaStorage.getVisualAnalysisJob(jobId);
  if (job) {
    await curalinaStorage.updateVisualAnalysisJob(jobId, {
      analyzedProducts: job.analyzedProducts + analyzedCount,
      skippedProducts: job.skippedProducts + skippedCount,
      failedProducts: job.failedProducts + failedCount
    });
  }
  
  console.log(`\n📊 Batch complete: ${analyzedCount} analyzed, ${skippedCount} skipped, ${failedCount} failed`);
  
  return pendingProducts.length;
}

/**
 * Get active visual analysis jobs (pending or processing)
 */
export async function getActiveJobs(userId?: string): Promise<VisualAnalysisJob[]> {
  return curalinaStorage.getActiveVisualAnalysisJobs(userId);
}