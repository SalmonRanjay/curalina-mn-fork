import OpenAI from "openai";

// This is using OpenAI's API with the newest model
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  // Get MIME type from response headers or URL
  let mimeType = response.headers.get('content-type') || 'image/jpeg';
  if (!mimeType.startsWith('image/')) {
    mimeType = 'image/jpeg'; // Default fallback
  }
  
  return { data: base64, mimeType };
}

/**
 * Analyze a single product image using OpenAI GPT-4 Vision
 * Returns detailed visual description of the product from that angle
 */
async function analyzeProductImage(imageUrl: string, imageName: string): Promise<string> {
  console.log(`  🔍 [OpenAI] Analyzing image: ${imageName}`);
  
  const prompt = `You are an expert furniture designer analyzing this product image for exact reproduction in AI-generated interior designs. Provide an extremely detailed visual description that would allow an AI image generator to recreate this furniture piece with precision.

**CRITICAL REQUIREMENTS:**
- Use SPECIFIC measurements when visible (e.g., "approximately 6 inches wide" not "narrow")
- Include EXACT color names and codes when possible (e.g., "warm charcoal gray #4A4A4A" not "dark gray")
- Describe textures with tactile precision (e.g., "tightly woven linen with 2mm raised texture" not "textured fabric")
- Note exact geometric shapes (e.g., "perfect 90-degree angles" or "gentle 15-degree curve")
- Specify material types precisely (e.g., "solid oak with quarter-sawn grain pattern" not "wood")

**DETAILED ANALYSIS FRAMEWORK:**

1. **OVERALL FORM & SILHOUETTE**
   - Exact shape description (rectangular, L-shaped, curved, asymmetric, etc.)
   - Precise proportions (width to depth to height ratios)
   - Design style with specific era/movement (e.g., "Mid-century modern Scandinavian, circa 1960s aesthetic")
   - Overall scale indicators (compact/standard/oversized with approximate dimensions)

2. **STRUCTURAL COMPONENTS**
   - Frame construction (visible joinery type, corner treatments)
   - Leg design (shape: tapered/straight/curved, attachment method, angle from vertical)
   - Leg dimensions (diameter/width, length, spacing from edges)
   - Support structures (stretchers, crossbars, base platforms with exact placement)
   - Weight distribution indicators

3. **MATERIALS & SURFACES**
   - Primary material with specific type (e.g., "white oak" not "wood", "full-grain leather" not "leather")
   - Wood grain pattern and direction (horizontal/vertical, tight/wide grain)
   - Metal type and finish (brushed brass, matte black steel, polished chrome)
   - Fabric weave type (bouclé, twill, herringbone, velvet pile depth)
   - Surface treatments (lacquer sheen level, oil finish, wax, powder coat)
   - Texture depth and pattern scale

4. **COLOR PALETTE - EXTREMELY SPECIFIC**
   - Dominant color with exact shade name (e.g., "Sherwin Williams Naval SW 6244" or "warm caramel brown with honey undertones")
   - Secondary colors with percentages (e.g., "10% brass accent trim")
   - Color temperature (warm/cool/neutral with kelvin reference if possible)
   - Finish sheen (matte/satin/semi-gloss/high-gloss with % sheen)
   - Color variations across surfaces (edge vs. center tones)
   - Undertones and how light affects the color

5. **DIMENSIONAL DETAILS**
   - Seat height, depth, and width (if applicable)
   - Armrest height and width (if applicable)
   - Backrest height and angle (if applicable)
   - Cushion thickness and depth
   - Gap widths between components
   - Border and trim widths
   - Any visible measurements or scale references

6. **DISTINCTIVE DESIGN ELEMENTS**
   - Unique curves (radius measurements, S-curves, compound curves)
   - Angular details (chamfers, bevels, miters with degree measurements)
   - Decorative patterns (geometric/organic, spacing, symmetry)
   - Carved or molded details (depth, style, placement)
   - Tufting/stitching patterns (diamond, channel, button placement grid)
   - Nailhead trim (size, spacing, finish)

7. **HARDWARE & FASTENERS**
   - Handle/pull style, material, finish, and dimensions
   - Hinge type and visibility
   - Decorative brackets or corner pieces (material, size, style)
   - Exposed vs. concealed fasteners
   - Hardware finish matching or contrasting with main piece

8. **FUNCTIONAL COMPONENTS**
   - Drawer configuration (number, size ratio, alignment)
   - Shelf count and spacing
   - Door styles (panel, glass, louvered)
   - Cushion construction (box edge, waterfall, knife edge)
   - Removable vs. fixed elements

9. **FINISH QUALITY & DETAILING**
   - Surface smoothness (hand-rubbed, machine-polished)
   - Edge treatments (rounded radius, sharp 90-degree, beveled)
   - Seam quality and visibility
   - Piping or welting details
   - Distressing or aging effects (intentional wear patterns, locations)

10. **LIGHTING INTERACTION**
    - How light reflects off surfaces (matte absorption vs. glossy reflection)
    - Shadow creation from overhangs or depth
    - Highlight zones (where light catches)
    - Texture visibility changes in different lighting

**OUTPUT FORMAT:**
Write a single flowing paragraph (300-400 words) that integrates ALL these details naturally. Begin with the most distinctive overall feature, then systematically describe the piece from top to bottom or outside to inside. Use precise measurements, exact color descriptions, and specific material names throughout.

**EXAMPLE EXCELLENT DESCRIPTION:**
"This is a low-profile modern sectional sofa measuring approximately 96 inches wide by 38 inches deep with an 18-inch seat height. The piece features a gently curved organic L-shape with a 15-degree arc along the backrest. Upholstered entirely in cream-colored Italian bouclé fabric (warm ivory #F5F5DC with slight yellow undertones), the textile has a tight 2mm loop pile creating a subtly nubby texture that catches light with a soft matte finish. The three-seater configuration includes three box-edge cushions, each measuring 30 inches wide and 6 inches thick with knife-edge seams. Rounded armrests at 24 inches high flow seamlessly into the backrest without visible breaks, creating an uninterrupted curved line. The backrest measures 32 inches at its highest point with a 12-degree recline angle for ergonomic comfort. Four tapered solid walnut legs (2.5 inches diameter at top, tapering to 1.5 inches at base) are positioned 4 inches inward from each corner, angled outward at 8 degrees from vertical. The walnut has a hand-rubbed oil finish in a rich chocolate-brown tone (#3E2723) with visible cathedral grain patterns running vertically. Legs attach via concealed metal brackets with no visible hardware. Clean modern lines throughout with no visible seams, buttons, or decorative stitching on the main surfaces. The bouclé fabric has a subtle directional nap that creates slight tonal variations in different lighting, appearing warmer in natural light and cooler under artificial light. All edges feature a 1-inch rounded radius with double-stitched reinforcement. The overall aesthetic is Scandinavian minimalist with Japanese-influenced organic curves, circa 2020s contemporary design."

Now analyze this product image with the same level of detail and precision.`;

  try {
    // Download image as base64
    console.log(`  📥 [OpenAI] Downloading image...`);
    const { data, mimeType } = await downloadImageAsBase64(imageUrl);
    
    console.log(`  🤖 [OpenAI] Sending to GPT-4 Vision...`);
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${data}`
              }
            }
          ],
        },
      ],
      max_completion_tokens: 2048,
    });

    const description = response.choices[0].message.content?.trim() || '';
    
    if (!description) {
      console.warn(`  ⚠️ [OpenAI] No description returned for ${imageName}`);
      return '';
    }
    
    console.log(`  ✅ [OpenAI] Analysis complete for ${imageName}`);
    return description;
  } catch (error) {
    console.error(`  ❌ [OpenAI] Error analyzing ${imageName}:`, error);
    return '';
  }
}

/**
 * Find the Front View image URL from a list of image URLs
 * Front View images are the main product images that start with "Front View"
 */
function getFrontViewImage(imageUrls: string[]): string | null {
  // Look for image URL that contains "Front View" (case insensitive)
  const frontViewImage = imageUrls.find(url => 
    url.toLowerCase().includes('front view') || 
    url.toLowerCase().includes('front_view') ||
    url.toLowerCase().includes('frontview')
  );
  return frontViewImage || null;
}

/**
 * Analyze all images for a product using OpenAI and create comprehensive visual description
 * Prioritizes Front View image for main analysis
 */
export async function analyzeProductVisualsWithOpenAI(
  productName: string,
  imageUrls: string[]
): Promise<string> {
  console.log(`\n🎨 [OpenAI] Analyzing ${imageUrls.length} images for: ${productName}`);
  
  if (imageUrls.length === 0) {
    console.warn('  ⚠️ [OpenAI] No images provided');
    return '';
  }
  
  // Prioritize Front View image for analysis
  const frontViewImage = getFrontViewImage(imageUrls);
  
  if (frontViewImage) {
    console.log(`  🎯 [OpenAI] Found Front View image - using as primary analysis source`);
    try {
      const description = await analyzeProductImage(frontViewImage, 'Front View (Primary)');
      if (description) {
        console.log(`  ✅ [OpenAI] Front View analysis complete`);
        return description;
      }
    } catch (error) {
      console.error(`  ⚠️ [OpenAI] Failed to analyze Front View, falling back to all images...`);
    }
  } else {
    console.log(`  ℹ️ [OpenAI] No Front View image found - analyzing all images`);
  }
  
  // Fallback: Analyze each image if no Front View or Front View analysis failed
  const analyses: string[] = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const imageName = `Image ${i + 1}/${imageUrls.length}`;
    
    try {
      const description = await analyzeProductImage(imageUrl, imageName);
      if (description) {
        analyses.push(description);
      }
    } catch (error) {
      console.error(`  ❌ [OpenAI] Failed to analyze ${imageName}, continuing...`);
      // Continue with other images even if one fails
    }
    
    // Delay to avoid rate limiting (5 seconds between images)
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (analyses.length === 0) {
    console.warn('  ⚠️ [OpenAI] No successful analyses');
    return '';
  }
  
  // If single image, return its analysis
  if (analyses.length === 1) {
    return analyses[0];
  }
  
  // Combine multiple angle analyses using OpenAI
  console.log(`  🔄 [OpenAI] Synthesizing ${analyses.length} analyses into comprehensive description...`);
  
  const synthesisPrompt = `You are a master furniture designer synthesizing multi-angle product analysis for AI-generated interior design. Below are ${analyses.length} extremely detailed visual descriptions from different views of the same furniture piece.

${analyses.map((desc, i) => `**VIEW ${i + 1}:**\n${desc}`).join('\n\n---\n\n')}

**SYNTHESIS REQUIREMENTS:**
1. Create ONE comprehensive master description (300-500 words) that captures ALL unique details from every view
2. Eliminate redundancy - mention each feature only once in its most complete form
3. Prioritize visible details over assumed features
4. Maintain the same precision and specificity as the input descriptions
5. Organize logically: overall form → structure → materials → colors → dimensions → unique details
6. Preserve ALL specific measurements, color codes, and material specifications
7. Note view-dependent features (e.g., "visible from the front," "hidden on rear")
8. Integrate contradictions intelligently (e.g., if one view shows drawer count and another doesn't mention it, include the count)

**OUTPUT:**
A single flowing paragraph that serves as the definitive visual blueprint for this product. An AI should be able to generate this exact piece from your description alone.`;

  try {
    const synthesisResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: synthesisPrompt
        }
      ],
      max_completion_tokens: 2048,
    });

    const synthesized = synthesisResponse.choices[0].message.content?.trim() || '';
    
    if (synthesized) {
      console.log(`  ✅ [OpenAI] Synthesis complete`);
      return synthesized;
    }
    
    // Fallback: concatenate if synthesis fails
    console.warn('  ⚠️ [OpenAI] Synthesis failed, concatenating analyses');
    return analyses.join(' ');
  } catch (error) {
    console.error('  ❌ [OpenAI] Synthesis error, concatenating analyses:', error);
    return analyses.join(' ');
  }
}
