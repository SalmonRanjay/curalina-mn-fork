/**
 * Configuration for Visual Analysis system
 * Controls feature flags and migration settings
 */

export const visualAnalysisConfig = {
  // Feature flag to use V2 visual analysis system
  // Set to true to use enhanced V2 with concurrent processing
  // Set to false to fallback to V1 (for emergency rollback)
  useV2: process.env.USE_VISUAL_ANALYSIS_V2 !== 'false', // Default to true unless explicitly disabled
  
  // V2 Configuration
  v2: {
    workerCount: parseInt(process.env.VISUAL_ANALYSIS_WORKERS || '5'),
    batchSize: parseInt(process.env.VISUAL_ANALYSIS_BATCH_SIZE || '20'),
    checkpointInterval: parseInt(process.env.VISUAL_ANALYSIS_CHECKPOINT || '10'),
    maxRetries: parseInt(process.env.VISUAL_ANALYSIS_MAX_RETRIES || '3'),
    
    // Rate limiting
    rateLimiting: {
      initialDelay: parseInt(process.env.VISUAL_ANALYSIS_INITIAL_DELAY || '2000'),
      maxDelay: parseInt(process.env.VISUAL_ANALYSIS_MAX_DELAY || '30000'),
      backoffMultiplier: parseFloat(process.env.VISUAL_ANALYSIS_BACKOFF || '2'),
    },
    
    // Priority settings
    priorities: {
      manual: 50,
      autoAfterUpload: 30,
      retry: 10
    }
  },
  
  // Logging
  verbose: process.env.VISUAL_ANALYSIS_VERBOSE === 'true'
};

export default visualAnalysisConfig;