import type { QuizResponse, Product } from "@shared/schema";

/**
 * Budget Allocation + Product Scoring Engine
 * 
 * This service handles smart budget distribution across furniture categories
 * based on room type, ensuring products are selected within budget constraints.
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export type RoomType = "Living Room" | "Bedroom" | "Dining Room" | "Home Office";

export type BudgetRange = "budget" | "moderate" | "premium" | "luxury";

export interface CategoryWeight {
  category: string;
  baseWeight: number; // Percentage (0-1) of total budget
  priority: "essential" | "high" | "medium" | "optional";
  description: string;
}

export interface CategoryBudget {
  category: string;
  allocatedBudget: number; // Dollar amount
  priority: "essential" | "high" | "medium" | "optional";
  minBudget?: number; // Minimum to spend in this category
  maxBudget?: number; // Maximum to spend in this category
}

export interface BudgetAllocation {
  totalBudget: number;
  categoryBudgets: CategoryBudget[];
  flexiblePool: number; // Unallocated budget for flexibility
}

// ============================================
// BUDGET RANGE TO NUMERIC MAPPING
// ============================================

/**
 * Convert budget range string to numeric working budget
 * Uses the upper bound of each range for better product selection
 */
export function budgetRangeToNumeric(budgetRange: string): number {
  const normalized = budgetRange.toLowerCase();
  
  switch (normalized) {
    case "budget":
      return 5000; // Under $5,000 → use $5,000
    case "moderate":
      return 15000; // $5,000 - $15,000 → use $15,000
    case "premium":
      return 30000; // $15,000 - $30,000 → use $30,000
    case "luxury":
      return 50000; // $30,000+ → use $50,000 (configurable ceiling)
    default:
      console.warn(`Unknown budget range: ${budgetRange}, defaulting to $15,000`);
      return 15000; // Safe default
  }
}

// ============================================
// ROOM-SPECIFIC CATEGORY WEIGHTS
// ============================================

/**
 * Base budget weights per room type
 * These define what percentage of the total budget should go to each category
 */
const BUDGET_WEIGHTS: Record<RoomType, CategoryWeight[]> = {
  "Living Room": [
    {
      category: "Seating",
      baseWeight: 0.35, // 35% - Primary sofa/sectional
      priority: "essential",
      description: "Sofa, sectional, or primary seating"
    },
    {
      category: "Rug",
      baseWeight: 0.15, // 15%
      priority: "high",
      description: "Area rug to anchor the space"
    },
    {
      category: "Tables",
      baseWeight: 0.15, // 15% - Coffee table, side tables
      priority: "high",
      description: "Coffee table and accent tables"
    },
    {
      category: "Accent Chair",
      baseWeight: 0.10, // 10%
      priority: "medium",
      description: "Additional seating and visual interest"
    },
    {
      category: "Lighting",
      baseWeight: 0.08, // 8%
      priority: "medium",
      description: "Floor lamps, table lamps"
    },
    {
      category: "Storage/Decor",
      baseWeight: 0.12, // 12% - Media console, shelving, decor
      priority: "medium",
      description: "Storage solutions and decorative items"
    },
    {
      category: "Flexible",
      baseWeight: 0.05, // 5% - Buffer for adjustments
      priority: "optional",
      description: "Flexible budget for additional items"
    }
  ],

  "Bedroom": [
    {
      category: "Bed",
      baseWeight: 0.35, // 35% - Bed frame
      priority: "essential",
      description: "Bed frame or platform bed"
    },
    {
      category: "Storage",
      baseWeight: 0.25, // 25% - Dresser, nightstands
      priority: "essential",
      description: "Dresser, nightstands, wardrobe"
    },
    {
      category: "Seating",
      baseWeight: 0.10, // 10% - Bench, chair
      priority: "medium",
      description: "Bench, reading chair, or ottoman"
    },
    {
      category: "Rug",
      baseWeight: 0.10, // 10%
      priority: "medium",
      description: "Area rug for comfort and warmth"
    },
    {
      category: "Lighting",
      baseWeight: 0.10, // 10%
      priority: "medium",
      description: "Table lamps, floor lamps"
    },
    {
      category: "Decor",
      baseWeight: 0.05, // 5%
      priority: "optional",
      description: "Mirrors, artwork, accessories"
    },
    {
      category: "Flexible",
      baseWeight: 0.05, // 5%
      priority: "optional",
      description: "Flexible budget for additional items"
    }
  ],

  "Dining Room": [
    {
      category: "Dining Table",
      baseWeight: 0.40, // 40% - Main table
      priority: "essential",
      description: "Dining table"
    },
    {
      category: "Seating",
      baseWeight: 0.35, // 35% - Dining chairs (set of 4-6)
      priority: "essential",
      description: "Dining chairs set"
    },
    {
      category: "Storage",
      baseWeight: 0.12, // 12% - Sideboard, buffet
      priority: "medium",
      description: "Buffet, sideboard, or cabinet"
    },
    {
      category: "Lighting",
      baseWeight: 0.08, // 8%
      priority: "medium",
      description: "Chandelier, pendant lights"
    },
    {
      category: "Rug",
      baseWeight: 0.05, // 5%
      priority: "optional",
      description: "Area rug under dining table"
    }
  ],

  "Home Office": [
    {
      category: "Desk",
      baseWeight: 0.35, // 35% - Work desk
      priority: "essential",
      description: "Work desk or writing table"
    },
    {
      category: "Seating",
      baseWeight: 0.30, // 30% - Office chair
      priority: "essential",
      description: "Ergonomic office chair"
    },
    {
      category: "Storage",
      baseWeight: 0.20, // 20% - Bookcase, filing
      priority: "high",
      description: "Bookcase, filing cabinet, shelving"
    },
    {
      category: "Lighting",
      baseWeight: 0.10, // 10%
      priority: "medium",
      description: "Desk lamp, floor lamp"
    },
    {
      category: "Decor",
      baseWeight: 0.05, // 5%
      priority: "optional",
      description: "Art, plants, organizers"
    }
  ]
};

// ============================================
// BUDGET ALLOCATION FUNCTIONS
// ============================================

/**
 * Calculate category budgets based on room type and total budget
 */
export function calculateBudgetAllocation(
  roomType: string,
  budgetRange: string
): BudgetAllocation {
  const totalBudget = budgetRangeToNumeric(budgetRange);
  const normalizedRoomType = roomType as RoomType;
  
  const weights = BUDGET_WEIGHTS[normalizedRoomType];
  if (!weights) {
    throw new Error(`Unknown room type: ${roomType}`);
  }

  const categoryBudgets: CategoryBudget[] = weights.map(weight => {
    const allocatedBudget = totalBudget * weight.baseWeight;
    
    return {
      category: weight.category,
      allocatedBudget,
      priority: weight.priority,
      // Essential categories should use at least 80% of allocation
      minBudget: weight.priority === "essential" ? allocatedBudget * 0.8 : undefined,
      // Allow 20% overflow for flexibility
      maxBudget: allocatedBudget * 1.2
    };
  });

  // Calculate flexible pool (should be 5% from weights)
  const flexibleCategory = categoryBudgets.find(cb => cb.category === "Flexible");
  const flexiblePool = flexibleCategory?.allocatedBudget || 0;

  return {
    totalBudget,
    categoryBudgets: categoryBudgets.filter(cb => cb.category !== "Flexible"),
    flexiblePool
  };
}

// ============================================
// CATEGORY MATCHING
// ============================================

/**
 * Map product categories to budget allocation categories
 * This handles the mapping between our database categories and budget categories
 */
export function mapProductCategoryToBudgetCategory(
  productCategoryName: string,
  roomType: string
): string | null {
  const normalized = productCategoryName.toLowerCase();
  const normalizedRoom = roomType.toLowerCase();

  // Seating categories
  if (normalized.includes('sofa') || normalized.includes('sectional') || 
      normalized.includes('loveseat')) {
    return "Seating";
  }
  if (normalized.includes('chair')) {
    // Dining chairs for dining room
    if (normalizedRoom.includes('dining')) {
      return "Seating";
    }
    // Office chairs for home office
    if (normalizedRoom.includes('office')) {
      return "Seating";
    }
    // Accent chairs for living room/bedroom
    return "Accent Chair";
  }
  if (normalized.includes('bench') || normalized.includes('ottoman')) {
    return "Seating";
  }

  // Table categories
  if (normalized.includes('coffee table') || normalized.includes('side table') || 
      normalized.includes('end table') || normalized.includes('console table')) {
    return "Tables";
  }
  if (normalized.includes('dining table')) {
    return "Dining Table";
  }
  if (normalized.includes('desk')) {
    return "Desk";
  }

  // Storage categories
  if (normalized.includes('dresser') || normalized.includes('nightstand') ||
      normalized.includes('wardrobe') || normalized.includes('armoire') ||
      normalized.includes('chest')) {
    return "Storage";
  }
  if (normalized.includes('bookcase') || normalized.includes('shelving') ||
      normalized.includes('cabinet') || normalized.includes('storage')) {
    return "Storage";
  }
  if (normalized.includes('sideboard') || normalized.includes('buffet') ||
      normalized.includes('credenza')) {
    return "Storage";
  }

  // Bed categories
  if (normalized.includes('bed')) {
    return "Bed";
  }

  // Rug categories
  if (normalized.includes('rug')) {
    return "Rug";
  }

  // Lighting categories
  if (normalized.includes('lamp') || normalized.includes('lighting') ||
      normalized.includes('chandelier') || normalized.includes('pendant')) {
    return "Lighting";
  }

  // Decor categories
  if (normalized.includes('decor') || normalized.includes('art') ||
      normalized.includes('mirror') || normalized.includes('accessory')) {
    return "Decor";
  }

  // Default to Storage/Decor for unmatched categories
  return "Storage/Decor";
}

// ============================================
// BUDGET FIT SCORING
// ============================================

/**
 * Calculate how well a product fits within the allocated budget for its category
 * Returns a score from 0-1:
 * - 1.0: Perfect fit (within allocated budget)
 * - 0.8-0.9: Slightly over budget but within max budget
 * - 0.5-0.7: Under-allocated (too cheap, might indicate lower quality)
 * - 0.0-0.4: Significantly over budget
 */
export function calculateBudgetFitScore(
  productPrice: number,
  categoryBudget: CategoryBudget | undefined
): number {
  if (!categoryBudget) {
    // No budget allocated for this category - neutral score
    return 0.5;
  }

  const { allocatedBudget, minBudget, maxBudget } = categoryBudget;

  // Perfect fit: within allocated budget
  if (productPrice <= allocatedBudget) {
    // Penalize products that are too cheap (< 50% of budget)
    if (minBudget && productPrice < minBudget) {
      const ratio = productPrice / minBudget;
      return 0.5 + (ratio * 0.3); // Score 0.5-0.8 for under-budget items
    }
    return 1.0; // Perfect fit
  }

  // Acceptable: slightly over allocated but within max budget
  if (maxBudget && productPrice <= maxBudget) {
    const overageRatio = (productPrice - allocatedBudget) / (maxBudget - allocatedBudget);
    return 0.9 - (overageRatio * 0.1); // Score 0.8-0.9 for slightly over
  }

  // Over budget: penalize based on how much over
  const overagePercent = (productPrice - allocatedBudget) / allocatedBudget;
  if (overagePercent < 0.5) {
    return 0.6; // Up to 50% over budget
  } else if (overagePercent < 1.0) {
    return 0.4; // 50-100% over budget
  } else {
    return 0.2; // More than 2x budget
  }
}

// ============================================
// BUDGET-AWARE PRODUCT SCORING
// ============================================

export interface ProductScore {
  sku: string;
  totalScore: number; // 0-100
  categoryMatchScore: number; // 0-40
  styleMatchScore: number; // 0-30
  visualSimilarityScore: number; // 0-20
  budgetFitScore: number; // 0-10 (new)
  breakdown: {
    categoryMatch: number;
    styleMatch: number;
    visualSimilarity: number;
    budgetFit: number;
  };
}


/**
 * Calculate enhanced product score with budget fit
 * Integrates with existing scoring: category (40%), style (30%), visual (20%), budget (10%)
 * 
 * Note: This function requires the category name, not the category ID.
 * If you have a category ID, resolve it to a name first using your category lookup.
 */
export function calculateProductScoreWithBudget(
  product: Product,
  productCategoryName: string, // Category name (e.g., "Sofa"), not ID
  quiz: QuizResponse,
  budgetAllocation: BudgetAllocation,
  categoryMatchScore: number, // 0-40
  styleMatchScore: number, // 0-30
  visualSimilarityScore: number // 0-20
): ProductScore {
  // Map product category to budget category
  const budgetCategory = mapProductCategoryToBudgetCategory(productCategoryName, quiz.roomType);
  const categoryBudget = budgetAllocation.categoryBudgets.find(cb => cb.category === budgetCategory);

  // Calculate budget fit score (0-1) and scale to 0-10
  const productPrice = parseFloat(product.price);
  const budgetFitRatio = calculateBudgetFitScore(productPrice, categoryBudget);
  const budgetFitScore = budgetFitRatio * 10; // Scale to 0-10

  const totalScore = categoryMatchScore + styleMatchScore + visualSimilarityScore + budgetFitScore;

  return {
    sku: product.sku,
    totalScore,
    categoryMatchScore,
    styleMatchScore,
    visualSimilarityScore,
    budgetFitScore,
    breakdown: {
      categoryMatch: categoryMatchScore,
      styleMatch: styleMatchScore,
      visualSimilarity: visualSimilarityScore,
      budgetFit: budgetFitScore
    }
  };
}

/**
 * Validate if selected products fit within total budget
 * 
 * Note: This function requires a category name resolver. 
 * Pass a Map<categoryId, categoryName> as the third parameter.
 */
export function validateBudgetCompliance(
  selectedProducts: Product[],
  budgetAllocation: BudgetAllocation,
  roomType: string,
  categoryMap?: Map<string, string> // Optional: categoryId -> categoryName mapping
): {
  isCompliant: boolean;
  totalCost: number;
  totalBudget: number;
  overageAmount: number;
  overagePercent: number;
  categoryBreakdown: Record<string, { spent: number; allocated: number }>;
} {
  const totalCost = selectedProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);
  const overageAmount = totalCost - budgetAllocation.totalBudget;
  const overagePercent = (overageAmount / budgetAllocation.totalBudget) * 100;

  // Calculate per-category spending
  const categoryBreakdown: Record<string, { spent: number; allocated: number }> = {};
  
  budgetAllocation.categoryBudgets.forEach(cb => {
    categoryBreakdown[cb.category] = {
      spent: 0,
      allocated: cb.allocatedBudget
    };
  });

  // Sum up spending per category
  selectedProducts.forEach(product => {
    // Resolve category ID to name if map provided
    let categoryName = product.categoryId || "";
    if (categoryMap && product.categoryId) {
      categoryName = categoryMap.get(product.categoryId) || categoryName;
    }
    
    const budgetCategory = mapProductCategoryToBudgetCategory(categoryName, roomType);
    if (budgetCategory && categoryBreakdown[budgetCategory]) {
      categoryBreakdown[budgetCategory].spent += parseFloat(product.price);
    }
  });

  return {
    isCompliant: totalCost <= budgetAllocation.totalBudget + budgetAllocation.flexiblePool,
    totalCost,
    totalBudget: budgetAllocation.totalBudget,
    overageAmount,
    overagePercent,
    categoryBreakdown
  };
}
