import type { ICuralinaStorage } from "../storage-curalina";

interface ImageValidationResult {
  url: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
}

interface WorkerStats {
  lastRunAt: Date | null;
  totalChecked: number;
  totalValid: number;
  totalInvalid: number;
  isRunning: boolean;
}

export class ImageHealthWorker {
  private storage: ICuralinaStorage;
  private isRunning: boolean = false;
  private stats: WorkerStats = {
    lastRunAt: null,
    totalChecked: 0,
    totalValid: 0,
    totalInvalid: 0,
    isRunning: false
  };

  constructor(storage: ICuralinaStorage) {
    this.storage = storage;
  }

  async validateImageUrl(url: string): Promise<ImageValidationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      return {
        url,
        isValid: response.ok,
        statusCode: response.status
      };
    } catch (error: any) {
      return {
        url,
        isValid: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  async validateProduct(productId: string): Promise<{
    productId: string;
    results: ImageValidationResult[];
    overallHealth: 'healthy' | 'repairing' | 'removed';
  }> {
    const product = await this.storage.getProduct(productId);
    
    if (!product || !product.images || product.images.length === 0) {
      return {
        productId,
        results: [],
        overallHealth: 'removed'
      };
    }

    // Validate all image URLs
    const results = await Promise.all(
      product.images.map((url: string) => this.validateImageUrl(url))
    );

    // Determine overall health
    const allValid = results.every((r: ImageValidationResult) => r.isValid);
    const someValid = results.some((r: ImageValidationResult) => r.isValid);

    let overallHealth: 'healthy' | 'repairing' | 'removed';
    if (allValid) {
      overallHealth = 'healthy';
    } else if (someValid) {
      overallHealth = 'repairing'; // Some images need repair
    } else {
      overallHealth = 'removed'; // All images invalid
    }

    // Update product status
    await this.storage.setProductImageHealthStatus(productId, overallHealth, {
      validatedAt: new Date().toISOString(),
      action: 'automated_validation',
      results: results.map((r: ImageValidationResult) => ({
        url: r.url,
        isValid: r.isValid,
        statusCode: r.statusCode,
        error: r.error
      }))
    });

    return {
      productId,
      results,
      overallHealth
    };
  }

  async runValidation(): Promise<{
    processed: number;
    updated: number;
    errors: string[];
  }> {
    if (this.isRunning) {
      throw new Error('Validation worker is already running');
    }

    this.isRunning = true;
    this.stats.isRunning = true;
    
    const errors: string[] = [];
    let processed = 0;
    let updated = 0;

    try {
      // Fetch all products marked as 'repairing' for revalidation
      const products = await this.storage.getProducts();
      const repairingProducts = products.filter(p => p.imageHealth === 'repairing');

      console.log(`[ImageHealthWorker] Starting validation for ${repairingProducts.length} products marked as repairing`);

      for (const product of repairingProducts) {
        try {
          const result = await this.validateProduct(product.id);
          processed++;
          
          if (result.overallHealth !== product.imageHealth) {
            updated++;
            console.log(`[ImageHealthWorker] Updated product ${product.id} (${product.name}): ${product.imageHealth} -> ${result.overallHealth}`);
          }

          this.stats.totalChecked++;
          if (result.overallHealth === 'healthy') {
            this.stats.totalValid++;
          } else {
            this.stats.totalInvalid++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to validate product ${product.id}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`[ImageHealthWorker] ${errorMsg}`);
        }
      }

      this.stats.lastRunAt = new Date();
      console.log(`[ImageHealthWorker] Validation complete: ${processed} processed, ${updated} updated, ${errors.length} errors`);

      return { processed, updated, errors };
    } finally {
      this.isRunning = false;
      this.stats.isRunning = false;
    }
  }

  getStats(): WorkerStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      lastRunAt: null,
      totalChecked: 0,
      totalValid: 0,
      totalInvalid: 0,
      isRunning: this.isRunning
    };
  }
}
