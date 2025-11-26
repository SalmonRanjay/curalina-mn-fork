import { curalinaStorage } from '../storage-curalina';
import type { Product, QuizResponse, FunctionalCategory, RoomTemplate, TemplateCategoryRule } from '../../shared/schema';
import { 
  calculateBudgetAllocation, 
  calculateBudgetFitScore,
  mapProductCategoryToBudgetCategory,
  type BudgetAllocation 
} from './budget-allocation';

// =============================================================================
// NEW PRIORITIZATION SYSTEM: Space → Fit → Preference → Budget
// =============================================================================
// 1. SPACE ANALYSIS: Extract room structure, dimensions, placement zones
// 2. FIT VALIDATION: Filter products by physical fit BEFORE preference scoring
// 3. STYLE MATCHING: Score remaining products by user preferences
// 4. BUDGET CONSTRAINTS: Apply budget as the LAST filter (preserve quality)
// =============================================================================

// =============================================================================
// PERFORMANCE OPTIMIZATIONS
// =============================================================================

/**
 * CACHE: Fit validation results (product dimensions rarely change)
 * Key format: `${productId}:${zoneId}:${roomDimensionsHash}`
 * Uses per-entry TTL for proper expiration
 */
interface CacheEntry {
  validation: FitValidation;
  timestamp: number;
}
const fitValidationCache = new Map<string, CacheEntry>();
const FIT_CACHE_MAX_SIZE = 5000; // Prevent unbounded growth
const FIT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes per entry
let fitCacheLastCleanup = Date.now();

/**
 * Generate a hash for room dimensions (for cache key)
 */
function hashRoomDimensions(dims?: RoomDimensions): string {
  if (!dims) return 'default';
  return `${dims.width}x${dims.depth}x${dims.ceilingHeight}`;
}

/**
 * Get cached fit validation or compute and cache
 * Uses per-entry TTL for proper expiration with immediate stale entry removal
 */
function getCachedFitValidation(
  product: Product,
  zone: ZoneBlueprint,
  roomDimensions?: RoomDimensions
): FitValidation {
  const cacheKey = `${product.id}:${zone.id}:${hashRoomDimensions(roomDimensions)}`;
  const now = Date.now();
  
  // Check cache first with TTL validation
  const cached = fitValidationCache.get(cacheKey);
  if (cached) {
    if ((now - cached.timestamp) < FIT_CACHE_TTL_MS) {
      return cached.validation;
    }
    // Immediately remove stale entry to guarantee TTL is honored
    fitValidationCache.delete(cacheKey);
  }
  
  // Compute new validation
  const validation = validateProductFitForZoneInternal(product, zone, roomDimensions);
  
  // Periodic bulk cleanup (every 5 minutes or when too large)
  if (fitValidationCache.size > FIT_CACHE_MAX_SIZE || now - fitCacheLastCleanup > 5 * 60 * 1000) {
    // Remove expired entries
    const allEntries = Array.from(fitValidationCache.entries());
    for (const [key, entry] of allEntries) {
      if (now - entry.timestamp > FIT_CACHE_TTL_MS) {
        fitValidationCache.delete(key);
      }
    }
    // If still too large, clear oldest 25%
    if (fitValidationCache.size > FIT_CACHE_MAX_SIZE) {
      const sortedEntries = Array.from(fitValidationCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = Math.floor(sortedEntries.length * 0.25);
      sortedEntries.slice(0, toRemove).forEach(([key]) => fitValidationCache.delete(key));
    }
    fitCacheLastCleanup = now;
  }
  
  fitValidationCache.set(cacheKey, { validation, timestamp: now });
  return validation;
}

/**
 * Clear fit validation cache (call when product dimensions are updated)
 */
export function clearFitValidationCache(): void {
  fitValidationCache.clear();
  console.log('🗑️ Fit validation cache cleared');
}

// =============================================================================
// QUALITY TIER SYSTEM
// =============================================================================
// Products are classified into quality tiers based on price relative to category
// Tier 1: Premium (top 20%) - designer pieces
// Tier 2: Mid-High (60-80%) - quality furniture
// Tier 3: Mid (40-60%) - good value
// Tier 4: Budget (20-40%) - affordable
// Tier 5: Low (bottom 20%) - avoid unless "budget design" mode
// =============================================================================

export type QualityTier = 1 | 2 | 3 | 4 | 5;

/**
 * Classify product into quality tier based on price percentile within category
 * Uses count-based percentile to handle duplicate prices correctly
 */
export function getProductQualityTier(
  product: Product,
  categoryProducts: Product[]
): QualityTier {
  const price = parseFloat(product.price);
  const prices = categoryProducts.map(p => parseFloat(p.price));
  
  if (prices.length === 0) return 3; // Default to mid-tier if no comparison
  
  // Count how many products are cheaper than or equal to this one
  // This gives correct percentile even with duplicate prices
  const countCheaperOrEqual = prices.filter(p => p <= price).length;
  const percentile = (countCheaperOrEqual / prices.length) * 100;
  
  // Higher percentile (more expensive) = higher tier (tier 1 is premium)
  if (percentile >= 80) return 1; // Top 20% = Premium
  if (percentile >= 60) return 2; // 60-80% = Mid-High
  if (percentile >= 40) return 3; // 40-60% = Mid
  if (percentile >= 20) return 4; // 20-40% = Budget
  return 5; // Bottom 20% = Low
}

// =============================================================================
// VISIBILITY IMPACT CLASSIFICATION
// =============================================================================
// When substituting for budget, replace items in order of visual impact:
// 1. LEAST VISIBLE: Small decor, pillows, secondary lighting - barely affects look
// 2. FUNCTIONAL: Coffee tables, rugs, TV stands - moderate visual impact
// 3. ANCHOR PIECES: Sofas, beds, dining tables - defines the room, change last
// =============================================================================

export type VisibilityImpact = 'least_visible' | 'functional' | 'anchor';

const VISIBILITY_IMPACT_MAP: Record<string, VisibilityImpact> = {
  // Anchor pieces - change LAST (defines the room)
  'primary_seating': 'anchor',
  'bed': 'anchor',
  'dining_table': 'anchor',
  'desk': 'anchor',
  
  // Functional pieces - change next (moderate visual impact)
  'accent_seating': 'functional',
  'coffee_table': 'functional',
  'dining_seating': 'functional',
  'rug': 'functional',
  'storage': 'functional',
  'console_table': 'functional',
  'dresser': 'functional',
  'nightstand': 'functional',
  'office_seating': 'functional',
  
  // Least visible - change FIRST (minimal visual impact)
  'side_table': 'least_visible',
  'lighting': 'least_visible',
  'decor': 'least_visible',
  'art': 'least_visible',
  'mirrors': 'least_visible',
  'planters': 'least_visible',
  'accessories': 'least_visible',
};

/**
 * Get visibility impact level for a product based on its functional category
 */
export function getVisibilityImpact(product: Product): VisibilityImpact {
  const categories = detectFunctionalCategory(product);
  
  // Use the highest impact category (most conservative)
  for (const cat of categories) {
    if (VISIBILITY_IMPACT_MAP[cat] === 'anchor') return 'anchor';
  }
  for (const cat of categories) {
    if (VISIBILITY_IMPACT_MAP[cat] === 'functional') return 'functional';
  }
  return 'least_visible';
}

/**
 * Visibility impact priority for sorting (lower = substitute first)
 */
export function getVisibilityPriority(impact: VisibilityImpact): number {
  switch (impact) {
    case 'least_visible': return 1;
    case 'functional': return 2;
    case 'anchor': return 3;
  }
}

// =============================================================================
// SMART SUBSTITUTION SYSTEM
// =============================================================================
// Instead of removing items when over budget, find alternatives with:
// - Same style
// - Same/similar color palette
// - Same/similar material
// - Same functional category
// - Lower price
// =============================================================================

interface SubstitutionCandidate {
  product: Product;
  matchScore: number;  // How similar to original (0-100)
  priceDiff: number;   // How much cheaper
  tier: QualityTier;
}

/**
 * Validate that a product has valid images for rendering
 * Products without images will be invisible in renders
 */
function hasValidImages(product: Product): boolean {
  if (!product.images || !Array.isArray(product.images)) return false;
  
  // Check if at least one valid image URL exists
  const validImages = product.images.filter(img => {
    if (!img || typeof img !== 'string') return false;
    const trimmed = img.trim();
    if (trimmed.length === 0) return false;
    
    // Check for valid URL formats
    const isExternalUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const isObjectStorage = trimmed.startsWith('/public-objects/') || trimmed.startsWith('/private-objects/');
    const isS3Path = trimmed.includes('s3.amazonaws.com') || trimmed.includes('curalina');
    
    return isExternalUrl || isObjectStorage || isS3Path;
  });
  
  return validImages.length > 0;
}

/**
 * Find substitution candidates for a product
 * Returns products with same style/color/material but lower price
 * IMPORTANT: Only returns products with valid images for rendering
 */
export function findSubstitutionCandidates(
  original: Product,
  allProducts: Product[],
  usedProductIds: Set<string>,
  minTier: QualityTier = 4 // Don't drop below this tier (4 = budget, avoid 5)
): SubstitutionCandidate[] {
  const originalPrice = parseFloat(original.price);
  const originalCategories = detectFunctionalCategory(original);
  
  // Get category products for tier calculation
  const categoryProducts = allProducts.filter(p => 
    detectFunctionalCategory(p).some(cat => originalCategories.includes(cat))
  );
  
  const candidates: SubstitutionCandidate[] = [];
  
  for (const candidate of allProducts) {
    // Skip same product, already used, or more expensive
    if (candidate.id === original.id) continue;
    if (usedProductIds.has(candidate.id)) continue;
    
    const candidatePrice = parseFloat(candidate.price);
    if (candidatePrice >= originalPrice) continue; // Must be cheaper
    
    // CRITICAL: Skip products without valid images - they won't render!
    if (!hasValidImages(candidate)) {
      continue;
    }
    
    // Must be same functional category
    const candidateCategories = detectFunctionalCategory(candidate);
    const sameFunctionalCategory = originalCategories.some(cat => 
      candidateCategories.includes(cat)
    );
    if (!sameFunctionalCategory) continue;
    
    // Check quality tier
    const tier = getProductQualityTier(candidate, categoryProducts);
    if (tier > minTier) continue; // Skip if below minimum tier
    
    // Calculate match score (style, color, material similarity)
    let matchScore = 0;
    
    // Style match (40 points max)
    if (original.designStyle && candidate.designStyle) {
      const originalStyles = new Set(original.designStyle);
      const matchingStyles = (candidate.designStyle as string[]).filter(s => originalStyles.has(s));
      matchScore += (matchingStyles.length / Math.max(original.designStyle.length, 1)) * 40;
    }
    
    // Color match (30 points max)
    if (original.colors && candidate.colors) {
      const originalColors = new Set(original.colors);
      const matchingColors = (candidate.colors as string[]).filter(c => originalColors.has(c));
      matchScore += (matchingColors.length / Math.max(original.colors.length, 1)) * 30;
    }
    
    // Material match (30 points max)
    if (original.materials && candidate.materials) {
      const originalMaterials = new Set(original.materials);
      const matchingMaterials = (candidate.materials as string[]).filter(m => originalMaterials.has(m));
      matchScore += (matchingMaterials.length / Math.max(original.materials.length, 1)) * 30;
    }
    
    // Only consider candidates with HIGH match (>65%) to maintain visual cohesion
    // Lower matches (40-65%) result in products that look visibly different
    if (matchScore >= 65) {
      candidates.push({
        product: candidate,
        matchScore,
        priceDiff: originalPrice - candidatePrice,
        tier
      });
    }
  }
  
  // Sort by match score (best matches first), then by price savings
  return candidates.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return b.priceDiff - a.priceDiff;
  });
}

/**
 * Room dimensions extracted from user input (image analysis or manual entry)
 */
export interface RoomDimensions {
  width: number;          // in inches
  depth: number;          // in inches
  ceilingHeight: number;  // in inches
  unit: 'inches' | 'feet' | 'cm';
  // Extracted features
  windows?: Array<{ wall: 'front' | 'back' | 'left' | 'right'; width: number; height: number }>;
  doors?: Array<{ wall: 'front' | 'back' | 'left' | 'right'; width: number }>;
  walkways?: Array<{ from: string; to: string; minWidth: number }>;
  openSpaces?: Array<{ x: number; y: number; width: number; depth: number }>;
}

/**
 * Physical fit validation result for a product
 */
export interface FitValidation {
  fits: boolean;
  fitScore: number;       // 0-100, higher = better fit
  issues: string[];       // List of fit issues
  bestZone: string | null; // Zone where product fits best
  orientationOptions: number[]; // Valid rotation angles (degrees)
  clearanceMargin: number; // How much clearance is available (percentage)
}

/**
 * Validate if a product physically fits in a zone
 * Uses product dimensions vs zone bounds with clearance requirements
 * (Internal implementation - use getCachedFitValidation for caching)
 */
function validateProductFitForZoneInternal(
  product: Product,
  zone: ZoneBlueprint,
  roomDimensions?: RoomDimensions
): FitValidation {
  const issues: string[] = [];
  let fitScore = 100;
  let fits = true;
  const orientationOptions: number[] = [0, 90, 180, 270]; // All rotations initially valid
  
  // Extract product dimensions (support both key formats)
  const dims = product.dimensions as any;
  if (!dims) {
    // No dimensions available - assume it fits but with lower confidence
    return {
      fits: true,
      fitScore: 60, // Lower score for unknown dimensions
      issues: ['Product dimensions unknown - assuming fit'],
      bestZone: zone.id,
      orientationOptions: [0, 180],
      clearanceMargin: 0
    };
  }
  
  // Get dimensions, supporting both 'width'/'w' formats
  const productWidth = dims.width || dims.w || 0;
  const productDepth = dims.depth || dims.d || 0;
  const productHeight = dims.height || dims.h || 0;
  const unit = dims.unit || 'inches';
  
  // Convert to inches if needed
  const toInches = (val: number, u: string) => {
    if (u === 'cm') return val / 2.54;
    if (u === 'feet') return val * 12;
    return val;
  };
  
  const widthInches = toInches(productWidth, unit);
  const depthInches = toInches(productDepth, unit);
  const heightInches = toInches(productHeight, unit);
  
  // If room dimensions are provided, validate against actual room size
  if (roomDimensions) {
    const roomWidth = roomDimensions.width;
    const roomDepth = roomDimensions.depth;
    
    // Zone bounds are normalized (0-1), convert to actual inches
    const zoneWidthInches = zone.bounds.width * roomWidth;
    const zoneDepthInches = zone.bounds.height * roomDepth; // height in bounds = depth in room
    const clearanceInches = zone.clearance * Math.min(roomWidth, roomDepth);
    
    // Check if product fits in zone (with required clearance)
    const availableWidth = zoneWidthInches - (clearanceInches * 2);
    const availableDepth = zoneDepthInches - (clearanceInches * 2);
    
    // Standard orientation (width along zone width)
    const fitsStandard = widthInches <= availableWidth && depthInches <= availableDepth;
    // Rotated orientation (width along zone depth)
    const fitsRotated = depthInches <= availableWidth && widthInches <= availableDepth;
    
    if (!fitsStandard && !fitsRotated) {
      fits = false;
      fitScore = 0;
      issues.push(`Product too large for zone: ${widthInches.toFixed(0)}"x${depthInches.toFixed(0)}" > ${availableWidth.toFixed(0)}"x${availableDepth.toFixed(0)}" available`);
    } else if (!fitsStandard) {
      // Only fits when rotated
      fitScore -= 10;
      orientationOptions.splice(0, orientationOptions.length, 90, 270); // Only rotated orientations
      issues.push('Product requires rotation to fit');
    } else if (!fitsRotated) {
      // Only fits in standard orientation
      orientationOptions.splice(0, orientationOptions.length, 0, 180);
    }
    
    // Calculate clearance margin (how much extra space is available)
    const widthMargin = (availableWidth - widthInches) / availableWidth;
    const depthMargin = (availableDepth - depthInches) / availableDepth;
    const clearanceMargin = Math.min(widthMargin, depthMargin);
    
    // Score based on how well product fills zone (not too small, not too tight)
    if (clearanceMargin > 0.5) {
      // Product is much smaller than zone - might look sparse
      fitScore -= 15;
      issues.push('Product may appear small in this zone');
    } else if (clearanceMargin < 0.1 && clearanceMargin > 0) {
      // Very tight fit
      fitScore -= 10;
      issues.push('Tight fit - limited clearance');
    }
    
    // Check ceiling height for tall furniture
    if (heightInches > 0 && roomDimensions.ceilingHeight) {
      const headroom = roomDimensions.ceilingHeight - heightInches;
      if (headroom < 12) {
        fitScore -= 20;
        issues.push('Product nearly touches ceiling');
      } else if (headroom < 24) {
        fitScore -= 5;
        issues.push('Limited headroom above product');
      }
    }
    
    return {
      fits,
      fitScore: Math.max(0, fitScore),
      issues,
      bestZone: fits ? zone.id : null,
      orientationOptions,
      clearanceMargin: Math.max(0, clearanceMargin)
    };
  }
  
  // No room dimensions - use heuristic based on typical room sizes
  // Standard living room ~14x12ft = 168x144 inches
  const typicalRoomWidth = 168;
  const typicalRoomDepth = 144;
  
  const zoneWidthInches = zone.bounds.width * typicalRoomWidth;
  const zoneDepthInches = zone.bounds.height * typicalRoomDepth;
  
  // Check basic fit with generous tolerance (no exact room size)
  if (widthInches > zoneWidthInches * 1.2 || depthInches > zoneDepthInches * 1.2) {
    fitScore -= 30;
    issues.push('Product may be too large for typical room zone');
  }
  
  return {
    fits: true, // Default to fits if no room dimensions
    fitScore: Math.max(0, fitScore),
    issues,
    bestZone: zone.id,
    orientationOptions,
    clearanceMargin: 0.2 // Assumed margin
  };
}

/**
 * Filter products by physical fit for a specific category and room
 * This is the FIRST filter applied before any preference scoring
 */
function filterByPhysicalFit(
  products: Product[],
  roomType: string,
  category: string,
  roomDimensions?: RoomDimensions
): Array<{ product: Product; fitValidation: FitValidation }> {
  const zones = ROOM_ZONES[roomType] || [];
  
  // Find zones that accept this category
  const validZones = zones.filter(z => z.allowedCategories.includes(category));
  
  if (validZones.length === 0) {
    // No specific zones - all products pass fit filter
    return products.map(p => ({
      product: p,
      fitValidation: {
        fits: true,
        fitScore: 70,
        issues: ['No zone constraints for this category'],
        bestZone: null,
        orientationOptions: [0, 180],
        clearanceMargin: 0.3
      }
    }));
  }
  
  const results: Array<{ product: Product; fitValidation: FitValidation }> = [];
  
  for (const product of products) {
    let bestFit: FitValidation | null = null;
    
    // Check product against all valid zones, keep best fit (using cache)
    for (const zone of validZones) {
      const validation = getCachedFitValidation(product, zone, roomDimensions);
      
      if (!bestFit || validation.fitScore > bestFit.fitScore) {
        bestFit = validation;
      }
    }
    
    // Include product if it fits in at least one zone
    if (bestFit && bestFit.fits) {
      results.push({ product, fitValidation: bestFit });
    } else if (bestFit) {
      // Product doesn't fit but log for debugging
      console.log(`🚫 Physical fit BLOCK: ${product.name} - ${bestFit.issues.join(', ')}`);
    }
  }
  
  // Sort by fit score (best fit first)
  results.sort((a, b) => b.fitValidation.fitScore - a.fitValidation.fitScore);
  
  console.log(`📐 Physical fit filter: ${products.length} → ${results.length} products for ${category} in ${roomType}`);
  
  return results;
}

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
// Based on professional interior design floor plans (PDF analysis)
const ROOM_ZONES: Record<string, ZoneBlueprint[]> = {
  'Living Room': [
    // Zone 1: Sofa against wall (anchor piece)
    {
      id: 'sofa_wall',
      name: 'Primary Sofa Wall',
      bounds: { x: 0.15, y: 0.7, width: 0.7, height: 0.25 },
      priority: 1,
      allowedCategories: ['primary_seating'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.08,
      adjacentZones: ['coffee_table_zone', 'flanking_left', 'flanking_right'],
      heightTier: 'floor'
    },
    // Zone 2: Coffee table centered in front of sofa
    {
      id: 'coffee_table_zone',
      name: 'Coffee Table Area',
      bounds: { x: 0.3, y: 0.4, width: 0.4, height: 0.25 },
      priority: 2,
      allowedCategories: ['coffee_table'],
      maxItems: 1,
      orientation: 'center',
      clearance: 0.1, // 18" clearance from sofa
      heightTier: 'floor'
    },
    // Zone 3: Left accent chair (flanking sofa at 90°)
    {
      id: 'flanking_left',
      name: 'Left Accent Seating',
      bounds: { x: 0.08, y: 0.35, width: 0.17, height: 0.35 },  // Pulled inward from x=0.0 to prevent edge clipping
      priority: 3,
      allowedCategories: ['accent_seating'],
      maxItems: 1,
      orientation: 'corner',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 4: Right accent chair (flanking sofa at 90°)
    {
      id: 'flanking_right',
      name: 'Right Accent Seating',
      bounds: { x: 0.7, y: 0.35, width: 0.2, height: 0.35 },  // Pulled inward from x=0.8 to prevent edge clipping
      priority: 3,
      allowedCategories: ['accent_seating'],
      maxItems: 1,
      orientation: 'corner',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 5: Side table adjacent to sofa end (supports table lamps)
    {
      id: 'side_table_zone',
      name: 'Side Table Area',
      bounds: { x: 0.08, y: 0.7, width: 0.12, height: 0.2 },  // Pulled inward from x=0.0 to prevent edge clipping
      priority: 4,
      allowedCategories: ['side_table', 'lighting'], // Table lamps on side tables
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.03,
      heightTier: 'surface' // Surface height for table lamps
    },
    // Zone 6: Console table on LEFT SIDE WALL (visible, NOT behind sofa)
    // Positioned in front area (y: 0.05-0.25) to avoid overlap with flanking_left (y: 0.35+)
    {
      id: 'console_table_zone',
      name: 'Console Table Wall',
      bounds: { x: 0.02, y: 0.05, width: 0.12, height: 0.20 },  // Left side wall, front area - no overlap with other zones
      priority: 5,
      allowedCategories: ['console_table'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 7: Storage/cabinet against opposite wall
    {
      id: 'storage_wall',
      name: 'Storage Cabinet Wall',
      bounds: { x: 0.2, y: 0.0, width: 0.6, height: 0.15 },
      priority: 6,
      allowedCategories: ['storage'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 8: Floor lamp in corner near seating
    {
      id: 'lamp_corner',
      name: 'Floor Lamp Corner',
      bounds: { x: 0.75, y: 0.7, width: 0.15, height: 0.25 },  // Pulled inward from x=0.85 to prevent edge clipping
      priority: 7,
      allowedCategories: ['lighting'],
      maxItems: 1,
      orientation: 'corner',
      clearance: 0.03,
      heightTier: 'floor'
    },
    // Zone 9: Rug under coffee table / seating area decor
    {
      id: 'rug_zone',
      name: 'Area Rug Zone',
      bounds: { x: 0.15, y: 0.3, width: 0.7, height: 0.5 },
      priority: 8,
      allowedCategories: ['decor'], // Rugs, pillows on seating
      maxItems: 1,
      orientation: 'center',
      clearance: 0.0,
      heightTier: 'floor'
    },
    // Zone 10: Wall art above sofa
    {
      id: 'art_wall',
      name: 'Wall Art Zone',
      bounds: { x: 0.3, y: 0.85, width: 0.4, height: 0.15 },
      priority: 9,
      allowedCategories: ['decor'], // Art, tapestry above sofa
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.0,
      heightTier: 'wall'
    }
  ],
  'Bedroom': [
    // Zone 1: Bed centered against headboard wall (anchor piece)
    {
      id: 'bed_zone',
      name: 'Bed Area',
      bounds: { x: 0.25, y: 0.6, width: 0.5, height: 0.35 },
      priority: 1,
      allowedCategories: ['bed'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.08,
      adjacentZones: ['bedside_left', 'bedside_right'],
      heightTier: 'floor'
    },
    // Zone 2: Left nightstand with table lamp
    {
      id: 'bedside_left',
      name: 'Left Nightstand Zone',
      bounds: { x: 0.08, y: 0.65, width: 0.12, height: 0.25 },  // Pulled inward from x=0.05 to prevent edge clipping
      priority: 2,
      allowedCategories: ['nightstand', 'lighting'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.03,
      heightTier: 'surface'
    },
    // Zone 3: Right nightstand with table lamp
    {
      id: 'bedside_right',
      name: 'Right Nightstand Zone',
      bounds: { x: 0.75, y: 0.65, width: 0.15, height: 0.25 },  // Pulled inward from x=0.8 to prevent edge clipping
      priority: 2,
      allowedCategories: ['nightstand', 'lighting'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.03,
      heightTier: 'surface'
    },
    // Zone 4: Dresser/storage opposite bed
    {
      id: 'dresser_zone',
      name: 'Dresser/Storage Wall',
      bounds: { x: 0.25, y: 0.05, width: 0.5, height: 0.15 },
      priority: 3,
      allowedCategories: ['dresser', 'storage'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 5: Reading corner with optional seating
    {
      id: 'seating_corner',
      name: 'Reading/Seating Corner',
      bounds: { x: 0.08, y: 0.08, width: 0.12, height: 0.22 },  // Pulled inward from x=0.05 to prevent edge clipping
      priority: 4,
      allowedCategories: ['accent_seating', 'side_table', 'lighting'],
      maxItems: 2,
      orientation: 'corner',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 6: Area rug under bed extending to seating
    {
      id: 'bedroom_rug',
      name: 'Bedroom Rug Zone',
      bounds: { x: 0.15, y: 0.3, width: 0.7, height: 0.5 },
      priority: 5,
      allowedCategories: ['decor'],
      maxItems: 1,
      orientation: 'center',
      clearance: 0.0,
      heightTier: 'floor'
    },
    // Zone 7: Wall art above headboard
    {
      id: 'headboard_art',
      name: 'Headboard Art Zone',
      bounds: { x: 0.3, y: 0.85, width: 0.4, height: 0.15 },
      priority: 6,
      allowedCategories: ['decor'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.0,
      heightTier: 'wall'
    }
  ],
  'Dining Room': [
    // Zone 1: Dining table centered in room (anchor piece)
    {
      id: 'dining_table_zone',
      name: 'Dining Table Area',
      bounds: { x: 0.25, y: 0.3, width: 0.5, height: 0.4 },
      priority: 1,
      allowedCategories: ['dining_table'],
      maxItems: 1,
      orientation: 'center',
      clearance: 0.1,
      adjacentZones: ['chair_zone'],
      heightTier: 'floor'
    },
    // Zone 2: Dining chairs around table
    {
      id: 'chair_zone',
      name: 'Dining Chairs Zone',
      bounds: { x: 0.15, y: 0.2, width: 0.7, height: 0.6 },
      priority: 2,
      allowedCategories: ['dining_seating'],
      maxItems: 8,
      orientation: 'center',
      clearance: 0.08,
      heightTier: 'floor'
    },
    // Zone 3: Sideboard/buffet against wall
    {
      id: 'buffet_wall',
      name: 'Buffet/Sideboard Wall',
      bounds: { x: 0.1, y: 0.85, width: 0.8, height: 0.15 },
      priority: 3,
      allowedCategories: ['storage'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 4: Chandelier centered over table
    {
      id: 'chandelier_zone',
      name: 'Chandelier Zone',
      bounds: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
      priority: 4,
      allowedCategories: ['lighting'],
      maxItems: 1,
      orientation: 'center',
      clearance: 0.0,
      heightTier: 'wall'
    },
    // Zone 5: Area rug under dining table
    {
      id: 'dining_rug',
      name: 'Dining Rug Zone',
      bounds: { x: 0.1, y: 0.15, width: 0.8, height: 0.7 },
      priority: 5,
      allowedCategories: ['decor'],
      maxItems: 1,
      orientation: 'center',
      clearance: 0.0,
      heightTier: 'floor'
    },
    // Zone 6: Wall art above buffet/sideboard
    {
      id: 'dining_wall_art',
      name: 'Dining Wall Art Zone',
      bounds: { x: 0.25, y: 0.0, width: 0.5, height: 0.12 },
      priority: 6,
      allowedCategories: ['decor'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.0,
      heightTier: 'wall'
    }
  ],
  'Home Office': [
    // Zone 1: Desk against wall (anchor piece)
    {
      id: 'desk_zone',
      name: 'Desk Area',
      bounds: { x: 0.25, y: 0.7, width: 0.5, height: 0.25 },
      priority: 1,
      allowedCategories: ['desk'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.08,
      adjacentZones: ['chair_zone', 'task_lighting'],
      heightTier: 'floor'
    },
    // Zone 2: Office chair at desk
    {
      id: 'office_chair_zone',
      name: 'Office Chair Zone',
      bounds: { x: 0.35, y: 0.5, width: 0.3, height: 0.2 },
      priority: 2,
      allowedCategories: ['office_seating'],
      maxItems: 1,
      orientation: 'focal',
      clearance: 0.1,
      heightTier: 'floor'
    },
    // Zone 3: Storage/bookshelves along wall
    {
      id: 'storage_wall',
      name: 'Storage/Bookshelf Wall',
      bounds: { x: 0.08, y: 0.2, width: 0.12, height: 0.6 },  // Pulled inward from x=0.0 to prevent edge clipping
      priority: 3,
      allowedCategories: ['storage'],
      maxItems: 2,
      orientation: 'wall',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 4: Task lamp on desk surface
    {
      id: 'task_lighting',
      name: 'Task Lighting Zone',
      bounds: { x: 0.6, y: 0.75, width: 0.15, height: 0.15 },
      priority: 4,
      allowedCategories: ['lighting'],
      maxItems: 1,
      orientation: 'focal',
      clearance: 0.0,
      heightTier: 'surface'
    },
    // Zone 5: Guest seating area
    {
      id: 'guest_zone',
      name: 'Guest Seating Area',
      bounds: { x: 0.7, y: 0.3, width: 0.2, height: 0.35 },  // Pulled inward from x=0.75 to prevent edge clipping
      priority: 5,
      allowedCategories: ['accent_seating', 'side_table'],
      maxItems: 2,
      orientation: 'corner',
      clearance: 0.05,
      heightTier: 'floor'
    },
    // Zone 6: Area rug under desk/seating
    {
      id: 'office_rug',
      name: 'Office Rug Zone',
      bounds: { x: 0.15, y: 0.2, width: 0.6, height: 0.6 },
      priority: 6,
      allowedCategories: ['decor'],
      maxItems: 1,
      orientation: 'center',
      clearance: 0.0,
      heightTier: 'floor'
    },
    // Zone 7: Wall art above desk or storage
    {
      id: 'office_wall_art',
      name: 'Office Wall Art Zone',
      bounds: { x: 0.3, y: 0.9, width: 0.4, height: 0.1 },
      priority: 7,
      allowedCategories: ['decor'],
      maxItems: 1,
      orientation: 'wall',
      clearance: 0.0,
      heightTier: 'wall'
    }
  ]
};

// Define room composition templates with essential and complementary items
// Based on professional interior design packages (see PDF analysis)
const ROOM_TEMPLATES = {
  'Living Room': {
    // Pattern from PDF: 1 sofa, 1 coffee table, 1-2 accent chairs, 0-1 side table, 0-1 storage, 0-1 lamp, 0-1 decor
    essentials: {
      'primary_seating': { min: 1, max: 1, priority: 1 }, // REQUIRED: 1 Sofa/Sectional (anchor piece)
      'coffee_table': { min: 1, max: 1, priority: 2 }, // REQUIRED: Center table
      'accent_seating': { min: 1, max: 2, priority: 3 }, // REQUIRED: 1-2 accent chairs/ottomans/stools
    },
    complementary: {
      'side_table': { min: 0, max: 1, priority: 4 }, // Optional: 0-1 side/end table
      'storage': { min: 0, max: 1, priority: 5 }, // Optional: Sideboard/cabinet
      'lighting': { min: 0, max: 1, priority: 6 }, // Optional: 0-1 floor lamp
      'decor': { min: 0, max: 1, priority: 7 }, // Optional: 0-1 pillow/rug/art
    }
  },
  'Bedroom': {
    // Pattern: 1 bed (anchor), 1-2 nightstands, 1-2 table lamps, 0-1 dresser, 0-1 seating, 0-1 decor
    essentials: {
      'bed': { min: 1, max: 1, priority: 1 }, // REQUIRED: Bed (anchor piece, 40% budget)
      'nightstand': { min: 1, max: 2, priority: 2 }, // REQUIRED: Symmetric pair preferred
      'lighting': { min: 1, max: 2, priority: 3 }, // REQUIRED: Bedside table lamps
    },
    complementary: {
      'dresser': { min: 0, max: 1, priority: 4 }, // Optional: Dresser/chest
      'storage': { min: 0, max: 1, priority: 5 }, // Optional: Wardrobe/armoire
      'accent_seating': { min: 0, max: 1, priority: 6 }, // Optional: Bench or reading chair
      'decor': { min: 0, max: 1, priority: 7 }, // Optional: Rug, mirror, or wall art
    }
  },
  'Dining Room': {
    // Pattern: 1 table (anchor), 1-2 chair PRODUCTS (AI renders multiple copies), 0-1 sideboard, 1 chandelier, 0-1 rug
    essentials: {
      'dining_table': { min: 1, max: 1, priority: 1 }, // REQUIRED: Dining table (anchor, 35% budget)
      'dining_seating': { min: 1, max: 2, priority: 2 }, // Select 1-2 chair products; AI renders multiple copies based on quiz seating count
      'lighting': { min: 1, max: 1, priority: 3 }, // REQUIRED: Chandelier/pendant over table
    },
    complementary: {
      'storage': { min: 0, max: 1, priority: 4 }, // Optional: Buffet/sideboard
      'decor': { min: 0, max: 1, priority: 5 }, // Optional: Rug or centerpiece
    }
  },
  'Home Office': {
    // Pattern: 1 desk (anchor), 1 office chair, 1-2 storage, 1 task lamp, 0-1 guest seating
    essentials: {
      'desk': { min: 1, max: 1, priority: 1 }, // REQUIRED: Desk (anchor, 35% budget)
      'office_seating': { min: 1, max: 1, priority: 2 }, // REQUIRED: Ergonomic chair
      'storage': { min: 1, max: 2, priority: 3 }, // REQUIRED: Bookshelves/filing
      'lighting': { min: 1, max: 1, priority: 4 }, // REQUIRED: Task lamp
    },
    complementary: {
      'accent_seating': { min: 0, max: 1, priority: 5 }, // Optional: Guest chair
      'side_table': { min: 0, max: 1, priority: 6 }, // Optional: Side table for guest area
      'decor': { min: 0, max: 1, priority: 7 }, // Optional: Rug or wall art
    }
  }
};

// Map product categories to functional categories
// IMPORTANT: Include BOTH singular and plural forms to match actual database category names
const CATEGORY_TO_FUNCTIONAL: Record<string, string[]> = {
  // Primary seating (singular and plural)
  'Sofa': ['primary_seating'],
  'Sofas': ['primary_seating'],
  'Sofas & Sectionals': ['primary_seating'],
  'Sectional': ['primary_seating'],
  'Sectionals': ['primary_seating'],
  
  // Accent seating (singular and plural)
  'Chair': ['accent_seating'],
  'Chairs': ['accent_seating'],
  'Accent Chair': ['accent_seating'],
  'Accent Chairs': ['accent_seating'],
  'Armchair': ['accent_seating'],
  'Armchairs': ['accent_seating'],
  'Ottoman': ['accent_seating'],
  'Ottomans': ['accent_seating'],
  'Bench': ['accent_seating', 'bedroom_seating'],
  'Benches': ['accent_seating', 'bedroom_seating'],
  'Stool': ['accent_seating'],
  'Stools': ['accent_seating'],
  'Reading Chair': ['accent_seating'],
  'Swivel Chair': ['accent_seating'],
  'Chaise Lounge': ['accent_seating'],
  
  // Tables (singular and plural)
  'Coffee Table': ['coffee_table'],
  'Coffee Tables': ['coffee_table'],
  'Side Table': ['side_table'],
  'Side Tables': ['side_table'],
  'End Table': ['side_table'],
  'End Tables': ['side_table'],
  'End/Side Table': ['side_table'],
  'Console Table': ['console_table', 'storage'],
  'Console Tables': ['console_table', 'storage'],
  'Table': ['side_table'],
  
  // Storage (singular and plural)
  'Cabinet': ['storage'],
  'Cabinets': ['storage'],
  'Sideboard': ['storage'],
  'Sideboards': ['storage'],
  'Buffet': ['storage'],
  'Buffets': ['storage'],
  'Bar Cabinet': ['storage'],
  'Cabinet / Sideboard / Buffet': ['storage'],
  'Bookcase': ['storage'],
  'Bookcases': ['storage'],
  'Shelving Unit': ['storage'],
  'Shelving': ['storage'],
  'Media Unit': ['storage'],
  'Storage': ['storage'],
  
  // Bedroom furniture (singular and plural)
  'Dresser': ['dresser', 'storage'],
  'Dressers': ['dresser', 'storage'],
  'Nightstand': ['nightstand'],
  'Nightstands': ['nightstand'],
  'Bed': ['bed'],
  'Beds': ['bed'],
  
  // Dining (singular and plural)
  'Dining Table': ['dining_table'],
  'Dining Tables': ['dining_table'],
  'Dining Chair': ['dining_seating'],
  'Dining Chairs': ['dining_seating'],
  'Dining Bench': ['dining_seating'],
  
  // Office (singular and plural)
  'Desk': ['desk'],
  'Desks': ['desk'],
  'Large Desk': ['desk'],
  'Secretary Desk': ['desk'],
  'Office Chair': ['office_seating'],
  'Office Chairs': ['office_seating'],
  
  // Lighting (singular and plural)
  'Table Lamp': ['lighting'],
  'Table Lamps': ['lighting'],
  'Floor Lamp': ['lighting'],
  'Floor Lamps': ['lighting'],
  'Pendant Light': ['lighting'],
  'Pendant Lights': ['lighting'],
  'Chandelier': ['lighting'],
  'Chandeliers': ['lighting'],
  'Lighting': ['lighting'],
  'Outdoor Lamp': ['lighting'],
  
  // Decor (singular and plural)
  'Wall Art': ['decor'],
  'Mirror': ['decor'],
  'Mirrors': ['decor'],
  'Rug': ['decor'],
  'Rugs': ['decor'],
  'Vase': ['decor'],
  'Vases': ['decor'],
  'Home Decor': ['decor'],
  'Decor': ['decor'],
  'Accessory': ['decor'],
};

// Detect functional category from product name, description, and database category
// categoryMap is optional - if provided, it maps categoryId UUID to category name
function detectFunctionalCategory(product: Product, categoryMap?: Map<string, string>): string[] {
  const categories: Set<string> = new Set();
  
  // Check explicit category mapping using the categoryMap
  if (product.categoryId && categoryMap) {
    const categoryName = categoryMap.get(product.categoryId);
    if (categoryName) {
      const mapped = CATEGORY_TO_FUNCTIONAL[categoryName];
      if (mapped) {
        mapped.forEach(cat => categories.add(cat));
      }
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
  
  // Bed detection - STRICT: Only match actual beds, not trunks/benches/storage
  // Check product NAME only (not description) to avoid false positives
  const isBed = productName.includes(' bed') || 
                productName.startsWith('bed ') || 
                productName.endsWith(' bed') ||
                productName === 'bed';
  const isNotBed = productName.includes('bedside') || 
                   productName.includes('bedroom') ||
                   productName.includes('trunk') ||
                   productName.includes('bench');
  
  if (isBed && !isNotBed) {
    categories.add('bed');
  }
  
  // IMPORTANT: Detect if product is primarily a chair (word boundary match)
  // Use word boundary to allow "Chairside Table" while blocking "Dining Chair"
  // A "Dining Chair" should NEVER be categorized as "dining_table" even if description mentions "dining table"
  const isChairProduct = /\bchair(s)?\b/i.test(productName) && !productName.toLowerCase().includes('chairside');
  const isTableProduct = /\btable(s)?\b/i.test(productName);
  
  // Seating detection - RUN FIRST to prevent chairs from being categorized as tables
  if (/\bchair(s)?\b/i.test(text) && !text.includes('armchair')) {
    if (text.includes('dining') || productName.toLowerCase().includes('dining')) {
      categories.add('dining_seating');
    } else if (text.includes('office') || text.includes('desk')) {
      categories.add('office_seating');
    } else {
      categories.add('accent_seating');
    }
  }
  
  // Table detection (check console table first since it's more specific)
  // Note: Only match "console table" specifically, not just "console" to avoid false positives
  // For dining table: if product name has "chair" as a word AND "dining", it's dining_seating not dining_table
  const isDiningChair = isChairProduct && productName.toLowerCase().includes('dining');
  
  if (text.includes('console table') || productName.toLowerCase().includes('console table') || productName.toLowerCase().includes('chairside')) {
    categories.add('console_table');
  } else if (text.includes('coffee table')) {
    categories.add('coffee_table');
  } else if ((text.includes('dining table') || productName.toLowerCase().includes('dining table')) && isTableProduct && !isDiningChair) {
    // For dining table, require "table" in the product name AND exclude dining chairs
    categories.add('dining_table');
  } else if (text.includes('side table') || text.includes('end table') || text.includes('accent table')) {
    categories.add('side_table');
  } else if (text.includes('nightstand') || text.includes('bedside table')) {
    categories.add('nightstand');
  } else if (text.includes('desk') && !text.includes('desktop')) {
    categories.add('desk');
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
  
  // Lighting detection - use word boundaries to avoid matching "highlight", "lowlight", etc.
  // Match: lamp, chandelier, pendant, sconce (primary lighting keywords)
  // For "light" as standalone word, be more careful to avoid false positives
  const hasLampKeyword = /\blamp(s)?\b/i.test(text);
  const hasChandelierKeyword = /\bchandelier(s)?\b/i.test(text);
  const hasPendantKeyword = /\bpendant(s)?\b/i.test(text);
  const hasSconceKeyword = /\bsconce(s)?\b/i.test(text);
  // Only match "light" or "lighting" if NOT part of "highlight", "lowlight", "lighter", "delightful", etc.
  // Also check product name explicitly for "light" as it's more reliable
  const hasLightInName = /\blight(s|ing)?\b/i.test(productName);
  
  // A product is lighting if it has any primary lighting keyword OR "light/lighting" in name
  const isLighting = hasLampKeyword || hasChandelierKeyword || hasPendantKeyword || hasSconceKeyword || hasLightInName;
  
  // Products with lamp/chandelier/pendant/sconce are ALWAYS lighting regardless of other words
  // (this ensures "Table Lamp" is still categorized as lighting)
  if (isLighting) {
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
      
      // CRITICAL: Apply 8% safety margin to prevent furniture from being cut off at frame edges
      // Products centered near edges (e.g., x=0.9) will extend beyond the visible frame
      // Clamp coordinates to [0.08, 0.92] to ensure all furniture appears fully within the render
      const FRAME_MARGIN = 0.08; // 8% margin from each edge
      position.x = Math.max(FRAME_MARGIN, Math.min(1 - FRAME_MARGIN, position.x));
      position.y = Math.max(FRAME_MARGIN, Math.min(1 - FRAME_MARGIN, position.y));
      
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
        // Find a surface in the same zone (use SKU for matching)
        const surfaceProducts = placements.filter(p => 
          p.zoneId === bestZone.id && 
          ['side_table', 'nightstand', 'dresser'].some(cat => 
            detectFunctionalCategory(sortedProducts.find(sp => sp.sku === p.productId) || {} as Product).includes(cat)
          )
        );
        if (surfaceProducts.length > 0) {
          supportSurface = surfaceProducts[0].productId;
        }
      }
      
      // Calculate confidence based on fit quality
      const confidence = Math.max(0, Math.min(1, bestScore / 100));
      
      placements.push({
        productId: product.sku,
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
  'office_seating',    // Office chairs - need matching set
  'bedroom_seating',   // Bedroom chairs - need matching set
  'accent_seating_set' // Accent chair sets
  // REMOVED 'dining_seating' - AI renders multiple copies based on quiz seating count
]);

/**
 * Select products using NEW PRIORITIZATION: Space → Fit → Preference → Budget
 * 
 * Pipeline order:
 * 1. SPACE ANALYSIS: Use room dimensions to understand available placement zones
 * 2. FIT VALIDATION: Filter products by physical fit BEFORE any preference scoring
 * 3. STYLE MATCHING: Score remaining products by user style/color/texture preferences
 * 4. BUDGET CONSTRAINTS: Apply budget as the LAST filter (preserve quality over cost)
 */
export async function selectProductsWithComposition(
  roomType: string,
  candidateProducts: Product[],
  quizResponse?: QuizResponse,
  maxProducts: number = 15,
  roomDimensions?: RoomDimensions // NEW: Optional room dimensions for fit validation
): Promise<CompositionResult> {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 PRODUCT SELECTION PIPELINE: Space → Fit → Preference → Budget');
  console.log('='.repeat(70));
  
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
  
  // STEP 1: SPACE ANALYSIS - Calculate available zones and constraints
  console.log('\n📐 STEP 1: SPACE ANALYSIS');
  if (roomDimensions) {
    console.log(`   Room size: ${roomDimensions.width}" x ${roomDimensions.depth}" (${(roomDimensions.width/12).toFixed(1)}' x ${(roomDimensions.depth/12).toFixed(1)}')`);
    console.log(`   Ceiling: ${roomDimensions.ceilingHeight}" (${(roomDimensions.ceilingHeight/12).toFixed(1)}')`);
    if (roomDimensions.windows?.length) console.log(`   Windows: ${roomDimensions.windows.length}`);
    if (roomDimensions.doors?.length) console.log(`   Doors: ${roomDimensions.doors.length}`);
  } else {
    console.log('   Using default room dimensions (14x12 ft typical)');
  }
  
  // Calculate budget allocation (but DON'T apply it during scoring - apply at END)
  let budgetAllocation: BudgetAllocation | null = null;
  if (quizResponse?.budgetRange) {
    try {
      budgetAllocation = calculateBudgetAllocation(roomType, quizResponse.budgetRange);
      console.log(`\n💰 Budget allocation (will apply LAST):`);
      console.log(`   Total: $${budgetAllocation.totalBudget.toFixed(0)}`);
      console.log(`   Categories:`, budgetAllocation.categoryBudgets.map(cb => 
        `${cb.category}: $${cb.allocatedBudget.toFixed(0)}`
      ).join(', '));
    } catch (error) {
      console.warn(`Failed to calculate budget allocation: ${error}`);
    }
  }
  
  // Fetch category information for products
  const categoryMap = new Map<string, string>();
  const categories = await curalinaStorage.getAllCategories();
  categories.forEach(cat => {
    categoryMap.set(cat.id, cat.name);
  });
  
  // Categorize all candidate products
  const productsByCategory: Record<string, Product[]> = {};
  const uncategorized: Product[] = [];
  
  for (const product of candidateProducts) {
    const cats = detectFunctionalCategory(product, categoryMap);
    if (cats.length === 0) {
      uncategorized.push(product);
    } else {
      for (const cat of cats) {
        if (!productsByCategory[cat]) {
          productsByCategory[cat] = [];
        }
        productsByCategory[cat].push(product);
      }
    }
  }
  
  const selectedProducts: Product[] = [];
  const composition: Record<string, Product[]> = {};
  const missingEssentials: string[] = [];
  const warnings: string[] = [];
  const usedProductIds = new Set<string>();
  
  // Process categories by priority (essentials first)
  const allRules = { ...template.essentials, ...template.complementary };
  const sortedCategories = Object.entries(allRules).sort((a, b) => a[1].priority - b[1].priority);
  
  console.log('\n📐 STEP 2: FIT VALIDATION (filter before scoring)');
  
  // OPTIMIZATION: Pre-compute fit validations for ALL categories in parallel
  const startFitTime = Date.now();
  const fitResultsByCategory: Record<string, Array<{ product: Product; fitValidation: FitValidation }>> = {};
  
  // Run fit validation for all categories simultaneously
  await Promise.all(
    sortedCategories.map(async ([category]) => {
      const categoryProducts = productsByCategory[category] || [];
      if (categoryProducts.length > 0) {
        fitResultsByCategory[category] = filterByPhysicalFit(categoryProducts, roomType, category, roomDimensions);
      } else {
        fitResultsByCategory[category] = [];
      }
    })
  );
  
  const fitTime = Date.now() - startFitTime;
  console.log(`   ⚡ Parallel fit validation completed in ${fitTime}ms for ${sortedCategories.length} categories`);
  
  console.log('✨ STEP 3: STYLE MATCHING (score by preferences)');
  
  for (const [category, rule] of sortedCategories) {
    const isEssential = (template.essentials as any)[category] !== undefined;
    
    // Use pre-computed fit results, filtering out already-used products
    let fittingProducts = (fitResultsByCategory[category] || [])
      .filter(({ product }) => !usedProductIds.has(product.id));
    
    console.log(`\n🔍 Processing: ${category} (${isEssential ? 'ESSENTIAL' : 'complementary'})`);
    console.log(`   Available after fit filter: ${fittingProducts.length}, Required: min ${rule.min}, max ${rule.max}`);
    
    if (fittingProducts.length === 0) {
      // Check if we had products before the fit filter
      const categoryProducts = productsByCategory[category] || [];
      const unusedCategoryProducts = categoryProducts.filter(p => !usedProductIds.has(p.id));
      
      if (unusedCategoryProducts.length === 0) {
        if (isEssential && rule.min > 0) {
          missingEssentials.push(category);
          warnings.push(`Missing essential item: ${category}`);
          console.log(`   ❌ MISSING ESSENTIAL: ${category}`);
        }
        continue;
      }
      
      // We had products but none passed fit - provide fallback for essentials
      console.log(`   ⚠️ No products pass fit validation for ${category}`);
      if (isEssential && rule.min > 0) {
        // Fallback: use original products with fit warning (essential categories MUST have selections)
        warnings.push(`No products fit zone constraints for ${category} - using best available`);
        fittingProducts = unusedCategoryProducts.map(p => ({
          product: p,
          fitValidation: { 
            fits: true, 
            fitScore: 50, 
            issues: ['Fit relaxed - no better options'], 
            bestZone: null, 
            orientationOptions: [0], 
            clearanceMargin: 0 
          }
        }));
        console.log(`   ✅ Fallback: ${fittingProducts.length} products available for essential ${category}`);
      } else {
        continue;
      }
    }
    
    // Determine how many to select
    const targetCount = isEssential ? 
      Math.max(rule.min, 1) :
      Math.min(rule.max, Math.max(1, Math.floor(fittingProducts.length / 2)));
    
    const toSelect = Math.min(targetCount, rule.max, fittingProducts.length);
    
    console.log(`   Fitting products: ${fittingProducts.length}, Will select: ${toSelect}`);
    
    // =========================================================================
    // STEP 3: STYLE MATCHING - Score by user preferences (NOT budget yet)
    // NOTE: Caching + parallel precomputation handle performance
    // We score ALL products to guarantee best selection quality
    // =========================================================================
    const scoredProducts: Array<{ product: Product; score: number }> = [];
    
    for (const { product, fitValidation } of fittingProducts) {
      // Start with fit score (physical fit is foundational)
      let score = fitValidation.fitScore;
      
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
        
        // Match colors - map palette names to color keywords
        if (quizResponse.colorPalettes && product.colors) {
          const paletteColorKeywords: Record<string, string[]> = {
            'Warm Neutrals': ['beige', 'cream', 'tan', 'ivory', 'sand', 'warm white', 'taupe', 'oatmeal', 'camel'],
            'Earth & Stone': ['terracotta', 'clay', 'sienna', 'ochre', 'rust', 'brown', 'umber', 'stone', 'copper'],
            'Coastal Calm': ['blue', 'white', 'sand', 'aqua', 'seafoam', 'navy', 'teal', 'ivory', 'driftwood'],
            'Soft Contrast': ['blush', 'sage', 'dusty rose', 'grey', 'mauve', 'lavender', 'soft pink', 'muted'],
            'Monochrome Luxe': ['black', 'white', 'grey', 'charcoal', 'silver', 'graphite', 'onyx', 'ivory'],
            'Artful Contrast': ['emerald', 'sapphire', 'coral', 'jewel', 'teal', 'burgundy', 'mustard', 'gold', 'ruby'],
            'Heritage Warmth': ['burgundy', 'gold', 'mahogany', 'deep red', 'bronze', 'antique', 'rich', 'walnut'],
            'Dark & Moody': ['charcoal', 'midnight', 'navy', 'black', 'deep', 'dark grey', 'forest', 'ebony'],
            // Legacy palette names for backwards compatibility
            'Light Neutrals': ['beige', 'cream', 'white', 'ivory', 'grey', 'sand'],
            'Warm & Cozy': ['terracotta', 'caramel', 'brown', 'rust', 'amber', 'warm'],
            'Colourful Accent': ['emerald', 'sapphire', 'coral', 'bold', 'vibrant', 'colorful'],
          };
          
          const hasMatchingColor = quizResponse.colorPalettes.some(palette => {
            const keywords = paletteColorKeywords[palette] || [palette.toLowerCase()];
            return product.colors?.some(color =>
              keywords.some(keyword => 
                color.toLowerCase().includes(keyword) ||
                keyword.includes(color.toLowerCase())
              )
            );
          });
          if (hasMatchingColor) {
            score += 20;
            console.log(`🎨 Color palette match for ${product.name}: +20 pts`);
          }
        }
        
        // Match textures/materials from quiz against product materials
        if (quizResponse.textures && quizResponse.textures.length > 0 && product.materials) {
          // Map quiz texture options to material keywords
          const textureKeywords: Record<string, string[]> = {
            'Leather, Wool': ['leather', 'wool', 'hide', 'cowhide'],
            'Rattan, Wicker, Jute': ['rattan', 'wicker', 'jute', 'seagrass', 'cane', 'woven'],
            'Walnut': ['walnut', 'dark wood', 'espresso', 'mahogany'],
            'Velvet, Brass, Smoked Glass': ['velvet', 'brass', 'glass', 'smoked', 'gold', 'metal'],
            'White Oak, Linen, Travertine': ['oak', 'white oak', 'linen', 'travertine', 'stone', 'natural wood'],
            'Satin, Metallics': ['satin', 'chrome', 'nickel', 'stainless', 'polished', 'metallic', 'silver'],
          };
          
          const hasTextureMatch = quizResponse.textures.some(texture => {
            const keywords = textureKeywords[texture] || texture.toLowerCase().split(/[,\s]+/);
            return product.materials?.some(material =>
              keywords.some(keyword => 
                material.toLowerCase().includes(keyword) ||
                keyword.includes(material.toLowerCase())
              )
            );
          });
          if (hasTextureMatch) {
            score += 25;
            console.log(`🧶 Texture match for ${product.name}: +25 pts`);
          }
        }
        
        // Match lineStyle (design mode) against product design style
        if (quizResponse.lineStyle && product.designStyle) {
          // Map quiz line styles to design style keywords
          const lineStyleKeywords: Record<string, string[]> = {
            'Classic': ['classic', 'traditional', 'timeless', 'elegant', 'formal'],
            'Transitional': ['transitional', 'balanced', 'versatile', 'modern traditional'],
            'Modern': ['modern', 'contemporary', 'minimalist', 'clean', 'sleek'],
            'Eclectic': ['eclectic', 'bohemian', 'mixed', 'artisan', 'global'],
            'Relaxed': ['relaxed', 'casual', 'coastal', 'farmhouse', 'cottage', 'organic'],
          };
          
          const keywords = lineStyleKeywords[quizResponse.lineStyle] || [quizResponse.lineStyle.toLowerCase()];
          const hasLineStyleMatch = product.designStyle.some(style =>
            keywords.some(keyword => 
              style.toLowerCase().includes(keyword) ||
              keyword.includes(style.toLowerCase())
            )
          );
          if (hasLineStyleMatch) {
            score += 15;
            console.log(`✨ Line style match for ${product.name}: +15 pts`);
          }
        }
        
        // Match patternPreference - boost solid-colored products for "Just Solids" preference
        if (quizResponse.patternPreference) {
          const productDescription = [
            product.name,
            product.visualDescriptionFrontView,
            product.visualDescriptionGemini,
            ...(product.colors || [])
          ].filter(Boolean).join(' ').toLowerCase();
          
          // Comprehensive pattern detection regex
          const hasPattern = /pattern|stripe|plaid|check|floral|geometric|print|motif|damask|ikat|chevron|herringbone|paisley|botanical|embroidered|speckled|marbled|abstract|trellis|lattice|medallion|toile|chinoiserie|argyle|houndstooth|tartan|gingham/.test(productDescription);
          const isSolid = /solid|plain|monochrome|single color|uniform/.test(productDescription) || !hasPattern;
          
          if (quizResponse.patternPreference === 'Just Solids' && isSolid) {
            score += 15;
            console.log(`🎨 Solid preference match for ${product.name}: +15 pts`);
          } else if (quizResponse.patternPreference === 'I Love Patterns' && hasPattern) {
            score += 20;
            console.log(`🎨 Pattern preference match for ${product.name}: +20 pts`);
          } else if (quizResponse.patternPreference === 'Patterned Accents') {
            // Moderate boost for balanced selection - prefer solids with occasional patterns
            if (isSolid) {
              score += 10; // Slight preference for solids as base
            } else if (hasPattern) {
              score += 8; // Still include some patterns as accents
            }
          }
        }
      }
      
      // NOTE: Budget scoring REMOVED from here - applied as FINAL filter (Step 4)
      // This ensures products are selected by FIT and PREFERENCE first, budget last
      
      // NO randomness for set categories - we want consistent matching sets
      // For other categories, add randomness to avoid always picking the same products
      if (!SET_CATEGORIES.has(category)) {
        score += Math.random() * 10;
      }
      
      scoredProducts.push({ product, score });
    }
    
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
      
      // CRITICAL FIX: Prevent duplicate selection of same product
      // This product might already be in selectedProducts if it was added in a previous category iteration
      if (selectedProducts.some(p => p.id === product.id)) {
        console.log(`⚠️ Skipping duplicate product: ${product.name} already selected`);
        continue;
      }
      
      selectedProducts.push(product);
      console.log(`   ✅ Added: ${product.name} (${product.sku})`);
      
      // Only mark as used once per unique product
      usedProductIds.add(product.id);
      
      if (!composition[category]) {
        composition[category] = [];
      }
      composition[category].push(product);
    }
    
    console.log(`   📊 Selected ${composition[category]?.length || 0} products for ${category}`);
    
    // Check if we met minimum requirements
    if (isEssential && selected.length < rule.min) {
      const warning = `Only found ${selected.length} of ${rule.min} required ${category} items`;
      warnings.push(warning);
      console.log(`   ⚠️  ${warning}`);
    }
  }
  
  console.log(`\n📦 Selection complete (before budget): ${selectedProducts.length} total products`);
  console.log(`   Composition:`, Object.entries(composition).map(([cat, prods]) => `${cat}: ${prods.length}`).join(', '));
  
  // Add some uncategorized items if we have room
  if (selectedProducts.length < maxProducts && uncategorized.length > 0) {
    const remainingSlots = maxProducts - selectedProducts.length;
    const toAdd = uncategorized.slice(0, Math.min(remainingSlots, 3));
    selectedProducts.push(...toAdd);
  }
  
  // =========================================================================
  // STEP 4: BUDGET CONSTRAINTS - Smart Substitution System
  // Instead of removing items, substitute with similar but cheaper alternatives
  // Priority: Replace least visible items first, anchor pieces last
  // =========================================================================
  console.log('\n💰 STEP 4: BUDGET CONSTRAINTS (smart substitution)');
  
  if (budgetAllocation) {
    let currentCost = selectedProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);
    const budgetWithFlex = budgetAllocation.totalBudget + budgetAllocation.flexiblePool;
    
    console.log(`   Pre-budget selection cost: $${currentCost.toFixed(2)}`);
    console.log(`   Budget limit (with flex): $${budgetWithFlex.toFixed(2)}`);
    console.log(`   Status: ${currentCost <= budgetWithFlex ? '✅ WITHIN BUDGET' : '⚠️ OVER BUDGET'}`);
    
    if (currentCost > budgetWithFlex) {
      console.log(`   Overage: $${(currentCost - budgetWithFlex).toFixed(2)} - starting smart substitutions...`);
      
      // Sort products by visibility impact (substitute least visible first)
      // Within each visibility tier, sort by price (most expensive first for better savings)
      const sortedForSubstitution = [...selectedProducts].map(p => ({
        product: p,
        visibilityImpact: getVisibilityImpact(p),
        visibilityPriority: getVisibilityPriority(getVisibilityImpact(p)),
        price: parseFloat(p.price),
        essential: detectFunctionalCategory(p).some(cat => (template.essentials as any)[cat])
      })).sort((a, b) => {
        // Sort by visibility priority first (lower = substitute first)
        if (a.visibilityPriority !== b.visibilityPriority) {
          return a.visibilityPriority - b.visibilityPriority;
        }
        // Within same visibility, most expensive first (more potential savings)
        return b.price - a.price;
      });
      
      let substitutionCount = 0;
      let removalCount = 0;
      const MAX_ITERATIONS = 20; // Prevent infinite loops
      
      // Iterate through products and try substitutions
      for (let iteration = 0; iteration < MAX_ITERATIONS && currentCost > budgetWithFlex; iteration++) {
        let madeChange = false;
        
        for (const item of sortedForSubstitution) {
          if (currentCost <= budgetWithFlex) break;
          
          // Skip if product was already removed
          if (!selectedProducts.find(p => p.id === item.product.id)) continue;
          
          // Find substitution candidates
          const candidates = findSubstitutionCandidates(
            item.product,
            candidateProducts,
            usedProductIds,
            4 // Don't go below tier 4 (budget)
          );
          
          if (candidates.length > 0) {
            // Use best matching substitute that provides enough savings
            const neededSavings = currentCost - budgetWithFlex;
            const bestCandidate = candidates.find(c => c.priceDiff >= neededSavings * 0.1) || candidates[0];
            
            // Perform substitution
            const oldPrice = parseFloat(item.product.price);
            const newPrice = parseFloat(bestCandidate.product.price);
            const savings = oldPrice - newPrice;
            
            // Log substitution with image verification
            const substituteImageCount = bestCandidate.product.images?.length || 0;
            const originalImageCount = item.product.images?.length || 0;
            console.log(`   🔄 Substituting ${item.product.name} ($${oldPrice.toFixed(0)}) → ${bestCandidate.product.name} ($${newPrice.toFixed(0)}) [save $${savings.toFixed(0)}, match: ${bestCandidate.matchScore.toFixed(0)}%]`);
            console.log(`      📸 Images: ${originalImageCount} original → ${substituteImageCount} substitute (ID: ${bestCandidate.product.id})`);
            
            // Update arrays - the full product object (with images, dimensions, etc.) is transferred
            const productIndex = selectedProducts.findIndex(p => p.id === item.product.id);
            if (productIndex !== -1) {
              // Replace with the complete substitute product including all fields (images, dimensions, colors, etc.)
              selectedProducts[productIndex] = bestCandidate.product;
              usedProductIds.delete(item.product.id);
              usedProductIds.add(bestCandidate.product.id);
              
              // Update composition
              for (const [cat, prods] of Object.entries(composition)) {
                const catIndex = prods.findIndex(p => p.id === item.product.id);
                if (catIndex !== -1) {
                  prods[catIndex] = bestCandidate.product;
                }
              }
              
              currentCost -= savings;
              substitutionCount++;
              madeChange = true;
              break; // Re-evaluate order after each substitution
            }
          } else if (!item.essential) {
            // No substitutes available - remove if not essential
            console.log(`   ❌ Removing ${item.product.name} ($${item.price.toFixed(0)}) - no suitable substitutes`);
            
            const productIndex = selectedProducts.findIndex(p => p.id === item.product.id);
            if (productIndex !== -1) {
              selectedProducts.splice(productIndex, 1);
              usedProductIds.delete(item.product.id);
              
              // Update composition
              for (const [cat, prods] of Object.entries(composition)) {
                const catIndex = prods.findIndex(p => p.id === item.product.id);
                if (catIndex !== -1) {
                  prods.splice(catIndex, 1);
                }
              }
              
              currentCost -= item.price;
              removalCount++;
              madeChange = true;
              break; // Re-evaluate order after each removal
            }
          }
        }
        
        if (!madeChange) {
          console.log(`   ⚠️ No more substitutions or removals possible`);
          break;
        }
      }
      
      console.log(`\n   📊 Budget adjustment summary:`);
      console.log(`      Substitutions made: ${substitutionCount}`);
      console.log(`      Items removed: ${removalCount}`);
      console.log(`      Final cost: $${currentCost.toFixed(2)}`);
      console.log(`      ${currentCost <= budgetWithFlex ? '✅ Within budget' : '⚠️ Still over budget'}`);
      
      if (currentCost > budgetWithFlex) {
        warnings.push(`Could not fit selection within budget of $${budgetWithFlex.toFixed(0)} (final cost: $${currentCost.toFixed(0)}). Consider increasing budget or reducing room complexity.`);
      }
    }
  }
  
  // Generate zone-based placements
  const placements = assignItemsToZones(roomType, selectedProducts, composition);
  
  // Final summary
  const finalCost = selectedProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);
  console.log('\n' + '='.repeat(70));
  console.log('✅ PIPELINE COMPLETE: Space → Fit → Preference → Budget');
  console.log('='.repeat(70));
  console.log(`   Products selected: ${selectedProducts.length}`);
  console.log(`   Total cost: $${finalCost.toFixed(2)}`);
  console.log(`   Essential items: ${Object.entries(composition).filter(([cat]) => (template.essentials as any)[cat]).length} categories`);
  console.log(`   Missing essentials: ${missingEssentials.length > 0 ? missingEssentials.join(', ') : 'None'}`);
  console.log(`   Warnings: ${warnings.length}`);
  console.log('='.repeat(70) + '\n');
  
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