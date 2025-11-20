import type { StructuredAttributeSet, StructuredAnalysisData } from "@shared/schema";

export interface DetailedQualityMetrics {
  colorAccuracy: { score: number; details: string };
  dimensionPrecision: { score: number; details: string };
  materialSpecificity: { score: number; details: string };
  textureDetail: { score: number; details: string };
  featureCompleteness: { score: number; details: string };
  geometryPrecision: { score: number; details: string };
  overallScore: number;
  regenerationReadiness: 'ready' | 'caution' | 'needs_work';
}

export class EnhancedQualityScorer {
  /**
   * Score color accuracy based on HEX code presence and specificity
   */
  static scoreColorAccuracy(analysis: StructuredAttributeSet): { score: number; details: string } {
    const hexPattern = /#[0-9A-Fa-f]{6}/;
    const hasHex = hexPattern.test(analysis.hexColor || '');
    const colorFinishLength = analysis.colorAndFinish?.length || 0;
    
    let score = 0;
    if (hasHex) score += 50;
    if (colorFinishLength > 30) score += 30;
    if (colorFinishLength > 50) score += 20;
    
    const details = hasHex ? 'HEX color found' : 'No HEX color specified';
    return { score: Math.min(100, score), details };
  }

  /**
   * Score dimension precision
   */
  static scoreDimensionPrecision(analysis: StructuredAttributeSet): { score: number; details: string } {
    const dims = analysis.dimensions;
    if (!dims) return { score: 0, details: 'No dimensions provided' };

    let score = 0;
    let foundDimensions = 0;

    if (dims.height) { score += 25; foundDimensions++; }
    if (dims.width) { score += 25; foundDimensions++; }
    if (dims.depth) { score += 25; foundDimensions++; }
    if (dims.unit === 'inches' || dims.unit === 'cm') { score += 25; }

    const details = `${foundDimensions}/3 dimensions with unit`;
    return { score, details };
  }

  /**
   * Score material specificity
   */
  static scoreMaterialSpecificity(analysis: StructuredAttributeSet): { score: number; details: string } {
    const material = analysis.primaryMaterial || '';
    
    let score = 0;
    
    // Check for specific material types (not generic)
    if (/solid|wood|oak|walnut|maple|pine|ash/i.test(material)) score += 20;
    if (/upholster|fabric|leather|linen|cotton|wool/i.test(material)) score += 20;
    if (/metal|steel|brass|aluminum|iron|chrome/i.test(material)) score += 20;
    if (/finish|lacquer|stain|varnish|gloss|matte|satin/i.test(material)) score += 20;
    if (/poly|foam|cushion|padding/i.test(material)) score += 20;

    const details = material.length > 20 ? 'Detailed material description' : 'Basic material name';
    return { score: Math.min(100, score), details };
  }

  /**
   * Score texture detail
   */
  static scoreTextureDetail(analysis: StructuredAttributeSet): { score: number; details: string } {
    const geometry = analysis.keyGeometry || '';
    const viewDetails = analysis.viewSpecificDetails || '';
    
    let score = 0;
    
    if (/grain|weave|pattern|texture|finish|surface/i.test(geometry)) score += 40;
    if (/grain|weave|pattern|texture|finish|surface/i.test(viewDetails)) score += 30;
    if (geometry.length > 50) score += 30;
    
    const details = geometry.length > 30 ? 'Detailed geometry description' : 'Basic geometry';
    return { score: Math.min(100, score), details };
  }

  /**
   * Score feature completeness
   */
  static scoreFeatureCompleteness(analysis: StructuredAttributeSet): { score: number; details: string } {
    const features = analysis.distinctiveFeatures || [];
    const score = Math.min(100, features.length * 25);
    const details = `${features.length} distinctive features identified`;
    return { score, details };
  }

  /**
   * Score geometry precision
   */
  static scoreGeometryPrecision(analysis: StructuredAttributeSet): { score: number; details: string } {
    const geometry = analysis.keyGeometry || '';
    const formFactor = analysis.formFactor || '';
    
    let score = 0;
    
    // Check for shape descriptors
    if (/curved|linear|geometric|symmetrical|asymmetrical/i.test(geometry)) score += 25;
    if (/tapered|splayed|angled|perpendicular/i.test(geometry)) score += 25;
    if (geometry.length > 40) score += 25;
    if (formFactor.length > 15) score += 25;
    
    const details = geometry.length > 30 ? 'Precise geometry specified' : 'Generic geometry';
    return { score: Math.min(100, score), details };
  }

  /**
   * Calculate comprehensive quality metrics
   */
  static calculateMetrics(analysis: StructuredAttributeSet): DetailedQualityMetrics {
    const colorAccuracy = this.scoreColorAccuracy(analysis);
    const dimensionPrecision = this.scoreDimensionPrecision(analysis);
    const materialSpecificity = this.scoreMaterialSpecificity(analysis);
    const textureDetail = this.scoreTextureDetail(analysis);
    const featureCompleteness = this.scoreFeatureCompleteness(analysis);
    const geometryPrecision = this.scoreGeometryPrecision(analysis);

    const overallScore = Math.round(
      (colorAccuracy.score + 
       dimensionPrecision.score + 
       materialSpecificity.score + 
       textureDetail.score + 
       featureCompleteness.score + 
       geometryPrecision.score) / 6
    );

    const regenerationReadiness: 'ready' | 'caution' | 'needs_work' = 
      overallScore >= 75 ? 'ready' :
      overallScore >= 50 ? 'caution' :
      'needs_work';

    return {
      colorAccuracy,
      dimensionPrecision,
      materialSpecificity,
      textureDetail,
      featureCompleteness,
      geometryPrecision,
      overallScore,
      regenerationReadiness
    };
  }

  /**
   * Generate human-readable quality report
   */
  static generateReport(analysis: StructuredAttributeSet): string {
    const metrics = this.calculateMetrics(analysis);
    
    return `QUALITY ANALYSIS REPORT
================================
Product: ${analysis.productName}
Overall Score: ${metrics.overallScore}/100 (${metrics.regenerationReadiness.toUpperCase()})

DETAILED METRICS:
- Color Accuracy: ${metrics.colorAccuracy.score}/100 (${metrics.colorAccuracy.details})
- Dimension Precision: ${metrics.dimensionPrecision.score}/100 (${metrics.dimensionPrecision.details})
- Material Specificity: ${metrics.materialSpecificity.score}/100 (${metrics.materialSpecificity.details})
- Texture Detail: ${metrics.textureDetail.score}/100 (${metrics.textureDetail.details})
- Feature Completeness: ${metrics.featureCompleteness.score}/100 (${metrics.featureCompleteness.details})
- Geometry Precision: ${metrics.geometryPrecision.score}/100 (${metrics.geometryPrecision.details})

RECOMMENDATIONS:
${metrics.regenerationReadiness === 'ready' 
  ? '✅ This product is ready for accurate renders!' 
  : metrics.regenerationReadiness === 'caution'
  ? '⚠️ Review and enhance color/dimension details before rendering'
  : '❌ Requires comprehensive re-analysis with enhanced focus'}`;
  }
}
