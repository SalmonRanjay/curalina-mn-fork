/**
 * Room Parser Service
 *
 * Uses Gemini AI to parse natural language room descriptions and extract:
 * - Room dimensions (width, depth, height)
 * - Doorway dimensions (critical for delivery validation)
 * - Style preferences mentioned
 * - Confidence scores for measurements
 */
/**
 * Parse natural language room description using Gemini AI
 *
 * Examples of input:
 * - "My living room is 15 feet by 12 feet with 8-foot ceilings. Standard doorway."
 * - "Small bedroom, maybe 10x10 feet. I want a cozy vibe with light wood tones."
 * - "Open concept space about 20 feet wide. Modern minimalist style, no clutter."
 */
export async function parseRoomDescription(description) {
    if (!description || description.trim().length === 0) {
        return {
            confidence: 0,
            warnings: ['No room description provided'],
            rawText: description,
        };
    }
    try {
        const { GoogleGenAI } = await import('@google/genai');
        // Initialize Gemini client using Replit AI Integrations
        const ai = new GoogleGenAI({
            apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
            httpOptions: {
                apiVersion: "",
                baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
            },
        });
        const prompt = `You are a room measurement extraction expert. Parse this natural language room description and extract precise measurements and preferences.

USER'S DESCRIPTION:
"${description}"

EXTRACTION RULES:
1. Extract room dimensions (width x depth/length x height)
2. Extract doorway/entryway dimensions (critical for furniture delivery)
3. Identify any style preferences or design notes
4. Assign confidence score (0-100):
   - 100: Explicit measurements with units ("15 feet by 12 feet")
   - 80-90: Clear measurements with minor ambiguity ("about 15x12 feet")
   - 60-70: Vague sizes ("small room", "large space")
   - 0-50: No measurements mentioned
5. Flag warnings for ambiguous or missing critical data

UNIT CONVERSION:
- Convert all to consistent units (prefer feet for US-style descriptions)
- Standard doorway = 32 inches (assume if not specified)
- Standard ceiling = 8 feet (assume if not specified)

RESPONSE FORMAT (JSON):
{
  "dimensions": {
    "width": number (in feet),
    "depth": number (in feet),
    "height": number (in feet),
    "unit": "feet" | "meters" | "inches"
  },
  "doorway": {
    "width": number (in inches),
    "height": number (in inches, typically 80),
    "unit": "inches"
  },
  "ceilingHeight": number (in feet),
  "confidence": number (0-100),
  "extractedPreferences": string[] (style keywords like ["modern", "cozy", "light wood"]),
  "warnings": string[] (e.g., ["Ceiling height assumed to be 8 feet", "Doorway width assumed to be 32 inches"])
}

EXAMPLES:

Input: "My living room is 15 feet by 12 feet with 8-foot ceilings. Standard 32-inch doorway."
Output: {
  "dimensions": { "width": 15, "depth": 12, "height": 8, "unit": "feet" },
  "doorway": { "width": 32, "height": 80, "unit": "inches" },
  "ceilingHeight": 8,
  "confidence": 100,
  "extractedPreferences": [],
  "warnings": []
}

Input: "Small bedroom, maybe 10x10 feet. I want a cozy vibe with light wood tones."
Output: {
  "dimensions": { "width": 10, "depth": 10, "unit": "feet" },
  "doorway": { "width": 32, "height": 80, "unit": "inches" },
  "ceilingHeight": 8,
  "confidence": 75,
  "extractedPreferences": ["cozy", "light wood"],
  "warnings": ["Ceiling height assumed to be 8 feet", "Doorway dimensions assumed (standard 32x80 inches)"]
}

Input: "Open concept space about 20 feet wide. Modern minimalist style, no clutter."
Output: {
  "dimensions": { "width": 20, "unit": "feet" },
  "ceilingHeight": 8,
  "confidence": 60,
  "extractedPreferences": ["modern", "minimalist"],
  "warnings": ["Room depth not specified", "Ceiling height assumed to be 8 feet", "Doorway dimensions assumed (standard 32x80 inches)"]
}

Now parse the user's description and return ONLY the JSON response.`;
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const responseText = result.text || '';
        if (!responseText) {
            throw new Error('No response from Gemini API');
        }
        console.log('🤖 Room parser Gemini response:', responseText);
        // Extract JSON from response (handle markdown code blocks)
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        }
        else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }
        const parsed = JSON.parse(jsonText);
        // Build ParsedRoomData with all extracted information
        const roomData = {
            dimensions: parsed.dimensions || undefined,
            doorway: parsed.doorway || undefined,
            ceilingHeight: parsed.ceilingHeight || undefined,
            confidence: parsed.confidence || 50,
            extractedPreferences: parsed.extractedPreferences || [],
            warnings: parsed.warnings || [],
            rawText: description,
        };
        console.log('📏 Parsed room data:', {
            dimensions: roomData.dimensions,
            doorway: roomData.doorway,
            confidence: roomData.confidence,
            warnings: roomData.warnings,
        });
        return roomData;
    }
    catch (error) {
        console.error('❌ Room parsing error:', error);
        // Return fallback with low confidence
        return {
            confidence: 0,
            warnings: [
                'Failed to parse room description',
                error instanceof Error ? error.message : 'Unknown error'
            ],
            rawText: description,
        };
    }
}
/**
 * Validate parsed room data for completeness
 * Returns issues that should be surfaced to user
 */
export function validateParsedRoomData(roomData) {
    const issues = [];
    // Critical: No dimensions at all
    if (!roomData.dimensions) {
        issues.push('Could not extract room dimensions from your description. Please provide width and length.');
    }
    // Warning: Missing key dimensions
    if (roomData.dimensions && !roomData.dimensions.width) {
        issues.push('Room width not specified');
    }
    if (roomData.dimensions && !roomData.dimensions.depth) {
        issues.push('Room depth/length not specified');
    }
    // Low confidence
    if (roomData.confidence < 60) {
        issues.push('Low confidence in measurements - please provide more specific dimensions');
    }
    return issues;
}
//# sourceMappingURL=room-parser-service.js.map