import type { Product } from '@shared/schema';

/**
 * Generate rich, detailed product descriptions from existing product fields
 * This creates 300-400 word descriptions similar to Gemini Vision output
 * to use as a temporary solution until image analysis completes
 */

/**
 * Generate a comprehensive visual description from product data fields
 * Synthesizes name, description, colors, materials, dimensions, and other attributes
 * into a rich ~300-400 word description for AI prompt enhancement
 */
export function generateRichProductDescription(product: Product): string {
  const sections: string[] = [];
  
  // 1. OVERVIEW SECTION (Product name and core description)
  let overview = `${product.name}`;
  if (product.description) {
    overview += ` - ${product.description}`;
  }
  sections.push(overview);
  
  // 2. DESIGN & STYLE SECTION
  const styleElements: string[] = [];
  
  if (product.designStyle && product.designStyle.length > 0) {
    styleElements.push(`Design aesthetic: ${product.designStyle.join(', ')}`);
  }
  
  if (product.styleTags && product.styleTags.length > 0) {
    styleElements.push(`Style characteristics: ${product.styleTags.join(', ')}`);
  }
  
  if (product.roomType && product.roomType.length > 0) {
    styleElements.push(`Ideal for: ${product.roomType.join(', ')}`);
  }
  
  if (styleElements.length > 0) {
    sections.push(`DESIGN STYLE: ${styleElements.join('. ')}.`);
  }
  
  // 3. MATERIALS & COLORS SECTION
  const materialElements: string[] = [];
  
  if (product.materials && product.materials.length > 0) {
    materialElements.push(`Constructed from ${product.materials.join(', ')}`);
  }
  
  if (product.colors && product.colors.length > 0) {
    const colorList = product.colors.join(', ');
    materialElements.push(`Available color palette includes ${colorList}`);
  }
  
  if (materialElements.length > 0) {
    sections.push(`MATERIALS & FINISHES: ${materialElements.join('. ')}.`);
  }
  
  // 4. DIMENSIONS & PHYSICAL SPECS
  const physicalSpecs: string[] = [];
  
  if (product.dimensions) {
    const dims = product.dimensions as { w?: number; d?: number; h?: number; unit?: string };
    if (dims.w || dims.h || dims.d) {
      const unit = dims.unit || 'inches';
      const dimensionParts: string[] = [];
      if (dims.w) dimensionParts.push(`Width: ${dims.w}${unit}`);
      if (dims.d) dimensionParts.push(`Depth: ${dims.d}${unit}`);
      if (dims.h) dimensionParts.push(`Height: ${dims.h}${unit}`);
      physicalSpecs.push(`Dimensions - ${dimensionParts.join(', ')}`);
    }
  }
  
  if (product.weight) {
    physicalSpecs.push(`Weight: ${product.weight}`);
  }
  
  if (physicalSpecs.length > 0) {
    sections.push(`PHYSICAL SPECIFICATIONS: ${physicalSpecs.join('. ')}.`);
  }
  
  // 5. FEATURES & FUNCTIONALITY
  const functionalElements: string[] = [];
  
  if (product.keyFeatures && product.keyFeatures.length > 0) {
    functionalElements.push(`Key features include: ${product.keyFeatures.join(', ')}`);
  }
  
  if (product.storageSolutions && product.storageSolutions !== 'No Storage') {
    functionalElements.push(`Storage: ${product.storageSolutions}`);
  }
  
  if (product.assembly) {
    const assemblyText = product.assembly.toLowerCase() === 'yes' 
      ? 'Requires assembly' 
      : product.assembly.toLowerCase() === 'no' 
        ? 'Arrives fully assembled' 
        : `Assembly: ${product.assembly}`;
    functionalElements.push(assemblyText);
  }
  
  if (functionalElements.length > 0) {
    sections.push(`FEATURES: ${functionalElements.join('. ')}.`);
  }
  
  // 6. VISUAL DESCRIPTION (Synthesized based on available data)
  const visualDescription: string[] = [];
  
  // Infer form and silhouette from product name and type
  const nameLower = product.name.toLowerCase();
  
  if (nameLower.includes('sofa') || nameLower.includes('couch')) {
    visualDescription.push('The silhouette features clean lines with upholstered cushioning');
    if (product.materials?.some((m: string) => m.toLowerCase().includes('leather'))) {
      visualDescription.push('smooth leather upholstery with subtle grain texture visible');
    } else if (product.materials?.some((m: string) => m.toLowerCase().includes('fabric') || m.toLowerCase().includes('linen'))) {
      visualDescription.push('soft fabric upholstery with woven textile texture');
    }
  } else if (nameLower.includes('chair')) {
    visualDescription.push('The chair presents a structured profile with defined seat and back rest');
    if (nameLower.includes('dining')) {
      visualDescription.push('designed for dining table use with appropriate seat height');
    } else if (nameLower.includes('lounge') || nameLower.includes('accent')) {
      visualDescription.push('lower profile suitable for relaxed seating');
    }
  } else if (nameLower.includes('table')) {
    visualDescription.push('The table features a flat horizontal surface');
    if (nameLower.includes('coffee')) {
      visualDescription.push('positioned at lower height appropriate for living room use');
    } else if (nameLower.includes('dining')) {
      visualDescription.push('standard dining height approximately 28-30 inches');
    } else if (nameLower.includes('side') || nameLower.includes('end')) {
      visualDescription.push('compact dimensions suitable for placement beside seating');
    } else if (nameLower.includes('console')) {
      visualDescription.push('narrow depth designed for placement against walls or behind sofas');
    }
  } else if (nameLower.includes('cabinet') || nameLower.includes('credenza')) {
    visualDescription.push('The piece presents as a enclosed storage unit');
    visualDescription.push('with doors or drawers concealing internal storage space');
  } else if (nameLower.includes('shelf') || nameLower.includes('bookcase')) {
    visualDescription.push('Open shelving design with multiple horizontal surfaces');
    visualDescription.push('creating visual display and storage opportunities');
  }
  
  // Add material-specific visual details
  if (product.materials?.some((m: string) => m.toLowerCase().includes('wood'))) {
    visualDescription.push('Natural wood grain patterns visible across surfaces adding organic warmth');
  }
  if (product.materials?.some((m: string) => m.toLowerCase().includes('metal'))) {
    visualDescription.push('Metal elements provide structural support with smooth metallic finish');
  }
  if (product.materials?.some((m: string) => m.toLowerCase().includes('glass'))) {
    visualDescription.push('Transparent or translucent glass components creating visual lightness');
  }
  
  // Add color-specific visual details
  if (product.colors) {
    const darkColors = ['black', 'dark', 'charcoal', 'navy', 'espresso', 'walnut'];
    const lightColors = ['white', 'cream', 'beige', 'light', 'natural', 'oak'];
    const hasDark = product.colors.some((c: string) => darkColors.some((dc: string) => c.toLowerCase().includes(dc)));
    const hasLight = product.colors.some((c: string) => lightColors.some((lc: string) => c.toLowerCase().includes(lc)));
    
    if (hasDark) {
      visualDescription.push('Darker tones create grounding presence and visual weight in the space');
    }
    if (hasLight) {
      visualDescription.push('Lighter finishes contribute airiness and brightness to the environment');
    }
  }
  
  if (visualDescription.length > 0) {
    sections.push(`VISUAL CHARACTERISTICS: ${visualDescription.join('. ')}.`);
  }
  
  // 7. CONTEXTUAL PLACEMENT (if roomType is specified)
  if (product.roomType && product.roomType.length > 0) {
    const placementSuggestions = product.roomType.map((room: string) => {
      const roomLower = room.toLowerCase();
      if (roomLower.includes('living')) {
        return 'living rooms as focal or accent pieces';
      } else if (roomLower.includes('bedroom')) {
        return 'bedrooms for rest and relaxation';
      } else if (roomLower.includes('dining')) {
        return 'dining spaces for meals and gatherings';
      } else if (roomLower.includes('office') || roomLower.includes('study')) {
        return 'home offices or study areas for productive work';
      } else if (roomLower.includes('entryway') || roomLower.includes('foyer')) {
        return 'entryways to create welcoming first impressions';
      } else {
        return `${room} settings`;
      }
    });
    
    sections.push(`PLACEMENT CONTEXT: This piece works beautifully in ${placementSuggestions.join(', ')}.`);
  }
  
  // Combine all sections into final description
  const finalDescription = sections.join(' ');
  
  // Ensure we have at least a basic description
  if (finalDescription.trim().length < 50) {
    return `${product.name}. ${product.description || 'A quality furniture piece designed for modern interiors.'}`;
  }
  
  return finalDescription;
}

/**
 * Batch generate rich descriptions for multiple products
 * Returns a map of SKU to generated description
 */
export function batchGenerateDescriptions(products: Product[]): Map<string, string> {
  const descriptions = new Map<string, string>();
  
  for (const product of products) {
    const richDescription = generateRichProductDescription(product);
    descriptions.set(product.sku, richDescription);
  }
  
  return descriptions;
}
