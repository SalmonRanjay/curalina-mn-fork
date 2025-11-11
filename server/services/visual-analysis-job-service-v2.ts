import { curalinaStorage } from '../storage-curalina';
import { analyzeProductVisualsV2, batchAnalyzeProductsConcurrent } from './product-visual-analyzer-v2';
import { globalRateLimiter } from '../utils/rate-limiter';
import type { VisualAnalysisJob, VisualAnalysisProduct, Product } from '@shared/schema';

/**
 * Enhanced Visual Analysis Job Service with priority queuing,
 * partial progress saves, and automatic recovery
 */

interface JobPriority {
  jobId: string;
  priority: number;
  retryCount: number;
  lastAttemptAt?: Date;
}

class VisualAnalysisJobQueue {
  private queue: JobPriority[] = [];
  private processing: boolean = false;
  private checkpointInterval = 10; // Save progress every 10 products
  private maxRetries = 3;
  
  /**
   * Add a job to the priority queue
   */
  enqueueJob(jobId: string, priority: number = 0): void {
    const existing = this.queue.findIndex(j => j.jobId === jobId);
    if (existing === -1) {
      this.queue.push({
        jobId,
        priority,
        retryCount: 0
      });
      this.sortQueue();
    }
  }
  
  /**
   * Process the queue
   */
  async processQueue(): Promise<void> {
    if (this.processing) {
      console.log('Queue already processing');
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      
      try {
        await this.processJob(job);
      } catch (error) {
        console.error(`Failed to process job ${job.jobId}:`, error);
        
        // Re-queue with lower priority if retries remaining
        if (job.retryCount < this.maxRetries) {
          job.retryCount++;
          job.priority -= 10; // Lower priority for retry
          job.lastAttemptAt = new Date();
          this.queue.push(job);
          this.sortQueue();
        }
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Process a single job with checkpoint saves
   */
  private async processJob(jobPriority: JobPriority): Promise<void> {
    const job = await curalinaStorage.getVisualAnalysisJob(jobPriority.jobId);
    if (!job || job.status === 'completed' || job.status === 'cancelled') {
      return;
    }
    
    console.log(`\n🎯 Processing job ${job.id} (Priority: ${jobPriority.priority}, Retry: ${jobPriority.retryCount})`);
    
    // Mark job as processing
    await curalinaStorage.updateVisualAnalysisJob(job.id, {
      status: 'processing'
    });
    
    let processedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    try {
      // Get pending products for this job
      const pendingProducts = await curalinaStorage.getPendingVisualAnalysisProducts(job.id, 100);
      
      if (pendingProducts.length === 0) {
        // No pending products, mark job as completed
        await this.completeJob(job.id);
        return;
      }
      
      // Process in batches with concurrent workers
      const batchSize = 20;
      const workerCount = 5;
      
      for (let i = 0; i < pendingProducts.length; i += batchSize) {
        const batch = pendingProducts.slice(i, i + batchSize);
        
        // Fetch full product data with images
        const productsToAnalyze = await Promise.all(
          batch.map(async (ap) => {
            const product = await curalinaStorage.getProduct(ap.productId);
            return product ? {
              sku: product.sku,
              productId: product.id,
              name: product.name,
              images: product.images
            } : null;
          })
        );
        
        const validProducts = productsToAnalyze.filter((p): p is NonNullable<typeof p> => p !== null);
        
        // Mark products as analyzing
        await Promise.all(
          batch.map(ap =>
            curalinaStorage.updateVisualAnalysisProduct(ap.id, {
              status: 'analyzing',
              analyzedAt: new Date()
            })
          )
        );
        
        // Analyze batch with concurrent workers
        const results = await batchAnalyzeProductsConcurrent(
          validProducts,
          {
            workerCount: Math.min(workerCount, validProducts.length),
            batchSize: Math.ceil(validProducts.length / workerCount),
            onProgress: (completed, total) => {
              console.log(`  Progress: ${completed}/${total} products analyzed`);
            }
          }
        );
        
        // Save results
        for (const result of results) {
          const analysisProduct = batch.find(ap => {
            const product = validProducts.find(p => p.productId === ap.productId);
            return product?.sku === result.sku;
          });
          
          if (analysisProduct) {
            if (result.error) {
              errorCount++;
              await curalinaStorage.updateVisualAnalysisProduct(analysisProduct.id, {
                status: 'failed',
                errorMessage: result.error
              });
            } else {
              processedCount++;
              
              // Update visual analysis product record
              await curalinaStorage.updateVisualAnalysisProduct(analysisProduct.id, {
                status: 'completed',
                geminiStatus: result.visualDescriptionGemini ? 'success' : 'failed',
                openaiStatus: result.visualDescriptionOpenAI ? 'success' : 'failed',
                geminiDescription: result.visualDescriptionGemini || null,
                openaiDescription: result.visualDescriptionOpenAI || null
              });
              
              // Update product with new descriptions
              await curalinaStorage.updateProduct(analysisProduct.productId, {
                visualDescription: result.visualDescription || undefined,
                visualDescriptionGemini: result.visualDescriptionGemini || undefined,
                visualDescriptionOpenAI: result.visualDescriptionOpenAI || undefined,
                visualDescriptionFrontView: result.visualDescriptionFrontView || undefined,
                visualDescriptionFrontViewGemini: result.visualDescriptionFrontViewGemini || undefined,
                visualDescriptionFrontViewOpenAI: result.visualDescriptionFrontViewOpenAI || undefined
              });
            }
          }
        }
        
        // Checkpoint: Save progress to job
        if ((processedCount + errorCount) % this.checkpointInterval === 0) {
          await this.saveCheckpoint(job.id, processedCount, errorCount);
        }
        
        // Check if job was cancelled
        const currentJob = await curalinaStorage.getVisualAnalysisJob(job.id);
        if (currentJob?.status === 'cancelled') {
          console.log('Job cancelled, stopping processing');
          break;
        }
      }
      
      // Final save
      await this.saveCheckpoint(job.id, processedCount, errorCount);
      
      // Check if all products are processed
      const remainingPending = await curalinaStorage.getPendingVisualAnalysisProducts(job.id, 1);
      if (remainingPending.length === 0) {
        await this.completeJob(job.id);
      }
      
    } catch (error) {
      console.error('Job processing error:', error);
      await curalinaStorage.updateVisualAnalysisJob(job.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Save checkpoint progress
   */
  private async saveCheckpoint(jobId: string, processedCount: number, errorCount: number): Promise<void> {
    const job = await curalinaStorage.getVisualAnalysisJob(jobId);
    if (!job) return;
    
    await curalinaStorage.updateVisualAnalysisJob(jobId, {
      analyzedProducts: (job.analyzedProducts || 0) + processedCount,
      failedProducts: (job.failedProducts || 0) + errorCount
    });
    
    console.log(`  💾 Checkpoint saved: ${processedCount} analyzed, ${errorCount} failed`);
  }
  
  /**
   * Complete a job
   */
  private async completeJob(jobId: string): Promise<void> {
    const job = await curalinaStorage.getVisualAnalysisJob(jobId);
    if (!job) return;
    
    // Count final statistics
    const allProducts = await curalinaStorage.getVisualAnalysisProducts(jobId);
    const completed = allProducts.filter(p => p.status === 'completed').length;
    const failed = allProducts.filter(p => p.status === 'failed').length;
    const skipped = allProducts.filter(p => p.status === 'skipped').length;
    
    await curalinaStorage.updateVisualAnalysisJob(jobId, {
      status: 'completed',
      completedAt: new Date(),
      analyzedProducts: completed,
      failedProducts: failed,
      skippedProducts: skipped
    });
    
    console.log(`✅ Job ${jobId} completed: ${completed} analyzed, ${failed} failed, ${skipped} skipped`);
  }
  
  /**
   * Sort queue by priority (higher priority first)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Get queue status
   */
  getStatus(): { queueLength: number; processing: boolean; jobs: JobPriority[] } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      jobs: [...this.queue]
    };
  }
}

// Singleton queue instance
const jobQueue = new VisualAnalysisJobQueue();

/**
 * Create and start a visual analysis job with priority
 */
export async function createAndStartVisualAnalysisJob(
  productIds?: string[],
  options: {
    priority?: number;
    autoStart?: boolean;
    skipExisting?: boolean;
  } = {}
): Promise<VisualAnalysisJob> {
  const { priority = 50, autoStart = true, skipExisting = true } = options;
  
  try {
    // Get products to analyze
    let productsToAnalyze: Product[] = [];
    
    if (productIds && productIds.length > 0) {
      // Analyze specific products
      productsToAnalyze = (await Promise.all(
        productIds.map(id => curalinaStorage.getProduct(id))
      )).filter((p): p is Product => p !== null);
    } else {
      // Analyze all products without descriptions
      const allProducts = await curalinaStorage.getAllProducts();
      productsToAnalyze = skipExisting 
        ? allProducts.filter(p => 
            !p.visualDescription && 
            !p.visualDescriptionGemini && 
            !p.visualDescriptionOpenAI &&
            p.images && 
            p.images.length > 0
          )
        : allProducts.filter(p => p.images && p.images.length > 0);
    }
    
    if (productsToAnalyze.length === 0) {
      throw new Error('No products to analyze');
    }
    
    // Create job
    const job = await curalinaStorage.createVisualAnalysisJob({
      status: 'pending',
      totalProducts: productsToAnalyze.length,
      analyzedProducts: 0,
      failedProducts: 0,
      skippedProducts: 0,
      jobType: 'manual'
    });
    
    // Create product analysis records
    const analysisProducts = productsToAnalyze.map(product => ({
      jobId: job.id,
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      status: 'pending' as const
    }));
    
    await curalinaStorage.upsertVisualAnalysisProducts(analysisProducts);
    
    // Enqueue job with priority
    jobQueue.enqueueJob(job.id, priority);
    
    // Start processing if requested
    if (autoStart) {
      // Process queue asynchronously
      setTimeout(() => {
        jobQueue.processQueue().catch(error => {
          console.error('Queue processing error:', error);
        });
      }, 0);
    }
    
    return job;
  } catch (error) {
    console.error('Failed to create visual analysis job:', error);
    throw error;
  }
}

/**
 * Resume interrupted jobs (for automatic recovery)
 */
export async function resumeInterruptedJobs(): Promise<void> {
  const activeJobs = await curalinaStorage.getActiveVisualAnalysisJobs();
  
  for (const job of activeJobs) {
    if (job.status === 'processing' || job.status === 'pending') {
      console.log(`Resuming interrupted job ${job.id}`);
      // Add with lower priority for interrupted jobs
      jobQueue.enqueueJob(job.id, 30);
    }
  }
  
  if (activeJobs.length > 0) {
    // Start processing recovered jobs
    jobQueue.processQueue().catch(error => {
      console.error('Failed to resume interrupted jobs:', error);
    });
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<void> {
  await curalinaStorage.updateVisualAnalysisJob(jobId, {
    status: 'cancelled',
    completedAt: new Date()
  });
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return jobQueue.getStatus();
}

// Auto-resume interrupted jobs on service start
resumeInterruptedJobs().catch(error => {
  console.error('Failed to resume interrupted jobs on startup:', error);
});

// =====================================================
// V1 COMPATIBILITY LAYER - For backward compatibility
// =====================================================

/**
 * Legacy adapter for V1 createVisualAnalysisJob
 * Maps old signature to new V2 implementation
 */
export async function createVisualAnalysisJob(
  userId: string | null,
  jobType: 'manual' | 'auto_after_upload',
  uploadJobId?: string | null,
  filters?: { productIds?: string[] } | null
): Promise<VisualAnalysisJob> {
  console.log('V1->V2 Adapter: Creating visual analysis job with legacy parameters');
  
  // Create job with V2 implementation
  const job = await createAndStartVisualAnalysisJob(
    filters?.productIds,
    {
      priority: jobType === 'auto_after_upload' ? 30 : 50,
      autoStart: true,
      skipExisting: true
    }
  );
  
  // Update job with V1-specific fields
  await curalinaStorage.updateVisualAnalysisJob(job.id, {
    userId,
    jobType,
    uploadJobId,
    metadata: {
      source: 'v1_adapter',
      originalUserId: userId,
      originalJobType: jobType,
      originalUploadJobId: uploadJobId
    }
  });
  
  return curalinaStorage.getVisualAnalysisJob(job.id) as Promise<VisualAnalysisJob>;
}

/**
 * Legacy adapter for V1 processVisualAnalysisJob
 * V2 automatically starts processing, so this is now a no-op
 */
export async function processVisualAnalysisJob(jobId: string): Promise<void> {
  console.log(`V1->V2 Adapter: processVisualAnalysisJob called for ${jobId} (no-op in V2)`);
  // V2 automatically processes jobs via queue, so this is a no-op
  // Job is already in the queue from createAndStartVisualAnalysisJob
}

/**
 * Legacy adapter for V1 getActiveVisualAnalysisJobs
 * Maps to V2 storage method
 */
export async function getActiveVisualAnalysisJobs(): Promise<VisualAnalysisJob[]> {
  return curalinaStorage.getActiveVisualAnalysisJobs();
}

/**
 * Legacy adapter for V1 getVisualAnalysisJobDetails
 * Enhanced with queue status in V2
 */
export async function getVisualAnalysisJobDetails(jobId: string): Promise<{
  job: VisualAnalysisJob | null;
  products: any[];
  queueStatus?: any;
}> {
  const job = await curalinaStorage.getVisualAnalysisJob(jobId);
  if (!job) {
    return { job: null, products: [] };
  }
  
  const products = await curalinaStorage.getVisualAnalysisProducts(jobId);
  const queueStatus = getQueueStatus();
  
  return {
    job,
    products,
    queueStatus
  };
}