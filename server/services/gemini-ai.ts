import { GoogleGenAI, Modality } from "@google/genai";
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
