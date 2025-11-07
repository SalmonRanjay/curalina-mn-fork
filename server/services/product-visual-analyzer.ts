import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client with AI Integrations credentials
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

/**
 * Analyze a single product image using Gemini Vision
 * Returns detailed visual description of the product from that angle
 */
async function analyzeProductImage(imageUrl: string, imageName: string): Promise<string> {
  console.log(`  🔍 Analyzing image: ${imageName}`);
  
  const prompt = `Analyze this furniture product image in detail. Provide a comprehensive visual description focusing on:

1. **Overall Design**: Shape, silhouette, style (modern, traditional, minimalist, etc.)
2. **Construction Details**: Frame structure, legs, supports, visible joinery
3. **Materials & Finishes**: Wood type/grain, metal finish, fabric texture, upholstery details
4. **Proportions**: Height, width, depth relationships, scale indicators
5. **Distinctive Features**: Unique design elements, curves, angles, patterns
6. **Color & Tone**: Specific color descriptions, undertones, color variations
7. **Hardware**: Handles, pulls, hinges, decorative elements
8. **Functional Elements**: Drawers, shelves, cushions, armrests, etc.

Be specific and descriptive. Focus on visual details that would help an AI image generator create similar furniture.

Example good description:
"Low-profile sectional sofa with gently curved organic shape. Three-seater with rounded armrests that flow seamlessly into the backrest. Upholstered in cream-colored bouclé fabric with visible texture and subtle sheen. Tapered wooden legs in dark walnut finish, set at slight angles. Clean modern lines with no visible seams or buttons. Cushions appear deeply tufted with generous padding."

Provide a similar detailed description for this product image.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: 'image/jpeg',
              fileUri: imageUrl
            }
          }
        ]
      }]
    });

    const description = response.text?.trim() || '';
    
    if (!description) {
      console.warn(`  ⚠️ No description returned for ${imageName}`);
      return '';
    }
    
    console.log(`  ✅ Analysis complete for ${imageName}`);
    return description;
  } catch (error) {
    console.error(`  ❌ Error analyzing ${imageName}:`, error);
    return '';
  }
}

/**
 * Analyze all images for a product and create comprehensive visual description
 * Combines insights from multiple angles for complete understanding
 */
export async function analyzeProductVisuals(
  productName: string,
  imageUrls: string[]
): Promise<string> {
  console.log(`\n🎨 Analyzing ${imageUrls.length} images for: ${productName}`);
  
  if (imageUrls.length === 0) {
    console.warn('  ⚠️ No images provided');
    return '';
  }
  
  // Analyze each image
  const analyses: string[] = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const imageName = `Image ${i + 1}/${imageUrls.length}`;
    
    const description = await analyzeProductImage(imageUrl, imageName);
    if (description) {
      analyses.push(description);
    }
    
    // Delay to avoid rate limiting (2 seconds between images)
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (analyses.length === 0) {
    console.warn('  ⚠️ No successful analyses');
    return '';
  }
  
  // If single image, return its analysis
  if (analyses.length === 1) {
    return analyses[0];
  }
  
  // Combine multiple angle analyses using Gemini
  console.log(`  🔄 Synthesizing ${analyses.length} analyses into comprehensive description...`);
  
  const synthesisPrompt = `You are analyzing a furniture product from multiple angles. Below are detailed visual descriptions from ${analyses.length} different views of the same product.

${analyses.map((desc, i) => `**View ${i + 1}:**\n${desc}`).join('\n\n')}

Create a SINGLE comprehensive visual description that:
1. Combines insights from all views
2. Describes the complete product (front, side, back perspectives)
3. Highlights features visible from different angles
4. Maintains specific details (materials, colors, proportions)
5. Creates a cohesive understanding of the entire product

Focus on visual details that would help an AI image generator recreate this furniture accurately.

Output format: One cohesive paragraph (200-300 words) describing the complete product.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: synthesisPrompt }]
      }]
    });

    const comprehensiveDescription = response.text?.trim() || analyses.join(' ');
    console.log(`  ✅ Comprehensive description created (${comprehensiveDescription.length} chars)`);
    
    return comprehensiveDescription;
  } catch (error) {
    console.error('  ❌ Error synthesizing descriptions:', error);
    // Fallback: join all descriptions
    return analyses.join(' ');
  }
}

/**
 * Batch analyze products - returns results for multiple products
 */
export async function batchAnalyzeProducts(
  products: Array<{ sku: string; name: string; images: string[] }>
): Promise<Array<{ sku: string; visualDescription: string; error?: string }>> {
  console.log(`\n🚀 Starting batch analysis of ${products.length} products...`);
  
  const results: Array<{ sku: string; visualDescription: string; error?: string }> = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] Processing: ${product.name} (${product.sku})`);
    
    try {
      const visualDescription = await analyzeProductVisuals(product.name, product.images);
      
      results.push({
        sku: product.sku,
        visualDescription
      });
      
      console.log(`✅ Success: ${product.sku}`);
    } catch (error) {
      console.error(`❌ Failed: ${product.sku}`, error);
      results.push({
        sku: product.sku,
        visualDescription: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Delay between products to avoid rate limiting
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const successful = results.filter(r => r.visualDescription && !r.error).length;
  const failed = results.filter(r => r.error).length;
  
  console.log(`\n📊 Batch Analysis Complete:`);
  console.log(`  ✅ Successful: ${successful}/${products.length}`);
  console.log(`  ❌ Failed: ${failed}/${products.length}`);
  
  return results;
}
