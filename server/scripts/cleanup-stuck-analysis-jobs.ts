import { curalinaStorage } from '../storage-curalina';

/**
 * Cleanup script for stuck visual analysis jobs and products
 * 
 * This script:
 * 1. Fixes double-counted analyzedProducts/failedProducts by recalculating from actual product statuses
 * 2. Resets products stuck in "analyzing" status back to "pending"
 * 3. Cancels duplicate jobs, keeping only the most recent one
 */
async function cleanupStuckAnalysisJobs() {
  console.log('🧹 Starting cleanup of stuck analysis jobs...\n');
  
  try {
    // Get all processing jobs
    const allJobs = await curalinaStorage.getAllVisualAnalysisJobs();
    const processingJobs = allJobs.filter(j => j.status === 'processing');
    
    console.log(`Found ${processingJobs.length} jobs in processing status\n`);
    
    // Group jobs by total products to find duplicates
    const jobsByProductCount = new Map<number, typeof processingJobs>();
    for (const job of processingJobs) {
      const count = job.totalProducts || 0;
      if (!jobsByProductCount.has(count)) {
        jobsByProductCount.set(count, []);
      }
      jobsByProductCount.get(count)!.push(job);
    }
    
    // Cancel duplicate jobs (keep most recent)
    let cancelledCount = 0;
    for (const [productCount, jobs] of jobsByProductCount.entries()) {
      if (jobs.length > 1) {
        console.log(`Found ${jobs.length} duplicate jobs for ${productCount} products`);
        
        // Sort by creation date, keep the most recent
        jobs.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        const [keepJob, ...cancelJobs] = jobs;
        console.log(`  Keeping job: ${keepJob.id}`);
        
        for (const job of cancelJobs) {
          console.log(`  Cancelling duplicate job: ${job.id}`);
          await curalinaStorage.updateVisualAnalysisJob(job.id, {
            status: 'cancelled'
          });
          cancelledCount++;
        }
      }
    }
    
    console.log(`\n✅ Cancelled ${cancelledCount} duplicate jobs\n`);
    
    // Fix each remaining processing job
    const remainingProcessingJobs = allJobs.filter(j => j.status === 'processing');
    
    for (const job of remainingProcessingJobs) {
      console.log(`\n📊 Processing job ${job.id}:`);
      
      // Get all products for this job
      const products = await curalinaStorage.getVisualAnalysisProducts(job.id);
      
      // Count by status
      const statusCounts = {
        pending: products.filter(p => p.status === 'pending').length,
        analyzing: products.filter(p => p.status === 'analyzing').length,
        completed: products.filter(p => p.status === 'completed').length,
        failed: products.filter(p => p.status === 'failed').length,
        skipped: products.filter(p => p.status === 'skipped').length,
      };
      
      console.log('  Current status:');
      console.log(`    Pending: ${statusCounts.pending}`);
      console.log(`    Analyzing: ${statusCounts.analyzing}`);
      console.log(`    Completed: ${statusCounts.completed}`);
      console.log(`    Failed: ${statusCounts.failed}`);
      console.log(`    Skipped: ${statusCounts.skipped}`);
      console.log(`    Job's analyzedProducts: ${job.analyzedProducts}`);
      console.log(`    Job's failedProducts: ${job.failedProducts}`);
      
      // Reset stuck "analyzing" products back to "pending"
      if (statusCounts.analyzing > 0) {
        console.log(`  ⚠️ Resetting ${statusCounts.analyzing} stuck products from "analyzing" to "pending"`);
        const analyzingProducts = products.filter(p => p.status === 'analyzing');
        
        for (const product of analyzingProducts) {
          await curalinaStorage.updateVisualAnalysisProduct(product.id, {
            status: 'pending',
            errorMessage: null
          });
        }
        
        // Update counts
        statusCounts.pending += statusCounts.analyzing;
        statusCounts.analyzing = 0;
      }
      
      // Fix double-counted analyzedProducts and failedProducts
      const correctAnalyzedCount = statusCounts.completed;
      const correctFailedCount = statusCounts.failed;
      
      if (job.analyzedProducts !== correctAnalyzedCount || job.failedProducts !== correctFailedCount) {
        console.log(`  🔧 Fixing counts:`);
        console.log(`    analyzedProducts: ${job.analyzedProducts} → ${correctAnalyzedCount}`);
        console.log(`    failedProducts: ${job.failedProducts} → ${correctFailedCount}`);
        
        await curalinaStorage.updateVisualAnalysisJob(job.id, {
          analyzedProducts: correctAnalyzedCount,
          failedProducts: correctFailedCount,
          skippedProducts: statusCounts.skipped
        });
      }
      
      // If all products are done, mark job as completed
      if (statusCounts.pending === 0 && statusCounts.analyzing === 0) {
        console.log(`  ✅ All products processed - marking job as completed`);
        await curalinaStorage.updateVisualAnalysisJob(job.id, {
          status: 'completed',
          completedAt: new Date()
        });
      } else {
        console.log(`  ℹ️ Job still has ${statusCounts.pending} pending products - leaving as processing`);
      }
    }
    
    console.log('\n✅ Cleanup complete!\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Run the cleanup
cleanupStuckAnalysisJobs()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
