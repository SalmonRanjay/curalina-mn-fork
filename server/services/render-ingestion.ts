import type { InsertRenderProduct, InsertRenderEvent, Render } from "@shared/schema";
import type { SelectionLedger, Product } from "@shared/schema";
import { curalinaStorage } from "../storage-curalina";

interface ProductWithPlacement {
  sku: string;
  name: string;
  placement?: string;
  reasoning?: string;
  visualDescription?: string;
  placementData?: {
    position?: { x: number; y: number };
    zone?: string;
    orientation?: number;
    anchorTo?: string;
    clearance?: number;
  };
}

interface IngestRenderSnapshotParams {
  render: Render;
  productsWithPlacement: ProductWithPlacement[];
  allProducts: Product[];
  ledgerData: SelectionLedger | null;
  quizContext: {
    roomType: string;
    style: string;
    budget?: number;
  };
}

export async function buildRenderProductSnapshots(
  params: IngestRenderSnapshotParams
): Promise<InsertRenderProduct[]> {
  const { render, productsWithPlacement, allProducts, ledgerData, quizContext } = params;
  
  const snapshots: InsertRenderProduct[] = [];
  
  // Fetch suppliers and categories once, create indexed maps for O(1) lookup
  const suppliers = await curalinaStorage.getAllSuppliers();
  const categories = await curalinaStorage.getAllCategories();
  
  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  
  // Create product catalog index for fast lookup
  const productCatalog = new Map(allProducts.map(p => [p.sku, p]));
  
  // Deduplicate products by SKU (keep first occurrence to preserve original placement metadata)
  const deduplicatedProducts = Array.from(
    new Map(productsWithPlacement.map(p => [p.sku, p])).values()
  );
  
  if (deduplicatedProducts.length < productsWithPlacement.length) {
    console.warn(`⚠️ Deduplication: ${productsWithPlacement.length} → ${deduplicatedProducts.length} products (removed ${productsWithPlacement.length - deduplicatedProducts.length} duplicates)`);
  }
  
  for (const productWithPlacement of deduplicatedProducts) {
    // Lookup full product from catalog
    const fullProduct = productCatalog.get(productWithPlacement.sku);
    
    if (!fullProduct) {
      throw new Error(`Product ${productWithPlacement.sku} not found in catalog - cannot create snapshot. This indicates data inconsistency.`);
    }
    
    // Check if visual description exists
    const hasVisualDescription = !!productWithPlacement.visualDescription;
    
    // Build placement data object if placement information exists
    const placementData = productWithPlacement.placementData ? {
      position: productWithPlacement.placementData.position || null,
      zone: productWithPlacement.placementData.zone || null,
      orientation: productWithPlacement.placementData.orientation || null,
      anchorTo: productWithPlacement.placementData.anchorTo || null,
      clearance: productWithPlacement.placementData.clearance || null,
      placementTarget: productWithPlacement.placement || null,
      confidence: null, // Could be calculated from placement data quality
    } : null;
    
    // Lookup supplier and category names using indexed maps (O(1))
    const supplierName = fullProduct.supplierId ? supplierMap.get(fullProduct.supplierId) || null : null;
    const categoryName = fullProduct.categoryId ? categoryMap.get(fullProduct.categoryId) || null : null;
    
    // Build snapshot record matching actual schema
    const snapshot: InsertRenderProduct = {
      renderId: render.id,
      productId: fullProduct.id,
      sku: fullProduct.sku,
      name: fullProduct.name,
      supplierName,
      categoryName,
      roomType: fullProduct.roomType || null,
      designStyle: fullProduct.designStyle || null,
      styleTags: fullProduct.styleTags || null,
      priceAtRender: fullProduct.price,
      availability: fullProduct.availability || 'available',
      imageHealth: fullProduct.imageHealth || 'unknown',
      visualDescriptionSource: hasVisualDescription ? 'Gemini Vision' : null,
      dimensions: fullProduct.dimensions as any || null,
      placementData: placementData as any,
      primaryImageUrl: fullProduct.images && fullProduct.images.length > 0 ? fullProduct.images[0] : null,
      metadata: {
        reasoning: productWithPlacement.reasoning || null,
        visualDescription: productWithPlacement.visualDescription || null,
        quizContext: {
          roomType: quizContext.roomType,
          style: quizContext.style,
          budget: quizContext.budget || null,
        },
        ledgerSnapshot: ledgerData ? {
          selectionHash: ledgerData.selectionHash,
          compositionOrder: ledgerData.compositionOrder,
        } : null,
      } as any,
    };
    
    snapshots.push(snapshot);
  }
  
  return snapshots;
}

export function buildRenderEvent(
  renderId: string,
  eventType: 'submitted' | 'processing' | 'completed' | 'failed' | 'ingestion_failed',
  details?: string,
  actorUserId?: string | null
): InsertRenderEvent {
  const eventMessages: Record<typeof eventType, string> = {
    'submitted': 'Render request submitted by user',
    'processing': 'AI generation started',
    'completed': 'Render completed successfully',
    'failed': 'Render generation failed',
    'ingestion_failed': 'Product snapshot ingestion failed'
  };
  
  return {
    renderId,
    eventType,
    actorUserId: actorUserId || null,
    metadata: {
      message: details || eventMessages[eventType],
      timestamp: new Date().toISOString(),
    } as any,
  };
}

export async function ingestRenderSnapshot(
  params: IngestRenderSnapshotParams,
  lifecycleEvents: InsertRenderEvent[]
): Promise<void> {
  const { render } = params;
  
  try {
    const productSnapshots = await buildRenderProductSnapshots(params);
    
    await curalinaStorage.ingestRenderSnapshot(
      render.id,
      productSnapshots,
      lifecycleEvents
    );
    
    console.log(`✅ Ingested ${productSnapshots.length} product snapshots + ${lifecycleEvents.length} events for render ${render.id}`);
  } catch (error) {
    console.error(`❌ Failed to ingest render snapshot for render ${render.id}:`, error);
    
    const failedEvent = buildRenderEvent(
      render.id,
      'ingestion_failed',
      error instanceof Error ? error.message : 'Unknown ingestion error'
    );
    
    try {
      await curalinaStorage.createRenderEvent(failedEvent);
    } catch (eventError) {
      console.error('Failed to log ingestion failure event:', eventError);
    }
    
    throw error;
  }
}
