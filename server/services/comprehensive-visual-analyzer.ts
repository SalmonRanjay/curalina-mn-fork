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
  return `You are an expert furniture analyzer. Analyze this ${angleType} view image for PRECISE product specifications.

**OUTPUT FORMAT - CONCISE STRUCTURED DATA ONLY:**

Product Name: [Name]
Primary Material: [Material with finish]
Color & Finish: [Color with HEX code and finish]
Form Factor: [Shape]
Dimensions: [H:X" W:X" D:X"]
Key Geometry: [Main geometric features - max 30 words]
Distinctive Features: [2-3 features only]
Texture & Surface: [Texture/grain/weave type]
View-Specific Details: [Unique to this angle - max 15 words]

**CRITICAL REQUIREMENTS:**
- MAXIMUM 400 characters TOTAL
- Use EXACT HEX colors (#XXXXXX format)
- Be extremely CONCISE - no lengthy descriptions
- Only essential details that affect rendering
- No flowery language - technical facts only`;
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
