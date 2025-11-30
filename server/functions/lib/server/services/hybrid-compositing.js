import sharp from 'sharp';
/**
 * Select the best product image angle based on placement
 * For MVP, we'll use simple heuristics. Future: use AI to analyze best angle
 */
export function selectBestProductAngle(productImages, placement) {
    if (!productImages || productImages.length === 0) {
        throw new Error('No product images available');
    }
    // For MVP: Simple selection logic
    // - First image for front-facing placements
    // - Middle image for side views
    // - Last image for angled views
    const placementLower = placement.toLowerCase();
    // Angled/corner placements prefer last image
    if (placementLower.includes('corner') || placementLower.includes('angled')) {
        return productImages[productImages.length - 1];
    }
    // Side placements prefer middle image
    if (placementLower.includes('side') || placementLower.includes('wall')) {
        const midIndex = Math.floor(productImages.length / 2);
        return productImages[midIndex];
    }
    // Default to first image (front view)
    return productImages[0];
}
/**
 * Derive scale factor from zone placement with bounds-based sizing
 * Considers both zone type and actual spacing constraints
 */
function deriveScaleFromZonePlacement(placement) {
    const { zoneId, anchorPoint, spacing } = placement;
    // Calculate base scale from zone type (functional category)
    let baseScale = 0.25; // Default medium
    if (zoneId.includes('conversation') || zoneId.includes('sleep')) {
        baseScale = 0.35; // Large focal items (sofas, beds)
    }
    else if (zoneId.includes('desk') || zoneId.includes('dining')) {
        baseScale = 0.30; // Medium-large work surfaces
    }
    else if (zoneId.includes('bedside') || zoneId.includes('side') || anchorPoint === 'corner') {
        baseScale = 0.20; // Medium accent items (nightstands, side tables)
    }
    else if (zoneId.includes('lighting') || zoneId.includes('decor')) {
        baseScale = 0.15; // Small decorative items
    }
    else if (anchorPoint === 'wall' && !zoneId.includes('conversation')) {
        baseScale = 0.18; // Wall-mounted items slightly smaller
    }
    // Adjust based on spacing constraints (tighter spacing = smaller scale)
    const totalSpacing = spacing.front + spacing.sides + spacing.back;
    if (totalSpacing > 0.25) {
        // High clearance requirement = this is a large item
        baseScale = Math.min(baseScale * 1.2, 0.40); // Cap at 40%
    }
    else if (totalSpacing < 0.10) {
        // Low clearance = compact item
        baseScale = Math.max(baseScale * 0.85, 0.12); // Floor at 12%
    }
    return baseScale;
}
/**
 * Generate placement guidelines based on room type and product selection
 * Now uses zone-based placement instructions for consistent spatial logic
 */
export function generatePlacementGuidelines(roomType, selectedProducts, zonePlacements) {
    const placements = [];
    // Use zone-based placements if available
    if (zonePlacements && zonePlacements.length > 0) {
        console.log(`📐 Using zone-based placement system for ${zonePlacements.length} products`);
        zonePlacements.forEach((zonePlace, index) => {
            const product = selectedProducts.find(p => p.sku === zonePlace.productId);
            if (!product) {
                console.warn(`⚠️ Product ${zonePlace.productId} not found in selected products`);
                return;
            }
            // Select best image angle based on anchor point
            const placementHint = zonePlace.anchorPoint === 'corner' ? 'corner' :
                zonePlace.anchorPoint === 'wall' ? 'wall' : 'center';
            const selectedImage = selectBestProductAngle(product.images, placementHint);
            // Use zone position directly (already normalized 0-1)
            const position = zonePlace.position;
            // Derive scale from zone placement (considers bounds and spacing)
            const scale = deriveScaleFromZonePlacement(zonePlace);
            // Use index for z-ordering (back to front)
            const zIndex = index;
            placements.push({
                sku: product.sku,
                productName: product.name,
                imageUrl: selectedImage,
                position,
                scale,
                zIndex,
                addShadow: false // Disabled until background removal is implemented
            });
            console.log(`  ✓ ${product.name}: zone=${zonePlace.zoneId}, pos=(${position.x.toFixed(2)}, ${position.y.toFixed(2)}), scale=${scale.toFixed(2)}`);
        });
        return placements;
    }
    // Fallback to legacy grid-based placement if no zone placements provided
    console.log(`⚠️ No zone placements available, falling back to legacy grid placement`);
    selectedProducts.forEach((product, index) => {
        const totalProducts = selectedProducts.length;
        // Select best image angle
        const selectedImage = selectBestProductAngle(product.images, product.placement);
        // Generate position based on index and total count (legacy logic)
        let position = { x: 0.5, y: 0.5 }; // Default center
        let scale = 0.25; // Default scale
        let zIndex = index; // Back to front ordering
        if (totalProducts <= 3) {
            position = {
                x: 0.25 + (index * 0.25),
                y: 0.7
            };
            scale = 0.15;
        }
        else if (totalProducts <= 6) {
            const row = Math.floor(index / 3);
            const col = index % 3;
            position = {
                x: 0.2 + (col * 0.3),
                y: 0.65 + (row * 0.2)
            };
            scale = 0.12;
        }
        else {
            const row = Math.floor(index / 3);
            const col = index % 3;
            position = {
                x: 0.2 + (col * 0.3),
                y: 0.6 + (row * 0.15)
            };
            scale = 0.1;
        }
        placements.push({
            sku: product.sku,
            productName: product.name,
            imageUrl: selectedImage,
            position,
            scale,
            zIndex,
            addShadow: false
        });
    });
    return placements;
}
/**
 * Fetch image from URL and return as Sharp instance
 */
async function fetchImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return sharp(Buffer.from(buffer));
}
/**
 * Create a subtle shadow for a product image
 * Creates a neutral black semi-transparent shadow by:
 * 1. Starting with black canvas
 * 2. Masking it with product's alpha channel
 * 3. Blurring for soft shadow effect
 */
async function createShadow(productBuffer) {
    const productImage = sharp(productBuffer);
    const metadata = await productImage.metadata();
    if (!metadata.width || !metadata.height) {
        throw new Error('Invalid shadow image dimensions');
    }
    // Create a semi-transparent black canvas with subtle opacity
    const blackCanvas = await sharp({
        create: {
            width: metadata.width,
            height: metadata.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0.25 } // 25% opacity black for subtle shadow
        }
    }).png().toBuffer();
    // Composite product onto black canvas using 'dest-in' blend
    // This creates a black silhouette with product's alpha channel
    return sharp(blackCanvas)
        .composite([{
            input: productBuffer,
            blend: 'dest-in' // Use product's alpha as mask for black canvas
        }])
        .blur(10) // Blur for soft shadow
        .toBuffer();
}
/**
 * Composite product images onto AI-generated base image
 *
 * CURRENT LIMITATIONS (v1 MVP):
 * - Product images are JPEGs with backgrounds (not transparent PNGs)
 * - Results show products with visible backgrounds overlaid on room
 * - Simple grid placement without scene analysis
 *
 * PLANNED IMPROVEMENTS:
 * - Background removal API integration (remove.bg/ClipDrop)
 * - Scene-aware placement using Gemini Vision analysis
 * - Perspective-matched scaling and positioning
 * - Realistic shadow generation on floor plane
 *
 * Returns the final composited image as a buffer
 */
export async function compositeProducts(baseImageUrl, placements) {
    console.log(`🎨 Starting hybrid compositing with ${placements.length} products`);
    // Fetch base AI-generated image
    const baseImage = await fetchImage(baseImageUrl);
    const baseMetadata = await baseImage.metadata();
    if (!baseMetadata.width || !baseMetadata.height) {
        throw new Error('Invalid base image dimensions');
    }
    const baseWidth = baseMetadata.width;
    const baseHeight = baseMetadata.height;
    console.log(`📐 Base image dimensions: ${baseWidth}x${baseHeight}`);
    // Sort placements by zIndex (back to front)
    const sortedPlacements = [...placements].sort((a, b) => a.zIndex - b.zIndex);
    // Build composite layers
    const compositeLayers = [];
    for (const placement of sortedPlacements) {
        try {
            console.log(`  📦 Processing ${placement.productName}`);
            // Fetch product image
            const productImage = await fetchImage(placement.imageUrl);
            const productMetadata = await productImage.metadata();
            if (!productMetadata.width || !productMetadata.height) {
                console.warn(`  ⚠️ Skipping ${placement.productName} - invalid dimensions`);
                continue;
            }
            // Calculate scaled dimensions
            const targetWidth = Math.round(baseWidth * placement.scale);
            const targetHeight = Math.round((productMetadata.height / productMetadata.width) * targetWidth);
            // Resize product image and force PNG with transparency
            // This ensures alpha channel is preserved even for JPEG sources
            const resizedProduct = await productImage
                .resize(targetWidth, targetHeight, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
            })
                .ensureAlpha() // Ensure alpha channel exists
                .png() // Force PNG output with transparency
                .toBuffer();
            // Calculate absolute position
            const left = Math.round(placement.position.x * baseWidth - targetWidth / 2);
            const top = Math.round(placement.position.y * baseHeight - targetHeight / 2);
            // Add shadow if requested
            if (placement.addShadow) {
                const shadowBuffer = await createShadow(resizedProduct);
                compositeLayers.push({
                    input: shadowBuffer,
                    left: left + 5, // Offset shadow slightly
                    top: top + 5,
                    blend: 'over'
                });
            }
            // Add product image
            compositeLayers.push({
                input: resizedProduct,
                left,
                top,
                blend: 'over'
            });
            console.log(`  ✅ Added ${placement.productName} at (${left}, ${top})`);
        }
        catch (error) {
            console.error(`  ❌ Error processing ${placement.productName}:`, error);
            // Continue with other products even if one fails
        }
    }
    // Composite all layers onto base image
    const finalImage = await baseImage
        .composite(compositeLayers)
        .jpeg({ quality: 90 }) // High quality JPEG
        .toBuffer();
    console.log(`✅ Hybrid compositing complete!`);
    return finalImage;
}
//# sourceMappingURL=hybrid-compositing.js.map