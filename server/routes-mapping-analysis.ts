import { Router } from "express";
import { getDb } from "./db"; // Add .js extension
import { products } from "@shared/schema"; // Add .js extension
import { sql, isNotNull } from "drizzle-orm";

const router = Router();

// Quiz configuration - these are the actual options users can select
const QUIZ_ROOM_TYPES = [
  "Living Room",
  "Bedroom", 
  "Dining Room",
  "Office",
  "Kitchen"
];

const QUIZ_STYLES = [
  "Modern",
  "Midcentury",
  "Scandinavian",
  "Industrial",
  "Bohemian",
  "Coastal",
  "Traditional",
  "Organic Modern"
];

const QUIZ_FEATURES = [
  "Natural Light",
  "Storage Solutions",
  "Workspace",
  "Ample Seating",
  "Greenery",
  "Art Display",
  "Cozy Ambiance",
  "Open Layout"
];

const QUIZ_COLOR_PALETTES = [
  "Light Neutrals",
  "Warm & Cozy",
  "Deep & Moody",
  "Natural Earth Tones",
  "Cool Blues & Grays"
];

// Color palette to product color mapping
const PALETTE_COLOR_MAPPING: Record<string, string[]> = {
  "Light Neutrals": ["White", "Beige", "Cream", "Light Gray", "Ivory", "Off-White", "Natural"],
  "Warm & Cozy": ["Brown", "Tan", "Caramel", "Rust", "Terracotta", "Warm Gray", "Ochre"],
  "Deep & Moody": ["Black", "Charcoal", "Navy", "Dark Gray", "Deep Green", "Burgundy"],
  "Natural Earth Tones": ["Brown", "Tan", "Green", "Olive", "Sage", "Clay", "Terracotta"],
  "Cool Blues & Grays": ["Blue", "Gray", "Silver", "Light Blue", "Cool Gray", "Navy"]
};

// Functional categories for room composition (from room-composition-service)
const FUNCTIONAL_CATEGORIES = {
  primary_seating: ["Sofa", "Sectional"],
  accent_seating: ["Accent Chair", "Armchair", "Lounge Chair"],
  coffee_table: ["Coffee Table", "Ottoman"],
  storage: ["Cabinet", "Dresser", "Bookcase", "Console", "Credenza"],
  lighting: ["Floor Lamp", "Table Lamp", "Pendant"],
  decor: ["Mirror", "Art", "Planter", "Vase", "Decorative Object"],
  desk: ["Desk", "Writing Table"],
  dining_table: ["Dining Table"],
  dining_chair: ["Dining Chair"],
  bed: ["Bed", "Platform Bed"],
  nightstand: ["Nightstand", "Bedside Table"]
};

/**
 * Analyze color palette coverage
 */
function analyzeColorPalettes(allProducts: any[]) {
  const paletteData: Record<string, { productsCount: number; colors: Set<string> }> = {};
  
  // Initialize palette data
  QUIZ_COLOR_PALETTES.forEach(palette => {
    paletteData[palette] = { productsCount: 0, colors: new Set() };
  });
  
  // Count products matching each palette
  allProducts.forEach(product => {
    if (!product.colors || product.colors.length === 0) return;
    
    QUIZ_COLOR_PALETTES.forEach(palette => {
      const paletteColors = PALETTE_COLOR_MAPPING[palette];
      const hasMatchingColor = product.colors.some((productColor: string) =>
        paletteColors.some(paletteColor =>
          productColor.toLowerCase().includes(paletteColor.toLowerCase()) ||
          paletteColor.toLowerCase().includes(productColor.toLowerCase())
        )
      );
      
      if (hasMatchingColor) {
        paletteData[palette].productsCount++;
        product.colors.forEach((c: string) => paletteData[palette].colors.add(c));
      }
    });
  });
  
  const paletteCoverage = Object.entries(paletteData).map(([palette, data]) => ({
    palette,
    productsCount: data.productsCount,
    uniqueColors: data.colors.size,
    coverage: Math.round((data.productsCount / allProducts.length) * 100)
  })).sort((a, b) => b.productsCount - a.productsCount);
  
  const lowCoveragePalettes = paletteCoverage.filter(p => p.coverage < 20);
  
  return {
    paletteCoverage,
    lowCoveragePalettes,
    recommendations: lowCoveragePalettes.map(p => 
      `Low coverage for "${p.palette}" (${p.coverage}%) - need ${Math.max(0, Math.ceil(allProducts.length * 0.2) - p.productsCount)} more products`
    )
  };
}

/**
 * Analyze room composition by functional categories
 */
function analyzeRoomComposition(allProducts: any[]) {
  // Group products by functional category
  const categoryData: Record<string, { count: number; products: any[] }> = {};
  let uncategorized = 0;
  
  Object.keys(FUNCTIONAL_CATEGORIES).forEach(category => {
    categoryData[category] = { count: 0, products: [] };
  });
  
  allProducts.forEach((product: any) => { // Explicitly type product
    let categorized = false;
    const productNameLower = product.name.toLowerCase();
    const categoryName = product.category?.name?.toLowerCase() || '';
    
    Object.entries(FUNCTIONAL_CATEGORIES).forEach(([funcCategory, keywords]) => {
      const matches = keywords.some(keyword =>
        productNameLower.includes(keyword.toLowerCase()) ||
        categoryName.includes(keyword.toLowerCase())
      );
      
      if (matches) {
        categoryData[funcCategory].count++;
        categoryData[funcCategory].products.push({
          id: product.id,
          sku: product.sku,
          name: product.name
        });
        categorized = true;
      }
    });
    
    if (!categorized) uncategorized++;
  });
  
  // Room-specific composition needs
  const roomCompositionNeeds = {
    "Living Room": {
      essential: [
        { category: "primary_seating", min: 2, current: categoryData.primary_seating?.count || 0 },
        { category: "coffee_table", min: 1, current: categoryData.coffee_table?.count || 0 }
      ],
      recommended: [
        { category: "accent_seating", target: 5, current: categoryData.accent_seating?.count || 0 },
        { category: "storage", target: 3, current: categoryData.storage?.count || 0 },
        { category: "lighting", target: 5, current: categoryData.lighting?.count || 0 }
      ]
    },
    "Bedroom": {
      essential: [
        { category: "bed", min: 1, current: categoryData.bed?.count || 0 },
        { category: "nightstand", min: 2, current: categoryData.nightstand?.count || 0 }
      ],
      recommended: [
        { category: "storage", target: 3, current: categoryData.storage?.count || 0 },
        { category: "lighting", target: 3, current: categoryData.lighting?.count || 0 }
      ]
    },
    "Dining Room": {
      essential: [
        { category: "dining_table", min: 1, current: categoryData.dining_table?.count || 0 },
        { category: "dining_chair", min: 4, current: categoryData.dining_chair?.count || 0 }
      ],
      recommended: [
        { category: "storage", target: 2, current: categoryData.storage?.count || 0 },
        { category: "lighting", target: 2, current: categoryData.lighting?.count || 0 }
      ]
    },
    "Office": {
      essential: [
        { category: "desk", min: 1, current: categoryData.desk?.count || 0 },
        { category: "accent_seating", min: 1, current: categoryData.accent_seating?.count || 0 }
      ],
      recommended: [
        { category: "storage", target: 3, current: categoryData.storage?.count || 0 },
        { category: "lighting", target: 2, current: categoryData.lighting?.count || 0 }
      ]
    }
  };
  
  // Generate deficits
  const deficits: string[] = [];
  Object.entries(roomCompositionNeeds).forEach(([roomType, needs]) => {
    needs.essential.forEach(item => {
      if (item.current < item.min) {
        deficits.push(`${roomType} missing ${item.min - item.current} essential ${item.category} (has ${item.current}, needs ${item.min})`);
      }
    });
    needs.recommended.forEach(item => {
      if (item.current < item.target) {
        deficits.push(`${roomType} needs ${item.target - item.current} more ${item.category} for optimal variety (has ${item.current}, target ${item.target})`);
      }
    });
  });
  
  return {
    categoryBreakdown: Object.entries(categoryData).map(([category, data]) => ({
      category,
      count: data.count,
      percentage: Math.round((data.count / allProducts.length) * 100)
    })).sort((a, b) => b.count - a.count),
    roomCompositionNeeds,
    uncategorized,
    deficits
  };
}

/**
 * Analyze filter optimization - which combinations work best
 */
function analyzeFilterOptimization(allProducts: any[]) {
  // Simulate filter combinations
  const filterCombinations: any[] = [];
  
  QUIZ_ROOM_TYPES.forEach(roomType => {
    QUIZ_STYLES.forEach(style => {
      // Count products matching this combination
      const matchingProducts = allProducts.filter((p: any) => // Explicitly type p
        p.roomType?.some((rt: string) => rt.toLowerCase() === roomType.toLowerCase()) &&
        p.designStyle?.some((ds: string) => ds.toLowerCase().includes(style.toLowerCase()))
      );
      
      if (matchingProducts.length > 0) {
        filterCombinations.push({
          roomType,
          style,
          productCount: matchingProducts.length,
          viable: matchingProducts.length >= 10 // Need at least 10 products
        });
      }
    });
  });
  
  // Sort by product count
  filterCombinations.sort((a, b) => b.productCount - a.productCount);
  
  const bestCombinations = filterCombinations.filter(c => c.viable).slice(0, 10);
  const weakCombinations = filterCombinations.filter(c => !c.viable);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  // Identify room types with poor coverage across all styles
  const roomTypeCounts: Record<string, number> = {};
  QUIZ_ROOM_TYPES.forEach(roomType => {
    const total = filterCombinations
      .filter(c => c.roomType === roomType)
      .reduce((sum, c) => sum + c.productCount, 0);
    roomTypeCounts[roomType] = total;
    
    if (total < 50) {
      recommendations.push(`${roomType} has poor overall coverage (${total} products) - needs more inventory across all styles`);
    }
  });
  
  // Identify styles with poor coverage
  const styleCounts: Record<string, number> = {};
  QUIZ_STYLES.forEach(style => {
    const total = filterCombinations
      .filter(c => c.style === style)
      .reduce((sum, c) => sum + c.productCount, 0);
    styleCounts[style] = total;
    
    if (total < 50) {
      recommendations.push(`${style} style has poor coverage (${total} products) - needs more products across room types`);
    }
  });
  
  return {
    bestCombinations,
    weakCombinations: weakCombinations.slice(0, 10),
    roomTypeCoverage: Object.entries(roomTypeCounts).map(([roomType, count]) => ({
      roomType,
      totalProducts: count,
      viable: count >= 50
    })).sort((a, b) => b.totalProducts - a.totalProducts),
    styleCoverage: Object.entries(styleCounts).map(([style, count]) => ({
      style,
      totalProducts: count,
      viable: count >= 50
    })).sort((a, b) => b.totalProducts - a.totalProducts),
    recommendations
  };
}

/**
 * GET /api/admin/mapping-analysis
 * Returns comprehensive mapping analysis between quiz options and product database values
 */
router.get("/mapping-analysis", async (req, res) => {
  try {
    // Get all products
    const allProducts = await getDb().select().from(products);

    // Analyze room types
    const roomTypeValues = new Map<string, number>();
    let productsWithRoomType = 0;
    let productsWithMismatchedRoomType: any[] = [];

    allProducts.forEach((product: any) => { // Explicitly type product
      if (product.roomType && product.roomType.length > 0) {
        productsWithRoomType++;
        product.roomType.forEach((rt: string) => { // Explicitly type rt
          roomTypeValues.set(rt, (roomTypeValues.get(rt) || 0) + 1);
          
          // Check if this room type matches any quiz option (case-insensitive)
          const matchesQuizOption = QUIZ_ROOM_TYPES.some(qrt => 
            qrt.toLowerCase() === rt.toLowerCase()
          );
          
          if (!matchesQuizOption && productsWithMismatchedRoomType.length < 20) {
            productsWithMismatchedRoomType.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              roomType: product.roomType
            });
          }
        });
      }
    });

    const roomTypeProductValues = Array.from(roomTypeValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const unmappedRoomTypes = Array.from(roomTypeValues.keys())
      .filter(val => !QUIZ_ROOM_TYPES.some(qrt => qrt.toLowerCase() === val.toLowerCase()));

    // Analyze design styles
    const styleValues = new Map<string, number>();
    let productsWithStyle = 0;
    let productsWithMismatchedStyle: any[] = [];

    allProducts.forEach((product: any) => { // Explicitly type product
      if (product.designStyle && product.designStyle.length > 0) {
        productsWithStyle++;
        product.designStyle.forEach((ds: string) => { // Explicitly type ds
          styleValues.set(ds, (styleValues.get(ds) || 0) + 1);
          
          // Check if matches quiz option (flexible matching)
          const matchesQuizOption = QUIZ_STYLES.some(qs => {
            const qsLower = qs.toLowerCase();
            const dsLower = ds.toLowerCase();
            return dsLower.includes(qsLower) || qsLower.includes(dsLower);
          });
          
          if (!matchesQuizOption && productsWithMismatchedStyle.length < 20) {
            productsWithMismatchedStyle.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              designStyle: product.designStyle
            });
          }
        });
      }
    });

    const styleProductValues = Array.from(styleValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const unmappedStyles = Array.from(styleValues.keys())
      .filter(val => !QUIZ_STYLES.some(qs => {
        const qsLower = qs.toLowerCase();
        const valLower = val.toLowerCase();
        return valLower.includes(qsLower) || qsLower.includes(valLower);
      }));

    // Analyze features
    const featureValues = new Map<string, number>();
    let productsWithFeatures = 0;

    allProducts.forEach((product: any) => { // Explicitly type product
      if (product.keyFeatures && product.keyFeatures.length > 0) {
        productsWithFeatures++;
        product.keyFeatures.forEach((kf: string) => { // Explicitly type kf
          featureValues.set(kf, (featureValues.get(kf) || 0) + 1);
        });
      }
    });

    const featureProductValues = Array.from(featureValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // Analyze colors
    const colorValues = new Map<string, number>();
    let productsWithColors = 0;

    allProducts.forEach((product: any) => { // Explicitly type product
      if (product.colors && product.colors.length > 0) {
        productsWithColors++;
        product.colors.forEach((c: string) => { // Explicitly type c
          colorValues.set(c, (colorValues.get(c) || 0) + 1);
        });
      }
    });

    const topColors = Array.from(colorValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    // Calculate coverage percentages
    const totalProducts = allProducts.length;
    const roomTypeCoverage = Math.round((productsWithRoomType / totalProducts) * 100);
    const styleCoverage = Math.round((productsWithStyle / totalProducts) * 100);
    const featureCoverage = Math.round((productsWithFeatures / totalProducts) * 100);

    // Gap analysis
    const productsWithoutRoomType = totalProducts - productsWithRoomType;
    const productsWithoutStyle = totalProducts - productsWithStyle;
    const productsWithoutFeatures = totalProducts - productsWithFeatures;
    const productsWithoutColors = totalProducts - productsWithColors;

    // Run new analyses
    const colorPalettesAnalysis = analyzeColorPalettes(allProducts);
    const compositionAnalysis = analyzeRoomComposition(allProducts);
    const filterOptimization = analyzeFilterOptimization(allProducts);

    // Generate actionable recommendations
    const actionableRecommendations = {
      acquisition: [
        ...compositionAnalysis.deficits,
        ...filterOptimization.recommendations
      ].slice(0, 10),
      dataQuality: [
        productsWithoutRoomType > 0 ? `Fix room type for ${productsWithoutRoomType} products` : null,
        productsWithoutStyle > 0 ? `Add design style to ${productsWithoutStyle} products` : null,
        productsWithoutColors > 0 ? `Add color data to ${productsWithoutColors} products for better palette matching` : null,
        compositionAnalysis.uncategorized > 0 ? `Categorize ${compositionAnalysis.uncategorized} products into functional categories` : null,
        ...colorPalettesAnalysis.recommendations
      ].filter(Boolean).slice(0, 10),
      bestFilters: filterOptimization.bestCombinations.map(c => 
        `${c.roomType} × ${c.style} (${c.productCount} products)`
      ).slice(0, 5)
    };

    const analysis = {
      roomTypes: {
        quizOptions: QUIZ_ROOM_TYPES,
        productValues: roomTypeProductValues,
        coverage: roomTypeCoverage,
        unmapped: unmappedRoomTypes
      },
      styles: {
        quizOptions: QUIZ_STYLES,
        productValues: styleProductValues,
        coverage: styleCoverage,
        unmapped: unmappedStyles
      },
      features: {
        quizOptions: QUIZ_FEATURES,
        productValues: featureProductValues,
        coverage: featureCoverage,
        unmapped: []
      },
      colors: {
        quizOptions: [],
        productValues: topColors,
        topColors: topColors
      },
      colorPalettes: {
        quizOptions: QUIZ_COLOR_PALETTES,
        paletteCoverage: colorPalettesAnalysis.paletteCoverage,
        lowCoveragePalettes: colorPalettesAnalysis.lowCoveragePalettes
      },
      composition: {
        categoryBreakdown: compositionAnalysis.categoryBreakdown,
        roomCompositionNeeds: compositionAnalysis.roomCompositionNeeds,
        uncategorized: compositionAnalysis.uncategorized
      },
      filterOptimization: {
        bestCombinations: filterOptimization.bestCombinations,
        weakCombinations: filterOptimization.weakCombinations,
        roomTypeCoverage: filterOptimization.roomTypeCoverage,
        styleCoverage: filterOptimization.styleCoverage
      },
      summary: {
        totalProducts,
        productsWithRoomType,
        productsWithStyle,
        productsWithFeatures,
        productsWithColors,
        avgMatchScore: Math.round((roomTypeCoverage + styleCoverage + featureCoverage) / 3)
      },
      gaps: {
        productsWithoutRoomType,
        productsWithoutStyle,
        productsWithoutFeatures,
        productsWithoutColors,
        productsWithMismatchedRoomType: productsWithMismatchedRoomType.slice(0, 10),
        productsWithMismatchedStyle: productsWithMismatchedStyle.slice(0, 10)
      },
      recommendations: actionableRecommendations
    };

    res.json(analysis);
  } catch (error: any) {
    console.error("Error generating mapping analysis:", error);
    res.status(500).json({ error: error.message });
  }
});


/**
 * POST /api/admin/mapping-analysis/normalize-room-types
 * Normalizes room type capitalization to match quiz options
 */
router.post("/mapping-analysis/normalize-room-types", async (req, res) => {
  try {
    const allProducts = await getDb().select().from(products);
    
    // Mapping of variations to standardized values
    const roomTypeMapping: Record<string, string> = {
      'living room': 'Living Room',
      'bedroom': 'Bedroom',
      'dining room': 'Dining Room',
      'home office': 'Office',
      'office': 'Office',
      'kitchen': 'Kitchen',
      'entry': 'Entryway',
      'entryway': 'Entryway',
      'nursery': 'Nursery',
      'outdoor': 'Outdoor'
    };

    let updatedCount = 0;

    for (const product of allProducts) {
      if (product.roomType && product.roomType.length > 0) {
        const normalizedRoomTypes = product.roomType.map((rt: string) => { // Explicitly type rt
          const normalized = roomTypeMapping[rt.toLowerCase()];
          return normalized || rt;
        });

        // Check if any changes were made
        const hasChanges = normalizedRoomTypes.some((nrt, idx) => 
          nrt !== product.roomType![idx]
        );

        if (hasChanges) {
          await getDb().update(products)
            .set({ roomType: normalizedRoomTypes })
            .where(sql`id = ${product.id}`);
          updatedCount++;
        }
      }
    }

    res.json({ 
      success: true, 
      updatedCount,
      message: `Normalized room types for ${updatedCount} products` 
    });
  } catch (error: any) {
    console.error("Error normalizing room types:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/mapping-analysis/normalize-design-styles
 * Maps product design styles to quiz options
 */
router.post("/mapping-analysis/normalize-design-styles", async (req, res) => {
  try {
    const allProducts = await getDb().select().from(products);
    
    // Mapping of product styles to quiz options
    const styleMapping: Record<string, string[]> = {
      'organic modern': ['Organic Modern'],
      'modern farmhouse': ['Modern', 'Traditional'],
      'mid-century scandi': ['Midcentury', 'Scandinavian'],
      'contemporary lux': ['Modern'],
      'warm transitional': ['Traditional'],
      'artful eclectic': ['Bohemian']
    };

    let updatedCount = 0;

    for (const product of allProducts) {
      if (product.designStyle && product.designStyle.length > 0) {
        const expandedStyles = new Set<string>();
        
        product.designStyle.forEach((ds: string) => { // Explicitly type ds
          const dsLower = ds.toLowerCase();
          const mappedStyles = styleMapping[dsLower];
          
          if (mappedStyles) {
            mappedStyles.forEach(s => expandedStyles.add(s));
          } else {
            // Keep original if no mapping found
            expandedStyles.add(ds);
          }
        });

        const newStyles = Array.from(expandedStyles);
        
        // Check if changes were made
        if (newStyles.length !== product.designStyle.length || 
            !newStyles.every(s => product.designStyle!.includes(s))) {
          await getDb().update(products)
            .set({ styleTags: newStyles })
            .where(sql`id = ${product.id}`);
          updatedCount++;
        }
      }
    }

    res.json({ 
      success: true, 
      updatedCount,
      message: `Added style tags for ${updatedCount} products (check styleTags field)` 
    });
  } catch (error: any) {
    console.error("Error normalizing design styles:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
