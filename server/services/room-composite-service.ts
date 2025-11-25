/**
 * Room Composite Service - V2
 * 
 * Solves room architecture preservation with HARD binary compositing:
 * - Uses high threshold to ignore wall/lighting changes from Gemini
 * - Hard binary mask (no soft alpha that causes blur)
 * - Minimal edge feathering (only 1px at perimeter)
 * - Rejects large connected regions that are likely walls/doors
 * 
 * Result: Pixel-perfect original room + crisp furniture overlay
 */

import sharp from 'sharp';

interface CompositeResult {
  success: boolean;
  imageBase64?: string;
  deltaPercentage?: number;
  error?: string;
}

/**
 * IMPROVED: Hard binary composite with architectural rejection
 * 
 * Key improvements over V1:
 * 1. Higher threshold (45) to ignore Gemini's wall repainting
 * 2. Hard binary compositing - no soft alpha blending that causes blur
 * 3. Minimal edge feathering (1px) only at furniture perimeter
 * 4. Rejects edge-touching regions (likely walls/doors, not furniture)
 */
export async function compositeWithSmoothEdges(
  originalRoomBase64: string,
  renderedImageBase64: string,
  threshold: number = 45,  // RAISED from 25 to ignore wall changes
  edgeBlur: number = 1     // REDUCED from 2 to minimize blur
): Promise<CompositeResult> {
  try {
    console.log(`\n🎨 HARD BINARY COMPOSITING V2`);
    console.log(`   Threshold: ${threshold}, Edge blur: ${edgeBlur}px`);
    
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
    let edgeTouchingPixels = 0;
    
    // Track edge-touching changes (likely walls, not furniture)
    const edgeMargin = 5; // pixels from edge to consider "touching"
    
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      const x = i % width;
      const y = Math.floor(i / width);
      
      const oR = originalRaw[srcIdx];
      const oG = originalRaw[srcIdx + 1];
      const oB = originalRaw[srcIdx + 2];
      
      const rR = renderedResized[srcIdx];
      const rG = renderedResized[srcIdx + 1];
      const rB = renderedResized[srcIdx + 2];
      
      // Use MAX difference instead of average for better edge detection
      const diff = Math.max(
        Math.abs(oR - rR),
        Math.abs(oG - rG),
        Math.abs(oB - rB)
      );
      
      if (diff > threshold) {
        // Check if this pixel touches the image edge (likely a wall, not furniture)
        const touchesEdge = x < edgeMargin || x >= width - edgeMargin || 
                           y < edgeMargin || y >= height - edgeMargin;
        
        if (touchesEdge) {
          // Edge-touching change - likely a wall, skip it
          maskBuffer[i] = 0;
          edgeTouchingPixels++;
        } else {
          maskBuffer[i] = 255;
          changedPixels++;
        }
      } else {
        maskBuffer[i] = 0;
      }
    }
    
    const deltaPercentage = (changedPixels / pixelCount) * 100;
    const edgePercentage = (edgeTouchingPixels / pixelCount) * 100;
    
    console.log(`   Interior changes: ${deltaPercentage.toFixed(1)}%`);
    console.log(`   Edge changes (rejected): ${edgePercentage.toFixed(1)}%`);
    
    // ALWAYS composite to preserve original room architecture
    // Even with high delta, we extract furniture-like regions and overlay on original
    let workingMask = maskBuffer;
    
    if (deltaPercentage > 50) {
      console.log(`   ⚠️ HIGH DELTA (${deltaPercentage.toFixed(1)}%) - applying stricter furniture extraction`);
      
      // SECOND PASS: Re-run with MUCH higher threshold to only get obvious furniture
      const strictThreshold = threshold + 30; // Much stricter (e.g., 30 -> 60)
      console.log(`   🔧 Re-filtering with strict threshold: ${strictThreshold}`);
      
      const strictMask = Buffer.alloc(pixelCount);
      let strictChangedPixels = 0;
      
      for (let i = 0; i < pixelCount; i++) {
        const srcIdx = i * channels;
        const x = i % width;
        const y = Math.floor(i / width);
        
        const oR = originalRaw[srcIdx];
        const oG = originalRaw[srcIdx + 1];
        const oB = originalRaw[srcIdx + 2];
        
        const rR = renderedResized[srcIdx];
        const rG = renderedResized[srcIdx + 1];
        const rB = renderedResized[srcIdx + 2];
        
        const diff = Math.max(
          Math.abs(oR - rR),
          Math.abs(oG - rG),
          Math.abs(oB - rB)
        );
        
        // Higher threshold + larger edge margin
        const largeEdgeMargin = 10;
        const touchesEdge = x < largeEdgeMargin || x >= width - largeEdgeMargin || 
                           y < largeEdgeMargin || y >= height - largeEdgeMargin;
        
        if (diff > strictThreshold && !touchesEdge) {
          strictMask[i] = 255;
          strictChangedPixels++;
        } else {
          strictMask[i] = 0;
        }
      }
      
      const strictDelta = (strictChangedPixels / pixelCount) * 100;
      console.log(`   📊 After strict filter: ${strictDelta.toFixed(1)}% (was ${deltaPercentage.toFixed(1)}%)`);
      workingMask = strictMask;
    }
    
    // Apply minimal edge feathering then RE-BINARIZE to prevent gradient bleed
    let processedMask = workingMask;
    
    if (edgeBlur > 0) {
      // Very light blur just to soften edges
      const blurred = await sharp(workingMask, {
        raw: { width, height, channels: 1 }
      })
        .blur(edgeBlur)
        .raw()
        .toBuffer();
      
      // RE-BINARIZE after blur to prevent gradients
      // Only keep a thin soft rim (200-255 becomes 255, 180-199 gets blend, <180 becomes 0)
      processedMask = Buffer.alloc(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        const val = blurred[i];
        if (val >= 200) {
          processedMask[i] = 255; // Hard furniture
        } else if (val >= 180) {
          processedMask[i] = val; // Thin soft rim only
        } else {
          processedMask[i] = 0;   // Hard room
        }
      }
    }
    
    // Connected component rejection: find large regions that are likely walls
    // Simple flood-fill based area calculation
    // When delta is high, be STRICTER about what counts as furniture (smaller max)
    const maxRegionPercent = deltaPercentage > 50 ? 0.08 : 0.12; // 8% when high delta, 12% normal
    const maxFurnitureArea = pixelCount * maxRegionPercent;
    console.log(`   Max furniture region: ${(maxRegionPercent * 100).toFixed(0)}% of image`);
    const regionLabels = new Int32Array(pixelCount);
    let currentLabel = 0;
    const regionSizes: Map<number, number> = new Map();
    
    for (let i = 0; i < pixelCount; i++) {
      if (processedMask[i] > 0 && regionLabels[i] === 0) {
        currentLabel++;
        let regionSize = 0;
        const stack = [i];
        
        while (stack.length > 0) {
          const idx = stack.pop()!;
          if (regionLabels[idx] !== 0) continue;
          if (processedMask[idx] === 0) continue;
          
          regionLabels[idx] = currentLabel;
          regionSize++;
          
          const x = idx % width;
          const y = Math.floor(idx / width);
          
          // Check 4-neighbors
          if (x > 0) stack.push(idx - 1);
          if (x < width - 1) stack.push(idx + 1);
          if (y > 0) stack.push(idx - width);
          if (y < height - 1) stack.push(idx + width);
        }
        
        regionSizes.set(currentLabel, regionSize);
        
        // If region is too large, it's probably a wall - reject it
        if (regionSize > maxFurnitureArea) {
          console.log(`   🚫 Rejecting large region (${((regionSize / pixelCount) * 100).toFixed(1)}% of image) - likely wall`);
          for (let j = 0; j < pixelCount; j++) {
            if (regionLabels[j] === currentLabel) {
              processedMask[j] = 0;
            }
          }
        }
      }
    }
    
    // HARD BINARY COMPOSITE with re-binarized mask
    const outputBuffer = Buffer.alloc(pixelCount * 4);
    const hardThreshold = 200; // Only blend in very narrow rim (180-199)
    
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      const dstIdx = i * 4;
      
      const maskValue = processedMask[i];
      
      const oR = originalRaw[srcIdx];
      const oG = originalRaw[srcIdx + 1];
      const oB = originalRaw[srcIdx + 2];
      
      const rR = renderedResized[srcIdx];
      const rG = renderedResized[srcIdx + 1];
      const rB = renderedResized[srcIdx + 2];
      
      if (maskValue >= hardThreshold) {
        // HARD: Use rendered pixel (furniture interior)
        outputBuffer[dstIdx] = rR;
        outputBuffer[dstIdx + 1] = rG;
        outputBuffer[dstIdx + 2] = rB;
      } else if (maskValue >= 180) {
        // THIN SOFT RIM: Only 20-value range for blending (180-199)
        const alpha = (maskValue - 180) / 20; // 0.0 to 1.0 in narrow band
        outputBuffer[dstIdx] = Math.round(oR * (1 - alpha) + rR * alpha);
        outputBuffer[dstIdx + 1] = Math.round(oG * (1 - alpha) + rG * alpha);
        outputBuffer[dstIdx + 2] = Math.round(oB * (1 - alpha) + rB * alpha);
      } else {
        // HARD: Use original pixel (room)
        outputBuffer[dstIdx] = oR;
        outputBuffer[dstIdx + 1] = oG;
        outputBuffer[dstIdx + 2] = oB;
      }
      outputBuffer[dstIdx + 3] = 255;
    }
    
    const composited = await sharp(outputBuffer, {
      raw: { width, height, channels: 4 }
    })
      .png()
      .toBuffer();
    
    const resultBase64 = `data:image/png;base64,${composited.toString('base64')}`;
    
    console.log(`   ✅ Hard binary composite complete - room preserved`);
    
    return {
      success: true,
      imageBase64: resultBase64,
      deltaPercentage
    };
    
  } catch (error) {
    console.error(`❌ Composite error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Composite error'
    };
  }
}

/**
 * Simple hard composite without any blending
 * Use this if the smooth version still has issues
 */
export async function compositeHardBinary(
  originalRoomBase64: string,
  renderedImageBase64: string,
  threshold: number = 50
): Promise<CompositeResult> {
  try {
    console.log(`\n🎨 PURE HARD BINARY COMPOSITE`);
    
    const originalData = originalRoomBase64.replace(/^data:image\/\w+;base64,/, '');
    const renderedData = renderedImageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    const originalBuffer = Buffer.from(originalData, 'base64');
    const renderedBuffer = Buffer.from(renderedData, 'base64');
    
    const originalMeta = await sharp(originalBuffer).metadata();
    const width = originalMeta.width!;
    const height = originalMeta.height!;
    
    const originalRaw = await sharp(originalBuffer).raw().toBuffer();
    const renderedResized = await sharp(renderedBuffer)
      .resize(width, height, { fit: 'fill' })
      .raw()
      .toBuffer();
    
    const channels = 3;
    const pixelCount = width * height;
    const outputBuffer = Buffer.alloc(pixelCount * 4);
    
    let changedPixels = 0;
    const edgeMargin = 10;
    
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      const dstIdx = i * 4;
      const x = i % width;
      const y = Math.floor(i / width);
      
      const oR = originalRaw[srcIdx];
      const oG = originalRaw[srcIdx + 1];
      const oB = originalRaw[srcIdx + 2];
      
      const rR = renderedResized[srcIdx];
      const rG = renderedResized[srcIdx + 1];
      const rB = renderedResized[srcIdx + 2];
      
      const diff = Math.max(
        Math.abs(oR - rR),
        Math.abs(oG - rG),
        Math.abs(oB - rB)
      );
      
      // Reject edge-touching changes (walls)
      const touchesEdge = x < edgeMargin || x >= width - edgeMargin || 
                         y < edgeMargin || y >= height - edgeMargin;
      
      if (diff > threshold && !touchesEdge) {
        // Use rendered (furniture)
        outputBuffer[dstIdx] = rR;
        outputBuffer[dstIdx + 1] = rG;
        outputBuffer[dstIdx + 2] = rB;
        changedPixels++;
      } else {
        // Use original (room)
        outputBuffer[dstIdx] = oR;
        outputBuffer[dstIdx + 1] = oG;
        outputBuffer[dstIdx + 2] = oB;
      }
      outputBuffer[dstIdx + 3] = 255;
    }
    
    const deltaPercentage = (changedPixels / pixelCount) * 100;
    console.log(`   Changed: ${deltaPercentage.toFixed(1)}%`);
    
    const composited = await sharp(outputBuffer, {
      raw: { width, height, channels: 4 }
    })
      .png()
      .toBuffer();
    
    const resultBase64 = `data:image/png;base64,${composited.toString('base64')}`;
    
    return {
      success: true,
      imageBase64: resultBase64,
      deltaPercentage
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Composite error'
    };
  }
}
