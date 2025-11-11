import { db } from "../db";
import { 
  visualAnalysisJobs, 
  visualAnalysisProducts,
  products,
  InsertVisualAnalysisJob,
  InsertVisualAnalysisProduct,
  VisualAnalysisJob,
  VisualAnalysisProduct
} from "@shared/schema";
import { eq, and, inArray, isNull, or, sql } from "drizzle-orm";
import { analyzeProductVisuals } from "./product-visual-analyzer";
import { analyzeProductVisualsWithOpenAI } from "./openai-vision";

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
  let productsToAnalyze = await db.select().from(products);
  
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
  const [job] = await db.insert(visualAnalysisJobs).values({
    userId,
    status: 'pending',
    jobType,
    uploadJobId,
    totalProducts: productsToAnalyze.length,
    analyzedProducts: 0,
    failedProducts: 0,
    skippedProducts: 0,
    metadata: { 
      filters, 
      batchSize: BATCH_SIZE,
      startedAt: new Date().toISOString() 
    }
  }).returning();
  
  // Create product records for the job
  if (productsToAnalyze.length > 0) {
    const productRecords: InsertVisualAnalysisProduct[] = productsToAnalyze.map(p => ({
      jobId: job.id,
      productId: p.id,
      productSku: p.sku,
      productName: p.name,
      status: p.visualDescriptionGemini && p.visualDescriptionOpenAI ? 'skipped' : 'pending'
    }));
    
    // Insert products with ON CONFLICT DO NOTHING to handle uniqueness
    for (const record of productRecords) {
      try {
        await db.insert(visualAnalysisProducts).values(record);
      } catch (error: any) {
        // Ignore duplicate key errors
        if (!error?.message?.includes('duplicate key')) {
          console.error('Error inserting analysis product:', error);
        }
      }
    }
    
    // Update skipped count
    const skippedCount = productRecords.filter(r => r.status === 'skipped').length;
    if (skippedCount > 0) {
      await db.update(visualAnalysisJobs)
        .set({ skippedProducts: skippedCount })
        .where(eq(visualAnalysisJobs.id, job.id));
    }
  }
  
  return job;
}

/**
 * Process a visual analysis job
 */
export async function processVisualAnalysisJob(jobId: string): Promise<void> {
  console.log(`\n🚀 Starting visual analysis job: ${jobId}`);
  
  try {
    // Update job status to processing
    await db.update(visualAnalysisJobs)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(visualAnalysisJobs.id, jobId));
    
    // Get pending products for this job
    const pendingProducts = await db.select()
      .from(visualAnalysisProducts)
      .where(and(
        eq(visualAnalysisProducts.jobId, jobId),
        eq(visualAnalysisProducts.status, 'pending')
      ))
      .limit(BATCH_SIZE);
    
    console.log(`Processing ${pendingProducts.length} products in this batch`);
    
    for (let i = 0; i < pendingProducts.length; i++) {
      const analysisProduct = pendingProducts[i];
      
      // Get full product data
      const [product] = await db.select()
        .from(products)
        .where(eq(products.id, analysisProduct.productId));
      
      if (!product || !product.images || product.images.length === 0) {
        await updateAnalysisProductStatus(analysisProduct.id, jobId, 'skipped', 
          null, null, 'No valid images found');
        continue;
      }
      
      console.log(`\n[${i + 1}/${pendingProducts.length}] Analyzing: ${product.name} (${product.sku})`);
      
      // Update status to analyzing
      await db.update(visualAnalysisProducts)
        .set({ status: 'analyzing' })
        .where(eq(visualAnalysisProducts.id, analysisProduct.id));
      
      // Update job with current product
      await db.update(visualAnalysisJobs)
        .set({ currentProductName: product.name, updatedAt: new Date() })
        .where(eq(visualAnalysisJobs.id, jobId));
      
      // Run both AI providers in parallel using Promise.allSettled
      const [geminiResult, openaiResult] = await Promise.allSettled([
        analyzeProductVisuals(product.name, product.images),
        analyzeProductVisualsWithOpenAI(product.name, product.images)
      ]);
      
      // Extract descriptions from settled promises
      const geminiDescription = geminiResult.status === 'fulfilled' ? geminiResult.value : '';
      const openaiDescription = openaiResult.status === 'fulfilled' ? openaiResult.value : '';
      
      // Determine status for each provider
      const geminiStatus = geminiResult.status === 'fulfilled' && geminiDescription ? 'success' : 'failed';
      const openaiStatus = openaiResult.status === 'fulfilled' && openaiDescription ? 'success' : 'failed';
      
      // Log individual provider failures
      if (geminiResult.status === 'rejected') {
        console.error(`  ⚠️ Gemini analysis failed:`, geminiResult.reason?.message || geminiResult.reason);
      }
      if (openaiResult.status === 'rejected') {
        console.error(`  ⚠️ OpenAI analysis failed:`, openaiResult.reason?.message || openaiResult.reason);
      }
      
      // Update product with visual descriptions
      if (geminiDescription || openaiDescription) {
        const activeDescription = geminiDescription || openaiDescription;
        await db.update(products)
          .set({
            visualDescription: activeDescription,
            visualDescriptionGemini: geminiDescription || undefined,
            visualDescriptionOpenAI: openaiDescription || undefined
          })
          .where(eq(products.id, product.id));
        
        await updateAnalysisProductStatus(
          analysisProduct.id, 
          jobId, 
          'completed',
          geminiDescription,
          openaiDescription,
          null,
          geminiStatus,
          openaiStatus
        );
        
        console.log(`✅ Analysis completed for: ${product.sku}`);
        console.log(`  📊 Gemini: ${geminiStatus === 'success' ? `OK (${geminiDescription.length} chars)` : 'FAILED'}`);
        console.log(`  📊 OpenAI: ${openaiStatus === 'success' ? `OK (${openaiDescription.length} chars)` : 'FAILED'}`);
      } else {
        await updateAnalysisProductStatus(
          analysisProduct.id, 
          jobId, 
          'failed',
          null,
          null,
          'Both AI providers failed',
          'failed',
          'failed'
        );
        console.error(`❌ Analysis failed for: ${product.sku} - Both providers failed`);
      }
      
      // Delay between analyses to avoid rate limiting
      if (i < pendingProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));
      }
    }
    
    // Check if there are more products to process
    const remainingProducts = await db.select({ count: sql<number>`count(*)` })
      .from(visualAnalysisProducts)
      .where(and(
        eq(visualAnalysisProducts.jobId, jobId),
        eq(visualAnalysisProducts.status, 'pending')
      ));
    
    const hasMore = remainingProducts[0].count > 0;
    
    if (hasMore) {
      console.log(`\n📋 Batch complete. ${remainingProducts[0].count} products remaining.`);
      // Continue processing in next batch
      setTimeout(() => processVisualAnalysisJob(jobId), 1000);
    } else {
      // Job complete
      await db.update(visualAnalysisJobs)
        .set({ 
          status: 'completed', 
          completedAt: new Date(),
          updatedAt: new Date(),
          currentProductName: null
        })
        .where(eq(visualAnalysisJobs.id, jobId));
      
      console.log(`\n✅ Visual analysis job completed: ${jobId}`);
    }
    
  } catch (error) {
    console.error('Error processing visual analysis job:', error);
    await db.update(visualAnalysisJobs)
      .set({ 
        status: 'failed', 
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date()
      })
      .where(eq(visualAnalysisJobs.id, jobId));
  }
}

/**
 * Helper to update analysis product status and job counters
 */
async function updateAnalysisProductStatus(
  productId: string,
  jobId: string,
  status: 'completed' | 'failed' | 'skipped',
  geminiDescription: string | null,
  openaiDescription: string | null,
  errorMessage: string | null,
  geminiStatus?: string,
  openaiStatus?: string
): Promise<void> {
  // Update product status
  await db.update(visualAnalysisProducts)
    .set({
      status,
      geminiDescription,
      openaiDescription,
      geminiStatus,
      openaiStatus,
      errorMessage,
      analyzedAt: status === 'completed' ? new Date() : undefined
    })
    .where(eq(visualAnalysisProducts.id, productId));
  
  // Update job counters
  const counterField = status === 'completed' ? 'analyzedProducts' : 
                       status === 'failed' ? 'failedProducts' : 
                       'skippedProducts';
  
  await db.update(visualAnalysisJobs)
    .set({ 
      [counterField]: sql`${sql.identifier(counterField)} + 1`,
      updatedAt: new Date()
    })
    .where(eq(visualAnalysisJobs.id, jobId));
}

/**
 * Get active visual analysis jobs
 */
export async function getActiveVisualAnalysisJobs(): Promise<VisualAnalysisJob[]> {
  return await db.select()
    .from(visualAnalysisJobs)
    .where(inArray(visualAnalysisJobs.status, ['pending', 'processing']));
}

/**
 * Get visual analysis job details with products
 */
export async function getVisualAnalysisJobDetails(jobId: string): Promise<{
  job: VisualAnalysisJob;
  products: VisualAnalysisProduct[];
} | null> {
  const [job] = await db.select()
    .from(visualAnalysisJobs)
    .where(eq(visualAnalysisJobs.id, jobId));
  
  if (!job) return null;
  
  const products = await db.select()
    .from(visualAnalysisProducts)
    .where(eq(visualAnalysisProducts.jobId, jobId));
  
  return { job, products };
}

/**
 * Trigger visual analysis after upload job completion
 */
export async function triggerAnalysisAfterUpload(
  uploadJobId: string, 
  productId: string,
  userId: string | null
): Promise<void> {
  console.log(`\n🔄 Auto-triggering visual analysis after upload job: ${uploadJobId}`);
  
  // Check if product has images
  const [product] = await db.select()
    .from(products)
    .where(eq(products.id, productId));
  
  if (!product || !product.images || product.images.length === 0) {
    console.log('Product has no images, skipping visual analysis');
    return;
  }
  
  // Check if product already has visual descriptions
  if (product.visualDescriptionGemini && product.visualDescriptionOpenAI) {
    console.log('Product already has visual descriptions, skipping');
    return;
  }
  
  // Create and process the job
  const job = await createVisualAnalysisJob(
    userId,
    'auto_after_upload',
    uploadJobId,
    { productIds: [productId] }
  );
  
  // Process job in background
  setTimeout(() => processVisualAnalysisJob(job.id), 1000);
}