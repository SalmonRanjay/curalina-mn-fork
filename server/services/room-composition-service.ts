import { curalinaStorage } from '../storage-curalina';
import type { Product, QuizResponse, FunctionalCategory, RoomTemplate, TemplateCategoryRule } from '../../shared/schema';
import { 
  calculateBudgetAllocation, 
  calculateBudgetFitScore,
  mapProductCategoryToBudgetCategory,
  type BudgetAllocation 
} from './budget-allocation';

// Zone-based placement system for natural furniture arrangement
interface ZoneBlueprint {
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number }; // Normalized 0-1 coordinates
  priority: number;
  allowedCategories: string[];
  maxItems: number;
  orientation: 'focal' | 'wall' | 'center' | 'corner';
  clearance: number; // Minimum clearance in normalized units
  adjacentZones?: string[];
  heightTier: 'floor' | 'surface' | 'wall';
}

export interface PlacementInstruction {
  productId: string;
  zoneId: string;
  position: { x: number; y: number };
  orientation: number; // Rotation in degrees
  anchorPoint: 'center' | 'wall' | 'corner';
  spacing: { front: number; sides: number; back: number };
  supportSurface?: string; // For items that need surfaces (table lamps)
  confidence: number; // 0-1 score for placement quality
}

// Room zone configurations for organized layouts
const ROOM_ZONES: Record<string, ZoneBlueprint[]> = {
  'Living Room': [
    {
      id: 'conversation_core',
      name: 'Main Seating Area',
      bounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      priority: 1,
      allowedCategories: ['primary_seating', 'coffee_table', 'accent_seating'],
      maxItems: 4,
      orientation: 'focal',
      clearance: 0.08,
      adjacentZones: ['focal_wall', 'circulation_path'],
      heightTier: 'floor'
    },
    {
      id: 'focal_wall',
      name: 'TV/Fireplace Wall',
      bounds: { x: 0.0, y: 0.35, width: 0.15, height: 0.3 },
      priority: 2,
      allowedCategories: ['storage', 'decor'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'wall'
    },
    {
      id: 'perimeter_left',
      name: 'Left Side Zone',
      bounds: { x: 0.0, y: 0.0, width: 0.2, height: 0.3 },
      priority: 3,
      allowedCategories: ['side_table', 'lighting', 'storage'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    {
      id: 'perimeter_right',
      name: 'Right Side Zone',
      bounds: { x: 0.8, y: 0.0, width: 0.2, height: 1.0 },
      priority: 3,
      allowedCategories: ['accent_seating', 'side_table', 'lighting'],
      maxItems: 2,
      orientation: 'corner',
      clearance: 0.05,
      heightTier: 'floor'
    },
    {
      id: 'circulation_path',
      name: 'Traffic Flow Area',
      bounds: { x: 0.2, y: 0.0, width: 0.6, height: 0.2 },
      priority: 4,
      allowedCategories: [], // Keep clear for movement
      maxItems: 0,
      orientation: 'center',
      clearance: 0.1,
      heightTier: 'floor'
    }
  ],
  'Bedroom': [
    {
      id: 'sleep_zone',
      name: 'Bed Area',
      bounds: { x: 0.25, y: 0.6, width: 0.5, height: 0.35 },
      priority: 1,
      allowedCategories: ['bed', 'nightstand'],
      maxItems: 3,
      orientation: 'wall',
      clearance: 0.08,
      adjacentZones: ['bedside_left', 'bedside_right'],
      heightTier: 'floor'
    },
    {
      id: 'bedside_left',
      name: 'Left Nightstand Zone',
      bounds: { x: 0.05, y: 0.65, width: 0.15, height: 0.25 },
      priority: 2,
      allowedCategories: ['nightstand', 'lighting'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.03,
      heightTier: 'surface'
    },
    {
      id: 'bedside_right',
      name: 'Right Nightstand Zone',
      bounds: { x: 0.8, y: 0.65, width: 0.15, height: 0.25 },
      priority: 2,
      allowedCategories: ['nightstand', 'lighting'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.03,
      heightTier: 'surface'
    },
    {
      id: 'dresser_zone',
      name: 'Dresser/Storage Wall',
      bounds: { x: 0.25, y: 0.05, width: 0.5, height: 0.15 },
      priority: 3,
      allowedCategories: ['dresser', 'storage', 'decor'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    {
      id: 'seating_corner',
      name: 'Reading/Seating Corner',
      bounds: { x: 0.05, y: 0.05, width: 0.15, height: 0.25 },
      priority: 4,
      allowedCategories: ['accent_seating', 'side_table', 'lighting'],
      maxItems: 2,
      orientation: 'corner',
      clearance: 0.05,
      heightTier: 'floor'
    }
  ],
  'Dining Room': [
    {
      id: 'dining_center',
      name: 'Dining Table Zone',
      bounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      priority: 1,
      allowedCategories: ['dining_table', 'dining_seating'],
      maxItems: 9, // Table + 8 chairs
      orientation: 'center',
      clearance: 0.1, // Extra clearance for chairs
      adjacentZones: ['buffet_wall'],
      heightTier: 'floor'
    },
    {
      id: 'buffet_wall',
      name: 'Buffet/Sideboard Wall',
      bounds: { x: 0.1, y: 0.75, width: 0.8, height: 0.15 },
      priority: 2,
      allowedCategories: ['storage', 'decor'],
      maxItems: 3,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    {
      id: 'chandelier_zone',
      name: 'Overhead Lighting Zone',
      bounds: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
      priority: 3,
      allowedCategories: ['lighting'],
      maxItems: 1,
      orientation: 'center',
      clearance: 0.0,
      heightTier: 'wall' // Ceiling mounted
    }
  ],
  'Home Office': [
    {
      id: 'work_zone',
      name: 'Desk Area',
      bounds: { x: 0.25, y: 0.6, width: 0.5, height: 0.3 },
      priority: 1,
      allowedCategories: ['desk', 'office_seating'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.08,
      adjacentZones: ['storage_zone'],
      heightTier: 'floor'
    },
    {
      id: 'storage_zone',
      name: 'Storage/Bookshelf Wall',
      bounds: { x: 0.05, y: 0.2, width: 0.15, height: 0.6 },
      priority: 2,
      allowedCategories: ['storage'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    {
      id: 'meeting_zone',
      name: 'Guest Seating Area',
      bounds: { x: 0.75, y: 0.3, width: 0.2, height: 0.3 },
      priority: 3,
      allowedCategories: ['accent_seating', 'side_table'],
      maxItems: 2,
      orientation: 'corner',
      clearance: 0.05,
      heightTier: 'floor'
    },
    {
      id: 'task_lighting',
      name: 'Task Lighting Zone',
      bounds: { x: 0.3, y: 0.7, width: 0.4, height: 0.1 },
      priority: 4,
      allowedCategories: ['lighting'],
      maxItems: 1,
      orientation: 'focal',
      clearance: 0.0,
      heightTier: 'surface'
    }
  ]
};

// Define room composition templates with essential and complementary items
const ROOM_TEMPLATES = {
  'Living Room': {
    essentials: {
      'primary_seating': { min: 1, max: 1, priority: 1 }, // Must have a sofa
      'coffee_table': { min: 1, max: 1, priority: 2 },
    },
    complementary: {
      'accent_seating': { min: 0, max: 2, priority: 3 }, // Chairs, ottomans
      'side_table': { min: 0, max: 1, priority: 4 },
      'storage': { min: 0, max: 1, priority: 5 }, // Cabinets, shelving
      'lighting': { min: 1, max: 2, priority: 6 }, // Floor lamps, table lamps (reduced from 3)
      'decor': { min: 0, max: 2, priority: 7 }, // Art, plants, accessories
    }
  },
  'Bedroom': {
    essentials: {
      'bed': { min: 1, max: 1, priority: 1 }, // Must have a bed
      'lighting': { min: 1, max: 2, priority: 2 }, // Bedside lamps
    },
    complementary: {
      'nightstand': { min: 1, max: 2, priority: 3 },
      'dresser': { min: 0, max: 1, priority: 4 },
      'accent_seating': { min: 0, max: 1, priority: 5 }, // Bench or chair
      'storage': { min: 0, max: 1, priority: 6 }, // Wardrobe
      'decor': { min: 0, max: 2, priority: 7 },
    }
  },
  'Dining Room': {
    essentials: {
      'dining_table': { min: 1, max: 1, priority: 1 }, // Must have dining table
      'dining_seating': { min: 4, max: 8, priority: 2 }, // Dining chairs
    },
    complementary: {
      'storage': { min: 0, max: 1, priority: 3 }, // Buffet, sideboard
      'lighting': { min: 1, max: 1, priority: 4 }, // Chandelier or pendant
      'decor': { min: 0, max: 2, priority: 5 },
    }
  },
  'Home Office': {
    essentials: {
      'desk': { min: 1, max: 1, priority: 1 }, // Must have desk
      'office_seating': { min: 1, max: 1, priority: 2 }, // Office chair
    },
    complementary: {
      'storage': { min: 1, max: 2, priority: 3 }, // Bookshelf, filing cabinet
      'lighting': { min: 1, max: 2, priority: 4 }, // Desk lamp
      'accent_seating': { min: 0, max: 1, priority: 5 }, // Guest chair
      'decor': { min: 0, max: 2, priority: 6 },
    }
  }
};

// Map product categories to functional categories
const CATEGORY_TO_FUNCTIONAL: Record<string, string[]> = {
  'Sofas': ['primary_seating'],
  'Sofas & Sectionals': ['primary_seating'],
  'Sectionals': ['primary_seating'],
  'Chairs': ['accent_seating'],
  'Accent Chairs': ['accent_seating'],
  'Armchairs': ['accent_seating'],
  'Ottomans': ['accent_seating'],
  'Benches': ['accent_seating', 'bedroom_seating'],
  'Coffee Tables': ['coffee_table'],
  'Side Tables': ['side_table'],
  'End Tables': ['side_table'],
  'Console Tables': ['storage', 'decor'],
  'Cabinets': ['storage'],
  'Sideboards': ['storage'],
  'Bookcases': ['storage'],
  'Shelving': ['storage'],
  'Dressers': ['dresser', 'storage'],
  'Nightstands': ['nightstand'],
  'Beds': ['bed'],
  'Dining Tables': ['dining_table'],
  'Dining Chairs': ['dining_seating'],
  'Desks': ['desk'],
  'Office Chairs': ['office_seating'],
  'Table Lamps': ['lighting'],
  'Floor Lamps': ['lighting'],
  'Pendant Lights': ['lighting'],
  'Chandeliers': ['lighting'],
  'Wall Art': ['decor'],
  'Mirrors': ['decor'],
  'Rugs': ['decor'],
  'Vases': ['decor'],
};

// Detect functional category from product name and description
function detectFunctionalCategory(product: Product): string[] {
  const categories: Set<string> = new Set();
  
  // Check explicit category mapping
  if (product.categoryId) {
    const categoryName = product.categoryId; // This would need category lookup
    const mapped = CATEGORY_TO_FUNCTIONAL[categoryName];
    if (mapped) {
      mapped.forEach(cat => categories.add(cat));
    }
  }
  
  // Analyze product name and description
  const productName = product.name.toLowerCase();
  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  
  // Primary seating detection - STRICT: only check product name and exclude ottomans/benches/stools
  // This prevents "pairs with sofa" descriptions from misclassifying accent pieces
  const isPrimarySeatingExcluded = productName.includes('ottoman') || 
                                    productName.includes('bench') || 
                                    productName.includes('stool') || 
                                    productName.includes('pouf');
  
  if (!isPrimarySeatingExcluded && 
      (productName.includes('sofa') || productName.includes('couch') || 
       productName.includes('sectional') || productName.includes('loveseat'))) {
    categories.add('primary_seating');
  }
  
  // Bed detection
  if (text.includes('bed') && !text.includes('bedside') && !text.includes('bedroom')) {
    categories.add('bed');
  }
  
  // Table detection
  if (text.includes('coffee table')) {
    categories.add('coffee_table');
  } else if (text.includes('dining table')) {
    categories.add('dining_table');
  } else if (text.includes('side table') || text.includes('end table') || text.includes('accent table')) {
    categories.add('side_table');
  } else if (text.includes('nightstand') || text.includes('bedside table')) {
    categories.add('nightstand');
  } else if (text.includes('desk') && !text.includes('desktop')) {
    categories.add('desk');
  }
  
  // Seating detection
  if (text.includes('chair') && !text.includes('armchair')) {
    if (text.includes('dining')) {
      categories.add('dining_seating');
    } else if (text.includes('office') || text.includes('desk')) {
      categories.add('office_seating');
    } else {
      categories.add('accent_seating');
    }
  }
  if (text.includes('armchair') || text.includes('accent chair') || text.includes('ottoman') || text.includes('pouf')) {
    categories.add('accent_seating');
  }
  if (text.includes('bench')) {
    categories.add('accent_seating');
  }
  
  // Storage detection
  if (text.includes('cabinet') || text.includes('sideboard') || text.includes('buffet') || 
      text.includes('bookcase') || text.includes('shelf') || text.includes('shelving') ||
      text.includes('dresser') || text.includes('wardrobe') || text.includes('armoire')) {
    categories.add('storage');
  }
  
  // Lighting detection
  if (text.includes('lamp') || text.includes('light') || text.includes('chandelier') || 
      text.includes('pendant') || text.includes('sconce')) {
    categories.add('lighting');
  }
  
  // Decor detection
  if (text.includes('art') || text.includes('mirror') || text.includes('vase') || 
      text.includes('rug') || text.includes('pillow') || text.includes('throw') ||
      text.includes('plant') || text.includes('decor')) {
    categories.add('decor');
  }
  
  return Array.from(categories);
}

/**
 * Detect lighting type from product name/description
 */
function detectLightingType(product: Product): 'floor' | 'table' | 'ceiling' | 'wall' | null {
  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  
  if (text.includes('floor lamp') || text.includes('standing lamp')) {
    return 'floor';
  } else if (text.includes('table lamp') || text.includes('desk lamp') || text.includes('bedside lamp')) {
    return 'table';
  } else if (text.includes('chandelier') || text.includes('pendant') || text.includes('ceiling')) {
    return 'ceiling';
  } else if (text.includes('sconce') || text.includes('wall lamp')) {
    return 'wall';
  }
  return null;
}

/**
 * Assign products to room zones based on functional categories and zone rules
 */
function assignItemsToZones(
  roomType: string,
  selectedProducts: Product[],
  composition: Record<string, Product[]>
): PlacementInstruction[] {
  const zones = ROOM_ZONES[roomType];
  if (!zones) return [];
  
  const placements: PlacementInstruction[] = [];
  const zoneOccupancy: Record<string, number> = {};
  const floorLampCount = { total: 0, perZone: {} as Record<string, number> };
  
  // Initialize zone occupancy tracking
  zones.forEach(zone => {
    zoneOccupancy[zone.id] = 0;
    floorLampCount.perZone[zone.id] = 0;
  });
  
  // Sort products by priority (essentials first)
  const sortedProducts = [...selectedProducts].sort((a, b) => {
    const aCats = detectFunctionalCategory(a);
    const bCats = detectFunctionalCategory(b);
    
    // Check if essential (from room template)
    const template = ROOM_TEMPLATES[roomType as keyof typeof ROOM_TEMPLATES];
    const aEssential = aCats.some(cat => template?.essentials?.[cat as keyof typeof template.essentials]);
    const bEssential = bCats.some(cat => template?.essentials?.[cat as keyof typeof template.essentials]);
    
    if (aEssential && !bEssential) return -1;
    if (!aEssential && bEssential) return 1;
    return 0;
  });
  
  // Assign each product to best available zone
  for (const product of sortedProducts) {
    const categories = detectFunctionalCategory(product);
    if (categories.length === 0) continue;
    
    let bestZone: ZoneBlueprint | null = null;
    let bestScore = -1;
    
    // Special handling for lighting to prevent multiple floor lamps
    if (categories.includes('lighting')) {
      const lightType = detectLightingType(product);
      
      // Strict floor lamp limiting
      if (lightType === 'floor') {
        if (floorLampCount.total >= 1) {
          console.log(`Skipping floor lamp "${product.name}" - already have maximum floor lamps`);
          continue; // Skip this floor lamp entirely
        }
      }
    }
    
    // Find best zone for this product
    for (const zone of zones) {
      // Check if zone allows any of product's categories
      const canFit = categories.some(cat => zone.allowedCategories.includes(cat));
      if (!canFit) continue;
      
      // Check zone capacity
      if (zoneOccupancy[zone.id] >= zone.maxItems) continue;
      
      // Special checks for lighting placement
      if (categories.includes('lighting')) {
        const lightType = detectLightingType(product);
        
        // Table lamps only in zones with surfaces
        if (lightType === 'table' && zone.heightTier !== 'surface') continue;
        
        // Ceiling lights only in ceiling zones
        if (lightType === 'ceiling' && zone.heightTier !== 'wall') continue;
        
        // Floor lamps - check zone limit
        if (lightType === 'floor' && floorLampCount.perZone[zone.id] >= 1) continue;
      }
      
      // Calculate zone fitness score
      let score = 100 - (zone.priority * 10); // Prioritize higher priority zones
      
      // Bonus for matching orientation preferences
      if (zone.orientation === 'wall' && product.name.toLowerCase().includes('wall')) score += 20;
      if (zone.orientation === 'center' && categories.includes('coffee_table')) score += 20;
      if (zone.orientation === 'focal' && categories.includes('primary_seating')) score += 30;
      
      // Penalty for zone congestion
      score -= (zoneOccupancy[zone.id] * 15);
      
      if (score > bestScore) {
        bestScore = score;
        bestZone = zone;
      }
    }
    
    if (bestZone) {
      // Calculate position within zone
      const position = {
        x: bestZone.bounds.x + (bestZone.bounds.width * 0.5),
        y: bestZone.bounds.y + (bestZone.bounds.height * 0.5)
      };
      
      // Adjust position based on zone occupancy for spacing
      if (zoneOccupancy[bestZone.id] > 0) {
        const offset = (zoneOccupancy[bestZone.id] / bestZone.maxItems) * 0.3;
        position.x += offset * bestZone.bounds.width;
      }
      
      // Determine orientation based on zone type
      let orientation = 0;
      if (bestZone.orientation === 'focal') {
        orientation = 0; // Face forward
      } else if (bestZone.orientation === 'wall') {
        orientation = 180; // Against wall
      } else if (bestZone.orientation === 'corner') {
        orientation = 45; // Diagonal
      }
      
      // Calculate spacing based on product type and zone clearance
      const spacing = {
        front: bestZone.clearance * 1.5,
        sides: bestZone.clearance,
        back: bestZone.clearance * 0.5
      };
      
      // Determine support surface for table lamps
      let supportSurface: string | undefined;
      if (categories.includes('lighting') && detectLightingType(product) === 'table') {
        // Find a surface in the same zone
        const surfaceProducts = placements.filter(p => 
          p.zoneId === bestZone.id && 
          ['side_table', 'nightstand', 'dresser'].some(cat => 
            detectFunctionalCategory(sortedProducts.find(sp => sp.id === p.productId) || {} as Product).includes(cat)
          )
        );
        if (surfaceProducts.length > 0) {
          supportSurface = surfaceProducts[0].productId;
        }
      }
      
      // Calculate confidence based on fit quality
      const confidence = Math.max(0, Math.min(1, bestScore / 100));
      
      placements.push({
        productId: product.id,
        zoneId: bestZone.id,
        position,
        orientation,
        anchorPoint: bestZone.orientation === 'wall' ? 'wall' : 
                     bestZone.orientation === 'corner' ? 'corner' : 'center',
        spacing,
        supportSurface,
        confidence
      });
      
      zoneOccupancy[bestZone.id]++;
      
      // Track floor lamp placement
      if (categories.includes('lighting') && detectLightingType(product) === 'floor') {
        floorLampCount.total++;
        floorLampCount.perZone[bestZone.id]++;
      }
    } else {
      console.warn(`Could not find suitable zone for product: ${product.name}`);
    }
  }
  
  return placements;
}

interface CompositionResult {
  selectedProducts: Product[];
  composition: Record<string, Product[]>;
  missingEssentials: string[];
  warnings: string[];
  placements?: PlacementInstruction[]; // New: zone-based placement instructions
}

/**
 * Categories that need matching sets (same product repeated)
 * For these, select the BEST product and replicate it instead of diversifying
 */
const SET_CATEGORIES = new Set([
  'dining_seating',    // Dining chairs - need matching set
  'office_seating',    // Office chairs - need matching set
  'bedroom_seating',   // Bedroom chairs - need matching set
  'accent_seating_set' // Accent chair sets
]);

/**
 * Select products intelligently based on room template and composition rules
 */
export async function selectProductsWithComposition(
  roomType: string,
  candidateProducts: Product[],
  quizResponse?: QuizResponse,
  maxProducts: number = 15
): Promise<CompositionResult> {
  const template = ROOM_TEMPLATES[roomType as keyof typeof ROOM_TEMPLATES];
  if (!template) {
    // Fallback: return diverse selection if no template
    return {
      selectedProducts: candidateProducts.slice(0, maxProducts),
      composition: {},
      missingEssentials: [],
      warnings: ['No room template defined for ' + roomType]
    };
  }
  
  // Calculate budget allocation if quiz response is provided
  let budgetAllocation: BudgetAllocation | null = null;
  if (quizResponse?.budgetRange) {
    try {
      budgetAllocation = calculateBudgetAllocation(roomType, quizResponse.budgetRange);
      console.log(`💰 Budget allocation for ${roomType}:`, {
        total: budgetAllocation.totalBudget,
        categories: budgetAllocation.categoryBudgets.map(cb => ({
          category: cb.category,
          allocated: cb.allocatedBudget,
          priority: cb.priority
        }))
      });
    } catch (error) {
      console.warn(`Failed to calculate budget allocation: ${error}`);
    }
  }
  
  // Fetch category information for products to enable budget mapping
  const categoryMap = new Map<string, string>();
  const categories = await curalinaStorage.getAllCategories();
  categories.forEach(cat => {
    categoryMap.set(cat.id, cat.name);
  });
  
  // Categorize all candidate products
  const productsByCategory: Record<string, Product[]> = {};
  const uncategorized: Product[] = [];
  
  for (const product of candidateProducts) {
    const categories = detectFunctionalCategory(product);
    if (categories.length === 0) {
      uncategorized.push(product);
    } else {
      for (const category of categories) {
        if (!productsByCategory[category]) {
          productsByCategory[category] = [];
        }
        productsByCategory[category].push(product);
      }
    }
  }
  
  const selectedProducts: Product[] = [];
  const composition: Record<string, Product[]> = {};
  const missingEssentials: string[] = [];
  const warnings: string[] = [];
  const usedProductIds = new Set<string>();
  
  // First pass: Select essential items
  const allRules = { ...template.essentials, ...template.complementary };
  const sortedCategories = Object.entries(allRules).sort((a, b) => a[1].priority - b[1].priority);
  
  for (const [category, rule] of sortedCategories) {
    const isEssential = (template.essentials as any)[category] !== undefined;
    const availableProducts = (productsByCategory[category] || [])
      .filter(p => !usedProductIds.has(p.id));
    
    if (availableProducts.length === 0) {
      if (isEssential && rule.min > 0) {
        missingEssentials.push(category);
        warnings.push(`Missing essential item: ${category}`);
      }
      continue;
    }
    
    // Determine how many to select
    const targetCount = isEssential ? 
      Math.max(rule.min, 1) : // At least min for essentials
      Math.min(rule.max, Math.max(1, Math.floor(availableProducts.length / 2))); // Be conservative with complementary
    
    const toSelect = Math.min(targetCount, rule.max, availableProducts.length);
    
    // Score and rank products for this category
    const scoredProducts = availableProducts.map(product => {
      let score = 100;
      
      // Prefer products with better visual descriptions
      if (product.visualDescriptionFrontView) score += 20;
      if (product.synthesizedFrontView) score += 15;
      if (product.visualDescriptionGemini) score += 10;
      
      // Match quiz preferences if available
      if (quizResponse) {
        // Match styles
        if (quizResponse.styles && quizResponse.styles.length > 0 && product.designStyle) {
          const hasStyleMatch = quizResponse.styles.some(quizStyle =>
            product.designStyle?.some(s => 
              s.toLowerCase().includes(quizStyle.toLowerCase()) ||
              quizStyle.toLowerCase().includes(s.toLowerCase())
            )
          );
          if (hasStyleMatch) score += 30;
        }
        
        // Match colors
        if (quizResponse.colorPalettes && product.colors) {
          const hasMatchingColor = quizResponse.colorPalettes.some(palette =>
            product.colors?.some(color => 
              palette.toLowerCase().includes(color.toLowerCase()) ||
              color.toLowerCase().includes(palette.toLowerCase())
            )
          );
          if (hasMatchingColor) score += 20;
        }
      }
      
      // Budget fit scoring (NEW)
      if (budgetAllocation && product.categoryId) {
        const productCategoryName = categoryMap.get(product.categoryId);
        
        if (productCategoryName) {
          const budgetCategory = mapProductCategoryToBudgetCategory(productCategoryName, roomType);
          const categoryBudget = budgetAllocation.categoryBudgets.find(cb => cb.category === budgetCategory);
          
          if (categoryBudget) {
            const productPrice = parseFloat(product.price);
            const budgetFitRatio = calculateBudgetFitScore(productPrice, categoryBudget);
            // Budget fit contributes up to 30 points (significant weight)
            const budgetFitPoints = budgetFitRatio * 30;
            score += budgetFitPoints;
            
            // Log budget scoring for debugging
            console.log(`💰 Budget fit for ${product.name}: $${productPrice} → ${budgetCategory} (allocated: $${categoryBudget.allocatedBudget.toFixed(0)}) → ${budgetFitPoints.toFixed(1)} pts (${budgetFitRatio.toFixed(2)})`);
          } else {
            console.log(`⚠️ No budget category found for ${productCategoryName} → ${budgetCategory || 'null'}`);
          }
        } else {
          console.log(`⚠️ No category name found for product ${product.name} (categoryId: ${product.categoryId})`);
        }
      }
      
      // NO randomness for set categories - we want consistent matching sets
      // For other categories, add randomness to avoid always picking the same products
      if (!SET_CATEGORIES.has(category)) {
        score += Math.random() * 10;
      }
      
      return { product, score };
    });
    
    // Sort by score
    scoredProducts.sort((a, b) => b.score - a.score);
    
    // For SET categories: pick the best product and replicate it
    // For other categories: pick different products
    let selected: Product[] = [];
    
    if (SET_CATEGORIES.has(category)) {
      // Pick the BEST product and replicate it 'toSelect' times
      if (scoredProducts.length > 0) {
        const bestProduct = scoredProducts[0].product;
        selected = Array(toSelect).fill(bestProduct);
        console.log(`✅ SET: Selected "${bestProduct.name}" x${toSelect} for matching ${category}`);
      }
    } else {
      // Pick different products (original behavior)
      selected = scoredProducts.slice(0, toSelect).map(s => s.product);
    }
    
    for (const product of selected) {
      if (selectedProducts.length >= maxProducts) break;
      selectedProducts.push(product);
      
      // Only mark as used once per unique product
      usedProductIds.add(product.id);
      
      if (!composition[category]) {
        composition[category] = [];
      }
      composition[category].push(product);
    }
    
    // Check if we met minimum requirements
    if (isEssential && selected.length < rule.min) {
      warnings.push(`Only found ${selected.length} of ${rule.min} required ${category} items`);
    }
  }
  
  // Add some uncategorized items if we have room
  if (selectedProducts.length < maxProducts && uncategorized.length > 0) {
    const remainingSlots = maxProducts - selectedProducts.length;
    const toAdd = uncategorized.slice(0, Math.min(remainingSlots, 3));
    selectedProducts.push(...toAdd);
  }
  
  // Budget compliance validation
  if (budgetAllocation) {
    const totalCost = selectedProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);
    const budgetWithFlex = budgetAllocation.totalBudget + budgetAllocation.flexiblePool;
    
    console.log(`💰 Budget compliance check:`, {
      totalCost: `$${totalCost.toFixed(2)}`,
      budgetLimit: `$${budgetWithFlex.toFixed(2)}`,
      isCompliant: totalCost <= budgetWithFlex,
      overage: totalCost > budgetWithFlex ? `$${(totalCost - budgetWithFlex).toFixed(2)}` : '$0'
    });
    
    // If over budget, remove least essential items until within budget
    if (totalCost > budgetWithFlex) {
      console.warn(`⚠️ Selection exceeds budget by $${(totalCost - budgetWithFlex).toFixed(2)}, removing optional items...`);
      
      // Sort by priority (remove complementary items first)
      const sortedByPriority = [...selectedProducts].map(p => {
        const pCats = detectFunctionalCategory(p);
        const isEssential = pCats.some(cat => (template.essentials as any)[cat]);
        return { product: p, essential: isEssential, price: parseFloat(p.price) };
      }).sort((a, b) => {
        // Sort by essential status first, then by price (remove expensive optional items first)
        if (a.essential === b.essential) return b.price - a.price;
        return a.essential ? 1 : -1;
      });
      
      // Remove products until within budget
      let currentCost = totalCost;
      const toRemove = new Set<string>();
      
      for (const item of sortedByPriority) {
        if (currentCost <= budgetWithFlex) break;
        if (!item.essential) {
          toRemove.add(item.product.id);
          currentCost -= item.price;
          console.log(`  Removing ${item.product.name} ($${item.price.toFixed(2)})`);
        }
      }
      
      // Update selected products
      const filteredProducts = selectedProducts.filter(p => !toRemove.has(p.id));
      selectedProducts.length = 0;
      selectedProducts.push(...filteredProducts);
      
      const finalCost = selectedProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);
      console.log(`✅ After budget adjustment: ${selectedProducts.length} products, total: $${finalCost.toFixed(2)}`);
      
      if (finalCost > budgetWithFlex) {
        warnings.push(`Could not fit selection within budget of $${budgetWithFlex.toFixed(0)} (final cost: $${finalCost.toFixed(0)})`);
      }
    }
  }
  
  // Generate zone-based placements
  const placements = assignItemsToZones(roomType, selectedProducts, composition);
  
  return {
    selectedProducts,
    composition,
    missingEssentials,
    warnings,
    placements
  };
}

/**
 * Generate composition instructions for AI prompt
 */
export function generateCompositionInstructions(
  roomType: string,
  composition: Record<string, Product[]>
): string {
  const instructions: string[] = [];
  
  instructions.push(`Room type: ${roomType}`);
  instructions.push('Product composition for this room:');
  
  // Essential items first
  const template = ROOM_TEMPLATES[roomType as keyof typeof ROOM_TEMPLATES];
  if (template) {
    for (const [category, products] of Object.entries(composition)) {
      if ((template.essentials as any)[category]) {
        const names = products.map(p => `${p.name} (${p.sku})`).join(', ');
        instructions.push(`- ${category} (essential): ${names}`);
      }
    }
    
    // Then complementary items
    for (const [category, products] of Object.entries(composition)) {
      if ((template.complementary as any)?.[category]) {
        const names = products.map(p => `${p.name} (${p.sku})`).join(', ');
        instructions.push(`- ${category}: ${names}`);
      }
    }
  }
  
  instructions.push('\nPlacement guidelines:');
  instructions.push('- Place the primary seating (sofa) as the focal point, typically facing the main view or entertainment center');
  instructions.push('- Position the coffee table in front of the primary seating at an accessible distance');
  instructions.push('- Arrange accent seating to create conversation areas');
  instructions.push('- Place side tables within reach of seating');
  instructions.push('- Distribute lighting to eliminate dark corners');
  instructions.push('- Use storage furniture along walls to maximize floor space');
  instructions.push('- Add decor items last to complement the main furniture arrangement');
  instructions.push('\nIMPORTANT: Include ALL listed products in the render. Do not duplicate any product - each should appear exactly once.');
  
  return instructions.join('\n');
}

/**
 * Validate that a product selection meets room composition requirements
 */
export function validateComposition(
  roomType: string,
  products: Product[]
): { isValid: boolean; issues: string[] } {
  const template = ROOM_TEMPLATES[roomType as keyof typeof ROOM_TEMPLATES];
  if (!template) {
    return { isValid: true, issues: [] };
  }
  
  // Count products by category
  const categoryCounts: Record<string, number> = {};
  for (const product of products) {
    const categories = detectFunctionalCategory(product);
    for (const cat of categories) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  }
  
  const issues: string[] = [];
  
  // Check essential requirements
  for (const [category, rule] of Object.entries(template.essentials)) {
    const count = categoryCounts[category] || 0;
    if (count < rule.min) {
      issues.push(`Missing essential: ${category} (found ${count}, need at least ${rule.min})`);
    }
    if (count > rule.max) {
      issues.push(`Too many ${category} items (found ${count}, maximum ${rule.max})`);
    }
  }
  
  // Check for excessive duplicates in complementary categories
  for (const [category, rule] of Object.entries(template.complementary || {})) {
    const count = categoryCounts[category] || 0;
    if (count > rule.max) {
      issues.push(`Too many ${category} items (found ${count}, maximum ${rule.max})`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Get room template for a room type
 */
export function getRoomTemplate(roomType: string): typeof ROOM_TEMPLATES[keyof typeof ROOM_TEMPLATES] | null {
  return ROOM_TEMPLATES[roomType as keyof typeof ROOM_TEMPLATES] || null;
}

/**
 * Detect functional category from product (exported for ledger system)
 */
export { detectFunctionalCategory };