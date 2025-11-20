import { GoogleGenAI } from "@google/genai";
import { categorizeImages, isValidImageUrl } from "../utils/image-helpers";
import { StructuredAnalysisParser } from "./structured-analysis-parser";
import type { StructuredAnalysisData, StructuredAttributeSet } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

interface ImageAnalysisMetadata {
  url: string;
  angle: string;
  analysis: StructuredAttributeSet;
}

export interface ComprehensiveAnalysisResult {
  frontViewAnalysis: StructuredAttributeSet;
  multiAngleAnalyses: ImageAnalysisMetadata[];
  synthesizedAnalysis: StructuredAttributeSet;
  qualityMetrics: {
    colorAccuracy: number; // 0-100
    dimensionPrecision: number; // 0-100
    materialSpecificity: number; // 0-100
    textureDetail: number; // 0-100
    featureCompleteness: number; // 0-100
    overallScore: number; // 0-100
  };
}

async function downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      fullUrl = `${baseUrl}${imageUrl}`;
    } else if (!imageUrl.startsWith('http')) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      fullUrl = `${baseUrl}/${imageUrl}`;
    }
    
    const response = await fetch(fullUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return { data: buffer.toString('base64'), mimeType: contentType };
  } catch (error) {
    console.warn(`Failed to download image ${imageUrl}:`, error);
    return null;
  }
}

function getMultiAnglePrompt(angleType: string): string {
  return `You are an expert furniture analyzer. Analyze this ${angleType} view image for precise product specifications.

**OUTPUT FORMAT - STRUCTURED DATA ONLY:**

Product Name: [Descriptive name]
Primary Material: [Specific material with finish, e.g., "Walnut wood with matte lacquer"]
Color & Finish: [Exact color with HEX code and finish type, e.g., "Charcoal (#2C2C2C), matte]
Form Factor: [Core shape and structure]
Dimensions: [Exact H/W/D in inches with decimals, e.g., "H:32.5\" W:68\" D:28.5\""]
Key Geometry: [Exact geometric features and proportions]
Distinctive Features: [Up to 3 unique design elements specific to this angle]
Texture & Surface: [Texture type, grain pattern, weave, etc.]
Visible Hardware: [Handles, knobs, legs, feet - exact style and material]
View-Specific Details: [Features unique to this angle]

**REQUIREMENTS:**
- Maximum 850 characters
- Use EXACT HEX colors (e.g., #A4B5C6)
- Include all dimensions as decimals (e.g., 32.5" not 32)
- Be highly specific about materials and finishes
- Include textile details (weave pattern, pile, etc.) if applicable
- Describe hardware in detail`;
}

function getAngleFromFilename(imageUrl: string): string {
  const filename = imageUrl.split('/').pop()?.toLowerCase() || '';
  if (filename.includes('front')) return 'Front View';
  if (filename.includes('side')) return 'Side View';
  if (filename.includes('back')) return 'Back View';
  if (filename.includes('detail')) return 'Detail View';
  if (filename.includes('top')) return 'Top View';
  return 'Additional View';
}

async function analyzeSingleImage(imageUrl: string): Promise<StructuredAttributeSet | null> {
  try {
    const imageData = await downloadImageAsBase64(imageUrl);
    if (!imageData) return null;

    const angleType = getAngleFromFilename(imageUrl);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: getMultiAnglePrompt(angleType) },
          { inlineData: { mimeType: imageData.mimeType, data: imageData.data } }
        ]
      }]
    });

    const text = response.text?.trim() || '';
    if (!text) return null;

    return StructuredAnalysisParser.parse(text, angleType === 'Front View');
  } catch (error) {
    console.warn(`Failed to analyze image ${imageUrl}:`, error);
    return null;
  }
}

function synthesizeMultiAngleAnalysis(analyses: StructuredAttributeSet[]): StructuredAttributeSet {
  if (analyses.length === 0) {
    return {
      productName: 'Unknown Product',
      primaryMaterial: 'Not specified',
      colorAndFinish: 'Not specified',
      formFactor: 'Not specified',
      keyGeometry: 'Not specified',
      confidence: 0,
      distinctiveFeatures: []
    };
  }

  // Use first analysis as base, enhance with details from others
  const base = analyses[0];
  
  // Aggregate distinctive features from all angles
  const allFeatures = new Set<string>();
  analyses.forEach(analysis => {
    analysis.distinctiveFeatures?.forEach(f => allFeatures.add(f));
  });

  // Use highest confidence analysis for each field
  const highestConfidence = analyses.reduce((prev, curr) => 
    curr.confidence > prev.confidence ? curr : prev
  );

  return {
    productName: base.productName,
    primaryMaterial: base.primaryMaterial,
    colorAndFinish: base.colorAndFinish,
    hexColor: base.hexColor,
    formFactor: base.formFactor,
    dimensions: base.dimensions,
    keyGeometry: base.keyGeometry,
    distinctiveFeatures: Array.from(allFeatures).slice(0, 5),
    confidence: Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length)
  };
}

export async function analyzeProductComprehensively(
  productName: string,
  imageUrls: string[] | null
): Promise<ComprehensiveAnalysisResult | null> {
  if (!imageUrls || imageUrls.length === 0) {
    return null;
  }

  console.log(`\n📸 Comprehensive Analysis: ${productName}`);
  console.log(`   Analyzing ${imageUrls.length} image(s)...`);

  const { frontView, otherViews } = categorizeImages(imageUrls);
  
  // Prioritize front-view, then others
  const imagesToAnalyze = frontView 
    ? [frontView, ...otherViews]
    : imageUrls;

  const multiAngleAnalyses: ImageAnalysisMetadata[] = [];
  let frontViewAnalysis: StructuredAttributeSet | null = null;

  // Analyze all images concurrently
  const analysisPromises = imagesToAnalyze.map(async (url, index) => {
    const analysis = await analyzeSingleImage(url);
    if (analysis) {
      const angleType = getAngleFromFilename(url);
      if (index === 0 && frontView) {
        frontViewAnalysis = analysis;
      }
      return { url, angle: angleType, analysis };
    }
    return null;
  });

  const results = await Promise.all(analysisPromises);
  results.forEach(result => {
    if (result) multiAngleAnalyses.push(result);
  });

  if (multiAngleAnalyses.length === 0) {
    return null;
  }

  // If no explicit front-view, use first analysis
  if (!frontViewAnalysis && multiAngleAnalyses.length > 0) {
    frontViewAnalysis = multiAngleAnalyses[0].analysis;
  }

  // Synthesize comprehensive analysis
  const allAnalyses = multiAngleAnalyses.map(m => m.analysis);
  const synthesizedAnalysis = synthesizeMultiAngleAnalysis(allAnalyses);

  // Calculate quality metrics
  const qualityMetrics = {
    colorAccuracy: frontViewAnalysis?.hexColor ? 90 : 60,
    dimensionPrecision: frontViewAnalysis?.dimensions ? 85 : 50,
    materialSpecificity: frontViewAnalysis?.primaryMaterial?.length ?? 0 > 10 ? 80 : 60,
    textureDetail: frontViewAnalysis?.keyGeometry?.length ?? 0 > 20 ? 75 : 55,
    featureCompleteness: (frontViewAnalysis?.distinctiveFeatures?.length ?? 0) * 20,
    overallScore: 0
  };

  // Calculate overall score as average
  qualityMetrics.overallScore = Math.round(
    (qualityMetrics.colorAccuracy + 
     qualityMetrics.dimensionPrecision + 
     qualityMetrics.materialSpecificity + 
     qualityMetrics.textureDetail + 
     qualityMetrics.featureCompleteness) / 5
  );

  return {
    frontViewAnalysis: frontViewAnalysis!,
    multiAngleAnalyses,
    synthesizedAnalysis,
    qualityMetrics
  };
}
