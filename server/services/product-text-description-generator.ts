import type { Product } from '@shared/schema';
import { buildDimensionSummary } from './dimension-utils';

/**
 * Generate rich product descriptions that scale naturally with available data
 * Length adapts to product metadata completeness - sparse data yields shorter descriptions,
 * rich data yields comprehensive descriptions
 */

/**
 * Generate a visual description from product data fields
 * Output length scales with available metadata - no artificial word count targets
 */
export function generateRichProductDescription(product: Product): string {
  const sections: string[] = [];
  
  // CORE IDENTITY: Always include product name and description
  let intro = product.name;
  if (product.description) {
    intro += `. ${product.description}`;
  }
  sections.push(intro);
  
  // DESIGN STYLE: Only add if we have style data
  const styleElements: string[] = [];
  
  if (product.designStyle && product.designStyle.length > 0) {
    styleElements.push(`This piece embodies ${product.designStyle.join(', ')} design aesthetics`);
  }
  
  if (product.styleTags && product.styleTags.length > 0) {
    const tags = product.styleTags.join(', ');
    styleElements.push(`characterized by ${tags} qualities`);
  }
  
  // Add visual form details if we can infer from product type
  const nameLower = product.name.toLowerCase();
  if (nameLower.includes('sofa') || nameLower.includes('couch')) {
    styleElements.push('featuring upholstered cushioning with a structured framework');
  } else if (nameLower.includes('chair')) {
    styleElements.push('presenting a carefully considered seat and back profile');
  } else if (nameLower.includes('table')) {
    styleElements.push('with a clean surface plane and supporting base structure');
  } else if (nameLower.includes('cabinet') || nameLower.includes('credenza')) {
    styleElements.push('offering enclosed storage with door or drawer configurations');
  } else if (nameLower.includes('shelf') || nameLower.includes('bookcase')) {
    styleElements.push('providing open shelving for display and organization');
  }
  
  if (styleElements.length > 0) {
    sections.push(styleElements.join(', ') + '.');
  }
  
  // MATERIALS & COLORS: Only add if we have material/color data
  const materialElements: string[] = [];
  
  if (product.materials && product.materials.length > 0) {
    const materials = product.materials.join(', ');
    materialElements.push(`Constructed from ${materials}`);
    
    // Add brief material-specific details
    if (product.materials.some((m: string) => m.toLowerCase().includes('wood'))) {
      materialElements.push('with natural wood grain patterns adding organic warmth');
    }
    if (product.materials.some((m: string) => m.toLowerCase().includes('metal'))) {
      materialElements.push('metal components providing structural support with smooth finishes');
    }
    if (product.materials.some((m: string) => m.toLowerCase().includes('fabric') || m.toLowerCase().includes('upholstery') || m.toLowerCase().includes('linen'))) {
      materialElements.push('textile surfaces offering soft texture and comfort');
    }
    if (product.materials.some((m: string) => m.toLowerCase().includes('leather'))) {
      materialElements.push('leather upholstery with smooth grain and natural character');
    }
    if (product.materials.some((m: string) => m.toLowerCase().includes('glass'))) {
      materialElements.push('glass elements creating transparency and visual lightness');
    }
  }
  
  if (product.colors && product.colors.length > 0) {
    const colors = product.colors.join(', ');
    materialElements.push(`Available in ${colors} finishes`);
    
    // Add color tone descriptions
    const darkColors = ['black', 'dark', 'charcoal', 'navy', 'espresso', 'walnut', 'ebony'];
    const lightColors = ['white', 'cream', 'beige', 'light', 'natural', 'oak', 'birch'];
    
    const hasDark = product.colors.some((c: string) => darkColors.some((dc: string) => c.toLowerCase().includes(dc)));
    const hasLight = product.colors.some((c: string) => lightColors.some((lc: string) => c.toLowerCase().includes(lc)));
    
    if (hasDark && hasLight) {
      materialElements.push('ranging from darker grounding tones to lighter airy finishes');
    } else if (hasDark) {
      materialElements.push('darker tones creating visual weight and depth');
    } else if (hasLight) {
      materialElements.push('lighter finishes contributing brightness and openness');
    }
  }
  
  if (materialElements.length > 0) {
    sections.push(materialElements.join(', ') + '.');
  }
  
  // DIMENSIONS: Use category-aware dimension summary for comprehensive info
  const dimensionSummary = buildDimensionSummary(product);
  if (dimensionSummary) {
    const dims = product.dimensions as any;
    
    let dimText = `Dimensions: ${dimensionSummary}`;
    
    // Add scale context based on width if available
    const width = dims?.w || dims?.width;
    if (width && width > 72) {
      dimText += ', substantial scale for larger spaces';
    } else if (width && width < 36) {
      dimText += ', compact for space-efficient placement';
    }
    
    sections.push(dimText + '.');
  }
  
  if (product.weight) {
    sections.push(`Weight: ${product.weight}.`);
  }
  
  // FEATURES: Only add if we have feature data
  const features: string[] = [];
  
  if (product.keyFeatures && product.keyFeatures.length > 0) {
    features.push(`Features include ${product.keyFeatures.join(', ')}`);
  }
  
  if (product.storageSolutions && product.storageSolutions !== 'No Storage') {
    features.push(`storage capabilities: ${product.storageSolutions}`);
  }
  
  if (product.assembly) {
    if (product.assembly.toLowerCase() === 'yes') {
      features.push('requires assembly');
    } else if (product.assembly.toLowerCase() === 'no') {
      features.push('arrives fully assembled');
    }
  }
  
  if (features.length > 0) {
    sections.push(features.join(', ') + '.');
  }
  
  // ROOM PLACEMENT: Only add if we have room type data
  if (product.roomType && product.roomType.length > 0) {
    const rooms = product.roomType.map((room: string) => {
      const roomLower = room.toLowerCase();
      if (roomLower.includes('living')) return 'living rooms';
      if (roomLower.includes('bedroom')) return 'bedrooms';
      if (roomLower.includes('dining')) return 'dining spaces';
      if (roomLower.includes('office') || roomLower.includes('study')) return 'home offices';
      if (roomLower.includes('entryway') || roomLower.includes('foyer')) return 'entryways';
      return room;
    });
    
    sections.push(`Suitable for ${rooms.join(', ')}.`);
  }
  
  // Combine all sections - length naturally reflects available data
  return sections.join(' ');
}

/**
 * Batch generate descriptions for multiple products
 * Returns a map of SKU to generated description
 */
export function batchGenerateDescriptions(products: Product[]): Map<string, string> {
  const descriptions = new Map<string, string>();
  
  for (const product of products) {
    const richDescription = generateRichProductDescription(product);
    const wordCount = richDescription.split(/\s+/).length;
    
    console.log(`Generated description for ${product.sku}: ${wordCount} words`);
    
    descriptions.set(product.sku, richDescription);
  }
  
  return descriptions;
}
