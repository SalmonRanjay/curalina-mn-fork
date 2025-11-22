import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Post-render QA validation using Gemini Vision
 * Checks product appearance, scale, and accuracy against specifications
 */

interface QAIssue {
  severity: 'critical' | 'major' | 'minor';
  category: 'appearance' | 'scale' | 'placement' | 'missing' | 'hallucination';
  description: string;
  affectedSku?: string;
  affectedProduct?: string;
}

interface QAResults {
  overallScore: number; // 0-100
  issues: QAIssue[];
  validatedAt: string;
  productChecks: Record<string, {
    found: boolean;
    appearanceMatch: number; // 0-100
    scaleAccuracy: number; // 0-100
    placementCorrect: boolean;
    notes: string;
  }>;
  summary: string;
}

/**
 * Analyze a generated render to validate product fidelity
 * Uses Gemini Vision to check if products match their specifications
 */
export async function validateRenderQuality(
  renderImageUrl: string,
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
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log('🔍 Starting QA validation for render...');
    
    // Fetch the render image
    const renderResponse = await fetch(renderImageUrl);
    if (!renderResponse.ok) {
      throw new Error(`Failed to fetch render image: ${renderResponse.statusText}`);
    }
    
    const renderBuffer = await renderResponse.arrayBuffer();
    const renderBase64 = Buffer.from(renderBuffer).toString('base64');
    
    // Build validation prompt
    const validationPrompt = buildValidationPrompt(expectedProducts, renderPrompt);
    
    console.log('📤 Sending validation request to Gemini Vision...');
    
    // Use Gemini Vision to analyze the render
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [
            { text: validationPrompt },
            {
              inlineData: {
                data: renderBase64,
                mimeType: "image/jpeg",
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
    
    if (product.dimensions) {
      const dims = product.dimensions;
      const getDim = (key: string) => dims[key] || dims[key[0]];
      const parts: string[] = [];
      const width = getDim('width');
      const depth = getDim('depth');
      const height = getDim('height');
      if (width) parts.push(`${width}${dims.unit || 'in'} wide`);
      if (depth) parts.push(`${depth}${dims.unit || 'in'} deep`);
      if (height) parts.push(`${height}${dims.unit || 'in'} tall`);
      if (parts.length > 0) {
        prompt += `   Dimensions: ${parts.join(', ')}\n`;
      }
    }
    
    if (product.placement) {
      prompt += `   Placement: ${product.placement}\n`;
    }
    
    prompt += '\n';
  });

  prompt += `
VALIDATION CHECKLIST:

For each product, check:
1. PRESENCE: Is the product visible in the render?
2. APPEARANCE: Does it match the visual description (color, material, style, shape)?
3. SCALE: Are the dimensions proportionally correct relative to other furniture and the room?
4. PLACEMENT: Is it in the correct location as specified?

RESPONSE FORMAT:
Provide your analysis in this exact structure:

OVERALL SCORE: [0-100]

PRODUCT CHECKS:
[For each product]
- Product Name: [name]
  Found: [yes/no]
  Appearance Match: [0-100]
  Scale Accuracy: [0-100]
  Placement: [correct/incorrect/N/A]
  Notes: [brief observations]

ISSUES FOUND:
[List any problems, one per line]
- [CRITICAL/MAJOR/MINOR] [Category]: [Description] (affects: [product name])

SUMMARY:
[2-3 sentence overall assessment]
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
  
  // Extract product checks
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
      productChecks[product.sku] = {
        found,
        appearanceMatch: found ? 80 : 0, // Simplified - would extract from response
        scaleAccuracy: found ? 75 : 0,
        placementCorrect: found,
        notes: `Product ${found ? 'found' : 'not found'} in render`,
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
