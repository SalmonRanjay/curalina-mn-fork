/**
 * Validate if an image URL is accessible
 */
async function validateImageUrl(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok; // Returns true for 200-299 status codes
    }
    catch (error) {
        console.error(`Failed to validate image ${url}:`, error);
        return false;
    }
}
/**
 * Check if a product has at least one valid image
 */
async function hasValidImages(images) {
    if (!images || images.length === 0) {
        return false;
    }
    // Check each image URL
    const validationResults = await Promise.all(images.map(url => validateImageUrl(url)));
    // Return true if at least one image is valid
    return validationResults.some(isValid => isValid);
}
/**
 * Identify products with no valid images
 */
export async function identifyProductsToCleanup(storage, options = {}) {
    const { validateImages = false } = options;
    const allProducts = await storage.getAllProducts();
    const productsToDelete = [];
    let noImagesCount = 0;
    let allBrokenCount = 0;
    console.log(`🔍 Scanning ${allProducts.length} products for cleanup...`);
    if (validateImages) {
        console.log(`⚠️  Image validation enabled - this may take several minutes`);
    }
    for (const product of allProducts) {
        // Case 1: No images at all (null or empty array)
        if (!product.images || product.images.length === 0) {
            noImagesCount++;
            productsToDelete.push({
                id: product.id,
                sku: product.sku,
                reason: 'no_images'
            });
            continue;
        }
        // Case 2: Has images but all are broken (only if validation enabled)
        if (validateImages) {
            const hasValid = await hasValidImages(product.images);
            if (!hasValid) {
                allBrokenCount++;
                productsToDelete.push({
                    id: product.id,
                    sku: product.sku,
                    reason: 'all_images_broken'
                });
            }
        }
    }
    console.log(`📊 Found ${productsToDelete.length} products to cleanup:`);
    console.log(`   - ${noImagesCount} with no images`);
    if (validateImages) {
        console.log(`   - ${allBrokenCount} with all broken images`);
    }
    return {
        noImagesCount,
        allBrokenCount,
        productsToDelete
    };
}
/**
 * Execute cleanup - delete products with no valid images
 * Handles all foreign key relationships properly
 */
export async function executeCleanup(storage, productIds) {
    let deleted = 0;
    let failed = 0;
    const errors = [];
    const deletedRelations = {
        cart_items: 0,
        order_items: 0,
        product_functional_categories: 0,
        render_products: 0,
        upload_jobs: 0,
        visual_analysis_products: 0,
    };
    console.log(`🗑️  Starting cleanup of ${productIds.length} products...`);
    console.log(`⚠️  This will also delete all related data (cart items, orders, etc.)`);
    // Use the storage's deleteProduct method which should handle FK constraints
    // If it doesn't, we'll need to use raw SQL
    for (const id of productIds) {
        try {
            await storage.deleteProduct(id);
            deleted++;
            if (deleted % 50 === 0) {
                console.log(`   Progress: ${deleted}/${productIds.length} deleted`);
            }
        }
        catch (error) {
            // Check if this is a foreign key constraint error (Postgres error code 23503)
            const isFKError = error instanceof Error && (error.message.includes('foreign key constraint') ||
                error.code === '23503');
            if (isFKError) {
                try {
                    const relationCounts = await deleteProductWithDependencies(id);
                    // Accumulate deleted relation counts
                    deletedRelations.cart_items += relationCounts.cart_items;
                    deletedRelations.order_items += relationCounts.order_items;
                    deletedRelations.product_functional_categories += relationCounts.product_functional_categories;
                    deletedRelations.render_products += relationCounts.render_products;
                    deletedRelations.upload_jobs += relationCounts.upload_jobs;
                    deletedRelations.visual_analysis_products += relationCounts.visual_analysis_products;
                    deleted++;
                }
                catch (sqlError) {
                    failed++;
                    const errorMsg = `Failed to delete product ${id}: ${sqlError instanceof Error ? sqlError.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.error(errorMsg);
                }
            }
            else {
                failed++;
                const errorMsg = `Failed to delete product ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                errors.push(errorMsg);
                console.error(errorMsg);
            }
        }
    }
    console.log(`✅ Cleanup complete: ${deleted} deleted, ${failed} failed`);
    return { deleted, failed, errors, deletedRelations };
}
/**
 * Delete a product and all its dependencies using raw SQL
 * Returns counts of deleted related records
 */
async function deleteProductWithDependencies(productId) {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    const counts = {
        cart_items: 0,
        order_items: 0,
        product_functional_categories: 0,
        render_products: 0,
        upload_jobs: 0,
        visual_analysis_products: 0,
    };
    await db.transaction(async (tx) => {
        // Delete in correct order (children first, then parent) and track counts
        const cartResult = await tx.execute(sql `DELETE FROM cart_items WHERE product_id = ${productId}`);
        counts.cart_items = cartResult.rowCount || 0;
        const orderResult = await tx.execute(sql `DELETE FROM order_items WHERE product_id = ${productId}`);
        counts.order_items = orderResult.rowCount || 0;
        const funcCatResult = await tx.execute(sql `DELETE FROM product_functional_categories WHERE product_id = ${productId}`);
        counts.product_functional_categories = funcCatResult.rowCount || 0;
        const renderResult = await tx.execute(sql `DELETE FROM render_products WHERE product_id = ${productId}`);
        counts.render_products = renderResult.rowCount || 0;
        const uploadResult = await tx.execute(sql `DELETE FROM upload_jobs WHERE product_id = ${productId}`);
        counts.upload_jobs = uploadResult.rowCount || 0;
        const visualResult = await tx.execute(sql `DELETE FROM visual_analysis_products WHERE product_id = ${productId}`);
        counts.visual_analysis_products = visualResult.rowCount || 0;
        // Finally delete the product
        await tx.execute(sql `DELETE FROM products WHERE id = ${productId}`);
    });
    return counts;
}
//# sourceMappingURL=product-cleanup-service.js.map