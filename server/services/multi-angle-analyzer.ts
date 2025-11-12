import { Product } from "@shared/schema";
import { GoogleGenAI, Type } from "@google/genai";
import { ICuralinaStorage } from "../storage-curalina";

// Initialize Gemini client with AI Integrations credentials  
// This is using Replit's AI Integrations service
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

// Type definitions for angle analysis
export type ViewingAngle = 'front' | 'front-angled' | 'side' | 'back' | 'top' | 'bottom' | 'detail' | 'lifestyle' | 'unknown';

export interface ImageAnalysis {
  imageUrl: string;
  angle: ViewingAngle;
  angleConfidence: number; // 0-100
  description: string;
  features: string[];
  colors: string[];
  materials: string[];
  dimensions?: string;
  isMainView: boolean;
}

export interface MultiAngleAnalysisResult {
  sku: string;
  productId: string;
  imageAnalyses: Record<string, Omit<ImageAnalysis, 'imageUrl'>>;
  synthesizedFrontView: string;
  completeProductDescription: string;
  primaryAngle: ViewingAngle;
  hasActualFrontView: boolean;
}

/**
 * Analyze a single product image to detect viewing angle and extract features
 */
async function analyzeIndividualImage(
  imageUrl: string,
  productName: string,
  imageIndex: number,
  totalImages: number
): Promise<ImageAnalysis> {
  try {
    console.log(`  📸 Analyzing image ${imageIndex + 1}/${totalImages}: ${imageUrl}`);
    
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    
    // Detect MIME type
    let mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      const urlLower = imageUrl.toLowerCase();
      if (urlLower.endsWith('.png')) mimeType = 'image/png';
      else if (urlLower.endsWith('.webp')) mimeType = 'image/webp';
      else if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else mimeType = 'image/jpeg';
    }
    
    const analysisPrompt = `Analyze this product image of "${productName}" and determine:

1. VIEWING ANGLE DETECTION (select one with confidence 0-100):
   - front: Direct front view showing the product's main face
   - front-angled: Slightly angled front view (3/4 view)
   - side: Profile/side view
   - back: Rear view
   - top: Overhead/bird's eye view
   - bottom: Underneath view
   - detail: Close-up of specific feature
   - lifestyle: Product in use/context/room setting
   - unknown: Cannot determine angle

2. VISUAL DESCRIPTION: Describe exactly what you see including:
   - Shape and form
   - Visible dimensions and proportions
   - Colors and finishes
   - Materials and textures
   - Distinctive design features
   - Any text, logos, or markings

3. KEY FEATURES: List 3-5 distinctive features visible from this angle

4. MATERIALS: List all visible materials

5. COLORS: List all prominent colors

6. IS MAIN VIEW: Is this likely the primary product photo (true/false)?

Return as JSON:
{
  "angle": "viewing angle",
  "angleConfidence": confidence score 0-100,
  "description": "detailed visual description",
  "features": ["feature1", "feature2"],
  "materials": ["material1", "material2"],
  "colors": ["color1", "color2"],
  "dimensions": "visible proportions if determinable",
  "isMainView": true/false
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { text: analysisPrompt },
          { inlineData: { data: imageBase64, mimeType } }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            angle: { type: Type.STRING },
            angleConfidence: { type: Type.NUMBER },
            description: { type: Type.STRING },
            features: { type: Type.ARRAY, items: { type: Type.STRING } },
            materials: { type: Type.ARRAY, items: { type: Type.STRING } },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            dimensions: { type: Type.STRING },
            isMainView: { type: Type.BOOLEAN }
          },
          required: ["angle", "angleConfidence", "description", "features", "materials", "colors", "isMainView"]
        }
      }
    });

    const analysis = JSON.parse(response.text || "{}");
    
    return {
      imageUrl,
      angle: analysis.angle as ViewingAngle,
      angleConfidence: analysis.angleConfidence,
      description: analysis.description,
      features: analysis.features || [],
      colors: analysis.colors || [],
      materials: analysis.materials || [],
      dimensions: analysis.dimensions,
      isMainView: analysis.isMainView
    };
    
  } catch (error) {
    console.error(`  ⚠️ Failed to analyze image: ${error}`);
    return {
      imageUrl,
      angle: 'unknown',
      angleConfidence: 0,
      description: 'Analysis failed',
      features: [],
      colors: [],
      materials: [],
      isMainView: false
    };
  }
}

/**
 * Synthesize multiple angle descriptions into a comprehensive front view description
 */
function synthesizeFrontViewDescription(
  analyses: ImageAnalysis[],
  productName: string
): string {
  // Find the best front-facing view
  const frontViews = analyses.filter(a => 
    a.angle === 'front' || a.angle === 'front-angled'
  ).sort((a, b) => {
    // Prioritize direct front over angled, then by confidence
    if (a.angle === 'front' && b.angle !== 'front') return -1;
    if (b.angle === 'front' && a.angle !== 'front') return 1;
    return b.angleConfidence - a.angleConfidence;
  });
  
  const primaryView = frontViews[0] || analyses.find(a => a.isMainView) || analyses[0];
  
  if (!primaryView) {
    return `Unable to synthesize front view for ${productName}`;
  }
  
  // Start with the primary view description
  let synthesized = `${productName}: ${primaryView.description}`;
  
  // Add unique features from other angles
  const allFeatures = new Set<string>();
  const allMaterials = new Set<string>();
  const allColors = new Set<string>();
  
  analyses.forEach(analysis => {
    analysis.features.forEach(f => allFeatures.add(f));
    analysis.materials.forEach(m => allMaterials.add(m));
    analysis.colors.forEach(c => allColors.add(c));
  });
  
  // Find side and back views for additional context
  const sideView = analyses.find(a => a.angle === 'side');
  const backView = analyses.find(a => a.angle === 'back');
  
  if (sideView && sideView.angleConfidence > 70) {
    synthesized += ` From the side: ${sideView.description.substring(0, 150)}`;
  }
  
  if (backView && backView.angleConfidence > 70) {
    synthesized += ` The back features: ${backView.description.substring(0, 100)}`;
  }
  
  // Add consolidated features
  if (allFeatures.size > 0) {
    synthesized += ` Key features include: ${Array.from(allFeatures).slice(0, 5).join(', ')}.`;
  }
  
  if (allMaterials.size > 0) {
    synthesized += ` Materials: ${Array.from(allMaterials).join(', ')}.`;
  }
  
  if (allColors.size > 0) {
    synthesized += ` Available in: ${Array.from(allColors).join(', ')}.`;
  }
  
  // Add dimensions if found
  const dimensionAnalysis = analyses.find(a => a.dimensions && a.dimensions !== '');
  if (dimensionAnalysis) {
    synthesized += ` Dimensions: ${dimensionAnalysis.dimensions}.`;
  }
  
  return synthesized;
}

/**
 * Create a complete product description from all available angles
 */
function createCompleteProductDescription(
  analyses: ImageAnalysis[],
  productName: string
): string {
  if (analyses.length === 0) {
    return `No visual information available for ${productName}`;
  }
  
  // Sort by angle priority for narrative flow
  const sortedAnalyses = analyses.sort((a, b) => {
    const anglePriority: Record<ViewingAngle, number> = {
      'front': 1,
      'front-angled': 2,
      'side': 3,
      'back': 4,
      'top': 5,
      'bottom': 6,
      'detail': 7,
      'lifestyle': 8,
      'unknown': 9
    };
    return anglePriority[a.angle] - anglePriority[b.angle];
  });
  
  let description = `${productName} - Comprehensive Visual Analysis:\n\n`;
  
  // Group analyses by angle type
  const angleGroups = new Map<ViewingAngle, ImageAnalysis[]>();
  sortedAnalyses.forEach(analysis => {
    if (!angleGroups.has(analysis.angle)) {
      angleGroups.set(analysis.angle, []);
    }
    angleGroups.get(analysis.angle)!.push(analysis);
  });
  
  // Build narrative from each angle group
  angleGroups.forEach((analyses, angle) => {
    if (angle === 'unknown') return;
    
    const bestAnalysis = analyses.sort((a, b) => b.angleConfidence - a.angleConfidence)[0];
    
    switch(angle) {
      case 'front':
        description += `FRONT VIEW: ${bestAnalysis.description}\n\n`;
        break;
      case 'front-angled':
        description += `THREE-QUARTER VIEW: ${bestAnalysis.description}\n\n`;
        break;
      case 'side':
        description += `SIDE PROFILE: ${bestAnalysis.description}\n\n`;
        break;
      case 'back':
        description += `REAR VIEW: ${bestAnalysis.description}\n\n`;
        break;
      case 'top':
        description += `TOP VIEW: ${bestAnalysis.description}\n\n`;
        break;
      case 'detail':
        description += `DETAIL SHOTS: ${bestAnalysis.description}\n\n`;
        break;
      case 'lifestyle':
        description += `IN CONTEXT: ${bestAnalysis.description}\n\n`;
        break;
    }
  });
  
  // Add summary of all features and materials
  const allFeatures = new Set<string>();
  const allMaterials = new Set<string>();
  const allColors = new Set<string>();
  
  sortedAnalyses.forEach(analysis => {
    analysis.features.forEach(f => allFeatures.add(f));
    analysis.materials.forEach(m => allMaterials.add(m));
    analysis.colors.forEach(c => allColors.add(c));
  });
  
  description += `\nOVERALL CHARACTERISTICS:\n`;
  description += `- Features: ${Array.from(allFeatures).join(', ')}\n`;
  description += `- Materials: ${Array.from(allMaterials).join(', ')}\n`;
  description += `- Colors: ${Array.from(allColors).join(', ')}\n`;
  
  return description;
}

/**
 * Analyze all images of a product from multiple angles
 */
export async function analyzeProductFromAllAngles(
  product: Product,
  storage: ICuralinaStorage
): Promise<MultiAngleAnalysisResult | null> {
  try {
    if (!product.images || product.images.length === 0) {
      console.log(`  ❌ No images to analyze for ${product.name}`);
      return null;
    }
    
    console.log(`\n🔄 Starting multi-angle analysis for ${product.name} (${product.sku})`);
    console.log(`  📷 Analyzing ${product.images.length} images...`);
    
    // Analyze each image individually
    const imageAnalyses = await Promise.all(
      product.images.map((imageUrl, index) => 
        analyzeIndividualImage(imageUrl, product.name, index, product.images!.length)
      )
    );
    
    // Filter out failed analyses
    const successfulAnalyses = imageAnalyses.filter(a => a.angle !== 'unknown' || a.angleConfidence > 30);
    
    if (successfulAnalyses.length === 0) {
      console.log(`  ❌ All image analyses failed for ${product.name}`);
      return null;
    }
    
    // Check if we have an actual front view
    const hasActualFrontView = successfulAnalyses.some(a => 
      (a.angle === 'front' || a.angle === 'front-angled') && a.angleConfidence > 70
    );
    
    // Determine primary angle (best quality view)
    const primaryAnalysis = successfulAnalyses
      .filter(a => a.isMainView)
      .sort((a, b) => b.angleConfidence - a.angleConfidence)[0] 
      || successfulAnalyses.sort((a, b) => b.angleConfidence - a.angleConfidence)[0];
    
    // Synthesize front view description
    const synthesizedFrontView = synthesizeFrontViewDescription(successfulAnalyses, product.name);
    
    // Create complete product description
    const completeProductDescription = createCompleteProductDescription(successfulAnalyses, product.name);
    
    // Convert to storage format
    const imageAnalysesMap: Record<string, Omit<ImageAnalysis, 'imageUrl'>> = {};
    successfulAnalyses.forEach(analysis => {
      const { imageUrl, ...analysisData } = analysis;
      imageAnalysesMap[imageUrl] = analysisData;
    });
    
    const result: MultiAngleAnalysisResult = {
      sku: product.sku,
      productId: product.id,
      imageAnalyses: imageAnalysesMap,
      synthesizedFrontView,
      completeProductDescription,
      primaryAngle: primaryAnalysis.angle as ViewingAngle,
      hasActualFrontView
    };
    
    // Log summary
    console.log(`  ✅ Analysis complete for ${product.name}:`);
    console.log(`     - Primary angle: ${result.primaryAngle} (${hasActualFrontView ? 'has' : 'no'} actual front view)`);
    console.log(`     - Analyzed ${successfulAnalyses.length} images successfully`);
    console.log(`     - Synthesized description: ${synthesizedFrontView.substring(0, 100)}...`);
    
    // Update product in database
    await storage.updateProduct(product.id, {
      imageAnalyses: imageAnalysesMap,
      synthesizedFrontView,
      completeProductDescription
    });
    
    console.log(`  💾 Saved multi-angle analysis to database`);
    
    return result;
    
  } catch (error) {
    console.error(`Failed to analyze product ${product.sku}:`, error);
    return null;
  }
}

/**
 * Batch analyze products without front view images
 */
export async function batchAnalyzeProductsWithoutFrontView(
  storage: ICuralinaStorage,
  limit: number = 10
): Promise<void> {
  try {
    // Get all products
    const allProducts = await storage.getProducts();
    
    // Filter products that need multi-angle analysis
    const productsNeedingAnalysis = allProducts.filter(p => {
      // Has images but no front view description
      const hasImages = p.images && p.images.length > 0;
      const hasFrontView = p.visualDescriptionFrontView || 
                          p.visualDescriptionFrontViewGemini || 
                          p.visualDescriptionFrontViewOpenAI;
      const hasMultiAngleAnalysis = p.imageAnalyses && Object.keys(p.imageAnalyses).length > 0;
      
      return hasImages && !hasFrontView && !hasMultiAngleAnalysis;
    });
    
    console.log(`\n📊 Found ${productsNeedingAnalysis.length} products needing multi-angle analysis`);
    
    const toAnalyze = productsNeedingAnalysis.slice(0, limit);
    console.log(`🎯 Analyzing first ${toAnalyze.length} products...`);
    
    for (const product of toAnalyze) {
      await analyzeProductFromAllAngles(product, storage);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n✅ Batch analysis complete!`);
    
  } catch (error) {
    console.error('Batch analysis error:', error);
    throw error;
  }
}