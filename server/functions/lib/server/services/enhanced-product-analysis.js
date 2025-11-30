import { GoogleGenAI } from "@google/genai";
const genAI = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
});
const ENHANCED_ANALYSIS_PROMPT = `Act as an expert AI Prompt Engineer for photorealistic product rendering. Analyze this furniture product image and provide a highly detailed analysis that can be used to recreate this exact object in AI image generation.

**PRODUCT NAME:** {PRODUCT_NAME}
**DIMENSIONS:** {DIMENSIONS}

**PART 1: TECHNICAL DECONSTRUCTION**
Analyze the image using these EXACT categories:

1. **Subject & Category**: What type of furniture is this? (e.g., "Modern display cabinet", "Mid-century dining chair", "Contemporary sectional sofa")

2. **Geometry & Shape**: Describe the overall form (e.g., "Rectangular silhouette with rounded corners", "Low-profile with tapered legs", "Asymmetrical curved backrest")

3. **Materials & Textures**: Be HIGHLY SPECIFIC about materials (e.g., "Dark stained walnut wood with vertical grain pattern", "Cream boucle fabric with subtle texture", "Polished brass metal with brushed finish")

4. **Hardware Details**: CRUCIAL - Describe handles, legs, hinges, buttons precisely (e.g., "Long vertical brass handles centered on each door", "Four tapered wooden legs with brass ferrules", "Chrome button-tufted details")

5. **Color Palette**: List exact colors observed (e.g., ["Warm charcoal gray", "Honey oak wood tone", "Aged brass gold"])

6. **Camera Angle**: Describe the view (e.g., "Straight-on frontal view", "Three-quarter angle from left", "Slightly elevated perspective")

7. **Lighting & Shadows**: Describe lighting setup (e.g., "Soft even studio lighting", "Natural ambient light from left", "No harsh shadows")

**PART 2: VISUAL DNA EXTRACTION**
Extract the unique identifying features that MUST be preserved to differentiate this from generic versions:

1. **Geometric Primitives**: Describe using simple shapes with exact counts (e.g., "Tall rectangular cabinet, 4 horizontal shelves, 2 door panels", "Square ottoman with 4 cylindrical legs")

2. **Texture Micro-Details**: List specific texture patterns (e.g., "diamond tufting", "visible cross-stitching", "herringbone wood grain", "distressed leather patina")

3. **Geometric Quirks**: Note any distinctive angles or shapes (e.g., "legs curve outward at 15 degrees", "hexagonal handles", "asymmetric armrest height")

4. **Material Interaction**: How the material responds to light (e.g., "velvet reflects light in patches", "matte wood absorbs light", "brass shows subtle reflection")

5. **Unique Identifiers**: A comma-separated string of traits that MUST be present or the render fails

**PART 3: THE GENERATION PROMPT**
Based on your analysis, create a single optimized prompt for AI image generation using this format:
"[Subject], [Geometric Primitives], [Material Details], [Hardware Details], [Lighting], [Viewpoint], isolated on a pure white background, high fidelity, 8k, photorealistic"

**PART 4: HARMONIZATION PROMPT**
Create a prompt for when this product is pasted as a "sticker" into a room image and needs lighting/shadow adjustment ONLY:
"The [Product] is already placed. DO NOT regenerate the object geometry. ONLY: 1) Generate contact shadows on floor, 2) Adjust color tone to match room ambient light, 3) Preserve exact [list critical visual traits]"

**PART 5: RENDERING KEYWORDS**
List 8-12 key visual attributes that MUST be present for accurate rendering (single words or short phrases).

**OUTPUT FORMAT:**
Return ONLY valid JSON in this exact structure:
{
  "technicalDeconstruction": {
    "subjectCategory": "...",
    "geometryShape": "...",
    "materialsTextures": "...",
    "hardwareDetails": "...",
    "colorPalette": ["color1", "color2", "color3"],
    "cameraAngle": "...",
    "lightingShadows": "..."
  },
  "visualDNA": {
    "geometricPrimitives": "e.g., Rectangular 3-drawer dresser with 4 tapered legs",
    "textureMicroDetails": ["detail1", "detail2", "detail3"],
    "geometricQuirks": ["quirk1", "quirk2"],
    "materialInteraction": ["interaction1", "interaction2"],
    "uniqueIdentifiers": "comma-separated critical traits"
  },
  "generationPrompt": "...",
  "harmonizationPrompt": "...",
  "condensedDescription": "30-40 word comma-separated description for quick reference",
  "renderingKeywords": ["keyword1", "keyword2", ...]
}`;
export async function analyzeProductForRendering(product, imageUrl) {
    try {
        console.log(`  🔬 Enhanced analysis for: ${product.name}`);
        console.log(`  📸 Image: ${imageUrl.split('/').pop()}`);
        const dimensionInfo = typeof product.dimensions === 'string'
            ? product.dimensions
            : (product.dimensions ? JSON.stringify(product.dimensions) : 'Not specified');
        const prompt = ENHANCED_ANALYSIS_PROMPT
            .replace('{PRODUCT_NAME}', product.name || 'Unknown Product')
            .replace('{DIMENSIONS}', dimensionInfo);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            console.warn(`  ⚠️ Failed to fetch image: ${imageResponse.status}`);
            return null;
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
        let response;
        let retries = 0;
        const MAX_RETRIES = 3;
        while (retries <= MAX_RETRIES) {
            try {
                response = await genAI.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{
                            role: "user",
                            parts: [
                                { text: prompt },
                                { inlineData: { data: imageBase64, mimeType } }
                            ]
                        }]
                });
                break;
            }
            catch (error) {
                if (error?.error?.code === 'RATELIMIT_EXCEEDED' && retries < MAX_RETRIES) {
                    const delayMs = Math.pow(2, retries) * 2000;
                    console.warn(`  ⏱️ Rate limit hit. Retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    retries++;
                }
                else {
                    throw error;
                }
            }
        }
        if (!response) {
            console.error(`  ⚠️ No response from Gemini`);
            return null;
        }
        const responseText = (response.text || '').trim();
        if (!responseText) {
            console.error(`  ⚠️ Empty response from Gemini`);
            return null;
        }
        let analysisData;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisData = JSON.parse(jsonMatch[0]);
            }
            else {
                analysisData = JSON.parse(responseText);
            }
        }
        catch (parseError) {
            console.error(`  ❌ Failed to parse JSON response:`, responseText.substring(0, 200));
            return null;
        }
        const qualityScore = calculateAnalysisQuality(analysisData);
        const enhancedAnalysis = {
            technicalDeconstruction: {
                subjectCategory: analysisData.technicalDeconstruction?.subjectCategory || '',
                geometryShape: analysisData.technicalDeconstruction?.geometryShape || '',
                materialsTextures: analysisData.technicalDeconstruction?.materialsTextures || '',
                hardwareDetails: analysisData.technicalDeconstruction?.hardwareDetails || '',
                colorPalette: analysisData.technicalDeconstruction?.colorPalette || [],
                cameraAngle: analysisData.technicalDeconstruction?.cameraAngle || '',
                lightingShadows: analysisData.technicalDeconstruction?.lightingShadows || '',
            },
            visualDNA: {
                geometricPrimitives: analysisData.visualDNA?.geometricPrimitives || '',
                textureMicroDetails: analysisData.visualDNA?.textureMicroDetails || [],
                geometricQuirks: analysisData.visualDNA?.geometricQuirks || [],
                materialInteraction: analysisData.visualDNA?.materialInteraction || [],
                uniqueIdentifiers: analysisData.visualDNA?.uniqueIdentifiers || '',
            },
            generationPrompt: analysisData.generationPrompt || '',
            harmonizationPrompt: analysisData.harmonizationPrompt || '',
            condensedDescription: analysisData.condensedDescription || '',
            renderingKeywords: analysisData.renderingKeywords || [],
            qualityScore,
            analysisVersion: '2.0-vertex-style',
            analyzedAt: new Date().toISOString(),
        };
        console.log(`  ✅ Analysis complete (quality: ${qualityScore}/100)`);
        console.log(`  📝 Generation prompt: ${enhancedAnalysis.generationPrompt.substring(0, 100)}...`);
        return enhancedAnalysis;
    }
    catch (error) {
        console.error(`  ❌ Enhanced analysis failed:`, error);
        return null;
    }
}
function calculateAnalysisQuality(analysis) {
    let score = 0;
    const td = analysis.technicalDeconstruction;
    if (td?.subjectCategory && td.subjectCategory.length > 10)
        score += 15;
    if (td?.geometryShape && td.geometryShape.length > 15)
        score += 15;
    if (td?.materialsTextures && td.materialsTextures.length > 20)
        score += 20;
    if (td?.hardwareDetails && td.hardwareDetails.length > 10)
        score += 15;
    if (td?.colorPalette && td.colorPalette.length >= 2)
        score += 10;
    if (td?.cameraAngle && td.cameraAngle.length > 5)
        score += 5;
    if (td?.lightingShadows && td.lightingShadows.length > 5)
        score += 5;
    if (analysis.generationPrompt && analysis.generationPrompt.length > 50)
        score += 10;
    if (analysis.renderingKeywords && analysis.renderingKeywords.length >= 6)
        score += 5;
    return Math.min(score, 100);
}
export function selectBestImageForEnhancedAnalysis(product) {
    if (!product.images || product.images.length === 0) {
        return null;
    }
    const frontViewImage = product.images.find(url => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('front') || lowerUrl.includes('frontview') || lowerUrl.includes('front-view');
    });
    if (frontViewImage) {
        return { url: frontViewImage, source: 'Front View' };
    }
    const mainImage = product.images.find(url => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('main') || lowerUrl.includes('primary') || lowerUrl.includes('hero');
    });
    if (mainImage) {
        return { url: mainImage, source: 'Main View' };
    }
    const neutralImage = product.images.find(url => {
        const lowerUrl = url.toLowerCase();
        return !lowerUrl.includes('back') &&
            !lowerUrl.includes('side') &&
            !lowerUrl.includes('angle') &&
            !lowerUrl.includes('detail') &&
            !lowerUrl.includes('swatch');
    });
    if (neutralImage) {
        return { url: neutralImage, source: 'Default View' };
    }
    return { url: product.images[0], source: 'First Available' };
}
export async function runBatchEnhancedAnalysis(products, storage, options = {}, progressCallback) {
    const { mode = 'missing_only', limit } = options;
    let productsToProcess = products;
    if (mode === 'missing_only') {
        productsToProcess = products.filter(p => {
            const hasAnalysis = p.structuredAnalysis &&
                typeof p.structuredAnalysis === 'object' &&
                p.structuredAnalysis.analysisVersion === '2.0-vertex-style';
            return !hasAnalysis;
        });
    }
    if (limit && limit > 0) {
        productsToProcess = productsToProcess.slice(0, limit);
    }
    console.log(`\n🔬 Starting Enhanced Product Analysis (Vertex-Style)`);
    console.log(`   Mode: ${mode}`);
    console.log(`   Products to analyze: ${productsToProcess.length}`);
    const progress = {
        total: productsToProcess.length,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        averageQuality: 0,
        errors: []
    };
    let totalQuality = 0;
    for (const product of productsToProcess) {
        progress.currentProduct = `${product.sku} - ${product.name}`;
        console.log(`\n[${progress.processed + 1}/${progress.total}] ${progress.currentProduct}`);
        try {
            const selectedImage = selectBestImageForEnhancedAnalysis(product);
            if (!selectedImage) {
                console.log(`  ⏭️ Skipped - no images available`);
                progress.skipped++;
                progress.processed++;
                progressCallback?.(progress);
                continue;
            }
            console.log(`  📍 Using: ${selectedImage.source}`);
            const analysis = await analyzeProductForRendering(product, selectedImage.url);
            if (analysis) {
                await storage.updateProduct(product.id, {
                    structuredAnalysis: analysis,
                    structuredAnalysisQuality: String(analysis.qualityScore),
                    structuredAnalysisUpdatedAt: new Date(),
                    visualDescription: analysis.condensedDescription || product.visualDescription,
                });
                progress.successful++;
                totalQuality += analysis.qualityScore;
                progress.averageQuality = Math.round(totalQuality / progress.successful);
                console.log(`  ✅ Saved (quality: ${analysis.qualityScore}/100, avg: ${progress.averageQuality})`);
            }
            else {
                progress.failed++;
                progress.errors.push({
                    sku: product.sku,
                    error: 'Analysis returned null'
                });
                console.log(`  ❌ Failed - null analysis`);
            }
        }
        catch (error) {
            progress.failed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            progress.errors.push({
                sku: product.sku,
                error: errorMessage
            });
            console.error(`  ❌ Error:`, errorMessage);
        }
        progress.processed++;
        progressCallback?.(progress);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`\n✅ Enhanced Analysis Complete!`);
    console.log(`  📊 Total: ${progress.total}`);
    console.log(`  ✅ Successful: ${progress.successful}`);
    console.log(`  ❌ Failed: ${progress.failed}`);
    console.log(`  ⏭️  Skipped: ${progress.skipped}`);
    console.log(`  📈 Average Quality: ${progress.averageQuality}/100`);
    return progress;
}
export function buildRenderingPromptFromAnalysis(analysis) {
    if (analysis.generationPrompt) {
        return analysis.generationPrompt;
    }
    const td = analysis.technicalDeconstruction;
    const parts = [
        td.subjectCategory,
        td.materialsTextures,
        td.hardwareDetails,
        td.geometryShape,
        td.colorPalette.join(', '),
        'isolated on pure white background',
        'high fidelity',
        '8k',
        'photorealistic'
    ].filter(Boolean);
    return parts.join(', ');
}
//# sourceMappingURL=enhanced-product-analysis.js.map