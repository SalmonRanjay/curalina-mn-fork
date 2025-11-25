/**
 * Room Composite Service
 * 
 * Solves the room architecture preservation problem by:
 * 1. Using Gemini batch renders for product fidelity
 * 2. Computing pixel delta between original room and Gemini output
 * 3. Extracting just the furniture/changes
 * 4. Compositing changes onto the ORIGINAL room image
 * 
 * This gives us: Perfect room preservation + Good product rendering
 */

import sharp from 'sharp';

interface CompositeResult {
  success: boolean;
  imageBase64?: string;
  deltaPercentage?: number;
  error?: string;
}

/**
 * Composite furniture from rendered image onto original room
 * 
 * @param originalRoomBase64 - The user's original space image (architecture to preserve)
 * @param renderedImageBase64 - Gemini's output with furniture (good product fidelity)
 * @param threshold - Pixel difference threshold (0-255), default 30
 * @returns Composited image with original room + rendered furniture
 */
export async function compositeOntoOriginalRoom(
  originalRoomBase64: string,
  renderedImageBase64: string,
  threshold: number = 25
): Promise<CompositeResult> {
  try {
    console.log(`\n🎨 DELTA COMPOSITING: Preserving original room architecture`);
    
    // Extract base64 data
    const originalData = originalRoomBase64.replace(/^data:image\/\w+;base64,/, '');
    const renderedData = renderedImageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    // Load images
    const originalBuffer = Buffer.from(originalData, 'base64');
    const renderedBuffer = Buffer.from(renderedData, 'base64');
    
    // Get original image metadata
    const originalMeta = await sharp(originalBuffer).metadata();
    const width = originalMeta.width!;
    const height = originalMeta.height!;
    
    console.log(`   Original room: ${width}x${height}`);
    
    // Resize rendered image to match original dimensions
    const renderedResized = await sharp(renderedBuffer)
      .resize(width, height, { fit: 'fill' })
      .raw()
      .toBuffer();
    
    // Get original as raw pixels
    const originalRaw = await sharp(originalBuffer)
      .raw()
      .toBuffer();
    
    // Get rendered as raw RGBA for compositing
    const renderedRGBA = await sharp(renderedBuffer)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer();
    
    // Compute delta mask - find pixels that changed significantly
    // We'll create an alpha mask where changed areas are opaque
    const channels = 3; // RGB
    const pixelCount = width * height;
    
    // Create output buffer with alpha channel
    const outputBuffer = Buffer.alloc(pixelCount * 4); // RGBA
    
    let changedPixels = 0;
    
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      const dstIdx = i * 4;
      
      // Get RGB values from both images
      const oR = originalRaw[srcIdx];
      const oG = originalRaw[srcIdx + 1];
      const oB = originalRaw[srcIdx + 2];
      
      const rR = renderedResized[srcIdx];
      const rG = renderedResized[srcIdx + 1];
      const rB = renderedResized[srcIdx + 2];
      
      // Calculate color difference
      const diff = Math.abs(oR - rR) + Math.abs(oG - rG) + Math.abs(oB - rB);
      const avgDiff = diff / 3;
      
      if (avgDiff > threshold) {
        // Pixel changed significantly - use rendered version
        outputBuffer[dstIdx] = rR;
        outputBuffer[dstIdx + 1] = rG;
        outputBuffer[dstIdx + 2] = rB;
        outputBuffer[dstIdx + 3] = 255; // Fully opaque
        changedPixels++;
      } else {
        // Pixel didn't change much - use original room
        outputBuffer[dstIdx] = oR;
        outputBuffer[dstIdx + 1] = oG;
        outputBuffer[dstIdx + 2] = oB;
        outputBuffer[dstIdx + 3] = 255; // Fully opaque
      }
    }
    
    const deltaPercentage = (changedPixels / pixelCount) * 100;
    console.log(`   Changed pixels: ${changedPixels.toLocaleString()} / ${pixelCount.toLocaleString()} (${deltaPercentage.toFixed(1)}%)`);
    
    // Sanity check - if too much changed, something went wrong
    if (deltaPercentage > 60) {
      console.log(`   ⚠️ WARNING: High delta (${deltaPercentage.toFixed(1)}%) - room may have changed significantly`);
    }
    
    // Create final composited image
    const composited = await sharp(outputBuffer, {
      raw: {
        width,
        height,
        channels: 4
      }
    })
      .png()
      .toBuffer();
    
    const resultBase64 = `data:image/png;base64,${composited.toString('base64')}`;
    
    console.log(`   ✅ Delta composite complete - room architecture preserved`);
    
    return {
      success: true,
      imageBase64: resultBase64,
      deltaPercentage
    };
    
  } catch (error) {
    console.error(`❌ Delta composite error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Composite error'
    };
  }
}

/**
 * Enhanced composite with edge smoothing
 * Applies a slight blur to the delta mask edges to avoid hard cutoffs
 */
export async function compositeWithSmoothEdges(
  originalRoomBase64: string,
  renderedImageBase64: string,
  threshold: number = 25,
  edgeBlur: number = 2
): Promise<CompositeResult> {
  try {
    console.log(`\n🎨 SMOOTH DELTA COMPOSITING: Preserving room with soft edges`);
    
    const originalData = originalRoomBase64.replace(/^data:image\/\w+;base64,/, '');
    const renderedData = renderedImageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    const originalBuffer = Buffer.from(originalData, 'base64');
    const renderedBuffer = Buffer.from(renderedData, 'base64');
    
    const originalMeta = await sharp(originalBuffer).metadata();
    const width = originalMeta.width!;
    const height = originalMeta.height!;
    
    console.log(`   Original room: ${width}x${height}`);
    
    // Get raw pixels
    const originalRaw = await sharp(originalBuffer).raw().toBuffer();
    const renderedResized = await sharp(renderedBuffer)
      .resize(width, height, { fit: 'fill' })
      .raw()
      .toBuffer();
    
    const channels = 3;
    const pixelCount = width * height;
    
    // First pass: create binary mask of changed areas
    const maskBuffer = Buffer.alloc(pixelCount);
    let changedPixels = 0;
    
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      
      const oR = originalRaw[srcIdx];
      const oG = originalRaw[srcIdx + 1];
      const oB = originalRaw[srcIdx + 2];
      
      const rR = renderedResized[srcIdx];
      const rG = renderedResized[srcIdx + 1];
      const rB = renderedResized[srcIdx + 2];
      
      const diff = (Math.abs(oR - rR) + Math.abs(oG - rG) + Math.abs(oB - rB)) / 3;
      
      if (diff > threshold) {
        maskBuffer[i] = 255;
        changedPixels++;
      } else {
        maskBuffer[i] = 0;
      }
    }
    
    const deltaPercentage = (changedPixels / pixelCount) * 100;
    console.log(`   Changed pixels: ${deltaPercentage.toFixed(1)}%`);
    
    // Blur the mask for soft edges
    const blurredMask = await sharp(maskBuffer, {
      raw: { width, height, channels: 1 }
    })
      .blur(edgeBlur)
      .raw()
      .toBuffer();
    
    // Final composite using blurred mask as alpha blend
    const outputBuffer = Buffer.alloc(pixelCount * 4);
    
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      const dstIdx = i * 4;
      
      const alpha = blurredMask[i] / 255; // 0-1 blend factor
      
      const oR = originalRaw[srcIdx];
      const oG = originalRaw[srcIdx + 1];
      const oB = originalRaw[srcIdx + 2];
      
      const rR = renderedResized[srcIdx];
      const rG = renderedResized[srcIdx + 1];
      const rB = renderedResized[srcIdx + 2];
      
      // Blend based on mask
      outputBuffer[dstIdx] = Math.round(oR * (1 - alpha) + rR * alpha);
      outputBuffer[dstIdx + 1] = Math.round(oG * (1 - alpha) + rG * alpha);
      outputBuffer[dstIdx + 2] = Math.round(oB * (1 - alpha) + rB * alpha);
      outputBuffer[dstIdx + 3] = 255;
    }
    
    const composited = await sharp(outputBuffer, {
      raw: { width, height, channels: 4 }
    })
      .png()
      .toBuffer();
    
    const resultBase64 = `data:image/png;base64,${composited.toString('base64')}`;
    
    console.log(`   ✅ Smooth composite complete`);
    
    return {
      success: true,
      imageBase64: resultBase64,
      deltaPercentage
    };
    
  } catch (error) {
    console.error(`❌ Smooth composite error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Composite error'
    };
  }
}
