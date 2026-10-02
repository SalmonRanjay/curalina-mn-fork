import { normalizeProductDimensions } from './dimension-utils';
const MINIMUM_CLEARANCE_INCHES = 30; // 30 inches minimum around furniture
const COMFORTABLE_CLEARANCE_INCHES = 36; // 36 inches for comfortable passage
const LOW_CONFIDENCE_THRESHOLD = 60; // Below 60% confidence, warn user
/**
 * Convert any dimension to inches for consistent comparison
 */
function toInches(value, unit) {
    const lowerUnit = unit.toLowerCase();
    if (lowerUnit.includes('inch') || lowerUnit === 'in' || lowerUnit === '"') {
        return value;
    }
    if (lowerUnit.includes('feet') || lowerUnit === 'ft' || lowerUnit === "'") {
        return value * 12;
    }
    if (lowerUnit.includes('cm') || lowerUnit === 'centimeter') {
        return value / 2.54;
    }
    if (lowerUnit.includes('m') || lowerUnit === 'meter') {
        return value * 39.37;
    }
    // Default to inches if unit unknown
    console.warn(`Unknown unit "${unit}", treating as inches`);
    return value;
}
/**
 * Check if product can fit through a doorway (critical for delivery)
 * Uses diagonal of largest face for accurate clearance check
 */
function canFitThroughDoorway(productDimensions, doorwayDimensions) {
    const doorWidthInches = toInches(doorwayDimensions.width, doorwayDimensions.unit);
    const doorHeightInches = toInches(doorwayDimensions.height, doorwayDimensions.unit);
    const productW = toInches(productDimensions.w, productDimensions.unit);
    const productD = toInches(productDimensions.d, productDimensions.unit);
    const productH = toInches(productDimensions.h, productDimensions.unit);
    // Calculate diagonal of each face (furniture can be tilted during delivery)
    const diagonalWD = Math.sqrt(productW ** 2 + productD ** 2);
    const diagonalWH = Math.sqrt(productW ** 2 + productH ** 2);
    const diagonalDH = Math.sqrt(productD ** 2 + productH ** 2);
    const largestDiagonal = Math.max(diagonalWD, diagonalWH, diagonalDH);
    // Check if largest diagonal can fit through doorway opening
    const doorDiagonal = Math.sqrt(doorWidthInches ** 2 + doorHeightInches ** 2);
    if (largestDiagonal <= doorDiagonal) {
        return {
            fits: true,
            message: `Product can fit through doorway (${Math.round(largestDiagonal)}" diagonal < ${Math.round(doorDiagonal)}" door opening)`
        };
    }
    return {
        fits: false,
        message: `Product too large for doorway: ${Math.round(largestDiagonal)}" diagonal > ${Math.round(doorDiagonal)}" door opening (${Math.round(doorWidthInches)}×${Math.round(doorHeightInches)}")`
    };
}
/**
 * Check if product fits within room envelope with adequate clearance
 * Evaluates both orientations to ensure product can fit regardless of placement
 */
function fitsInRoomEnvelope(productDimensions, roomDimensions) {
    const roomWidthInches = toInches(roomDimensions.width, roomDimensions.unit);
    const roomDepthInches = toInches(roomDimensions.depth, roomDimensions.unit);
    const productW = toInches(productDimensions.w, productDimensions.unit);
    const productD = toInches(productDimensions.d, productDimensions.unit);
    const productH = toInches(productDimensions.h, productDimensions.unit);
    // Check height constraint only if ceiling height is provided
    if (roomDimensions.height !== undefined) {
        const roomHeightInches = toInches(roomDimensions.height, roomDimensions.unit);
        if (productH > roomHeightInches) {
            return {
                fits: false,
                hasComfortableClearance: false,
                message: `Product too tall: ${Math.round(productH)}" > ${Math.round(roomHeightInches)}" ceiling height`
            };
        }
    }
    // Check both orientations: product could be placed along either wall
    // Orientation 1: product.w along room.width, product.d along room.depth
    const orientation1FitsW = (productW + MINIMUM_CLEARANCE_INCHES) <= roomWidthInches;
    const orientation1FitsD = (productD + MINIMUM_CLEARANCE_INCHES) <= roomDepthInches;
    const orientation1Fits = orientation1FitsW && orientation1FitsD;
    // Orientation 2: product.w along room.depth, product.d along room.width (rotated 90°)
    const orientation2FitsW = (productD + MINIMUM_CLEARANCE_INCHES) <= roomWidthInches;
    const orientation2FitsD = (productW + MINIMUM_CLEARANCE_INCHES) <= roomDepthInches;
    const orientation2Fits = orientation2FitsW && orientation2FitsD;
    // Product must fit in at least one orientation
    if (!orientation1Fits && !orientation2Fits) {
        return {
            fits: false,
            hasComfortableClearance: false,
            message: `Product too large: ${Math.round(productW)}×${Math.round(productD)}" + ${MINIMUM_CLEARANCE_INCHES}" clearance doesn't fit in ${Math.round(roomWidthInches)}×${Math.round(roomDepthInches)}" room`
        };
    }
    // Check for comfortable clearance in the best orientation
    // Clearance is the leftover space divided by 2 (space on each side)
    let hasComfortableClearance = false;
    let bestClearancePerSide = 0;
    if (orientation1Fits) {
        const leftoverW = roomWidthInches - productW;
        const leftoverD = roomDepthInches - productD;
        // Clearance per side (divide by 2)
        const clearancePerSideW = leftoverW / 2;
        const clearancePerSideD = leftoverD / 2;
        const minClearancePerSide = Math.min(clearancePerSideW, clearancePerSideD);
        if (minClearancePerSide >= COMFORTABLE_CLEARANCE_INCHES) {
            hasComfortableClearance = true;
        }
        bestClearancePerSide = Math.max(bestClearancePerSide, minClearancePerSide);
    }
    if (orientation2Fits) {
        const leftoverW = roomWidthInches - productD;
        const leftoverD = roomDepthInches - productW;
        // Clearance per side (divide by 2)
        const clearancePerSideW = leftoverW / 2;
        const clearancePerSideD = leftoverD / 2;
        const minClearancePerSide = Math.min(clearancePerSideW, clearancePerSideD);
        if (minClearancePerSide >= COMFORTABLE_CLEARANCE_INCHES) {
            hasComfortableClearance = true;
        }
        bestClearancePerSide = Math.max(bestClearancePerSide, minClearancePerSide);
    }
    if (!hasComfortableClearance) {
        return {
            fits: true,
            hasComfortableClearance: false,
            message: `Product fits but tight: ${Math.round(productW)}×${Math.round(productD)}" leaves ${Math.round(bestClearancePerSide)}" per side (36" recommended for comfortable passage)`
        };
    }
    return {
        fits: true,
        hasComfortableClearance: true,
        message: `Product fits comfortably: ${Math.round(productW)}×${Math.round(productD)}" with ${Math.round(bestClearancePerSide)}" clearance per side`
    };
}
/**
 * Validate if a product can physically fit in the user's room
 * Returns validation result with severity level and detailed messages
 */
export async function validateProductFit(product, parsedRoomData) {
    // If no room data, allow product (can't validate)
    if (!parsedRoomData) {
        return {
            severity: 'OK',
            canFit: true,
            canDeliverThroughDoor: true,
            hasAdequateClearance: true,
            messages: ['No room dimensions provided - validation skipped'],
            details: {}
        };
    }
    // Normalize product dimensions
    const productDims = normalizeProductDimensions(product);
    if (!productDims) {
        return {
            severity: 'OK',
            canFit: true,
            canDeliverThroughDoor: true,
            hasAdequateClearance: true,
            messages: ['Product dimensions not available - validation skipped'],
            details: {}
        };
    }
    const messages = [];
    const details = {};
    // Warn if room data confidence is low
    if (parsedRoomData.confidence < LOW_CONFIDENCE_THRESHOLD) {
        messages.push(`Room measurements have low confidence (${parsedRoomData.confidence}%) - validation may not be accurate`);
        details.confidenceWarning = `Low confidence: ${parsedRoomData.confidence}%`;
    }
    // Check room envelope fit
    let canFit = true;
    let hasAdequateClearance = true;
    if (parsedRoomData.dimensions) {
        // Merge ceiling height from ceilingHeight field if dimensions.height not provided
        const roomDims = { ...parsedRoomData.dimensions };
        if (roomDims.height === undefined && parsedRoomData.ceilingHeight) {
            roomDims.height = parsedRoomData.ceilingHeight.height;
        }
        const envelopeCheck = fitsInRoomEnvelope(productDims, roomDims);
        canFit = envelopeCheck.fits;
        hasAdequateClearance = envelopeCheck.hasComfortableClearance;
        messages.push(envelopeCheck.message);
        details.roomEnvelopeCheck = envelopeCheck.message;
        if (!canFit) {
            return {
                severity: 'BLOCK',
                canFit: false,
                canDeliverThroughDoor: false,
                hasAdequateClearance: false,
                messages,
                details
            };
        }
    }
    // Check doorway delivery (only if both width and height are provided)
    let canDeliverThroughDoor = true;
    if (parsedRoomData.doorway && parsedRoomData.doorway.height !== undefined) {
        const doorwayCheck = canFitThroughDoorway(productDims, {
            width: parsedRoomData.doorway.width,
            height: parsedRoomData.doorway.height,
            unit: parsedRoomData.doorway.unit
        });
        canDeliverThroughDoor = doorwayCheck.fits;
        messages.push(doorwayCheck.message);
        details.doorwayCheck = doorwayCheck.message;
        if (!canDeliverThroughDoor) {
            return {
                severity: 'BLOCK',
                canFit: false,
                canDeliverThroughDoor: false,
                hasAdequateClearance,
                messages,
                details
            };
        }
    }
    else if (parsedRoomData.doorway) {
        // Doorway width provided but not height - warn but don't block
        messages.push(`⚠️ Doorway width ${parsedRoomData.doorway.width}" noted but height unknown - cannot validate delivery`);
        details.doorwayCheck = 'Incomplete doorway data';
    }
    // Determine severity
    let severity = 'OK';
    if (!hasAdequateClearance) {
        severity = 'WARNING';
        messages.push('⚠️ This product will fit, but space will be tight. Consider if you need more room to move around.');
    }
    if (parsedRoomData.confidence < LOW_CONFIDENCE_THRESHOLD) {
        severity = 'WARNING';
    }
    return {
        severity,
        canFit,
        canDeliverThroughDoor,
        hasAdequateClearance,
        messages,
        details
    };
}
/**
 * Batch validate multiple products against room dimensions
 * Returns map of product ID to validation result
 */
export async function validateProductsBatch(products, parsedRoomData) {
    const results = new Map();
    for (const product of products) {
        const result = await validateProductFit(product, parsedRoomData);
        results.set(product.id, result);
    }
    return results;
}
/**
 * Filter products to only those that can fit (excludes BLOCK severity)
 * Warnings are allowed but should be shown to user
 */
export async function filterFittingProducts(products, parsedRoomData) {
    const fitting = [];
    const blocked = [];
    const warnings = [];
    const validationResults = await validateProductsBatch(products, parsedRoomData);
    for (const product of products) {
        const result = validationResults.get(product.id);
        if (!result)
            continue;
        if (result.severity === 'BLOCK') {
            blocked.push({
                product,
                reason: result.messages.join('; ')
            });
        }
        else {
            fitting.push(product);
            if (result.severity === 'WARNING') {
                warnings.push({
                    product,
                    messages: result.messages
                });
            }
        }
    }
    return { fitting, blocked, warnings };
}
//# sourceMappingURL=spatial-fit-validator.js.map