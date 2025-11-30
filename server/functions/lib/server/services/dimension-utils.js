/**
 * Dimension Utilities for AI Rendering Pipeline
 *
 * Provides dimension normalization, category-specific filtering,
 * and AI-optimized prompt generation for accurate furniture renders.
 */
/**
 * Category-to-dimension mapping
 * Defines which dimensions are relevant for each furniture category
 */
const CATEGORY_DIMENSION_MAP = {
    // Seating furniture
    'sofas': ['width', 'depth', 'height', 'seatWidth', 'seatDepth', 'seatHeight', 'armWidth', 'armDepth'],
    'chairs': ['width', 'depth', 'height', 'seatWidth', 'seatDepth', 'seatHeight', 'armWidth', 'armDepth'],
    'sectionals': ['width', 'depth', 'height', 'seatWidth', 'seatDepth', 'seatHeight', 'armWidth', 'armDepth'],
    'recliners': ['width', 'depth', 'height', 'seatWidth', 'seatDepth', 'seatHeight', 'armWidth', 'armDepth'],
    'benches': ['width', 'depth', 'height', 'seatHeight'],
    'ottomans': ['width', 'depth', 'height', 'seatHeight'],
    // Tables
    'tables': ['width', 'depth', 'height', 'legBaseDepth1', 'legBaseHeight1', 'legBaseWidth1', 'tabletopThickness', 'shapeType'],
    'dining tables': ['width', 'depth', 'height', 'legBaseDepth1', 'legBaseHeight1', 'legBaseWidth1', 'tabletopThickness', 'shapeType'],
    'coffee tables': ['width', 'depth', 'height', 'legBaseDepth1', 'legBaseHeight1', 'legBaseWidth1', 'tabletopThickness', 'shapeType'],
    'side tables': ['width', 'depth', 'height', 'legBaseDepth1', 'legBaseHeight1', 'legBaseWidth1', 'tabletopThickness', 'shapeType'],
    'console tables': ['width', 'depth', 'height', 'legBaseDepth1', 'legBaseHeight1', 'legBaseWidth1', 'tabletopThickness'],
    'desks': ['width', 'depth', 'height', 'legBaseDepth1', 'legBaseHeight1', 'legBaseWidth1', 'tabletopThickness'],
    // Storage/Cabinets
    'cabinets': ['width', 'depth', 'height', 'doorWidth', 'doorHeight', 'doorThickness', 'volume'],
    'dressers': ['width', 'depth', 'height', 'volume'],
    'wardrobes': ['width', 'depth', 'height', 'doorWidth', 'doorHeight', 'doorThickness', 'volume'],
    'bookcases': ['width', 'depth', 'height', 'volume'],
    'shelving': ['width', 'depth', 'height', 'volume'],
    'credenzas': ['width', 'depth', 'height', 'doorWidth', 'doorHeight', 'volume'],
    'buffets': ['width', 'depth', 'height', 'doorWidth', 'doorHeight', 'volume'],
    // Beds
    'beds': ['width', 'depth', 'height'],
    // Accent pieces
    'mirrors': ['width', 'height'],
    'rugs': ['width', 'depth', 'shapeType'],
    'lighting': ['width', 'height'],
    // Default fallback
    'default': ['width', 'depth', 'height']
};
/**
 * Normalize dimension data from JSONB to standardized format
 * Handles missing fields, type conversions, and unit normalization
 */
export function normalizeDimensions(product) {
    if (!product.dimensions || typeof product.dimensions !== 'object') {
        return null;
    }
    const dims = product.dimensions;
    // Helper to get value from either legacy (w) or normalized (width) keys
    const getDimValue = (shortKey, longKey) => {
        const value = dims[longKey] ?? dims[shortKey];
        return value !== undefined && value !== null ? parseFloat(value) : undefined;
    };
    // Extract and normalize all dimension fields
    const normalized = {
        unit: dims.unit || 'inches'
    };
    // Core dimensions (support both w/d/h and width/depth/height)
    const width = getDimValue('w', 'width');
    const depth = getDimValue('d', 'depth');
    const height = getDimValue('h', 'height');
    if (width !== undefined)
        normalized.width = width;
    if (depth !== undefined)
        normalized.depth = depth;
    if (height !== undefined)
        normalized.height = height;
    // Seating dimensions
    if (dims.seatWidth !== undefined && dims.seatWidth !== null)
        normalized.seatWidth = parseFloat(dims.seatWidth);
    if (dims.seatDepth !== undefined && dims.seatDepth !== null)
        normalized.seatDepth = parseFloat(dims.seatDepth);
    if (dims.seatHeight !== undefined && dims.seatHeight !== null)
        normalized.seatHeight = parseFloat(dims.seatHeight);
    if (dims.armWidth !== undefined && dims.armWidth !== null)
        normalized.armWidth = parseFloat(dims.armWidth);
    if (dims.armDepth !== undefined && dims.armDepth !== null)
        normalized.armDepth = parseFloat(dims.armDepth);
    // Cabinet/Storage dimensions
    if (dims.doorWidth !== undefined && dims.doorWidth !== null)
        normalized.doorWidth = parseFloat(dims.doorWidth);
    if (dims.doorHeight !== undefined && dims.doorHeight !== null)
        normalized.doorHeight = parseFloat(dims.doorHeight);
    if (dims.doorThickness !== undefined && dims.doorThickness !== null)
        normalized.doorThickness = parseFloat(dims.doorThickness);
    if (dims.volume !== undefined && dims.volume !== null)
        normalized.volume = parseFloat(dims.volume);
    // Table dimensions
    if (dims.legBaseDepth1 !== undefined && dims.legBaseDepth1 !== null)
        normalized.legBaseDepth1 = parseFloat(dims.legBaseDepth1);
    if (dims.legBaseHeight1 !== undefined && dims.legBaseHeight1 !== null)
        normalized.legBaseHeight1 = parseFloat(dims.legBaseHeight1);
    if (dims.legBaseWidth1 !== undefined && dims.legBaseWidth1 !== null)
        normalized.legBaseWidth1 = parseFloat(dims.legBaseWidth1);
    if (dims.tabletopThickness !== undefined && dims.tabletopThickness !== null)
        normalized.tabletopThickness = parseFloat(dims.tabletopThickness);
    // Additional attributes
    if (dims.shapeType)
        normalized.shapeType = dims.shapeType;
    // Check if we have at least one dimension
    const hasAnyDimension = Object.keys(normalized).some(key => key !== 'unit' && key !== 'shapeType');
    return hasAnyDimension ? normalized : null;
}
/**
 * Detect furniture category from product data
 * Used to determine which dimensions are relevant
 */
export function detectFurnitureCategory(product) {
    // Check product name and description for category keywords
    const searchText = `${product.name || ''} ${product.description || ''}`.toLowerCase();
    // Priority order matters - more specific categories first
    const categoryKeywords = [
        { category: 'sectionals', keywords: ['sectional'] },
        { category: 'recliners', keywords: ['recliner'] },
        { category: 'dining tables', keywords: ['dining table'] },
        { category: 'coffee tables', keywords: ['coffee table'] },
        { category: 'side tables', keywords: ['side table', 'end table', 'nightstand'] },
        { category: 'console tables', keywords: ['console table', 'console'] },
        { category: 'sofas', keywords: ['sofa', 'couch', 'loveseat'] },
        { category: 'chairs', keywords: ['chair', 'armchair', 'accent chair'] },
        { category: 'benches', keywords: ['bench'] },
        { category: 'ottomans', keywords: ['ottoman', 'pouf'] },
        { category: 'tables', keywords: ['table'] },
        { category: 'desks', keywords: ['desk'] },
        { category: 'wardrobes', keywords: ['wardrobe', 'armoire'] },
        { category: 'dressers', keywords: ['dresser', 'chest of drawers'] },
        { category: 'cabinets', keywords: ['cabinet'] },
        { category: 'bookcases', keywords: ['bookcase', 'bookshelf'] },
        { category: 'shelving', keywords: ['shelf', 'shelving', 'shelves'] },
        { category: 'credenzas', keywords: ['credenza'] },
        { category: 'buffets', keywords: ['buffet', 'sideboard'] },
        { category: 'beds', keywords: ['bed', 'headboard'] },
        { category: 'mirrors', keywords: ['mirror'] },
        { category: 'rugs', keywords: ['rug', 'carpet'] },
        { category: 'lighting', keywords: ['lamp', 'chandelier', 'pendant', 'sconce'] },
    ];
    for (const { category, keywords } of categoryKeywords) {
        if (keywords.some(keyword => searchText.includes(keyword))) {
            return category;
        }
    }
    return 'default';
}
/**
 * Filter dimensions based on product category
 * Returns only the dimensions relevant to the detected category
 */
export function filterDimensionsByCategory(dimensions, category) {
    const relevantKeys = CATEGORY_DIMENSION_MAP[category] || CATEGORY_DIMENSION_MAP['default'];
    const filtered = {
        unit: dimensions.unit
    };
    relevantKeys.forEach(key => {
        if (dimensions[key] !== undefined && dimensions[key] !== null) {
            filtered[key] = dimensions[key];
        }
    });
    return filtered;
}
/**
 * Scale reference descriptions for common furniture sizes
 * Helps AI understand real-world scale
 */
const SCALE_REFERENCES = {
    // Overall furniture dimensions
    width: (w) => {
        if (w < 30)
            return 'compact accent piece';
        if (w < 48)
            return 'armchair size';
        if (w < 72)
            return 'loveseat width';
        if (w < 96)
            return 'standard sofa width';
        if (w < 120)
            return 'large sofa width';
        return 'sectional width';
    },
    height: (h) => {
        if (h < 18)
            return 'low-profile';
        if (h < 30)
            return 'coffee table height';
        if (h < 36)
            return 'standard seating height';
        if (h < 42)
            return 'counter height';
        if (h < 80)
            return 'standard furniture height';
        return 'tall cabinet height';
    },
    seatHeight: (sh) => {
        if (sh < 16)
            return 'low lounge seating';
        if (sh < 19)
            return 'standard seating height';
        if (sh < 25)
            return 'counter-height seating';
        return 'bar-height seating';
    },
    tabletopThickness: (tt) => {
        if (tt < 1)
            return 'sleek thin profile';
        if (tt < 2)
            return 'standard tabletop';
        return 'substantial thick tabletop';
    }
};
/**
 * Generate AI-optimized dimension prompt block
 * Creates scale-focused text with comparative references
 * Works with both full Product objects and partial product selections
 */
export function buildDimensionPrompt(product) {
    const normalized = normalizeDimensions(product);
    if (!normalized) {
        // Log when dimensions are missing to help debug
        if (product.name) {
            console.log(`   ℹ️ No dimensions available for: ${product.name}`);
        }
        return null;
    }
    const category = detectFurnitureCategory(product);
    const filtered = filterDimensionsByCategory(normalized, category);
    // Check if we have any dimensions to describe
    const hasDimensions = Object.keys(filtered).some(key => key !== 'unit' && key !== 'shapeType');
    if (!hasDimensions)
        return null;
    const parts = [];
    // Overall dimensions (always priority if available)
    if (filtered.width || filtered.depth || filtered.height) {
        const w = filtered.width ? `${filtered.width}W` : '';
        const d = filtered.depth ? `${filtered.depth}D` : '';
        const h = filtered.height ? `${filtered.height}H` : '';
        const dims = [w, d, h].filter(Boolean).join(' × ');
        if (dims) {
            parts.push(`Overall: ${dims} ${filtered.unit}`);
            // Add scale reference for width
            if (filtered.width && SCALE_REFERENCES.width) {
                const ref = SCALE_REFERENCES.width(filtered.width);
                if (ref)
                    parts.push(`(${ref})`);
            }
        }
    }
    // Seating dimensions (for chairs, sofas, etc.)
    if (filtered.seatHeight !== undefined) {
        const ref = SCALE_REFERENCES.seatHeight?.(filtered.seatHeight);
        parts.push(`Seat height: ${filtered.seatHeight}" ${ref ? `(${ref})` : ''}`);
    }
    if (filtered.seatWidth !== undefined || filtered.seatDepth !== undefined) {
        const sw = filtered.seatWidth ? `${filtered.seatWidth}W` : '';
        const sd = filtered.seatDepth ? `${filtered.seatDepth}D` : '';
        const seatDims = [sw, sd].filter(Boolean).join(' × ');
        if (seatDims)
            parts.push(`Seat: ${seatDims}"`);
    }
    if (filtered.armWidth !== undefined || filtered.armDepth !== undefined) {
        const aw = filtered.armWidth ? `${filtered.armWidth}W` : '';
        const ad = filtered.armDepth ? `${filtered.armDepth}D` : '';
        const armDims = [aw, ad].filter(Boolean).join(' × ');
        if (armDims)
            parts.push(`Arms: ${armDims}"`);
    }
    // Table dimensions
    if (filtered.tabletopThickness !== undefined) {
        const ref = SCALE_REFERENCES.tabletopThickness?.(filtered.tabletopThickness);
        parts.push(`Tabletop: ${filtered.tabletopThickness}" thick ${ref ? `(${ref})` : ''}`);
    }
    if (filtered.legBaseHeight1 !== undefined) {
        parts.push(`Leg height: ${filtered.legBaseHeight1}"`);
    }
    // Cabinet/Storage dimensions
    if (filtered.doorWidth !== undefined || filtered.doorHeight !== undefined) {
        const dw = filtered.doorWidth ? `${filtered.doorWidth}W` : '';
        const dh = filtered.doorHeight ? `${filtered.doorHeight}H` : '';
        const doorDims = [dw, dh].filter(Boolean).join(' × ');
        if (doorDims)
            parts.push(`Doors: ${doorDims}"`);
    }
    if (filtered.volume !== undefined) {
        parts.push(`Storage volume: ${filtered.volume} cu ft`);
    }
    // Shape type
    if (filtered.shapeType) {
        parts.push(`Shape: ${filtered.shapeType}`);
    }
    if (parts.length === 0)
        return null;
    // Combine into concise prompt block
    return `[DIMENSIONS] ${parts.join('. ')}.`;
}
/**
 * Generate condensed dimension summary for visual descriptions
 * Optimized for 400-character limit, allocates ~80-100 chars for dimensions
 * Works with both full Product objects and partial product selections
 */
export function buildDimensionSummary(product) {
    const normalized = normalizeDimensions(product);
    if (!normalized)
        return null;
    const category = detectFurnitureCategory(product);
    const filtered = filterDimensionsByCategory(normalized, category);
    // Priority: Overall dims, then most important category-specific dimension
    const parts = [];
    // Overall dimensions (compact format)
    if (filtered.width || filtered.depth || filtered.height) {
        const w = filtered.width || '?';
        const d = filtered.depth || '?';
        const h = filtered.height || '?';
        parts.push(`${w}×${d}×${h}"`);
    }
    // Add one key dimension based on category
    if (category.includes('chair') || category.includes('sofa') || category.includes('sectional')) {
        if (filtered.seatHeight)
            parts.push(`seat ${filtered.seatHeight}"`);
    }
    else if (category.includes('table')) {
        if (filtered.tabletopThickness)
            parts.push(`${filtered.tabletopThickness}" top`);
    }
    else if (category.includes('cabinet') || category.includes('wardrobe')) {
        if (filtered.volume)
            parts.push(`${filtered.volume}cf storage`);
    }
    return parts.length > 0 ? parts.join(', ') : null;
}
/**
 * Validate if product has sufficient dimension data for accurate rendering
 * Works with both full Product objects and partial product selections
 */
export function hasAdequateDimensionData(product) {
    const normalized = normalizeDimensions(product);
    if (!normalized)
        return false;
    // At minimum, should have overall width, depth, and height
    return !!(normalized.width && normalized.depth && normalized.height);
}
/**
 * Extract basic product dimensions (w, d, h) for spatial validation
 * Returns dimensions with unit or null if not available
 */
export function normalizeProductDimensions(product) {
    const normalized = normalizeDimensions(product);
    if (!normalized)
        return null;
    // Must have at least width, depth, and height for spatial validation
    if (!normalized.width || !normalized.depth || !normalized.height) {
        return null;
    }
    return {
        w: normalized.width,
        d: normalized.depth,
        h: normalized.height,
        unit: normalized.unit
    };
}
//# sourceMappingURL=dimension-utils.js.map