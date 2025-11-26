import { GoogleGenAI, Modality } from "@google/genai";
import type { Product } from "@shared/schema";
import { applyQCRefinement } from "./stability-ai-qc";

// Initialize Gemini client using Replit AI Integrations
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

/**
 * Room analysis result with architecture description and estimated dimensions
 */
interface RoomAnalysisResult {
  architectureDescription: string;
  estimatedDimensions: {
    lengthFeet: number | null;
    widthFeet: number | null;
    ceilingHeightFeet: number | null;
    usableFloorArea: string;
    wallLengths: string[];
  };
  isEmptyRoom?: boolean; // True if room has no furniture (can skip lock pass)
}

/**
 * Render validation result from Gemini JSON output
 * Used to auto-fail bad renders before showing to user
 */
export interface RenderValidation {
  productsPlaced: string[];        // Names of products successfully placed
  missingProducts: string[];       // Products requested but not placed
  architecturalIntegrityScore: number; // 0-100 score for room preservation
  colorFidelityScore: number;      // 0-100 score for color accuracy
  scaleAccuracyScore: number;      // 0-100 score for proper scaling
  placementQualityScore: number;   // 0-100 score for furniture placement
  overallScore: number;            // Weighted average of all scores
  issues: string[];                // List of detected issues
  isValid: boolean;                // True if render passes quality thresholds
}

/**
 * Placement context for view-angle aware image selection
 */
interface PlacementContext {
  position: 'center' | 'left_wall' | 'right_wall' | 'back_wall' | 'corner' | 'floating';
  facing: 'forward' | 'left' | 'right' | 'angled';
  idealViewAngle: 'front' | 'side' | 'angle' | 'any';
}

/**
 * Comprehensive room analysis result with enhanced details for the three-step workflow
 */
interface EnhancedRoomAnalysis extends RoomAnalysisResult {
  wallDetails: string;           // Detailed wall description (color, texture, trim)
  floorDetails: string;          // Floor material, color, pattern
  windowDetails: string;         // Window positions, sizes, treatments
  lightingDetails: string;       // Natural and artificial lighting
  perspectiveDetails: string;    // Camera angle and viewpoint
  architecturalFeatures: string; // Built-ins, moldings, special features
}

/**
 * STEP 1: Enhanced Space Analysis
 * Thoroughly analyzes room architecture BEFORE any rendering
 * This comprehensive analysis is used for the final alignment pass
 * 
 * Workflow:
 * 1. Initial Space Analysis (this function) - Extract all room details
 * 2. First Render Generation - Focus on furniture/styling from quiz
 * 3. Final Alignment Pass - Composite furniture into original space
 */
async function analyzeRoomWithGeminiVision(roomImageBase64: string): Promise<RoomAnalysisResult> {
  const emptyResult: RoomAnalysisResult = {
    architectureDescription: '',
    estimatedDimensions: {
      lengthFeet: null,
      widthFeet: null,
      ceilingHeightFeet: null,
      usableFloorArea: 'unknown',
      wallLengths: []
    },
    isEmptyRoom: false
  };
  
  try {
    console.log(`\n🔍 STEP 1: COMPREHENSIVE SPACE ANALYSIS with Gemini Vision...`);
    
    // Extract base64 data
    const base64Data = roomImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = roomImageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            text: `Perform a COMPREHENSIVE architectural analysis of this room. This analysis will guide furniture placement and room preservation.

═══════════════════════════════════════════════════════════════════════════
SECTION 1 - FURNITURE STATUS
═══════════════════════════════════════════════════════════════════════════
Is this room EMPTY (no furniture) or FURNISHED (has existing furniture)?
Answer: [EMPTY or FURNISHED]
If FURNISHED, list each furniture piece with its approximate position.

═══════════════════════════════════════════════════════════════════════════
SECTION 2 - DETAILED ARCHITECTURE BREAKDOWN
═══════════════════════════════════════════════════════════════════════════

WALLS:
- Colors: [exact colors for each visible wall]
- Texture: [smooth, textured, wallpapered, etc.]
- Trim/Molding: [crown molding, baseboards, chair rails]
- Special features: [accent walls, wainscoting, exposed brick]

FLOOR:
- Material: [hardwood, tile, carpet, concrete, etc.]
- Color: [exact color/finish]
- Pattern: [herringbone, plank direction, tile pattern]
- Condition: [new, aged, distressed, polished]

WINDOWS:
- Count and positions: [left wall, right wall, back wall]
- Sizes: [small, medium, large, floor-to-ceiling]
- Treatments: [curtains, blinds, bare, sheers]
- Natural light: [direction, intensity, time of day feel]

DOORS:
- Count and positions: [where in the room]
- Style: [panel, glass, French, sliding]
- Color/finish: [match walls, contrasting, natural wood]

CEILING:
- Height: [standard ~8ft, tall ~10ft+, vaulted]
- Features: [beams, coffers, medallions, recessed]
- Color: [white, tinted, matching walls]

LIGHTING:
- Natural light direction: [from left, right, behind camera, multiple sources]
- Artificial fixtures: [visible fixtures, recessed lights, chandeliers]
- Overall mood: [bright and airy, moody, warm, cool]

PERSPECTIVE:
- Camera height: [eye level, low, elevated]
- Camera angle: [straight-on, angled left/right]
- Focal length feel: [wide angle, normal, compressed]
- Depth: [shallow room, deep room, L-shaped]

ARCHITECTURAL FEATURES:
- Built-ins: [shelving, fireplace, entertainment center]
- Niches/alcoves: [positions and sizes]
- Special elements: [columns, arches, exposed beams]

═══════════════════════════════════════════════════════════════════════════
SECTION 3 - SPATIAL DIMENSIONS
═══════════════════════════════════════════════════════════════════════════

Use these reference sizes for estimation:
- Standard door: 80"H x 36"W (6.7ft x 3ft)
- Standard window: 36-48" wide
- Standard ceiling: 8-10 feet
- Average person height: 5.5-6 feet

DIMENSIONS:
- Room length: [X] feet (estimated)
- Room width: [X] feet (estimated)
- Ceiling height: [X] feet (estimated)
- Primary furniture zone: [X] x [X] feet (main usable area)
- Available wall lengths: [list each wall with length]
- Usable floor area: [small/medium/large/very large]

═══════════════════════════════════════════════════════════════════════════
SECTION 4 - PRESERVATION PRIORITY (for final alignment)
═══════════════════════════════════════════════════════════════════════════

List the TOP 5 architectural elements that MUST be preserved exactly:
1. [Most important element and why]
2. [Second most important]
3. [Third most important]
4. [Fourth most important]
5. [Fifth most important]

Be PRECISE and DETAILED. This analysis ensures the final render matches your real space exactly.`
          },
          {
            inlineData: {
              data: base64Data,
              mimeType
            }
          }
        ]
      }]
    });
    
    const fullAnalysis = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (fullAnalysis.length > 0) {
      console.log(`   ✅ Comprehensive space analysis complete (${fullAnalysis.length} chars)`);
      
      // Parse the response to extract dimensions
      const dimensions = parseRoomDimensions(fullAnalysis);
      
      // Check if room is empty (no existing furniture)
      const isEmptyRoom = detectEmptyRoom(fullAnalysis);
      
      // Extract detailed architecture description (everything between SECTION 2 and SECTION 3)
      let archDesc = fullAnalysis;
      const section2Start = archDesc.indexOf('SECTION 2');
      const section3Start = archDesc.indexOf('SECTION 3');
      if (section2Start > 0 && section3Start > section2Start) {
        archDesc = archDesc.substring(section2Start, section3Start);
      }
      archDesc = archDesc.replace(/SECTION 2[^\n]*\n[═]+/g, '').trim();
      
      // Extract preservation priorities (Section 4)
      let preservationPriorities = '';
      const section4Start = fullAnalysis.indexOf('SECTION 4');
      if (section4Start > 0) {
        preservationPriorities = fullAnalysis.substring(section4Start);
        preservationPriorities = preservationPriorities.replace(/SECTION 4[^\n]*\n[═]+/g, '').trim();
      }
      
      console.log(`   📝 Architecture details extracted`);
      console.log(`   📐 Estimated dimensions: ~${dimensions.lengthFeet || '?'}ft x ${dimensions.widthFeet || '?'}ft, ceiling ${dimensions.ceilingHeightFeet || '?'}ft`);
      console.log(`   📏 Usable area: ${dimensions.usableFloorArea}`);
      console.log(`   🏠 Room status: ${isEmptyRoom ? 'EMPTY (optimized workflow)' : 'FURNISHED (full workflow)'}`);
      if (preservationPriorities) {
        console.log(`   🔒 Preservation priorities identified`);
      }
      
      // Combine architecture description with preservation priorities
      const fullArchDescription = preservationPriorities 
        ? `${archDesc}\n\n🔒 PRESERVATION PRIORITIES:\n${preservationPriorities}`
        : archDesc;
      
      return {
        architectureDescription: fullArchDescription,
        estimatedDimensions: dimensions,
        isEmptyRoom
      };
    }
    
    console.log(`   ⚠️ Room analysis returned empty`);
    return emptyResult;
  } catch (error) {
    console.error(`   ❌ Room analysis failed:`, error);
    return emptyResult;
  }
}

/**
 * STEP 3: Final Alignment Pass
 * Takes the generated furniture render and composites it into the original space
 * while preserving exact architectural details (walls, windows, floor, lighting, perspective)
 * 
 * This is the key to making rendered furniture look like it was photographed IN the user's actual room.
 */
async function executeFinalAlignmentPass(
  originalRoomBase64: string,
  furnishedRenderBase64: string,
  roomArchitectureAnalysis: string,
  productNames: string[]
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  try {
    console.log(`\n🎯 STEP 3: FINAL ALIGNMENT PASS`);
    console.log(`   Moving ${productNames.length} furniture pieces into original space...`);
    
    // Extract base64 data for both images
    const originalData = originalRoomBase64.replace(/^data:image\/\w+;base64,/, '');
    const originalMimeType = originalRoomBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    
    const renderData = furnishedRenderBase64.replace(/^data:image\/\w+;base64,/, '');
    const renderMimeType = furnishedRenderBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    
    const productList = productNames.join(', ');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
      contents: [{
        role: "user",
        parts: [
          {
            text: `FINAL ALIGNMENT TASK: Composite the furniture from Image 2 into the exact space shown in Image 1.

═══════════════════════════════════════════════════════════════════════════
IMAGE 1: USER'S ORIGINAL SPACE (THE EXACT ROOM TO USE)
═══════════════════════════════════════════════════════════════════════════
This is the user's actual room. Every architectural detail must be preserved EXACTLY:
- Walls: Same color, texture, trim, and moldings - pixel perfect
- Floor: Same material, color, pattern, reflections
- Windows: Same position, size, shape, treatments, and lighting
- Doors: Same position, style, and color
- Ceiling: Same height, color, features
- Camera angle: Same perspective, focal length, viewpoint
- Lighting: Same natural light direction and intensity
- Any existing built-ins or architectural features

${roomArchitectureAnalysis ? `ROOM ANALYSIS:\n${roomArchitectureAnalysis}` : ''}

═══════════════════════════════════════════════════════════════════════════
IMAGE 2: STYLED ROOM WITH FURNITURE (SOURCE OF FURNITURE)
═══════════════════════════════════════════════════════════════════════════
This image contains the styled furniture: ${productList}

Extract ONLY the furniture pieces from this image. Do NOT use the room/background from Image 2.

═══════════════════════════════════════════════════════════════════════════
YOUR TASK: CREATE THE FINAL COMPOSITE
═══════════════════════════════════════════════════════════════════════════

1. START with Image 1 as your base - this IS the room. Not inspiration. THE ACTUAL ROOM.

2. EXTRACT FURNITURE from Image 2:
   - Take each furniture piece exactly as it appears (shape, color, material, details)
   - Maintain the exact product appearance - these are specific products for purchase

3. PLACE FURNITURE into Image 1's space:
   - Position furniture naturally within Image 1's floor area
   - Match the lighting and shadows to Image 1's light sources
   - Ensure furniture scale matches Image 1's room proportions
   - All furniture must be fully visible and not overlapping

4. PRESERVE Image 1's architecture 100%:
   - Walls: Exact same color and texture
   - Floor: Exact same material and reflections
   - Windows: Same position with same light coming through
   - Ceiling: Same height and color
   - Camera perspective: Same viewpoint and angle

The result should look like the furniture was ACTUALLY PHOTOGRAPHED in the user's real room.
Any architectural changes = FAILURE. The room MUST look identical to Image 1, just with furniture added.`
          },
          {
            inlineData: {
              data: originalData,
              mimeType: originalMimeType
            }
          },
          {
            inlineData: {
              data: renderData,
              mimeType: renderMimeType
            }
          }
        ]
      }]
    });
    
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.log(`   ❌ Final alignment failed: No image generated`);
      return { success: false, error: 'No image generated in alignment pass' };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    console.log(`   ✅ Final alignment complete - furniture composited into original space`);
    
    return {
      success: true,
      imageBase64
    };
  } catch (error) {
    console.error(`   ❌ Final alignment failed:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Detect if a room is empty (no furniture) based on Gemini analysis
 * Used to optimize render pipeline by skipping unnecessary lock pass
 */
function detectEmptyRoom(analysisText: string): boolean {
  const lowerText = analysisText.toLowerCase();
  
  // Check for explicit EMPTY status
  if (lowerText.includes('answer: empty') || lowerText.includes('answer:empty')) {
    return true;
  }
  
  // Check for phrases indicating empty room
  const emptyIndicators = [
    'no furniture',
    'no existing furniture',
    'room is empty',
    'unfurnished',
    'bare room',
    'empty room',
    'no furnishings',
    'without furniture',
    'completely empty'
  ];
  
  const hasEmptyIndicator = emptyIndicators.some(indicator => lowerText.includes(indicator));
  
  // Check for furnished indicators (if these exist, room is NOT empty)
  const furnishedIndicators = [
    'answer: furnished',
    'answer:furnished',
    'existing furniture includes',
    'current furniture',
    'furnished with'
  ];
  
  const hasFurnishedIndicator = furnishedIndicators.some(indicator => lowerText.includes(indicator));
  
  // Return true only if empty indicators found AND no furnished indicators
  return hasEmptyIndicator && !hasFurnishedIndicator;
}

/**
 * Validate a rendered image using Gemini Vision
 * Returns structured validation JSON to auto-fail bad renders
 * This implements Google AI Studio's recommendation for structured output validation
 */
export async function validateRender(
  renderBase64: string,
  expectedProducts: string[],
  originalRoomBase64?: string
): Promise<RenderValidation> {
  const defaultValidation: RenderValidation = {
    productsPlaced: [],
    missingProducts: expectedProducts,
    architecturalIntegrityScore: 0,
    colorFidelityScore: 0,
    scaleAccuracyScore: 0,
    placementQualityScore: 0,
    overallScore: 0,
    issues: ['Validation failed'],
    isValid: false
  };
  
  try {
    console.log(`\n🔍 VALIDATING RENDER with Gemini Vision...`);
    
    // Extract base64 data
    const renderData = renderBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = renderBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    
    const parts: any[] = [
      {
        text: `Analyze this interior design render and provide a detailed quality assessment.

EXPECTED PRODUCTS TO FIND (ALL ${expectedProducts.length} must be 100% visible):
${expectedProducts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
EVALUATE EACH CRITERIA CAREFULLY:
═══════════════════════════════════════════════════════════════════════════════

1. PRODUCTS PLACED: List ONLY products you can FULLY see. Match against the expected list.

2. ARCHITECTURAL INTEGRITY (0-100): 
   - Walls, windows, floors, ceilings realistic and consistent?
   - Perspective correct and natural?
   - Lighting believable?

3. COLOR FIDELITY (0-100):
   - Furniture colors realistic (no artifacts or unnatural saturation)?
   - Colors appropriate for the materials shown?

4. SCALE ACCURACY (0-100):
   - Furniture properly scaled relative to room and each other?
   - Nothing too large or small for the space?

5. PLACEMENT QUALITY (0-100):
   - Furniture properly grounded (not floating)?
   - Logical placement (no blocking doors, adequate walkways)?
   - Good visual composition?

═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL - OCCLUSION & VISIBILITY CHECK:
═══════════════════════════════════════════════════════════════════════════════

6. OCCLUSION ANALYSIS - For EACH expected product, assess:
   - Is it 100% visible (no part hidden)?
   - Is any part obscured by another furniture piece?
   - Estimate visibility percentage (0-100%)

List ANY products that are:
- Partially hidden behind other furniture
- Obscured by larger items
- Cut off at frame edges
- Missing entirely

═══════════════════════════════════════════════════════════════════════════════

Respond in this EXACT JSON format:
{
  "productsPlaced": ["Product Name 1", "Product Name 2"],
  "missingProducts": ["Product Name 3"],
  "occludedProducts": [
    {"name": "Product Name", "visibilityPercent": 60, "occludedBy": "Sofa", "issue": "back half hidden"}
  ],
  "architecturalIntegrityScore": 85,
  "colorFidelityScore": 90,
  "scaleAccuracyScore": 80,
  "placementQualityScore": 75,
  "occlusionScore": 90,
  "issues": ["Issue 1 if any", "Issue 2 if any"]
}

IMPORTANT: 
- occlusionScore should be 100 if ALL products are 100% visible
- Deduct points for each partially hidden or overlapping product
- A product that is <80% visible should significantly lower the occlusionScore
- Be strict about visibility - this is critical for e-commerce accuracy`
      },
      { text: 'Rendered image to analyze:' },
      {
        inlineData: {
          data: renderData,
          mimeType
        }
      }
    ];
    
    // Add original room for comparison if available
    if (originalRoomBase64) {
      const originalData = originalRoomBase64.replace(/^data:image\/\w+;base64,/, '');
      const originalMimeType = originalRoomBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      parts.push({ text: 'Original room for comparison:' });
      parts.push({
        inlineData: {
          data: originalData,
          mimeType: originalMimeType
        }
      });
    }
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }]
    });
    
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (responseText.length === 0) {
      console.warn('   ⚠️ Empty validation response');
      return defaultValidation;
    }
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find raw JSON object
      const rawJsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (rawJsonMatch) {
        jsonStr = rawJsonMatch[0];
      }
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // Extract occlusion data
    const occludedProducts = parsed.occludedProducts || [];
    const occlusionScore = parsed.occlusionScore ?? 100;
    
    // Calculate overall score (weighted average - now includes occlusion)
    const overallScore = Math.round(
      (parsed.architecturalIntegrityScore || 0) * 0.25 +
      (parsed.colorFidelityScore || 0) * 0.20 +
      (parsed.scaleAccuracyScore || 0) * 0.20 +
      (parsed.placementQualityScore || 0) * 0.15 +
      (occlusionScore) * 0.20
    );
    
    // Determine if render is valid
    // - At least 70 overall score
    // - At least 80% products placed
    // - Occlusion score at least 75 (most products visible)
    // - No product with less than 50% visibility
    const productPlacementRate = parsed.productsPlaced?.length / expectedProducts.length || 0;
    const hasSevereOcclusion = occludedProducts.some((p: any) => p.visibilityPercent < 50);
    const isValid = overallScore >= 70 && 
                    productPlacementRate >= 0.8 && 
                    occlusionScore >= 75 &&
                    !hasSevereOcclusion;
    
    const validation: RenderValidation = {
      productsPlaced: parsed.productsPlaced || [],
      missingProducts: parsed.missingProducts || [],
      architecturalIntegrityScore: parsed.architecturalIntegrityScore || 0,
      colorFidelityScore: parsed.colorFidelityScore || 0,
      scaleAccuracyScore: parsed.scaleAccuracyScore || 0,
      placementQualityScore: parsed.placementQualityScore || 0,
      overallScore,
      issues: parsed.issues || [],
      isValid
    };
    
    console.log(`   ✅ Validation complete:`);
    console.log(`      Products: ${validation.productsPlaced.length}/${expectedProducts.length} placed`);
    console.log(`      Scores: Arch=${validation.architecturalIntegrityScore}, Color=${validation.colorFidelityScore}, Scale=${validation.scaleAccuracyScore}, Placement=${validation.placementQualityScore}`);
    console.log(`      Occlusion: ${occlusionScore}/100 (${occludedProducts.length} products with visibility issues)`);
    if (occludedProducts.length > 0) {
      console.log(`      Occluded products:`);
      occludedProducts.forEach((p: any) => {
        console.log(`         - ${p.name}: ${p.visibilityPercent}% visible (${p.issue})`);
      });
    }
    console.log(`      Overall: ${overallScore}/100 - ${isValid ? 'PASS' : 'FAIL'}`);
    if (!isValid) {
      const reasons = [];
      if (overallScore < 70) reasons.push(`low overall score (${overallScore})`);
      if (productPlacementRate < 0.8) reasons.push(`too few products visible (${Math.round(productPlacementRate * 100)}%)`);
      if (occlusionScore < 75) reasons.push(`occlusion issues (score ${occlusionScore})`);
      if (hasSevereOcclusion) reasons.push('severe occlusion (<50% visibility on some products)');
      console.log(`      Fail reasons: ${reasons.join(', ')}`);
    }
    if (validation.issues.length > 0) {
      console.log(`      Issues: ${validation.issues.join(', ')}`);
    }
    
    return validation;
    
  } catch (error) {
    console.error('   ❌ Render validation failed:', error);
    return defaultValidation;
  }
}

/**
 * Parse room dimensions from Gemini Vision analysis text
 */
function parseRoomDimensions(analysisText: string): RoomAnalysisResult['estimatedDimensions'] {
  const result: RoomAnalysisResult['estimatedDimensions'] = {
    lengthFeet: null,
    widthFeet: null,
    ceilingHeightFeet: null,
    usableFloorArea: 'unknown',
    wallLengths: []
  };
  
  try {
    // Extract room length
    const lengthMatch = analysisText.match(/Room length:\s*(\d+(?:\.\d+)?)\s*feet/i);
    if (lengthMatch) result.lengthFeet = parseFloat(lengthMatch[1]);
    
    // Extract room width
    const widthMatch = analysisText.match(/Room width:\s*(\d+(?:\.\d+)?)\s*feet/i);
    if (widthMatch) result.widthFeet = parseFloat(widthMatch[1]);
    
    // Extract ceiling height
    const ceilingMatch = analysisText.match(/Ceiling height:\s*(\d+(?:\.\d+)?)\s*feet/i);
    if (ceilingMatch) result.ceilingHeightFeet = parseFloat(ceilingMatch[1]);
    
    // Extract usable floor area category
    const areaMatch = analysisText.match(/Usable floor area:\s*(small|medium|large|very large)/i);
    if (areaMatch) result.usableFloorArea = areaMatch[1].toLowerCase();
    
    // Extract wall lengths (capture lines after "Available wall lengths:")
    const wallSection = analysisText.match(/Available wall lengths?:([^\n]*(?:\n(?!-\s*(?:Room|Ceiling|Usable))[^\n]*)*)/i);
    if (wallSection) {
      const wallLines = wallSection[1].split('\n').filter(line => line.trim());
      result.wallLengths = wallLines.map(line => line.trim()).filter(line => line.length > 0);
    }
  } catch (error) {
    console.warn('   ⚠️ Error parsing room dimensions:', error);
  }
  
  return result;
}

/**
 * Resolve relative URLs to absolute URLs for fetching
 * Handles /public-objects/... and other relative paths
 */
function resolveImageUrl(imageUrl: string): string {
  // If already absolute, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Resolve relative URLs using domain
  const domain = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
  const fullDomain = domain.startsWith('http') ? domain : `https://${domain}`;
  
  // Ensure URL starts with /
  const normalizedUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  
  return `${fullDomain}${normalizedUrl}`;
}

/**
 * Helper to fetch image and convert to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // Resolve relative URLs to absolute
    const absoluteUrl = resolveImageUrl(imageUrl);
    console.log(`  📥 Fetching: ${absoluteUrl}`);
    
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image ${absoluteUrl}: ${response.statusText}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Determine MIME type
    const contentType = response.headers.get('content-type');
    const mimeType = contentType || (imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg');
    
    return { data: base64, mimeType };
  } catch (error) {
    console.error(`Error fetching image ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Determine ideal placement context for a product based on its category
 * Used to select the best view angle (front, side, angle) for rendering
 */
function getPlacementContext(product: Product): PlacementContext {
  const category = detectFunctionalCategory(product);
  const name = product.name.toLowerCase();
  
  // Console tables go against walls - prefer side/angle view
  if (category === 'Console' || name.includes('console')) {
    return {
      position: 'back_wall',
      facing: 'forward',
      idealViewAngle: 'angle' // 3/4 view shows depth better
    };
  }
  
  // Sofas and sectionals - front view preferred
  if (category === 'Seating' || name.includes('sofa') || name.includes('sectional')) {
    return {
      position: 'center',
      facing: 'forward',
      idealViewAngle: 'front'
    };
  }
  
  // Side tables typically go next to sofas - angle view preferred
  if (category === 'Side Table' || name.includes('side table') || name.includes('end table')) {
    return {
      position: 'left_wall',
      facing: 'angled',
      idealViewAngle: 'angle'
    };
  }
  
  // Floor lamps in corners - angle view
  if (category === 'Floor Lamp' || name.includes('floor lamp')) {
    return {
      position: 'corner',
      facing: 'forward',
      idealViewAngle: 'angle'
    };
  }
  
  // Bookcases and storage against walls - angle view
  if (category === 'Storage' || name.includes('bookcase') || name.includes('shelf')) {
    return {
      position: 'left_wall',
      facing: 'forward',
      idealViewAngle: 'angle'
    };
  }
  
  // Default: front view for most items
  return {
    position: 'center',
    facing: 'forward',
    idealViewAngle: 'front'
  };
}

/**
 * Select best image for a product based on placement context
 * Implements view-angle awareness for better AI rendering
 * Priority: Ideal angle > Front view > First available
 */
function selectBestProductImage(product: Product, context: PlacementContext): string | null {
  if (!product.images || !Array.isArray(product.images) || product.images.length === 0) {
    return null;
  }
  
  const images = product.images.filter(img => img && typeof img === 'string' && img.trim().length > 0);
  if (images.length === 0) return null;
  
  // Helper to check URL for view type
  const urlContains = (url: string, patterns: string[]) => {
    const lowerUrl = url.toLowerCase();
    return patterns.some(p => lowerUrl.includes(p));
  };
  
  // Define patterns for each view type
  const viewPatterns = {
    front: ['front%20view', 'front_view', 'front view', 'frontview', 'front-view'],
    side: ['side%20view', 'side_view', 'side view', 'sideview', 'side-view', 'profile'],
    angle: ['angle%20view', 'angle_view', 'angle view', 'angleview', '3-4', '3_4', 'three-quarter', 'angled']
  };
  
  // 1. Try to find the ideal view angle for this placement
  if (context.idealViewAngle === 'side') {
    const sideView = images.find(url => urlContains(url, viewPatterns.side));
    if (sideView && isValidImageUrl(sideView)) {
      console.log(`   📸 Using SIDE VIEW for ${product.name} (wall placement)`);
      return sideView;
    }
  }
  
  if (context.idealViewAngle === 'angle') {
    const angleView = images.find(url => urlContains(url, viewPatterns.angle));
    if (angleView && isValidImageUrl(angleView)) {
      console.log(`   📸 Using ANGLE VIEW for ${product.name} (optimal perspective)`);
      return angleView;
    }
    // Fall back to side view if no angle view
    const sideView = images.find(url => urlContains(url, viewPatterns.side));
    if (sideView && isValidImageUrl(sideView)) {
      console.log(`   📸 Using SIDE VIEW for ${product.name} (fallback from angle)`);
      return sideView;
    }
  }
  
  // 2. Always try front view as primary fallback
  const frontView = images.find(url => urlContains(url, viewPatterns.front));
  if (frontView && isValidImageUrl(frontView)) {
    return frontView;
  }
  
  // 3. Last resort: first valid image
  const firstValid = images.find(url => isValidImageUrl(url));
  return firstValid || null;
}

/**
 * Select optimal view image for each product with view-angle awareness
 * Returns array of product images to use as references
 * NEW: Uses placement context to select side/angle views for wall-placed items
 */
function selectProductFrontViewImages(products: Product[]): { 
  selected: Array<{ url: string; productName: string; sku: string; viewType: string }>;
  dropped: Array<{ productName: string; sku: string; reason: string }>;
} {
  const selected: Array<{ url: string; productName: string; sku: string; viewType: string }> = [];
  const dropped: Array<{ productName: string; sku: string; reason: string }> = [];
  
  for (const product of products) {
    // Get placement context to determine ideal view angle
    const context = getPlacementContext(product);
    
    // Select best image based on context
    const imageUrl = selectBestProductImage(product, context);
    
    if (imageUrl && isValidImageUrl(imageUrl)) {
      // Determine which view type was actually selected
      const lowerUrl = imageUrl.toLowerCase();
      let viewType = 'unknown';
      if (lowerUrl.includes('front')) viewType = 'front';
      else if (lowerUrl.includes('side') || lowerUrl.includes('profile')) viewType = 'side';
      else if (lowerUrl.includes('angle') || lowerUrl.includes('3-4') || lowerUrl.includes('three')) viewType = 'angle';
      
      selected.push({
        url: imageUrl,
        productName: product.name,
        sku: product.sku,
        viewType
      });
    } else {
      const reason = !imageUrl ? 'No image URL found' : 'Invalid image URL format';
      dropped.push({ productName: product.name, sku: product.sku, reason });
      console.error(`❌ PRODUCT DROPPED: ${product.name} (${product.sku}) - ${reason}`);
      console.error(`   Images field: ${JSON.stringify(product.images)?.substring(0, 200)}`);
    }
  }
  
  if (dropped.length > 0) {
    console.error(`\n🚨 WARNING: ${dropped.length} product(s) will NOT appear in render due to missing/invalid images:`);
    dropped.forEach(d => console.error(`   - ${d.productName} (${d.sku}): ${d.reason}`));
    console.error(`\n`);
  }
  
  return { selected, dropped };
}

/**
 * Validate image URL
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  
  // Check for valid URL formats
  const isExternalUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
  const isObjectStorage = trimmed.startsWith('/public-objects/') || trimmed.startsWith('/private-objects/');
  const isS3Path = trimmed.includes('s3.amazonaws.com') || trimmed.includes('curalina');
  
  return isExternalUrl || isObjectStorage || isS3Path;
}

/**
 * Detect functional category from product name and description
 */
function detectFunctionalCategory(product: Product): string {
  const name = product.name.toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const combined = `${name} ${desc}`;
  
  if (combined.includes('sofa') || combined.includes('couch') || combined.includes('sectional')) return 'Seating';
  if (combined.includes('chair') || combined.includes('armchair') || combined.includes('accent chair')) return 'Seating';
  if (combined.includes('coffee table')) return 'Coffee Table';
  if (combined.includes('side table') || combined.includes('end table') || combined.includes('accent table')) return 'Side Table';
  if (combined.includes('dining table')) return 'Dining Table';
  if (combined.includes('console') || combined.includes('sideboard') || combined.includes('credenza')) return 'Console';
  if (combined.includes('bookshelf') || combined.includes('bookcase') || combined.includes('shelf')) return 'Storage';
  if (combined.includes('cabinet') || combined.includes('dresser') || combined.includes('chest')) return 'Storage';
  if (combined.includes('floor lamp')) return 'Floor Lamp';
  if (combined.includes('table lamp')) return 'Table Lamp';
  if (combined.includes('pendant') || combined.includes('chandelier')) return 'Pendant Light';
  if (combined.includes('lamp')) return 'Lighting';
  if (combined.includes('rug') || combined.includes('carpet')) return 'Rug';
  if (combined.includes('mirror')) return 'Mirror';
  if (combined.includes('plant') || combined.includes('vase') || combined.includes('art')) return 'Decor';
  if (combined.includes('ottoman') || combined.includes('pouf')) return 'Ottoman';
  if (combined.includes('bench')) return 'Bench';
  if (combined.includes('bed') || combined.includes('headboard')) return 'Bed';
  if (combined.includes('nightstand') || combined.includes('bedside')) return 'Nightstand';
  
  return 'Furniture';
}

/**
 * Get smart placement directive based on product category
 * Returns specific instructions for WHERE to place the product
 */
function getPlacementDirective(category: string, productIndex: number, totalProducts: number): string {
  const placementRules: Record<string, string> = {
    'Seating': 'Place as the main seating element in the conversation area, facing the focal point. Position with back against or angled toward a wall, leaving walkway clearance.',
    'Coffee Table': 'Position centrally in front of the main sofa/seating, leaving 16-18 inches between seating and table for comfortable access.',
    'Side Table': 'Place adjacent to seating - next to a sofa arm or beside an accent chair. Ensure the table top is roughly level with the arm height.',
    'Dining Table': 'Center in the dining area with equal clearance on all sides for chair pullout. Position under pendant lighting if present.',
    'Console': 'Position against a wall - behind a sofa, in an entryway, or against a focal wall. Leave 3-4 inches from wall.',
    'Storage': 'Place against a wall, away from windows. Align with room architecture and other furniture lines.',
    'Floor Lamp': 'Position behind or beside seating to provide reading/ambient light. Place in a corner or next to a sofa arm.',
    'Table Lamp': 'Place on a side table or console. Position to provide functional lighting for adjacent seating.',
    'Pendant Light': 'Suspend from ceiling over dining table, kitchen island, or as a focal point. Center over the furniture below.',
    'Lighting': 'Position to provide ambient or task lighting. Place near seating areas or as accent lighting.',
    'Rug': 'Center under the main furniture grouping. Front legs of seating should rest on the rug. Size should define the conversation area.',
    'Mirror': 'Mount on a wall opposite or adjacent to windows to reflect light. Position at eye level or above a console.',
    'Decor': 'Place on surfaces (consoles, shelves, coffee tables) or as floor elements in corners. Use to fill vertical space.',
    'Ottoman': 'Position in front of or adjacent to main seating. Can serve as extra seating or footrest.',
    'Bench': 'Place at the foot of a bed, in an entryway, or along a wall as additional seating.',
    'Bed': 'Center against the main wall, with nightstand space on both sides. Position with headboard against the wall.',
    'Nightstand': 'Place on each side of the bed, close enough for reaching from the bed. Align tops with mattress height.',
    'Furniture': 'Position in a visually balanced arrangement with other furniture. Maintain walkway clearance and sight lines.'
  };
  
  return placementRules[category] || placementRules['Furniture'];
}

/**
 * Get visual details from product for prompt
 */
function getProductVisualDetails(product: Product): string {
  const details: string[] = [];
  
  // Add colors
  if (product.colors && product.colors.length > 0) {
    details.push(product.colors.join(' and '));
  }
  
  // Add materials
  if (product.materials && product.materials.length > 0) {
    details.push(product.materials.slice(0, 2).join(' and '));
  }
  
  // Add condensed description if available
  if (product.visualDescription) {
    const condensed = product.visualDescription.substring(0, 150);
    details.push(condensed);
  }
  
  return details.join('. ') || 'Use the exact appearance from the reference image';
}

/**
 * Format dimensions for prompt
 */
function formatDimensions(dimensions: any): string {
  if (!dimensions) return '';
  
  if (dimensions.w && dimensions.d && dimensions.h) {
    const unit = dimensions.unit || 'inches';
    return `${dimensions.w}x${dimensions.d}x${dimensions.h} ${unit}`;
  }
  
  return '';
}

export interface ImageOnlyRenderParams {
  roomImageUrl: string;
  products: Product[];
  roomType?: string;
  stylePreference?: string;
  sharedPrompt?: string; // Pre-built prompt from shared-prompt-builder (for fair comparison)
  floorPlanAnalysis?: {
    roomDimensions: string;
    windowLocations: string[];
    doorLocations: string[];
    builtInFeatures: string[];
    ceilingRoofDesign: string;
    layoutNotes: string;
    overallDescription: string;
  };
  placementInstructions?: string; // Spatial guidance for furniture placement
  roomDescription?: string; // User's text-based room specification (dimensions, windows, doors)
  parsedRoomData?: {
    dimensions?: { width?: number; depth?: number; height?: number; unit?: string };
    doorway?: { width?: number; height?: number; unit?: string };
    ceilingHeight?: number;
    confidence?: number;
    warnings?: string[];
    rawText?: string;
  };
}

export interface ImageOnlyRenderResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  productsUsed: number;
  productsSentToAI?: string[]; // SKUs of products actually sent to AI (after image filtering)
  droppedProducts?: Array<{ productName: string; sku: string; reason: string }>; // Products excluded due to image issues
}

/**
 * Build the "Anchor & Composite" prompt based on Google AI Studio's strategy
 * 
 * Strategy:
 * 1. The Anchor (Structure): User's room photo as first reference - preserve geometry
 * 2. The Composites (Products): Actual cropped product images as secondary references
 * 
 * The prompt explicitly references each image and instructs Gemini to use THOSE EXACT objects.
 */
function buildAnchorCompositePrompt(
  products: Product[],
  productRefs: Array<{ url: string; productName: string; sku: string }>,
  roomType?: string,
  stylePreference?: string,
  hasRoomImage?: boolean,
  floorPlanAnalysis?: any,
  placementInstructions?: string,
  roomDescription?: string,
  parsedRoomData?: ImageOnlyRenderParams['parsedRoomData']
): string {
  // Extract style context
  const style = stylePreference || 'Modern';
  const room = roomType || 'living room';
  
  const totalProducts = productRefs.length;
  
  // Build product placement instructions with specific spatial directives
  const productInstructions = productRefs.map((ref, index) => {
    const product = products.find(p => p.sku === ref.sku);
    const category = product ? detectFunctionalCategory(product) : 'Furniture';
    const visualDetails = product ? getProductVisualDetails(product) : '';
    const dimensions = product ? formatDimensions(product.dimensions) : '';
    const placementDirective = getPlacementDirective(category, index, totalProducts);
    
    const imageNum = hasRoomImage ? index + 2 : index + 1; // Room is REFERENCE IMAGE 1 if present
    
    let instruction = `REFERENCE IMAGE ${imageNum}: [${category}] ${ref.productName}.
ACTION: Place this EXACT item in the room using the following placement:
PLACEMENT: ${placementDirective}
Visual Details: ${visualDetails || 'Match the exact appearance from the reference image.'}`;
    
    if (dimensions) {
      instruction += `\nDimensions: ${dimensions}`;
    }
    
    return instruction;
  }).join('\n\n');
  
  // Build architectural preservation instructions
  let architecturalInstructions = '';
  if (hasRoomImage) {
    if (floorPlanAnalysis) {
      architecturalInstructions = `PRESERVE EXACT ARCHITECTURE from REFERENCE IMAGE 1:
- Room Dimensions: ${floorPlanAnalysis.roomDimensions || 'As shown in image'}
- Windows: ${floorPlanAnalysis.windowLocations?.join(', ') || 'As shown in image'}
- Doors: ${floorPlanAnalysis.doorLocations?.join(', ') || 'As shown in image'}
- Built-in Features: ${floorPlanAnalysis.builtInFeatures?.join(', ') || 'As shown in image'}
- Ceiling: ${floorPlanAnalysis.ceilingRoofDesign || 'As shown in image'}
- Layout: ${floorPlanAnalysis.layoutNotes || 'Preserve exact floor plan'}`;
    } else {
      architecturalInstructions = `PRESERVE EXACT ARCHITECTURE from REFERENCE IMAGE 1:
Keep all walls, windows, floor, ceiling, doors, and perspective EXACTLY as seen in this image.
Replace only the existing furniture.`;
    }
  } else {
    // Text-to-image mode: Use room description if provided
    if (roomDescription || parsedRoomData) {
      let roomSpec = '';
      
      // Use parsed data if available (more structured)
      if (parsedRoomData?.dimensions) {
        const dims = parsedRoomData.dimensions;
        const width = dims.width || dims.depth || '?';
        const depth = dims.depth || dims.width || '?';
        roomSpec = `📏 ROOM DIMENSIONS: ${width} x ${depth} ${dims.unit || 'feet'}`;
        if (parsedRoomData.ceilingHeight) {
          roomSpec += `, Ceiling Height: ${parsedRoomData.ceilingHeight} feet`;
        }
      }
      
      // Add raw room description - this contains window/door placement details
      if (roomDescription) {
        roomSpec += roomSpec ? '\n\n' : '';
        roomSpec += `📋 FULL ROOM SPECIFICATION:\n${roomDescription}`;
      }
      
      architecturalInstructions = `🏠 CREATE THIS EXACT ROOM LAYOUT:
${roomSpec}

⚠️ CRITICAL - FOLLOW THESE ARCHITECTURAL REQUIREMENTS:
1. BUILD the room with the EXACT dimensions specified above (e.g., 12 ft × 10 ft means 12 feet on one axis, 10 feet on the other)
2. WINDOWS: Place windows EXACTLY where described (e.g., "centered on the 12 ft wall" means the window is on the longer wall, centered)
3. DOORS: Place doors EXACTLY where described (e.g., "on the 10 ft wall, 2 ft from corner" means door is on shorter wall, offset from corner)
4. SCALE: Furniture must be properly scaled to fit within these room dimensions
5. PERSPECTIVE: Show the room from an angle that reveals both the window wall and door wall if possible`;
    } else {
      architecturalInstructions = `Create a beautiful ${style} ${room} interior with professional architecture.
Include appropriate walls, flooring, windows, and ceiling for the style.`;
    }
  }
  
  // Build the full prompt using Google's SIMPLE, DIRECT pattern
  // Key insight from Google: "Describe the scene, don't just list keywords"
  // Simpler prompts work better than complex instruction lists
  
  let prompt: string;
  
  if (hasRoomImage) {
    // IMAGE-TO-IMAGE MODE: Use Google's simple inpainting pattern
    // "Using the provided image, change only [X]. Keep everything else exactly the same."
    
    const productList = productRefs.map((ref, index) => {
      const imageNum = index + 2;
      return `the ${ref.productName} from image ${imageNum}`;
    }).join(', ');
    
    prompt = `Using the provided room photo (image 1), change only the furniture. Keep everything else in the room exactly the same - same walls, windows, floor, ceiling, lighting, and camera angle.

Replace the existing furniture with these exact items from the reference images: ${productList}.

MANDATORY PRODUCT RULES:
1. EXACTLY ${productRefs.length} PRODUCTS - ALL must appear, NO extras. Count: ${productRefs.length} items only.
2. DO NOT ADD any furniture, mirrors, art, or decor NOT in the reference images. Only render items from images 2-${productRefs.length + 1}.
3. Each product must be a PIXEL-PERFECT COPY of its reference image - exact same shape, color, texture, material, and proportions.
4. Lamps must match exactly: if the reference shows a fabric shade, render a fabric shade. If metal, render metal.
5. CONSOLE TABLES & SIDEBOARDS: Preserve exact leg style (tapered, straight, curved), drawer configuration, hardware finish, and material grain patterns from reference.
6. SHELVING STRUCTURE: If a bookcase/shelf has an OPEN BACK (see-through with no back panel), keep it open - the wall should be visible through it. Do NOT add solid back panels to open-frame shelving.
7. Pedestals, side tables, and small accent pieces MUST be included - place them prominently.

CRITICAL PLACEMENT RULES:
1. All furniture must appear FULLY within the frame - no clipping at edges. Keep furniture away from the left and right edges of the image.
2. ALIGNMENT: Sofas and beds MUST be placed STRAIGHT and PARALLEL to walls - never at diagonal angles.
3. VISIBILITY: ALL furniture must be FULLY VISIBLE. NO furniture should be hidden behind other furniture.
4. CONSOLE TABLES: Place against SIDE WALLS (left or right), NOT behind sofas. Must be clearly visible in the composition.
5. SOFAS: When there's ample wall space on the left side of the room, consider positioning the sofa against the LEFT WALL to leave the rest of the room open for other furniture placement.

Arrange the furniture naturally in the room with proper perspective and realistic shadows. ${style} style. Photorealistic interior design photo.`;
    
  } else {
    // TEXT-TO-IMAGE MODE: Generate premium, magazine-quality room with specific products
    // Focus on bright, clean, well-lit, beautifully staged spaces
    const productList = productRefs.map((ref, index) => {
      const imageNum = index + 1;
      return `the ${ref.productName} from image ${imageNum}`;
    }).join(', ');
    
    prompt = `Create a stunning, PREMIUM ${style} ${room} interior featuring these exact furniture pieces from the reference images: ${productList}.

═══════════════════════════════════════════════════════════════════════════
PREMIUM ROOM QUALITY - MAGAZINE AESTHETIC
═══════════════════════════════════════════════════════════════════════════
LIGHTING: Bright, natural daylight streaming through windows. Airy, open feel.
- Large windows with sheer white or neutral curtains
- Golden hour or midday lighting - warm and inviting
- Multiple light sources for balanced illumination
- Shadows should be soft, not harsh

SPACE: Clean, uncluttered, well-proportioned room
- Spacious floor area - furniture should have room to breathe
- High ceilings (9-10 feet preferred) for grandeur
- Clear sight lines - avoid cramped arrangements
- Empty space is elegant - don't over-fill

WALLS & FINISHES: Premium, sophisticated
- Clean walls in warm whites, soft greys, or warm neutrals
- Subtle architectural details (crown molding, baseboards)
- Quality finishes - no flat or cheap-looking surfaces

FLOOR: High-quality flooring
- Light-to-medium hardwood (oak, walnut) OR elegant tile
- Polished, well-maintained appearance
- Natural wood grain visible

ATMOSPHERE: Interior design magazine quality
- Editorial, aspirational aesthetic
- The kind of room featured in Architectural Digest or Elle Decor
- Professional staging - every piece intentionally placed

═══════════════════════════════════════════════════════════════════════════
MANDATORY PRODUCT RULES
═══════════════════════════════════════════════════════════════════════════
1. EXACTLY ${productRefs.length} PRODUCTS - ALL must appear, NO extras. Count: ${productRefs.length} items only.
2. DO NOT ADD any furniture, mirrors, art, or decor NOT in the reference images. Only render items from images 1-${productRefs.length}.
3. Each product must be a PIXEL-PERFECT COPY of its reference image - exact same shape, color, texture, material, and proportions.
4. Lamps must match exactly: if the reference shows a fabric shade, render a fabric shade. If metal, render metal.
5. CONSOLE TABLES & SIDEBOARDS: Preserve exact leg style (tapered, straight, curved), drawer configuration, hardware finish, and material grain patterns from reference.
6. SHELVING STRUCTURE: If a bookcase/shelf has an OPEN BACK (see-through with no back panel), keep it open - the wall should be visible through it. Do NOT add solid back panels to open-frame shelving.
7. Pedestals, side tables, ottomans and small accent pieces MUST be included - place them prominently.

═══════════════════════════════════════════════════════════════════════════
CRITICAL PLACEMENT RULES
═══════════════════════════════════════════════════════════════════════════
1. All furniture must appear FULLY within the frame - no clipping at edges. Keep furniture away from the left and right edges of the image (10% margin).
2. ALIGNMENT: Sofas and beds MUST be placed STRAIGHT and PARALLEL to walls - never at diagonal angles.
3. VISIBILITY: ALL furniture must be FULLY VISIBLE. NO furniture should be hidden behind or overlapping other furniture.
4. CONSOLE TABLES: Place against SIDE WALLS (left or right), NOT behind sofas. Must be clearly visible.
5. SOFAS: Position against a wall with windows nearby for natural light. Leave ample floor space in front.
6. SPACING: Generous breathing room between all pieces - this is premium design, not budget furniture showroom.

Create a photorealistic interior design photograph, 8K resolution, professional architectural photography, bright daylight, magazine-quality staging.`;
  }

  return prompt;
}

// Maximum products to send to AI for optimal fidelity
// More products = lower accuracy per product
// Google's multi-image composition works best with 2-3 reference images per batch
const MAX_PRODUCTS_FOR_FIDELITY = 8;
const TEXT_TO_IMAGE_BATCH_SIZE = 3; // 3 products per batch for faster rendering

/**
 * Generate render using the "Anchor & Composite" multi-modal strategy
 * 
 * Based on Google AI Studio's approach:
 * 1. Pass room photo as first reference (Anchor) - preserves geometry
 * 2. Pass actual product images as secondary references (Composites)
 * 3. Use structured prompt to instruct Gemini to place THESE EXACT objects
 * 
 * This approach achieves:
 * - Visual Fidelity: Actual pixel data ensures texture/shape replication
 * - Spatial Integrity: Room photo ensures proper floor/wall boundaries
 * 
 * IMPORTANT: Limited to MAX_PRODUCTS_FOR_FIDELITY products for best results
 */
export async function generateImageOnlyRender(params: ImageOnlyRenderParams): Promise<ImageOnlyRenderResult> {
  const { roomImageUrl, products, roomType, stylePreference, floorPlanAnalysis, placementInstructions } = params;
  
  try {
    // Limit products for better fidelity
    const limitedProducts = products.slice(0, MAX_PRODUCTS_FOR_FIDELITY);
    if (products.length > MAX_PRODUCTS_FOR_FIDELITY) {
      console.log(`⚠️ Limiting products from ${products.length} to ${MAX_PRODUCTS_FOR_FIDELITY} for optimal fidelity`);
    }
    
    console.log(`\n🖼️ Starting ANCHOR & COMPOSITE render generation...`);
    console.log(`📍 Room image (Anchor): ${roomImageUrl || '(none - text-to-image mode)'}`);
    console.log(`📦 Products to furnish (Composites): ${limitedProducts.length} (max: ${MAX_PRODUCTS_FOR_FIDELITY})`);
    
    // Step 1: Fetch room image (optional - skip if empty for text-to-image mode)
    let roomImage: { data: string; mimeType: string } | null = null;
    const hasRoomImage = roomImageUrl && roomImageUrl.trim().length > 0;
    
    if (hasRoomImage) {
      console.log(`📥 Fetching room image (THE ANCHOR)...`);
      roomImage = await fetchImageAsBase64(roomImageUrl);
      if (!roomImage) {
        console.warn(`⚠️ Failed to fetch room image, falling back to text-to-image mode`);
      } else {
        console.log(`✅ Room image loaded as ANCHOR (${roomImage.mimeType})`);
      }
    } else {
      console.log(`📝 Text-to-image mode (no room photo - no anchor)`);
    }
    
    // TEXT-TO-IMAGE BATCHING: When no room image and more than batch size products,
    // use batched approach for better fidelity
    if (!roomImage && limitedProducts.length > TEXT_TO_IMAGE_BATCH_SIZE) {
      console.log(`\n🔄 TEXT-TO-IMAGE BATCHING: ${limitedProducts.length} products → batches of ${TEXT_TO_IMAGE_BATCH_SIZE}`);
      return await generateBatchedTextToImageRender(params, limitedProducts);
    }
    
    // Step 2: Select and fetch product front view images (THE COMPOSITES)
    // Use limitedProducts for better fidelity
    const { selected: productImageRefs, dropped: droppedProducts } = selectProductFrontViewImages(limitedProducts);
    console.log(`📸 Selected ${productImageRefs.length} product images (COMPOSITES)`);
    
    if (droppedProducts.length > 0) {
      console.error(`🚨 ${droppedProducts.length} products DROPPED due to image issues - these will NOT appear in render!`);
    }
    
    if (productImageRefs.length === 0) {
      return {
        success: false,
        error: 'No valid product images found',
        productsUsed: 0,
        productsSentToAI: [],
        droppedProducts
      };
    }
    
    const productImageParts: any[] = [];
    const productSkusSentToAI: string[] = [];
    let fetchedCount = 0;
    
    for (const productRef of productImageRefs) {
      const productImage = await fetchImageAsBase64(productRef.url);
      if (productImage) {
        productImageParts.push({
          inlineData: {
            data: productImage.data,
            mimeType: productImage.mimeType
          }
        });
        productSkusSentToAI.push(productRef.sku);
        fetchedCount++;
        console.log(`  ✅ Composite ${fetchedCount}: ${productRef.productName} (${productRef.sku})`);
      } else {
        console.warn(`  ❌ Failed to fetch image for ${productRef.productName} (${productRef.sku}) - EXCLUDED`);
      }
    }
    
    console.log(`✅ Loaded ${fetchedCount}/${productImageRefs.length} composite images`);
    
    if (fetchedCount === 0) {
      return {
        success: false,
        error: 'Failed to fetch any product images',
        productsUsed: 0,
        productsSentToAI: []
      };
    }
    
    // Step 3: Build the Anchor & Composite prompt
    const prompt = buildAnchorCompositePrompt(
      limitedProducts,
      productImageRefs.filter(ref => productSkusSentToAI.includes(ref.sku)),
      roomType,
      stylePreference,
      !!roomImage,
      floorPlanAnalysis,
      placementInstructions,
      params.roomDescription,
      params.parsedRoomData
    );
    
    console.log(`\n📝 ANCHOR & COMPOSITE PROMPT:\n${'='.repeat(80)}\n${prompt}\n${'='.repeat(80)}\n`);
    
    // Step 4: Build parts array following the Anchor & Composite structure
    // Part 1: The Prompt (Text)
    // Part 2: The Room (Image) - ANCHOR
    // Part 3...N: The Products (Images) - COMPOSITES
    const parts: any[] = [];
    
    // Part 1: The main prompt text
    parts.push({ text: prompt });
    
    // Part 2: The Room Image - simple label
    if (roomImage) {
      parts.push({ text: `Image 1: The room to furnish (keep the room structure exactly the same)` });
      parts.push({
        inlineData: {
          data: roomImage.data,
          mimeType: roomImage.mimeType
        }
      });
    }
    
    // Parts 3...N: Product Images with simple, direct binding
    // Google's advice: Simpler is better - just identify the image clearly
    const successfulRefs = productImageRefs.filter(ref => productSkusSentToAI.includes(ref.sku));
    
    for (let i = 0; i < productImageParts.length; i++) {
      const productRef = successfulRefs[i];
      const imageNum = roomImage ? i + 2 : i + 1;
      
      // Simple, direct label - let the main prompt do the heavy lifting
      parts.push({ text: `Image ${imageNum}: ${productRef.productName}` });
      parts.push(productImageParts[i]);
    }
    
    console.log(`🎨 Sending to Gemini 2.5 Flash (Anchor & Composite mode)...`);
    console.log(`   Mode: ${roomImage ? 'Image-to-image (ANCHOR provided)' : 'Text-to-image (no ANCHOR)'}`);
    console.log(`   Parts: 1 prompt + ${roomImage ? '1 anchor + ' : ''}${productImageParts.length} composites`);
    
    // Step 5: Call Gemini with multimodal inputs
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    return await processGeminiResponse(response, fetchedCount, productSkusSentToAI);
  } catch (error) {
    console.error('❌ Anchor & Composite generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: 0,
      productsSentToAI: []
    };
  }
}

/**
 * Process Gemini response and extract image
 */
async function processGeminiResponse(
  response: any, 
  productsUsed: number, 
  productsSentToAI: string[]
): Promise<ImageOnlyRenderResult> {
  try {
    
    // Extract generated image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error(`❌ No image data in Gemini response`);
      return {
        success: false,
        error: 'No image generated by Gemini',
        productsUsed,
        productsSentToAI
      };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    console.log(`✅ Anchor & Composite render generated successfully!`);
    console.log(`   Products composited: ${productsUsed}`);
    console.log(`   Product SKUs: ${productsSentToAI.join(', ')}`);
    
    return {
      success: true,
      imageBase64,
      productsUsed,
      productsSentToAI
    };
    
  } catch (error) {
    console.error(`❌ Anchor & Composite render generation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: 0,
      productsSentToAI: []
    };
  }
}

// ============================================================================
// BATCHED TEXT-TO-IMAGE RENDER
// ============================================================================
// For text-to-image mode with many products, batch them for better fidelity:
// 1. First batch creates the scene with 2-3 products
// 2. Subsequent batches add products using previous render as anchor
// ============================================================================

/**
 * Generate text-to-image render with batching for better product fidelity
 * Each batch uses the previous render as the anchor image
 */
async function generateBatchedTextToImageRender(
  params: ImageOnlyRenderParams,
  products: Product[]
): Promise<ImageOnlyRenderResult> {
  const { roomType, stylePreference } = params;
  
  // Sort products by priority (large items first for scene anchoring)
  const sortedProducts = [...products].sort((a, b) => {
    const weightA = getCategoryWeightForBatching(a);
    const weightB = getCategoryWeightForBatching(b);
    return weightB - weightA;
  });
  
  // Create batches
  const batches: Product[][] = [];
  for (let i = 0; i < sortedProducts.length; i += TEXT_TO_IMAGE_BATCH_SIZE) {
    batches.push(sortedProducts.slice(i, i + TEXT_TO_IMAGE_BATCH_SIZE));
  }
  
  console.log(`\n📦 TEXT-TO-IMAGE BATCHING:`);
  console.log(`   Total products: ${products.length}`);
  console.log(`   Batch size: ${TEXT_TO_IMAGE_BATCH_SIZE}`);
  console.log(`   Number of batches: ${batches.length}`);
  
  // Log batch contents
  batches.forEach((batch, i) => {
    console.log(`   Batch ${i + 1}: ${batch.map(p => p.name).join(', ')}`);
  });
  
  let currentAnchor: string | null = null;
  const allProductsSentToAI: string[] = [];
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const isFirstBatch = batchIndex === 0;
    
    console.log(`\n🎨 BATCH ${batchIndex + 1}/${batches.length}: ${batch.map(p => p.name).join(', ')}`);
    
    // Get product images for this batch
    const { selected: productImageRefs } = selectProductFrontViewImages(batch);
    
    if (productImageRefs.length === 0) {
      console.warn(`   ⚠️ No valid product images in batch ${batchIndex + 1}, skipping`);
      continue;
    }
    
    // Fetch product images
    const productImageParts: any[] = [];
    const batchSkus: string[] = [];
    
    for (const productRef of productImageRefs) {
      const productImage = await fetchImageAsBase64(productRef.url);
      if (productImage) {
        productImageParts.push({
          inlineData: {
            data: productImage.data,
            mimeType: productImage.mimeType
          }
        });
        batchSkus.push(productRef.sku);
        console.log(`   ✅ Loaded: ${productRef.productName}`);
      }
    }
    
    if (productImageParts.length === 0) {
      console.warn(`   ⚠️ Failed to fetch any product images for batch ${batchIndex + 1}`);
      continue;
    }
    
    // Build prompt for this batch
    const batchPrompt = buildBatchedTextToImagePrompt(
      batch,
      productImageRefs.filter(ref => batchSkus.includes(ref.sku)),
      roomType || 'living room',
      stylePreference || 'Modern',
      isFirstBatch,
      batchIndex,
      batches.length
    );
    
    // Build parts array
    const parts: any[] = [];
    parts.push({ text: batchPrompt });
    
    // If we have a previous render, use it as anchor
    if (currentAnchor && !isFirstBatch) {
      const anchorData = currentAnchor.replace(/^data:image\/\w+;base64,/, '');
      const anchorMime = currentAnchor.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      
      parts.push({ text: `Image 1: The current room design (ADD the new products to this scene, keep existing furniture)` });
      parts.push({
        inlineData: {
          data: anchorData,
          mimeType: anchorMime
        }
      });
    }
    
    // Add product images
    const successfulRefs = productImageRefs.filter(ref => batchSkus.includes(ref.sku));
    const imageOffset = currentAnchor && !isFirstBatch ? 2 : 1;
    
    for (let i = 0; i < productImageParts.length; i++) {
      const productRef = successfulRefs[i];
      parts.push({ text: `Image ${i + imageOffset}: ${productRef.productName}` });
      parts.push(productImageParts[i]);
    }
    
    console.log(`   📤 Sending batch ${batchIndex + 1} to Gemini...`);
    
    // Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    // Extract generated image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error(`   ❌ Batch ${batchIndex + 1} failed - no image generated`);
      continue;
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    currentAnchor = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    allProductsSentToAI.push(...batchSkus);
    
    console.log(`   ✅ Batch ${batchIndex + 1} complete`);
  }
  
  if (!currentAnchor) {
    return {
      success: false,
      error: 'All batches failed to generate',
      productsUsed: 0,
      productsSentToAI: []
    };
  }
  
  console.log(`\n✅ BATCHED TEXT-TO-IMAGE COMPLETE`);
  console.log(`   Total products rendered: ${allProductsSentToAI.length}`);
  
  return {
    success: true,
    imageBase64: currentAnchor,
    productsUsed: allProductsSentToAI.length,
    productsSentToAI: allProductsSentToAI
  };
}

/**
 * Build prompt for batched text-to-image rendering
 */
function buildBatchedTextToImagePrompt(
  products: Product[],
  productRefs: Array<{ productName: string; sku: string }>,
  roomType: string,
  stylePreference: string,
  isFirstBatch: boolean,
  batchIndex: number,
  totalBatches: number
): string {
  const style = stylePreference || 'Modern';
  const room = roomType || 'living room';
  
  const productList = productRefs
    .map((ref, i) => `the ${ref.productName} from image ${isFirstBatch ? i + 1 : i + 2}`)
    .join(', ');
  
  if (isFirstBatch) {
    // First batch: Create the premium scene - bright, clean, magazine-quality
    return `Create a stunning, PREMIUM ${style} ${room} featuring EXACTLY ${productRefs.length} REAL FURNITURE PRODUCTS.

═══════════════════════════════════════════════════════════════════════════
PREMIUM ROOM QUALITY - MAGAZINE AESTHETIC
═══════════════════════════════════════════════════════════════════════════
LIGHTING: Bright, natural daylight - airy and inviting
- Large windows with abundant natural light streaming in
- Warm, golden hour quality - never dark or moody
- Soft, flattering shadows - not harsh

SPACE: Clean, spacious, editorial-quality
- Room size: 15x18 feet with 10-foot ceilings - grand but not overwhelming
- THREE VISIBLE WALLS framing the scene beautifully
- Uncluttered with generous breathing room between furniture
- The kind of room featured in Architectural Digest

FINISHES: Premium, sophisticated
- Walls: Warm white or soft neutral (Benjamin Moore White Dove or similar)
- Floor: Beautiful light-to-medium hardwood with visible grain (oak or walnut)
- Subtle architectural details: crown molding, quality baseboards
- Quality window treatments: sheer white or neutral curtains

═══════════════════════════════════════════════════════════════════════════
ZERO TOLERANCE - ABSOLUTELY NO EXTRA FURNITURE
═══════════════════════════════════════════════════════════════════════════
- The room should contain ONLY ${productRefs.length} furniture items - the EXACT items from the reference images.
- DO NOT add: coffee tables, side tables, lamps, rugs, plants, books, vases, art, mirrors, ottomans, or ANY other furniture/decor.
- If you add ANYTHING not in the reference images, the render is FAILED.
- Count before generating: There must be EXACTLY ${productRefs.length} pieces of furniture. No more.

═══════════════════════════════════════════════════════════════════════════
PIXEL-PERFECT PRODUCT COPYING (CRITICAL)
═══════════════════════════════════════════════════════════════════════════
- Each product MUST be an EXACT VISUAL CLONE of its reference image.
- SOFA/CHAIR COLORS: Copy the EXACT upholstery color from reference. If the sofa is gray, render gray. If beige, render beige. Do NOT change colors.
- PEDESTALS/TABLES: Copy the EXACT shape, material, and finish. If the reference shows a sculptural white pedestal, render that exact sculptural white pedestal - NOT a different table.
- WOOD GRAIN: If reference shows walnut, render walnut. If oak, render oak. Match the exact tone.
- METAL FINISHES: If reference shows brass legs, render brass. If chrome, render chrome.
- LEG STYLES: Match exact leg shape - tapered, straight, or curved as shown in reference.

The products to copy EXACTLY are: ${productList}

═══════════════════════════════════════════════════════════════════════════
PLACEMENT RULES
═══════════════════════════════════════════════════════════════════════════
1. ALL furniture 100% within frame - 10% margin from all edges.
2. Sofas/beds STRAIGHT and parallel to walls, never diagonal.
3. Generous spacing between all pieces - premium staging, not cramped.
4. Camera at entrance level looking into the beautifully lit space.

Professional architectural photography, bright natural daylight, 8K resolution, magazine-quality staging.`;
  } else {
    // Subsequent batches: Add to existing premium scene - VERBATIM PARITY with first batch
    return `Image 1 shows the current premium ${style} ${room} with existing furniture. ADD EXACTLY ${productRefs.length} MORE products: ${productList}.

═══════════════════════════════════════════════════════════════════════════
PREMIUM ROOM QUALITY - MAGAZINE AESTHETIC (MUST PRESERVE FROM IMAGE 1)
═══════════════════════════════════════════════════════════════════════════
LIGHTING: Bright, natural daylight - airy and inviting
- Large windows with abundant natural light streaming in
- Warm, golden hour quality - never dark or moody
- Soft, flattering shadows - not harsh

SPACE: Clean, spacious, editorial-quality
- Room size: 15x18 feet with 10-foot ceilings - grand but not overwhelming
- THREE VISIBLE WALLS framing the scene beautifully
- Uncluttered with generous breathing room between furniture
- The kind of room featured in Architectural Digest

FINISHES: Premium, sophisticated
- Walls: Warm white or soft neutral (Benjamin Moore White Dove or similar)
- Floor: Beautiful light-to-medium hardwood with visible grain (oak or walnut)
- Subtle architectural details: crown molding, quality baseboards
- Quality window treatments: sheer white or neutral curtains

═══════════════════════════════════════════════════════════════════════════
ZERO TOLERANCE - NO EXTRA FURNITURE
═══════════════════════════════════════════════════════════════════════════
- After this batch, the room should contain ONLY the existing furniture from Image 1 PLUS the ${productRefs.length} new items from reference images.
- DO NOT add: coffee tables, side tables, lamps, rugs, plants, books, vases, art, mirrors, ottomans, or ANY other furniture/decor.
- If you add ANYTHING not in the reference images, the render is FAILED.
- Count: EXACTLY ${productRefs.length} new pieces. No more.

═══════════════════════════════════════════════════════════════════════════
PRESERVE EXISTING FURNITURE (CRITICAL)
═══════════════════════════════════════════════════════════════════════════
- Every piece of furniture from Image 1 MUST remain EXACTLY as shown - same position, same color, same appearance.
- Do NOT remove, move, recolor, or modify ANY existing furniture.
- The existing sofa color must stay EXACTLY the same.

═══════════════════════════════════════════════════════════════════════════
PIXEL-PERFECT NEW PRODUCT COPYING (CRITICAL)
═══════════════════════════════════════════════════════════════════════════
- Each new product MUST be an EXACT VISUAL CLONE of its reference image.
- SOFA/CHAIR COLORS: Copy the EXACT upholstery color from reference. If the sofa is gray, render gray. If beige, render beige. Do NOT change colors.
- PEDESTALS/TABLES: Copy the EXACT shape, material, and finish. If the reference shows a sculptural white pedestal, render that exact sculptural white pedestal - NOT a different table.
- WOOD GRAIN: If reference shows walnut, render walnut. If oak, render oak. Match the exact tone.
- METAL FINISHES: If reference shows brass legs, render brass. If chrome, render chrome.
- LEG STYLES: Match exact leg shape - tapered, straight, or curved as shown in reference.

═══════════════════════════════════════════════════════════════════════════
PLACEMENT RULES
═══════════════════════════════════════════════════════════════════════════
1. ALL furniture (existing + new) 100% within frame - 10% margin from all edges.
2. Place new items in empty spaces - no overlap with existing furniture.
3. Sofas/beds STRAIGHT and parallel to walls, never diagonal.
4. Generous spacing between all pieces - premium staging, not cramped.
5. Camera at entrance level looking into the beautifully lit space.

Professional architectural photography, bright natural daylight, 8K resolution, magazine-quality staging.`;
  }
}

/**
 * Get category weight for batching order (large items first)
 */
function getCategoryWeightForBatching(product: Product): number {
  const name = product.name.toLowerCase();
  const description = (product.description || '').toLowerCase();
  const text = `${name} ${description}`;
  
  // Tier 1: Primary anchors (largest visual impact) - first batch
  if (name.includes('sofa') || name.includes('sectional')) return 100;
  if (name.includes('bed') && !name.includes('bedside')) return 95;
  if (name.includes('dining table')) return 90;
  
  // Tier 2: Large furniture
  if (name.includes('cabinet') || name.includes('sideboard') || name.includes('buffet')) return 80;
  if (name.includes('bookcase') || name.includes('shelf')) return 75;
  if (name.includes('console table') || name.includes('media console')) return 70;
  
  // Tier 3: Tables and rugs
  if (name.includes('coffee table')) return 65;
  if (name.includes('dining chair')) return 60;
  if (name.includes('rug')) return 60;
  
  // Tier 4: Accent seating
  if (name.includes('accent chair') || name.includes('armchair') || name.includes('chair')) return 55;
  if (name.includes('ottoman') || name.includes('bench')) return 50;
  
  // Tier 5: Small tables
  if (name.includes('side table') || name.includes('end table') || name.includes('nightstand')) return 40;
  
  // Tier 6: Lighting
  if (name.includes('lamp') || name.includes('pendant') || name.includes('chandelier')) return 30;
  
  // Tier 7: Small decor (last batch)
  if (name.includes('vase') || name.includes('bowl') || name.includes('pedestal')) return 20;
  if (text.includes('decor') || text.includes('accessory') || text.includes('accent')) return 15;
  
  return 25; // Default for unknown items
}

// ============================================================================
// MULTI-STEP RENDER PIPELINE (for room images)
// ============================================================================
// Breaks render into multiple smaller passes for better fidelity:
// 1. Room Lock Pass: Establish room baseline
// 2. Product Batch Passes: Add 2-3 products at a time (large items first)
// ============================================================================

const MAX_PRODUCTS = 8; // Hard limit for model reliability (was 7)
const PRODUCTS_PER_BATCH = 3; // 3 products per batch for better fidelity
const MAX_LAMPS = 2; // Limit lamps to avoid cluttered renders

// NOTE: Delta compositing solves room drift - we extract furniture from Gemini output
// and composite it onto the ORIGINAL room image, preserving architecture perfectly.

/**
 * Limits total products to MAX_PRODUCTS
 * Keeps highest priority products (large anchors over small accents)
 */
function limitProducts(products: Product[]): Product[] {
  if (products.length <= MAX_PRODUCTS) {
    return products;
  }
  
  console.log(`\n⚠️ PRODUCT LIMIT: Found ${products.length} products, limiting to ${MAX_PRODUCTS}`);
  
  // Sort by category weight (large items first) then take top MAX_PRODUCTS
  const sorted = [...products].sort((a, b) => {
    const weightA = getCategoryWeight(a);
    const weightB = getCategoryWeight(b);
    return weightB - weightA;
  });
  
  const kept = sorted.slice(0, MAX_PRODUCTS);
  const removed = sorted.slice(MAX_PRODUCTS);
  
  console.log(`   Keeping: ${kept.map(p => p.name).join(', ')}`);
  console.log(`   Removing: ${removed.map(p => p.name).join(', ')}`);
  
  return kept;
}

/**
 * Filters products to limit lamps to MAX_LAMPS
 * Keeps the most expensive lamps (typically higher quality/larger)
 */
function limitLamps(products: Product[]): Product[] {
  const lamps: Product[] = [];
  const nonLamps: Product[] = [];
  
  for (const product of products) {
    const name = product.name.toLowerCase();
    if (name.includes('lamp') || name.includes('pendant') || name.includes('chandelier') || name.includes('sconce')) {
      lamps.push(product);
    } else {
      nonLamps.push(product);
    }
  }
  
  // If we have too many lamps, keep only the most expensive ones
  if (lamps.length > MAX_LAMPS) {
    console.log(`\n⚠️ LAMP LIMIT: Found ${lamps.length} lamps, limiting to ${MAX_LAMPS}`);
    
    // Sort lamps by price descending (keep most expensive)
    lamps.sort((a, b) => {
      const priceA = parseFloat(a.price || '0');
      const priceB = parseFloat(b.price || '0');
      return priceB - priceA;
    });
    
    const keptLamps = lamps.slice(0, MAX_LAMPS);
    const removedLamps = lamps.slice(MAX_LAMPS);
    
    console.log(`   Keeping: ${keptLamps.map(l => l.name).join(', ')}`);
    console.log(`   Removing: ${removedLamps.map(l => l.name).join(', ')}`);
    
    return [...nonLamps, ...keptLamps];
  }
  
  return products;
}

// Category weights for ordering: higher = render first (anchors the scene)
const CATEGORY_PRIORITY_WEIGHTS: Record<string, number> = {
  // Tier 1: Primary anchors (largest visual impact)
  'Sofa': 100,
  'Sectional': 100,
  'Sectional Sofa': 100,
  'Bed': 95,
  'Dining Table': 90,
  
  // Tier 2: Large furniture
  'Cabinet': 80,
  'Bar Cabinet': 80,
  'Sideboard': 80,
  'Buffet': 80,
  'Media Console': 75,
  'Media Unit': 75,
  'Bookcase': 75,
  'Shelving Unit': 75,
  'Console Table': 70,
  
  // Tier 3: Tables
  'Coffee Table': 65,
  'Dining Chair': 60,
  'Rug': 60,
  
  // Tier 4: Accent seating
  'Accent Chair': 55,
  'Chair': 55,
  'Ottoman': 50,
  'Bench': 50,
  'Stool': 45,
  
  // Tier 5: Small tables
  'Side Table': 40,
  'Accent Table': 40,
  'End Table': 40,
  'Nightstand': 40,
  
  // Tier 6: Lighting
  'Floor Lamp': 30,
  'Table Lamp': 25,
  'Pendant': 25,
  'Chandelier': 25,
  
  // Tier 7: Small decor (last)
  'Home Decor': 15,
  'Decor': 15,
  'Vase': 10,
  'Mirror': 10,
  'Art': 10,
};

/**
 * Orders products for optimal batching: large/anchor items first, small items last
 * This ensures foundational pieces establish the scene before smaller accents are added
 */
function orderProductsForBatching(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    // Get category weights
    const weightA = getCategoryWeight(a);
    const weightB = getCategoryWeight(b);
    
    // Primary sort: by category weight (descending - larger items first)
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    
    // Secondary sort: by price as proxy for size (descending - expensive items often larger)
    const priceA = parseFloat(a.price || '0');
    const priceB = parseFloat(b.price || '0');
    if (priceA !== priceB) {
      return priceB - priceA;
    }
    
    // Tertiary sort: prefer items with visual descriptions (better reference data)
    const hasDescA = a.visualDescription ? 1 : 0;
    const hasDescB = b.visualDescription ? 1 : 0;
    if (hasDescA !== hasDescB) {
      return hasDescB - hasDescA;
    }
    
    // Final tie-breaker: SKU for determinism
    return a.sku.localeCompare(b.sku);
  });
}

/**
 * Get priority weight for a product based on its category/name
 * Uses CATEGORY_PRIORITY_WEIGHTS map with comprehensive keyword matching
 */
function getCategoryWeight(product: Product): number {
  const name = product.name.toLowerCase();
  
  // Try to match against all keys in CATEGORY_PRIORITY_WEIGHTS
  // Check for exact category matches in product name first
  for (const [category, weight] of Object.entries(CATEGORY_PRIORITY_WEIGHTS)) {
    if (name.includes(category.toLowerCase())) {
      return weight;
    }
  }
  
  // Extended keyword matching for common variations
  // Tier 1: Primary anchors (100)
  if (name.includes('sofa') || name.includes('sectional') || name.includes('couch')) return 100;
  
  // Tier 1.5: Beds (95)
  if (name.includes('bed') && !name.includes('daybed')) return 95;
  
  // Tier 2: Dining tables (90)
  if (name.includes('dining table') || (name.includes('table') && name.includes('dining'))) return 90;
  
  // Tier 3: Large storage (80)
  if (name.includes('cabinet') || name.includes('sideboard') || name.includes('buffet') || 
      name.includes('armoire') || name.includes('wardrobe') || name.includes('hutch')) return 80;
  
  // Tier 3.5: Media furniture (75)
  if (name.includes('media') || name.includes('entertainment') || name.includes('tv stand') ||
      name.includes('bookcase') || name.includes('bookshelf') || name.includes('shelving')) return 75;
  
  // Tier 4: Console tables (70)
  if (name.includes('console')) return 70;
  
  // Tier 5: Coffee tables (65)
  if (name.includes('coffee table') || (name.includes('coffee') && name.includes('table'))) return 65;
  
  // Tier 5.5: Dining chairs and rugs (60)
  if (name.includes('dining chair') || name.includes('rug') || name.includes('carpet')) return 60;
  
  // Tier 6: Accent seating (55)
  if (name.includes('accent chair') || name.includes('armchair') || name.includes('lounge chair')) return 55;
  
  // Tier 6.5: General chairs and ottomans (50)
  if (name.includes('chair') || name.includes('ottoman') || name.includes('daybed')) return 50;
  
  // Tier 7: Benches and stools (45)
  if (name.includes('bench') || name.includes('stool')) return 45;
  
  // Tier 8: Small tables (40)
  if (name.includes('side table') || name.includes('accent table') || name.includes('end table') ||
      name.includes('nightstand') || name.includes('night stand')) return 40;
  
  // Tier 8.5: Pedestal sets (35)
  if (name.includes('pedestal')) return 35;
  
  // Tier 9: Floor lamps (30)
  if (name.includes('floor lamp')) return 30;
  
  // Tier 10: Table lamps and pendants (25)
  if (name.includes('lamp') || name.includes('pendant') || name.includes('chandelier') || 
      name.includes('sconce') || name.includes('light')) return 25;
  
  // Tier 11: Decor (15)
  if (name.includes('decor') || name.includes('vase') || name.includes('planter') ||
      name.includes('sculpture') || name.includes('figurine')) return 15;
  
  // Tier 12: Art and mirrors (10)
  if (name.includes('art') || name.includes('mirror') || name.includes('frame') ||
      name.includes('picture') || name.includes('print')) return 10;
  
  // Default weight for unknown items
  return 20;
}

interface MultiStepRenderParams {
  roomImageUrl: string;
  products: Product[];
  roomType?: string;
  stylePreference?: string;
  onProgress?: (progress: RenderProgress) => void; // Progress callback for UI updates
}

/**
 * Progress update for render pipeline - used for enhanced loading UX
 */
export interface RenderProgress {
  stage: 'analyzing' | 'locking' | 'batch' | 'aligning' | 'validating' | 'complete' | 'error';
  stageLabel: string;           // Human-readable stage description
  currentStep: number;          // Current step (1-indexed)
  totalSteps: number;           // Total steps in pipeline
  percentComplete: number;      // 0-100
  estimatedTimeRemaining?: number; // Seconds remaining (estimated)
  currentBatch?: number;        // Current batch number (if in batch stage)
  totalBatches?: number;        // Total batches
  productsInBatch?: string[];   // Product names in current batch
  skippedLockPass?: boolean;    // True if lock pass was skipped (empty room)
}

interface MultiStepRenderResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  productsUsed: number;
  productsSentToAI: string[];
  stepsCompleted: number;
  totalSteps: number;
  validation?: RenderValidation; // Structured validation from Gemini
  skippedLockPass?: boolean;     // True if lock pass was skipped (empty room optimization)
}

/**
 * Multi-step render pipeline for improved quality
 * 
 * Strategy:
 * 1. Room Analysis: Detect if room is empty to optimize pipeline
 * 2. Room Lock Pass: SKIPPED if room is empty (optimization)
 * 3. Product Batch Passes: Add 2-4 products at a time, using previous render as new anchor
 * 
 * This approach:
 * - Skips unnecessary lock pass for empty rooms (saves ~10 seconds)
 * - Preserves room structure by locking it first (if needed)
 * - Gives each product more "attention" from the model
 * - Uses previous render as anchor for consistency
 * - Sends progress updates for enhanced loading UX
 */
export async function generateMultiStepRender(params: MultiStepRenderParams): Promise<MultiStepRenderResult> {
  const { roomImageUrl, products, roomType, stylePreference, onProgress } = params;
  
  const style = stylePreference || 'Modern';
  const room = roomType || 'living room';
  
  // Helper to send progress updates
  const sendProgress = (progress: RenderProgress) => {
    if (onProgress) {
      try {
        onProgress(progress);
      } catch (e) {
        console.warn('Progress callback error:', e);
      }
    }
  };
  
  // Average time per step (in seconds) for estimation
  const AVG_ANALYSIS_TIME = 5;
  const AVG_LOCK_TIME = 10;
  const AVG_BATCH_TIME = 12;
  
  console.log(`\n🔄 MULTI-STEP RENDER PIPELINE`);
  console.log(`   Total products received: ${products.length}`);
  
  // STEP 1: Limit lamps to avoid cluttered renders
  const lampsLimited = limitLamps(products);
  
  // STEP 2: Limit total products to MAX_PRODUCTS for model reliability
  const productsLimited = limitProducts(lampsLimited);
  
  // STEP 3: Sort products - large anchor items first, small accents last
  const sortedProducts = orderProductsForBatching(productsLimited);
  
  console.log(`   Products after limits: ${sortedProducts.length} (max ${MAX_PRODUCTS})`);
  console.log(`   Batch size: ${PRODUCTS_PER_BATCH}`);
  
  // Log the sorted order with weights for debugging
  console.log(`\n📋 PRODUCT ORDER (large→small):`);
  sortedProducts.forEach((p, i) => {
    const weight = getCategoryWeight(p);
    console.log(`   ${i + 1}. ${p.name} (weight: ${weight})`);
  });
  
  // Create batches from SORTED products
  const productBatches: Product[][] = [];
  for (let i = 0; i < sortedProducts.length; i += PRODUCTS_PER_BATCH) {
    productBatches.push(sortedProducts.slice(i, i + PRODUCTS_PER_BATCH));
  }
  
  // Track if we skip lock pass (will be determined after analysis)
  let skippedLockPass = false;
  
  const allProductsSentToAI: string[] = [];
  let stepsCompleted = 0;
  
  try {
    // ========================================
    // STEP 0: Fetch and store TRUE original room image
    // ========================================
    console.log(`\n📸 Fetching original room image for architecture preservation...`);
    const trueOriginalRoom = await fetchImageAsBase64(roomImageUrl);
    if (!trueOriginalRoom) {
      sendProgress({
        stage: 'error',
        stageLabel: 'Failed to load room image',
        currentStep: 0,
        totalSteps: productBatches.length + 2,
        percentComplete: 0
      });
      return {
        success: false,
        error: 'Failed to fetch original room image',
        productsUsed: 0,
        productsSentToAI: [],
        stepsCompleted: 0,
        totalSteps: productBatches.length + 2
      };
    }
    const trueOriginalBase64 = `data:${trueOriginalRoom.mimeType};base64,${trueOriginalRoom.data}`;
    console.log(`   ✅ Original room stored for delta compositing`);
    
    // ========================================
    // STEP 0.5: Analyze room architecture with Gemini Vision
    // ========================================
    sendProgress({
      stage: 'analyzing',
      stageLabel: 'Analyzing room architecture...',
      currentStep: 1,
      totalSteps: productBatches.length + 2, // Analysis + potential lock + batches
      percentComplete: 5,
      estimatedTimeRemaining: AVG_ANALYSIS_TIME + AVG_LOCK_TIME + (productBatches.length * AVG_BATCH_TIME)
    });
    
    const roomAnalysisResult = await analyzeRoomWithGeminiVision(trueOriginalBase64);
    const roomArchitectureAnalysis = roomAnalysisResult.architectureDescription;
    const roomDimensions = roomAnalysisResult.estimatedDimensions;
    const isEmptyRoom = roomAnalysisResult.isEmptyRoom || false;
    
    // Determine actual total steps based on whether we skip lock pass
    const actualTotalSteps = isEmptyRoom ? productBatches.length + 1 : productBatches.length + 2;
    
    // ========================================
    // STEP 1: Room Lock Pass (SKIP IF EMPTY ROOM)
    // ========================================
    let currentAnchor: string;
    let originalRoomBase64: string;
    
    if (isEmptyRoom) {
      // OPTIMIZATION: Skip lock pass for empty rooms
      console.log(`\n📍 STEP 1/${actualTotalSteps}: Room Lock Pass - SKIPPED (empty room detected)`);
      console.log(`   ⚡ Empty room optimization: Using original image directly`);
      skippedLockPass = true;
      
      sendProgress({
        stage: 'locking',
        stageLabel: 'Empty room detected - skipping lock pass...',
        currentStep: 1,
        totalSteps: actualTotalSteps,
        percentComplete: 15,
        estimatedTimeRemaining: productBatches.length * AVG_BATCH_TIME,
        skippedLockPass: true
      });
      
      // Use original room directly as anchor
      currentAnchor = trueOriginalBase64;
      originalRoomBase64 = trueOriginalBase64;
      stepsCompleted = 1;
    } else {
      // Room has furniture - need lock pass to preserve architecture
      console.log(`\n📍 STEP 1/${actualTotalSteps}: Room Lock Pass`);
      console.log(`   Establishing room baseline - furniture detected, preserving architecture`);
      
      sendProgress({
        stage: 'locking',
        stageLabel: 'Preparing room for new furniture...',
        currentStep: 1,
        totalSteps: actualTotalSteps,
        percentComplete: 10,
        estimatedTimeRemaining: AVG_LOCK_TIME + (productBatches.length * AVG_BATCH_TIME)
      });
      
      const roomLockResult = await executeRoomLockPass(roomImageUrl, style, room);
      
      if (!roomLockResult.success || !roomLockResult.imageBase64) {
        console.error(`❌ Room lock pass failed`);
        sendProgress({
          stage: 'error',
          stageLabel: 'Room preparation failed',
          currentStep: 1,
          totalSteps: actualTotalSteps,
          percentComplete: 10
        });
        return {
          success: false,
          error: roomLockResult.error || 'Room lock pass failed',
          productsUsed: 0,
          productsSentToAI: [],
          stepsCompleted: 0,
          totalSteps: actualTotalSteps
        };
      }
      
      currentAnchor = roomLockResult.imageBase64;
      originalRoomBase64 = roomLockResult.imageBase64;
      stepsCompleted = 1;
      console.log(`   ✅ Room locked successfully`);
    }
    
    // ========================================
    // STEP 2+: Product Batch Passes
    // ========================================
    for (let batchIndex = 0; batchIndex < productBatches.length; batchIndex++) {
      const batch = productBatches[batchIndex];
      const stepNum = skippedLockPass ? batchIndex + 1 : batchIndex + 2;
      
      console.log(`\n📦 STEP ${stepNum}/${actualTotalSteps}: Product Batch ${batchIndex + 1}`);
      console.log(`   Products: ${batch.map(p => p.name).join(', ')}`);
      
      // Calculate progress
      const completedBatches = batchIndex;
      const baseProgress = skippedLockPass ? 15 : 20; // After lock pass
      const batchProgress = ((completedBatches + 0.5) / productBatches.length) * 70;
      const remainingBatches = productBatches.length - batchIndex - 1;
      
      sendProgress({
        stage: 'batch',
        stageLabel: `Placing ${batch.map(p => p.name.split(' ').slice(0, 2).join(' ')).join(', ')}...`,
        currentStep: stepNum,
        totalSteps: actualTotalSteps,
        percentComplete: Math.round(baseProgress + batchProgress),
        estimatedTimeRemaining: (remainingBatches + 1) * AVG_BATCH_TIME,
        currentBatch: batchIndex + 1,
        totalBatches: productBatches.length,
        productsInBatch: batch.map(p => p.name),
        skippedLockPass
      });
      
      // Pass original room image, analysis AND dimensions for architecture reference
      const batchResult = await executeProductBatchPass(
        currentAnchor,
        batch,
        style,
        room,
        batchIndex,
        productBatches.length,
        originalRoomBase64,         // Original room image for architecture preservation
        roomArchitectureAnalysis,   // Detailed room analysis from Gemini Vision
        roomDimensions              // Estimated room dimensions
      );
      
      if (!batchResult.success || !batchResult.imageBase64) {
        console.error(`❌ Batch ${batchIndex + 1} failed: ${batchResult.error}`);
        // Continue with current anchor, skip failed products
        console.log(`   ⚠️ Continuing without failed batch`);
        continue;
      }
      
      // Update anchor for next pass
      currentAnchor = batchResult.imageBase64;
      allProductsSentToAI.push(...batchResult.productsSentToAI);
      stepsCompleted++;
      
      console.log(`   ✅ Batch ${batchIndex + 1} complete: ${batchResult.productsSentToAI.length} products added`);
    }
    
    console.log(`\n✅ STEP 2 COMPLETE: Furniture rendering finished`);
    console.log(`   Steps completed: ${stepsCompleted}/${actualTotalSteps}`);
    console.log(`   Products rendered: ${allProductsSentToAI.length}`);
    console.log(`   Lock pass: ${skippedLockPass ? 'SKIPPED (empty room)' : 'EXECUTED'}`);
    
    // ========================================
    // STEP 3: FINAL ALIGNMENT PASS
    // Composite furniture into the ORIGINAL space while preserving architecture
    // ========================================
    let finalImage = currentAnchor;
    
    // Only run alignment pass if we have products and a room image to align to
    if (allProductsSentToAI.length > 0 && currentAnchor && roomArchitectureAnalysis) {
      console.log(`\n🎯 STEP 3: FINAL ALIGNMENT PASS`);
      
      sendProgress({
        stage: 'aligning',
        stageLabel: 'Aligning furniture to your space...',
        currentStep: stepsCompleted + 1,
        totalSteps: actualTotalSteps + 1,
        percentComplete: 92,
        estimatedTimeRemaining: 8
      });
      
      // Get product names for the alignment pass
      const productNames = sortedProducts.map(p => p.name);
      
      const alignmentResult = await executeFinalAlignmentPass(
        trueOriginalBase64,      // Original user's room
        currentAnchor,           // Generated render with furniture
        roomArchitectureAnalysis, // Detailed room analysis
        productNames             // Products to composite
      );
      
      if (alignmentResult.success && alignmentResult.imageBase64) {
        finalImage = alignmentResult.imageBase64;
        console.log(`   ✅ Final alignment successful - furniture composited into original space`);
      } else {
        console.log(`   ⚠️ Final alignment failed, using pre-alignment render`);
        // Keep currentAnchor as finalImage (fallback)
      }
    }
    
    console.log(`\n✅ FULL RENDER PIPELINE COMPLETE`);
    
    // ========================================
    // OPTIONAL: Validate final render quality
    // ========================================
    let validation: RenderValidation | undefined;
    
    // Only validate if we have products and a render
    if (allProductsSentToAI.length > 0 && finalImage) {
      sendProgress({
        stage: 'validating',
        stageLabel: 'Checking design quality...',
        currentStep: actualTotalSteps,
        totalSteps: actualTotalSteps,
        percentComplete: 95,
        skippedLockPass
      });
      
      try {
        validation = await validateRender(
          finalImage,
          allProductsSentToAI,
          trueOriginalBase64
        );
        
        // Log validation summary
        if (!validation.isValid) {
          console.warn(`   ⚠️ Render validation warning: Score ${validation.overallScore}/100`);
          if (validation.issues.length > 0) {
            console.warn(`   Issues: ${validation.issues.join(', ')}`);
          }
        }
      } catch (validationError) {
        console.warn('   ⚠️ Validation skipped due to error:', validationError);
        // Continue without validation - don't fail the entire render
      }
    }
    
    // Send completion progress
    sendProgress({
      stage: 'complete',
      stageLabel: 'Design complete!',
      currentStep: actualTotalSteps,
      totalSteps: actualTotalSteps,
      percentComplete: 100,
      skippedLockPass
    });
    
    console.log(`\n✅ MULTI-STEP RENDER PIPELINE COMPLETE`);
    
    return {
      success: true,
      imageBase64: finalImage,
      productsUsed: allProductsSentToAI.length,
      productsSentToAI: allProductsSentToAI,
      stepsCompleted,
      totalSteps: actualTotalSteps,
      skippedLockPass,
      validation
    };
    
  } catch (error) {
    console.error(`❌ Multi-step render error:`, error);
    sendProgress({
      stage: 'error',
      stageLabel: 'An error occurred',
      currentStep: stepsCompleted,
      totalSteps: productBatches.length + 2,
      percentComplete: Math.round((stepsCompleted / (productBatches.length + 2)) * 100)
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      productsUsed: allProductsSentToAI.length,
      productsSentToAI: allProductsSentToAI,
      stepsCompleted,
      totalSteps: productBatches.length + 2,
      skippedLockPass
    };
  }
}

/**
 * Step 1: Room Lock Pass
 * Sends just the room image to establish a baseline with preserved architecture
 */
async function executeRoomLockPass(
  roomImageUrl: string,
  style: string,
  room: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  try {
    // Fetch room image
    const roomImage = await fetchImageAsBase64(roomImageUrl);
    if (!roomImage) {
      return { success: false, error: 'Failed to fetch room image' };
    }
    
    // Room lock prompt - preserve EVERYTHING architectural including window shapes
    const prompt = `Recreate this ${style} ${room} EXACTLY as shown, preserving every architectural detail.

CRITICAL - DO NOT CHANGE:
- Window shapes, sizes, frames, and positions (keep arched windows arched, rectangular windows rectangular)
- Wall colors, textures, and surfaces
- Floor pattern and material
- Ceiling design, beams, and height
- All doors and doorframes
- Camera angle and perspective
- Natural lighting direction

You may remove loose furniture items, but the room's architecture must be PIXEL-PERFECT identical to the original. The window design is especially important - preserve its exact shape and style.

Output: The same room ready for furniture, with identical architecture.`;
    
    const parts = [
      { text: prompt },
      { text: `The room to preserve:` },
      { inlineData: { data: roomImage.data, mimeType: roomImage.mimeType } }
    ];
    
    console.log(`   Calling Gemini for room lock...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    // Extract image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      return { success: false, error: 'No image generated for room lock' };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    return { success: true, imageBase64 };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Room lock error' 
    };
  }
}

/**
 * Step 2+: Product Batch Pass
 * Adds a batch of products to the current anchor image
 * Now includes originalRoomBase64 as a reference for architecture preservation
 * roomArchitectureAnalysis provides detailed text description of the room to preserve
 * roomDimensions provides estimated measurements for proper furniture scaling
 */
async function executeProductBatchPass(
  anchorBase64: string,
  products: Product[],
  style: string,
  room: string,
  batchIndex: number,
  totalBatches: number,
  originalRoomBase64?: string, // Original room image for architecture reference
  roomArchitectureAnalysis?: string, // Detailed room analysis from Gemini Vision
  roomDimensions?: RoomAnalysisResult['estimatedDimensions'] // Estimated room dimensions
): Promise<{ success: boolean; imageBase64?: string; error?: string; productsSentToAI: string[] }> {
  try {
    // Get product images
    const { selected: productImageRefs, dropped: droppedProducts } = selectProductFrontViewImages(products);
    
    if (droppedProducts.length > 0) {
      console.error(`🚨 Batch ${batchIndex + 1}: ${droppedProducts.length} products DROPPED - won't appear in render`);
    }
    
    if (productImageRefs.length === 0) {
      return { success: false, error: 'No valid product images', productsSentToAI: [] };
    }
    
    // Fetch product images
    const productImageParts: any[] = [];
    const productsSentToAI: string[] = [];
    
    for (const productRef of productImageRefs) {
      const productImage = await fetchImageAsBase64(productRef.url);
      if (productImage) {
        productImageParts.push({
          inlineData: {
            data: productImage.data,
            mimeType: productImage.mimeType
          }
        });
        productsSentToAI.push(productRef.sku);
      }
    }
    
    if (productImageParts.length === 0) {
      return { success: false, error: 'Failed to fetch product images', productsSentToAI: [] };
    }
    
    // Build list of successful product references
    const successfulRefs = productImageRefs.filter(ref => productsSentToAI.includes(ref.sku));
    
    // Determine if we have an original room reference (for batch 2+)
    const hasOriginalRoomRef = batchIndex > 0 && originalRoomBase64;
    const isFirstBatch = batchIndex === 0;
    
    // Calculate image numbering based on whether we include original room
    // Batch 1: Image 1 = current anchor, products start at Image 2
    // Batch 2+: Image 1 = ORIGINAL room (architecture ref), Image 2 = current anchor, products start at Image 3
    const productImageStartIndex = hasOriginalRoomRef ? 3 : 2;
    
    // Update product descriptions with correct image numbering INCLUDING DIMENSIONS
    // Enhanced with EXPLICIT per-product fidelity requirements
    const productDescriptionsIndexed = successfulRefs.map((ref, index) => {
      const product = products.find(p => p.sku === ref.sku);
      const imageNum = productImageStartIndex + index;
      const details: string[] = [];
      
      // Add dimensions for proper scale
      if (product?.dimensions) {
        const dims = product.dimensions as any;
        if (dims.w && dims.d && dims.h) {
          details.push(`SIZE: ${dims.w}"W x ${dims.d}"D x ${dims.h}"H`);
        }
      }
      
      if (product?.materials && product.materials.length > 0) {
        details.push(`MATERIALS: ${product.materials.join(', ')}`);
      }
      if (product?.colors && product.colors.length > 0) {
        details.push(`COLOR: ${product.colors.join('/')}`);
      }
      
      const detailStr = details.length > 0 ? ` [${details.join(' | ')}]` : '';
      
      // Build explicit matching instruction for each product
      const productType = ref.productName.toLowerCase();
      let matchingInstruction = '';
      
      if (productType.includes('console') || productType.includes('sideboard') || productType.includes('credenza')) {
        matchingInstruction = `\n   → MATCH EXACTLY: leg style, drawer configuration, hardware/pulls, wood grain pattern, edge profile`;
      } else if (productType.includes('bench') || productType.includes('ottoman')) {
        matchingInstruction = `\n   → MATCH EXACTLY: upholstery color/texture, leg finish, cushion shape, base design`;
      } else if (productType.includes('sofa') || productType.includes('sectional')) {
        matchingInstruction = `\n   → MATCH EXACTLY: arm style, cushion configuration, fabric texture, leg style, overall silhouette`;
      } else if (productType.includes('chair')) {
        matchingInstruction = `\n   → MATCH EXACTLY: back shape, arm design, upholstery color, leg style, cushion details`;
      } else if (productType.includes('table')) {
        matchingInstruction = `\n   → MATCH EXACTLY: tabletop shape/finish, leg design, base structure, hardware details`;
      } else if (productType.includes('lamp') || productType.includes('light')) {
        matchingInstruction = `\n   → MATCH EXACTLY: shade shape/material, base design, finish color, proportions`;
      } else if (productType.includes('shelf') || productType.includes('bookcase')) {
        matchingInstruction = `\n   → MATCH EXACTLY: open vs solid back, number of shelves, frame style, finish color`;
      } else {
        matchingInstruction = `\n   → MATCH EXACTLY: shape, color, material, finish, all visible details from Image ${imageNum}`;
      }
      
      return `Image ${imageNum}: "${ref.productName}"${detailStr}${matchingInstruction}`;
    });
    
    // Build product list for prompt intro with correct indexing
    const productListIndexed = successfulRefs
      .map((ref, index) => `the "${ref.productName}" from image ${productImageStartIndex + index}`)
      .join(' and ');
    
    // Build room dimensions section if available
    const roomDimensionsSection = roomDimensions && (roomDimensions.lengthFeet || roomDimensions.widthFeet)
      ? `
📏 ESTIMATED ROOM DIMENSIONS:
- Room size: approximately ${roomDimensions.lengthFeet || '?'}ft x ${roomDimensions.widthFeet || '?'}ft
- Ceiling height: approximately ${roomDimensions.ceilingHeightFeet || 8}ft
- Usable floor area: ${roomDimensions.usableFloorArea || 'medium'}
${roomDimensions.wallLengths?.length > 0 ? `- Wall segments: ${roomDimensions.wallLengths.join(', ')}` : ''}

USE THESE DIMENSIONS to ensure furniture is placed at REALISTIC SCALE relative to the room.
` : '';
    
    // Build room architecture section from analysis with STRICT LOCK
    const roomArchitectureSection = roomArchitectureAnalysis 
      ? `

🔒 ARCHITECTURE LOCK - ABSOLUTELY NO CHANGES ALLOWED:
The room in the reference image is the EXACT space to use - NOT inspiration for a similar space.

${roomArchitectureAnalysis}
${roomDimensionsSection}
⛔ DO NOT CHANGE ANY OF THE FOLLOWING:
- Walls: Same color, texture, position, moldings, trim
- Windows: Same size, position, frame style, curtains/blinds
- Doors: Same position, style, handles
- Floor: Same material, color, pattern, reflectivity
- Ceiling: Same height, texture, beams, moldings
- Built-in elements: Shelves, niches, cabinets, fireplaces
- Camera angle: Same perspective, focal length, eye level
- Lighting conditions: Same natural/artificial light sources
- Any existing furniture/decor that was in the original room

` : '';

    // Enhanced prompt that references ORIGINAL room for batch 2+
    const keepExistingText = isFirstBatch 
      ? roomArchitectureSection
      : `
${roomArchitectureSection}
⚠️ CRITICAL PRESERVATION REQUIREMENTS:
- ROOM ARCHITECTURE: Match Image 1 (ORIGINAL ROOM) EXACTLY - same walls, windows, floor, ceiling, lighting, camera angle
- EXISTING FURNITURE: Keep all furniture from Image 2 (current scene) exactly as shown
- Only ADD the new pieces listed below`;
    
    const prompt = hasOriginalRoomRef
      ? `Add these furniture pieces: ${productListIndexed}.${keepExistingText}

IMAGE REFERENCES:
- Image 1: ORIGINAL ROOM - THIS IS THE EXACT ROOM TO USE. Copy every architectural detail pixel-for-pixel: walls, windows, floor, ceiling, perspective, lighting, built-ins. Do NOT reimagine or redesign this space.
- Image 2: CURRENT SCENE - keep ALL existing furniture from this image in their EXACT positions
- Images 3+: NEW FURNITURE to add (these are the ONLY new items allowed)

⚠️ MANDATORY - ALL ${successfulRefs.length} PRODUCTS MUST APPEAR:
${productDescriptionsIndexed.map((desc, i) => `- ${desc}`).join('\n')}

🎨 PRODUCT FIDELITY - ABSOLUTE REQUIREMENT:
EACH PRODUCT MUST BE A VISUAL CLONE OF ITS REFERENCE IMAGE:
- SHAPE: Exact silhouette - if the console has tapered legs, render tapered legs. If curved, render curved.
- COLOR: Precise color match - walnut is different from oak, cream is different from white
- MATERIAL: Exact texture - leather grain, fabric weave, wood grain direction, metal brushing
- DETAILS: All visible features - drawer pulls, stitching, hardware finish, edge treatments
- CONSTRUCTION: If reference shows open-back shelving, render open-back. If solid, render solid.

⚠️ SIDE-BY-SIDE TEST: If we place the rendered product next to its reference image, they should look like the SAME ITEM photographed in different rooms. Any difference = FAILURE.

📐 SCALE & SPATIAL RULES:
- USE THE DIMENSIONS PROVIDED for each product to render at CORRECT REAL-WORLD SCALE
- A standard door is ~80"H x 36"W - use this as reference for furniture sizing
- A standard ceiling is ~96"H (8 feet) - furniture should be proportional
- Dining chairs are typically ~18"W x 20"D x 35"H
- Sofas are typically ~80-90"W x 35"D x 35"H
- Every piece of furniture must be FULLY VISIBLE and SEPARATE
- NO furniture should be hidden behind or under other furniture
- Maintain clear floor space between all pieces
- Each product must have its own distinct footprint

🪑 FURNITURE PLACEMENT RULES BY TYPE:
SOFAS/SEATING:
- Place facing into the room, NOT against windows
- Can float in the room or be against a wall
- Multiple sofas should face each other or be at 90° angles

COFFEE TABLES:
- ALWAYS place directly IN FRONT of the main sofa
- Center it relative to the sofa's width
- Should be ~18" away from sofa edge

SIDE TABLES / END TABLES:
- ALWAYS place BESIDE a sofa or chair (at the arm, not in front)
- One on each side of a sofa, or at least one beside the main seating
- NEVER place in the middle of an open floor area
- NEVER place in front of seating

CONSOLE TABLES:
- ALWAYS place AGAINST A WALL (not floating in the room)
- Good locations: behind a sofa, along an entry wall, under a window
- NEVER place in the middle of the room

ACCENT TABLES:
- Place beside seating OR in corners
- Can go next to a reading chair or beside a sofa
- NEVER place randomly in open floor space

OTTOMANS/BENCHES:
- Place IN FRONT of sofas (like a coffee table position)
- Or at the FOOT of a bed in bedrooms
- NEVER under or behind sofas

🚨 CRITICAL RULES - ARCHITECTURE PRESERVATION:
1. ROOM ARCHITECTURE from Image 1: Walls, windows, floor, ceiling, camera angle IDENTICAL - pixel-for-pixel match
2. EXISTING FURNITURE from Image 2: Keep all furniture exactly as shown - same position, same appearance
3. COLOR MATCH: Each new product's color MUST match its reference image EXACTLY
4. ALL PRODUCTS: Every product listed above MUST appear in the render
5. NO OVERLAP: Furniture pieces must NOT overlap or hide each other

⛔ EXPLICITLY FORBIDDEN - DO NOT DO ANY OF THESE:
- DO NOT add windows, doors, or openings that weren't in the original
- DO NOT remove windows, doors, or openings that were in the original
- DO NOT change wall colors, textures, or add wallpaper
- DO NOT add or remove crown molding, baseboards, or trim
- DO NOT change the floor material (wood to tile, etc.)
- DO NOT add or remove built-in shelving, niches, or cabinets
- DO NOT change the ceiling height or add/remove beams
- DO NOT change the camera angle, perspective, or zoom level
- DO NOT transform the room type (living room stays living room, NOT bedroom)
- DO NOT add a bed to a non-bedroom space
- DO NOT fill empty space just because it "looks empty" - empty is CORRECT

🚫 ABSOLUTELY FORBIDDEN - DO NOT ADD:
- NO wall art, paintings, mirrors, or wall decorations unless listed above
- NO chandeliers, pendant lights, or ceiling fixtures unless listed above
- NO rugs, carpets, or floor coverings unless listed above
- NO plants, vases, books, or decorative objects unless listed above
- NO additional sofas, chairs, benches, or seating unless listed above
- NO additional tables, shelves, or storage unless listed above
- ONLY render the ${successfulRefs.length} products listed above - NOTHING ELSE
- Leave empty wall space EMPTY - do not fill it with anything
- If a space looks "empty", that is CORRECT - do not add furniture to fill it

${style} style interior. Photorealistic render. ONLY the listed ${successfulRefs.length} products.`
      : `Add these furniture pieces to the room in image 1: ${productListIndexed}.

⚠️ MANDATORY - ALL ${successfulRefs.length} PRODUCTS MUST APPEAR:
${productDescriptionsIndexed.map((desc, i) => `- ${desc}`).join('\n')}

🎨 PRODUCT FIDELITY - ABSOLUTE REQUIREMENT:
EACH PRODUCT MUST BE A VISUAL CLONE OF ITS REFERENCE IMAGE:
- SHAPE: Exact silhouette - if the console has tapered legs, render tapered legs. If curved, render curved.
- COLOR: Precise color match - walnut is different from oak, cream is different from white
- MATERIAL: Exact texture - leather grain, fabric weave, wood grain direction, metal brushing
- DETAILS: All visible features - drawer pulls, stitching, hardware finish, edge treatments
- CONSTRUCTION: If reference shows open-back shelving, render open-back. If solid, render solid.

⚠️ SIDE-BY-SIDE TEST: If we place the rendered product next to its reference image, they should look like the SAME ITEM photographed in different rooms. Any difference = FAILURE.

📐 SCALE & SPATIAL RULES:
- USE THE DIMENSIONS PROVIDED for each product to render at CORRECT REAL-WORLD SCALE
- A standard door is ~80"H x 36"W - use this as reference for furniture sizing
- A standard ceiling is ~96"H (8 feet) - furniture should be proportional
- Dining chairs are typically ~18"W x 20"D x 35"H
- Sofas are typically ~80-90"W x 35"D x 35"H
- Every piece of furniture must be FULLY VISIBLE and SEPARATE
- NO furniture should be hidden behind or under other furniture
- Maintain clear floor space between all pieces
- Each product must have its own distinct footprint

🪑 FURNITURE PLACEMENT RULES BY TYPE:
SOFAS/SEATING:
- Place facing into the room, NOT against windows
- Can float in the room or be against a wall
- Multiple sofas should face each other or be at 90° angles

COFFEE TABLES:
- ALWAYS place directly IN FRONT of the main sofa
- Center it relative to the sofa's width
- Should be ~18" away from sofa edge

SIDE TABLES / END TABLES:
- ALWAYS place BESIDE a sofa or chair (at the arm, not in front)
- One on each side of a sofa, or at least one beside the main seating
- NEVER place in the middle of an open floor area
- NEVER place in front of seating

CONSOLE TABLES:
- ALWAYS place AGAINST A WALL (not floating in the room)
- Good locations: behind a sofa, along an entry wall, under a window
- NEVER place in the middle of the room

ACCENT TABLES:
- Place beside seating OR in corners
- Can go next to a reading chair or beside a sofa
- NEVER place randomly in open floor space

OTTOMANS/BENCHES:
- Place IN FRONT of sofas (like a coffee table position)
- Or at the FOOT of a bed in bedrooms
- NEVER under or behind sofas

🚨 CRITICAL RULES - ARCHITECTURE PRESERVATION:
1. PRESERVE ROOM: Walls, windows, floor, ceiling, camera angle IDENTICAL to image 1 - pixel-for-pixel match
2. COLOR MATCH: Each product's color MUST match its reference image EXACTLY
3. ALL PRODUCTS: Every product listed above MUST appear in the render
4. NO OVERLAP: Furniture pieces must NOT overlap or hide each other

⛔ EXPLICITLY FORBIDDEN - DO NOT DO ANY OF THESE:
- DO NOT add windows, doors, or openings that weren't in the original
- DO NOT remove windows, doors, or openings that were in the original
- DO NOT change wall colors, textures, or add wallpaper
- DO NOT add or remove crown molding, baseboards, or trim
- DO NOT change the floor material (wood to tile, etc.)
- DO NOT add or remove built-in shelving, niches, or cabinets
- DO NOT change the ceiling height or add/remove beams
- DO NOT change the camera angle, perspective, or zoom level
- DO NOT transform the room type (living room stays living room, NOT bedroom)
- DO NOT add a bed to a non-bedroom space
- DO NOT fill empty space just because it "looks empty" - empty is CORRECT

🚫 ABSOLUTELY FORBIDDEN - DO NOT ADD:
- NO wall art, paintings, mirrors, or wall decorations unless listed above
- NO chandeliers, pendant lights, or ceiling fixtures unless listed above
- NO rugs, carpets, or floor coverings unless listed above
- NO plants, vases, books, or decorative objects unless listed above
- NO additional sofas, chairs, benches, or seating unless listed above
- NO additional tables, shelves, or storage unless listed above
- ONLY render the ${successfulRefs.length} products listed above - NOTHING ELSE
- Leave empty wall space EMPTY - do not fill it with anything
- If a space looks "empty", that is CORRECT - do not add furniture to fill it

${style} style interior. Photorealistic render. ONLY the listed ${successfulRefs.length} products.`;
    
    // Build parts - for batch 2+, include ORIGINAL room as first image
    const parts: any[] = [{ text: prompt }];
    
    if (hasOriginalRoomRef) {
      // Batch 2+: Include original room as Image 1 (architecture reference) with STRICT instruction
      parts.push({ text: `Image 1: ORIGINAL ROOM - THIS IS THE EXACT ROOM. Copy every wall, window, floor, ceiling, built-in element EXACTLY. Do NOT redesign, reimagine, or transform this space.` });
      const originalData = originalRoomBase64!.replace(/^data:image\/\w+;base64,/, '');
      const originalMimeType = originalRoomBase64!.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      parts.push({
        inlineData: {
          data: originalData,
          mimeType: originalMimeType
        }
      });
      
      // Image 2: Current anchor with existing furniture
      parts.push({ text: `Image 2: CURRENT SCENE - keep all furniture from this` });
    } else {
      // Batch 1: Just the anchor image with STRICT preservation instruction
      parts.push({ text: `Image 1: THE EXACT ROOM TO USE - Copy this room pixel-for-pixel. Do NOT change walls, windows, floor, ceiling, built-ins, or camera angle. Only ADD the furniture listed.` });
    }
    
    // Add anchor image (current state)
    const anchorData = anchorBase64.replace(/^data:image\/\w+;base64,/, '');
    const anchorMimeType = anchorBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    parts.push({
      inlineData: {
        data: anchorData,
        mimeType: anchorMimeType
      }
    });
    
    // Add product images with detailed labels (use indexed descriptions)
    for (let i = 0; i < productImageParts.length; i++) {
      parts.push({ text: productDescriptionsIndexed[i] });
      parts.push(productImageParts[i]);
    }
    
    console.log(`   Calling Gemini for batch ${batchIndex + 1}/${totalBatches} (${productsSentToAI.length} products)...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    // Extract image
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      return { success: false, error: 'No image generated for batch', productsSentToAI: [] };
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBase64 = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    
    return { success: true, imageBase64, productsSentToAI };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Batch error',
      productsSentToAI: []
    };
  }
}
