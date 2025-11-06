import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { QuizResponse } from "@shared/schema";

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
 * Build a detailed prompt from quiz responses
 */
export function buildPromptFromQuiz(quiz: QuizResponse): string {
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
