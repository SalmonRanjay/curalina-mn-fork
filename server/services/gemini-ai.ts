import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { QuizResponse, Product } from "@shared/schema";

// Initialize Gemini client with AI Integrations credentials
// This is using Replit's AI Integrations service, which provides Gemini-compatible API access
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

// Style descriptions for rich prompt building
const styleDescriptions: Record<string, string> = {
  modern: "sleek minimalist design with clean lines, neutral colors, and contemporary furniture",
  midcentury: "mid-century modern aesthetic with organic shapes, warm wood tones, and iconic designer pieces",
  scandinavian: "Scandinavian style with light woods, white walls, cozy textiles, and functional simplicity",
  industrial: "industrial loft design with exposed brick, metal accents, concrete floors, and raw materials",
  bohemian: "bohemian eclectic mix with vibrant colors, patterns, plants, and global-inspired textiles",
  traditional: "classic traditional interior with rich woods, elegant fabrics, and timeless furniture",
  coastal: "coastal beach house vibe with light blues, whites, natural textures, and breezy atmosphere",
  farmhouse: "modern farmhouse style with rustic charm, shiplap walls, vintage accents, and cozy comfort",
  transitional: "transitional blend of traditional and contemporary with balanced proportions and neutral palette",
  maximalist: "bold maximalist design with rich colors, layered patterns, statement pieces, and eclectic collections",
};

const roomTypeDescriptions: Record<string, string> = {
  "living-room": "spacious living room",
  "bedroom": "serene bedroom",
  "dining-room": "elegant dining room",
  "office": "productive home office",
  "kitchen": "modern kitchen",
  "bathroom": "luxurious bathroom",
};

/**
 * Style synonyms and variations
 */
const styleSynonyms: Record<string, string[]> = {
  'midcentury': ['midcentury', 'mid-century', 'mcm'],
  'scandi': ['scandi', 'scandinavian', 'nordic'],
  'modern': ['modern', 'contemporary'],
  'industrial': ['industrial', 'loft'],
  'bohemian': ['bohemian', 'boho'],
  'farmhouse': ['farmhouse', 'rustic'],
};

/**
 * Normalize and tokenize style names
 * Handles composite styles like "Midcentury Scandi"
 */
function normalizeAndTokenizeStyle(style: string): string[] {
  const normalized = style.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  
  // Expand tokens with synonyms
  const expandedTokens: string[] = [];
  for (const token of tokens) {
    expandedTokens.push(token);
    // Add synonyms
    for (const [key, synonyms] of Object.entries(styleSynonyms)) {
      if (synonyms.includes(token)) {
        expandedTokens.push(...synonyms);
      }
    }
  }
  
  return Array.from(new Set(expandedTokens)); // Remove duplicates
}

/**
 * Check if two styles match (flexible matching with tokenization)
 */
function stylesMatch(quizStyle: string, productStyle: string): boolean {
  const quizTokens = normalizeAndTokenizeStyle(quizStyle);
  const productTokens = normalizeAndTokenizeStyle(productStyle);
  
  // Check if any tokens overlap
  return quizTokens.some(qt => productTokens.some(pt => 
    qt.includes(pt) || pt.includes(qt)
  ));
}

/**
 * Filter products based on quiz preferences
 * Matches room type, style, features, and budget
 */
export function filterProductsByQuiz(products: Product[], quiz: QuizResponse): Product[] {
  const budgetMax = parseBudgetRange(quiz.budgetRange);
  
  // First pass: strict filtering
  const strictlyFiltered = products.filter(product => {
    // Filter by availability
    if (product.availability !== 'in_stock') return false;
    
    // Filter by images (must have at least one image)
    if (!product.images || product.images.length === 0) return false;
    
    // Filter by room type
    if (product.roomType && product.roomType.length > 0) {
      const roomMatch = product.roomType.some(rt => 
        rt.toLowerCase().includes(quiz.roomType.toLowerCase()) ||
        quiz.roomType.toLowerCase().includes(rt.toLowerCase())
      );
      if (!roomMatch) return false;
    }
    
    // Filter by design style (flexible matching)
    if (product.designStyle && product.designStyle.length > 0) {
      const styleMatch = product.designStyle.some(ds =>
        stylesMatch(quiz.style, ds)
      );
      if (!styleMatch) return false;
    }
    
    // Filter by budget (if budget is set)
    if (budgetMax && product.price) {
      const productPrice = parseFloat(product.price.toString());
      if (productPrice > budgetMax) return false;
    }
    
    // STRICT: Require at least one key feature match if features are specified
    if (quiz.keyFeatures && quiz.keyFeatures.length > 0) {
      if (!product.keyFeatures || product.keyFeatures.length === 0) {
        return false; // No features, can't match
      }
      
      const featureMatch = quiz.keyFeatures.some(qf =>
        product.keyFeatures!.some(pf =>
          pf.toLowerCase().includes(qf.toLowerCase()) ||
          qf.toLowerCase().includes(pf.toLowerCase())
        )
      );
      
      if (!featureMatch) return false;
    }
    
    return true;
  });
  
  // Fallback: if strict filtering yields too few products (< 5), relax style requirement
  if (strictlyFiltered.length < 5) {
    console.warn(`Strict filter yielded only ${strictlyFiltered.length} products, relaxing style requirement`);
    
    return products.filter(product => {
      // Keep all hard requirements
      if (product.availability !== 'in_stock') return false;
      if (!product.images || product.images.length === 0) return false;
      
      // Room type still required
      if (product.roomType && product.roomType.length > 0) {
        const roomMatch = product.roomType.some(rt => 
          rt.toLowerCase().includes(quiz.roomType.toLowerCase()) ||
          quiz.roomType.toLowerCase().includes(rt.toLowerCase())
        );
        if (!roomMatch) return false;
      }
      
      // Budget still required
      if (budgetMax && product.price) {
        const productPrice = parseFloat(product.price.toString());
        if (productPrice > budgetMax) return false;
      }
      
      // Key features still required
      if (quiz.keyFeatures && quiz.keyFeatures.length > 0) {
        if (!product.keyFeatures || product.keyFeatures.length === 0) {
          return false;
        }
        
        const featureMatch = quiz.keyFeatures.some(qf =>
          product.keyFeatures!.some(pf =>
            pf.toLowerCase().includes(qf.toLowerCase()) ||
            qf.toLowerCase().includes(pf.toLowerCase())
          )
        );
        
        if (!featureMatch) return false;
      }
      
      return true;
    });
  }
  
  return strictlyFiltered;
}

/**
 * Parse budget range to get maximum budget
 */
function parseBudgetRange(budgetRange: string): number | null {
  // Examples: "$2K-$5K", "$5K-$10K", "$10K+"
  const match = budgetRange.match(/\$(\d+)K\+?/g);
  if (!match) return null;
  
  // Get the highest number
  const numbers = match.map(m => parseInt(m.replace(/\$|K|\+/g, '')) * 1000);
  return Math.max(...numbers);
}

/**
 * Use Gemini AI to select the best products for the room
 * Returns a curated list of products with placement suggestions
 */
export async function selectProductsWithAI(
  products: Product[],
  quiz: QuizResponse
): Promise<Array<{ sku: string; name: string; placement: string; reasoning: string }>> {
  try {
    // Prepare product data for AI with feature matching scores
    const productList = products.map(p => {
      // Calculate feature match score
      let featureMatchScore = 0;
      if (quiz.keyFeatures && quiz.keyFeatures.length > 0 && 
          p.keyFeatures && p.keyFeatures.length > 0) {
        const matchingFeatures = quiz.keyFeatures.filter(qf =>
          p.keyFeatures!.some(pf =>
            pf.toLowerCase().includes(qf.toLowerCase()) ||
            qf.toLowerCase().includes(pf.toLowerCase())
          )
        );
        featureMatchScore = matchingFeatures.length / quiz.keyFeatures.length;
      }
      
      return {
        sku: p.sku,
        name: p.name,
        description: p.description || "",
        price: p.price,
        features: p.keyFeatures || [],
        materials: p.materials || [],
        colors: p.colors || [],
        featureMatchScore: Math.round(featureMatchScore * 100), // Percentage
      };
    });

    const prompt = `You are an expert interior designer selecting furniture for a ${quiz.roomType}.

Room Requirements:
- Style: ${quiz.style}
- Key Features REQUIRED: ${quiz.keyFeatures?.join(", ") || "None specified"}
- Budget: ${quiz.budgetRange}
- User Preferences: ${quiz.preferences?.join(", ") || "None"}

Available Products (each includes featureMatchScore showing % match with required features):
${JSON.stringify(productList, null, 2)}

IMPORTANT SELECTION CRITERIA:
1. PRIORITIZE products with high featureMatchScore (those matching the required key features)
2. Select 5-8 products that work best together for this room
3. Ensure the selection creates a cohesive, functional design
4. Stay within the budget range

For each selected product, specify:
1. SKU and name
2. Specific placement in the room (e.g., "against the north wall", "center of the room", "near the window")
3. Reasoning explaining:
   - How it matches the required key features
   - Why it fits the ${quiz.style} style
   - How it contributes to the overall design

Return a JSON array with this structure:
[
  {
    "sku": "product-sku",
    "name": "product name",
    "placement": "specific location description",
    "reasoning": "detailed explanation of feature match and design fit"
  }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sku: { type: Type.STRING },
              name: { type: Type.STRING },
              placement: { type: Type.STRING },
              reasoning: { type: Type.STRING },
            },
            required: ["sku", "name", "placement", "reasoning"]
          }
        }
      }
    });

    const selectedProducts = JSON.parse(response.text || "[]");
    console.log(`AI selected ${selectedProducts.length} products for ${quiz.roomType}`);
    
    return selectedProducts;
  } catch (error) {
    console.error("AI product selection error:", error);
    // Fallback: select first 5 products
    return products.slice(0, 5).map(p => ({
      sku: p.sku,
      name: p.name,
      placement: "in the room",
      reasoning: "Selected based on filters"
    }));
  }
}

/**
 * Build a detailed prompt from quiz responses and selected products
 */
export function buildPromptFromQuiz(quiz: QuizResponse, selectedProducts?: Array<{ sku: string; name: string; placement: string; reasoning: string }>): string {
  const roomDesc = roomTypeDescriptions[quiz.roomType] || quiz.roomType;
  const styleDesc = styleDescriptions[quiz.style.toLowerCase()] || quiz.style;
  
  let prompt = `Create a photorealistic interior design rendering of a ${roomDesc} in ${styleDesc} style. `;
  
  // Add key features
  if (quiz.keyFeatures && quiz.keyFeatures.length > 0) {
    prompt += `The space should feature: ${quiz.keyFeatures.join(", ")}. `;
  }
  
  // Add preferences if provided
  if (quiz.preferences && Array.isArray(quiz.preferences) && quiz.preferences.length > 0) {
    prompt += `Additional requirements: ${quiz.preferences.join(", ")}. `;
  }
  
  // Add specific products if provided
  if (selectedProducts && selectedProducts.length > 0) {
    prompt += `\n\nThe room should include the following specific furniture and items:\n`;
    selectedProducts.forEach((product, index) => {
      prompt += `${index + 1}. ${product.name} - placed ${product.placement}. `;
    });
    prompt += `\n\nEnsure all these products are visible and well-integrated into the design. `;
  }
  
  // Add quality and lighting instructions
  prompt += `The image should be high-quality, well-lit with natural lighting, professional interior photography style, 8K resolution, architectural digest quality.`;
  
  return prompt;
}

/**
 * Generate an interior design image using Gemini AI
 * @param prompt - Detailed description of the desired room
 * @param floorplanUrl - Optional floorplan image URL for image-to-image generation
 * @returns Base64 data URL (data:image/png;base64,...)
 */
export async function generateInteriorImage(
  prompt: string,
  floorplanUrl?: string
): Promise<string> {
  try {
    // Text-to-image generation
    if (!floorplanUrl) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      
      if (!imagePart?.inlineData?.data) {
        throw new Error("No image data in response");
      }

      const mimeType = imagePart.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${imagePart.inlineData.data}`;
    }
    
    // Image-to-image generation with floorplan
    const floorplanResponse = await fetch(floorplanUrl);
    const floorplanBuffer = await floorplanResponse.arrayBuffer();
    const floorplanBase64 = Buffer.from(floorplanBuffer).toString('base64');
    
    const enhancedPrompt = `${prompt} Use the provided floorplan as a spatial reference for furniture placement and room layout.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{
        role: "user",
        parts: [
          { text: enhancedPrompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: floorplanBase64
            }
          }
        ]
      }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      throw new Error("No image data in response");
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.error("Gemini AI generation error:", error);
    throw new Error(`Failed to generate interior design: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract featured product SKUs from the generated image
 * This is a placeholder - in production, you might use:
 * 1. Vision AI to detect furniture items
 * 2. Manual curation
 * 3. Random selection based on style tags
 */
export function extractProductSkus(quiz: QuizResponse, availableProducts: Array<{ sku: string; styleTags: string[] }>): string[] {
  // Filter products by style match
  const styleMatch = availableProducts.filter(p => 
    p.styleTags.some(tag => tag.toLowerCase() === quiz.style.toLowerCase())
  );
  
  // Return up to 6 product SKUs
  return styleMatch
    .slice(0, 6)
    .map(p => p.sku);
}

/**
 * AI-powered intelligent matching of folder names to product names
 * Uses Gemini to find the best matches even when names don't exactly match
 */
export interface FolderMatch {
  folderName: string;
  productName: string | null;
  productSku: string | null;
  productId: string | null;
  confidence: number; // 0-100
  reasoning: string;
}

export async function matchFoldersToProducts(
  folderNames: string[],
  products: Array<{ id: string; name: string; sku: string }>
): Promise<FolderMatch[]> {
  if (folderNames.length === 0 || products.length === 0) {
    return [];
  }

  try {
    const prompt = `You are an intelligent product name matcher for a furniture e-commerce platform.

Given these folder names from an image library:
${folderNames.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

And these products in the database:
${products.map((p, i) => `${i + 1}. Name: "${p.name}", SKU: "${p.sku}"`).join('\n')}

Match each folder name to the most likely product. Use fuzzy matching, handle variations like:
- Missing/extra words (e.g., "Abaso Large Accent Bench" vs "Abaso Accent Bench")
- Different word order
- Abbreviations
- Typos or similar spellings
- Hyphens vs spaces (e.g., "Side-Table" vs "Side Table")

For each folder, return:
- folderName: the original folder name
- productName: the matched product name (or null if no good match)
- productSku: the matched product SKU (or null if no good match)
- confidence: confidence score 0-100 (100 = perfect match, 80+ = very likely, 60-79 = possible, <60 = uncertain)
- reasoning: brief explanation of why this match was chosen or why no match was found

Return ONLY the JSON array, no additional text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              folderName: { type: Type.STRING },
              productName: { type: Type.STRING, nullable: true },
              productSku: { type: Type.STRING, nullable: true },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["folderName", "productName", "productSku", "confidence", "reasoning"]
          }
        }
      }
    });

    // Parse and validate response
    let matches: Array<{
      folderName: string;
      productName: string | null;
      productSku: string | null;
      confidence: number;
      reasoning: string;
    }> = [];

    try {
      // Get response text (it's a getter property, not a function)
      const responseText = response.text;
      
      if (!responseText) {
        console.error("Empty response from Gemini");
        return [];
      }

      matches = JSON.parse(responseText);
      
      // Validate it's an array
      if (!Array.isArray(matches)) {
        console.error("Response is not an array:", responseText);
        return [];
      }

      console.log(`AI matched ${matches.length} folders`);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw response:", response.text);
      // Return empty array instead of crashing
      return [];
    }

    // Add productId to each match
    return matches.map(match => {
      const product = match.productSku 
        ? products.find(p => p.sku === match.productSku)
        : null;
      
      return {
        ...match,
        productId: product?.id || null
      };
    });
  } catch (error) {
    console.error("AI matching error:", error);
    throw new Error(`Failed to match folders: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
