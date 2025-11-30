/**
 * Analyze room image using GPT-5 Vision to extract architectural details
 * This analysis is shared across all three services for fair comparison
 */
async function analyzeRoomWithGPT5Vision(roomImageUrl) {
    try {
        // Initialize OpenAI client (Replit AI Integrations)
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        // Resolve relative URLs to absolute
        const absoluteUrl = roomImageUrl.startsWith('http')
            ? roomImageUrl
            : `${process.env.REPLIT_DEV_DOMAIN?.startsWith('http') ? process.env.REPLIT_DEV_DOMAIN : `https://${process.env.REPLIT_DEV_DOMAIN}`}${roomImageUrl.startsWith('/') ? roomImageUrl : `/${roomImageUrl}`}`;
        console.log(`  🔍 Analyzing room with GPT-5 Vision: ${absoluteUrl}`);
        // Analyze with GPT-5 Vision
        const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [{
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze this room's architectural features in detail. Describe:
1. Wall positions, colors, and materials
2. Floor type and color  
3. Ceiling height and design
4. Window locations, sizes, and styles
5. Door positions and types
6. Built-in features (shelves, fireplace, etc.)
7. Room dimensions (estimate)
8. Lighting fixtures and their positions
9. Any architectural details (molding, columns, etc.)

Be specific and precise - this will be used to recreate the exact same room structure with new furniture.`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: absoluteUrl,
                            }
                        }
                    ]
                }],
            max_completion_tokens: 1000,
        });
        const analysis = response.choices[0]?.message?.content || 'Room analysis unavailable';
        console.log(`  ✅ GPT-5 Vision analysis complete (${analysis.length} chars)`);
        return analysis;
    }
    catch (error) {
        console.error('GPT-5 Vision room analysis failed:', error);
        return 'Room analysis unavailable';
    }
}
/**
 * Build consistent prompt for all AI services
 * This ensures fair comparison by giving identical instructions to all three services
 */
export async function buildSharedPrompt(params) {
    console.log(`\n📝 Building shared prompt for AI comparison...`);
    console.log(`   Room image: ${params.roomImageUrl || '(none - text-to-image mode)'}`);
    console.log(`   Products: ${params.products.length}`);
    // Analyze room if image provided
    let roomAnalysis = '';
    if (params.roomImageUrl && params.roomImageUrl.trim().length > 0) {
        roomAnalysis = await analyzeRoomWithGPT5Vision(params.roomImageUrl);
    }
    // Build product descriptions (identical for all services)
    const productDescriptions = params.products
        .map((p, i) => {
        const desc = p.condensedDescription || p.visualDescription || p.name;
        const colors = p.colors && p.colors.length > 0 ? ` in ${p.colors.join(' and ')}` : '';
        return `${i + 1}. ${p.name}${colors}: ${desc}`;
    })
        .join('\n');
    // Build architectural context
    let architecturalContext = '';
    if (roomAnalysis) {
        // Image-to-image mode: Use GPT-5 Vision analysis
        architecturalContext = `\n\n🔒 CRITICAL - PRESERVE THESE EXACT ARCHITECTURAL FEATURES:
${roomAnalysis}

⚠️ STRICT REQUIREMENT: Recreate this EXACT room structure. ALL walls, floors, ceiling, windows, doors, built-in features, and architectural details MUST match the description above PRECISELY. Only furniture should be different - the room itself must be IDENTICAL.`;
    }
    else if (params.roomDescription || params.parsedRoomData) {
        // Text-to-image mode with room specifications: Use user's room description
        let roomSpec = '';
        // Use parsed data if available (more structured)
        if (params.parsedRoomData?.dimensions) {
            const dims = params.parsedRoomData.dimensions;
            const width = dims.width || dims.depth || '?';
            const depth = dims.depth || dims.width || '?';
            roomSpec = `📏 ROOM DIMENSIONS: ${width} x ${depth} ${dims.unit || 'feet'}`;
            if (params.parsedRoomData.ceilingHeight) {
                roomSpec += `, Ceiling Height: ${params.parsedRoomData.ceilingHeight} feet`;
            }
        }
        // Add raw room description - this contains window/door placement details
        if (params.roomDescription) {
            roomSpec += roomSpec ? '\n\n' : '';
            roomSpec += `📋 FULL ROOM SPECIFICATION:\n${params.roomDescription}`;
        }
        architecturalContext = `\n\n🏠 CREATE THIS EXACT ROOM LAYOUT:
${roomSpec}

⚠️ CRITICAL - FOLLOW THESE ARCHITECTURAL REQUIREMENTS:
1. BUILD the room with the EXACT dimensions specified above
2. WINDOWS: Place windows EXACTLY where described in the specification
3. DOORS: Place doors EXACTLY where described in the specification
4. SCALE: Furniture must be properly scaled to fit within these room dimensions
5. PERSPECTIVE: Show the room from an angle that reveals the window and door placement`;
    }
    else {
        // Text-to-image mode: Generic room description (no preservation constraints)
        architecturalContext = `\n\n✨ Create a beautiful, cohesive ${params.stylePreference || 'modern'} ${params.roomType || 'room'} with professional interior design.`;
    }
    // Build main prompt (consistent structure for all services)
    const roomDescription = roomAnalysis
        ? `Recreate this EXACT room with new furniture`
        : `Create a photorealistic interior design render of a ${params.stylePreference || 'modern'} ${params.roomType || 'room'}`;
    const mainPrompt = `${roomDescription}.${architecturalContext}

Furnish with these EXACT products - reference images are provided for each:
${productDescriptions}

═══════════════════════════════════════════════════════════════════════════════
🎯 PRODUCT FIDELITY REQUIREMENTS (MANDATORY - WILL BE VERIFIED)
═══════════════════════════════════════════════════════════════════════════════

📸 EXACT VISUAL MATCH - Each rendered product MUST be INDISTINGUISHABLE from its reference image:
• SHAPE: Exact silhouette, proportions, curves, angles - no artistic interpretation
• COLOR: Precise color matching - if reference shows "warm walnut", render warm walnut, not "dark brown"
• MATERIAL: Exact texture and finish - leather must look like leather, velvet like velvet, metal like metal
• DETAILS: All visible features must match - drawer pulls, leg style, stitching patterns, hardware finishes
• CONSTRUCTION: If reference shows open-back shelving, render open-back. If solid, render solid.

🔍 SIDE-BY-SIDE COMPARISON TEST: The rendered product placed next to its reference image should look like the SAME OBJECT photographed in a different room.

═══════════════════════════════════════════════════════════════════════════════
🚫 ANTI-OVERLAP & VISIBILITY REQUIREMENTS (MANDATORY)
═══════════════════════════════════════════════════════════════════════════════

• ZERO OCCLUSION: No product may hide, overlap, or obscure ANY part of another product
• FULL VISIBILITY: Every product must be 100% visible - no partial hiding behind larger items
• SPATIAL SEPARATION: Maintain minimum 18 inches (real-world scale) between all furniture pieces
• LAYER ORDERING: Smaller items (side tables, lamps, accent pieces) must be placed WHERE THEY ARE FULLY VISIBLE
• FOREGROUND PRIORITY: If a small item would be hidden behind a large item, move it to an open area
• FRAME MARGINS: All furniture must appear FULLY within frame with 10% margin from all edges

═══════════════════════════════════════════════════════════════════════════════
📋 PLACEMENT RULES (Space → Fit → Style Priority)
═══════════════════════════════════════════════════════════════════════════════

🏠 STEP 1 - UNDERSTAND THE SPACE:
• Identify room dimensions, wall positions, natural lighting direction
• Locate traffic paths (door-to-door, door-to-window walkways)
• Note architectural constraints (windows, doors, built-ins)

📐 STEP 2 - ZONE-BASED PLACEMENT:
• Sofa/primary seating: Against longest wall, facing focal point
• Coffee table: Centered in front of primary seating, 18" clearance
• Accent chairs: Flanking sofa at 90° angles for conversation
• Side tables: Adjacent to seating, within arm's reach
• Lighting: Corners near seating, on surfaces (table lamps)
• Storage: Against walls, not blocking walkways

⚖️ STEP 3 - PHYSICAL FIT VALIDATION:
• Each piece MUST fit its designated zone with proper clearance
• Minimum 36" walkways between furniture
• Scale furniture to room proportions - not too small, not cramped

• EXACTLY ${params.products.length} PRODUCTS - ALL ${params.products.length} must appear clearly, NO extras
• DO NOT ADD any furniture, mirrors, art, or decor NOT in the product list
• ALIGNMENT: Sofas and beds STRAIGHT and PARALLEL to walls - never diagonal
• SCALE: Real-world dimensions - a 36" side table should look 36" relative to an 84" sofa
• Small accent pieces (pedestals, ottomans, side tables) MUST be prominently visible - place in open areas

═══════════════════════════════════════════════════════════════════════════════
✨ QUALITY STANDARDS
═══════════════════════════════════════════════════════════════════════════════

• Photorealistic quality with professional interior photography lighting${roomAnalysis ? ' matching the original room' : ''}
• Magazine-quality composition following interior design principles
• Natural, believable furniture arrangement
${roomAnalysis ? '• Room structure (walls, floor, ceiling, windows, doors) IDENTICAL to original' : '• Cohesive color palette and style'}

${roomAnalysis ? 'Now, furnish this space using the product reference images provided. Match each product EXACTLY.' : 'Use the product reference images provided. Match each product EXACTLY.'}`;
    console.log(`   ✅ Shared prompt built (${mainPrompt.length} chars)`);
    return {
        mainPrompt,
        architecturalContext,
        roomAnalysis,
        productDescriptions,
    };
}
//# sourceMappingURL=shared-prompt-builder.js.map