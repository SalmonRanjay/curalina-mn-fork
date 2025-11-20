import type { StructuredAttributeSet, StructuredAnalysisData } from "@shared/schema";

/**
 * Parse raw Gemini structured output into JSON and score quality
 */
export class StructuredAnalysisParser {
  /**
   * Extract structured attributes from raw text using regex patterns
   */
  private static extractAttributes(text: string): Partial<StructuredAttributeSet> {
    const lines = text.split('\n');
    const attributes: Partial<StructuredAttributeSet> = {
      confidence: 0,
      distinctiveFeatures: []
    };

    for (const line of lines) {
      // Product Name: [value]
      if (line.startsWith('Product Name:')) {
        attributes.productName = line.replace('Product Name:', '').trim();
      }
      // Primary Material: [value]
      else if (line.startsWith('Primary Material:')) {
        attributes.primaryMaterial = line.replace('Primary Material:', '').trim();
      }
      // Color & Finish: [value] with optional HEX
      else if (line.startsWith('Color & Finish:')) {
        const colorText = line.replace('Color & Finish:', '').trim();
        attributes.colorAndFinish = colorText;
        
        // Extract HEX color if present (e.g., "#F8F8F8" or "#000000")
        const hexMatch = colorText.match(/#[0-9A-Fa-f]{6}/);
        if (hexMatch) {
          attributes.hexColor = hexMatch[0];
        }
      }
      // Form Factor: [value]
      else if (line.startsWith('Form Factor:')) {
        attributes.formFactor = line.replace('Form Factor:', '').trim();
      }
      // Dimensions: [value] - parse H:xx W:xx D:xx format
      else if (line.startsWith('Dimensions:')) {
        const dimensionText = line.replace('Dimensions:', '').trim();
        attributes.dimensions = this.parseDimensions(dimensionText);
      }
      // Key Geometry: [value]
      else if (line.startsWith('Key Geometry:')) {
        attributes.keyGeometry = line.replace('Key Geometry:', '').trim();
      }
      // Distinctive Features: [value] - parse as comma-separated list
      else if (line.startsWith('Distinctive Features:')) {
        const featuresText = line.replace('Distinctive Features:', '').trim();
        attributes.distinctiveFeatures = featuresText
          .split(',')
          .map(f => f.trim())
          .filter(f => f.length > 0)
          .slice(0, 3); // Max 3 features
      }
      // View-Specific Details: [value]
      else if (line.startsWith('View-Specific Details:')) {
        attributes.viewSpecificDetails = line.replace('View-Specific Details:', '').trim();
      }
    }

    return attributes;
  }

  /**
   * Parse dimension string like "H:21.5" W:18.5" D:16"" into structured object
   */
  private static parseDimensions(dimensionText: string): StructuredAttributeSet['dimensions'] {
    const dimensions: StructuredAttributeSet['dimensions'] = { unit: 'inches' };

    // Match patterns like H:21.5", W:18.5", D:16"
    const heightMatch = dimensionText.match(/H[:\s]*(\d+\.?\d*)/i);
    const widthMatch = dimensionText.match(/W[:\s]*(\d+\.?\d*)/i);
    const depthMatch = dimensionText.match(/D[:\s]*(\d+\.?\d*)/i);

    if (heightMatch) dimensions.height = parseFloat(heightMatch[1]);
    if (widthMatch) dimensions.width = parseFloat(widthMatch[1]);
    if (depthMatch) dimensions.depth = parseFloat(depthMatch[1]);

    // Detect unit (cm or inches)
    if (dimensionText.toLowerCase().includes('cm')) {
      dimensions.unit = 'cm';
    }

    return dimensions;
  }

  /**
   * Calculate quality score for structured analysis (0-100)
   */
  private static scoreQuality(attributes: Partial<StructuredAttributeSet>): number {
    let score = 0;
    let totalWeight = 0;

    const checks = [
      { key: 'productName', weight: 10, present: !!attributes.productName },
      { key: 'primaryMaterial', weight: 15, present: !!attributes.primaryMaterial },
      { key: 'colorAndFinish', weight: 15, present: !!attributes.colorAndFinish },
      { key: 'hexColor', weight: 15, present: !!attributes.hexColor },
      { key: 'formFactor', weight: 15, present: !!attributes.formFactor },
      { key: 'dimensions', weight: 15, present: !!attributes.dimensions && (!!attributes.dimensions.height || !!attributes.dimensions.width || !!attributes.dimensions.depth) },
      { key: 'keyGeometry', weight: 10, present: !!attributes.keyGeometry },
      { key: 'distinctiveFeatures', weight: 10, present: !!attributes.distinctiveFeatures && attributes.distinctiveFeatures.length > 0 },
    ];

    for (const check of checks) {
      totalWeight += check.weight;
      if (check.present) {
        score += check.weight;
      }
    }

    // Normalize to 0-100
    return Math.round((score / totalWeight) * 100);
  }

  /**
   * Parse raw Gemini output and generate structured analysis with quality scoring
   */
  static parse(rawText: string, isFrontView: boolean = false): StructuredAttributeSet {
    const attributes = this.extractAttributes(rawText);
    const confidence = this.scoreQuality(attributes);

    // Fill in defaults and ensure all required fields exist
    const result: StructuredAttributeSet = {
      productName: attributes.productName || 'Unknown Product',
      primaryMaterial: attributes.primaryMaterial || 'Not specified',
      colorAndFinish: attributes.colorAndFinish || 'Not specified',
      hexColor: attributes.hexColor,
      formFactor: attributes.formFactor || 'Not specified',
      dimensions: attributes.dimensions,
      keyGeometry: attributes.keyGeometry || 'Not specified',
      distinctiveFeatures: attributes.distinctiveFeatures || [],
      viewSpecificDetails: attributes.viewSpecificDetails,
      confidence,
    };

    return result;
  }

  /**
   * Build complete structured analysis with front-view and multi-angle data
   */
  static buildAnalysis(
    frontViewRaw: string,
    multiAngleRaw?: string
  ): StructuredAnalysisData {
    const frontView = frontViewRaw ? this.parse(frontViewRaw, true) : undefined;
    const multiAngle = multiAngleRaw ? this.parse(multiAngleRaw, false) : undefined;

    return {
      frontView,
      multiAngle,
      analysisDate: new Date().toISOString(),
      geminiVersion: 'gemini-2.5-flash',
    };
  }

  /**
   * Calculate overall quality score for the analysis
   */
  static getOverallQuality(analysis: StructuredAnalysisData): number {
    const scores: number[] = [];

    if (analysis.frontView) {
      scores.push(analysis.frontView.confidence);
    }
    if (analysis.multiAngle) {
      scores.push(analysis.multiAngle.confidence);
    }

    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  /**
   * Validate if analysis meets minimum quality threshold
   */
  static isQualityAcceptable(
    analysis: StructuredAnalysisData,
    minScore: number = 60
  ): boolean {
    const score = this.getOverallQuality(analysis);
    return score >= minScore;
  }
}
