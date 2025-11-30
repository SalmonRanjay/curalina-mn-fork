import sharp from 'sharp';
const DEFAULT_MASK_CONFIG = {
    width: 1024,
    height: 1024,
    backgroundColor: '#000000' // Black background
};
// Color codes for different furniture categories (RGB hex)
const CATEGORY_COLORS = {
    'primary_seating': '#FF4444', // Red - sofas
    'accent_seating': '#FF8844', // Orange - chairs
    'coffee_table': '#44FF44', // Green - coffee tables
    'side_table': '#88FF44', // Light green - side tables
    'dining_table': '#44FFFF', // Cyan - dining tables
    'dining_seating': '#4488FF', // Blue - dining chairs
    'bed': '#FF44FF', // Magenta - beds
    'nightstand': '#FF88FF', // Pink - nightstands
    'dresser': '#8844FF', // Purple - dressers
    'desk': '#44FF88', // Teal - desks
    'office_seating': '#4444FF', // Blue - office chairs
    'storage': '#FFFF44', // Yellow - storage
    'lighting': '#FFFFFF', // White - lighting
    'decor': '#888888', // Gray - decor
};
/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}
/**
 * Get category color for a product based on its placement zone
 */
function getCategoryColor(zoneId) {
    // Extract category hint from zone ID
    for (const [category, color] of Object.entries(CATEGORY_COLORS)) {
        if (zoneId.toLowerCase().includes(category.split('_')[0])) {
            return color;
        }
    }
    return '#888888'; // Default gray
}
/**
 * Generate a layout mask image from zone-based placements
 * Returns a base64 PNG data URL
 */
export async function generateLayoutMask(placements, config = {}) {
    const finalConfig = { ...DEFAULT_MASK_CONFIG, ...config };
    const { width, height, backgroundColor } = finalConfig;
    console.log(`🎨 Generating layout mask: ${width}x${height}px with ${placements.length} placements`);
    // Create a blank canvas (black background)
    const bgColor = hexToRgb(backgroundColor);
    const canvas = Buffer.alloc(width * height * 4); // RGBA
    // Fill with background color
    for (let i = 0; i < canvas.length; i += 4) {
        canvas[i] = bgColor.r; // R
        canvas[i + 1] = bgColor.g; // G
        canvas[i + 2] = bgColor.b; // B
        canvas[i + 3] = 255; // A (fully opaque)
    }
    // Draw each placement as a colored region
    for (const placement of placements) {
        // Skip placements with invalid or missing data
        if (!placement.position || !placement.zoneId) {
            console.warn('Skipping placement with missing position or zoneId');
            continue;
        }
        const color = getCategoryColor(placement.zoneId);
        const rgb = hexToRgb(color);
        // Calculate pixel coordinates from normalized position (0-1)
        // Ensure position exists and is valid
        const posX = placement.position.x ?? 0.5;
        const posY = placement.position.y ?? 0.5;
        // Validate position is in valid range [0, 1]
        if (posX < 0 || posX > 1 || posY < 0 || posY > 1) {
            console.warn(`Skipping placement with invalid position: (${posX}, ${posY})`);
            continue;
        }
        const centerX = Math.floor(posX * width);
        const centerY = Math.floor(posY * height);
        // Calculate region size based on spacing (approximate furniture footprint)
        // Spacing is in normalized units (0-1), convert to pixels
        // Use defaults if spacing is missing or invalid
        const defaultSpacing = 0.05; // 5% of room size as default
        const spacingSides = Math.max(0, Math.min(0.5, placement.spacing?.sides ?? defaultSpacing));
        const spacingFront = Math.max(0, Math.min(0.5, placement.spacing?.front ?? defaultSpacing));
        const regionWidth = Math.floor(spacingSides * width * 2);
        const regionHeight = Math.floor(spacingFront * height * 2);
        // Ensure minimum region size for visibility
        const minSize = 50;
        const finalWidth = Math.max(regionWidth, minSize);
        const finalHeight = Math.max(regionHeight, minSize);
        // Skip if dimensions are invalid (shouldn't happen with clamping, but safety check)
        if (finalWidth <= 0 || finalHeight <= 0) {
            console.warn(`Skipping placement with invalid dimensions: ${finalWidth}x${finalHeight}`);
            continue;
        }
        // Calculate bounding box
        const x1 = Math.max(0, centerX - Math.floor(finalWidth / 2));
        const y1 = Math.max(0, centerY - Math.floor(finalHeight / 2));
        const x2 = Math.min(width - 1, centerX + Math.floor(finalWidth / 2));
        const y2 = Math.min(height - 1, centerY + Math.floor(finalHeight / 2));
        // Validate bounding box
        if (x2 <= x1 || y2 <= y1) {
            console.warn(`Skipping placement with invalid bounding box: (${x1},${y1}) to (${x2},${y2})`);
            continue;
        }
        // Apply confidence as opacity (0-1 confidence maps to 128-255 alpha)
        // Default confidence to 0.5 if missing
        const confidence = Math.max(0, Math.min(1, placement.confidence ?? 0.5));
        const alpha = Math.floor(128 + (confidence * 127));
        // Draw filled rectangle for this placement
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                const pixelIndex = (y * width + x) * 4;
                // Blend with existing color based on alpha
                const existingAlpha = canvas[pixelIndex + 3] / 255;
                const newAlpha = alpha / 255;
                const blendedAlpha = existingAlpha + newAlpha * (1 - existingAlpha);
                if (blendedAlpha > 0) {
                    canvas[pixelIndex] = Math.floor((canvas[pixelIndex] * existingAlpha + rgb.r * newAlpha) / blendedAlpha);
                    canvas[pixelIndex + 1] = Math.floor((canvas[pixelIndex + 1] * existingAlpha + rgb.g * newAlpha) / blendedAlpha);
                    canvas[pixelIndex + 2] = Math.floor((canvas[pixelIndex + 2] * existingAlpha + rgb.b * newAlpha) / blendedAlpha);
                    canvas[pixelIndex + 3] = Math.floor(blendedAlpha * 255);
                }
            }
        }
    }
    // Convert canvas to PNG using sharp
    const pngBuffer = await sharp(canvas, {
        raw: {
            width,
            height,
            channels: 4
        }
    })
        .png()
        .toBuffer();
    const base64Image = pngBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;
    console.log(`✅ Layout mask generated: ${(pngBuffer.length / 1024).toFixed(1)}KB`);
    return dataUrl;
}
/**
 * Generate a simplified edge map from layout mask
 * Useful for ControlNet Canny/Edge detection modes
 */
export async function generateEdgeMap(layoutMaskDataUrl) {
    // Extract base64 data
    const base64Match = layoutMaskDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
        throw new Error('Invalid layout mask data URL');
    }
    const maskBuffer = Buffer.from(base64Match[1], 'base64');
    // Apply Canny edge detection using sharp
    const edgeBuffer = await sharp(maskBuffer)
        .greyscale() // Convert to grayscale first
        .normalise() // Normalize contrast
        .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
    })
        .png()
        .toBuffer();
    const base64Edge = edgeBuffer.toString('base64');
    return `data:image/png;base64,${base64Edge}`;
}
/**
 * Create a combined mask from multiple placement sets
 * Useful for multi-pass generation or iteration refinement
 */
export async function combineMasks(masks, blendMode = 'overlay') {
    if (masks.length === 0) {
        throw new Error('No masks to combine');
    }
    if (masks.length === 1) {
        return masks[0];
    }
    // Start with first mask
    let combined = Buffer.from(masks[0].split(',')[1], 'base64');
    // Blend each subsequent mask
    for (let i = 1; i < masks.length; i++) {
        const maskBuffer = Buffer.from(masks[i].split(',')[1], 'base64');
        // Use sharp composite for blending
        combined = await sharp(combined)
            .composite([{
                input: maskBuffer,
                blend: blendMode
            }])
            .png()
            .toBuffer();
    }
    return `data:image/png;base64,${combined.toString('base64')}`;
}
//# sourceMappingURL=layout-mask-generator.js.map