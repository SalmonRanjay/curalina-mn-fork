import { GoogleGenAI, Modality } from "@google/genai";
import { buildDimensionSummary, normalizeDimensions } from './dimension-utils';

/**
 * Post-render QA validation using Gemini Vision
 * Checks product appearance, scale, accuracy, and dimensional fidelity against specifications
 */

interface QAIssue {
  severity: 'critical' | 'major' | 'minor';
  category: 'appearance' | 'scale' | 'placement' | 'missing' | 'hallucination' | 'dimensions';
  description: string;
  affectedSku?: string;
  affectedProduct?: string;
}

interface QAResults {
  overallScore: number; // 0-100
  dimensionAccuracy: number; // 0-100 (NEW: specific to dimension validation)
  issues: QAIssue[];
  validatedAt: string;
  productChecks: Record<string, {
    found: boolean;
    colorMatch?: boolean; // Explicit color validation
    appearanceMatch: number; // 0-100
    scaleAccuracy: number; // 0-100
    dimensionAccuracy?: number; // 0-100 (NEW: per-product dimension accuracy)
    placementCorrect: boolean;
    notes: string;
  }>;
  summary: string;
}

/**
 * Analyze a generated render to validate product fidelity
 * Uses Gemini Vision to check if products match their specifications
 * 
 * @param renderImageBase64 - Base64-encoded image data (without data URI prefix)
 * @param mimeType - Image MIME type (e.g., 'image/png' or 'image/jpeg')
 * @param expectedProducts - Products that should be present in the render
 * @param renderPrompt - Original prompt used to generate the render
 */
export async function validateRenderQuality(
  renderImageBase64: string,
  mimeType: string,
  expectedProducts: Array<{
    sku: string;
    name: string;
    visualDescription?: string;
    dimensions?: any;
    placement?: string;
  }>,
  renderPrompt: string
): Promise<QAResults> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  
  if (!apiKey || !baseUrl) {
    throw new Error("Gemini API not configured - AI_INTEGRATIONS_GEMINI_API_KEY and AI_INTEGRATIONS_GEMINI_BASE_URL required");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: "",
      baseUrl,
    },
  });

  try {
    console.log('🔍 Starting QA validation for render...');
    
    // Build validation prompt
    const validationPrompt = buildValidationPrompt(expectedProducts, renderPrompt);
    
    console.log('📤 Sending validation request to Gemini Vision...');
    
    // Check image size to ensure it's within Gemini's inline limits (~4MB)
    const imageSizeKB = (renderImageBase64.length * 3) / 4 / 1024; // Approximate size in KB
    const imageSizeMB = imageSizeKB / 1024;
    
    if (imageSizeMB > 4) {
      console.warn(`⚠️ Image size (${imageSizeMB.toFixed(2)}MB) exceeds Gemini inline limit (4MB)`);
      console.warn('   QA validation skipped - consider implementing image compression');
      throw new Error(`Image too large for inline validation: ${imageSizeMB.toFixed(2)}MB > 4MB limit`);
    }
    
    // Use Gemini Vision to analyze the render
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: validationPrompt },
            {
              inlineData: {
                data: renderImageBase64,
                mimeType: mimeType, // Use actual MIME type from image generation
              },
            },
          ],
        },
      ],
    });

    const analysisText = response.text || '';
    console.log('✅ Received QA analysis from Gemini');
    
    // Parse the response into structured QA results
    const qaResults = parseQAResponse(analysisText, expectedProducts);
    
    console.log(`📊 QA Score: ${qaResults.overallScore}/100`);
    console.log(`🔴 Issues found: ${qaResults.issues.length}`);
    
    return qaResults;
    
  } catch (error) {
    console.error('❌ QA validation error:', error);
    // Return a minimal QA result indicating validation failure
    return {
      overallScore: 50, // Assume average quality if validation fails
      dimensionAccuracy: 50,
      issues: [{
        severity: 'major',
        category: 'hallucination',
        description: `QA validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      validatedAt: new Date().toISOString(),
      productChecks: {},
      summary: 'Validation failed - unable to assess render quality',
    };
  }
}

/**
 * Build a detailed validation prompt for Gemini Vision
 */
function buildValidationPrompt(
  expectedProducts: Array<{
    sku: string;
    name: string;
    visualDescription?: string;
    dimensions?: any;
    placement?: string;
  }>,
  renderPrompt: string
): string {
  let prompt = `You are a quality assurance expert validating an AI-generated interior design render.

TASK: Analyze this render and check if it correctly represents the specified furniture products.

EXPECTED PRODUCTS (${expectedProducts.length} items):

`;

  expectedProducts.forEach((product, index) => {
    prompt += `${index + 1}. ${product.name} (SKU: ${product.sku})\n`;
    
    if (product.visualDescription) {
      prompt += `   Visual Specs: ${product.visualDescription}\n`;
    }
    
    // Enhanced dimension information with scale context
    if (product.dimensions) {
      const dims = product.dimensions;
      const normalized = normalizeDimensions(product);
      
      // Get basic dimensions (support both legacy w/d/h and normalized width/depth/height keys)
      const getDim = (key: string) => dims[key] || dims[key[0]];
      const parts: string[] = [];
      const width = getDim('width');
      const depth = getDim('depth');
      const height = getDim('height');
      const unit = dims.unit || 'in';
      
      if (width) parts.push(`${width}${unit} wide`);
      if (depth) parts.push(`${depth}${unit} deep`);
      if (height) parts.push(`${height}${unit} tall`);
      
      if (parts.length > 0) {
        prompt += `   Expected Dimensions: ${parts.join(', ')}\n`;
        
        // Add scale context to help with validation
        if (normalized) {
          const scaleContext = [];
          
          if (width && width > 72) {
            scaleContext.push('large/oversized piece - should appear substantial in the room');
          } else if (width && width < 36) {
            scaleContext.push('compact piece - should appear modest in scale');
          }
          
          if (normalized.seatHeight) {
            if (normalized.seatHeight >= 17 && normalized.seatHeight <= 19) {
              scaleContext.push(`seat height ${normalized.seatHeight}${unit} (standard seating height)`);
            } else if (normalized.seatHeight >= 24 && normalized.seatHeight <= 26) {
              scaleContext.push(`seat height ${normalized.seatHeight}${unit} (counter height)`);
            } else if (normalized.seatHeight >= 28 && normalized.seatHeight <= 30) {
              scaleContext.push(`seat height ${normalized.seatHeight}${unit} (bar height)`);
            } else {
              scaleContext.push(`seat height ${normalized.seatHeight}${unit}`);
            }
          }
          
          if (scaleContext.length > 0) {
            prompt += `   Scale Context: ${scaleContext.join(', ')}\n`;
          }
        }
      }
    }
    
    if (product.placement) {
      prompt += `   Expected Placement: ${product.placement}\n`;
    }
    
    prompt += '\n';
  });

  prompt += `
VALIDATION CHECKLIST:

For each product, check:
1. PRESENCE: Is the product visible in the render?
2. COLOR MATCH: Does the color EXACTLY match the specification? (CRITICAL - score 0 if wrong color)
3. MATERIAL MATCH: Does the material/fabric match the specification?
4. SHAPE/STYLE: Does the silhouette and design match?
5. SCALE: Are the dimensions proportionally correct relative to other furniture and the room?
6. DIMENSIONAL ACCURACY: Do the proportions match the specified dimensions?
   - Compare width to height ratios
   - Check if furniture appears too large or too small for the room
   - Verify seating heights look appropriate (17-19" standard, 24-26" counter, 28-30" bar)
   - Use visual cues (standard door height ~80", typical ceiling ~96", human scale ~5.5-6 feet)
7. PLACEMENT: Is it in the correct location as specified?

⚠️ COLOR VALIDATION IS CRITICAL:
- If specified color is "soft taupe" but render shows "beige" → Appearance Match = 0
- If specified color is "charcoal gray" but render shows "light gray" → Appearance Match = 0
- Only score 90+ if color is an exact or very close match

⚠️ DIMENSION VALIDATION IS IMPORTANT:
- Compare relative sizes between products (sofa should be larger than chairs)
- Check proportions against room elements (ceiling, doors, windows)
- Verify seating heights appear correct for their type
- Score based on how accurately the render reflects the specified dimensions

RESPONSE FORMAT:
Provide your analysis in this exact structure:

OVERALL SCORE: [0-100]
DIMENSION ACCURACY: [0-100] (overall accuracy of all product dimensions and proportions)

PRODUCT CHECKS:
[For each product]
- Product Name: [name]
  Found: [yes/no]
  Color Match: [yes/no - EXACT match required]
  Appearance Match: [0-100]
  Scale Accuracy: [0-100]
  Dimension Accuracy: [0-100] (how well dimensions match specifications)
  Placement: [correct/incorrect/N/A]
  Notes: [brief observations, especially color discrepancies and dimension issues]

ISSUES FOUND:
[List any problems, one per line]
- [CRITICAL/MAJOR/MINOR] [dimensions/appearance/scale/placement/missing/hallucination]: [Description] (affects: [product name])

SUMMARY:
[2-3 sentence overall assessment including dimension accuracy]
`;

  return prompt;
}

/**
 * Parse Gemini's response into structured QA results
 */
function parseQAResponse(
  analysisText: string,
  expectedProducts: Array<{ sku: string; name: string }>
): QAResults {
  const issues: QAIssue[] = [];
  const productChecks: Record<string, any> = {};
  
  // Extract overall score
  const scoreMatch = analysisText.match(/OVERALL SCORE:\s*(\d+)/i);
  const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 70; // Default to 70 if not found
  
  // Extract dimension accuracy score
  const dimScoreMatch = analysisText.match(/DIMENSION ACCURACY:\s*(\d+)/i);
  const dimensionAccuracy = dimScoreMatch ? parseInt(dimScoreMatch[1], 10) : 70; // Default to 70 if not found
  
  // Extract product checks with actual scores from Gemini's response
  const productCheckRegex = /Product Name:\s*(.+?)\s*\n\s*Found:\s*(yes|no)/gi;
  let match;
  while ((match = productCheckRegex.exec(analysisText)) !== null) {
    const productName = match[1].trim();
    const found = match[2].toLowerCase() === 'yes';
    
    // Find the corresponding product by name
    const product = expectedProducts.find(p => 
      p.name.toLowerCase() === productName.toLowerCase()
    );
    
    if (product) {
      // Extract actual scores from Gemini's response for this product
      const productSection = analysisText.substring(match.index, match.index + 500); // Look ahead 500 chars
      
      // Extract Color Match (yes/no) - FAIL CLOSED if not explicitly "yes"
      const colorMatchRegex = /Color Match:\s*(yes|no)/i;
      const colorMatchResult = productSection.match(colorMatchRegex);
      const colorMatches = colorMatchResult ? colorMatchResult[1].toLowerCase() === 'yes' : false; // Default to false for safety
      
      // Extract Appearance Match score
      const appearanceMatchRegex = /Appearance Match:\s*(\d+)/i;
      const appearanceMatchResult = productSection.match(appearanceMatchRegex);
      let appearanceMatch = appearanceMatchResult ? parseInt(appearanceMatchResult[1], 10) : (found ? 70 : 0);
      
      // If color doesn't match, set appearance to 0 (critical failure) and add issue
      if (!colorMatches && found) {
        appearanceMatch = 0; // Complete failure - wrong color
        console.warn(`🔴 CRITICAL: Color mismatch detected for ${productName} - setting appearance to 0`);
        
        // Add critical issue for color mismatch
        issues.push({
          severity: 'critical',
          category: 'appearance',
          description: `Product color does not match specification`,
          affectedProduct: productName,
        });
      }
      
      // Extract Scale Accuracy score
      const scaleAccuracyRegex = /Scale Accuracy:\s*(\d+)/i;
      const scaleAccuracyResult = productSection.match(scaleAccuracyRegex);
      const scaleAccuracy = scaleAccuracyResult ? parseInt(scaleAccuracyResult[1], 10) : (found ? 70 : 0);
      
      // Extract Dimension Accuracy score (NEW)
      const dimensionAccuracyRegex = /Dimension Accuracy:\s*(\d+)/i;
      const dimensionAccuracyResult = productSection.match(dimensionAccuracyRegex);
      const productDimensionAccuracy = dimensionAccuracyResult ? parseInt(dimensionAccuracyResult[1], 10) : (found ? 70 : 0);
      
      // Extract Placement
      const placementRegex = /Placement:\s*(correct|incorrect|N\/A)/i;
      const placementResult = productSection.match(placementRegex);
      const placementCorrect = placementResult ? placementResult[1].toLowerCase() === 'correct' : found;
      
      // Extract Notes
      const notesRegex = /Notes:\s*(.+)/i;
      const notesResult = productSection.match(notesRegex);
      const notes = notesResult ? notesResult[1].trim() : `Product ${found ? 'found' : 'not found'} in render`;
      
      productChecks[product.sku] = {
        found,
        colorMatch: colorMatches,
        appearanceMatch,
        scaleAccuracy,
        dimensionAccuracy: productDimensionAccuracy,
        placementCorrect,
        notes,
      };
    }
  }
  
  // Extract issues
  const issuesSection = analysisText.match(/ISSUES FOUND:([\s\S]*?)(?:SUMMARY:|$)/i);
  if (issuesSection) {
    const issueLines = issuesSection[1].split('\n').filter(line => line.trim().startsWith('-'));
    
    issueLines.forEach(line => {
      const severityMatch = line.match(/\[(CRITICAL|MAJOR|MINOR)\]/i);
      const categoryMatch = line.match(/\[(appearance|scale|placement|missing|hallucination)\]/i);
      const descriptionMatch = line.match(/\]:\s*(.+?)(?:\(affects:|$)/i);
      const affectedMatch = line.match(/affects:\s*(.+?)\)/i);
      
      if (severityMatch && descriptionMatch) {
        issues.push({
          severity: severityMatch[1].toLowerCase() as 'critical' | 'major' | 'minor',
          category: (categoryMatch?.[1]?.toLowerCase() || 'appearance') as QAIssue['category'],
          description: descriptionMatch[1].trim(),
          affectedProduct: affectedMatch?.[1]?.trim(),
        });
      }
    });
  }
  
  // Extract summary
  const summaryMatch = analysisText.match(/SUMMARY:([\s\S]*?)$/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : 'No summary provided';
  
  return {
    overallScore,
    dimensionAccuracy,
    issues,
    validatedAt: new Date().toISOString(),
    productChecks,
    summary,
  };
}

/**
 * Determine if QA results require regeneration
 * Returns true if issues are severe enough to warrant a retry
 */
export function shouldRegenerateRender(qaResults: QAResults): boolean {
  // CRITICAL: Regenerate if any product has a color mismatch
  const hasColorMismatch = Object.values(qaResults.productChecks).some(
    check => check.found && check.colorMatch === false
  );
  if (hasColorMismatch) {
    console.warn('🔴 Regeneration required: Color mismatch detected');
    return true;
  }
  
  // Regenerate if overall score is below 60
  if (qaResults.overallScore < 60) {
    return true;
  }
  
  // Regenerate if there are any critical issues
  const criticalIssues = qaResults.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    return true;
  }
  
  // Regenerate if there are 3+ major issues
  const majorIssues = qaResults.issues.filter(i => i.severity === 'major');
  if (majorIssues.length >= 3) {
    return true;
  }
  
  return false;
}
