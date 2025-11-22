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

const VALIDATION_PROMPT = `You just provided a detailed product description. Now review it against the image to verify accuracy.

**VALIDATION CHECKLIST:**
1. Does the color description match what you see in the image? (Rate 1-5: 1=inaccurate, 5=perfect match)
2. Are dimensions reasonable given what's visible? (Rate 1-5)
3. Does the material type match visible textures? (Rate 1-5)
4. Are all distinctive features mentioned? (Rate 1-5)
5. Are there any discrepancies between the description and image?

**RESPOND IN JSON FORMAT:**
{
  "validationScore": <overall 1-5 rating>,
  "colorAccuracy": <1-5>,
  "dimensionRealism": <1-5>,
  "materialMatch": <1-5>,
  "completeness": <1-5>,
  "discrepancies": [<list any differences between description and image>],
  "corrections": "<any refinements needed to the description>",
  "confidence": <0-100 percentage of how well this description would reproduce the exact product>
}`;

const SUMMARY_PROMPT = `Condense the detailed product description into a SHORT technical specification (max 400 characters) suitable for AI image generation. Focus on the most critical identifying features: PRIMARY COLOR, MATERIAL, KEY SHAPE/SILHOUETTE, and 1-2 DISTINCTIVE FEATURES.

Example format: "Mid-century oak dining chair with tapered legs, warm caramel seat cushion, angled backrest, visible joinery"

Do NOT include paragraphs - just essential details separated by commas.`;

/**
 * Analyze a single image with Gemini Vision - DETAILED ANALYSIS
 */
async function analyzeImageWithGemini(
  imageUrl: string,
  imageName: string
): Promise<{ detailed: string; summary: string; confidence: number }> {
  console.log(`  🔍 Analyzing ${imageName} with Gemini Vision...`);
  
  try {
    const { data, mimeType } = await downloadImageAsBase64(imageUrl);
    
    const model = ai.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
    });
    
    // STEP 1: Generate detailed analysis
    console.log(`  📝 Generating detailed description...`);
    const detailedResult = await model.generateContent({
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
    
    const detailedDescription = detailedResult.text?.trim() || '';
    
    if (!detailedDescription) {
      console.warn(`  ⚠️  ${imageName} returned empty description`);
      return { detailed: '', summary: '', confidence: 0 };
    }
    
    // STEP 2: Validate description against image
    console.log(`  ✔️  Validating description against image...`);
    let validationData = { confidence: 75 };
    try {
      const validationResult = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: `${VALIDATION_PROMPT}\n\nDescription to validate:\n${detailedDescription}` },
            {
              inlineData: {
                data,
                mimeType,
              },
            },
          ],
        }],
      });
      
      const validationText = validationResult.text?.trim() || '';
      const jsonMatch = validationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validationData = JSON.parse(jsonMatch[0]);
      }
    } catch (validationError: any) {
      console.warn(`  ⚠️  Validation failed: ${validationError.message}, using default confidence`);
    }
    
    // STEP 3: Extract summary (max 400 chars)
    console.log(`  📋 Extracting technical summary...`);
    let summary = '';
    try {
      const summaryResult = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: `${SUMMARY_PROMPT}\n\nFull description:\n${detailedDescription}` },
          ],
        }],
      });
      
      summary = summaryResult.text?.trim() || '';
      if (summary.length > 400) {
        summary = summary.substring(0, 400) + '...';
      }
    } catch (summaryError: any) {
      console.warn(`  ⚠️  Summary extraction failed: ${summaryError.message}`);
      summary = detailedDescription.substring(0, 400);
    }
    
    const confidence = Math.min(100, Math.max(0, validationData.confidence || 75));
    console.log(`  ✅ ${imageName} analyzed (detailed: ${detailedDescription.length} chars, summary: ${summary.length} chars, confidence: ${confidence}%)`);
    
    return { detailed: detailedDescription, summary, confidence };
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
 * Synthesize multiple analyses into combined descriptions
 */
function synthesizeMultipleAnalyses(analyses: Array<{ detailed: string; summary: string; confidence: number }>): { detailed: string; summary: string; avgConfidence: number } {
  if (analyses.length === 0) return { detailed: '', summary: '', avgConfidence: 0 };
  if (analyses.length === 1) return { detailed: analyses[0].detailed, summary: analyses[0].summary, avgConfidence: analyses[0].confidence };
  
  // Combine detailed descriptions
  const detailedCombined = `COMPREHENSIVE MULTI-ANGLE ANALYSIS: ${analyses.map(a => a.detailed).join(' ')}`;
  
  // Merge summaries - take the best one or combine key elements
  const summaries = analyses.filter(a => a.summary).map(a => a.summary);
  let summaryCombined = summaries[0] || '';
  if (summaryCombined.length > 400) {
    summaryCombined = summaryCombined.substring(0, 400) + '...';
  }
  
  // Calculate average confidence
  const avgConfidence = Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length);
  
  return { detailed: detailedCombined, summary: summaryCombined, avgConfidence };
}

export interface GeminiAnalysisResult {
  visualDescription: string;
  shortDescription: string;
  confidence: number;
  success: boolean;
  error?: string;
}

/**
 * Analyze product using ONLY Gemini with PRECISION STRATEGY:
 * 1. Multi-stage validation: detailed description → validation against image → confidence scoring
 * 2. Two-tier output: detailed technical description + short 400-char summary
 * 3. All images analyzed for comprehensive multi-angle perspective
 */
export async function analyzeProductWithGemini(
  productName: string,
  imageUrls: string[]
): Promise<GeminiAnalysisResult> {
  console.log(`\n🎨 Gemini PRECISION ANALYSIS for: ${productName}`);
  console.log(`  📸 ${imageUrls.length} image(s) available`);
  
  const result: GeminiAnalysisResult = {
    visualDescription: '',
    shortDescription: '',
    confidence: 0,
    success: false,
  };
  
  if (imageUrls.length === 0) {
    result.error = 'No images provided';
    return result;
  }
  
  try {
    // Analyze all images with validation and summaries
    console.log(`  🔄 Analyzing ALL images with multi-stage validation...`);
    const allAnalyses: Array<{ detailed: string; summary: string; confidence: number }> = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imageName = `Image ${i + 1}/${imageUrls.length}`;
      
      try {
        const analysis = await analyzeImageWithGemini(imageUrl, imageName);
        if (analysis.detailed) {
          allAnalyses.push(analysis);
        }
      } catch (error: any) {
        console.error(`  ⚠️  ${imageName} failed, continuing...`);
      }
      
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Synthesize all analyses with confidence scores
    if (allAnalyses.length > 0) {
      const synthesized = synthesizeMultipleAnalyses(allAnalyses);
      result.visualDescription = synthesized.detailed;
      result.shortDescription = synthesized.summary;
      result.confidence = synthesized.avgConfidence;
      console.log(`  ✅ Analysis complete (detailed: ${result.visualDescription.length} chars, summary: ${result.shortDescription.length} chars, confidence: ${result.confidence}%)`);
    }
    
    // Mark as successful if we got descriptions
    result.success = !!result.visualDescription && !!result.shortDescription;
    
    if (result.success) {
      console.log(`✅ PRECISION ANALYSIS complete for ${productName}`);
      console.log(`  📊 Detailed: ${result.visualDescription.length} chars | Summary: ${result.shortDescription.length} chars | Confidence: ${result.confidence}%`);
    } else {
      result.error = 'All analyses failed';
      console.error(`❌ PRECISION ANALYSIS failed for ${productName}`);
    }
    
  } catch (error: any) {
    result.error = error.message;
    console.error(`❌ Fatal error in PRECISION ANALYSIS for ${productName}:`, error.message);
  }
  
  return result;
}

/**
 * Batch analyze multiple products using PRECISION STRATEGY
 */
export async function batchAnalyzeProductsWithGemini(
  products: Array<{ sku: string; name: string; images: string[] }>
): Promise<Array<{
  sku: string;
  visualDescription: string;
  shortDescription: string;
  confidence: number;
  success: boolean;
  error?: string;
}>> {
  console.log(`\n🚀 Starting PRECISION Gemini batch analysis of ${products.length} products...`);
  
  const results: Array<{
    sku: string;
    visualDescription: string;
    shortDescription: string;
    confidence: number;
    success: boolean;
    error?: string;
  }> = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] ${product.name} (${product.sku})`);
    
    const analysis = await analyzeProductWithGemini(product.name, product.images);
    
    results.push({
      sku: product.sku,
      visualDescription: analysis.visualDescription,
      shortDescription: analysis.shortDescription,
      confidence: analysis.confidence,
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
  const avgConfidence = Math.round(results.filter(r => r.success).reduce((sum, r) => sum + r.confidence, 0) / (successful || 1));
  
  console.log(`\n✅ PRECISION Batch analysis complete!`);
  console.log(`  Successful: ${successful}/${products.length}`);
  console.log(`  Failed: ${failed}/${products.length}`);
  console.log(`  Average Confidence: ${avgConfidence}%`);
  
  return results;
}
