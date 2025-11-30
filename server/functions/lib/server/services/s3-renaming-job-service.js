import { curalinaStorage } from '../storage-curalina';
import { renameS3Object, checkS3ObjectExists } from '../s3';
/**
 * Extract and normalize S3 key from URL
 */
function extractS3Key(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1);
    }
    catch {
        return url;
    }
}
/**
 * Fully decode a key recursively
 */
function fullyDecodeKey(key) {
    let decoded = key;
    let prev;
    do {
        prev = decoded;
        try {
            decoded = decodeURIComponent(decoded);
        }
        catch {
            break;
        }
    } while (decoded !== prev && /%[0-9A-Fa-f]{2}/.test(decoded));
    return decoded;
}
/**
 * Check if key needs normalization (has spaces, +, or % sequences)
 */
function needsNormalization(key) {
    return /[\s+%]/.test(key);
}
/**
 * Normalize key by replacing spaces, +, and % with dashes
 */
function normalizeKey(key) {
    return key
        .replace(/%/g, '-')
        .replace(/[\s+]+/g, '-')
        .replace(/-+/g, '-');
}
class S3RenamingJobQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.checkpointInterval = 10; // Save progress every 10 products
        this.maxRetries = 3;
    }
    /**
     * Add a job to the priority queue
     */
    enqueueJob(jobId, priority = 0) {
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
     * Sort queue by priority (higher priority first)
     */
    sortQueue() {
        this.queue.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Process the queue
     */
    async processQueue() {
        if (this.processing) {
            console.log('[S3-JOB-QUEUE] Queue already processing');
            return;
        }
        this.processing = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (!job)
                break;
            try {
                await this.processJob(job);
            }
            catch (error) {
                console.error(`[S3-JOB-QUEUE] Failed to process job ${job.jobId}:`, error);
                // Re-queue with lower priority if retries remaining
                if (job.retryCount < this.maxRetries) {
                    job.retryCount++;
                    job.priority -= 10;
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
    async processJob(jobPriority) {
        const job = await curalinaStorage.getS3RenamingJob(jobPriority.jobId);
        if (!job || job.status === 'completed' || job.status === 'cancelled') {
            return;
        }
        console.log(`\n🔄 [S3-JOB] Processing job ${job.id} (Priority: ${jobPriority.priority}, Retry: ${jobPriority.retryCount})`);
        // Mark job as processing
        await curalinaStorage.updateS3RenamingJob(job.id, {
            status: 'processing'
        });
        let processedCount = 0;
        let errorCount = 0;
        let successCount = 0;
        let processedSinceLastCheckpoint = 0;
        const startTime = Date.now();
        try {
            // Get pending products for this job
            const pendingProducts = await curalinaStorage.getPendingS3RenamingProducts(job.id, 100);
            if (pendingProducts.length === 0) {
                // No pending products, mark job as completed
                await this.completeJob(job.id);
                return;
            }
            console.log(`[S3-JOB] Found ${pendingProducts.length} pending products to process`);
            // Process products one by one (S3 operations are I/O bound, not CPU bound)
            for (const renamingProduct of pendingProducts) {
                try {
                    // Update current product name
                    await curalinaStorage.updateS3RenamingJob(job.id, {
                        currentProductName: renamingProduct.productName
                    });
                    // Mark product as processing
                    await curalinaStorage.updateS3RenamingProduct(renamingProduct.id, {
                        status: 'processing'
                    });
                    // Get full product data
                    const product = await curalinaStorage.getProduct(renamingProduct.productId);
                    if (!product || !product.images || product.images.length === 0) {
                        await curalinaStorage.updateS3RenamingProduct(renamingProduct.id, {
                            status: 'skipped',
                            errorMessage: 'Product not found or has no images',
                            processedAt: new Date()
                        });
                        processedCount++;
                        continue;
                    }
                    // Process images for this product
                    const oldImages = [...product.images];
                    const newImages = [];
                    let renamedCount = 0;
                    for (const imageUrl of product.images) {
                        const wasFullUrl = imageUrl.startsWith('https://');
                        const rawKey = extractS3Key(imageUrl);
                        // Build decoding path
                        const decodingPath = [rawKey];
                        let current = rawKey;
                        while (true) {
                            try {
                                const decoded = decodeURIComponent(current);
                                if (decoded === current)
                                    break;
                                decodingPath.push(decoded);
                                current = decoded;
                            }
                            catch {
                                break;
                            }
                        }
                        const canonicalKey = decodingPath[decodingPath.length - 1];
                        // Check if normalization needed
                        if (!needsNormalization(canonicalKey)) {
                            newImages.push(imageUrl);
                            continue;
                        }
                        // Find which variant exists in S3
                        let existingKey = null;
                        if (!job.dryRun) {
                            for (let i = decodingPath.length - 1; i >= 0; i--) {
                                if (await checkS3ObjectExists(decodingPath[i])) {
                                    existingKey = decodingPath[i];
                                    break;
                                }
                            }
                            if (!existingKey) {
                                console.warn(`[S3-JOB] Source not found: ${rawKey}`);
                                newImages.push(imageUrl);
                                continue;
                            }
                        }
                        else {
                            existingKey = canonicalKey;
                        }
                        // Normalize the key
                        const normalizedKey = normalizeKey(canonicalKey);
                        if (existingKey === normalizedKey) {
                            newImages.push(imageUrl);
                            continue;
                        }
                        console.log(`[S3-JOB] ${product.name}: ${existingKey} -> ${normalizedKey}`);
                        if (!job.dryRun) {
                            // Check if destination already exists
                            const destExists = await checkS3ObjectExists(normalizedKey);
                            if (destExists) {
                                console.log(`[S3-JOB] Destination exists, skipping rename`);
                                const finalUrl = wasFullUrl ? `https://curalina.s3.us-east-1.amazonaws.com/${normalizedKey}` : normalizedKey;
                                newImages.push(finalUrl);
                                renamedCount++;
                                continue;
                            }
                            // Perform rename
                            await renameS3Object(existingKey, normalizedKey);
                            console.log(`[S3-JOB] ✅ Renamed successfully`);
                            renamedCount++;
                        }
                        const finalUrl = wasFullUrl ? `https://curalina.s3.us-east-1.amazonaws.com/${normalizedKey}` : normalizedKey;
                        newImages.push(finalUrl);
                    }
                    // Update product in database if there were changes
                    if (renamedCount > 0 && !job.dryRun) {
                        await curalinaStorage.updateProduct(product.id, {
                            images: newImages
                        });
                    }
                    // Mark product as completed
                    await curalinaStorage.updateS3RenamingProduct(renamingProduct.id, {
                        status: 'completed',
                        oldImages: oldImages,
                        newImages: newImages,
                        renamedCount: renamedCount,
                        processedAt: new Date()
                    });
                    if (renamedCount > 0) {
                        successCount++;
                    }
                    processedCount++;
                    processedSinceLastCheckpoint++;
                    // Save checkpoint periodically
                    if (processedSinceLastCheckpoint >= this.checkpointInterval) {
                        await this.saveCheckpoint(job.id, processedCount, successCount, errorCount);
                        processedSinceLastCheckpoint = 0;
                    }
                }
                catch (error) {
                    errorCount++;
                    console.error(`[S3-JOB] Error processing product ${renamingProduct.productName}:`, error);
                    await curalinaStorage.updateS3RenamingProduct(renamingProduct.id, {
                        status: 'failed',
                        errorMessage: error instanceof Error ? error.message : 'Unknown error',
                        processedAt: new Date()
                    });
                    processedCount++;
                    processedSinceLastCheckpoint++;
                }
            }
            // Final checkpoint and completion
            await this.saveCheckpoint(job.id, processedCount, successCount, errorCount);
            await this.completeJob(job.id);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n✅ [S3-JOB] Job ${job.id} completed in ${duration}s`);
            console.log(`   Processed: ${processedCount}, Successful: ${successCount}, Errors: ${errorCount}`);
        }
        catch (error) {
            console.error(`[S3-JOB] Fatal error processing job ${job.id}:`, error);
            await curalinaStorage.updateS3RenamingJob(job.id, {
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Save checkpoint progress
     */
    async saveCheckpoint(jobId, processed, successful, failed) {
        await curalinaStorage.updateS3RenamingJob(jobId, {
            processedProducts: processed,
            successfulRenames: successful,
            failedRenames: failed,
            updatedAt: new Date()
        });
    }
    /**
     * Mark job as completed
     */
    async completeJob(jobId) {
        const job = await curalinaStorage.getS3RenamingJob(jobId);
        if (!job)
            return;
        // Count final statistics
        const allProducts = await curalinaStorage.getS3RenamingProducts(jobId);
        const completed = allProducts.filter(p => p.status === 'completed').length;
        const failed = allProducts.filter(p => p.status === 'failed').length;
        const totalRenames = allProducts.reduce((sum, p) => sum + (p.renamedCount || 0), 0);
        await curalinaStorage.updateS3RenamingJob(jobId, {
            status: 'completed',
            completedAt: new Date(),
            processedProducts: allProducts.length,
            successfulRenames: totalRenames,
            failedRenames: failed
        });
        console.log(`✅ [S3-JOB] Job ${jobId} marked as completed`);
    }
    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            jobs: [...this.queue]
        };
    }
}
// Singleton queue instance
const jobQueue = new S3RenamingJobQueue();
/**
 * Create and start an S3 renaming job with priority
 */
export async function createAndStartS3RenamingJob(productIds, options = {}) {
    const { priority = 0, autoStart = true, dryRun = false, userId } = options;
    // Get products to process
    let products;
    if (productIds && productIds.length > 0) {
        products = (await Promise.all(productIds.map(id => curalinaStorage.getProduct(id)))).filter((p) => p !== undefined);
    }
    else {
        products = await curalinaStorage.getAllProducts();
    }
    // Filter to products with images that need normalization
    const productsNeedingRename = products.filter(p => p.images && p.images.length > 0 &&
        p.images.some(img => {
            const key = extractS3Key(img);
            const decoded = fullyDecodeKey(key);
            return needsNormalization(decoded);
        }));
    console.log(`[S3-JOB] Creating job for ${productsNeedingRename.length}/${products.length} products`);
    // Create job record
    const job = await curalinaStorage.createS3RenamingJob({
        userId,
        status: 'pending',
        totalProducts: productsNeedingRename.length,
        processedProducts: 0,
        successfulRenames: 0,
        failedRenames: 0,
        dryRun
    });
    // Create product records
    const productRecords = productsNeedingRename.map(p => ({
        jobId: job.id,
        productId: p.id,
        productSku: p.sku,
        productName: p.name,
        status: 'pending',
        renamedCount: 0
    }));
    if (productRecords.length > 0) {
        await curalinaStorage.createS3RenamingProducts(productRecords);
    }
    // Enqueue job
    jobQueue.enqueueJob(job.id, priority);
    // Start processing if autoStart enabled
    if (autoStart && !jobQueue.getStatus().processing) {
        console.log(`[S3-JOB] Auto-starting job processing for job ${job.id}`);
        // Don't await - let it run in background
        jobQueue.processQueue().catch(error => {
            console.error('[S3-JOB] Queue processing error:', error);
        });
    }
    return job;
}
/**
 * Resume interrupted jobs on server startup
 */
export async function resumeInterruptedS3Jobs() {
    const interruptedJobs = await curalinaStorage.getActiveS3RenamingJobs();
    if (interruptedJobs.length === 0) {
        console.log('[S3-JOB] No interrupted jobs to resume');
        return;
    }
    console.log(`[S3-JOB] Resuming ${interruptedJobs.length} interrupted jobs`);
    // Reset processing jobs to pending and re-queue with lower priority
    for (const job of interruptedJobs) {
        if (job.status === 'processing') {
            await curalinaStorage.updateS3RenamingJob(job.id, {
                status: 'pending'
            });
        }
        // Re-queue with lower priority (interrupted jobs get lower priority)
        jobQueue.enqueueJob(job.id, -10);
    }
    // Start processing
    jobQueue.processQueue().catch(error => {
        console.error('[S3-JOB] Resume processing error:', error);
    });
}
/**
 * Get job queue status
 */
export function getS3JobQueueStatus() {
    return jobQueue.getStatus();
}
/**
 * Get job details with product progress
 */
export async function getS3JobDetails(jobId) {
    const job = await curalinaStorage.getS3RenamingJob(jobId);
    if (!job)
        return null;
    const products = await curalinaStorage.getS3RenamingProducts(jobId);
    return {
        ...job,
        products: products.map(p => ({
            id: p.id,
            productName: p.productName,
            productSku: p.productSku,
            status: p.status,
            renamedCount: p.renamedCount,
            errorMessage: p.errorMessage
        }))
    };
}
// Auto-resume interrupted jobs on service start
resumeInterruptedS3Jobs().catch(error => {
    console.error('[S3-JOB] Failed to resume interrupted jobs on startup:', error);
});
//# sourceMappingURL=s3-renaming-job-service.js.map