import OpenAI from "openai";
// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});
/**
 * Generate room render using OpenAI GPT Image 1
 * Uses shared prompt builder for fair comparison with Gemini/Stability AI
 */
export async function generateOpenAIRender(params) {
    const startTime = Date.now();
    try {
        console.log(`\n🎨 Starting OpenAI GPT Image 1 render generation...`);
        console.log(`📍 Room image: ${params.roomImageUrl || '(none - text-to-image mode)'}`);
        console.log(`📦 Products to furnish: ${params.products.length}`);
        // Use pre-built shared prompt if provided (for fair comparison), otherwise build our own
        let prompt;
        if (params.sharedPrompt) {
            prompt = params.sharedPrompt;
            console.log(`📝 Using pre-built shared prompt (${prompt.length} chars)`);
        }
        else {
            const { buildSharedPrompt } = await import('./shared-prompt-builder');
            const sharedPrompt = await buildSharedPrompt({
                roomImageUrl: params.roomImageUrl,
                products: params.products,
                roomType: params.roomType,
                stylePreference: params.stylePreference,
            });
            prompt = sharedPrompt.mainPrompt;
            console.log(`📝 Built prompt (${prompt.length} chars)`);
        }
        console.log(`📝 Shared prompt length: ${prompt.length} characters`);
        console.log(`🎨 Calling OpenAI GPT Image 1...`);
        // Generate image using GPT Image 1 (replaces DALL-E 3, superior text rendering and photorealism)
        // GPT-5 is the language model (August 2025), gpt-image-1 is the image generation model
        const response = await openai.images.generate({
            model: "gpt-image-1",
            prompt: prompt,
            size: "1024x1024",
            // Note: response_format is not supported for gpt-image-1, always returns base64
        });
        const imageBase64 = response.data?.[0]?.b64_json;
        if (!imageBase64) {
            throw new Error('No image data returned from OpenAI');
        }
        const generationTime = Date.now() - startTime;
        console.log(`✅ OpenAI render generated in ${(generationTime / 1000).toFixed(1)}s`);
        // Return all products as "sent to AI" since we described them in the prompt
        const productSkus = params.products.map(p => p.sku);
        return {
            success: true,
            imageBase64,
            productsUsed: params.products.length,
            productsSentToAI: productSkus,
            generationTime
        };
    }
    catch (error) {
        const generationTime = Date.now() - startTime;
        console.error(`❌ OpenAI render generation failed:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            productsUsed: 0,
            productsSentToAI: [],
            generationTime
        };
    }
}
//# sourceMappingURL=openai-render.js.map