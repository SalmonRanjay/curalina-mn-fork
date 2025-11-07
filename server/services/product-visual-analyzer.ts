import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client with AI Integrations credentials
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

/**
 * Analyze a single product image using Gemini Vision
 * Returns detailed visual description of the product from that angle
 */
async function analyzeProductImage(imageUrl: string, imageName: string): Promise<string> {
  console.log(`  🔍 Analyzing image: ${imageName}`);
  
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: 'image/jpeg',
              fileUri: imageUrl
            }
          }
        ]
      }]
    });

    const description = response.text?.trim() || '';
    
    if (!description) {
      console.warn(`  ⚠️ No description returned for ${imageName}`);
      return '';
    }
    
    console.log(`  ✅ Analysis complete for ${imageName}`);
    return description;
  } catch (error) {
    console.error(`  ❌ Error analyzing ${imageName}:`, error);
    return '';
  }
}

/**
 * Analyze all images for a product and create comprehensive visual description
 * Combines insights from multiple angles for complete understanding
 */
export async function analyzeProductVisuals(
  productName: string,
  imageUrls: string[]
): Promise<string> {
  console.log(`\n🎨 Analyzing ${imageUrls.length} images for: ${productName}`);
  
  if (imageUrls.length === 0) {
    console.warn('  ⚠️ No images provided');
    return '';
  }
  
  // Analyze each image
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
      console.error(`  ❌ Failed to analyze ${imageName}, continuing...`);
      // Continue with other images even if one fails
    }
    
    // Delay to avoid rate limiting (8 seconds between images to prevent URL fetch queue overflow)
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  }
  
  if (analyses.length === 0) {
    console.warn('  ⚠️ No successful analyses');
    return '';
  }
  
  // If single image, return its analysis
  if (analyses.length === 1) {
    return analyses[0];
  }
  
  // Combine multiple angle analyses using Gemini
  console.log(`  🔄 Synthesizing ${analyses.length} analyses into comprehensive description...`);
  
  const synthesisPrompt = `You are a master furniture designer synthesizing multi-angle product analysis for AI-generated interior design. Below are ${analyses.length} extremely detailed visual descriptions from different views of the same furniture piece.

${analyses.map((desc, i) => `**VIEW ${i + 1}:**\n${desc}`).join('\n\n---\n\n')}

**SYNTHESIS REQUIREMENTS:**

Your task is to create ONE MASTER DESCRIPTION that combines all views into a complete, production-ready specification for AI image generation.

**CRITICAL RULES:**
1. **PRESERVE ALL PRECISE DETAILS**: Keep exact measurements, specific color codes, material names, and technical specifications from individual views
2. **RESOLVE CONTRADICTIONS**: If views conflict, use the most common or most detailed description
3. **ADD 360° COMPLETENESS**: Describe features visible from different angles (front, side, back, top) in logical sequence
4. **MAINTAIN SPECIFICITY**: Never generalize precise details - keep "warm charcoal gray #4A4A4A" not "dark gray"
5. **INTEGRATE SPATIAL RELATIONSHIPS**: Show how features connect across different views (e.g., "legs visible from front taper as seen in side view")

**STRUCTURE YOUR SYNTHESIS:**
- Start with overall form and dimensions from all angles
- Describe primary materials and colors with exact specifications
- Detail structural components visible from multiple perspectives
- Include distinctive features noting which angles reveal them
- Finish with finish quality, hardware, and lighting interaction

**LENGTH**: 400-500 words (longer is better to preserve all critical details)

**TONE**: Technical but flowing - like a master craftsperson describing a piece to an apprentice who must recreate it exactly.

**EXAMPLE SYNTHESIS:**
"This contemporary dining chair presents a refined blend of minimalist Scandinavian design and mid-century modern influences, measuring approximately 32 inches in height, 18 inches in width, and 20 inches in depth. From the front view, the chair features a gently curved backrest rising to 32 inches with a subtle 8-degree backward tilt, upholstered in warm taupe linen (#D2B48C) with a tight weave exhibiting 1mm horizontal texture lines. The seat, measuring 18 by 16 inches with a 17-inch height from floor, displays the same taupe linen over 3-inch thick high-density foam creating subtle cushioning without visible tufting. Side perspectives reveal four splayed solid walnut legs (1.75-inch square cross-section tapering to 1.25 inches at floor level) positioned at 12-degree outward angles for enhanced stability, each leg featuring hand-rubbed oil finish in medium walnut tone (#654321) with prominent vertical grain patterns. The rear view shows a concealed metal bracket system connecting the backrest to seat frame, with double-stitched seams in matching taupe thread running along all upholstery edges. From above, the seat reveals a waterfall edge treatment with 2-inch rounded front edge flowing into 90-degree back corners. Distinctive design elements include minimalist proportions, no visible hardware on exterior surfaces, and clean lines throughout with all joints concealed via mortise-and-tenon joinery visible only upon close inspection from underneath. The walnut legs display cathedral grain patterns most prominently on front-facing surfaces, while quarter-sawn grain appears on side surfaces. Surface finish quality includes hand-sanded edges with 1/8-inch rounded radius on all wood corners, matte linen upholstery with 5% sheen, and semi-gloss walnut finish at 40% sheen level. In natural lighting, the taupe linen appears warmer with golden undertones, while the walnut develops rich amber highlights; under artificial light, both materials adopt cooler, more neutral tones."

Now synthesize the product views above with this same level of comprehensive detail and precision.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: synthesisPrompt }]
      }]
    });

    const comprehensiveDescription = response.text?.trim() || analyses.join(' ');
    console.log(`  ✅ Comprehensive description created (${comprehensiveDescription.length} chars)`);
    
    return comprehensiveDescription;
  } catch (error) {
    console.error('  ❌ Error synthesizing descriptions:', error);
    // Fallback: join all descriptions
    return analyses.join(' ');
  }
}

/**
 * Batch analyze products - returns results for multiple products
 */
export async function batchAnalyzeProducts(
  products: Array<{ sku: string; name: string; images: string[] }>
): Promise<Array<{ sku: string; visualDescription: string; error?: string }>> {
  console.log(`\n🚀 Starting batch analysis of ${products.length} products...`);
  
  const results: Array<{ sku: string; visualDescription: string; error?: string }> = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] Processing: ${product.name} (${product.sku})`);
    
    try {
      const visualDescription = await analyzeProductVisuals(product.name, product.images);
      
      results.push({
        sku: product.sku,
        visualDescription
      });
      
      console.log(`✅ Success: ${product.sku}`);
    } catch (error) {
      console.error(`❌ Failed: ${product.sku}`, error instanceof Error ? error.message : 'Unknown error');
      results.push({
        sku: product.sku,
        visualDescription: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Longer delay between products to avoid overwhelming Gemini API (10 seconds)
    if (i < products.length - 1) {
      console.log(`⏸️ Waiting 10 seconds before next product to avoid rate limits...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  const successful = results.filter(r => r.visualDescription && !r.error).length;
  const failed = results.filter(r => r.error).length;
  
  console.log(`\n📊 Batch Analysis Complete:`);
  console.log(`  ✅ Successful: ${successful}/${products.length}`);
  console.log(`  ❌ Failed: ${failed}/${products.length}`);
  
  return results;
}
