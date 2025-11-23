import { GoogleGenAI, Modality } from "@google/genai";
import { buildDimensionSummary, normalizeDimensions } from './dimension-utils';

/**
 * Post-render QA validation using Gemini Vision
 * Checks product appearance, scale, accuracy, and dimensional fidelity against specifications
 * 
 * STRICT QUALITY THRESHOLDS (enforced for auto-regeneration):
 * - Color Match: REQUIRED (true) - wrong color = critical failure
 * - Appearance Match: ≥85/100 - exact product look required
 * - Scale Accuracy: ≥80/100 - proportions must be realistic
 * - Dimension Accuracy: ≥75/100 - sizes must match specs
 * - Overall Score: ≥80/100 - combined quality threshold
 */

// STRICT QA THRESHOLDS - User requirement: exact product matching
export const QA_THRESHOLDS = {
  COLOR_MATCH_REQUIRED: true,         // Must be exact color
  MIN_APPEARANCE_SCORE: 85,           // Product must look like the reference image
  MIN_SCALE_SCORE: 80,                // Proportions must be realistic
  MIN_DIMENSION_SCORE: 75,            // Sizes must match specifications
  MIN_OVERALL_SCORE: 80,              // Combined quality threshold
  MAX_REGENERATION_ATTEMPTS: 2,       // Auto-retry limit
} as const;

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
    
    // Use Gemini Vision to analyze the render with structured JSON output
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
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object" as const,
          properties: {
            overallScore: { type: "integer" as const },
            dimensionAccuracy: { type: "integer" as const },
            productChecks: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  sku: { type: "string" as const },
                  productName: { type: "string" as const },
                  found: { type: "boolean" as const },
                  colorMatch: { type: "boolean" as const },
                  appearanceMatch: { type: "integer" as const },
                  scaleAccuracy: { type: "integer" as const },
                  dimensionAccuracy: { type: "integer" as const },
                  placementCorrect: { type: "boolean" as const },
                  notes: { type: "string" as const }
                },
                required: ["sku", "productName", "found", "appearanceMatch", "scaleAccuracy"]
              }
            },
            issues: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  severity: { type: "string" as const, enum: ["critical", "major", "minor"] },
                  category: { type: "string" as const },
                  description: { type: "string" as const },
                  affectedProduct: { type: "string" as const }
                }
              }
            },
            summary: { type: "string" as const }
          },
          required: ["overallScore", "dimensionAccuracy", "productChecks", "issues", "summary"]
        }
      }
    });

    const analysisText = response.text || '{}';
    console.log('✅ Received QA analysis from Gemini (structured JSON)');
    
    // Parse the JSON response into structured QA results
    const qaResults = parseJSONQAResponse(analysisText, expectedProducts);
    
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

⚠️ **STRICT VALIDATION REQUIREMENTS** ⚠️

This is a SIDE-BY-SIDE COMPARISON validation. You are comparing the AI-generated render against the ACTUAL product reference images provided.

**COLOR MATCHING (CRITICAL - ZERO TOLERANCE):**
- Compare render product colors DIRECTLY to the reference product images provided
- If specified color is "soft taupe" but render shows "beige" → Color Match = NO, Appearance = 0
- If specified color is "charcoal gray" but render shows "light gray" → Color Match = NO, Appearance = 0
- Even slight color variations → Color Match = NO, Appearance = 0
- Only mark Color Match = YES if the color is virtually identical to reference image

**APPEARANCE MATCHING (VERY STRICT - minimum 85/100 required):**
- Compare the render product's EXACT LOOK against the reference image
- Material/fabric texture must match (leather vs fabric vs wood grain)
- Silhouette and shape must be identical (modern vs traditional, curved vs straight)
- Details must match (tufting, legs style, arm shape, cushion count)
- If ANYTHING looks different from the reference image → score below 85
- Score 85-100: Product looks nearly identical to reference
- Score 70-84: Product recognizable but noticeable differences
- Score 0-69: Product looks significantly different or wrong

**SCALE ACCURACY (STRICT - minimum 80/100 required):**
- Compare relative sizes between products using their specified dimensions
- Sofas should appear larger than chairs, beds larger than nightstands
- Check proportions against room elements (doors ~80", ceilings ~96")
- If proportions look unrealistic → score below 80

**DIMENSION ACCURACY (STRICT - minimum 75/100 required):**
- Verify width-to-height-to-depth ratios match specifications
- Check seating heights (standard 17-19", counter 24-26", bar 28-30")
- Validate furniture doesn't appear oversized or undersized for the room
- Use visual cues and compare against specified dimensions

RESPONSE FORMAT:
Provide your analysis as a JSON object with the following structure:
{
  "overallScore": 0-100,
  "dimensionAccuracy": 0-100,
  "productChecks": [
    {
      "sku": "product SKU",
      "productName": "product name",
      "found": true/false,
      "colorMatch": true/false,
      "appearanceMatch": 0-100,
      "scaleAccuracy": 0-100,
      "dimensionAccuracy": 0-100,
      "placementCorrect": true/false,
      "notes": "brief observations"
    }
  ],
  "issues": [
    {
      "severity": "critical|major|minor",
      "category": "appearance|scale|placement|missing|hallucination|dimensions",
      "description": "issue description",
      "affectedProduct": "product name"
    }
  ],
  "summary": "2-3 sentence overall assessment"
}
`;

  return prompt;
}

/**
 * Parse Gemini's JSON response into structured QA results
 */
function parseJSONQAResponse(
  analysisText: string,
  expectedProducts: Array<{ sku: string; name: string }>
): QAResults {
  try {
    const parsed = JSON.parse(analysisText);
    
    // Create lookup maps for case-insensitive matching
    const skuToProduct = new Map<string, { sku: string; name: string }>();
    const nameToProduct = new Map<string, { sku: string; name: string }>();
    
    expectedProducts.forEach(product => {
      skuToProduct.set(product.sku.toLowerCase(), product);
      nameToProduct.set(product.name.toLowerCase(), product);
    });
    
    // Convert product checks array to SKU-keyed object
    const productChecks: Record<string, any> = {};
    let matchedCount = 0;
    
    if (parsed.productChecks && Array.isArray(parsed.productChecks)) {
      console.log(`📋 Processing ${parsed.productChecks.length} product checks from Gemini...`);
      
      parsed.productChecks.forEach((check: any) => {
        // Try to match by SKU (case-insensitive)
        let matchedProduct = skuToProduct.get(check.sku?.toLowerCase() || '');
        
        // If no SKU match, try by product name (case-insensitive)
        if (!matchedProduct && check.productName) {
          matchedProduct = nameToProduct.get(check.productName.toLowerCase());
        }
        
        if (matchedProduct) {
          // STRICT: Default colorMatch to FALSE if missing (zero-tolerance)
          // Gemini MUST explicitly confirm color match = true
          const colorMatch = check.colorMatch === true;
          
          productChecks[matchedProduct.sku] = {
            found: check.found || false,
            colorMatch, // Strict: false unless explicitly true
            appearanceMatch: check.appearanceMatch || 0,
            scaleAccuracy: check.scaleAccuracy || 0,
            dimensionAccuracy: check.dimensionAccuracy || 0,
            placementCorrect: check.placementCorrect !== undefined ? check.placementCorrect : false,
            notes: check.notes || '',
          };
          matchedCount++;
          console.log(`  ✅ Matched: ${matchedProduct.name} (SKU: ${matchedProduct.sku}) - Found: ${check.found}, Color: ${colorMatch ? 'MATCH' : 'FAIL'}`);
        } else {
          console.warn(`  ⚠️  Could not match product from Gemini: SKU=${check.sku}, Name=${check.productName}`);
        }
      });
      
      console.log(`✅ Matched ${matchedCount}/${parsed.productChecks.length} products from QA response`);
    }
    
    // CRITICAL: Add FAILING defaults for expected products NOT in Gemini's response
    // This enforces zero-tolerance - every product must be explicitly validated
    const unmatchedProducts = expectedProducts.filter(
      expected => !productChecks[expected.sku]
    );
    
    if (unmatchedProducts.length > 0) {
      console.warn(`⚠️  ${unmatchedProducts.length} expected products MISSING from Gemini QA response - marking as FAILED`);
      unmatchedProducts.forEach(product => {
        productChecks[product.sku] = {
          found: false,
          colorMatch: false, // STRICT: Missing = failed color check
          appearanceMatch: 0,
          scaleAccuracy: 0,
          dimensionAccuracy: 0,
          placementCorrect: false,
          notes: 'Product not included in Gemini QA response - validation failed',
        };
        console.warn(`  🔴 ${product.name} (${product.sku}) - FAILED (missing from QA)`);
      });
    }
    
    return {
      overallScore: parsed.overallScore || 50,
      dimensionAccuracy: parsed.dimensionAccuracy || 50,
      issues: parsed.issues || [],
      validatedAt: new Date().toISOString(),
      productChecks,
      summary: parsed.summary || 'QA validation completed',
    };
  } catch (error) {
    console.error('Failed to parse QA JSON response:', error);
    console.error('Raw response:', analysisText.substring(0, 500));
    
    // Fallback to empty results
    return {
      overallScore: 50,
      dimensionAccuracy: 50,
      issues: [],
      validatedAt: new Date().toISOString(),
      productChecks: {},
      summary: 'Failed to parse QA response',
    };
  }
}

/**
 * Parse Gemini's TEXT response into structured QA results (LEGACY - kept as fallback)
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
 * Determine if QA results require regeneration (STRICT THRESHOLDS)
 * Returns true if render quality doesn't meet strict standards
 */
export function shouldRegenerateRender(qaResults: QAResults): boolean {
  console.log('🔍 Evaluating render quality against STRICT thresholds...');
  
  // CRITICAL: Empty productChecks = validation failure
  if (!qaResults.productChecks || Object.keys(qaResults.productChecks).length === 0) {
    console.warn('🔴 REGENERATION REQUIRED: QA validation returned NO product checks (validation failed)');
    return true;
  }
  
  // CRITICAL: Regenerate if any product has a color mismatch
  const hasColorMismatch = Object.values(qaResults.productChecks).some(
    check => check.found && check.colorMatch === false
  );
  if (hasColorMismatch) {
    console.warn('🔴 REGENERATION REQUIRED: Color mismatch detected (CRITICAL)');
    return true;
  }
  
  // STRICT: Regenerate if overall score below 80 (raised from 60)
  if (qaResults.overallScore < QA_THRESHOLDS.MIN_OVERALL_SCORE) {
    console.warn(`🔴 REGENERATION REQUIRED: Overall score ${qaResults.overallScore} < ${QA_THRESHOLDS.MIN_OVERALL_SCORE}`);
    return true;
  }
  
  // STRICT: Check per-product thresholds (including products not found)
  const failedProducts = Object.entries(qaResults.productChecks)
    .filter(([sku, check]) => {
      // CRITICAL: Products not found in render = automatic failure
      if (!check.found) {
        console.warn(`  🔴 Product missing from render: ${sku}`);
        return true;
      }
      
      const appearanceFail = check.appearanceMatch < QA_THRESHOLDS.MIN_APPEARANCE_SCORE;
      const scaleFail = check.scaleAccuracy < QA_THRESHOLDS.MIN_SCALE_SCORE;
      const dimensionFail = (check.dimensionAccuracy || 0) < QA_THRESHOLDS.MIN_DIMENSION_SCORE;
      
      if (appearanceFail || scaleFail || dimensionFail) {
        console.warn(`  ⚠️  Product quality below threshold: ${sku}`);
        console.warn(`     Appearance: ${check.appearanceMatch}/${QA_THRESHOLDS.MIN_APPEARANCE_SCORE} (${appearanceFail ? 'FAIL' : 'PASS'})`);
        console.warn(`     Scale: ${check.scaleAccuracy}/${QA_THRESHOLDS.MIN_SCALE_SCORE} (${scaleFail ? 'FAIL' : 'PASS'})`);
        console.warn(`     Dimensions: ${check.dimensionAccuracy || 0}/${QA_THRESHOLDS.MIN_DIMENSION_SCORE} (${dimensionFail ? 'FAIL' : 'PASS'})`);
        return true;
      }
      return false;
    });
  
  if (failedProducts.length > 0) {
    console.warn(`🔴 REGENERATION REQUIRED: ${failedProducts.length} products below quality thresholds`);
    return true;
  }
  
  // Regenerate if there are any critical issues
  const criticalIssues = qaResults.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    console.warn(`🔴 REGENERATION REQUIRED: ${criticalIssues.length} critical issues detected`);
    return true;
  }
  
  // Regenerate if there are 3+ major issues
  const majorIssues = qaResults.issues.filter(i => i.severity === 'major');
  if (majorIssues.length >= 3) {
    return true;
  }
  
  return false;
}
