/**
 * Rate limiter with exponential backoff for API calls
 */

interface RateLimiterConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

interface RateLimiterState {
  retryCount: number;
  lastAttemptTime: number;
  currentDelay: number;
}

export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private states: Map<string, RateLimiterState> = new Map();
  
  constructor(config: RateLimiterConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
    };
  }
  
  /**
   * Execute a function with rate limiting and exponential backoff
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options: { immediate?: boolean } = {}
  ): Promise<T> {
    const state = this.getOrCreateState(key);
    
    // Apply delay unless immediate is requested
    if (!options.immediate) {
      const timeSinceLastAttempt = Date.now() - state.lastAttemptTime;
      const remainingDelay = Math.max(0, state.currentDelay - timeSinceLastAttempt);
      
      if (remainingDelay > 0) {
        await this.delay(remainingDelay);
      }
    }
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        state.lastAttemptTime = Date.now();
        const result = await fn();
        
        // Success - reset state
        this.resetState(key);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Rate limiter: Attempt ${attempt + 1} failed for ${key}:`, error);
        
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          state.retryCount++;
          state.currentDelay = Math.min(
            state.currentDelay * this.config.backoffMultiplier,
            this.config.maxDelay
          );
          
          if (attempt < this.config.maxRetries) {
            console.log(`Rate limiter: Backing off for ${state.currentDelay}ms...`);
            await this.delay(state.currentDelay);
          }
        } else {
          // Non-rate-limit error, propagate immediately
          throw error;
        }
      }
    }
    
    // All retries exhausted
    throw new Error(`Rate limiter: Max retries (${this.config.maxRetries}) exceeded for ${key}. Last error: ${lastError?.message}`);
  }
  
  /**
   * Batch execute with rate limiting across multiple items
   */
  async executeBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      adaptiveDelay?: boolean;
    } = {}
  ): Promise<Array<{ item: T; result?: R; error?: Error }>> {
    const {
      batchSize = 10,
      delayBetweenBatches = 5000,
      adaptiveDelay = true
    } = options;
    
    const results: Array<{ item: T; result?: R; error?: Error }> = [];
    let consecutiveSuccesses = 0;
    let consecutiveErrors = 0;
    let currentDelay = delayBetweenBatches;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await processor(item);
          return { item, result };
        } catch (error) {
          return { item, error: error as Error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Update adaptive delay based on results
      if (adaptiveDelay) {
        const successCount = batchResults.filter(r => !r.error).length;
        const errorCount = batchResults.filter(r => r.error).length;
        
        if (errorCount > successCount) {
          consecutiveErrors++;
          consecutiveSuccesses = 0;
          // Increase delay on errors
          currentDelay = Math.min(currentDelay * 1.5, this.config.maxDelay);
        } else {
          consecutiveSuccesses++;
          consecutiveErrors = 0;
          // Decrease delay on successes
          currentDelay = Math.max(currentDelay * 0.8, this.config.initialDelay);
        }
      }
      
      // Apply delay between batches if not the last batch
      if (i + batchSize < items.length) {
        console.log(`Rate limiter: Waiting ${Math.round(currentDelay)}ms before next batch...`);
        await this.delay(currentDelay);
      }
    }
    
    return results;
  }
  
  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalKeys: number;
    activeStates: Array<{ key: string; state: RateLimiterState }>;
  } {
    return {
      totalKeys: this.states.size,
      activeStates: Array.from(this.states.entries()).map(([key, state]) => ({
        key,
        state
      }))
    };
  }
  
  /**
   * Reset all rate limiter states
   */
  reset(): void {
    this.states.clear();
  }
  
  private getOrCreateState(key: string): RateLimiterState {
    if (!this.states.has(key)) {
      this.states.set(key, {
        retryCount: 0,
        lastAttemptTime: 0,
        currentDelay: this.config.initialDelay
      });
    }
    return this.states.get(key)!;
  }
  
  private resetState(key: string): void {
    this.states.delete(key);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('throttle')
      );
    }
    return false;
  }
}

// Singleton instance for global rate limiting
export const globalRateLimiter = new RateLimiter({
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2
});

/**
 * Decorator for applying rate limiting to class methods
 */
export function RateLimit(config?: RateLimiterConfig) {
  const limiter = new RateLimiter(config);
  
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const key = `${target.constructor.name}.${propertyKey}`;
      return limiter.execute(key, () => originalMethod.apply(this, args));
    };
    
    return descriptor;
  };
}