import { curalinaStorage } from '../storage-curalina';
import type { Product, QuizResponse, FunctionalCategory, RoomTemplate, TemplateCategoryRule } from '../../shared/schema';

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
  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  
  // Primary seating detection
  if (text.includes('sofa') || text.includes('couch') || text.includes('sectional') || text.includes('loveseat')) {
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

interface CompositionResult {
  selectedProducts: Product[];
  composition: Record<string, Product[]>;
  missingEssentials: string[];
  warnings: string[];
}

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
        // Match style
        if (quizResponse.style && product.designStyle?.some(s => 
          s.toLowerCase().includes(quizResponse.style.toLowerCase())
        )) {
          score += 30;
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
      
      // Add some randomness to avoid always picking the same products
      score += Math.random() * 10;
      
      return { product, score };
    });
    
    // Sort by score and select top N
    scoredProducts.sort((a, b) => b.score - a.score);
    const selected = scoredProducts.slice(0, toSelect).map(s => s.product);
    
    for (const product of selected) {
      if (selectedProducts.length >= maxProducts) break;
      selectedProducts.push(product);
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
  
  return {
    selectedProducts,
    composition,
    missingEssentials,
    warnings
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