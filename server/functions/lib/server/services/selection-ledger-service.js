import crypto from 'crypto';
/**
 * Generate deterministic hash for idempotency check
 * Hash inputs: quiz responses + candidate product pool + timestamp seed
 */
export function generateSelectionHash(quizResponse, candidatePool) {
    // Create deterministic input by sorting products by SKU
    const sortedSkus = candidatePool
        .map(p => p.sku)
        .sort()
        .join(',');
    // Combine quiz parameters (order matters)
    const quizFingerprint = [
        quizResponse.roomType,
        quizResponse.style,
        (quizResponse.colorPalettes || []).sort().join(','),
        (quizResponse.keyFeatures || []).sort().join(','),
        quizResponse.budgetRange,
    ].join('|');
    // Create hash input
    const hashInput = `${quizFingerprint}::${sortedSkus}`;
    // Generate SHA-256 hash
    return crypto
        .createHash('sha256')
        .update(hashInput)
        .digest('hex');
}
/**
 * Create candidate pool snapshot from products
 */
export function createCandidatePoolSnapshot(products) {
    return products.map(p => ({
        sku: p.sku,
        name: p.name,
        category: p.categoryId || 'Uncategorized',
        price: parseFloat(p.price || '0'),
        inStock: p.availability === 'in_stock',
        hasValidImage: !!(p.images && p.images.length > 0),
        hasVisualDescription: !!p.visualDescription,
    }));
}
/**
 * Initialize empty selection rationale
 */
export function initializeSelectionRationale() {
    return {
        essentials: {},
        complementary: {},
        excluded: [],
        diversityScore: 0,
    };
}
/**
 * Add selection to rationale
 */
export function recordSelection(rationale, category, isEssential, product, reason, rules) {
    const target = isEssential ? rationale.essentials : rationale.complementary;
    if (!target[category]) {
        target[category] = {
            category,
            selectedProducts: [],
            rulesApplied: rules,
        };
    }
    target[category].selectedProducts.push({
        sku: product.sku,
        name: product.name,
        reason,
    });
}
/**
 * Record excluded product
 */
export function recordExclusion(rationale, product, reason) {
    rationale.excluded.push({
        sku: product.sku,
        name: product.name,
        reason,
    });
}
/**
 * Calculate diversity score based on category distribution
 */
export function calculateDiversityScore(rationale) {
    const totalCategories = Object.keys(rationale.essentials).length +
        Object.keys(rationale.complementary).length;
    if (totalCategories === 0)
        return 0;
    const totalProducts = Object.values(rationale.essentials).reduce((sum, cat) => sum + cat.selectedProducts.length, 0) +
        Object.values(rationale.complementary).reduce((sum, cat) => sum + cat.selectedProducts.length, 0);
    // Score: more categories with fewer products each = better diversity
    // Perfect score (100) = 10 categories with 1 product each
    // Good score (70-90) = 5-7 categories with 1-2 products each
    const avgProductsPerCategory = totalProducts / totalCategories;
    const categoryDiversity = Math.min(totalCategories / 10, 1) * 50;
    const productDistribution = Math.max(0, (2 - avgProductsPerCategory) / 2) * 50;
    return Math.round(categoryDiversity + productDistribution);
}
/**
 * Generate composition order (essentials first, then complementary, then decor)
 */
export function generateCompositionOrder(rationale) {
    const order = [];
    // Priority categories (essentials come first)
    const essentialCategories = ['primary_seating', 'coffee_table', 'bed', 'dining_table', 'desk'];
    // Add essentials in priority order
    essentialCategories.forEach(category => {
        if (rationale.essentials[category]) {
            rationale.essentials[category].selectedProducts.forEach(p => {
                order.push(p.sku);
            });
        }
    });
    // Add other essentials
    Object.values(rationale.essentials).forEach(catData => {
        if (!essentialCategories.includes(catData.category)) {
            catData.selectedProducts.forEach(p => {
                if (!order.includes(p.sku)) {
                    order.push(p.sku);
                }
            });
        }
    });
    // Add complementary (accent seating, storage, lighting)
    const complementaryOrder = ['accent_seating', 'side_table', 'storage', 'lighting'];
    complementaryOrder.forEach(category => {
        if (rationale.complementary[category]) {
            rationale.complementary[category].selectedProducts.forEach(p => {
                if (!order.includes(p.sku)) {
                    order.push(p.sku);
                }
            });
        }
    });
    // Add remaining complementary (decor, etc.)
    Object.values(rationale.complementary).forEach(catData => {
        if (!complementaryOrder.includes(catData.category)) {
            catData.selectedProducts.forEach(p => {
                if (!order.includes(p.sku)) {
                    order.push(p.sku);
                }
            });
        }
    });
    return order;
}
//# sourceMappingURL=selection-ledger-service.js.map