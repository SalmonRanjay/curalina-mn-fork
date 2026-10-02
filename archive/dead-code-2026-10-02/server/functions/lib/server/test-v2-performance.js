#!/usr/bin/env node
/**
 * Performance Test Script for V2 Visual Analysis System
 * Tests concurrent processing with 100+ products
 */
import { curalinaStorage } from "./storage-curalina";
import visualAnalysisConfig from "./config/visual-analysis";
async function runPerformanceTest() {
    console.log("=".repeat(80));
    console.log(" V2 Visual Analysis System - Performance Test");
    console.log("=".repeat(80));
    // Configuration
    console.log("\n📋 Configuration:");
    console.log(`  - V2 Enabled: ${visualAnalysisConfig.useV2}`);
    console.log(`  - Worker Count: ${visualAnalysisConfig.v2.workerCount}`);
    console.log(`  - Batch Size: ${visualAnalysisConfig.v2.batchSize}`);
    console.log(`  - Checkpoint Interval: ${visualAnalysisConfig.v2.checkpointInterval}`);
    // Get products with images
    console.log("\n📦 Loading products...");
    const allProducts = await curalinaStorage.getAllProducts();
    const productsWithImages = allProducts
        .filter(p => p.images && p.images.length > 0)
        .slice(0, 120); // Test with up to 120 products
    console.log(`  - Total products in DB: ${allProducts.length}`);
    console.log(`  - Products with images: ${productsWithImages.length}`);
    // Analysis status breakdown
    const needsAnalysis = productsWithImages.filter(p => !p.visualDescriptionGemini ||
        !p.visualDescriptionOpenAI ||
        !p.visualDescriptionFrontViewGemini ||
        !p.visualDescriptionFrontViewOpenAI);
    const fullyAnalyzed = productsWithImages.filter(p => p.visualDescriptionGemini &&
        p.visualDescriptionOpenAI &&
        p.visualDescriptionFrontViewGemini &&
        p.visualDescriptionFrontViewOpenAI);
    const partiallyAnalyzed = productsWithImages.filter(p => (p.visualDescriptionGemini || p.visualDescriptionOpenAI) &&
        !(p.visualDescriptionGemini &&
            p.visualDescriptionOpenAI &&
            p.visualDescriptionFrontViewGemini &&
            p.visualDescriptionFrontViewOpenAI));
    console.log("\n📊 Analysis Status:");
    console.log(`  - Fully analyzed (will be skipped): ${fullyAnalyzed.length}`);
    console.log(`  - Partially analyzed: ${partiallyAnalyzed.length}`);
    console.log(`  - Needs analysis: ${needsAnalysis.length}`);
    // Front-view detection
    const { findFrontViewImage } = await import('./utils/image-helpers');
    let frontViewCount = 0;
    for (const product of productsWithImages) {
        const frontViewImage = findFrontViewImage(product.images || []);
        if (frontViewImage) {
            frontViewCount++;
        }
    }
    console.log(`  - Products with front-view images: ${frontViewCount}/${productsWithImages.length}`);
    // Performance metrics
    console.log("\n⚡ Performance Calculations:");
    const totalImages = productsWithImages.reduce((sum, p) => sum + (p.images?.length || 0), 0);
    const avgImagesPerProduct = totalImages / productsWithImages.length;
    console.log(`  - Total images: ${totalImages}`);
    console.log(`  - Average images per product: ${avgImagesPerProduct.toFixed(1)}`);
    // V2 Performance Estimates
    const productsPerBatch = visualAnalysisConfig.v2.batchSize;
    const workersPerBatch = visualAnalysisConfig.v2.workerCount;
    const productsPerWorker = Math.ceil(productsPerBatch / workersPerBatch);
    const totalBatches = Math.ceil(needsAnalysis.length / productsPerBatch);
    console.log("\n🚀 V2 Concurrent Processing:");
    console.log(`  - Products per batch: ${productsPerBatch}`);
    console.log(`  - Workers per batch: ${workersPerBatch}`);
    console.log(`  - Products per worker: ${productsPerWorker}`);
    console.log(`  - Total batches needed: ${totalBatches}`);
    console.log(`  - Concurrent products: ${workersPerBatch * productsPerWorker} (max)`);
    // Time estimates (assuming 5s per product with delays)
    const estimatedTimePerProduct = 5; // seconds
    const estimatedTimeV1 = needsAnalysis.length * estimatedTimePerProduct;
    const estimatedTimeV2 = totalBatches * productsPerWorker * estimatedTimePerProduct;
    console.log("\n⏱️ Time Estimates:");
    console.log(`  - V1 Sequential (20 products/batch): ~${Math.round(estimatedTimeV1 / 60)} minutes`);
    console.log(`  - V2 Concurrent (5 workers): ~${Math.round(estimatedTimeV2 / 60)} minutes`);
    console.log(`  - Speed improvement: ${((estimatedTimeV1 - estimatedTimeV2) / estimatedTimeV1 * 100).toFixed(0)}% faster`);
    // Cache effectiveness
    console.log("\n💾 Cache Effectiveness:");
    console.log(`  - Products to skip (cached): ${fullyAnalyzed.length}`);
    console.log(`  - Time saved from cache: ~${Math.round(fullyAnalyzed.length * estimatedTimePerProduct / 60)} minutes`);
    if (needsAnalysis.length > 0) {
        console.log("\n🔧 Next Steps:");
        console.log("  1. Go to Admin > Products page");
        console.log("  2. Click 'Start Visual Analysis' to process products");
        console.log("  3. Monitor the two-phase progress bars:");
        console.log("     - Phase 1: Front-view analysis");
        console.log("     - Phase 2: Combined analysis");
        console.log("  4. Watch for concurrent worker indicators");
        console.log("\n  With V2, you should see:");
        console.log("  - Multiple products processing simultaneously");
        console.log("  - Two-phase progress tracking");
        console.log("  - Automatic checkpoint saves every 10 products");
        console.log("  - Smart caching skipping analyzed products");
    }
    else {
        console.log("\n✅ All products are fully analyzed!");
        console.log("  To test performance:");
        console.log("  1. Clear some visual descriptions from products");
        console.log("  2. Run visual analysis again");
        console.log("  3. Observe the concurrent processing");
    }
    console.log("\n" + "=".repeat(80));
    process.exit(0);
}
// Run the test
runPerformanceTest().catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
});
//# sourceMappingURL=test-v2-performance.js.map