import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

async function downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  let mimeType = response.headers.get('content-type') || 'image/jpeg';
  if (!mimeType.startsWith('image/')) {
    mimeType = 'image/jpeg';
  }
  
  return { data: base64, mimeType };
}

const DETAILED_ANALYSIS_PROMPT = `You are an expert furniture designer analyzing this product image for exact reproduction in AI-generated interior designs. Provide an extremely detailed visual description that would allow an AI image generator to recreate this furniture piece with precision.

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

5. **DIMENSIONAL DETAILS**
   - Visible thickness measurements (cushion depth, armrest width, table top thickness)
   - Height relationships (seat to armrest, table to leg junction)
   - Spacing measurements (slat gaps, button tufting distance, cushion segments)
   - Overhang measurements (table top beyond legs, seat beyond frame)

6. **DESIGN DETAILS & ORNAMENTATION**
   - Hardware specifics (handle shape, hinge type, visible fastener style)
   - Decorative elements (nailhead trim spacing and size, carved details, inlay patterns)
   - Edge treatments (beveled/bullnose/square with exact radius)
   - Corner details (mitred/butt/rounded with specific angles)
   - Transition details between materials or surfaces

7. **JOINERY & CONSTRUCTION VISIBLE DETAILS**
   - Leg attachment method (flush/inset/protruding by X inches)
   - Corner construction (visible dovetails/mortise-tenon/dowels)
   - Seam placement and treatment
   - Panel construction (solid vs. frame-and-panel)

8. **UPHOLSTERY SPECIFICS** (if applicable)
   - Cushion construction type (box/knife-edge/waterfall)
   - Tufting style (button/channel/biscuit with spacing)
   - Seam details (welt cord diameter, contrast piping, double-needle)
   - Fill appearance (firm/soft/medium with visible compression)
   - Fabric direction and pattern alignment

**OUTPUT FORMAT:**
Write a single flowing paragraph (300-400 words) that integrates ALL these details naturally. Begin with the most distinctive overall feature, then systematically describe the piece from top to bottom or outside to inside. Use precise measurements, exact color descriptions, and specific material names throughout.`;

/**
 * Analyze a single image with Gemini Vision
 */
async function analyzeImageWithGemini(
  imageUrl: string,
  imageName: string
): Promise<string> {
  console.log(`  🔍 Analyzing ${imageName} with Gemini Vision...`);
  
  try {
    const { data, mimeType } = await downloadImageAsBase64(imageUrl);
    
    const model = ai.getModel({
      model: "gemini-2.0-flash-exp",
    });
    
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: DETAILED_ANALYSIS_PROMPT },
          {
            inlineData: {
              data,
              mimeType,
            },
          },
        ],
      }],
    });
    
    const description = result.text?.trim() || '';
    
    if (description) {
      console.log(`  ✅ ${imageName} analyzed (${description.length} chars)`);
    } else {
      console.warn(`  ⚠️  ${imageName} returned empty description`);
    }
    
    return description;
  } catch (error: any) {
    console.error(`  ❌ Failed to analyze ${imageName}:`, error.message);
    throw error;
  }
}

/**
 * Get front view image from array of image URLs
 */
function getFrontViewImage(imageUrls: string[]): string | null {
  const frontViewImage = imageUrls.find(url => 
    url.toLowerCase().includes('front view') || 
    url.toLowerCase().includes('front_view') ||
    url.toLowerCase().includes('frontview')
  );
  
  if (frontViewImage) {
    return frontViewImage;
  }
  
  if (imageUrls.length === 1) {
    console.log(`  💡 Single image - treating as front view`);
    return imageUrls[0];
  }
  
  return null;
}

/**
 * Synthesize multiple analyses into one combined description
 */
function synthesizeMultipleAnalyses(analyses: string[]): string {
  if (analyses.length === 0) return '';
  if (analyses.length === 1) return analyses[0];
  
  return `COMPREHENSIVE MULTI-ANGLE ANALYSIS: ${analyses.join(' ')}`;
}

export interface GeminiAnalysisResult {
  visualDescriptionGemini: string;
  visualDescriptionFrontViewGemini: string;
  synthesizedDescription: string;
  success: boolean;
  error?: string;
}

/**
 * Analyze product using ONLY Gemini for both front view and combined analysis
 * 
 * This function:
 * 1. Identifies and analyzes the front view image separately
 * 2. Analyzes all images for a combined/comprehensive description
 * 3. Returns both descriptions for storage in separate fields
 */
export async function analyzeProductWithGemini(
  productName: string,
  imageUrls: string[]
): Promise<GeminiAnalysisResult> {
  console.log(`\n🎨 Gemini-only analysis for: ${productName}`);
  console.log(`  📸 ${imageUrls.length} image(s) available`);
  
  const result: GeminiAnalysisResult = {
    visualDescriptionGemini: '',
    visualDescriptionFrontViewGemini: '',
    synthesizedDescription: '',
    success: false,
  };
  
  if (imageUrls.length === 0) {
    result.error = 'No images provided';
    return result;
  }
  
  try {
    const frontViewImage = getFrontViewImage(imageUrls);
    
    // STEP 1: Analyze front view specifically (if exists)
    if (frontViewImage) {
      console.log(`  🎯 Analyzing FRONT VIEW separately...`);
      try {
        const frontViewDescription = await analyzeImageWithGemini(
          frontViewImage,
          'Front View'
        );
        result.visualDescriptionFrontViewGemini = frontViewDescription;
      } catch (error: any) {
        console.error(`  ⚠️  Front view analysis failed:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log(`  ℹ️  No front view image found`);
    }
    
    // STEP 2: Analyze all images for combined description
    console.log(`  🔄 Analyzing ALL images for combined description...`);
    const allAnalyses: string[] = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imageName = `Image ${i + 1}/${imageUrls.length}`;
      
      try {
        const analysis = await analyzeImageWithGemini(imageUrl, imageName);
        if (analysis) {
          allAnalyses.push(analysis);
        }
      } catch (error: any) {
        console.error(`  ⚠️  ${imageName} failed, continuing...`);
      }
      
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // STEP 3: Create combined/synthesized description
    if (allAnalyses.length > 0) {
      result.visualDescriptionGemini = synthesizeMultipleAnalyses(allAnalyses);
      result.synthesizedDescription = result.visualDescriptionGemini;
      console.log(`  ✅ Combined analysis complete (${result.visualDescriptionGemini.length} chars)`);
    }
    
    // Mark as successful if we got at least one description
    result.success = !!(result.visualDescriptionGemini || result.visualDescriptionFrontViewGemini);
    
    if (result.success) {
      console.log(`✅ Analysis complete for ${productName}`);
      if (result.visualDescriptionFrontViewGemini) {
        console.log(`  📊 Front View: ${result.visualDescriptionFrontViewGemini.length} chars`);
      }
      if (result.visualDescriptionGemini) {
        console.log(`  📊 Combined: ${result.visualDescriptionGemini.length} chars`);
      }
    } else {
      result.error = 'All analyses failed';
      console.error(`❌ Analysis failed for ${productName}`);
    }
    
  } catch (error: any) {
    result.error = error.message;
    console.error(`❌ Fatal error analyzing ${productName}:`, error.message);
  }
  
  return result;
}

/**
 * Batch analyze multiple products using ONLY Gemini
 */
export async function batchAnalyzeProductsWithGemini(
  products: Array<{ sku: string; name: string; images: string[] }>
): Promise<Array<{
  sku: string;
  visualDescriptionGemini: string;
  visualDescriptionFrontViewGemini: string;
  success: boolean;
  error?: string;
}>> {
  console.log(`\n🚀 Starting Gemini-only batch analysis of ${products.length} products...`);
  
  const results: Array<{
    sku: string;
    visualDescriptionGemini: string;
    visualDescriptionFrontViewGemini: string;
    success: boolean;
    error?: string;
  }> = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] ${product.name} (${product.sku})`);
    
    const analysis = await analyzeProductWithGemini(product.name, product.images);
    
    results.push({
      sku: product.sku,
      visualDescriptionGemini: analysis.visualDescriptionGemini,
      visualDescriptionFrontViewGemini: analysis.visualDescriptionFrontViewGemini,
      success: analysis.success,
      error: analysis.error,
    });
    
    if (i < products.length - 1) {
      console.log(`  ⏳ Waiting 5s before next product...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n✅ Batch analysis complete!`);
  console.log(`  Successful: ${successful}/${products.length}`);
  console.log(`  Failed: ${failed}/${products.length}`);
  
  return results;
}
