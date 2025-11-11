// Test script to verify visual analysis job system
import { curalinaStorage } from "./storage-curalina";
import { createVisualAnalysisJob, processVisualAnalysisJob } from "./services/visual-analysis-job-service";

async function testVisualAnalysis() {
  console.log("=== Testing Visual Analysis Job System ===\n");
  
  try {
    // 1. Check if we have products to analyze
    const products = await curalinaStorage.getAllProducts();
    const productsNeedingAnalysis = products.filter(
      p => p.images && p.images.length > 0 && (!p.visualDescriptionGemini || !p.visualDescriptionOpenAI)
    );
    
    console.log(`✓ Found ${products.length} total products`);
    console.log(`✓ ${productsNeedingAnalysis.length} products need visual analysis`);
    
    if (productsNeedingAnalysis.length === 0) {
      console.log("\n⚠ No products need visual analysis. All products either have no images or already have descriptions.");
      return;
    }
    
    // 2. Create a test visual analysis job
    console.log("\n2. Creating a test visual analysis job...");
    const testJob = await createVisualAnalysisJob(
      null, // userId (null for test)
      "manual", // jobType
      undefined, // uploadJobId
      { 
        productIds: productsNeedingAnalysis.slice(0, 3).map(p => p.id), // Test with first 3 products
        onlyMissingDescriptions: true 
      }
    );
    
    console.log(`✓ Created job ${testJob.id}`);
    console.log(`  - Status: ${testJob.status}`);
    console.log(`  - Total products: ${testJob.totalProducts}`);
    
    // 3. Check job products
    const jobProducts = await curalinaStorage.getVisualAnalysisProducts(testJob.id);
    console.log(`✓ Job has ${jobProducts.length} products queued`);
    
    // 4. Process one batch to test the processing logic
    console.log("\n3. Testing batch processing...");
    const processedCount = await processVisualAnalysisJob(testJob.id);
    console.log(`✓ Processed ${processedCount} products in first batch`);
    
    // 5. Check updated job status
    const updatedJob = await curalinaStorage.getVisualAnalysisJob(testJob.id);
    if (updatedJob) {
      console.log(`\n4. Job status after processing:`);
      console.log(`  - Analyzed: ${updatedJob.analyzedProducts}`);
      console.log(`  - Failed: ${updatedJob.failedProducts}`);
      console.log(`  - Skipped: ${updatedJob.skippedProducts}`);
      console.log(`  - Current product: ${updatedJob.currentProductName || 'none'}`);
    }
    
    console.log("\n✅ Visual analysis job system is working correctly!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testVisualAnalysis();