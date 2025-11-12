import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { QuizResponse, Product } from "@shared/schema";
import { selectProductsWithComposition, generateCompositionInstructions, validateComposition, detectFunctionalCategory, getRoomTemplate } from './room-composition-service';

// Initialize Gemini client with AI Integrations credentials
// This is using Replit's AI Integrations service, which provides Gemini-compatible API access
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

// Enhanced style descriptions for professional renders
const styleDescriptions: Record<string, string> = {
  "organic modern": "Organic Modern aesthetic featuring curved sculptural furniture with soft edges, natural materials like white oak and travertine, plush boucle and linen textiles, earthy neutral color palette with warm undertones, minimalist yet inviting atmosphere with tactile textures, low-profile furniture silhouettes, and abundant natural light",
  "modern farmhouse": "Modern Farmhouse design with clean architectural lines balanced by rustic warmth, shiplap or board-and-batten walls in crisp white or soft greige, distressed wood furniture with vintage character, black metal accents and fixtures, cozy layered textiles including knit throws and cotton linens, apron-front details, and lived-in comfortable elegance",
  "midcentury scandi": "Mid-Century Scandinavian fusion featuring iconic tapered-leg furniture in warm walnut or teak wood, clean-lined upholstery in muted earth tones, functional minimalist aesthetic, organic curved forms, quality craftsmanship details, natural light-filled spaces with large windows, mix of matte and natural wood finishes, and timeless sophisticated simplicity",
  "contemporary luxe": "Contemporary Luxe interior showcasing sleek architectural forms, high-end materials including polished marble and smoked glass, plush velvet upholstery in jewel tones or sophisticated neutrals, metallic accents in brushed brass or aged bronze, statement lighting fixtures, art-gallery aesthetic with curated pieces, layered luxurious textures, and refined elegant atmosphere",
  "warm transitional": "Warm Transitional style blending traditional comfort with modern sophistication, tailored furniture with subtle classic details, rich wood tones in walnut or espresso finishes, soft neutral color palette with warm undertones, elegant fabrics including velvet and chenille, balanced proportions, timeless appeal, layered lighting, and gracious livable luxury",
  "artful eclectic": "Artful Eclectic design with curated mix of eras and styles, bold pattern mixing, rich jewel-tone color palette balanced by sophisticated neutrals, global-inspired textiles and artifacts, vintage and contemporary pieces in harmony, gallery wall arrangements, statement furniture, layered textures, and collected-over-time personality"
};

const roomTypeDescriptions: Record<string, string> = {
  "living room": "spacious living room with thoughtful furniture arrangement",
  "bedroom": "serene bedroom retreat with layered comfort",
  "dining room": "elegant dining room designed for gathering",
  "home office": "productive home office with ergonomic design",
  "nursery": "nurturing nursery with safe and cozy elements",
  "entryway": "welcoming entryway that sets the home's tone"
};

// Color palette descriptions for rich visual prompts
const colorPaletteDescriptions: Record<string, string> = {
  "light neutrals": "soft color palette dominated by warm whites, ivory, light beige, pale greige, and cream tones creating an airy and serene atmosphere with subtle depth through layered neutrals",
  "warm & cozy": "warm inviting color scheme featuring rich caramels, warm taupes, soft terracotta, honey tones, and creamy whites with wood undertones creating comfort and intimacy",
  "dark & moody": "sophisticated dark palette with deep charcoal, espresso brown, midnight navy, forest green, or black accents balanced by warm metallic touches and strategic lighting for dramatic elegance",
  "colourful accent": "neutral foundation with strategic pops of color through jewel tones, saturated hues, or bold accent colors in pillows, art, and accessories creating visual interest while maintaining balance"
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
 * Calculate visual similarity score between product and vibe preferences
 * Returns a score from 0-1 based on how well product matches vibe colors, materials, and textures
 */
function calculateVisualSimilarityScore(product: Product, quiz: QuizResponse): number {
  // If no vibe preferences, return neutral score
  if (!quiz.vibeColorPalette || quiz.vibeColorPalette.length === 0) {
    return 0.5; // Neutral - no preference data
  }
  
  let score = 0;
  let totalWeight = 0;
  
  // 1. Color Match (40% weight)
  const colorWeight = 0.4;
  if (quiz.vibeColorPalette && quiz.vibeColorPalette.length > 0) {
    const productColors = [
      ...(product.colors || []),
      ...(product.visualDescription?.toLowerCase() || '').split(/[,\s]+/)
    ].map(c => c.toLowerCase().trim()).filter(Boolean);
    
    const vibeColors = quiz.vibeColorPalette.map(c => c.toLowerCase().trim());
    
    let colorMatches = 0;
    vibeColors.forEach(vibeColor => {
      productColors.forEach(productColor => {
        // Check for color name matches or partial matches
        if (productColor.includes(vibeColor) || vibeColor.includes(productColor)) {
          colorMatches++;
        }
      });
    });
    
    const colorScore = Math.min(colorMatches / Math.max(vibeColors.length, 1), 1);
    score += colorScore * colorWeight;
    totalWeight += colorWeight;
  }
  
  // 2. Material Match (35% weight)
  const materialWeight = 0.35;
  if (quiz.vibeMaterials && quiz.vibeMaterials.length > 0) {
    const productMaterials = (product.visualDescription?.toLowerCase() || '').split(/[,\s]+/);
    const vibeMaterials = quiz.vibeMaterials.map(m => m.toLowerCase().trim());
    
    let materialMatches = 0;
    vibeMaterials.forEach(vibeMat => {
      productMaterials.forEach(productMat => {
        if (productMat.includes(vibeMat) || vibeMat.includes(productMat)) {
          materialMatches++;
        }
      });
    });
    
    const materialScore = Math.min(materialMatches / Math.max(vibeMaterials.length, 1), 1);
    score += materialScore * materialWeight;
    totalWeight += materialWeight;
  }
  
  // 3. Texture Match (25% weight)
  const textureWeight = 0.25;
  if (quiz.vibeTextures && quiz.vibeTextures.length > 0) {
    const productTextures = (product.visualDescription?.toLowerCase() || '').split(/[,\s]+/);
    const vibeTextures = quiz.vibeTextures.map(t => t.toLowerCase().trim());
    
    let textureMatches = 0;
    vibeTextures.forEach(vibeTex => {
      productTextures.forEach(productTex => {
        if (productTex.includes(vibeTex) || vibeTex.includes(productTex)) {
          textureMatches++;
        }
      });
    });
    
    const textureScore = Math.min(textureMatches / Math.max(vibeTextures.length, 1), 1);
    score += textureScore * textureWeight;
    totalWeight += textureWeight;
  }
  
  // Normalize score to 0-1 range
  return totalWeight > 0 ? score / totalWeight : 0.5;
}

/**
 * Validate that a product has at least one valid, accessible image
 * Filters out broken/invalid image URLs
 * @param product - Product to validate
 * @returns true if product has at least one valid image
 */
function hasValidImages(product: Product): boolean {
  // Must have images array
  if (!product.images || product.images.length === 0) {
    return false;
  }
  
  // Check if at least one image is valid
  const validImages = product.images.filter(imageUrl => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return false;
    }
    
    // Trim whitespace
    const trimmed = imageUrl.trim();
    
    // Check for empty strings
    if (trimmed.length === 0) {
      return false;
    }
    
    // Check for placeholder/broken image indicators
    const brokenIndicators = [
      'placeholder',
      'no-image',
      'missing',
      'broken',
      'undefined',
      'null',
      '[object',
    ];
    
    const lowerUrl = trimmed.toLowerCase();
    if (brokenIndicators.some(indicator => lowerUrl.includes(indicator))) {
      return false;
    }
    
    // Basic URL format validation
    const isExternalUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const isObjectStorage = trimmed.startsWith('/public-objects/') || trimmed.startsWith('/private-objects/');
    const isS3Path = trimmed.includes('s3.amazonaws.com') || trimmed.includes('curalina');
    
    // Accept only external URLs (https) or object storage paths
    // Reject generic relative paths like "/images/" which are likely broken
    const isValidUrl = isExternalUrl || isObjectStorage || isS3Path;
    
    if (!isValidUrl) {
      return false;
    }
    
    // Check for common image extensions (optional but helpful)
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(trimmed);
    
    // Allow URLs without extensions (some CDNs don't use them)
    // But if it has an extension, it should be an image extension
    if (trimmed.includes('.') && !hasImageExtension) {
      // Has a file extension but not an image extension
      return false;
    }
    
    return true;
  });
  
  return validImages.length > 0;
}

/**
 * Check if a product has AI-generated visual descriptions from product images
 * @param product - Product to validate
 * @returns true if product has at least one AI-generated visual description
 */
function hasAIVisualDescription(product: Product): boolean {
  // Check if any AI-generated visual description field is populated
  // Priority order: Front View > Gemini Vision > OpenAI Vision
  // Legacy descriptions don't count - must be AI-generated from images
  const hasFrontView = typeof product.visualDescriptionFrontView === 'string' && 
                       product.visualDescriptionFrontView.trim().length > 0;
  const hasGemini = typeof product.visualDescriptionGemini === 'string' && 
                    product.visualDescriptionGemini.trim().length > 0;
  const hasOpenAI = typeof product.visualDescriptionOpenAI === 'string' && 
                    product.visualDescriptionOpenAI.trim().length > 0;
  
  return hasFrontView || hasGemini || hasOpenAI;
}

/**
 * Check if a product can be used for AI rendering
 * A product is usable if it has valid, working images
 * Visual descriptions are preferred but not required (allows essential furniture)
 * @param product - Product to validate
 * @returns true if product can be used for AI rendering
 */
function canUseForAIRendering(product: Product): boolean {
  // REQUIREMENTS:
  // 1. Product MUST have valid images (for compositing onto renders)
  // 2. Visual descriptions are PREFERRED but not required
  // This allows essential furniture (tables, chairs) even without AI analysis
  return hasValidImages(product);
}

/**
 * Filter products based on quiz preferences
 * Matches room type, style, and features (budget is NOT enforced for quality renders)
 */
export function filterProductsByQuiz(products: Product[], quiz: QuizResponse): Product[] {
  // Log initial filtering stats
  const inStockCount = products.filter(p => p.availability === 'in_stock').length;
  const withValidImages = products.filter(p => p.availability === 'in_stock' && hasValidImages(p)).length;
  const withAIDescriptions = products.filter(p => p.availability === 'in_stock' && hasAIVisualDescription(p)).length;
  console.log(`📊 Product Pool: ${products.length} total → ${inStockCount} in stock → ${withValidImages} with valid images`);
  console.log(`   📸 ${withAIDescriptions} have AI visual descriptions (preferred but not required)`);
  console.log(`⚠️ Budget NOT enforced during filtering - focusing on render quality`);
  
  // First pass: strict filtering
  const strictlyFiltered = products.filter(product => {
    // Filter by availability
    if (product.availability !== 'in_stock') return false;
    
    // Filter by AI-ready products (REQUIRED - must have images AND visual descriptions)
    if (!canUseForAIRendering(product)) return false;
    
    // Filter by room type (relaxed for essential furniture)
    if (product.roomType && product.roomType.length > 0) {
      const roomMatch = product.roomType.some(rt => 
        rt.toLowerCase().includes(quiz.roomType.toLowerCase()) ||
        quiz.roomType.toLowerCase().includes(rt.toLowerCase())
      );
      if (!roomMatch) return false;
    } else {
      // If no room type assigned, allow essential furniture based on name matching
      const productName = product.name.toLowerCase();
      const roomType = quiz.roomType.toLowerCase();
      
      // Special cases for furniture without room assignments
      if (roomType === 'dining room' || roomType === 'dining') {
        // Allow dining tables and chairs even without room type
        const isDiningFurniture = productName.includes('dining') || 
                                  (productName.includes('table') && !productName.includes('console') && !productName.includes('accent')) ||
                                  (productName.includes('chair') && !productName.includes('accent') && !productName.includes('lounge'));
        if (!isDiningFurniture) return false;
      } else if (roomType === 'living room' || roomType === 'living') {
        // Allow living room essentials
        const isLivingFurniture = productName.includes('sofa') || 
                                   productName.includes('couch') || 
                                   productName.includes('coffee table') || 
                                   productName.includes('ottoman') ||
                                   productName.includes('accent');
        if (!isLivingFurniture) return false;
      } else if (roomType === 'bedroom') {
        // Allow bedroom essentials
        const isBedroomFurniture = productName.includes('bed') || 
                                    productName.includes('nightstand') || 
                                    productName.includes('dresser');
        if (!isBedroomFurniture) return false;
      }
      // For other room types, exclude products without room assignment
      else {
        return false;
      }
    }
    
    // Filter by design style (flexible matching)
    if (product.designStyle && product.designStyle.length > 0) {
      const styleMatch = product.designStyle.some(ds =>
        stylesMatch(quiz.style, ds)
      );
      if (!styleMatch) return false;
    }
    
    // Budget NOT enforced - focusing on quality renders
    
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
  
  // If we have enough products and vibe preferences, sort by visual similarity
  if (strictlyFiltered.length >= 5 && quiz.vibeColorPalette && quiz.vibeColorPalette.length > 0) {
    console.log(`✅ Strict filter found ${strictlyFiltered.length} products. Sorting by visual similarity to vibe images...`);
    const withScores = strictlyFiltered.map(product => ({
      product,
      score: calculateVisualSimilarityScore(product, quiz)
    }));
    
    withScores.sort((a, b) => b.score - a.score);
    
    // Log top matches
    const topMatches = withScores.slice(0, 5);
    console.log(`Top visual matches:`);
    topMatches.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.product.name} (score: ${item.score.toFixed(2)})`);
    });
    
    return withScores.map(item => item.product);
  }
  
  // If strict filtering successful but no vibe preferences, return as-is
  if (strictlyFiltered.length >= 5) {
    return strictlyFiltered;
  }
  
  // Fallback 1: if strict filtering yields too few products, relax key features requirement
  if (strictlyFiltered.length < 5) {
    console.warn(`Strict filter yielded only ${strictlyFiltered.length} products, relaxing key features requirement`);
    
    const relaxedFeatures = products.filter(product => {
      if (product.availability !== 'in_stock') return false;
      if (!canUseForAIRendering(product)) return false;
      
      // Room type still required
      if (product.roomType && product.roomType.length > 0) {
        const roomMatch = product.roomType.some(rt => 
          rt.toLowerCase().includes(quiz.roomType.toLowerCase()) ||
          quiz.roomType.toLowerCase().includes(rt.toLowerCase())
        );
        if (!roomMatch) return false;
      }
      
      // Style still required
      if (product.designStyle && product.designStyle.length > 0) {
        const styleMatch = product.designStyle.some(ds =>
          stylesMatch(quiz.style, ds)
        );
        if (!styleMatch) return false;
      }
      
      // Budget NOT enforced
      
      return true;
    });
    
    if (relaxedFeatures.length >= 5) return relaxedFeatures;
  }
  
  // Fallback 2: if still < 5, relax style requirement (keep room type)
  if (strictlyFiltered.length < 5) {
    console.warn(`Still only ${strictlyFiltered.length} products, relaxing style requirement`);
    
    const relaxedStyle = products.filter(product => {
      if (product.availability !== 'in_stock') return false;
      if (!canUseForAIRendering(product)) return false;
      
      // Room type still required
      if (product.roomType && product.roomType.length > 0) {
        const roomMatch = product.roomType.some(rt => 
          rt.toLowerCase().includes(quiz.roomType.toLowerCase()) ||
          quiz.roomType.toLowerCase().includes(rt.toLowerCase())
        );
        if (!roomMatch) return false;
      }
      
      // Budget NOT enforced
      
      return true;
    });
    
    if (relaxedStyle.length >= 5) return relaxedStyle;
  }
  
  // Fallback 3: if still < 5, only require style match (relax room type)
  if (strictlyFiltered.length < 5) {
    console.warn(`Still only ${strictlyFiltered.length} products, trying style-only match`);
    
    const styleOnly = products.filter(product => {
      if (product.availability !== 'in_stock') return false;
      if (!canUseForAIRendering(product)) return false;
      
      // Style required
      if (product.designStyle && product.designStyle.length > 0) {
        const styleMatch = product.designStyle.some(ds =>
          stylesMatch(quiz.style, ds)
        );
        if (!styleMatch) return false;
      }
      
      // Budget NOT enforced
      
      return true;
    });
    
    if (styleOnly.length >= 5) return styleOnly;
  }
  
  // Fallback 4: if still < 5, just return any in-stock products with valid images
  console.warn(`Final fallback: returning any in-stock products with valid images`);
  const finalFiltered = products.filter(product => {
    if (product.availability !== 'in_stock') return false;
    if (!canUseForAIRendering(product)) return false;
    
    // Budget NOT enforced
    
    return true;
  });
  
  // If we have vibe preferences, sort by visual similarity
  if (quiz.vibeColorPalette && quiz.vibeColorPalette.length > 0) {
    console.log(`🎨 Sorting products by visual similarity to vibe images...`);
    const withScores = finalFiltered.map(product => ({
      product,
      score: calculateVisualSimilarityScore(product, quiz)
    }));
    
    withScores.sort((a, b) => b.score - a.score);
    
    // Log top matches
    const topMatches = withScores.slice(0, 5);
    if (topMatches.length > 0) {
      console.log(`Top visual matches:`);
      topMatches.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.product.name} (score: ${item.score.toFixed(2)})`);
      });
    }
    
    return withScores.map(item => item.product).slice(0, 20);
  }
  
  return finalFiltered.slice(0, 20);
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
 * Get essential furniture categories for a room type
 * Ensures product selection includes major furniture pieces
 */
function getRoomEssentialCategories(roomType: string): Array<{ category: string; description: string; priority: 'high' | 'medium' }> {
  const room = roomType.toLowerCase();
  
  if (room.includes('living')) {
    return [
      { category: 'Seating', description: 'Sofa, sectional, or 2-3 chairs for primary seating', priority: 'high' },
      { category: 'Tables', description: 'Coffee table or side tables', priority: 'high' },
      { category: 'Lighting', description: 'Floor lamps or table lamps', priority: 'medium' },
      { category: 'Storage/Decor', description: 'Cabinets, ottomans, or decorative items', priority: 'medium' }
    ];
  } else if (room.includes('dining')) {
    return [
      { category: 'Dining Table', description: 'Main dining table', priority: 'high' },
      { category: 'Seating', description: 'Dining chairs (4-6)', priority: 'high' },
      { category: 'Storage', description: 'Buffet, sideboard, or cabinet', priority: 'medium' },
      { category: 'Lighting', description: 'Chandelier, pendant, or table lamps', priority: 'medium' }
    ];
  } else if (room.includes('bedroom')) {
    return [
      { category: 'Bed', description: 'Bed frame or platform bed', priority: 'high' },
      { category: 'Storage', description: 'Dresser, nightstands, or wardrobe', priority: 'high' },
      { category: 'Seating', description: 'Bench, chair, or reading nook', priority: 'medium' },
      { category: 'Lighting', description: 'Table lamps or floor lamps', priority: 'medium' }
    ];
  } else if (room.includes('office') || room.includes('study')) {
    return [
      { category: 'Desk', description: 'Work desk or writing table', priority: 'high' },
      { category: 'Seating', description: 'Office chair or task chair', priority: 'high' },
      { category: 'Storage', description: 'Bookcase, filing cabinet, or shelving', priority: 'medium' },
      { category: 'Lighting', description: 'Desk lamp or floor lamp', priority: 'medium' }
    ];
  } else {
    // Default for other room types
    return [
      { category: 'Primary Furniture', description: 'Major functional pieces for this space', priority: 'high' },
      { category: 'Supporting Items', description: 'Complementary furniture and decor', priority: 'medium' }
    ];
  }
}

/**
 * Use Gemini AI to select the best products for the room
 * Returns a curated list of products with placement suggestions
 */
export async function selectProductsWithAI(
  products: Product[],
  quiz: QuizResponse
): Promise<Array<{ sku: string; name: string; placement: string; reasoning: string; visualDescription?: string; visualDescriptionSource?: string }>> {
  try {
    // Prepare product data for AI with visual descriptions and feature matching scores
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
      
      // Get the best available visual description for accurate rendering
      const visualDescInfo = getBestVisualDescription(p);
      
      return {
        sku: p.sku,
        name: p.name,
        description: p.description || "",
        visualDescription: visualDescInfo.description || "No visual description available - use product name and materials to approximate appearance",
        visualDescriptionSource: visualDescInfo.source,
        price: p.price,
        features: p.keyFeatures || [],
        materials: p.materials || [],
        colors: p.colors || [],
        featureMatchScore: Math.round(featureMatchScore * 100), // Percentage
      };
    });

    const budgetMax = parseBudgetRange(quiz.budgetRange);
    const budgetMaxFormatted = budgetMax ? `$${budgetMax.toLocaleString()}` : quiz.budgetRange;

    // Define essential furniture categories by room type
    const essentialCategories = getRoomEssentialCategories(quiz.roomType);
    
    const prompt = `You are an expert interior designer selecting furniture for a ${quiz.roomType}.

Room Requirements:
- Style: ${quiz.style}
- Key Features REQUIRED: ${quiz.keyFeatures?.join(", ") || "None specified"}
- Budget: ${quiz.budgetRange}
- User Preferences: ${quiz.preferences?.join(", ") || "None"}

Available Products (each includes visualDescription showing EXACT appearance):
${JSON.stringify(productList, null, 2)}

🎯 CRITICAL VISUAL MATCHING INSTRUCTIONS:
Each product includes a "visualDescription" field that describes its EXACT appearance from AI image analysis.
- Products with detailed visual descriptions MUST be rendered exactly as described
- The visualDescription is the authoritative source for product appearance
- Pay special attention to colors, materials, shapes, and distinctive features mentioned
- If visualDescription says "No visual description available", use the name and materials to approximate

CRITICAL BUDGET CONSTRAINT:
⚠️ The TOTAL COMBINED COST of all selected products MUST NOT EXCEED ${budgetMaxFormatted}
- Calculate the sum of all product prices as you select
- If approaching the budget limit, choose fewer or less expensive items
- Better to stay well under budget than to exceed it

ESSENTIAL FURNITURE CATEGORIES FOR ${quiz.roomType.toUpperCase()}:
${essentialCategories.map(cat => `- ${cat.category}: ${cat.description} (${cat.priority} priority)`).join('\n')}

IMPORTANT SELECTION CRITERIA:
1. FIRST: Select essential furniture from each high-priority category above (sofas, chairs, tables as applicable)
2. SECOND: Add products with high featureMatchScore (those matching the required key features)
3. Select 5-8 products total that work best together for this room
4. Ensure the selection creates a cohesive, COMPLETE, functional design
5. **ENSURE TOTAL COST ≤ ${budgetMaxFormatted}** (check the sum of all prices!)

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
      model: "gemini-2.5-flash",
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
    
    // Enrich selected products with visual descriptions
    const enrichedProducts = selectedProducts.map((sp: any) => {
      const fullProduct = products.find(p => p.sku === sp.sku);
      if (fullProduct) {
        const visualDescInfo = getBestVisualDescription(fullProduct);
        return {
          ...sp,
          visualDescription: visualDescInfo.description,
          visualDescriptionSource: visualDescInfo.source
        };
      }
      return sp;
    });
    
    // Apply room composition rules to ensure proper product mix and no duplicates
    console.log(`🏠 Applying room composition rules for ${quiz.roomType}...`);
    const compositionResult = await selectProductsWithComposition(
      quiz.roomType,
      products, // Pass all available products for better selection
      quiz,
      15 // Max products
    );
    
    // Log composition warnings if any
    if (compositionResult.warnings.length > 0) {
      console.warn('⚠️ Room composition warnings:');
      compositionResult.warnings.forEach(w => console.warn(`  - ${w}`));
    }
    
    if (compositionResult.missingEssentials.length > 0) {
      console.error('❌ Missing essential items:');
      compositionResult.missingEssentials.forEach(e => console.error(`  - ${e}`));
    }
    
    // Map composition products back to our format with visual descriptions
    const compositionProducts = compositionResult.selectedProducts.map(p => {
      const visualDescInfo = getBestVisualDescription(p);
      const aiSelected = enrichedProducts.find((ep: any) => ep.sku === p.sku);
      
      return {
        sku: p.sku,
        name: p.name,
        placement: aiSelected?.placement || "strategically placed in the room",
        reasoning: aiSelected?.reasoning || `Selected as essential item for ${quiz.roomType}`,
        visualDescription: visualDescInfo.description,
        visualDescriptionSource: visualDescInfo.source
      };
    });
    
    // Log composition breakdown
    console.log(`✅ Room composition complete:`);
    for (const [category, products] of Object.entries(compositionResult.composition)) {
      console.log(`  ${category}: ${products.length} items`);
    }
    
    // Validate and adjust for budget constraint
    const budgetValidatedProducts = validateAndAdjustForBudget(
      compositionProducts,
      products,
      budgetMax,
      quiz
    );
    
    return budgetValidatedProducts;
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
 * Validate that selected products don't exceed budget and adjust if necessary
 * @param selectedProducts - Products selected by AI
 * @param allProducts - Full product catalog for swapping
 * @param budgetMax - Maximum budget in dollars (null = no limit)
 * @param quiz - Quiz data for context
 * @returns Adjusted product selection that stays within budget
 */
function validateAndAdjustForBudget(
  selectedProducts: Array<{ sku: string; name: string; placement: string; reasoning: string; visualDescription?: string; visualDescriptionSource?: string }>,
  allProducts: Product[],
  budgetMax: number | null,
  quiz: QuizResponse
): Array<{ sku: string; name: string; placement: string; reasoning: string; visualDescription?: string; visualDescriptionSource?: string }> {
  // If no budget limit, return as-is
  if (!budgetMax) {
    console.log("💰 No budget limit set, proceeding with all selected products");
    return selectedProducts;
  }
  
  // Calculate total cost
  const productsWithPrices = selectedProducts.map(sp => {
    const product = allProducts.find(p => p.sku === sp.sku);
    const price = product?.price ? parseFloat(product.price.toString()) : 0;
    return { ...sp, price };
  });
  
  const totalCost = productsWithPrices.reduce((sum, p) => sum + p.price, 0);
  const budgetMaxFormatted = `$${budgetMax.toLocaleString()}`;
  const totalCostFormatted = `$${totalCost.toLocaleString()}`;
  
  console.log(`💰 Budget Analysis: Total cost = ${totalCostFormatted} | Budget limit = ${budgetMaxFormatted}`);
  
  // If within budget, return as-is
  if (totalCost <= budgetMax) {
    const percentUsed = ((totalCost / budgetMax) * 100).toFixed(1);
    console.log(`✅ Within budget! Using ${percentUsed}% of available budget (${totalCostFormatted} / ${budgetMaxFormatted})`);
    return selectedProducts;
  }
  
  // Budget exceeded - need to adjust
  console.warn(`⚠️ Budget exceeded! ${totalCostFormatted} > ${budgetMaxFormatted} (${((totalCost / budgetMax) * 100).toFixed(1)}% over)`);
  console.log("🔧 Adjusting product selection to fit budget...");
  
  // Strategy: Remove products from most expensive to least expensive until under budget
  // Sort by price (descending) while keeping track of original products
  const sorted = [...productsWithPrices].sort((a, b) => b.price - a.price);
  const adjusted: typeof selectedProducts = [];
  let runningTotal = 0;
  
  // Add products one by one until we hit budget limit
  for (const product of sorted) {
    if (runningTotal + product.price <= budgetMax) {
      adjusted.push({
        sku: product.sku,
        name: product.name,
        placement: product.placement,
        reasoning: product.reasoning
      });
      runningTotal += product.price;
    } else {
      console.log(`   ❌ Skipping ${product.name} ($${product.price.toLocaleString()}) - would exceed budget`);
    }
  }
  
  const adjustedTotal = `$${runningTotal.toLocaleString()}`;
  const percentUsed = ((runningTotal / budgetMax) * 100).toFixed(1);
  
  console.log(`✅ Adjusted to ${adjusted.length} products (from ${selectedProducts.length})`);
  console.log(`💰 New total: ${adjustedTotal} (${percentUsed}% of budget)`);
  
  // Log removed products for transparency
  const removedCount = selectedProducts.length - adjusted.length;
  if (removedCount > 0) {
    console.log(`📋 Removed ${removedCount} products to stay within budget`);
  }
  
  return adjusted;
}

/**
 * Get the best available visual description for a product
 * Priority: Actual Front View → Synthesized Front View → Gemini → OpenAI → Complete Description → Legacy
 */
function getBestVisualDescription(product: any): { description: string; source: string } {
  // First priority: Actual front view from direct image analysis
  if (product.visualDescriptionFrontView && product.visualDescriptionFrontView.trim().length > 0) {
    return { description: product.visualDescriptionFrontView, source: 'Front View' };
  }
  
  // Second priority: Synthesized front view from multi-angle analysis
  if (product.synthesizedFrontView && product.synthesizedFrontView.trim().length > 0) {
    return { description: product.synthesizedFrontView, source: 'Synthesized Front View' };
  }
  
  // Third priority: Gemini Vision analysis
  if (product.visualDescriptionGemini && product.visualDescriptionGemini.trim().length > 0) {
    return { description: product.visualDescriptionGemini, source: 'Gemini Vision' };
  }
  
  // Fourth priority: OpenAI Vision analysis
  if (product.visualDescriptionOpenAI && product.visualDescriptionOpenAI.trim().length > 0) {
    return { description: product.visualDescriptionOpenAI, source: 'OpenAI Vision' };
  }
  
  // Fifth priority: Complete product description from all angles
  if (product.completeProductDescription && product.completeProductDescription.trim().length > 0) {
    // Extract just the front view or overall section if available
    const lines = product.completeProductDescription.split('\n');
    const frontViewIdx = lines.findIndex((l: string) => l.includes('FRONT VIEW:'));
    if (frontViewIdx >= 0 && frontViewIdx < lines.length - 1) {
      return { description: lines[frontViewIdx + 1], source: 'Multi-Angle Analysis' };
    }
    // Otherwise use the first meaningful paragraph
    const firstParagraph = lines.find((l: string) => l.length > 50);
    if (firstParagraph) {
      return { description: firstParagraph, source: 'Multi-Angle Analysis' };
    }
  }
  
  // Sixth priority: Legacy visual description
  if (product.visualDescription && product.visualDescription.trim().length > 0) {
    return { description: product.visualDescription, source: 'Legacy' };
  }
  
  return { description: '', source: 'None' };
}

/**
 * Attach placement metadata (functional category, priority) from ledger or detection
 */
export function attachPlacementMetadata(
  selectedProducts: Array<{ sku: string; name: string; placement: string; reasoning: string; [key: string]: any }>,
  ledgerEntry: { compositionOrder?: string[]; selectionRationale?: any } | null,
  roomType: string,
  allProducts: any[]
): Array<{ sku: string; name: string; placement: string; reasoning: string; functionalCategory?: string; priority?: number; [key: string]: any }> {
  
  // Extract ledger metadata if available
  const ledgerMetadata: Record<string, { category: string; priority: number }> = {};
  
  if (ledgerEntry?.selectionRationale) {
    const rationale = ledgerEntry.selectionRationale;
    let currentPriority = 1;
    
    // Process essentials
    if (rationale.essentials) {
      for (const [category, data] of Object.entries(rationale.essentials as Record<string, any>)) {
        if (data.selectedProducts && Array.isArray(data.selectedProducts)) {
          for (const sku of data.selectedProducts) {
            ledgerMetadata[sku] = { category, priority: currentPriority };
            currentPriority++;
          }
        }
      }
    }
    
    // Process complementary
    if (rationale.complementary) {
      for (const [category, data] of Object.entries(rationale.complementary as Record<string, any>)) {
        if (data.selectedProducts && Array.isArray(data.selectedProducts)) {
          for (const sku of data.selectedProducts) {
            ledgerMetadata[sku] = { category, priority: currentPriority };
            currentPriority++;
          }
        }
      }
    }
  }
  
  // Enrich products with metadata
  return selectedProducts.map((product, index) => {
    // Try ledger first
    if (ledgerMetadata[product.sku]) {
      return {
        ...product,
        functionalCategory: ledgerMetadata[product.sku].category,
        priority: ledgerMetadata[product.sku].priority
      };
    }
    
    // Fallback: detect category
    const fullProduct = allProducts.find((p: any) => p.sku === product.sku);
    if (fullProduct) {
      const categories = detectFunctionalCategory(fullProduct);
      const category = categories[0] || 'decor';
      
      // Determine priority based on category
      const template = getRoomTemplate(roomType);
      let priority = 7; // Default decor priority
      
      if (template) {
        // Check essentials
        if ((template.essentials as any)[category]) {
          priority = (template.essentials as any)[category].priority;
        } else if (template.complementary && (template.complementary as any)[category]) {
          priority = (template.complementary as any)[category].priority;
        }
      }
      
      console.log(`   ⚠️ No ledger data for ${product.sku}, detected as ${category} with priority ${priority}`);
      
      return {
        ...product,
        functionalCategory: category,
        priority
      };
    }
    
    // Last resort: use composition order from ledger if available
    if (ledgerEntry?.compositionOrder) {
      const orderIndex = ledgerEntry.compositionOrder.indexOf(product.sku);
      if (orderIndex >= 0) {
        return {
          ...product,
          functionalCategory: 'decor',
          priority: orderIndex + 1
        };
      }
    }
    
    // Final fallback: use array position
    return {
      ...product,
      functionalCategory: 'decor',
      priority: index + 1
    };
  });
}

/**
 * Generate structured placement matrix with explicit spatial instructions
 */
function generatePlacementMatrix(
  selectedProducts: Array<{ 
    sku: string; 
    name: string; 
    placement: string; 
    reasoning: string;
    functionalCategory?: string;
    priority?: number;
  }>,
  roomType: string,
  roomAnalysis?: Awaited<ReturnType<typeof analyzeRoomImage>>,
  floorPlanAnalysis?: Awaited<ReturnType<typeof analyzeFloorPlan>>
): string {
  const matrix: string[] = [];
  
  matrix.push(`\n\n═══════════════════════════════════════════════════════════════════════════`);
  matrix.push(`📍 STRUCTURED PLACEMENT MATRIX - FOLLOW PRECISELY`);
  matrix.push(`═══════════════════════════════════════════════════════════════════════════`);
  matrix.push(``);
  matrix.push(`This matrix provides EXPLICIT spatial instructions for each product.`);
  matrix.push(`You MUST follow these placement rules to create a functional, well-composed room.`);
  matrix.push(``);
  
  // Extract spatial constraints from room/floor plan analysis
  const hasWindows = Boolean(floorPlanAnalysis?.windowLocations && floorPlanAnalysis.windowLocations.length > 0);
  const hasDoors = Boolean(floorPlanAnalysis?.doorLocations && floorPlanAnalysis.doorLocations.length > 0);
  const roomDimensions = floorPlanAnalysis?.roomDimensions || "standard room dimensions";
  
  // Add room spatial context
  matrix.push(`🏠 ROOM SPATIAL CONTEXT:`);
  matrix.push(`   Room Type: ${roomType}`);
  matrix.push(`   Dimensions: ${roomDimensions}`);
  if (hasWindows && floorPlanAnalysis) {
    matrix.push(`   Windows: ${floorPlanAnalysis.windowLocations.length} window(s) - ${floorPlanAnalysis.windowLocations.join(", ")}`);
  }
  if (hasDoors && floorPlanAnalysis) {
    matrix.push(`   Doors: ${floorPlanAnalysis.doorLocations.length} door(s)/opening(s) - ${floorPlanAnalysis.doorLocations.join(", ")}`);
  }
  matrix.push(``);
  
  // Group products by functional category and priority
  const essentials = selectedProducts.filter(p => p.priority && p.priority <= 2);
  const complementary = selectedProducts.filter(p => p.priority && p.priority > 2);
  
  // Generate placement instructions for essentials first
  if (essentials.length > 0) {
    matrix.push(`📌 ESSENTIAL ITEMS (Must-Place Priority):`);
    matrix.push(`These items form the foundation of the room layout.`);
    matrix.push(``);
    
    essentials.forEach((product, idx) => {
      matrix.push(`${idx + 1}. ${product.name} [${product.functionalCategory?.toUpperCase() || 'ESSENTIAL'}]`);
      matrix.push(`   ├─ Anchor Zone: ${getAnchorZone(product, roomType, hasWindows, hasDoors)}`);
      matrix.push(`   ├─ Positioning: ${getPositioningRules(product, roomType)}`);
      matrix.push(`   ├─ Clearance: ${getClearanceRules(product)}`);
      matrix.push(`   ├─ Adjacency: ${getAdjacencyRules(product, selectedProducts, roomType)}`);
      matrix.push(`   └─ Integration: ${product.reasoning}`);
      matrix.push(``);
    });
  }
  
  // Generate placement instructions for complementary items
  if (complementary.length > 0) {
    matrix.push(`🎨 COMPLEMENTARY ITEMS (Fill/Support Priority):`);
    matrix.push(`These items support and enhance the essential furniture.`);
    matrix.push(``);
    
    complementary.forEach((product, idx) => {
      matrix.push(`${essentials.length + idx + 1}. ${product.name} [${product.functionalCategory?.toUpperCase() || 'COMPLEMENTARY'}]`);
      matrix.push(`   ├─ Relative To: ${getRelativePosition(product, essentials, roomType)}`);
      matrix.push(`   ├─ Positioning: ${getPositioningRules(product, roomType)}`);
      matrix.push(`   ├─ Clearance: ${getClearanceRules(product)}`);
      matrix.push(`   └─ Integration: ${product.reasoning}`);
      matrix.push(``);
    });
  }
  
  // Add composition rules
  matrix.push(`⚖️ COMPOSITION RULES:`);
  matrix.push(`   • Create clear traffic paths - maintain 36-48" walkways`);
  matrix.push(`   • Group furniture to create functional zones (conversation, task, circulation)`);
  matrix.push(`   • Balance visual weight across the room - avoid clustering all large items on one side`);
  matrix.push(`   • Respect architectural features - don't block windows, doors, or built-ins`);
  matrix.push(`   • Maintain appropriate scale relationships between items`);
  matrix.push(`   • Every product in the matrix MUST appear exactly once in the final render`);
  matrix.push(``);
  matrix.push(`═══════════════════════════════════════════════════════════════════════════`);
  
  return matrix.join('\n');
}

/**
 * Determine anchor zone based on functional category and room layout
 */
function getAnchorZone(
  product: { name: string; functionalCategory?: string },
  roomType: string,
  hasWindows: boolean,
  hasDoors: boolean
): string {
  const category = product.functionalCategory?.toLowerCase() || '';
  const name = product.name.toLowerCase();
  
  // Sofas and primary seating
  if (category.includes('seating') && (name.includes('sofa') || name.includes('sectional'))) {
    if (hasWindows) {
      return "Position facing windows to maximize natural light view, or along main wall as focal point";
    }
    return "Center along longest wall as focal point, facing room's primary view";
  }
  
  // Coffee tables
  if (category.includes('coffee') || name.includes('coffee table')) {
    return "Center in seating zone, aligned with primary sofa";
  }
  
  // Beds
  if (category.includes('bed') || name.includes('bed')) {
    if (hasWindows) {
      return "Headboard against solid wall opposite or perpendicular to windows";
    }
    return "Headboard centered on longest wall, facing room entry if visible";
  }
  
  // Dining tables
  if (category.includes('dining') || name.includes('dining table')) {
    return "Center of room or centered under ceiling feature/lighting, with adequate clearance on all sides";
  }
  
  // Desks
  if (category.includes('desk') || name.includes('desk')) {
    if (hasWindows) {
      return "Positioned to face or be perpendicular to window for natural task lighting";
    }
    return "Against wall or floating in room, ensuring adequate task lighting";
  }
  
  return "Position based on room flow and functional relationships to other furniture";
}

/**
 * Get specific positioning rules for product type
 */
function getPositioningRules(
  product: { name: string; functionalCategory?: string },
  roomType: string
): string {
  const category = product.functionalCategory?.toLowerCase() || '';
  const name = product.name.toLowerCase();
  
  if (category.includes('seating') && (name.includes('sofa') || name.includes('sectional'))) {
    return "Parallel or perpendicular to walls, NOT floating unless room size allows. Keep 12-18\" from wall.";
  }
  
  if (category.includes('coffee')) {
    return "18\" from sofa front edge, centered along sofa length";
  }
  
  if (category.includes('accent_seating') || name.includes('chair')) {
    return "Angled slightly toward conversation area or parallel to walls. Create groupings, not isolated placement.";
  }
  
  if (category.includes('side') || category.includes('end')) {
    return "Immediately adjacent to seating within arm's reach (6-12\" gap)";
  }
  
  if (category.includes('lighting')) {
    return "In corners, beside seating, or on side tables - distribute to eliminate shadows";
  }
  
  if (category.includes('storage') || name.includes('cabinet') || name.includes('shelv')) {
    return "Against walls to maximize floor space, flanking focal points when appropriate";
  }
  
  if (category.includes('bed')) {
    return "Centered on wall with symmetrical nightstand placement if space allows";
  }
  
  return "Integrate naturally within room layout maintaining scale and proportion";
}

/**
 * Get clearance requirements for safe and functional use
 */
function getClearanceRules(product: { name: string; functionalCategory?: string }): string {
  const category = product.functionalCategory?.toLowerCase() || '';
  const name = product.name.toLowerCase();
  
  if (category.includes('seating') || name.includes('sofa') || name.includes('chair')) {
    return "Minimum 36\" clearance in front for traffic, 24\" on sides for access";
  }
  
  if (category.includes('dining') || name.includes('dining')) {
    return "36-48\" clearance around table for chair pull-out and circulation";
  }
  
  if (category.includes('bed')) {
    return "24-36\" on each side for making bed and movement, 36\" at foot";
  }
  
  if (category.includes('desk')) {
    return "36\" behind chair for pushing back, clear path to desk area";
  }
  
  return "Maintain 24-36\" clearance for access and circulation";
}

/**
 * Define adjacency relationships to other products
 */
function getAdjacencyRules(
  product: { name: string; functionalCategory?: string },
  allProducts: Array<{ name: string; functionalCategory?: string }>,
  roomType: string
): string {
  const category = product.functionalCategory?.toLowerCase() || '';
  const name = product.name.toLowerCase();
  
  // Find related products
  const hasCoffeeTable = allProducts.some(p => p.name.toLowerCase().includes('coffee table'));
  const hasSofa = allProducts.some(p => p.name.toLowerCase().includes('sofa') || p.name.toLowerCase().includes('sectional'));
  const hasChairs = allProducts.some(p => p.name.toLowerCase().includes('chair') && !p.name.toLowerCase().includes('dining'));
  const hasSideTables = allProducts.some(p => p.name.toLowerCase().includes('side') || p.name.toLowerCase().includes('end table'));
  
  if (category.includes('coffee')) {
    if (hasSofa) {
      return "MUST be positioned in front of sofa, aligned with sofa centerline";
    }
    return "Central to seating arrangement if present";
  }
  
  if (category.includes('accent_seating')) {
    if (hasSofa && hasCoffeeTable) {
      return "Positioned to complete conversation zone around coffee table with sofa";
    } else if (hasSofa) {
      return "Angled toward sofa to create conversational grouping";
    }
    return "Create seating grouping with other chairs if multiple present";
  }
  
  if (category.includes('side') || category.includes('end')) {
    if (hasSofa || hasChairs) {
      return "Immediately adjacent to seating (sofa arm or chair side) for functional reach";
    }
    return "Pair with seating or bed for functional surface access";
  }
  
  if (category.includes('lighting')) {
    if (hasSideTables) {
      return "Place on side/end tables for task lighting at seating level";
    } else if (hasChairs || hasSofa) {
      return "Position beside seating or in room corners for ambient lighting";
    }
    return "Distribute evenly to eliminate dark zones";
  }
  
  return "Coordinate with room layout and other furniture for cohesive design";
}

/**
 * Get relative positioning for complementary items
 */
function getRelativePosition(
  product: { name: string; functionalCategory?: string },
  essentials: Array<{ name: string; functionalCategory?: string }>,
  roomType: string
): string {
  const category = product.functionalCategory?.toLowerCase() || '';
  const name = product.name.toLowerCase();
  
  // Find key essentials
  const primarySeating = essentials.find(p => 
    p.name.toLowerCase().includes('sofa') || p.name.toLowerCase().includes('sectional')
  );
  const coffeeTable = essentials.find(p => p.name.toLowerCase().includes('coffee table'));
  const bed = essentials.find(p => p.name.toLowerCase().includes('bed'));
  const diningTable = essentials.find(p => p.name.toLowerCase().includes('dining table'));
  
  if (category.includes('accent_seating')) {
    if (primarySeating && coffeeTable) {
      return `${primarySeating.name} and ${coffeeTable.name} - form conversation zone`;
    } else if (primarySeating) {
      return `${primarySeating.name} - create seating grouping`;
    }
    return "Essential seating items";
  }
  
  if (category.includes('side') || category.includes('end')) {
    if (primarySeating) {
      return `${primarySeating.name} - position at sofa ends or beside chairs`;
    } else if (bed) {
      return `${bed.name} - function as nightstand`;
    }
    return "Primary furniture pieces";
  }
  
  if (category.includes('lighting')) {
    if (primarySeating) {
      return `${primarySeating.name} - provide reading/task light`;
    } else if (bed) {
      return `${bed.name} - bedside lighting`;
    }
    return "Seating and task areas";
  }
  
  if (category.includes('storage')) {
    return "Walls and perimeter - flank focal points when appropriate";
  }
  
  if (category.includes('decor')) {
    return "Walls, surfaces, and vertical spaces - layer after furniture placement";
  }
  
  return "Other furniture in room composition";
}

/**
 * Build a highly detailed professional prompt from quiz responses and selected products
 * Optimized for clean, beautiful, realistic interior design renders
 * @param quiz - Quiz response data
 * @param selectedProducts - AI-selected products with placement
 * @param roomAnalysis - Optional analysis of the current room from Gemini Vision
 * @param floorPlanAnalysis - Optional analysis of the floor plan from Gemini Vision
 */
export function buildPromptFromQuiz(
  quiz: QuizResponse, 
  selectedProducts?: Array<{ sku: string; name: string; placement: string; reasoning: string; visualDescription?: string; visualDescriptionSource?: string; functionalCategory?: string; priority?: number }>,
  roomAnalysis?: Awaited<ReturnType<typeof analyzeRoomImage>>,
  floorPlanAnalysis?: Awaited<ReturnType<typeof analyzeFloorPlan>>
): { prompt: string; productMetadata: Record<string, { visualDescriptionSource: string }> } {
  const roomDesc = roomTypeDescriptions[quiz.roomType.toLowerCase()] || quiz.roomType;
  const styleDesc = styleDescriptions[quiz.style.toLowerCase()] || quiz.style;
  
  // Start with professional photography framing AND strict constraints upfront
  let prompt = `Professional interior design photography: Create a photorealistic, magazine-quality rendering of a ${roomDesc}.

⚠️ CRITICAL INSTRUCTION - READ FIRST:
You will be given a SPECIFIC LIST of furniture items to include. DO NOT ADD ANY FURNITURE BEYOND THAT LIST.
If you add sofas, sectionals, chairs, tables, or any furniture NOT on the provided list, the image will be REJECTED.
`;
  
  // Add structure preservation emphasis if room/floor plan analysis is available
  if (roomAnalysis || floorPlanAnalysis) {
    prompt += `\n\nCRITICAL STRUCTURE PRESERVATION REQUIREMENT:
This is a REDESIGN of an existing space, not a new room. You must preserve the exact architectural structure while updating the design.

MANDATORY PRESERVATION (NEVER CHANGE):
- Room dimensions, shape, and proportions must match exactly
- All walls, windows, doors, and openings in their exact locations and sizes
- Ceiling height and architectural details
- Structural elements and built-in features
- The viewpoint and perspective of the original space

WHAT YOU CAN CHANGE:
- Furniture pieces and their arrangement
- Wall paint colors and finishes
- Decorative elements and artwork
- Soft furnishings (rugs, curtains, pillows)
- Lighting fixtures and accessories
`;
  }
  // Add current space context from image analysis
  if (roomAnalysis && roomAnalysis.overallDescription !== "Image analysis unavailable") {
    prompt += `\n\nCURRENT SPACE ANALYSIS:\n`;
    prompt += `Overall: ${roomAnalysis.overallDescription}\n`;
    
    if (roomAnalysis.architecturalFeatures.length > 0) {
      prompt += `\nARCHITECTURAL FEATURES TO PRESERVE:\n`;
      roomAnalysis.architecturalFeatures.forEach(feature => {
        prompt += `- ${feature}\n`;
      });
      prompt += `IMPORTANT: All architectural features listed above are permanent fixtures. Windows must remain as functional windows with glass and natural light. Do not add, remove, or relocate any architectural elements.\n`;
    }
    
    if (roomAnalysis.furniture.length > 0) {
      prompt += `\nCURRENT FURNITURE (to be replaced):\n`;
      roomAnalysis.furniture.forEach(item => {
        prompt += `- ${item}\n`;
      });
    }
    
    if (roomAnalysis.colors.length > 0) {
      prompt += `\nCurrent color palette (for reference): ${roomAnalysis.colors.join(", ")}\n`;
    }
    
    if (roomAnalysis.wallPaintColors && 
        roomAnalysis.wallPaintColors !== "Unable to analyze wall paint colors" &&
        roomAnalysis.wallPaintColors.trim().length > 0) {
      prompt += `\nWALL PAINT COLORS TO PRESERVE:\n${roomAnalysis.wallPaintColors}\nIMPORTANT: Maintain these exact wall colors in the redesign.\n`;
    }
    
    if (roomAnalysis.wallPatterns && 
        roomAnalysis.wallPatterns !== "Unable to analyze wall patterns" &&
        roomAnalysis.wallPatterns.trim().length > 0) {
      prompt += `\nWALL PATTERNS & TEXTURES TO PRESERVE:\n${roomAnalysis.wallPatterns}\nIMPORTANT: Preserve these wall patterns and textures in the redesign.\n`;
    }
  }
  
  // Add floor plan spatial context
  if (floorPlanAnalysis && floorPlanAnalysis.overallDescription !== "Floor plan analysis unavailable") {
    prompt += `\n\nSPATIAL LAYOUT ANALYSIS:\n`;
    prompt += `${floorPlanAnalysis.overallDescription}\n`;
    prompt += `Room Dimensions: ${floorPlanAnalysis.roomDimensions}\n`;
    
    if (floorPlanAnalysis.windowLocations.length > 0) {
      prompt += `\nWINDOWS - CRITICAL ARCHITECTURAL CONSTRAINT:\n`;
      prompt += `The room has EXACTLY ${floorPlanAnalysis.windowLocations.length} window(s) located at:\n`;
      floorPlanAnalysis.windowLocations.forEach((location, idx) => {
        prompt += `${idx + 1}. ${location}\n`;
      });
      prompt += `\nCRITICAL REQUIREMENTS FOR WINDOWS:\n`;
      prompt += `- Preserve the EXACT location, size, and architectural style of these ${floorPlanAnalysis.windowLocations.length} window(s)\n`;
      prompt += `- Windows must remain FUNCTIONAL WINDOWS with visible glass, frames, and natural light coming through\n`;
      prompt += `- DO NOT add any additional windows beyond the ${floorPlanAnalysis.windowLocations.length} listed above\n`;
      prompt += `- DO NOT convert windows into wall decorations, murals, or non-functional architectural elements\n`;
      prompt += `- DO NOT place windows where they don't exist in the original space\n`;
      prompt += `- Windows are permanent architectural features that cannot be moved or changed\n\n`;
    }
    
    if (floorPlanAnalysis.doorLocations.length > 0) {
      prompt += `\nDOORS/OPENINGS - CRITICAL ARCHITECTURAL CONSTRAINT:\n`;
      prompt += `The room has EXACTLY ${floorPlanAnalysis.doorLocations.length} door(s)/opening(s) located at:\n`;
      floorPlanAnalysis.doorLocations.forEach((location, idx) => {
        prompt += `${idx + 1}. ${location}\n`;
      });
      prompt += `\nCRITICAL REQUIREMENTS FOR DOORS:\n`;
      prompt += `- Preserve the EXACT location and style of these ${floorPlanAnalysis.doorLocations.length} door(s)/opening(s)\n`;
      prompt += `- DO NOT add any additional doors or openings beyond the ${floorPlanAnalysis.doorLocations.length} listed above\n`;
      prompt += `- DO NOT remove any existing doors or openings\n`;
      prompt += `- DO NOT convert doors into wall decorations or non-functional elements\n`;
      prompt += `- Doors and openings are permanent architectural features that cannot be moved or changed\n\n`;
    } else {
      prompt += `\nDOORS/OPENINGS - CRITICAL ARCHITECTURAL CONSTRAINT:\n`;
      prompt += `The room has ZERO visible doors or openings in the captured view.\n`;
      prompt += `CRITICAL REQUIREMENT: DO NOT add any doors. The space should appear as a self-contained room with no door openings visible in this view.\n\n`;
    }
    
    if (floorPlanAnalysis.builtInFeatures.length > 0) {
      prompt += `Built-in Features: ${floorPlanAnalysis.builtInFeatures.join(", ")}\n`;
    }
    
    if (floorPlanAnalysis.ceilingRoofDesign && 
        floorPlanAnalysis.ceilingRoofDesign !== "Unable to analyze ceiling/roof design" &&
        floorPlanAnalysis.ceilingRoofDesign.trim().length > 0) {
      prompt += `\nCEILING/ROOF DESIGN TO PRESERVE:\n${floorPlanAnalysis.ceilingRoofDesign}\nIMPORTANT: Maintain the existing ceiling design, including all architectural details, beams, height, and special features described above.\n`;
    }
  }
  
  // Add comprehensive style description
  prompt += `\n\nDESIGN STYLE:\n${styleDesc}\n`;
  
  // Add color palette if selected
  if (quiz.colorPalettes && quiz.colorPalettes.length > 0) {
    const paletteDescs = quiz.colorPalettes
      .map(p => colorPaletteDescriptions[p.toLowerCase()] || p)
      .join(" Combined with ");
    prompt += `\nCOLOR PALETTE:\n${paletteDescs}\n`;
  }
  
  // Add functional features with specific implementation
  if (quiz.keyFeatures && quiz.keyFeatures.length > 0) {
    prompt += `\nFUNCTIONAL FEATURES:\n`;
    quiz.keyFeatures.forEach(feature => {
      prompt += `- ${feature}: Thoughtfully integrated into the design\n`;
    });
  }
  
  // Add user preferences with emphasis
  if (quiz.preferences && Array.isArray(quiz.preferences) && quiz.preferences.length > 0) {
    const prefs = quiz.preferences.filter(p => p && p.trim());
    if (prefs.length > 0) {
      prompt += `\nDESIGN PRIORITIES:\n${prefs.join("\n")}\n`;
    }
  }
  
  // Track visual description sources for each product
  const productMetadata: Record<string, { visualDescriptionSource: string }> = {};
  
  // Add specific curated products with detailed visual descriptions
  // Visual descriptions come from Gemini Vision analysis or text-based generator
  // These detailed descriptions ensure AI generates furniture that closely matches real products
  if (selectedProducts && selectedProducts.length > 0) {
    prompt += `\n\n⚠️ STRICT PRODUCT LIST - EXACTLY ${selectedProducts.length} ITEMS ⚠️
    
MANDATORY FURNITURE & DÉCOR (DO NOT ADD ANY OTHER ITEMS):
You MUST include ONLY these ${selectedProducts.length} specific products. Each product has detailed visual specifications for accurate representation:\n\n`;
    
    selectedProducts.forEach((product, index) => {
      prompt += `${index + 1}. ${product.name} [REQUIRED]\n`;
      
      // Use visual description already attached to the selected product
      const description = product.visualDescription || '';
      const source = product.visualDescriptionSource || 'None';
      
      // Track the source for this product
      productMetadata[product.sku] = { visualDescriptionSource: source };
      
      if (description && description !== "No visual description available - use product name and materials to approximate appearance") {
        console.log(`   📸 Using ${source} description for: ${product.name}`);
        prompt += `   
   VISUAL SPECIFICATIONS (MUST MATCH EXACTLY):
   ${description}
   
   ⚠️ CRITICAL: This product MUST look exactly as described above. Do not substitute or approximate.
   
`;
      } else {
        console.log(`   ⚠️ No visual description available for: ${product.name} - AI will approximate based on name and style`);
        prompt += `   
   VISUAL NOTE: No specific visual description available. Use product name and room style to determine appropriate appearance.
   
`;
      }
      
      prompt += `   
`;
    });
    
    // Add structured placement matrix BEFORE constraints
    prompt += generatePlacementMatrix(selectedProducts, quiz.roomType, roomAnalysis, floorPlanAnalysis);
    
    prompt += `
═══════════════════════════════════════════════════════════════════════════
🚫 CRITICAL CONSTRAINTS - ABSOLUTELY NO EXCEPTIONS - READ CAREFULLY:
═══════════════════════════════════════════════════════════════════════════

⚠️ PRODUCT COUNT: This room contains EXACTLY ${selectedProducts.length} products - NOT ${selectedProducts.length + 1}, NOT ${selectedProducts.length + 2}, EXACTLY ${selectedProducts.length}.

⚠️ STRICT PRODUCT LIST ENFORCEMENT:
You MUST include ONLY the ${selectedProducts.length} products explicitly listed above.
You MUST NOT add, invent, hallucinate, or include ANY other furniture or decor items.

⚠️ ABSOLUTELY FORBIDDEN TO ADD (even if the room type typically has these):
❌ NO dining tables (even in a Dining Room)
❌ NO dining chairs (even in a Dining Room)  
❌ NO sofas or couches (even in a Living Room)
❌ NO coffee tables (even in a Living Room)
❌ NO beds (even in a Bedroom)
❌ NO accent chairs or armchairs
❌ NO side tables, console tables, or desks
❌ NO additional lighting fixtures
❌ NO rugs or carpets
❌ NO plants or planters
❌ NO wall art or mirrors
❌ NO bookcases or shelving units
❌ NO decorative accessories

⚠️ IF THE PRODUCT IS NOT IN THE ABOVE LIST → DO NOT INCLUDE IT IN THE IMAGE

⚠️ IF THE ROOM FEELS EMPTY → That is intentional. Focus on architectural beauty, lighting, and the ${selectedProducts.length} specified products only.

⚠️ FAILURE CRITERIA: If you add even ONE piece of furniture not listed above, the render will be COMPLETELY REJECTED and you will need to regenerate it.

═══════════════════════════════════════════════════════════════════════════
🚨 FINAL PRODUCT LIST VERIFICATION:
═══════════════════════════════════════════════════════════════════════════
Total products to include: ${selectedProducts.length}
Do NOT deviate from this list under any circumstances.
═══════════════════════════════════════════════════════════════════════════
\n`;
  }
  
  // Repeat constraints before photography specs to reinforce
  if (selectedProducts && selectedProducts.length > 0) {
    prompt += `\n\n🚨 FINAL REMINDER BEFORE RENDERING:
This room contains ONLY ${selectedProducts.length} items. DO NOT add sofas, sectionals, extra chairs, tables, or any furniture not explicitly listed above.
The ${selectedProducts.length} products listed are THE COMPLETE AND ONLY furniture/decor in this space.\n`;
  }
  
  // Professional photography and rendering specifications
  prompt += `\n\nPHOTOGRAPHY SPECIFICATIONS:
- Camera Angle: Eye-level perspective at approximately 5.5 feet height, showing 60-70% of the room with balanced composition
- Framing: Wide-angle architectural shot (24-35mm equivalent) capturing the room's atmosphere and spatial relationships
- Lighting: Soft natural daylight streaming through windows with warm color temperature (4500-5500K), creating gentle shadows and depth
- Time of Day: Mid-morning or late afternoon golden hour lighting for warmth and dimension
- Exposure: Perfectly balanced exposure with no blown highlights, rich shadows with retained detail, professional HDR technique
- Focus: Tack-sharp throughout with appropriate depth of field (f/5.6-f/8 equivalent)
- White Balance: Accurate and natural, slightly warm to enhance coziness
- Atmosphere: Inviting, lived-in yet immaculately styled, aspirational but achievable

RENDERING QUALITY:
- Resolution: 8K ultra-high-definition quality
- Realism: Photorealistic materials, accurate physics-based rendering, authentic texture detail
- Style Reference: Architectural Digest, Elle Décor, House Beautiful editorial photography
- Finishing: Professional color grading, subtle vignetting, magazine-ready polish
- Details: Crisp edges, realistic fabric draping, authentic wood grain, proper reflections and refractions
- Atmosphere: Inviting warmth, lived-in comfort, editorial sophistication

CRITICAL REQUIREMENTS:
- Every element must look real and tangible, not CGI or artificial
- Materials must have authentic texture, wear, and character
- Lighting must be natural and believable, avoiding harsh shadows
- Composition must be balanced and professionally styled
- All furniture pieces must be properly proportioned and positioned
- The space must feel cohesive, harmonious, and thoughtfully designed
- Avoid overly perfect symmetry - include subtle organic asymmetry for realism

ARCHITECTURAL PRESERVATION (NON-NEGOTIABLE):
- Windows: Preserve EXACT locations and quantities specified above. Windows must remain FUNCTIONAL with visible glass and natural light
- DO NOT add extra windows or convert windows into decorative wall elements
- Ceiling/roof design: Maintain all existing architectural details (beams, height, materials, etc.)
- Wall colors and patterns: Preserve existing wall finishes as specified
- Doors and built-in features: Keep in their exact original locations`;
  
  return { prompt, productMetadata };
}

/**
 * Analyze a room photo using Gemini Vision to extract detailed information
 * Returns structured text descriptions of the space for better AI understanding
 */
export async function analyzeRoomImage(imageUrl: string): Promise<{
  furniture: string[];
  colors: string[];
  wallPaintColors: string;
  wallPatterns: string;
  style: string;
  layout: string;
  lighting: string;
  architecturalFeatures: string[];
  overallDescription: string;
}> {
  try {
    console.log(`Analyzing room image with Gemini Vision: ${imageUrl}`);
    
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
    
    const analysisPrompt = `Analyze this room image in detail as an expert interior designer. Extract the following information:

1. FURNITURE: List all visible furniture pieces with their approximate condition and style
2. COLORS: Identify the dominant colors in walls, furniture, and décor
3. WALL PAINT COLORS: Describe the specific paint colors on the walls in detail - include primary wall color, accent wall colors if present, color names or descriptions (e.g., "soft dove gray", "warm beige", "crisp white with cool undertones"), and finish type (matte, eggshell, semi-gloss, glossy)
4. WALL PATTERNS & TEXTURES: Describe any wallpaper patterns, painted patterns, stencils, murals, texture finishes (e.g., "geometric wallpaper", "striped accent wall", "textured plaster", "smooth painted walls", "brick accent wall", "wood paneling"). If walls are plain painted, state "Plain painted walls with no patterns"
5. STYLE: Determine the overall design style (modern, traditional, eclectic, etc.)
6. LAYOUT: Describe the room's spatial arrangement and traffic flow
7. LIGHTING: Describe natural and artificial lighting sources and quality
8. ARCHITECTURAL FEATURES: List windows, doors, ceiling details, built-ins, moldings, etc.
9. OVERALL DESCRIPTION: Provide a comprehensive 2-3 sentence description

Return your analysis as a JSON object with these exact keys:
{
  "furniture": ["item 1 description", "item 2 description", ...],
  "colors": ["color 1", "color 2", ...],
  "wallPaintColors": "detailed wall paint color description",
  "wallPatterns": "wall patterns and textures description",
  "style": "style name",
  "layout": "layout description",
  "lighting": "lighting description",
  "architecturalFeatures": ["feature 1", "feature 2", ...],
  "overallDescription": "comprehensive description"
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
            furniture: { type: Type.ARRAY, items: { type: Type.STRING } },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            wallPaintColors: { type: Type.STRING },
            wallPatterns: { type: Type.STRING },
            style: { type: Type.STRING },
            layout: { type: Type.STRING },
            lighting: { type: Type.STRING },
            architecturalFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
            overallDescription: { type: Type.STRING },
          },
          required: ["furniture", "colors", "wallPaintColors", "wallPatterns", "style", "layout", "lighting", "architecturalFeatures", "overallDescription"]
        }
      }
    });

    const analysis = JSON.parse(response.text || "{}");
    console.log("Room analysis completed:", analysis);
    
    return analysis;
  } catch (error) {
    console.error("Room image analysis error:", error);
    // Return empty analysis on error
    return {
      furniture: [],
      colors: [],
      wallPaintColors: "Unable to analyze wall paint colors",
      wallPatterns: "Unable to analyze wall patterns",
      style: "unknown",
      layout: "Unable to analyze layout",
      lighting: "Unable to analyze lighting",
      architecturalFeatures: [],
      overallDescription: "Image analysis unavailable"
    };
  }
}

/**
 * Analyze a floor plan using Gemini Vision to extract spatial information
 * Returns structured text descriptions of dimensions, layout, and features
 */
export async function analyzeFloorPlan(imageUrl: string): Promise<{
  roomDimensions: string;
  windowLocations: string[];
  doorLocations: string[];
  builtInFeatures: string[];
  ceilingRoofDesign: string;
  layoutNotes: string;
  overallDescription: string;
}> {
  try {
    console.log(`Analyzing floor plan with Gemini Vision: ${imageUrl}`);
    
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch floor plan: ${imageResponse.status}`);
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
    
    const analysisPrompt = `Analyze this floor plan or room image as an expert architect. Extract the following spatial information:

1. ROOM DIMENSIONS: Approximate size and proportions (if measurements visible, include them)
2. WINDOW LOCATIONS: List all windows with their approximate positions (e.g., "north wall", "east wall near corner")
3. DOOR LOCATIONS: List all doors/openings with positions and swing direction if visible
4. BUILT-IN FEATURES: Identify any built-in elements like closets, fireplaces, alcoves, columns
5. CEILING/ROOF DESIGN: Describe the ceiling or roof design in detail - height, materials, exposed beams, coffers, vaulted ceilings, skylights, crown molding, ceiling fans, lighting fixtures, architectural details, and any special ceiling features
6. LAYOUT NOTES: Describe the overall room shape, floor materials, and any special architectural considerations
7. OVERALL DESCRIPTION: Provide a 2-3 sentence summary of the space's layout and key features

Return your analysis as a JSON object with these exact keys:
{
  "roomDimensions": "dimension description",
  "windowLocations": ["window 1 location", "window 2 location", ...],
  "doorLocations": ["door 1 location", "door 2 location", ...],
  "builtInFeatures": ["feature 1", "feature 2", ...],
  "ceilingRoofDesign": "detailed ceiling/roof design description",
  "layoutNotes": "layout description",
  "overallDescription": "comprehensive description"
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
            roomDimensions: { type: Type.STRING },
            windowLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
            doorLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
            builtInFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
            ceilingRoofDesign: { type: Type.STRING },
            layoutNotes: { type: Type.STRING },
            overallDescription: { type: Type.STRING },
          },
          required: ["roomDimensions", "windowLocations", "doorLocations", "builtInFeatures", "ceilingRoofDesign", "layoutNotes", "overallDescription"]
        }
      }
    });

    const analysis = JSON.parse(response.text || "{}");
    console.log("Floor plan analysis completed:", analysis);
    
    return analysis;
  } catch (error) {
    console.error("Floor plan analysis error:", error);
    // Return empty analysis on error
    return {
      roomDimensions: "Unknown dimensions",
      windowLocations: [],
      doorLocations: [],
      builtInFeatures: [],
      ceilingRoofDesign: "Unable to analyze ceiling/roof design",
      layoutNotes: "Unable to analyze layout",
      overallDescription: "Floor plan analysis unavailable"
    };
  }
}

/**
 * Analyze vibe images to extract detailed visual preferences
 * Returns color palette, materials, textures, lighting tone, and design density
 */
export async function analyzeVibeImages(imageUrls: string[]): Promise<{
  colorPalette: string[];
  materials: string[];
  textures: string[];
  lightingTone: string;
  density: string;
  overallVibe: string;
}> {
  try {
    if (!imageUrls || imageUrls.length === 0) {
      console.log("No vibe images to analyze");
      return {
        colorPalette: [],
        materials: [],
        textures: [],
        lightingTone: "neutral",
        density: "moderate",
        overallVibe: "No vibe images provided"
      };
    }

    console.log(`🎨 Analyzing ${imageUrls.length} vibe image(s) to extract visual preferences...`);

    // Process all images in parallel
    const imageData = await Promise.all(
      imageUrls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch vibe image: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        let mimeType = response.headers.get('content-type') || 'image/jpeg';
        if (!mimeType.startsWith('image/')) {
          const urlLower = url.toLowerCase();
          if (urlLower.endsWith('.png')) mimeType = 'image/png';
          else if (urlLower.endsWith('.webp')) mimeType = 'image/webp';
          else if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else mimeType = 'image/jpeg';
        }
        return { data: base64, mimeType };
      })
    );

    const analysisPrompt = `You are an expert interior designer analyzing inspiration images to understand a user's visual preferences. Extract the following information from ${imageUrls.length > 1 ? 'these images' : 'this image'}:

1. COLOR PALETTE: List 5-8 dominant colors with specific names or hex codes (e.g., "warm terracotta #E07A5F", "soft sage green #84A98C", "creamy white #F4F1DE")

2. MATERIALS: Identify visible materials in furniture and décor (e.g., "natural oak wood", "brushed brass metal", "linen fabric", "marble stone", "rattan", "velvet", "concrete")

3. TEXTURES: Describe surface textures and finishes (e.g., "smooth matte", "rough textured", "glossy polished", "woven", "distressed", "soft plush")

4. LIGHTING TONE: Classify the lighting atmosphere (choose ONE: "warm", "cool", "natural", "dramatic")

5. DENSITY: Assess the visual fullness of the space (choose ONE: "minimal" for sparse/clean, "moderate" for balanced, "layered" for full/eclectic)

6. OVERALL VIBE: Write 2-3 sentences capturing the emotional feeling and design aesthetic of ${imageUrls.length > 1 ? 'these spaces' : 'this space'}

Return your analysis as a JSON object with these exact keys:
{
  "colorPalette": ["color 1", "color 2", ...],
  "materials": ["material 1", "material 2", ...],
  "textures": ["texture 1", "texture 2", ...],
  "lightingTone": "warm/cool/natural/dramatic",
  "density": "minimal/moderate/layered",
  "overallVibe": "comprehensive description"
}`;

    // Build parts array with prompt and all images
    const parts: any[] = [{ text: analysisPrompt }];
    imageData.forEach(img => {
      parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
            materials: { type: Type.ARRAY, items: { type: Type.STRING } },
            textures: { type: Type.ARRAY, items: { type: Type.STRING } },
            lightingTone: { type: Type.STRING },
            density: { type: Type.STRING },
            overallVibe: { type: Type.STRING },
          },
          required: ["colorPalette", "materials", "textures", "lightingTone", "density", "overallVibe"]
        }
      }
    });

    const analysis = JSON.parse(response.text || "{}");
    console.log("✅ Vibe image analysis completed:", {
      colors: analysis.colorPalette?.length || 0,
      materials: analysis.materials?.length || 0,
      textures: analysis.textures?.length || 0,
      tone: analysis.lightingTone,
      density: analysis.density
    });

    return analysis;
  } catch (error) {
    console.error("Vibe image analysis error:", error);
    return {
      colorPalette: [],
      materials: [],
      textures: [],
      lightingTone: "neutral",
      density: "moderate",
      overallVibe: "Unable to analyze vibe images"
    };
  }
}

/**
 * Identify which products from a list are actually visible in a generated room image
 * @param imageDataUrl - Base64 data URL of the generated image
 * @param selectedProducts - List of products that were intended for the room
 * @returns Array of SKUs for products that are actually visible in the image
 */
export async function identifyVisibleProducts(
  imageDataUrl: string,
  selectedProducts: Array<{ sku: string; name: string; placement: string; reasoning: string }>
): Promise<string[]> {
  try {
    console.log(`🔍 Analyzing generated image to identify visible products from ${selectedProducts.length} candidates...`);
    
    // Extract base64 data from data URL
    const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
      throw new Error("Invalid image data format");
    }
    const imageBase64 = base64Match[1];
    const mimeType = imageDataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/png';
    
    // Create a detailed product list for Gemini to identify
    const productList = selectedProducts.map((p, idx) => 
      `${idx + 1}. ${p.name} (SKU: ${p.sku})`
    ).join('\n');
    
    const analysisPrompt = `You are analyzing an AI-generated interior design image. Your task is to identify which products from the provided list are ACTUALLY VISIBLE in this image.

PRODUCT LIST (products that were intended for this room):
${productList}

INSTRUCTIONS:
1. Carefully examine the image and identify furniture and décor items that are clearly visible
2. For each product in the list above, determine if it (or something very similar to it) is actually visible in the image
3. A product is "visible" only if:
   - You can clearly see it in the image
   - It matches the product name/description
   - It's not hidden, blocked, or outside the camera view
4. Return ONLY the SKUs of products that are actually visible

IMPORTANT:
- Be strict: only include products you can actually see
- If a product type is in the image but doesn't match the specific product name, DO NOT include it
- If you're unsure whether a product is visible, DO NOT include it
- An empty array is acceptable if no products are clearly visible

Return your analysis as a JSON object with this format:
{
  "visibleSkus": ["SKU1", "SKU2", ...]
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
            visibleSkus: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["visibleSkus"]
        }
      }
    });

    const analysis = JSON.parse(response.text || "{}");
    const visibleSkus: string[] = analysis.visibleSkus || [];
    
    // Deduplicate SKUs - Gemini may return the same SKU multiple times if it sees multiple identical items
    const uniqueSkus: string[] = Array.from(new Set(visibleSkus));
    
    if (uniqueSkus.length < visibleSkus.length) {
      console.log(`🔄 Deduplicated ${visibleSkus.length} visible products to ${uniqueSkus.length} unique products`);
    }
    
    console.log(`✅ Identified ${uniqueSkus.length} unique visible products out of ${selectedProducts.length} total: ${uniqueSkus.join(', ')}`);
    
    return uniqueSkus;
  } catch (error) {
    console.error("Product visibility analysis error:", error);
    // Return all SKUs as fallback - better to show all than none
    const allSkus = selectedProducts.map(p => p.sku);
    console.warn(`⚠️ Falling back to showing all ${allSkus.length} products due to analysis error`);
    return allSkus;
  }
}

/**
 * Generate an interior design image using Gemini 2.5 Flash:
 * - Text-to-image: Creative generation when no room photo provided
 * - Image-to-image: Structure-preserving redesign when room photo provided (AI sees actual space)
 * 
 * Image-to-image mode ensures the AI can see and preserve the actual uploaded room's:
 * - Architectural features (windows, doors, walls, ceiling)
 * - Room dimensions and layout
 * - Spatial characteristics and proportions
 * 
 * @param prompt - Detailed description of the desired design style and furniture
 * @param floorplanUrl - Optional room photo/floor plan URL for structure-preserving generation
 * @param roomAnalysis - Optional analysis of the current room from analyzeRoomImage
 * @param floorPlanAnalysis - Optional analysis of the floor plan from analyzeFloorPlan
 * @returns Base64 data URL (data:image/png;base64,...)
 */
export async function generateInteriorImage(
  prompt: string,
  floorplanUrl?: string,
  roomAnalysis?: Awaited<ReturnType<typeof analyzeRoomImage>>,
  floorPlanAnalysis?: Awaited<ReturnType<typeof analyzeFloorPlan>>
): Promise<string> {
  try {
    // Text-to-image generation with Gemini (creative generation - no room photo)
    if (!floorplanUrl) {
      console.log("Using Gemini for text-to-image creative generation");
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
    
    // Image-to-image generation with Gemini (structure-preserving)
    console.log(`Fetching room image from: ${floorplanUrl}`);
    const roomImageResponse = await fetch(floorplanUrl);
    
    if (!roomImageResponse.ok) {
      console.warn(`Failed to fetch room image (${roomImageResponse.status}), falling back to text-to-image`);
      // Fallback to text-to-image generation
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
    
    // Fetch and encode the room image for Gemini
    const roomPhotoBuffer = await roomImageResponse.arrayBuffer();
    const roomPhotoBase64 = Buffer.from(roomPhotoBuffer).toString('base64');
    
    // Detect MIME type from response headers or URL extension
    let photoMimeType = roomImageResponse.headers.get('content-type') || 'image/jpeg';
    if (!photoMimeType.startsWith('image/')) {
      // Try to detect from URL extension
      const urlLower = floorplanUrl.toLowerCase();
      if (urlLower.endsWith('.png')) photoMimeType = 'image/png';
      else if (urlLower.endsWith('.webp')) photoMimeType = 'image/webp';
      else if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) photoMimeType = 'image/jpeg';
      else photoMimeType = 'image/jpeg'; // default fallback
    }
    
    console.log(`Using Gemini for structure-preserving image-to-image editing with MIME type: ${photoMimeType}`);
    
    // Enhanced prompt for structure preservation
    const imageToImagePrompt = `You are redesigning this room. CRITICAL INSTRUCTIONS:

PRESERVE EXACTLY (DO NOT CHANGE):
- All architectural features: windows, doors, walls, ceiling, built-ins
- The exact room layout, dimensions, and shape shown in the image
- Window locations, sizes, and styles (keep as functional windows with glass)
- Door locations and openings (keep in exact positions)
- Wall positions and structural elements
- Ceiling design and height
- Floor area and proportions

REDESIGN ONLY:
- Furniture arrangement and pieces
- Wall colors and paint
- Décor items, artwork, and accessories
- Rugs, curtains, and soft furnishings
- Lighting fixtures (not structural lighting)

${prompt}

Generate a photorealistic redesign that preserves the room's architecture while implementing the design vision described above. The output should look like a professional interior design photo of the SAME physical space with new furniture and styling.`;
    
    // Use Gemini's image-to-image capability with the uploaded room photo
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{
        role: "user",
        parts: [
          { text: imageToImagePrompt },
          { inlineData: { data: roomPhotoBase64, mimeType: photoMimeType } }
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
    console.log("✅ Successfully generated structure-preserving redesign with Gemini");
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.error("AI generation error:", error);
    throw new Error(`Failed to generate interior design: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate structure-preserving redesign using Stability AI
 * Uses control_strength to preserve room architecture while redesigning furniture
 */
async function generateWithStabilityAI(
  imageBuffer: ArrayBuffer,
  prompt: string,
  mimeType: string
): Promise<string> {
  const stabilityApiKey = process.env.STABILITY_API_KEY;
  if (!stabilityApiKey) {
    throw new Error("STABILITY_API_KEY environment variable not set");
  }

  try {
    const formData = new FormData();
    
    // Convert ArrayBuffer to Blob with correct MIME type
    const imageBlob = new Blob([imageBuffer], { type: mimeType });
    
    // Determine file extension for proper handling
    let fileExtension = 'jpg';
    if (mimeType.includes('png')) fileExtension = 'png';
    else if (mimeType.includes('webp')) fileExtension = 'webp';
    
    formData.append('image', imageBlob, `room.${fileExtension}`);
    formData.append('prompt', prompt);
    formData.append('control_strength', '0.85'); // High value (0.7 is default) = preserve structure more
    formData.append('output_format', 'png');
    formData.append('seed', Math.floor(Math.random() * 4294967295).toString());
    formData.append('negative_prompt', 'blurry, low quality, distorted architecture, wrong perspective, missing windows, removed doors');
    
    const response = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stabilityApiKey}`,
        'Accept': 'image/*'
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stability AI API error (${response.status}): ${errorText}`);
    }

    const imageArrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageArrayBuffer).toString('base64');
    
    return `data:image/png;base64,${base64Image}`;
  } catch (error) {
    console.error("Stability AI error:", error);
    throw error;
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
